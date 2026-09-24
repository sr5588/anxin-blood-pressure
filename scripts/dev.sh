#!/usr/bin/env bash
set -euo pipefail
if ! command -v node >/dev/null 2>&1; then
  export PATH="/Users/TT/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
fi
case "${1:-check}" in
 build) node scripts/build.mjs ;;
 test) node node_modules/tsx/dist/cli.mjs --test tests/*.test.ts; node --test tests/client.test.cjs ;;
 check) node scripts/build.mjs; node node_modules/tsx/dist/cli.mjs --test tests/*.test.ts; node --test tests/client.test.cjs; python3 scripts/check-templates.py ;;
 *) echo 'usage: scripts/dev.sh [build|test|check]' >&2; exit 1 ;;
esac
