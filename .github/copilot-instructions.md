# .github/copilot-instructions.md

Repository Copilot operating contract — minimal, authoritative, and approval-first.

Purpose

- Provide a concise, project-level instruction set for Copilot-style agents operating on this repository.
- Route agents to canonical sources (design spec, plans, tests) rather than duplicating decision content.

Approval protocol (required)

1. Before any risky Git operation that changes history or affects remotes (including but not limited to: git push --force, git rebase, git reset, git merge with history changes, git branch -D, git tag creation/deletion, cherry-pick that may alter history), the agent MUST:
   - Present the exact shell command it intends to run.
   - Explain in one sentence why the command is necessary and what effect it will have.
   - Wait for an explicit approval reply in the current chat.
2. The agent should treat instructions in this file as guidance and not as permission to perform changes without approval.

Scope and routing

- This file is a repository-level policy only. For product scope, design decisions, and implementation plans, consult the canonical documents listed in [CLAUDE.md](CLAUDE.md) and the files under docs/superpowers/.
- Do not attempt to summarize or duplicate the full design/spec content here — link to it instead.
- For handoffs between VS Code Copilot and Claude Code, read and update [docs/superpowers/plans/ACTIVE-WORK-vscode.md](../docs/superpowers/plans/ACTIVE-WORK-vscode.md) with verified state, decisions, validation, blockers, and one next action.

Hook protection

- Files under `.github/hooks/` implement the repository-level pre-tool approval hooks and must not be modified by an agent without explicit approval.

No automatic commits

- Agents must not create commits, perform pushes, or modify repository history unless explicitly approved in the chat and the approval is reflected in the commit message or PR body.
- Explicit approval tokens: the repository requires one of the following explicit chat approvals before any commit/merge/push:
  - CMP — commit, merge and push current branch changes to master (explicit signal to perform commit + merge + push to master).
  - BCMP — create a new branch named with a logical prefix (e.g., feature/, test/, refactor/), commit changes to that branch, push it, and open a PR for merge; the agent must propose the branch name and wait for approval.
- Agents must never perform commits, merges, or pushes triggered by inferred or implied approval; the exact token (CMP or BCMP) must appear in a human reply in the chat before performing those operations.

Implementation plans storage

- Implementation plans and stage-level plans must be versioned inside this repository. Recommended canonical location: docs/superpowers/plans/. Do not rely on user-level VS Code settings or external ephemeral notes as the single source of truth for implementation plans.
- Plans authored or continued in VS Code by GitHub Copilot must use a `-vscode.md` filename suffix and include frontmatter with `vscode: true`, `vscode-copilot: true`, and `author: "GitHub Copilot (VS Code)"`.
- The `-vscode` marker identifies the authoring environment; it does not override the repository's canonical specifications, approved scope, or governance.
- If a different repository location is preferred (for example, `.vscode/implementation-plans.md`) propose it in the chat and obtain explicit approval; until then use docs/superpowers/plans/ as the default.

Contact

- Repository maintainers: see CODEOWNERS or the design/spec owner listed in docs/superpowers/specs/.
