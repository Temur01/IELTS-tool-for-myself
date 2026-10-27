Run TypeScript type checking across the project and report all errors clearly.

1. Run `bunx tsc --noEmit 2>&1` and capture the full output.
2. If there are no errors, report success and the count of files checked.
3. If there are errors, group them by file, show each error with its line number, error code, and message, then identify the root cause for each (wrong type, missing type, incorrect assertion, etc.).
4. For each error suggest a concrete fix — show the before/after code snippet.
5. If there are more than 10 errors, fix the most impactful ones first (often a single interface change cascades into many errors — find those).
6. After analysis, ask whether to apply all fixes automatically.

Do not use `// @ts-ignore` or `any` as a fix unless it is genuinely the only option, and if so explain why.
