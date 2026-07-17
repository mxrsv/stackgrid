use crate::pty::PtyState;
use tauri::State;

#[derive(Clone, serde::Serialize)]
pub struct PtyInfo {
    pub id: u32,
    pub cwd: Option<String>,
    pub process: Option<String>,
}

/// Foreground process name + cwd for each PTY. Lookup failures degrade to
/// `None` fields — the command itself never fails in practice, so the
/// frontend polling loop keeps running.
#[tauri::command]
pub async fn pty_info(
    state: State<'_, PtyState>,
    ids: Vec<u32>,
) -> Result<Vec<PtyInfo>, String> {
    let pids = state.foreground_pids(&ids);
    Ok(pids
        .into_iter()
        .map(|(id, pid)| match pid {
            Some(pid) => PtyInfo {
                id,
                cwd: process_cwd(pid),
                process: process_name(pid),
            },
            None => PtyInfo {
                id,
                cwd: None,
                process: None,
            },
        })
        .collect())
}

/// Current branch of the repo containing `cwd`; `None` when not a repo
/// (or git is missing / the lookup fails).
#[tauri::command]
pub async fn git_branch(cwd: String) -> Option<String> {
    let output = std::process::Command::new("git")
        .args(["-C", &cwd, "rev-parse", "--abbrev-ref", "HEAD"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let branch = String::from_utf8(output.stdout).ok()?.trim().to_string();
    (!branch.is_empty()).then_some(branch)
}

#[cfg(target_os = "macos")]
fn process_name(pid: i32) -> Option<String> {
    // The kernel-side names are useless for Claude Code: its `claude` launcher
    // execs a binary literally named after the version (e.g.
    // `~/.local/share/claude/versions/2.1.210`), so proc_name / pbi_comm and
    // the executable path all report "2.1.210". argv[0] is what the user
    // invoked — the same source `ps -o comm` displays — so prefer it and only
    // fall back to proc_name when the args sysctl fails (zombies, permission).
    argv0_name(pid).or_else(|| proc_name_raw(pid))
}

/// Basename of argv[0] via KERN_PROCARGS2, minus a login shell's "-" prefix.
#[cfg(target_os = "macos")]
fn argv0_name(pid: i32) -> Option<String> {
    let mut mib = [libc::CTL_KERN, libc::KERN_PROCARGS2, pid];
    let mut size: libc::size_t = 0;
    let ok = unsafe {
        libc::sysctl(
            mib.as_mut_ptr(),
            mib.len() as libc::c_uint,
            std::ptr::null_mut(),
            &mut size,
            std::ptr::null_mut(),
            0,
        )
    };
    if ok != 0 || size <= std::mem::size_of::<libc::c_int>() {
        return None;
    }
    let mut buf = vec![0u8; size];
    let ok = unsafe {
        libc::sysctl(
            mib.as_mut_ptr(),
            mib.len() as libc::c_uint,
            buf.as_mut_ptr() as *mut libc::c_void,
            &mut size,
            std::ptr::null_mut(),
            0,
        )
    };
    if ok != 0 {
        return None;
    }
    buf.truncate(size);
    // Layout: [argc: c_int][exec_path\0][\0 padding…][argv0\0][argv1\0]…
    let rest = buf.get(std::mem::size_of::<libc::c_int>()..)?;
    let exec_end = rest.iter().position(|&b| b == 0)?;
    let after_exec = &rest[exec_end..];
    let argv0_start = after_exec.iter().position(|&b| b != 0)?;
    let argv0_bytes = &after_exec[argv0_start..];
    let argv0_end = argv0_bytes.iter().position(|&b| b == 0)?;
    let argv0 = std::str::from_utf8(&argv0_bytes[..argv0_end]).ok()?;
    let base = argv0.rsplit('/').next()?.trim_start_matches('-');
    (!base.is_empty()).then(|| base.to_string())
}

/// Old behavior: the kernel process name (truncates to 2*MAXCOMLEN ~32 bytes).
#[cfg(target_os = "macos")]
fn proc_name_raw(pid: i32) -> Option<String> {
    let mut buf = [0u8; 64];
    let len = unsafe {
        libc::proc_name(pid, buf.as_mut_ptr() as *mut libc::c_void, buf.len() as u32)
    };
    if len <= 0 {
        return None;
    }
    String::from_utf8(buf[..len as usize].to_vec()).ok()
}

#[cfg(target_os = "macos")]
fn process_cwd(pid: i32) -> Option<String> {
    let mut info: libc::proc_vnodepathinfo = unsafe { std::mem::zeroed() };
    let size = std::mem::size_of::<libc::proc_vnodepathinfo>() as libc::c_int;
    let read = unsafe {
        libc::proc_pidinfo(
            pid,
            libc::PROC_PIDVNODEPATHINFO,
            0,
            &mut info as *mut _ as *mut libc::c_void,
            size,
        )
    };
    if read < size {
        return None;
    }
    let path = unsafe {
        std::ffi::CStr::from_ptr(info.pvi_cdir.vip_path.as_ptr() as *const libc::c_char)
    };
    path.to_str()
        .ok()
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
}

#[cfg(not(target_os = "macos"))]
fn process_name(_pid: i32) -> Option<String> {
    None
}

#[cfg(not(target_os = "macos"))]
fn process_cwd(_pid: i32) -> Option<String> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Spawn `/bin/sleep` announcing itself as `arg0`, run `check`, then kill.
    #[cfg(target_os = "macos")]
    fn with_renamed_sleep(arg0: &str, check: impl FnOnce(i32)) {
        use std::os::unix::process::CommandExt;
        let mut child = std::process::Command::new("/bin/sleep")
            .arg0(arg0)
            .arg("10")
            .spawn()
            .expect("spawn sleep");
        // Give exec a beat so KERN_PROCARGS2 reflects the final argv.
        std::thread::sleep(std::time::Duration::from_millis(200));
        check(child.id() as i32);
        let _ = child.kill();
        let _ = child.wait();
    }

    /// Claude Code's launcher execs a binary named after its version, so only
    /// argv[0] carries "claude" — process_name must prefer argv[0].
    #[cfg(target_os = "macos")]
    #[test]
    fn process_name_prefers_argv0_over_the_executable_name() {
        with_renamed_sleep("fake-agent", |pid| {
            assert_eq!(process_name(pid).as_deref(), Some("fake-agent"));
        });
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn process_name_takes_the_basename_of_a_path_argv0() {
        with_renamed_sleep("/usr/local/bin/claude", |pid| {
            assert_eq!(process_name(pid).as_deref(), Some("claude"));
        });
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn process_name_strips_the_login_shell_dash() {
        with_renamed_sleep("-zsh", |pid| {
            assert_eq!(process_name(pid).as_deref(), Some("zsh"));
        });
    }

    #[test]
    fn git_branch_is_none_outside_a_repo() {
        let dir = std::env::temp_dir().join("stackgrid-git-none");
        std::fs::create_dir_all(&dir).unwrap();
        let branch =
            tauri::async_runtime::block_on(git_branch(dir.to_string_lossy().into_owned()));
        assert_eq!(branch, None);
    }

    #[test]
    fn git_branch_reads_the_current_branch() {
        let dir = std::env::temp_dir().join(format!("stackgrid-git-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let git = |args: &[&str]| {
            let status = std::process::Command::new("git")
                .arg("-C")
                .arg(&dir)
                .args(args)
                .env("GIT_AUTHOR_NAME", "test")
                .env("GIT_AUTHOR_EMAIL", "test@test")
                .env("GIT_COMMITTER_NAME", "test")
                .env("GIT_COMMITTER_EMAIL", "test@test")
                .status()
                .unwrap();
            assert!(status.success());
        };
        git(&["init", "--initial-branch=main"]);
        git(&["commit", "--allow-empty", "-m", "init", "--no-gpg-sign"]);
        let branch =
            tauri::async_runtime::block_on(git_branch(dir.to_string_lossy().into_owned()));
        assert_eq!(branch, Some("main".to_string()));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
