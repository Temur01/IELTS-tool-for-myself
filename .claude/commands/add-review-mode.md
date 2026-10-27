Add a new review mode to the app. The mode name/description is: $ARGUMENTS

A review mode is a flashcard variant shown in `ReviewCard.tsx`. Follow these steps exactly:

**1. Define the mode**
- Add the new mode key to the `ReviewMode` union in `src/lib/types.ts`
- Add a `{ label, short }` entry to `MODES` in `src/lib/session.ts`

**2. Set availability conditions**
- Add the mode to `availableModes()` in `src/lib/session.ts` with a clear condition comment
- Add a weight entry in both `WEIGHTS.fresh` and `WEIGHTS.mature` — use 1 as default if unsure

**3. Implement the card UI**
- Add a conditional block in `ReviewCard.tsx` for the new mode following the existing pattern
- Self-rated modes (learner judges themselves): add to `SELF_RATED` set
- Typed-answer modes: use `<AnswerInput>` component with `check()`
- Multiple-choice modes: use `<Options>` component with `pick()`

**4. Write tests**
- Add a case to `availableModes` tests in `tests/session.test.ts`
- Add a `ReviewCard` test in `tests/flows.test.tsx` covering the happy path and one edge case

**5. Verify**
- Run `/typecheck` to confirm no type errors
- Run `/test` to confirm all tests pass
- Check that the mode appears correctly in `WordDetailView.tsx`'s review history table

Do not modify existing modes. Keep the implementation minimal — no abstractions beyond what the task needs.
