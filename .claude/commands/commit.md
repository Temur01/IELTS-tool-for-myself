Stage and commit the current changes with a well-formed commit message, then push to origin.

1. Run `git -C /Users/user/Desktop/ielts-app diff --stat HEAD` and `git -C /Users/user/Desktop/ielts-app status` to see what changed.
2. Read any modified source files that are relevant to understand the change.
3. Draft a commit message following Conventional Commits:
   - Format: `<type>(<scope>): <short description>`
   - Types: `feat` · `fix` · `refactor` · `test` · `docs` · `chore` · `style`
   - Scope: the main area changed (e.g. `srs`, `session`, `ReviewCard`, `types`, `ci`)
   - Body (optional): explain *why*, not *what* — the diff already shows what
   - Keep the subject line ≤ 72 chars
4. Show the proposed message and ask for approval before committing.
5. On approval, run:
   ```
   git -C /Users/user/Desktop/ielts-app add -A
   git -C /Users/user/Desktop/ielts-app commit -m "<message>"
   git -C /Users/user/Desktop/ielts-app push origin HEAD
   ```
6. Report the commit hash and the GitHub URL of the push.

If $ARGUMENTS is provided, use it as additional context or override the commit message.

**Do not** commit: `.env`, `*.local`, `node_modules/`, build artifacts (`.next/`).
**Always** run lint + type-check mentally — flag obvious issues before committing.
