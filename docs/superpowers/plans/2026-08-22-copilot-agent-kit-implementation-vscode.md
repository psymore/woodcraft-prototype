---
vscode: true
vscode-copilot: true
author: "GitHub Copilot (VS Code)"
vscode-note: "This plan is the VS Code Copilot continuation of the repository's agent-kit implementation plan."
status: "in progress"
---

# Copilot Agent Kit and Knowledge Architecture

> This plan was authored and continued in VS Code by GitHub Copilot. The repository copy is canonical for the implementation plan; the VS Code session memory is not.

## Objective

Create a project-agnostic personal kit that applies consistent Copilot behavior across repositories while keeping project facts in each repository's canonical documents.

## Completed

- Created `C:\Users\4D\Copilot-Agent-Kit\`.
- Added reusable global behavior instructions.
- Added an on-demand knowledge-architecture workflow prompt.
- Added repository adapter and knowledge-map templates.
- Added a non-destructive PowerShell adapter installer.
- Added this repository's Copilot instructions and knowledge map.

## Remaining work

- Verify the installed VS Code/Copilot customization schema before changing user settings.
- Install the global instruction and workflow prompt into the VS Code user prompts directory after confirming discovery.
- Enable supported file-change checkpoint visibility without disturbing unrelated settings.
- Keep terminal auto-approval disabled for risky Git patterns.
- Verify repository hook behavior where supported.
- Run customization diagnostics and the repository test suite.

## Knowledge workflow

1. Start at `CLAUDE.md` or the repository's primary instruction file.
2. Identify the canonical source for the task.
3. Load only the relevant context.
4. State a falsifiable hypothesis before the first edit when behavior is unclear.
5. Make the smallest testable change.
6. Run focused validation immediately after editing.
7. Preserve unrelated changes and avoid duplicating authority.

## Git approval protocol

Before any agent `git commit`, `git push`, merge, rebase, reset, cherry-pick, tag operation, force operation, or branch deletion, show the exact command, explain its effect, and wait for explicit approval in the current chat. No general implementation request counts as approval.

## Verification

- Confirm frontmatter and links are valid.
- Confirm the installer preserves existing adapter files by default.
- Confirm read-only Git inspection remains available.
- Confirm risky Git operations require approval without performing one.
- Run `.venv\Scripts\python.exe -m pytest`.
- Inspect the final diff for scope creep or accidental history changes.
