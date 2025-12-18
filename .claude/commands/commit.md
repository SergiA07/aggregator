---
description: Create scoped commits from staged/unstaged changes
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*)
---

Create commits from the current changes, automatically splitting by scope.

## Commitlint Rules (MUST FOLLOW)

This project uses commitlint with strict rules. Commits will be REJECTED if they don't follow these exactly:

### Allowed Scopes (scope-enum)

ONLY these scopes are allowed:
- `api` - for `apps/api/`
- `web` - for `apps/web/`
- `python` - for `apps/python-service/`
- `database` - for `packages/database/`
- `shared-types` - for `packages/shared-types/`
- `config` - for `packages/config/`
- `ci` - for `.github/`
- `turbo` - for `turbo.json`
- `deps` - for dependency-only changes
- `root` - for root files, `.claude/`, `docs/`, or mixed changes

### Allowed Types (type-enum)

ONLY these types are allowed:
- `feat` - new feature
- `fix` - bug fix
- `docs` - documentation only
- `style` - formatting, no code change
- `refactor` - code change that neither fixes a bug nor adds a feature
- `perf` - performance improvement
- `test` - adding or fixing tests
- `build` - build system or dependencies
- `ci` - CI configuration
- `chore` - other changes (configs, scripts)
- `revert` - reverting a commit

### Subject Rules

- **MUST be lowercase** (subject-case: lower-case)
- MUST NOT be empty
- MUST be under 72 characters
- Use imperative mood ("add" not "added" or "adds")

### Format

```
type(scope): lowercase subject under 72 chars

Optional body explaining the "why" (wrap at 100 chars)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Steps

1. Run `git status` and `git diff` to analyze all changes (staged and unstaged)

2. Group files by scope based on their paths (see Allowed Scopes above)

3. For each scope with changes:
   - Analyze what was changed
   - Determine the commit type from the allowed list
   - Stage only the files for that scope: `git add <files>`
   - Create a commit following the EXACT format above
   - **Double-check**: scope is in allowed list, subject is lowercase

4. After all commits are created, run `git log --oneline -n <number of commits>` to show the result

## Examples

**Correct:**
```
docs(root): add readme files for api and web apps
fix(api): handle null response from external api
feat(web): add dark mode toggle to settings
chore(ci): exclude md files from deploy triggers
```

**Wrong (will be rejected):**
```
docs(claude): ...          # "claude" is not an allowed scope
docs(root): Add readme...  # "Add" is uppercase, must be "add"
Docs(root): add readme...  # "Docs" is uppercase, must be "docs"
add readme files           # missing type and scope
```

## Important

- Do NOT push to remote unless explicitly asked
- If changes span multiple scopes but are logically one feature, use `root` scope
- When in doubt about scope, use `root`
- ALWAYS use lowercase for type and subject
