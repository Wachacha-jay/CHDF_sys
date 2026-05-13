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

  // ─── Periods ─────────────────────────────────────────────────────────────
  const loadPayrollPeriods = useCallback(async () => {
    try {
      setLoading(true);
      const periods = await PayrollService.getPayrollPeriods();
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
  }, [loadPayrollPeriods]);

  // ─── Runs ─────────────────────────────────────────────────────────────────
  const loadPayrollRuns = useCallback(async (periodId?: string) => {
    try {
      setLoading(true);
      const runs = await PayrollService.getPayrollRuns(periodId);
      setPayrollRuns(runs);
    } catch {
      toast.error('Failed to load payroll runs');
    } finally {
      setLoading(false);
    }
  }, []);

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

  const payPayrollRun = useCallback(async (runId: string) => {
    try {
      setLoading(true);
      const result = await PayrollService.payPayrollRun(runId);
      if (result.success) {
        toast.success('Run marked as paid and journal entry posted ✓');
        await loadPayrollRuns(currentPeriod?.id);
      } else {
        toast.error(result.error || 'Failed to mark run as paid');
      }
    } catch {
      toast.error('Failed to process payroll run');
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
    closePayrollPeriod,
    loadPayrollRuns,
    generatePayrollForPeriod,
    approvePayrollRun,
    payPayrollRun,
    updatePayrollRun,
    calculateEmployeePayroll,
  };
};