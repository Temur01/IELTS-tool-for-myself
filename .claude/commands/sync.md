Sync the local branch with the latest from origin/main.

1. Show current branch and any uncommitted changes:
   ```
   git -C /Users/user/Desktop/ielts-app status
   git -C /Users/user/Desktop/ielts-app log --oneline origin/main..HEAD
   ```
2. If there are uncommitted changes, stash them first:
   ```
   git -C /Users/user/Desktop/ielts-app stash push -m "sync stash"
   ```
3. Pull the latest from origin:
   ```
   git -C /Users/user/Desktop/ielts-app fetch origin
   git -C /Users/user/Desktop/ielts-app merge origin/main --ff-only
   ```
   If fast-forward fails (diverged), offer the user a choice:
   - **Rebase** (clean linear history, preferred): `git rebase origin/main`
   - **Merge** (explicit merge commit): `git merge origin/main`
4. Re-apply the stash if one was created: `git stash pop`
5. If there are merge conflicts, list each conflicted file and offer to resolve them one by one.
6. After a clean sync, report how many commits were pulled and the new HEAD.

If $ARGUMENTS is a branch name, sync with that branch instead of main.
