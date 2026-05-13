import { ApiService } from './api';
import { apiClient } from '../lib/api-client';
import type { 
  PayrollSettings, 
  PayrollPeriod, 
  PayrollRun, 
  PayrollDeduction, 
  PayrollAllowance, 
  Employee 
} from '../types';

export class PayrollService {
  // ────────────────────────────────────────────────
  // Payroll Settings
  // ────────────────────────────────────────────────
  static async getPayrollSettings(): Promise<PayrollSettings | null> {
    try {
      const response = await ApiService.get<PayrollSettings>('payroll_settings');
      return (response.success && response.data && response.data.length > 0) ? response.data[0] : null;
    } catch (error) {
      console.error('Error fetching payroll settings:', error);
      return null;
    }
  }

  static async updatePayrollSettings(settings: Partial<PayrollSettings>): Promise<boolean> {
    try {
      if (settings.id) {
        const response = await ApiService.update('payroll_settings', settings.id, settings);
        return response.success;
      }
      const response = await ApiService.create('payroll_settings', settings);
      return response.success;
    } catch (error) {
      console.error('Error updating payroll settings:', error);
      return false;
    }
  }

  // ────────────────────────────────────────────────
  // Payroll Periods
  // ────────────────────────────────────────────────
  static async getPayrollPeriods(): Promise<PayrollPeriod[]> {
    try {
      const response = await ApiService.get<PayrollPeriod>('payroll_periods', {
        orderBy: { column: 'created_at', ascending: false }
      });
      return response.success ? (response.data || []) : [];
    } catch (error) {
      console.error('Error fetching payroll periods:', error);
      return [];
    }
  }

  static async createPayrollPeriod(period: Partial<PayrollPeriod>): Promise<PayrollPeriod | null> {
    try {
      const response = await ApiService.create<PayrollPeriod>('payroll_periods', period);
      return response.success ? response.data : null;
    } catch (error) {
      console.error('Error creating payroll period:', error);
      return null;
    }
  }

  /**
   * Close a payroll period via the dedicated backend route
   * which also posts the consolidated journal entry.
   */
  static async closePayrollPeriod(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await apiClient.put<any>(`/payroll/periods/${id}/close`, {});
      return { success: true };
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Failed to close payroll period';
      console.error('Error closing payroll period:', error);
      return { success: false, error: msg };
    }
  }

  // ────────────────────────────────────────────────
  // Payroll Runs — using the dedicated /payroll/runs route
  // which returns employee data joined
  // ────────────────────────────────────────────────
  static async getPayrollRuns(periodId?: string): Promise<PayrollRun[]> {
    try {
      const params: Record<string, any> = {};
      if (periodId) params.payroll_period_id = periodId;

      const response = await apiClient.get<any>('/payroll/runs', { params });
      // response is the raw data array
      if (Array.isArray(response)) return response;
      if (response && Array.isArray((response as any).data)) return (response as any).data;
      return [];
    } catch (error) {
      console.error('Error fetching payroll runs:', error);
      return [];
    }
  }

  static async updatePayrollRun(id: string, data: Partial<PayrollRun>): Promise<boolean> {
    try {
      const result = await apiClient.put<any>(`/payroll/runs/${id}`, data);
      return true;
    } catch (error) {
      console.error('Error updating payroll run:', error);
      return false;
    }
  }

  static async approvePayrollRun(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      await apiClient.put<any>(`/payroll/runs/${id}/approve`, {});
      return { success: true };
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Failed to approve payroll run';
      return { success: false, error: msg };
    }
  }

  static async payPayrollRun(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      await apiClient.put<any>(`/payroll/runs/${id}/pay`, {});
      return { success: true };
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Failed to mark as paid';
      return { success: false, error: msg };
    }
  }

  // ────────────────────────────────────────────────
  // Generate Payroll for Period
  // ────────────────────────────────────────────────
  static async generatePayrollForPeriod(periodId: string): Promise<{ success: boolean; generated?: number; error?: string }> {
    try {
      const result = await apiClient.post<any>(`/payroll/periods/${periodId}/generate`, {});
      return { success: true, generated: result?.generated };
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Failed to generate payroll';
      return { success: false, error: msg };
    }
  }

  // ────────────────────────────────────────────────
  // Payroll Calculations (front-end preview)
  // ────────────────────────────────────────────────
  static calculatePayroll(
    basicSalary: number,
    overtimeHours: number = 0,
    holidayHours: number = 0,
    allowances: number = 0,
    bonuses: number = 0,
    otherDeductions: number = 0,
    settings: PayrollSettings
  ) {
    const overtimePay = overtimeHours * (basicSalary / 160) * settings.overtime_rate;
    const holidayPay = holidayHours * (basicSalary / 160) * settings.holiday_pay_rate;
    const grossPay = basicSalary + overtimePay + holidayPay + allowances + bonuses;
    const taxDeduction = grossPay * (settings.tax_deduction_rate / 100);
    const nhifDeduction = grossPay * (settings.nhif_rate / 100);
    const nssfDeduction = grossPay * (settings.nssf_rate / 100);
    const housingLevyDeduction = grossPay * ((settings.housing_levy_rate || 0) / 100);
    const netPay = grossPay - taxDeduction - nhifDeduction - nssfDeduction - housingLevyDeduction - otherDeductions;

    return { overtimePay, holidayPay, grossPay, taxDeduction, nhifDeduction, nssfDeduction, housingLevyDeduction, netPay };
  }

  // ────────────────────────────────────────────────
  // Deductions & Allowances
  // ────────────────────────────────────────────────
  static async getPayrollDeductions(payrollRunId: string): Promise<PayrollDeduction[]> {
    try {
      const response = await ApiService.get<PayrollDeduction>('payroll_deductions', {
        filters: { payroll_run_id: payrollRunId }
      });
      return response.success ? (response.data || []) : [];
    } catch (error) {
      console.error('Error fetching payroll deductions:', error);
      return [];
    }
  }

  static async addPayrollDeduction(deduction: Partial<PayrollDeduction>): Promise<PayrollDeduction | null> {
    try {
      const response = await ApiService.create<PayrollDeduction>('payroll_deductions', deduction);
      return response.success ? response.data : null;
    } catch (error) {
      console.error('Error adding payroll deduction:', error);
      return null;
    }
  }

  static async getPayrollAllowances(payrollRunId: string): Promise<PayrollAllowance[]> {
    try {
      const response = await ApiService.get<PayrollAllowance>('payroll_allowances', {
        filters: { payroll_run_id: payrollRunId }
      });
      return response.success ? (response.data || []) : [];
    } catch (error) {
      console.error('Error fetching payroll allowances:', error);
      return [];
    }
  }

  static async addPayrollAllowance(allowance: Partial<PayrollAllowance>): Promise<PayrollAllowance | null> {
    try {
      const response = await ApiService.create<PayrollAllowance>('payroll_allowances', allowance);
      return response.success ? response.data : null;
    } catch (error) {
      console.error('Error adding payroll allowance:', error);
      return null;
    }
  }

  // ────────────────────────────────────────────────
  // Employee Payroll Info
  // ────────────────────────────────────────────────
  static async updateEmployeePayrollInfo(employeeId: string, payrollInfo: Partial<Employee>): Promise<boolean> {
    try {
      const response = await ApiService.update('employees', employeeId, payrollInfo);
      return response.success;
    } catch (error) {
      console.error('Error updating employee payroll info:', error);
      return false;
    }
  }

  // ────────────────────────────────────────────────
  // Payslip
  // ────────────────────────────────────────────────
  static async getPayslip(runId: string): Promise<any | null> {
    try {
      const result = await apiClient.get<any>(`/payroll/runs/${runId}/payslip`);
      return result;
    } catch (error) {
      console.error('Error fetching payslip:', error);
      return null;
    }
  }
}