# Copilot Agent Kit and Knowledge Architecture

- **Status:** in progress
- **Scope:** developer tooling and repository governance only
- **Approved product stage:** Prototype 0 remains unchanged

## Objective

Create a project-agnostic personal kit that applies consistent Copilot behavior across repositories while keeping project facts in each repository's own canonical documents.

The system must:

- require explicit chat approval before agent Git history or remote operations;
- separate universal agent behavior from repository-specific facts;
- use the project-agnostic knowledge-architecture reference as a workflow, not as an always-loaded encyclopedia;
- make authority, ownership, and context-loading triggers discoverable;
- preserve existing user files and unrelated repository changes.

## Architecture

### Global personal layer

Location: `C:\Users\4D\Copilot-Agent-Kit\`

- `README.md`: purpose, installation, and usage.
- `instructions/global-agent-behavior.instructions.md`: universal behavior rules only.
- `prompts/knowledge-architecture.prompt.md`: reusable audit and migration workflow.
- `templates/copilot-instructions.md`: repository operating-contract template.
- `templates/knowledge-map.md`: repository authority-map template.
- `scripts/install-repo-adapter.ps1`: non-destructive adapter installer.

The global layer must not assume a language, framework, product type, folder layout, or repository governance model.

### Repository layer

Each repository supplies its own small adapter:

- `.github/copilot-instructions.md`: repository-specific routing and operational rules.
- `docs/knowledge-map.md`: canonical knowledge locations, owners, consumers, and load triggers.
- Optional `.github/hooks/`: deterministic protection where supported by the installed agent host.

Repository source files, tests, specifications, plans, and decision records remain authoritative for project facts.

## Approval protocol

Before running any of these through an agent tool, the agent must show the exact command, explain its effect, and wait for explicit approval in the current chat:

- `git commit`
- `git push`
- merge or rebase
- reset or cherry-pick
- tag creation or deletion
- force operations
- branch deletion

A general request to implement, finish, clean up, or start work is not approval. Manual Git actions by the user remain available.

## Implementation stages

### Stage 1: Personal kit

- [x] Create the kit directory and reusable files.
- [x] Keep global instructions technology-neutral.
- [x] Include the mother-prompt workflow as an on-demand prompt.
- [x] Make the repository installer non-destructive by default.

### Stage 2: Repository adapter

- [x] Add repository Copilot operating instructions.
- [x] Add repository knowledge-map routing.
- [x] Add the repository hook configuration already present in `.github/hooks/`.
- [ ] Verify hook behavior against the installed VS Code/Copilot hook schema.

### Stage 3: VS Code profile integration

- [ ] Copy the global instruction into the VS Code user prompts directory only after confirming customization discovery.
- [ ] Copy the reusable knowledge-architecture prompt into the VS Code user prompts directory.
- [ ] Inspect the installed VS Code/Copilot settings schema before changing user settings.
- [ ] Enable visible agent file-change checkpoints if the setting is supported.
- [ ] Keep terminal auto-approval disabled for risky Git patterns.
- [ ] Do not assume user-level hooks are supported; validate discovery first.

### Stage 4: Validation

- [ ] Verify all kit files exist and have valid frontmatter where applicable.
- [ ] Run the installer with `-WhatIf` against this repository and confirm existing adapter files are preserved.
- [ ] Confirm read-only commands such as `git status` and `git diff` remain available.
- [ ] Confirm risky Git commands require approval without creating a commit, branch, tag, merge, rebase, reset, or push.
- [ ] Run `.venv\Scripts\python.exe -m pytest`.
- [ ] Inspect the final diff for duplicated authority, unrelated changes, and accidental Git history changes.

## Knowledge-routing rules

1. Start at `CLAUDE.md` or the repository's primary instructions.
2. Load the smallest canonical source relevant to the task.
3. Keep purpose, governance, status, domain knowledge, specifications, plans, decisions, and deep references distinct.
4. Treat indexes, summaries, prompts, and agent instructions as routing layers, not competing authorities.
5. Do not move or delete knowledge without identifying its authority and preserving unique information.
6. Escalate recurring architecture-shaped problems only when evidence shows that local fixes are insufficient and the repository's governance supports a decision record.

## Non-goals

- No product-scope changes beyond approved Prototype 0.
- No broad documentation rewrite.
- No automatic ADR for ordinary bugs.
- No global assumptions about all repositories.
- No commits, pushes, merges, rebases, resets, tags, or branch changes by the implementation agent.
