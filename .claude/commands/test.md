Run the test suite and give a clear report.

1. Run `bun run test 2>&1` to execute all Vitest tests.
2. Report: total passed / failed / skipped, and total duration.
3. For any failing tests:
   - Show the test name and file
   - Show the assertion that failed (expected vs received)
   - Diagnose the root cause — is it a bug in the source, a wrong test expectation, or a type mismatch introduced by the TS migration?
   - Suggest a concrete fix
4. If $ARGUMENTS is a file path or test name, run only that file/suite: `bun run test -- $ARGUMENTS`
5. After analysis, ask whether to apply any fixes.

The tests cover pure logic only (no network, no Supabase). If a test imports from `@/lib/data` it should be mocked with `vi.mock`.
