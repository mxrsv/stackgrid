use crate::coordinator::{emit_to_owner, WindowCoordinator};
use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use std::{
    collections::HashMap,
    io::{Read, Write},
    sync::{
        atomic::{AtomicU32, Ordering},
        Mutex,
    },
    thread,
};
use tauri::{AppHandle, Manager, State, WebviewWindow};

pub const EVENT_OUTPUT: &str = "pty:output";
pub const EVENT_EXIT: &str = "pty:exit";

#[derive(Clone, serde::Serialize)]
struct OutputPayload {
    id: u32,
    data: String,
}

#[derive(Clone, serde::Serialize)]
struct ExitPayload {
    id: u32,
}

struct Session {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    killer: Box<dyn ChildKiller + Send + Sync>,
    child_pid: Option<u32>,
}

#[derive(Default)]
pub struct PtyState {
    sessions: Mutex<HashMap<u32, Session>>,
    next_id: AtomicU32,
}

fn default_shell() -> String {
    std::env::var("SHELL").unwrap_or_else(|_| {
        if cfg!(windows) {
            "powershell.exe".into()
        } else {
            "/bin/zsh".into()
        }
    })
}

/// Drains the longest decodable prefix of `pending` into a String, leaving an
/// incomplete trailing UTF-8 sequence (at most 3 bytes) behind for the next
/// read. Invalid bytes inside the stream become U+FFFD and are consumed, so a
/// malformed byte can never stall the pipeline.
fn take_valid_utf8(pending: &mut Vec<u8>) -> String {
    let mut out = String::new();
    loop {
        match std::str::from_utf8(pending) {
            Ok(s) => {
                out.push_str(s);
                pending.clear();
                return out;
            }
            Err(e) => {
                let valid = e.valid_up_to();
                // The prefix up to the error is valid by definition.
                out.push_str(std::str::from_utf8(&pending[..valid]).unwrap_or(""));
                match e.error_len() {
                    // Incomplete sequence at the end — keep it for the next read.
                    None => {
                        pending.drain(..valid);
                        return out;
                    }
                    // Genuinely invalid bytes — replace and keep scanning.
                    Some(len) => {
                        out.push('\u{FFFD}');
                        pending.drain(..valid + len);
                    }
                }
            }
        }
    }
}

fn remove_session(app: &AppHandle, id: u32) {
    let state = app.state::<PtyState>();
    if let Ok(mut sessions) = state.sessions.lock() {
        sessions.remove(&id);
    };
}

/// Working directory for a new shell: an existing directory passes through,
/// anything else (missing, deleted, not a dir, None) falls back to `$HOME`.
fn resolve_spawn_cwd(cwd: Option<String>) -> Option<String> {
    cwd.filter(|dir| std::path::Path::new(dir).is_dir())
        .or_else(|| std::env::var("HOME").ok())
}

#[tauri::command]
pub fn spawn_shell(
    window: WebviewWindow,
    app: AppHandle,
    state: State<'_, PtyState>,
    coordinator: State<'_, WindowCoordinator>,
    cols: u16,
    rows: u16,
    cwd: Option<String>,
) -> Result<u32, String> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let shell = default_shell();
    let mut cmd = CommandBuilder::new(&shell);
    if !cfg!(windows) {
        // Login shell so PATH/rc files are loaded — CLIs like claude/codex stay visible
        cmd.arg("-l");
    }
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    if !cfg!(windows) {
        // Stackgrid consumes OSC 9;4 progress reports (the sidebar spinner),
        // but Claude Code only emits them when it recognizes the terminal:
        // its gate checks ConEmu* env vars or TERM_PROGRAM ghostty/iTerm.app
        // with a minimum TERM_PROGRAM_VERSION. ConEmuANSI=ON is the smallest
        // such capability flag — ConEmu is Windows-only, so no macOS tool
        // changes behavior on it (and on a real Windows build we must NOT
        // fake it: tools pick ConEmu-specific paths on a plain ConPTY).
        // Verified empirically (PTY harness): without this claude emits zero
        // OSC 9;4; with it, state 0 at startup, 3 while working, 0 when done.
        cmd.env("ConEmuANSI", "ON");
    }
    if let Some(dir) = resolve_spawn_cwd(cwd) {
        cmd.cwd(dir);
    }

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave);
    let child_pid = child.process_id();

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    let id = state.next_id.fetch_add(1, Ordering::Relaxed) + 1;
    {
        let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
        sessions.insert(
            id,
            Session {
                master: pair.master,
                writer,
                killer: child.clone_killer(),
                child_pid,
            },
        );
    }
    // Ownership seam: pane stays tied to the spawning window until Move to window.
    coordinator.register(id, window.label().to_string());

    let output_app = app.clone();
    thread::spawn(move || {
        let mut buf = [0u8; 8192];
        // Multi-byte UTF-8 sequences can straddle read boundaries; lossy-decoding
        // each chunk independently turns the split halves into U+FFFD, which
        // corrupts TUI output (extra columns → wrapped dividers → ghost lines).
        // Hold back an incomplete trailing sequence until the next read instead.
        let mut pending: Vec<u8> = Vec::new();
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    pending.extend_from_slice(&buf[..n]);
                    let data = take_valid_utf8(&mut pending);
                    if data.is_empty() {
                        continue;
                    }
                    let coordinator = output_app.state::<WindowCoordinator>();
                    emit_to_owner(
                        &output_app,
                        &coordinator,
                        id,
                        EVENT_OUTPUT,
                        OutputPayload { id, data },
                    );
                }
            }
        }
        // Stream ended mid-sequence — flush whatever is left, lossily.
        if !pending.is_empty() {
            let data = String::from_utf8_lossy(&pending).to_string();
            let coordinator = output_app.state::<WindowCoordinator>();
            emit_to_owner(
                &output_app,
                &coordinator,
                id,
                EVENT_OUTPUT,
                OutputPayload { id, data },
            );
        }
        remove_session(&output_app, id);
        {
            let coordinator = output_app.state::<WindowCoordinator>();
            // Emit exit while ownership is still known, then clear the map.
            emit_to_owner(
                &output_app,
                &coordinator,
                id,
                EVENT_EXIT,
                ExitPayload { id },
            );
            coordinator.unregister(id);
        }
    });

    thread::spawn(move || {
        let mut child = child;
        let _ = child.wait();
    });

    Ok(id)
}

#[tauri::command]
pub fn write_pty(state: State<PtyState>, id: u32, data: String) -> Result<(), String> {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    let session = sessions
        .get_mut(&id)
        .ok_or_else(|| format!("Terminal session #{id} not found"))?;
    session
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| e.to_string())?;
    session.writer.flush().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn resize_pty(state: State<PtyState>, id: u32, cols: u16, rows: u16) -> Result<(), String> {
    let sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    let session = sessions
        .get(&id)
        .ok_or_else(|| format!("Terminal session #{id} not found"))?;
    session
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())
}

/// How long a foreground job gets to react to SIGHUP (save swap, flush state)
/// before the group is SIGKILLed.
#[cfg(target_os = "macos")]
const KILL_GRACE: std::time::Duration = std::time::Duration::from_millis(500);

/// Tears down everything living on a pane's PTY, not just the login shell:
/// SIGKILL on the shell's own pid leaves grandchildren (agent CLIs, editors)
/// running, holding the slave fd open and leaking the reader thread. The
/// foreground job gets SIGHUP first so it can shut down cleanly, then is
/// SIGKILLed after `grace` in case it ignores hangups; the shell's group has
/// nothing to save and dies immediately.
#[cfg(target_os = "macos")]
fn terminate_process_groups(
    fg_pgid: Option<i32>,
    shell_pgid: Option<i32>,
    grace: std::time::Duration,
) {
    let fg = fg_pgid.filter(|pgid| *pgid > 1);
    let shell = shell_pgid.filter(|pgid| *pgid > 1);
    if let Some(pgid) = fg {
        unsafe { libc::killpg(pgid, libc::SIGHUP) };
        thread::spawn(move || {
            thread::sleep(grace);
            // ESRCH on an already-gone group is the normal case here.
            unsafe { libc::killpg(pgid, libc::SIGKILL) };
        });
    }
    if let Some(pgid) = shell {
        unsafe { libc::killpg(pgid, libc::SIGKILL) };
    }
}

#[tauri::command]
pub fn kill_pty(
    state: State<'_, PtyState>,
    coordinator: State<'_, WindowCoordinator>,
    id: u32,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    if let Some(mut session) = sessions.remove(&id) {
        #[cfg(target_os = "macos")]
        terminate_process_groups(
            session.master.process_group_leader(),
            session.child_pid.map(|pid| pid as i32),
            KILL_GRACE,
        );
        // Portable fallback; ESRCH once the group kill has already landed.
        let _ = session.killer.kill();
    }
    coordinator.unregister(id);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::take_valid_utf8;

    #[test]
    fn passes_through_complete_utf8() {
        let mut pending = "chào ─── bạn".as_bytes().to_vec();
        assert_eq!(take_valid_utf8(&mut pending), "chào ─── bạn");
        assert!(pending.is_empty());
    }

    #[test]
    fn holds_back_split_box_drawing_char() {
        // "──" = E2 94 80 E2 94 80; split mid-second-char like a read boundary
        let bytes = "──".as_bytes();
        let mut pending = bytes[..4].to_vec();
        assert_eq!(take_valid_utf8(&mut pending), "─");
        assert_eq!(pending, &bytes[3..4]); // partial E2 held back

        pending.extend_from_slice(&bytes[4..]);
        assert_eq!(take_valid_utf8(&mut pending), "─");
        assert!(pending.is_empty());
    }

    #[test]
    fn holds_back_split_vietnamese_char() {
        // "ố" = E1 BB 91 (3 bytes); boundary after the first byte
        let bytes = "sống".as_bytes();
        let mut pending = bytes[..2].to_vec(); // "s" + first byte of "ố"
        assert_eq!(take_valid_utf8(&mut pending), "s");
        pending.extend_from_slice(&bytes[2..]);
        assert_eq!(take_valid_utf8(&mut pending), "ống");
        assert!(pending.is_empty());
    }

    #[test]
    fn replaces_truly_invalid_bytes_without_stalling() {
        let mut pending = vec![b'a', 0xFF, b'b'];
        assert_eq!(take_valid_utf8(&mut pending), "a\u{FFFD}b");
        assert!(pending.is_empty());
    }

    #[test]
    fn empty_input_yields_empty_string() {
        let mut pending = Vec::new();
        assert_eq!(take_valid_utf8(&mut pending), "");
    }

    #[test]
    fn resolve_spawn_cwd_accepts_an_existing_dir() {
        let dir = std::env::temp_dir().to_string_lossy().into_owned();
        assert_eq!(super::resolve_spawn_cwd(Some(dir.clone())), Some(dir));
    }

    #[cfg(target_os = "macos")]
    mod terminate_process_groups {
        use super::super::terminate_process_groups;
        use std::os::unix::process::CommandExt;
        use std::process::{Child, Command};
        use std::time::{Duration, Instant};

        /// Spawns `/bin/sh -c <script>` as the leader of a fresh process
        /// group, standing in for a shell (or its foreground job) on the PTY.
        fn spawn_in_own_group(script: &str) -> Child {
            Command::new("/bin/sh")
                .arg("-c")
                .arg(script)
                .process_group(0)
                .spawn()
                .expect("spawn test process")
        }

        fn exits_within(child: &mut Child, timeout: Duration) -> bool {
            let deadline = Instant::now() + timeout;
            while Instant::now() < deadline {
                if child.try_wait().expect("try_wait").is_some() {
                    return true;
                }
                std::thread::sleep(Duration::from_millis(20));
            }
            false
        }

        #[test]
        fn sigkills_the_shell_group_even_when_hup_is_ignored() {
            let mut child = spawn_in_own_group("trap '' HUP; sleep 300");
            let pgid = child.id() as i32;
            // Grace far beyond the assertion window: only the immediate
            // shell-group SIGKILL can make this pass.
            terminate_process_groups(None, Some(pgid), Duration::from_secs(30));
            assert!(
                exits_within(&mut child, Duration::from_secs(1)),
                "shell process group survived kill"
            );
        }

        #[test]
        fn hangs_up_the_foreground_group_without_waiting_for_the_grace() {
            let mut child = spawn_in_own_group("sleep 300");
            let pgid = child.id() as i32;
            terminate_process_groups(Some(pgid), None, Duration::from_secs(30));
            assert!(
                exits_within(&mut child, Duration::from_secs(1)),
                "foreground group did not receive SIGHUP"
            );
        }

        /// The audited leak: SIGKILL on the shell pid alone left HUP-ignoring
        /// descendants holding the slave fd, so the reader thread never saw
        /// EOF. Exercises the same calls kill_pty makes, on a real PTY.
        #[test]
        fn kill_path_frees_the_pty_reader_even_with_hup_ignoring_children() {
            use portable_pty::{native_pty_system, CommandBuilder, PtySize};
            use std::io::Read;

            let pair = native_pty_system()
                .openpty(PtySize {
                    rows: 24,
                    cols: 80,
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .expect("openpty");
            let mut cmd = CommandBuilder::new("/bin/sh");
            cmd.arg("-c");
            cmd.arg("trap '' HUP; sleep 300");
            let mut child = pair.slave.spawn_command(cmd).expect("spawn shell");
            drop(pair.slave);
            let mut reader = pair.master.try_clone_reader().expect("clone reader");

            // Let sh install the trap before signals arrive.
            std::thread::sleep(Duration::from_millis(200));
            terminate_process_groups(
                pair.master.process_group_leader(),
                child.process_id().map(|pid| pid as i32),
                Duration::from_secs(30),
            );

            let (tx, rx) = std::sync::mpsc::channel();
            std::thread::spawn(move || {
                let mut buf = [0u8; 4096];
                loop {
                    match reader.read(&mut buf) {
                        Ok(0) | Err(_) => break,
                        Ok(_) => continue,
                    }
                }
                let _ = tx.send(());
            });
            assert!(
                rx.recv_timeout(Duration::from_secs(3)).is_ok(),
                "PTY reader never saw EOF — descendants still hold the slave fd"
            );
            let _ = child.wait();
        }

        #[test]
        fn escalates_a_hup_ignoring_foreground_group_to_sigkill() {
            let mut child = spawn_in_own_group("trap '' HUP; sleep 300");
            // Let sh install the trap before the HUP arrives.
            std::thread::sleep(Duration::from_millis(200));
            let pgid = child.id() as i32;
            terminate_process_groups(Some(pgid), None, Duration::from_millis(200));
            assert!(
                exits_within(&mut child, Duration::from_secs(3)),
                "HUP-ignoring foreground group was never SIGKILLed"
            );
        }
    }

    #[test]
    fn resolve_spawn_cwd_falls_back_to_home() {
        let home = std::env::var("HOME").ok();
        assert_eq!(
            super::resolve_spawn_cwd(Some("/definitely/not/a/dir".into())),
            home
        );
        assert_eq!(super::resolve_spawn_cwd(None), home);
    }
}

impl PtyState {
    /// Foreground process id per session: the PTY's foreground process
    /// group leader, falling back to the spawned child pid.
    pub fn foreground_pids(&self, ids: &[u32]) -> Vec<(u32, Option<i32>)> {
        let sessions = match self.sessions.lock() {
            Ok(sessions) => sessions,
            Err(_) => return ids.iter().map(|&id| (id, None)).collect(),
        };
        ids.iter()
            .map(|&id| {
                let pid = sessions.get(&id).and_then(|session| {
                    session
                        .master
                        .process_group_leader()
                        .filter(|pid| *pid > 0)
                        .or_else(|| session.child_pid.map(|pid| pid as i32))
                });
                (id, pid)
            })
            .collect()
    }
}
