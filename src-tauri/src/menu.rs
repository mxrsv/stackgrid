#[cfg(target_os = "macos")]
use tauri::{
    menu::{Menu, MenuItem},
    App, Emitter, Runtime,
};

#[cfg(not(target_os = "macos"))]
use tauri::{App, Runtime};

#[cfg(target_os = "macos")]
const QUIT_MENU_ID: &str = "quit-confirm";

/// Trên macOS, item Quit mặc định (⌘Q) thoát thẳng process mà không đi qua
/// RunEvent::ExitRequested (tauri-apps/tauri#3124), nên thay nó bằng item
/// tuỳ chỉnh giữ nguyên phím ⌘Q nhưng phát "quit-requested" cho frontend hỏi.
#[cfg(target_os = "macos")]
pub fn install<R: Runtime>(app: &App<R>) -> tauri::Result<()> {
    let handle = app.handle();
    let menu = Menu::default(handle)?;
    let quit = MenuItem::with_id(
        handle,
        QUIT_MENU_ID,
        format!("Quit {}", handle.package_info().name),
        true,
        Some("CmdOrCtrl+Q"),
    )?;
    let app_submenu = menu
        .items()?
        .into_iter()
        .next()
        .and_then(|item| item.as_submenu().cloned());
    if let Some(app_submenu) = app_submenu {
        let count = app_submenu.items()?.len();
        if count > 0 {
            app_submenu.remove_at(count - 1)?;
        }
        app_submenu.append(&quit)?;
    }
    app.set_menu(menu)?;
    app.on_menu_event(|handle, event| {
        if event.id() == QUIT_MENU_ID {
            let _ = handle.emit("quit-requested", ());
        }
    });
    Ok(())
}

#[cfg(not(target_os = "macos"))]
pub fn install<R: Runtime>(_app: &App<R>) -> tauri::Result<()> {
    Ok(())
}
