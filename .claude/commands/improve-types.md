Audit the TypeScript quality of the codebase and suggest improvements in the Matt Pocock style — make the types as precise and self-documenting as possible without adding noise.

Scan all `.ts` and `.tsx` files in `src/` for:

**Type safety issues (fix these):**
- `any` — replace with `unknown` + narrowing, or a real type
- Non-null assertions (`!`) outside of `src/lib/supabase/` — each needs justification or removal
- Unnecessary `as` casts — replace with proper narrowing or type guards
- `@ts-ignore` / `@ts-expect-error` without an explanatory comment

**Precision improvements (suggest these):**
- String literals that should be union types (e.g. `string` where `'reading' | 'listening' | 'general'` exists in `types.ts`)
- Object types that could use `Pick<>` or `Partial<>` instead of re-declaring fields
- Callback types that are missing or overly broad
- React prop types that are inline and complex enough to deserve a named interface
- Return types missing from exported functions (especially in `src/lib/`)

**Matt Pocock patterns to apply where appropriate:**
- `satisfies` operator to validate object literals against a type while preserving literal types
- `as const` on config objects, enum-like arrays (e.g. `RATINGS`, `MODES`)
- Discriminated unions for state that has variants (e.g. `ApplyReviewResult` with `changed: true/false`)
- Template literal types for string patterns (e.g. session storage keys)
- Branded/nominal types for IDs if the same `string` type is used for both `word.id` and `review.id`

For each finding: show the file, line, current code, and improved version. Group by category. Do not change runtime behaviour — types only.
