import { User } from '../types';

/**
 * Utility helper to check if a user has a specific RBAC permission.
 * Super Admin and Admin roles automatically bypass permission checks.
 */
export const hasPermission = (user: User | null, permCode: string): boolean => {
  if (!user) return false;
  if (user.role === 'Super Admin' || user.role === 'Admin') return true;
  return user.permissions?.includes(permCode) || false;
};

// Maker vs Checker Helpers
export const canRecordDonation = (user: User | null) => hasPermission(user, 'donations_record');
export const canPostDonation = (user: User | null) => hasPermission(user, 'donations_post');

export const canRecordExpense = (user: User | null) => hasPermission(user, 'expenses_record');
export const canApproveExpense = (user: User | null) => hasPermission(user, 'expenses_approve');

export const canCreateTransfer = (user: User | null) => hasPermission(user, 'transfers_create');
export const canApproveTransfer = (user: User | null) => hasPermission(user, 'transfers_approve');

export const canRecordSchoolFee = (user: User | null) => hasPermission(user, 'child_support_record');
export const canPostSchoolFee = (user: User | null) => hasPermission(user, 'child_support_post');
