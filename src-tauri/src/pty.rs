use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use std::{
    io::{Read, Write},
    sync::Mutex,
    thread,
};
use tauri::{AppHandle, Emitter, State};

pub const EVENT_OUTPUT: &str = "pty:output";
pub const EVENT_EXIT: &str = "pty:exit";

#[derive(Default)]
pub struct PtyState(Mutex<PtySession>);

#[derive(Default)]
struct PtySession {
    master: Option<Box<dyn MasterPty + Send>>,
    writer: Option<Box<dyn Write + Send>>,
    killer: Option<Box<dyn ChildKiller + Send + Sync>>,
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

#[tauri::command]
pub fn spawn_shell(
    app: AppHandle,
    state: State<PtyState>,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let mut session = state.0.lock().map_err(|e| e.to_string())?;

    // Kết thúc phiên cũ (nếu có) trước khi mở phiên mới
    if let Some(mut killer) = session.killer.take() {
        let _ = killer.kill();
    }
    session.writer = None;
    session.master = None;

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
        // Login shell để nạp đủ PATH/rc — các CLI như claude/codex mới thấy được
        cmd.arg("-l");
    }
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    if let Ok(home) = std::env::var("HOME") {
        cmd.cwd(home);
    }

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave);

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    session.killer = Some(child.clone_killer());
    session.writer = Some(writer);
    session.master = Some(pair.master);
    drop(session);

    let output_app = app.clone();
    thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    let chunk = String::from_utf8_lossy(&buf[..n]).to_string();
                    if output_app.emit(EVENT_OUTPUT, chunk).is_err() {
                        break;
                    }
                }
            }
        }
        let _ = output_app.emit(EVENT_EXIT, ());
    });

    thread::spawn(move || {
        let mut child = child;
        let _ = child.wait();
    });

    Ok(())
}

#[tauri::command]
pub fn write_pty(state: State<PtyState>, data: String) -> Result<(), String> {
    let mut session = state.0.lock().map_err(|e| e.to_string())?;
    let writer = session
        .writer
        .as_mut()
        .ok_or_else(|| "Chưa có phiên terminal nào đang chạy".to_string())?;
    writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
    writer.flush().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn resize_pty(state: State<PtyState>, cols: u16, rows: u16) -> Result<(), String> {
    let session = state.0.lock().map_err(|e| e.to_string())?;
    let master = session
        .master
        .as_ref()
        .ok_or_else(|| "Chưa có phiên terminal nào đang chạy".to_string())?;
    master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())
}
