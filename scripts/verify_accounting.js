#!/usr/bin/env node
/*
  Verification script for accounting flows.
  Usage: API_BASE_URL=http://localhost/tam/api node scripts/verify_accounting.js
*/
const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || process.env.VITE_API_URL || 'http://localhost/tam/api';
const client = axios.create({ baseURL: API_BASE_URL, timeout: 30000 });

function log(title, obj) {
  console.log('==', title, '==');
  if (obj !== undefined) console.log(JSON.stringify(obj, null, 2));
}

async function getSettings() {
  try {
    const res = await client.get('/settings');
    return res.data || res;
  } catch (err) {
    return null;
  }
}

async function listAccounts() {
  const res = await client.get('/accounts');
  return res.data || res;
}

async function createJournalEntry(payload) {
  const res = await client.post('/journal_entries', payload);
  return res.data || res;
}

async function getJournalEntries() {
  const res = await client.get('/journal_entries');
  return res.data || res;
}

async function getTrialBalance(date) {
  const res = await client.get(`/trial_balance${date ? `?date=${date}` : ''}`);
  return res.data || res;
}

async function getBalanceSheet(date) {
  const res = await client.get(`/balance_sheet${date ? `?date=${date}` : ''}`);
  return res.data || res;
}

function sumLines(lines) {
  return lines.reduce((s, l) => s + (l.debit_amount || 0) - (l.credit_amount || 0), 0);
}

async function run() {
  console.log('Verification script starting — API base:', API_BASE_URL);

  const settings = await getSettings();
  log('Settings', settings);

  const currency = (settings && settings.default_currency) || 'USD';
  console.log('Detected currency:', currency);

  const accounts = await listAccounts();
  log('Accounts count', Array.isArray(accounts) ? accounts.length : 0);

  if (!Array.isArray(accounts) || accounts.length === 0) {
    console.error('No accounts available. Ensure backend is running and /accounts endpoint works.');
    process.exit(1);
  }

  // pick two accounts for testing
  const cash = accounts.find(a => a.account_type === 'asset') || accounts[0];
  const equity = accounts.find(a => a.account_type === 'equity') || accounts[1] || accounts[0];

  // Opening balances entry
  const openingPayload = {
    entry_date: new Date().toISOString().split('T')[0],
    description: 'Opening balances (verification script)',
    lines: [
      { account_id: cash.id, debit_amount: 100000 },
      { account_id: equity.id, credit_amount: 100000 }
    ],
    is_posted: true
  };

  log('Creating opening balances', { cash: cash.id, equity: equity.id });
  try {
    const opening = await createJournalEntry(openingPayload);
    log('Opening entry created', opening);
  } catch (err) {
    console.error('Failed to create opening balances:', err.response ? err.response.data || err.response.statusText : err.message);
  }

  // Post a sample sales entry (cash sale)
  const salesPayload = {
    entry_date: new Date().toISOString().split('T')[0],
    description: 'Sample cash sale (verification)',
    lines: [
      { account_id: cash.id, debit_amount: 5000 },
      // find a revenue account
      { account_id: (accounts.find(a => a.account_type === 'revenue') || equity).id, credit_amount: 5000 }
    ],
    is_posted: true
  };

  try {
    const sale = await createJournalEntry(salesPayload);
    log('Sales entry created', sale);
    if (sale && sale.lines) {
      const diff = sumLines(sale.lines);
      console.log('Sales entry balance check (should be 0):', diff);
    }
  } catch (err) {
    console.error('Failed to create sales entry:', err.response ? err.response.data || err.response.statusText : err.message);
  }

  // Fetch trial balance and balance sheet
  try {
    const tb = await getTrialBalance(new Date().toISOString().split('T')[0]);
    log('Trial Balance', { count: Array.isArray(tb) ? tb.length : 'unknown' });
    // compute totals
    if (Array.isArray(tb)) {
      const totalDebits = tb.reduce((s, r) => s + (r.debit_balance || 0), 0);
      const totalCredits = tb.reduce((s, r) => s + (r.credit_balance || 0), 0);
      console.log('Trial Balance totals — debits:', totalDebits, 'credits:', totalCredits, 'diff:', totalDebits - totalCredits);
    }
  } catch (err) {
    console.error('Failed to fetch trial balance:', err.response ? err.response.data || err.response.statusText : err.message);
  }

  try {
    const bs = await getBalanceSheet(new Date().toISOString().split('T')[0]);
    log('Balance Sheet', bs);
  } catch (err) {
    console.error('Failed to fetch balance sheet:', err.response ? err.response.data || err.response.statusText : err.message);
  }

  console.log('Verification script finished.');
}

run().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
