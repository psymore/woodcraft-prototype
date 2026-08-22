# Implementation plans — VS Code indicator convention

This repository uses docs/superpowers/plans/ as the canonical location for implementation plans.

VS Code continuation indicator

- When a plan is continued inside personal or workspace VS Code artifacts (for example, local drafts, TODOs, or workspace settings), include a repository-hosted plan file using the naming convention:
  - <n>-<short-name>-vscode.md (example: 01-woodcraft-snap-math-vscode.md)
- Inside the plan file include frontmatter that clearly identifies the authoring environment and author:
  ```
  vscode: true
  vscode-copilot: true
  author: "GitHub Copilot (VS Code)"
  vscode-note: "This plan was authored or continued in VS Code by GitHub Copilot."
  ```

Purpose

- Keep canonical plans under version control so they are discoverable, reviewable, and diffable.
- Use the `-vscode` suffix to indicate that a plan has an active workspace draft or VS Code-specific artifacts; the canonical file remains authoritative unless explicitly superseded.

Procedure

- If a plan is continued in VS Code, create or update the corresponding `-vscode.md` file in this folder and add a short note about where the live draft is stored (workspace path, PR link, or issue).
- New plans created by GitHub Copilot in VS Code should be created directly in this folder with the `-vscode.md` suffix.
- Do not rely on local-only VS Code files as the single source of truth.
