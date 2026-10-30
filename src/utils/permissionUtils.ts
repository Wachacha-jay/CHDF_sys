import { User } from '../types';

/**
 * Utility helper to check if a user has a specific RBAC permission.
 * Super Admin automatically bypasses permission checks.
 */
export const hasPermission = (user: User | null, permCode: string | string[]): boolean => {
  if (!user) return false;
  if (user.role === 'Super Admin') return true;
  const userPerms = user.permissions || [];
  if (Array.isArray(permCode)) {
    return permCode.some(p => userPerms.includes(p));
  }
  return userPerms.includes(permCode);
};

// Maker vs Checker Helpers for Fund Accounting & Expenses
export const canRecordDonation = (user: User | null) => hasPermission(user, ['donations_record', 'donations_view']);
export const canPostDonation = (user: User | null) => hasPermission(user, 'donations_post');

export const canRecordExpense = (user: User | null) => hasPermission(user, ['expenses_record', 'expenses_manage']);
export const canApproveExpense = (user: User | null) => hasPermission(user, 'expenses_approve');

export const canCreateTransfer = (user: User | null) => hasPermission(user, ['transfers_create', 'fund_accounting_manage']);
export const canApproveTransfer = (user: User | null) => hasPermission(user, ['transfers_approve', 'fund_accounting_manage']);

export const canRecordSchoolFee = (user: User | null) => hasPermission(user, ['child_support_record', 'school_fees_view']);
export const canPostSchoolFee = (user: User | null) => hasPermission(user, 'child_support_post');
