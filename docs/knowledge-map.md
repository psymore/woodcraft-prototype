# docs/knowledge-map.md

Compact authority and routing map for Woodcraft Prototype (first release)

Purpose
- Provide a small index that tells agents where canonical knowledge lives, who owns it, and how to load it.
- Avoid duplicating authoritative text — link to it.

Entries

1. Product design & roadmap (canonical)
   - Path: docs/superpowers/specs/2026-08-20-woodcraft-prototype-design.md (history/context)
     and docs/superpowers/specs/2026-08-22-wood-cad-workshop-design.md (current scope authority)
   - Owner: Product Design / Spec owner (see file frontmatter)
   - Consumers: Engineers changing scope, reviewers
   - Load trigger: Any change touching scope, data-model, roadmap, or API

2. Implementation plans
   - Path: docs/superpowers/plans/ (canonical)
   - Owner: Engineering lead for current prototype stage
   - Consumers: Engineers implementing features
   - Load trigger: Starting implementation work for a prototype stage
   - Note: Session continuity uses dated `YYYY-MM-DD-<topic>-session.md` index docs in the same folder (e.g. `2026-09-16-ui-polish-session.md`) capturing what changed and any known gaps — check the most recent one before resuming.

3. Prototype code (runtime behavior)
   - Path: woodcraft/
   - Owner: Prototype implementer
   - Consumers: Engineers, testers
   - Load trigger: Any runtime bug, behavior discrepancy, or test failure

4. Tests
   - Path: tests/
   - Owner: Test authors / Maintainers
   - Consumers: Agents verifying behavior, CI
   - Load trigger: Running tests, failing tests, or adding features

5. Knowledge architecture/reference (deep)
   - Path: docs/reference/project-agnostic-knowledge-architecture-mother-prompt.md
   - Owner: Architecture lead
   - Consumers: Agents building knowledge maps or governance
   - Load trigger: When designing or changing agent-level governance or prompts

Routing rules
- Start at CLAUDE.md for human-facing routing and the approved-scope boundary.
- For feature or code questions, load the smallest canonical document that covers the decision (spec -> plan -> code -> tests).
- Do not duplicate canonical text in this file; include only the path, owner, consumers, and load triggers.

Validation checklist (cheap)
- [ ] Files/paths referenced above exist.
- [ ] CLAUDE.md points to the approved design and plans.
- [ ] .github/copilot-instructions.md exists.
- [ ] .github/hooks/pretool-approval.json exists and is protected by repo policy (code owners or maintainer review).

Notes
- This map is intentionally compact. Expansions require an explicit decision and a separate plan.
