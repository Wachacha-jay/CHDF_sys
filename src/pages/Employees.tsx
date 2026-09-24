import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Edit, Trash2, User, Mail, Phone, Calendar, 
  DollarSign, Settings, FileText, Users, Building2, Layers, CheckCircle, Clock, X,
  FileSpreadsheet, RotateCcw, PieChart
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useSettingsContext } from '../contexts/SettingsContext';
import { ApiService } from '../services/api';
import { apiClient } from '../lib/api-client';
import { usePayroll } from '../hooks/usePayroll';
import { PayrollService } from '../services/payrollService';
import { FundAccountingService } from '../services/fundAccountingService';
import PayrollSettingsModal from '../components/payroll/PayrollSettingsModal';
import PayrollPeriods from '../components/payroll/PayrollPeriods';
import PayrollRuns from '../components/payroll/PayrollRuns';
import PayrollDetailsModal from '../components/payroll/PayrollDetailsModal';
import PayrollRunModal from '../components/payroll/PayrollRunModal';
import EmployeePayrollForm from '../components/payroll/EmployeePayrollForm';
import P9Form from '../components/payroll/P9Form';
import DepartmentBudgetingTab from '../components/payroll/DepartmentBudgetingTab';
import type { 
  Employee, PayrollRun, PayrollDeduction, PayrollAllowance, 
  Designation, Department 
} from '../types';

const Employees: React.FC = () => {
  const { settings } = useSettingsContext();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showClearRunsModal, setShowClearRunsModal] = useState(false);
  const [clearingRuns, setClearingRuns] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  
  // Tab state including Department Budgeting
  const [activeTab, setActiveTab] = useState<'employees' | 'payroll-runs' | 'payroll-periods' | 'department-budgeting'>('employees');
  
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  
  const [employeeFormData, setEmployeeFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    code: '',
    designation_id: '',
    position: '',
    department: '',
    department_id: '',
    hire_date: new Date().toISOString().split('T')[0],
    basic_salary: 0,
    tax_pin: '',
    nssf_number: '',
    nhif_number: '',
    bank_name: '',
    bank_account: '',
    is_active: true
  });
  
  // Payroll state
  const [showPayrollSettings, setShowPayrollSettings] = useState(false);
  const [showPayrollDetails, setShowPayrollDetails] = useState(false);
  const [showEmployeePayrollForm, setShowEmployeePayrollForm] = useState(false);
  const [selectedPayrollRun, setSelectedPayrollRun] = useState<PayrollRun | null>(null);
  const [payrollDeductions, setPayrollDeductions] = useState<PayrollDeduction[]>([]);
  const [payrollAllowances, setPayrollAllowances] = useState<PayrollAllowance[]>([]);
  const [editingRun, setEditingRun] = useState<PayrollRun | null>(null);
  const [showRunModal, setShowRunModal] = useState(false);

  // P9 Form state
  const [showP9Modal, setShowP9Modal] = useState(false);
  const [p9Data, setP9Data] = useState<any>(null);
  const [p9Loading, setP9Loading] = useState(false);
  const [p9Employee, setP9Employee] = useState<Employee | null>(null);
  const [p9Year, setP9Year] = useState(new Date().getFullYear() - 1);
  const [showP9YearPicker, setShowP9YearPicker] = useState(false);

  const {
    payrollSettings,
    payrollPeriods,
    payrollRuns,
    currentPeriod,
    setCurrentPeriod,
    loading: payrollLoading,
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
    clearAllPayrollRuns
  } = usePayroll();

  const isEmployeeActive = (emp: Employee) => {
    return Boolean(emp.is_active === true || (emp.is_active as any) === 1 || (emp.is_active as any) === '1');
  };

  useEffect(() => {
    loadEmployees();
    loadDesignations();
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      const depts = await FundAccountingService.getDepartments();
      setDepartments(depts || []);
    } catch (error) {
      console.error('Failed to load departments:', error);
    }
  };

  const loadDesignations = async () => {
    try {
      const response = await ApiService.get<Designation>('designations');
      if (response.success) {
        setDesignations(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load designations');
    }
  };

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const response = await ApiService.get<Employee>('employees');
      
      if (response.success && response.data) {
        setEmployees(response.data || []);
      }
    } catch (error) {
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEmployeeStatus = async (employee: Employee) => {
    const currentlyActive = isEmployeeActive(employee);
    const newStatus = !currentlyActive;
    const actionLabel = newStatus ? 'activated' : 'deactivated';

    setTogglingId(employee.id);
    try {
      const response = await ApiService.update('employees', employee.id, {
        is_active: newStatus
      });
      if (response.success) {
        toast.success(`Employee ${employee.first_name} ${employee.last_name} ${actionLabel} ✓`);
        setEmployees(prev => prev.map(e => e.id === employee.id ? { ...e, is_active: newStatus } : e));
      } else {
        toast.error(response.error || `Failed to ${actionLabel} employee`);
      }
    } catch (error: any) {
      toast.error(`Failed to ${actionLabel} employee: ${error.message || ''}`);
    } finally {
      setTogglingId(null);
    }
  };

  const displayedEmployees = useMemo(() => {
    return employees.filter(employee => {
      const active = isEmployeeActive(employee);
      if (statusFilter === 'active' && !active) return false;
      if (statusFilter === 'inactive' && active) return false;

      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const fullName = `${employee.first_name || ''} ${employee.last_name || ''}`.toLowerCase();
        const email = (employee.email || '').toLowerCase();
        const code = (employee.code || '').toLowerCase();
        const dept = (employee.department || '').toLowerCase();
        const pos = (employee.position || '').toLowerCase();
        return fullName.includes(query) || email.includes(query) || code.includes(query) || dept.includes(query) || pos.includes(query);
      }
      return true;
    });
  }, [employees, statusFilter, searchTerm]);

  const handleSearch = () => {
    // displayedEmployees automatically updates via searchTerm memo
  };

  const handleDelete = async (employeeId: string) => {
    if (!confirm('Are you sure you want to delete this employee?')) {
      return;
    }

    try {
      const response = await ApiService.delete('employees', employeeId);
      if (response.success) {
        toast.success('Employee deleted successfully');
        loadEmployees();
      } else {
        toast.error(response.error || 'Failed to delete employee');
      }
    } catch (error) {
      toast.error('Failed to delete employee');
    }
  };

  const handleSaveEmployeePayroll = async (employeeId: string, payrollData: Partial<Employee>) => {
    try {
      const success = await PayrollService.updateEmployeePayrollInfo(employeeId, payrollData);
      if (success) {
        toast.success('Employee payroll information updated successfully');
        loadEmployees();
        return true;
      } else {
        toast.error('Failed to update employee payroll information');
        return false;
      }
    } catch (error) {
      toast.error('Failed to update employee payroll information');
      return false;
    }
  };

  const handleGenerateP9 = async (employee: Employee, year: number) => {
    setP9Loading(true);
    try {
      const data = await apiClient.get<any>(`/payroll/employees/${employee.id}/p9?year=${year}`);
      setP9Data(data);
      setShowP9Modal(true);
      setShowP9YearPicker(false);
    } catch (error) {
      toast.error('Failed to generate P9 form. Ensure payroll has been processed for this employee.');
    } finally {
      setP9Loading(false);
    }
  };

  const handleViewPayrollDetails = async (payrollRun: PayrollRun) => {
    setSelectedPayrollRun(payrollRun);
    try {
      const deductions = await PayrollService.getPayrollDeductions(payrollRun.id);
      const allowances = await PayrollService.getPayrollAllowances(payrollRun.id);
      setPayrollDeductions(deductions);
      setPayrollAllowances(allowances);
    } catch (error) {
      console.error('Error loading payroll details:', error);
    }
    setShowPayrollDetails(true);
  };

  const handleEditPayrollRun = (payrollRun: PayrollRun) => {
    setEditingRun(payrollRun);
    setShowRunModal(true);
  };

  const handleSavePayrollRun = async (updates: Partial<PayrollRun>) => {
    if (editingRun) {
      await updatePayrollRun(editingRun.id, updates);
      setShowRunModal(false);
      setEditingRun(null);
      if (currentPeriod) loadPayrollRuns(currentPeriod.id);
    }
  };

  const handleGeneratePayroll = async () => {
    if (!currentPeriod) {
      toast.error('Please select a payroll period first');
      return;
    }

    try {
      await generatePayrollForPeriod(currentPeriod.id);
      await loadPayrollRuns(currentPeriod.id);
    } catch (error) {
      toast.error('Failed to generate payroll');
    }
  };

  const handleSelectPeriod = (period: any) => {
    setCurrentPeriod(period);
    loadPayrollRuns(period.id);
    setActiveTab('payroll-runs');
  };

  const getEmployeeStatus = (isActive: boolean) => {
    return isActive 
      ? { color: 'text-green-600', bg: 'bg-green-50', text: 'Active' }
      : { color: 'text-red-600', bg: 'bg-red-50', text: 'Inactive' };
  };

  const currency = settings?.default_currency || 'KES';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Employee & Payroll Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage your workforce, process salaries, disburse payments with GL integration, and manage pay periods
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setShowPayrollSettings(true)}
            className="inline-flex items-center px-3.5 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-xs transition-colors"
          >
            <Settings className="h-4 w-4 mr-1.5 text-slate-500" />
            Payroll Settings
          </button>

          {activeTab === 'employees' && (
            <button
              onClick={() => {
                setSelectedEmployee(null);
                setEmployeeFormData({
                  first_name: '',
                  last_name: '',
                  email: '',
                  phone: '',
                  code: '',
                  designation_id: '',
                  position: '',
                  department: departments[0]?.name || '',
                  department_id: departments[0]?.id || '',
                  hire_date: new Date().toISOString().split('T')[0],
                  basic_salary: 0,
                  tax_pin: '',
                  nssf_number: '',
                  nhif_number: '',
                  bank_name: '',
                  bank_account: '',
                  is_active: true
                });
                setShowModal(true);
              }}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add Employee
            </button>
          )}

          {activeTab === 'payroll-runs' && (
            <button
              onClick={handleGeneratePayroll}
              disabled={!currentPeriod || currentPeriod.status === 'closed' || payrollLoading}
              className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 shadow-sm transition-colors"
            >
              <FileText className="h-4 w-4 mr-1.5" />
              Generate Payroll
            </button>
          )}
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('employees')}
            className={`py-3 px-1 border-b-2 font-bold text-sm flex items-center whitespace-nowrap transition-colors ${
              activeTab === 'employees'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Users className="h-4 w-4 mr-2" />
            Employees Directory
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
              {employees.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('payroll-runs')}
            className={`py-3 px-1 border-b-2 font-bold text-sm flex items-center whitespace-nowrap transition-colors ${
              activeTab === 'payroll-runs'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <DollarSign className="h-4 w-4 mr-2" />
            Payroll Runs
            {currentPeriod && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700 font-medium">
                {currentPeriod.period_name}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('payroll-periods')}
            className={`py-3 px-1 border-b-2 font-bold text-sm flex items-center whitespace-nowrap transition-colors ${
              activeTab === 'payroll-periods'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Pay Periods
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
              {payrollPeriods.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('department-budgeting');
              loadPayrollRuns();
            }}
            className={`py-3 px-1 border-b-2 font-bold text-sm flex items-center whitespace-nowrap transition-colors ${
              activeTab === 'department-budgeting'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <PieChart className="h-4 w-4 mr-2" />
            Department Budgeting
          </button>
        </nav>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 1. EMPLOYEES TAB                                                   */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'employees' && (
        <div className="space-y-4">
          {/* Search bar & Status Filter */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search employees by name, email, code or department..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center space-x-1.5 self-center sm:self-auto bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    statusFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({employees.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('active')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    statusFilter === 'active'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-emerald-700 hover:text-emerald-900'
                  }`}
                >
                  Active ({employees.filter(e => isEmployeeActive(e)).length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('inactive')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    statusFilter === 'inactive'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-rose-700 hover:text-rose-900'
                  }`}
                >
                  Inactive ({employees.filter(e => !isEmployeeActive(e)).length})
                </button>
              </div>
            </div>
          </div>

          {/* Full-width Employees Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden w-full">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50/80">
                    <tr>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Employee
                      </th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Code
                      </th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Department
                      </th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Position
                      </th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Basic Salary
                      </th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Status (Click to Toggle)
                      </th>
                      <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {displayedEmployees.map((employee) => {
                      const active = isEmployeeActive(employee);
                      return (
                        <tr 
                          key={employee.id} 
                          className={`hover:bg-slate-50/60 transition-colors ${!active ? 'bg-slate-50/40 opacity-75' : ''}`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center mr-3 text-xs font-bold ${
                                active ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'
                              }`}>
                                {employee.first_name?.[0]}{employee.last_name?.[0]}
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                                  {employee.first_name} {employee.last_name}
                                  {!active && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-600 font-medium">
                                      Inactive
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {employee.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700">
                            {employee.code}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                              <Building2 className="h-3 w-3 mr-1 text-slate-400" />
                              {employee.department || 'General'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                            {employee.position || '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900">
                            {currency} {employee.basic_salary?.toLocaleString('en-KE', { minimumFractionDigits: 2 }) || '0.00'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {/* Interactive Status Toggle Button */}
                            <button
                              type="button"
                              onClick={() => handleToggleEmployeeStatus(employee)}
                              disabled={togglingId === employee.id}
                              title={`Click to ${active ? 'deactivate (excludes from payroll runs)' : 'activate (includes in payroll runs)'}`}
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all border shadow-2xs cursor-pointer ${
                                active
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300'
                                  : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 hover:border-rose-300'
                              }`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full transition-colors ${
                                  active ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-rose-400'
                                }`}
                              />
                              {togglingId === employee.id ? (
                                <span className="italic">Updating...</span>
                              ) : active ? (
                                'Active'
                              ) : (
                                'Inactive'
                              )}
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => {
                                  setP9Employee(employee);
                                  setP9Year(new Date().getFullYear() - 1);
                                  setShowP9YearPicker(true);
                                }}
                                className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg"
                                title="Generate P9 Tax Form"
                              >
                                <FileSpreadsheet className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedEmployee(employee);
                                  setShowEmployeePayrollForm(true);
                                }}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                                title="Payroll & Payment Setup"
                              >
                                <DollarSign className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedEmployee(employee);
                                  setEmployeeFormData({
                                    first_name: employee.first_name,
                                    last_name: employee.last_name,
                                    email: employee.email,
                                    phone: employee.phone || '',
                                    code: employee.code,
                                    designation_id: (employee as any).designation_id || '',
                                    position: employee.position || '',
                                    department: employee.department || '',
                                    department_id: (employee as any).department_id || '',
                                    hire_date: employee.hire_date || '',
                                    basic_salary: employee.basic_salary || 0,
                                    tax_pin: employee.tax_pin || '',
                                    nssf_number: employee.nssf_number || employee.nssf_no || '',
                                    nhif_number: employee.nhif_number || employee.nhif_no || '',
                                    bank_name: employee.bank_name || '',
                                    bank_account: employee.bank_account || '',
                                    is_active: isEmployeeActive(employee)
                                  });
                                  setShowModal(true);
                                }}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                                title="Edit Profile"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(employee.id)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            
            {!loading && displayedEmployees.length === 0 && (
              <div className="text-center py-12">
                <User className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-slate-800 mb-1">
                  {employees.length === 0 ? 'No employees found' : 'No matching employees'}
                </h3>
                <p className="text-xs text-slate-500">
                  {employees.length === 0 
                    ? 'Get started by adding your first employee.' 
                    : 'Try changing your search term or status filter.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 2. PAYROLL RUNS TAB (Full Width with Period Selector & Pay Modal)  */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'payroll-runs' && (
        <div className="space-y-4">
          {/* Active Period Toolbar & Switcher */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Period:</span>
                <select
                  value={currentPeriod?.id || ''}
                  onChange={(e) => {
                    const selected = payrollPeriods.find(p => p.id === e.target.value);
                    if (selected) {
                      setCurrentPeriod(selected);
                      loadPayrollRuns(selected.id);
                    }
                  }}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500"
                >
                  {payrollPeriods.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.period_name} ({p.status.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              {currentPeriod && (
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                  currentPeriod.status === 'closed'
                    ? 'bg-emerald-100 text-emerald-800'
                    : currentPeriod.status === 'processing'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {currentPeriod.status}
                </span>
              )}

              {currentPeriod && (
                <span className="text-xs text-slate-500">
                  {currentPeriod.start_date} to {currentPeriod.end_date} · Pay Date: {currentPeriod.pay_date || '—'}
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setShowClearRunsModal(true)}
                className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 hover:border-rose-300 transition-colors shadow-2xs"
                title="Permanently clear all payroll runs across all periods and start fresh"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1 text-rose-600" />
                Clear Runs (Fresh Start)
              </button>

              {currentPeriod && currentPeriod.status !== 'closed' && (
                <button
                  onClick={async () => {
                    if (confirm(`Are you sure you want to close payroll period "${currentPeriod.period_name}"?`)) {
                      await closePayrollPeriod(currentPeriod.id);
                    }
                  }}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                >
                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                  Close Period
                </button>
              )}

              <button
                onClick={() => setActiveTab('payroll-periods')}
                className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <Calendar className="h-3.5 w-3.5 mr-1" />
                Manage Periods
              </button>
            </div>
          </div>

          {/* Full-width Payroll Runs Table */}
          {currentPeriod ? (
            <PayrollRuns
              payrollRuns={payrollRuns}
              onApproveRun={approvePayrollRun}
              onPayRun={payPayrollRun}
              onViewRun={handleViewPayrollDetails}
              onEditRun={handleEditPayrollRun}
              periodStatus={currentPeriod.status}
            />
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-700">No active period selected</h3>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                Please create or select a payroll period to view and process employee runs.
              </p>
              <button
                onClick={() => setActiveTab('payroll-periods')}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
              >
                Go to Pay Periods
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 3. PAY PERIODS TAB (Full Width)                                    */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'payroll-periods' && (
        <div className="w-full">
          <PayrollPeriods
            periods={payrollPeriods}
            onCreatePeriod={createPayrollPeriod}
            onUpdatePeriod={updatePayrollPeriod}
            onDeletePeriod={deletePayrollPeriod}
            onRefreshPeriod={refreshPayrollPeriod}
            onClosePeriod={closePayrollPeriod}
            onSelectPeriod={handleSelectPeriod}
            selectedPeriod={currentPeriod}
          />
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 4. DEPARTMENT BUDGETING TAB (Rollup & Breakdown by Dept)            */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'department-budgeting' && (
        <div className="w-full">
          <DepartmentBudgetingTab
            payrollRuns={payrollRuns}
            payrollPeriods={payrollPeriods}
            departments={departments}
            currentPeriod={currentPeriod}
            onSelectPeriod={handleSelectPeriod}
            loading={payrollLoading}
          />
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* EMPLOYEE ADD / EDIT MODAL (with Fund Accounting Dept Dropdown)      */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-60 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">
                  {selectedEmployee ? 'Edit Employee Profile' : 'Register New Employee'}
                </h3>
                <p className="text-xs text-slate-400">
                  Personal, departmental, and payroll banking credentials
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  let response;
                  if (selectedEmployee) {
                    response = await ApiService.update('employees', selectedEmployee.id, employeeFormData);
                  } else {
                    response = await ApiService.create('employees', employeeFormData);
                  }

                  if (response.success) {
                    toast.success(selectedEmployee ? 'Employee updated successfully' : 'Employee added successfully');
                    setShowModal(false);
                    loadEmployees();
                  } else {
                    toast.error(response.error || 'Failed to save employee');
                  }
                } catch (error) {
                  toast.error('An unexpected error occurred');
                }
              }}
              className="p-6 space-y-4 max-h-[85vh] overflow-y-auto"
            >
              {/* Name fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={employeeFormData.first_name}
                    onChange={(e) => setEmployeeFormData(prev => ({ ...prev, first_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={employeeFormData.last_name}
                    onChange={(e) => setEmployeeFormData(prev => ({ ...prev, last_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Code & Email */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Employee Code
                  </label>
                  <input
                    type="text"
                    value={employeeFormData.code}
                    onChange={(e) => setEmployeeFormData(prev => ({ ...prev, code: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="Auto-generated if empty"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={employeeFormData.email}
                    onChange={(e) => setEmployeeFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Phone & Hire Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={employeeFormData.phone}
                    onChange={(e) => setEmployeeFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Hire Date
                  </label>
                  <input
                    type="date"
                    value={employeeFormData.hire_date}
                    onChange={(e) => setEmployeeFormData(prev => ({ ...prev, hire_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Position and Fund Accounting Department Picker */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Position / Designation
                  </label>
                  <select
                    value={employeeFormData.designation_id}
                    onChange={(e) => {
                      const desig = designations.find(d => d.id === e.target.value);
                      setEmployeeFormData(prev => ({ 
                        ...prev, 
                        designation_id: e.target.value,
                        position: desig ? desig.name : prev.position
                      }));
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Select Position</option>
                    {designations.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                {/* Requirement 2: Pick from departments registered in Fund Accounting */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Department (Fund Accounting) <span className="text-red-500">*</span></span>
                  </label>
                  {departments.length > 0 ? (
                    <select
                      value={employeeFormData.department}
                      onChange={(e) => {
                        const dept = departments.find(d => d.name === e.target.value);
                        setEmployeeFormData(prev => ({ 
                          ...prev, 
                          department: e.target.value,
                          department_id: dept?.id || ''
                        }));
                      }}
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">-- Select Department --</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.name}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="space-y-1">
                      <input
                        type="text"
                        placeholder="e.g. Administration"
                        value={employeeFormData.department}
                        onChange={(e) => setEmployeeFormData(prev => ({ ...prev, department: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-[10px] text-amber-600">
                        Tip: Register official departments under Fund Accounting &gt; Dept &amp; Fund Setup.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Basic Salary */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Basic Monthly Salary ({currency}) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={employeeFormData.basic_salary}
                  onChange={(e) => setEmployeeFormData(prev => ({ ...prev, basic_salary: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>

              {/* Tax & Statutory Numbers */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Tax PIN
                  </label>
                  <input
                    type="text"
                    value={employeeFormData.tax_pin}
                    onChange={(e) => setEmployeeFormData(prev => ({ ...prev, tax_pin: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="A00..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    NSSF Number
                  </label>
                  <input
                    type="text"
                    value={employeeFormData.nssf_number}
                    onChange={(e) => setEmployeeFormData(prev => ({ ...prev, nssf_number: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    NHIF / SHA
                  </label>
                  <input
                    type="text"
                    value={employeeFormData.nhif_number}
                    onChange={(e) => setEmployeeFormData(prev => ({ ...prev, nhif_number: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Bank credentials */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={employeeFormData.bank_name}
                    onChange={(e) => setEmployeeFormData(prev => ({ ...prev, bank_name: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Equity Bank"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={employeeFormData.bank_account}
                    onChange={(e) => setEmployeeFormData(prev => ({ ...prev, bank_account: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Employment Active Status Toggle */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-800">Employment Status</div>
                  <div className="text-[11px] text-slate-500">
                    {employeeFormData.is_active
                      ? 'Active — Eligible to be included in payroll generation runs'
                      : 'Inactive — Excluded from future payroll runs'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEmployeeFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    employeeFormData.is_active ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      employeeFormData.is_active ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Form Action buttons */}
              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-sm"
                >
                  {selectedEmployee ? 'Update Employee' : 'Register Employee'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Payroll Settings Modal */}
      <PayrollSettingsModal
        isOpen={showPayrollSettings}
        onClose={() => setShowPayrollSettings(false)}
        settings={payrollSettings}
        onSave={updatePayrollSettings}
      />

      {/* Payroll Details / Payslip Modal */}
      <PayrollDetailsModal
        isOpen={showPayrollDetails}
        onClose={() => setShowPayrollDetails(false)}
        payrollRun={selectedPayrollRun}
        deductions={payrollDeductions}
        allowances={payrollAllowances}
      />

      {/* Payroll Run Adjustment Modal */}
      <PayrollRunModal
        isOpen={showRunModal}
        onClose={() => setShowRunModal(false)}
        onSave={handleSavePayrollRun}
        run={editingRun}
      />

      {/* Employee Payroll Form Modal */}
      {showEmployeePayrollForm && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-60 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden">
            <EmployeePayrollForm
              employee={selectedEmployee}
              onSave={handleSaveEmployeePayroll}
              onClose={() => setShowEmployeePayrollForm(false)}
            />
          </div>
        </div>
      )}

      {/* P9 Year Picker Modal */}
      {showP9YearPicker && p9Employee && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Generate P9 Form</h3>
            <p className="text-sm text-slate-500 mb-4">
              {p9Employee.first_name} {p9Employee.last_name} ({p9Employee.code || 'No code'})
            </p>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tax Year</label>
              <select
                value={p9Year}
                onChange={e => setP9Year(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
              >
                {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowP9YearPicker(false)}
                className="px-4 py-2 text-sm text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleGenerateP9(p9Employee, p9Year)}
                disabled={p9Loading}
                className="px-4 py-2 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
              >
                {p9Loading ? 'Generating...' : 'Generate P9'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* P9 Form Modal */}
      {showP9Modal && p9Data && (
        <P9Form
          data={p9Data}
          onClose={() => { setShowP9Modal(false); setP9Data(null); }}
        />
      )}

      {/* Clear Runs Confirmation Modal */}
      {showClearRunsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center space-x-3 text-rose-600 mb-4">
              <div className="p-3 bg-rose-100 rounded-full">
                <RotateCcw className="h-6 w-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Clear All Payroll Runs?</h3>
                <p className="text-xs text-rose-600 font-semibold">Start Fresh with Clean Payroll Data</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              This action will permanently delete all generated employee payroll runs, salary allowances, deductions, and related draft payroll journal entries, and reset pay periods back to open.
            </p>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-6 text-xs text-amber-800">
              <strong>Safe Operation:</strong> Employee profiles, salary setup, and business configurations are fully preserved. Only payroll run records are cleared.
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowClearRunsModal(false)}
                disabled={clearingRuns}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={clearingRuns}
                onClick={async () => {
                  setClearingRuns(true);
                  const success = await clearAllPayrollRuns();
                  setClearingRuns(false);
                  if (success) {
                    setShowClearRunsModal(false);
                  }
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50 flex items-center shadow-sm"
              >
                {clearingRuns ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Clearing Runs...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4 mr-1.5" />
                    Confirm &amp; Clear All Runs
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Employees;