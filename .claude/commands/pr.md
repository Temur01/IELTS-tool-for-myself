Create a pull request for the current branch. Requires `gh` CLI (`brew install gh && gh auth login`).

1. Check the current branch: `git -C /Users/user/Desktop/ielts-app branch --show-current`
2. If on `main`, ask the user to create a feature branch first: `git checkout -b feat/<name>`
3. Show the commits ahead of main: `git -C /Users/user/Desktop/ielts-app log main..HEAD --oneline`
4. Read the changed files to understand the full scope of the PR.
5. Draft a PR title (≤ 70 chars, imperative mood, no trailing period) and body using this template:
   ```
   ## Summary
   - <bullet 1>
   - <bullet 2>

   ## Test plan
   - [ ] bun run test passes
   - [ ] bunx tsc --noEmit passes
   - [ ] Tested in browser

   🤖 Co-authored with Claude Code
   ```
6. Show the title + body and ask for approval.
7. On approval, push the branch and create the PR:
   ```
   git -C /Users/user/Desktop/ielts-app push -u origin HEAD
   gh pr create --title "<title>" --body "<body>" --repo Temur01/IELTS-tool-for-myself
   ```
8. Return the PR URL.

If $ARGUMENTS is provided, treat it as the PR title or additional context.
