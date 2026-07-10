---
id: 0017
title: "File sidebar: Cmd+click preview + git diff, read-only"
date: 2026-07-09
kind: product
affects: [PRD, BUSINESS-FLOW, UX-DESIGN, REQUIREMENTS]
supersedes: []
---

# ADR 0017 — File sidebar: Cmd+click preview + git diff, read-only

## Context

Agents constantly reference files by path. Users want to peek at a file's content and its git diff without leaving the terminal or opening an editor.

## Decision

Cmd+clicking a filepath in pane output targets the focused (source) pane's path context. Relative paths resolve against that pane's CWD; absolute paths are used as-is. If the resolved path does not exist, show an error/toast and **do not** open the sidebar. If it exists, open a right sidebar viewer: content preview (Markdown rendered for `.md`) and a git diff when the file is in a git working tree. The sidebar is **read-only** — no editing or save-back to disk in v1.

## Consequences

- PRD "inspect" journey and scope cover Cmd+click → preview + diff.
- BUSINESS-FLOW gains sidebar states (Closed / Open-preview / Open-diff / Blocked), the resolve/missing rules, and invariant "sidebar never mutates the file".
- UX-DESIGN specifies the sidebar viewer.
- `affects` narrowed to exclude ARCHITECTURE: path resolution and git plumbing are architecture detail; the requirements it generates (Cmd+click resolve, missing-path toast, preview, git diff, read-only) are in scope.

## Options rejected

- Editable sidebar in v1 — out of scope; Stackgrid is not an IDE (ADR 0011, ADR 0019).
- Open the sidebar for a missing path — misleading; a toast with no sidebar is clearer.
