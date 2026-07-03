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
use tauri::{AppHandle, Emitter, Manager, State};

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

fn remove_session(app: &AppHandle, id: u32) {
    let state = app.state::<PtyState>();
    if let Ok(mut sessions) = state.sessions.lock() {
        sessions.remove(&id);
    };
}

#[tauri::command]
pub fn spawn_shell(
    app: AppHandle,
    state: State<PtyState>,
    cols: u16,
    rows: u16,
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
    if let Ok(home) = std::env::var("HOME") {
        cmd.cwd(home);
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

    let output_app = app.clone();
    thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    if output_app
                        .emit(EVENT_OUTPUT, OutputPayload { id, data })
                        .is_err()
                    {
                        break;
                    }
                }
            }
        }
        remove_session(&output_app, id);
        let _ = output_app.emit(EVENT_EXIT, ExitPayload { id });
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
pub fn kill_pty(state: State<PtyState>, id: u32) -> Result<(), String> {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    if let Some(mut session) = sessions.remove(&id) {
        let _ = session.killer.kill();
    }
    Ok(())
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
