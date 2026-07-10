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

#[tauri::command]
pub fn kill_pty(
    state: State<'_, PtyState>,
    coordinator: State<'_, WindowCoordinator>,
    id: u32,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    if let Some(mut session) = sessions.remove(&id) {
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
