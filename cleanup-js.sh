#!/bin/bash
# Run this once after bun install to remove the old JS files.
# The TypeScript equivalents have already been created.

set -e
cd "$(dirname "$0")"

echo "Removing old JavaScript source files..."

# App pages and routes
rm -f src/app/layout.js
rm -f src/app/page.js
rm -f src/app/add/page.js
rm -f src/app/login/page.js
rm -f src/app/settings/page.js
rm -f src/app/words/page.js
rm -f "src/app/words/[id]/page.js"
rm -f src/app/auth/callback/route.js
rm -f src/app/api/lookup/route.js

# Components
rm -f src/components/AddWordView.js
rm -f src/components/AppShell.js
rm -f src/components/AudioButton.js
rm -f src/components/CandidateList.js
rm -f src/components/LoginForm.js
rm -f src/components/ReviewCard.js
rm -f src/components/ReviewSession.js
rm -f src/components/SettingsView.js
rm -f src/components/SynonymPanel.js
rm -f src/components/TodayView.js
rm -f src/components/ui.js
rm -f src/components/WordDetailView.js
rm -f src/components/WordForm.js
rm -f src/components/WordListView.js

# Library files
rm -f src/lib/answer.js
rm -f src/lib/data.js
rm -f src/lib/exportData.js
rm -f src/lib/senses.js
rm -f src/lib/session.js
rm -f src/lib/srs.js
rm -f src/lib/dictionary/datamuse.js
rm -f src/lib/dictionary/freeDictionary.js
rm -f src/lib/dictionary/http.js
rm -f "src/lib/dictionary/index.js"
rm -f src/lib/dictionary/merriamWebster.js
rm -f src/lib/supabase/client.js
rm -f src/lib/supabase/server.js
rm -f src/proxy.js

# Test files
rm -f tests/answer.test.js
rm -f tests/dictionary.test.js
rm -f tests/exportData.test.js
rm -f tests/flows.test.jsx
rm -f tests/senses.test.js
rm -f tests/session.test.js
rm -f tests/srs.test.js

# Old config files superseded by TypeScript versions
rm -f jsconfig.json
rm -f vitest.config.mjs

echo "Done. Old JS files removed."
echo ""
echo "Next steps:"
echo "  1. bun install   (installs typescript + type packages)"
echo "  2. bun run build (verify TypeScript compiles)"
echo "  3. bun run test  (verify tests pass)"
