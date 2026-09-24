import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { PayrollService } from '../services/payrollService';
import type { PayrollSettings, PayrollPeriod, PayrollRun, Employee } from '../types';

export const usePayroll = () => {
  const [payrollSettings, setPayrollSettings] = useState<PayrollSettings | null>(null);
  const [payrollPeriods, setPayrollPeriods] = useState<PayrollPeriod[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [currentPeriod, setCurrentPeriod] = useState<PayrollPeriod | null>(null);
  const [loading, setLoading] = useState(false);

  // ─── Settings ────────────────────────────────────────────────────────────
  const loadPayrollSettings = useCallback(async () => {
    try {
      setLoading(true);
      const settings = await PayrollService.getPayrollSettings();
      setPayrollSettings(settings);
    } catch {
      toast.error('Failed to load payroll settings');
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePayrollSettings = useCallback(async (settings: Partial<PayrollSettings>) => {
    try {
      setLoading(true);
      const success = await PayrollService.updatePayrollSettings(settings);
      if (success) {
        toast.success('Payroll settings updated');
        await loadPayrollSettings();
      } else {
        toast.error('Failed to update payroll settings');
      }
    } catch {
      toast.error('Failed to update payroll settings');
    } finally {
      setLoading(false);
    }
  }, [loadPayrollSettings]);

  // ─── Runs ─────────────────────────────────────────────────────────────────
  const loadPayrollRuns = useCallback(async (periodId?: string) => {
    try {
      setLoading(true);
      const runsRaw = await PayrollService.getPayrollRuns(periodId);
      const runs = Array.isArray(runsRaw) ? runsRaw : [];
      setPayrollRuns(runs);
    } catch {
      toast.error('Failed to load payroll runs');
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Periods ─────────────────────────────────────────────────────────────
  const loadPayrollPeriods = useCallback(async () => {
    try {
      setLoading(true);
      const periodsRaw = await PayrollService.getPayrollPeriods();
      const periods = Array.isArray(periodsRaw) ? periodsRaw : [];
      setPayrollPeriods(periods);
      // Auto-select most recent open/processing period
      const active = periods.find(p => p.status === 'open' || p.status === 'processing');
      setCurrentPeriod(prev => prev ? (periods.find(p => p.id === prev.id) || active || null) : (active || null));
    } catch {
      toast.error('Failed to load payroll periods');
    } finally {
      setLoading(false);
    }
  }, []);

  const createPayrollPeriod = useCallback(async (period: Partial<PayrollPeriod>) => {
    try {
      setLoading(true);
      const newPeriod = await PayrollService.createPayrollPeriod(period);
      if (newPeriod) {
        toast.success('Payroll period created');
        await loadPayrollPeriods();
        return newPeriod;
      }
      toast.error('Failed to create payroll period');
      return null;
    } catch {
      toast.error('Failed to create payroll period');
      return null;
    } finally {
      setLoading(false);
    }
  }, [loadPayrollPeriods]);

  const closePayrollPeriod = useCallback(async (periodId: string) => {
    try {
      setLoading(true);
      const result = await PayrollService.closePayrollPeriod(periodId);
      if (result.success) {
        toast.success('Payroll period closed and journal entry posted ✓');
        await loadPayrollPeriods();
        // Refresh runs if this was the current period
        setCurrentPeriod(prev => {
          if (prev?.id === periodId) {
            loadPayrollRuns(periodId);
          }
          return prev;
        });
      } else {
        toast.error(result.error || 'Failed to close payroll period');
      }
    } catch {
      toast.error('Failed to close payroll period');
    } finally {
      setLoading(false);
    }
  }, [loadPayrollPeriods, loadPayrollRuns]);

  const updatePayrollPeriod = useCallback(async (periodId: string, data: Partial<PayrollPeriod>) => {
    try {
      setLoading(true);
      const updated = await PayrollService.updatePayrollPeriod(periodId, data);
      if (updated) {
        toast.success('Payroll period updated');
        await loadPayrollPeriods();
        return updated;
      }
      toast.error('Failed to update payroll period');
      return null;
    } catch {
      toast.error('Failed to update payroll period');
      return null;
    } finally {
      setLoading(false);
    }
  }, [loadPayrollPeriods]);

  const deletePayrollPeriod = useCallback(async (periodId: string) => {
    try {
      setLoading(true);
      const success = await PayrollService.deletePayrollPeriod(periodId);
      if (success) {
        toast.success('Payroll period deleted');
        await loadPayrollPeriods();
        setCurrentPeriod(prev => prev?.id === periodId ? null : prev);
        return true;
      }
      toast.error('Failed to delete payroll period');
      return false;
    } catch {
      toast.error('Failed to delete payroll period');
      return false;
    } finally {
      setLoading(false);
    }
  }, [loadPayrollPeriods]);

  const refreshPayrollPeriod = useCallback(async (periodId: string) => {
    try {
      setLoading(true);
      const refreshed = await PayrollService.refreshPayrollPeriod(periodId);
      if (refreshed) {
        toast.success('Payroll period totals refreshed ✓');
        await loadPayrollPeriods();
        await loadPayrollRuns(periodId);
        return refreshed;
      }
      toast.error('Failed to refresh payroll period');
      return null;
    } catch {
      toast.error('Failed to refresh payroll period');
      return null;
    } finally {
      setLoading(false);
    }
  }, [loadPayrollPeriods, loadPayrollRuns]);

  const generatePayrollForPeriod = useCallback(async (periodId: string) => {
    try {
      setLoading(true);
      const result = await PayrollService.generatePayrollForPeriod(periodId);
      if (result.success) {
        toast.success(`Payroll generated for ${result.generated ?? ''} employee(s) ✓`);
        await loadPayrollRuns(periodId);
        await loadPayrollPeriods();   // update period totals
      } else {
        toast.error(result.error || 'Failed to generate payroll');
      }
    } catch {
      toast.error('Failed to generate payroll');
    } finally {
      setLoading(false);
    }
  }, [loadPayrollRuns, loadPayrollPeriods]);

  const approvePayrollRun = useCallback(async (runId: string) => {
    try {
      setLoading(true);
      const result = await PayrollService.approvePayrollRun(runId);
      if (result.success) {
        toast.success('Payroll run approved ✓');
        await loadPayrollRuns(currentPeriod?.id);
      } else {
        toast.error(result.error || 'Failed to approve run');
      }
    } catch {
      toast.error('Failed to approve payroll run');
    } finally {
      setLoading(false);
    }
  }, [loadPayrollRuns, currentPeriod]);

  const payPayrollRun = useCallback(async (
    runId: string,
    paymentData?: {
      payment_account_id: string;
      payment_date?: string;
      payment_reference?: string;
      notes?: string;
    }
  ) => {
    try {
      setLoading(true);
      const result = await PayrollService.payPayrollRun(runId, paymentData);
      if (result.success) {
        toast.success('Run marked as paid and journal entry posted ✓');
        await loadPayrollRuns(currentPeriod?.id);
        return true;
      } else {
        toast.error(result.error || 'Failed to mark run as paid');
        return false;
      }
    } catch {
      toast.error('Failed to process payroll run');
      return false;
    } finally {
      setLoading(false);
    }
  }, [loadPayrollRuns, currentPeriod]);

  const updatePayrollRun = useCallback(async (runId: string, updates: Partial<PayrollRun>) => {
    try {
      setLoading(true);
      const success = await PayrollService.updatePayrollRun(runId, updates);
      if (success) {
        toast.success('Payroll run updated ✓');
        await loadPayrollRuns(currentPeriod?.id);
      } else {
        toast.error('Failed to update payroll run');
      }
    } catch {
      toast.error('Failed to update payroll run');
    } finally {
      setLoading(false);
    }
  }, [loadPayrollRuns, currentPeriod]);

  const calculateEmployeePayroll = useCallback((
    employee: Employee,
    overtimeHours = 0,
    holidayHours = 0,
    allowances = 0,
    bonuses = 0,
    otherDeductions = 0
  ) => {
    if (!payrollSettings || !employee.basic_salary) return null;
    return PayrollService.calculatePayroll(
      employee.basic_salary, overtimeHours, holidayHours,
      allowances, bonuses, otherDeductions, payrollSettings
    );
  }, [payrollSettings]);

  // ─── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadPayrollSettings();
    loadPayrollPeriods();
  }, [loadPayrollSettings, loadPayrollPeriods]);

  const clearAllPayrollRuns = useCallback(async () => {
    try {
      setLoading(true);
      const result = await PayrollService.clearAllPayrollRuns();
      if (result.success) {
        toast.success(result.message || 'Cleared all payroll runs ✓');
        await loadPayrollPeriods();
        await loadPayrollRuns();
        return true;
      } else {
        toast.error(result.error || 'Failed to clear payroll runs');
        return false;
      }
    } catch {
      toast.error('Failed to clear payroll runs');
      return false;
    } finally {
      setLoading(false);
    }
  }, [loadPayrollPeriods, loadPayrollRuns]);

  return {
    payrollSettings,
    payrollPeriods,
    payrollRuns,
    currentPeriod,
    setCurrentPeriod,
    loading,
    loadPayrollSettings,
    updatePayrollSettings,
    loadPayrollPeriods,
    createPayrollPeriod,
    updatePayrollPeriod,
    deletePayrollPeriod,
    refreshPayrollPeriod,
    closePayrollPeriod,
    loadPayrollRuns,
    generatePayrollForPeriod,
    approvePayrollRun,
    payPayrollRun,
    updatePayrollRun,
    calculateEmployeePayroll,
    clearAllPayrollRuns,
  };
};