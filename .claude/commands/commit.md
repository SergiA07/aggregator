---
description: Create scoped commits from staged/unstaged changes
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*)
---

Create commits from the current changes, automatically splitting by scope.

## Steps

1. Run `git status` and `git diff` to analyze all changes (staged and unstaged)

2. Group files by scope based on their paths:
   - `apps/api/` → scope: `api`
   - `apps/web/` → scope: `web`
   - `apps/python-service/` → scope: `python`
   - `packages/database/` → scope: `database`
   - `packages/shared-types/` → scope: `shared-types`
   - `packages/config/` → scope: `config`
   - Root files (package.json, etc.) → scope: `root`
   - `.github/` → scope: `ci`
   - `turbo.json` → scope: `turbo`
   - Only dependency changes → scope: `deps`

3. For each scope with changes:
   - Analyze what was changed (new features, fixes, refactors, etc.)
   - Determine the commit type: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`
   - Stage only the files for that scope: `git add <files>`
   - Create a commit with message format: `type(scope): concise description`
   - Use the standard commit footer format

4. Commit message guidelines:
   - Focus on the "why" not the "what"
   - Keep the subject line under 72 characters
   - Use imperative mood ("add" not "added")
   - Be specific but concise

5. After all commits are created, run `git log --oneline -n <number of commits>` to show the result

## Commit Footer Format

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Important

- Do NOT push to remote unless explicitly asked
- If changes span multiple scopes but are logically one feature, ask the user if they want separate commits or a single `root` scoped commit
- If unsure about the commit type or message, ask the user for clarification
