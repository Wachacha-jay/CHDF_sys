import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, User, Mail, Phone, Calendar, DollarSign, Settings, FileText, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useSettingsContext } from '../contexts/SettingsContext';
import { ApiService } from '../services/api';
import { usePayroll } from '../hooks/usePayroll';
import { PayrollService } from '../services/payrollService';
import PayrollSettingsModal from '../components/payroll/PayrollSettingsModal';
import PayrollPeriods from '../components/payroll/PayrollPeriods';
import PayrollRuns from '../components/payroll/PayrollRuns';
import PayrollDashboard from '../components/payroll/PayrollDashboard';
import PayrollDetailsModal from '../components/payroll/PayrollDetailsModal';
import PayrollAdjustmentModal from '../components/payroll/PayrollAdjustmentModal';
import PayrollRunModal from '../components/payroll/PayrollRunModal';
import EmployeePayrollForm from '../components/payroll/EmployeePayrollForm';
import type { Employee, PayrollRun, PayrollDeduction, PayrollAllowance, Designation } from '../types';

const Employees: React.FC = () => {
  const { settings } = useSettingsContext();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState<'employees' | 'payroll'>('employees');
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [employeeFormData, setEmployeeFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    code: '',
    designation_id: '',
    position: '',
    department: '',
    hire_date: new Date().toISOString().split('T')[0],
    basic_salary: 0,
    tax_pin: '',
    nssf_number: '',
    nhif_number: '',
    bank_name: '',
    bank_account: ''
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
    closePayrollPeriod,
    loadPayrollRuns,
    generatePayrollForPeriod,
    approvePayrollRun,
    payPayrollRun,
    calculateEmployeePayroll,
    updatePayrollRun
  } = usePayroll();

  useEffect(() => {
    loadEmployees();
    loadDesignations();
  }, []);

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
      const response = await ApiService.get<Employee>('employees', {
        filters: { is_active: true }
      });
      
      if (response.success && response.data) {
        let filteredEmployees = response.data;
        
        if (searchTerm) {
          filteredEmployees = filteredEmployees.filter(employee =>
            `${employee.first_name} ${employee.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
            employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            employee.code.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }
        
        setEmployees(filteredEmployees);
      }
    } catch (error) {
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadEmployees();
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

  const handleViewPayrollDetails = async (payrollRun: PayrollRun) => {
    setSelectedPayrollRun(payrollRun);
    
    // Load deductions and allowances
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

  const getEmployeeStatus = (isActive: boolean) => {
    return isActive 
      ? { color: 'text-green-600', bg: 'bg-green-50', text: 'Active' }
      : { color: 'text-red-600', bg: 'bg-red-50', text: 'Inactive' };
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employee & Payroll Management</h1>
          <p className="text-gray-600">Manage your employees and process payroll</p>
        </div>
        <div className="flex space-x-3">
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
                  department: '',
                  hire_date: new Date().toISOString().split('T')[0],
                  basic_salary: 0,
                  tax_pin: '',
                  nssf_number: '',
                  nhif_number: '',
                  bank_name: '',
                  bank_account: ''
                });
                setShowModal(true);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Employee
            </button>
          )}
          {activeTab === 'payroll' && (
            <>
              <button
                onClick={() => setShowPayrollSettings(true)}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center"
              >
                <Settings className="h-4 w-4 mr-2" />
                Payroll Settings
              </button>
              <button
                onClick={handleGeneratePayroll}
                disabled={!currentPeriod || payrollLoading}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center"
              >
                <FileText className="h-4 w-4 mr-2" />
                Generate Payroll
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('employees')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'employees'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users className="h-4 w-4 inline mr-2" />
            Employees
          </button>
          <button
            onClick={() => setActiveTab('payroll')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'payroll'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <DollarSign className="h-4 w-4 inline mr-2" />
            Payroll
          </button>
        </nav>
      </div>

      {/* Employees Tab */}
      {activeTab === 'employees' && (
        <>
          {/* Search */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
            <div className="flex gap-4 items-center">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type="text"
                    placeholder="Search employees by name, email, or code..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <button
                onClick={handleSearch}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
              >
                Search
              </button>
            </div>
          </div>

          {/* Employees Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="min-w-[850px] w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Employee
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Code
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Position
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Salary
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {employees.map((employee) => {
                      const status = getEmployeeStatus(employee.is_active);
                      return (
                        <tr key={employee.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                                <User className="h-5 w-5 text-blue-600" />
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {employee.first_name} {employee.last_name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {employee.department || 'No department'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {employee.code}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{employee.email}</div>
                            <div className="text-sm text-gray-500">{employee.phone || 'No phone'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {employee.position || 'No position'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {settings?.default_currency || 'KES'} {employee.basic_salary?.toLocaleString() || '0'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${status.bg} ${status.color}`}>
                              {status.text}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => {
                                  setSelectedEmployee(employee);
                                  setShowEmployeePayrollForm(true);
                                }}
                                className="text-green-600 hover:text-green-900"
                                title="Payroll Info"
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
                                    hire_date: employee.hire_date || '',
                                    basic_salary: employee.basic_salary || 0,
                                    tax_pin: employee.tax_pin || '',
                                    nssf_number: employee.nssf_number || employee.nssf_no || '',
                                    nhif_number: employee.nhif_number || employee.nhif_no || '',
                                    bank_name: employee.bank_name || '',
                                    bank_account: employee.bank_account || ''
                                  });
                                  setShowModal(true);
                                }}
                                className="text-blue-600 hover:text-blue-900"
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(employee.id)}
                                className="text-red-600 hover:text-red-900"
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
            
            {!loading && employees.length === 0 && (
              <div className="text-center py-12">
                <User className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No employees found</h3>
                <p className="text-gray-500">Get started by adding your first employee.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Payroll Tab */}
      {activeTab === 'payroll' && (
        <div className="space-y-6">
          <PayrollDashboard
            currentPeriod={currentPeriod}
            payrollRuns={payrollRuns}
            onGeneratePayroll={handleGeneratePayroll}
            onOpenSettings={() => setShowPayrollSettings(true)}
            onViewReports={() => {}} // Could link to a reports page if implemented
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <PayrollPeriods
                periods={payrollPeriods}
                onCreatePeriod={createPayrollPeriod}
                onClosePeriod={closePayrollPeriod}
                onSelectPeriod={(period) => {
                  setCurrentPeriod(period);
                  loadPayrollRuns(period.id);
                }}
                selectedPeriod={currentPeriod}
              />
            </div>
            <div className="lg:col-span-2">
              {currentPeriod && (
                <PayrollRuns
                  payrollRuns={payrollRuns}
                  onApproveRun={approvePayrollRun}
                  onPayRun={payPayrollRun}
                  onViewRun={handleViewPayrollDetails}
                  onEditRun={handleEditPayrollRun}
                  periodStatus={currentPeriod.status}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Employee Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {selectedEmployee ? 'Edit Employee' : 'Add New Employee'}
              </h3>
              
              <form className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={employeeFormData.first_name}
                      onChange={(e) => setEmployeeFormData(prev => ({ ...prev, first_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={employeeFormData.last_name}
                      onChange={(e) => setEmployeeFormData(prev => ({ ...prev, last_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Employee Code
                  </label>
                  <input
                    type="text"
                    value={employeeFormData.code}
                    onChange={(e) => setEmployeeFormData(prev => ({ ...prev, code: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Auto-generated if empty"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={employeeFormData.email}
                    onChange={(e) => setEmployeeFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={employeeFormData.phone}
                    onChange={(e) => setEmployeeFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Position
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select Position</option>
                        {designations.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Department
                    </label>
                    <input
                      type="text"
                      value={employeeFormData.department}
                      onChange={(e) => setEmployeeFormData(prev => ({ ...prev, department: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hire Date
                  </label>
                  <input
                    type="date"
                    value={employeeFormData.hire_date}
                    onChange={(e) => setEmployeeFormData(prev => ({ ...prev, hire_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Basic Salary ({settings?.default_currency || 'KES'})
                  </label>
                  <input
                    type="number"
                    value={employeeFormData.basic_salary}
                    onChange={(e) => setEmployeeFormData(prev => ({ ...prev, basic_salary: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tax PIN
                    </label>
                    <input
                      type="text"
                      value={employeeFormData.tax_pin}
                      onChange={(e) => setEmployeeFormData(prev => ({ ...prev, tax_pin: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      NSSF Number
                    </label>
                    <input
                      type="text"
                      value={employeeFormData.nssf_number}
                      onChange={(e) => setEmployeeFormData(prev => ({ ...prev, nssf_number: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      NHIF/SHA Number
                    </label>
                    <input
                      type="text"
                      value={employeeFormData.nhif_number}
                      onChange={(e) => setEmployeeFormData(prev => ({ ...prev, nhif_number: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      value={employeeFormData.bank_name}
                      onChange={(e) => setEmployeeFormData(prev => ({ ...prev, bank_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bank Account Number
                  </label>
                  <input
                    type="text"
                    value={employeeFormData.bank_account}
                    onChange={(e) => setEmployeeFormData(prev => ({ ...prev, bank_account: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </form>
              
              <div className="flex justify-end space-x-3 mt-6 pb-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {selectedEmployee ? 'Update' : 'Add'} Employee
                </button>
              </div>
            </div>
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

      {/* Payroll Details Modal */}
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
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
            <EmployeePayrollForm
              employee={selectedEmployee}
              onSave={handleSaveEmployeePayroll}
              onClose={() => setShowEmployeePayrollForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Employees; 