use std::path::{Path, PathBuf};
use std::time::Duration;

/// Upper bound on one hover's resolve batch — the frontend already caps its
/// candidates per line, this just keeps a hostile/garbled line cheap.
const MAX_PATHS: usize = 64;

/// A GUI editor returns immediately; anything still running past this has
/// launched (or the login shell is hanging) — either way, stop waiting.
const EDITOR_TIMEOUT: Duration = Duration::from_secs(10);

fn home_dir() -> String {
    std::env::var("HOME").unwrap_or_default()
}

fn expand_tilde(raw: &str, home: &str) -> PathBuf {
    if raw == "~" {
        return PathBuf::from(home);
    }
    match raw.strip_prefix("~/") {
        Some(rest) => Path::new(home).join(rest),
        None => PathBuf::from(raw),
    }
}

/// Absolute path of `raw` when it is an existing FILE, else `None`.
///
/// Directories are deliberately not linkified: there is no line to jump to and
/// `code -g <dir>:1:1` is meaningless.
fn resolve_one(base: &Path, home: &str, raw: &str) -> Option<String> {
    let expanded = expand_tilde(raw, home);
    let full = if expanded.is_absolute() {
        expanded
    } else {
        base.join(expanded)
    };
    let canonical = std::fs::canonicalize(full).ok()?;
    canonical
        .is_file()
        .then(|| canonical.to_string_lossy().into_owned())
}

/// Resolve terminal-link path candidates against a pane's cwd. The result is
/// index-aligned with `paths`; a candidate that is not an existing file (or a
/// candidate past `MAX_PATHS`) comes back as `None`. An empty `cwd` — a pane
/// whose info has not been polled yet — falls back to `$HOME`, which is where
/// such a pane's shell was spawned.
#[tauri::command]
pub async fn resolve_paths(cwd: String, paths: Vec<String>) -> Vec<Option<String>> {
    let home = home_dir();
    let base = if cwd.is_empty() {
        PathBuf::from(&home)
    } else {
        PathBuf::from(&cwd)
    };
    paths
        .iter()
        .enumerate()
        .map(|(i, raw)| {
            if i < MAX_PATHS {
                resolve_one(&base, &home, raw)
            } else {
                None
            }
        })
        .collect()
}

/// Run the user's editor command through their LOGIN shell. A macOS GUI process
/// inherits a stripped `PATH`, so `code` / `cursor` / `zed` are only reachable
/// via `$SHELL -lc` (the same trick as `detect_agents`). The command is built
/// frontend-side from the configured template with the path already escaped.
#[tauri::command]
pub async fn open_editor(command: String) -> Result<(), String> {
    if command.trim().is_empty() {
        return Err("No editor command is configured.".to_string());
    }
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    let task = tauri::async_runtime::spawn_blocking(move || {
        std::process::Command::new(&shell)
            .args(["-lc", &command])
            .output()
    });
    let output = match tokio::time::timeout(EDITOR_TIMEOUT, task).await {
        Ok(Ok(Ok(output))) => output,
        Ok(Ok(Err(err))) => return Err(format!("Couldn't start the editor: {err}")),
        Ok(Err(_)) => return Err("The editor launch task failed.".to_string()),
        Err(_) => return Ok(()), // still running past the timeout — it launched
    };
    if output.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Err(if stderr.is_empty() {
        format!("The editor command exited with {}.", output.status)
    } else {
        stderr
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture_dir() -> PathBuf {
        let dir = std::env::temp_dir().join("stackgrid-links-test");
        std::fs::create_dir_all(dir.join("src")).unwrap();
        std::fs::write(dir.join("src/foo.ts"), "x").unwrap();
        dir
    }

    #[test]
    fn resolves_a_relative_path_against_the_cwd() {
        let dir = fixture_dir();
        let resolved = resolve_one(&dir, "", "src/foo.ts").unwrap();
        assert!(resolved.ends_with("/src/foo.ts"));
    }

    #[test]
    fn resolves_an_absolute_path_ignoring_the_cwd() {
        let dir = fixture_dir();
        let abs = dir.join("src/foo.ts").to_string_lossy().into_owned();
        assert!(resolve_one(Path::new("/nowhere"), "", &abs).is_some());
    }

    #[test]
    fn expands_a_tilde_path() {
        let dir = fixture_dir();
        let home = dir.to_string_lossy().into_owned();
        assert!(resolve_one(Path::new("/nowhere"), &home, "~/src/foo.ts").is_some());
    }

    #[test]
    fn rejects_a_missing_file() {
        let dir = fixture_dir();
        assert_eq!(resolve_one(&dir, "", "src/nope.ts"), None);
    }

    #[test]
    fn rejects_a_directory() {
        let dir = fixture_dir();
        assert_eq!(resolve_one(&dir, "", "src"), None);
    }

    #[test]
    fn resolve_paths_keeps_the_input_order() {
        let dir = fixture_dir();
        let cwd = dir.to_string_lossy().into_owned();
        let results = tauri::async_runtime::block_on(resolve_paths(
            cwd,
            vec!["nope.ts".into(), "src/foo.ts".into()],
        ));
        assert_eq!(results.len(), 2);
        assert!(results[0].is_none());
        assert!(results[1].is_some());
    }

    #[test]
    fn open_editor_rejects_an_empty_command() {
        assert!(tauri::async_runtime::block_on(open_editor("  ".into())).is_err());
    }
}
