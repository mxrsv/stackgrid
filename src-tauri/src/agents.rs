use serde::Serialize;
use std::time::Duration;

/// Login shells that hang (e.g. a `.zprofile` waiting on network) must not
/// wedge the picker forever — degrade to empty after this.
const DETECT_TIMEOUT: Duration = Duration::from_secs(3);

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct AgentInfo {
    pub name: String,
    pub path: String,
}

/// Allowlist aligned with the chrome recognition names (ARCH D6).
pub const AGENT_ALLOWLIST: [&str; 3] = ["claude", "codex", "gemini"];

/// Keep only absolute paths whose basename is allowlisted, first hit per
/// name wins, result ordered by first appearance (script emits allowlist
/// order, so numbering in the picker is stable).
fn parse_command_v_output(output: &str) -> Vec<AgentInfo> {
    let mut found: Vec<AgentInfo> = Vec::new();
    for line in output.lines() {
        let path = line.trim();
        if !path.starts_with('/') {
            continue;
        }
        let Some(name) = std::path::Path::new(path)
            .file_name()
            .and_then(|n| n.to_str())
        else {
            continue;
        };
        if AGENT_ALLOWLIST.contains(&name) && !found.iter().any(|a| a.name == name) {
            found.push(AgentInfo {
                name: name.to_string(),
                path: path.to_string(),
            });
        }
    }
    found
}

/// Resolve the allowlist through the user's LOGIN shell — the GUI process
/// PATH is stripped on macOS, but `$SHELL -lc` sees the same PATH the
/// spawned panes use. Any failure (spawn error, non-blocking-pool panic, or
/// a hung `.zprofile` past `DETECT_TIMEOUT`) degrades to an empty list
/// (picker then shows Shell only — FR-025) instead of blocking a Tokio
/// worker thread forever.
#[tauri::command]
pub async fn detect_agents() -> Vec<AgentInfo> {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    let script = AGENT_ALLOWLIST
        .iter()
        .map(|name| format!("command -v {name}"))
        .collect::<Vec<_>>()
        .join("; ");
    let task = tauri::async_runtime::spawn_blocking(move || {
        std::process::Command::new(&shell).args(["-lc", &script]).output()
    });
    let output = match tokio::time::timeout(DETECT_TIMEOUT, task).await {
        Ok(Ok(Ok(output))) => output,
        _ => return Vec::new(), // timed out, task panicked, or the shell failed to spawn
    };
    parse_command_v_output(&String::from_utf8_lossy(&output.stdout))
}

/// Existence check for workspace recents (FR-003 AC-2); order mirrors input.
#[tauri::command]
pub async fn dirs_exist(paths: Vec<String>) -> Vec<bool> {
    paths
        .iter()
        .map(|path| std::path::Path::new(path).is_dir())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_absolute_paths_in_allowlist_order() {
        let out = "/usr/local/bin/claude\n/Users/dev/.local/bin/gemini\n";
        assert_eq!(
            parse_command_v_output(out),
            vec![
                AgentInfo {
                    name: "claude".into(),
                    path: "/usr/local/bin/claude".into()
                },
                AgentInfo {
                    name: "gemini".into(),
                    path: "/Users/dev/.local/bin/gemini".into()
                },
            ]
        );
    }

    #[test]
    fn ignores_non_paths_and_unknown_binaries() {
        // `command -v` may echo aliases/functions or nothing; keep only
        // absolute paths whose basename is on the allowlist.
        let out = "alias claude='claude --tips'\n/usr/local/bin/ripgrep\n\n/opt/bin/codex\n";
        assert_eq!(
            parse_command_v_output(out),
            vec![AgentInfo {
                name: "codex".into(),
                path: "/opt/bin/codex".into()
            }]
        );
    }

    #[test]
    fn dedupes_repeated_names() {
        let out = "/a/claude\n/b/claude\n";
        assert_eq!(parse_command_v_output(out).len(), 1);
    }

    #[test]
    fn dirs_exist_checks_each_path() {
        let tmp = std::env::temp_dir();
        let missing = tmp.join("stackgrid-definitely-missing-dir");
        let results = tauri::async_runtime::block_on(dirs_exist(vec![
            tmp.to_string_lossy().into_owned(),
            missing.to_string_lossy().into_owned(),
        ]));
        assert_eq!(results, vec![true, false]);
    }
}
