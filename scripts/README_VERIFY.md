Verification script

Run `scripts/verify_accounting.js` to perform automated checks that journal entries post correctly and that Trial Balance and Balance Sheet reflect GL balances.

Usage

Set `API_BASE_URL` or `VITE_API_URL` to point at your backend API, then run:

```bash
API_BASE_URL=http://localhost/tam/api node scripts/verify_accounting.js
```

Notes
- Backend must be running and expose endpoints: `/accounts`, `/journal_entries`, `/trial_balance`, `/balance_sheet`, `/settings`.
- The script is a lightweight smoke-test — extend it with more assertions or convert to a formal test suite (Vitest/Jest) for CI.
