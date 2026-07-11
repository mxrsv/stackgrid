---
id: 0022
title: "Sidebar data plane: Rust reads + git shell-out, frontend renders"
date: 2026-07-09
kind: architecture
affects: [ARCHITECTURE, REQUIREMENTS]
supersedes: []
---

# ADR 0022 — Sidebar data plane: Rust reads + git shell-out, frontend renders

## Context

Product ADR 0017 defines the file sidebar (Cmd+click → preview + git diff, read-only). This ADR splits the work between Rust and the frontend without adding a new capability surface.

## Decision

Rust reads the file and shell-outs `git`; the frontend renders only.

| Concern                                                    | Owner                                                                                |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Resolve path (absolute as-is; relative vs source pane CWD) | Frontend (from polled `pty_info`)                                                    |
| Existence check + capped file read                         | Rust `read_file_preview`                                                             |
| Git diff for one path                                      | Rust `git_diff` via `git -C <cwd> diff -- <path>` (same trust model as `git_branch`) |
| Markdown render for `.md`                                  | Frontend                                                                             |
| Plain / diff text view                                     | Frontend                                                                             |
| Missing path                                               | Error/toast; sidebar stays closed                                                    |

## Consequences

- Reuses the existing `git` shell-out trust model (`git_branch`); no new filesystem capability in the webview.
- One read/diff path, owned by Rust.

## Options rejected

- Frontend fs plugin for reads + Rust for git — extra capability surface, two I/O paths.
- Embed libgit2 / gitoxide — heavy and inconsistent with the existing `git_branch` shell-out.
