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
    // proc_name truncates to 2*MAXCOMLEN (~32 bytes); 64 leaves headroom
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
