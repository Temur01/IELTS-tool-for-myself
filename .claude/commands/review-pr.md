Review a pull request. Requires `gh` CLI.

Usage: /review-pr <PR number or URL>

1. Fetch the PR diff and metadata:
   ```
   gh pr view $ARGUMENTS --repo Temur01/IELTS-tool-for-myself
   gh pr diff $ARGUMENTS --repo Temur01/IELTS-tool-for-myself
   ```
2. Review the diff across these dimensions:
   - **Correctness**: Logic bugs, off-by-one errors, incorrect assumptions about the SM-2 algorithm or session state machine
   - **Types**: `any`, missing return types, incorrect casts, `!` assertions that could panic
   - **Invariants**: Does it respect the key invariants from CLAUDE.md? (immutable SessionState, ease floor, UTC strings, etc.)
   - **Tests**: Are new behaviours covered? Would a bug in this code be caught?
   - **Simplicity**: Is there a simpler approach? Unnecessary abstraction?
3. For each finding, rate it:
   - 🔴 **Must fix** — correctness or type-safety issue
   - 🟡 **Should fix** — quality issue worth addressing
   - 🟢 **Nit** — style / preference, take it or leave it
4. Summarise: overall verdict (approve / request changes / comment), top 3 findings.
5. Ask whether to post comments directly to the PR via `gh pr review`.

If $ARGUMENTS is empty, review the most recently opened PR.
