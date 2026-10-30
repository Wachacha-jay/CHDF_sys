import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Shield, Key, Plus, Search, Edit2, Trash2, CheckCircle, 
  XCircle, UserPlus, Fingerprint, Lock, ShieldCheck, UserCheck,
  LayoutDashboard, ShoppingCart, Package, Receipt, DollarSign,
  BookOpen, HeartHandshake, Settings, Activity, Check, Filter,
  RefreshCw, AlertCircle, Info, Sliders, Eye, Sparkles
} from 'lucide-react';
import { ApiService } from '../services/api';
import { User, Role, Permission, Employee } from '../types';
import { useAuthContext } from '../contexts/useAuthContext';
import toast from 'react-hot-toast';

interface ModularGroupConfig {
  id: string;
  name: string;
  sidebarGroup: string;
  icon: any;
  accent: {
    bg: string;
    text: string;
    border: string;
    badge: string;
    header: string;
  };
  description: string;
  matcher: (p: Permission) => boolean;
}

const MODULAR_GROUPS: ModularGroupConfig[] = [
  {
    id: 'dashboard',
    name: 'Core Dashboard',
    sidebarGroup: 'Dashboard',
    icon: LayoutDashboard,
    accent: {
      bg: 'bg-indigo-50',
      text: 'text-indigo-700',
      border: 'border-indigo-200',
      badge: 'bg-indigo-100 text-indigo-800',
      header: 'bg-indigo-50/70'
    },
    description: 'Executive KPI dashboards, statistics & enterprise overview metrics',
    matcher: (p) => p.name === 'dashboard_view' || p.module === 'Core' || p.module === 'Dashboard'
  },
  {
    id: 'pos',
    name: 'Point of Sale (POS)',
    sidebarGroup: 'Point of Sale',
    icon: ShoppingCart,
    accent: {
      bg: 'bg-sky-50',
      text: 'text-sky-700',
      border: 'border-sky-200',
      badge: 'bg-sky-100 text-sky-800',
      header: 'bg-sky-50/70'
    },
    description: 'Cash register terminal, retail checkout & front-counter operations',
    matcher: (p) => p.name.startsWith('pos_') || p.module === 'Point of Sale' || p.module === 'POS'
  },
  {
    id: 'inventory',
    name: 'Inventory & Stock Management',
    sidebarGroup: 'Inventory',
    icon: Package,
    accent: {
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-200',
      badge: 'bg-amber-100 text-amber-800',
      header: 'bg-amber-50/70'
    },
    description: 'Catalog products, inventory levels, stock adjustments & physical counts',
    matcher: (p) => p.name.startsWith('inventory_') || p.module === 'Inventory'
  },
  {
    id: 'sales',
    name: 'Sales & Invoicing',
    sidebarGroup: 'Invoices',
    icon: Receipt,
    accent: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
      border: 'border-emerald-200',
      badge: 'bg-emerald-100 text-emerald-800',
      header: 'bg-emerald-50/70'
    },
    description: 'Sales orders, customer invoices, quote conversion & credit notes',
    matcher: (p) => p.name.startsWith('sales_') || p.name === 'invoices_view' || p.module === 'Sales & Invoicing' || p.module === 'Sales'
  },
  {
    id: 'expenses',
    name: 'Expenses & Disbursements',
    sidebarGroup: 'Expenses',
    icon: DollarSign,
    accent: {
      bg: 'bg-rose-50',
      text: 'text-rose-800',
      border: 'border-rose-200',
      badge: 'bg-rose-100 text-rose-800',
      header: 'bg-rose-50/70'
    },
    description: 'Operational expenses, claim submissions & Checker verification workflow',
    matcher: (p) => p.name.startsWith('expenses_') || p.module === 'Expenses'
  },
  {
    id: 'accounting',
    name: 'Accounting & Financial Ledger',
    sidebarGroup: 'Accounting',
    icon: BookOpen,
    accent: {
      bg: 'bg-blue-50',
      text: 'text-blue-800',
      border: 'border-blue-200',
      badge: 'bg-blue-100 text-blue-800',
      header: 'bg-blue-50/70'
    },
    description: 'General Ledger, Chart of Accounts, Trial Balance, Bank Recon & Fixed Assets',
    matcher: (p) => p.name.startsWith('accounting_') || p.name.startsWith('chart_of_accounts_') || 
                    p.name.startsWith('journal_entries_') || p.name.startsWith('bank_recon') || 
                    p.name.startsWith('fixed_assets_') || p.module === 'Accounting'
  },
  {
    id: 'funds',
    name: 'Fund Accounting (NGO Programs)',
    sidebarGroup: 'Fund Accounting',
    icon: HeartHandshake,
    accent: {
      bg: 'bg-purple-50',
      text: 'text-purple-800',
      border: 'border-purple-200',
      badge: 'bg-purple-100 text-purple-800',
      header: 'bg-purple-50/70'
    },
    description: 'Restricted fund balances, donations, child support fees, internal transfers & NGO billing',
    matcher: (p) => p.name.startsWith('donations_') || p.name.startsWith('child_support_') || 
                    p.name.startsWith('transfers_') || p.name.startsWith('fund_') || 
                    p.name.startsWith('children_') || p.name === 'school_fees_view' || 
                    p.module === 'Fund Accounting' || p.module === 'Donations' || 
                    p.module === 'Child Support' || p.module === 'Internal Transfers' || p.module === 'Fund Setup'
  },
  {
    id: 'crm',
    name: 'CRM & Vendors (AR / AP)',
    sidebarGroup: 'CRM & Vendors',
    icon: Users,
    accent: {
      bg: 'bg-cyan-50',
      text: 'text-cyan-800',
      border: 'border-cyan-200',
      badge: 'bg-cyan-100 text-cyan-800',
      header: 'bg-cyan-50/70'
    },
    description: 'Customer Accounts Receivable, Supplier Accounts Payable & Purchase Orders',
    matcher: (p) => p.name.startsWith('customers_') || p.name.startsWith('suppliers_') || 
                    p.name.startsWith('purchases_') || p.module === 'CRM & Vendors' || 
                    p.module === 'Customers' || p.module === 'Suppliers' || p.module === 'Purchases'
  },
  {
    id: 'hr_payroll',
    name: 'HR & Payroll Operations',
    sidebarGroup: 'HR & Payroll',
    icon: UserCheck,
    accent: {
      bg: 'bg-teal-50',
      text: 'text-teal-800',
      border: 'border-teal-200',
      badge: 'bg-teal-100 text-teal-800',
      header: 'bg-teal-50/70'
    },
    description: 'Staff directory, salary profiles, monthly payroll runs & statutory deduction slips',
    matcher: (p) => p.name.startsWith('employees_') || p.name.startsWith('payroll_') || 
                    p.module === 'HR & Payroll' || p.module === 'Employees' || p.module === 'Payroll'
  },
  {
    id: 'security_logs',
    name: 'Security & System Audit Logs',
    sidebarGroup: 'Security & Logs',
    icon: Shield,
    accent: {
      bg: 'bg-violet-50',
      text: 'text-violet-800',
      border: 'border-violet-200',
      badge: 'bg-violet-100 text-violet-800',
      header: 'bg-violet-50/70'
    },
    description: 'Role-Based Access Control matrix, user management & immutable activity audit logs',
    matcher: (p) => p.name === 'user_management_manage' || p.name === 'audit_logs_view' || 
                    p.module === 'Security & Logs' || p.module === 'User Management'
  },
  {
    id: 'settings_reports',
    name: 'Settings & Operational Reports',
    sidebarGroup: 'Settings',
    icon: Settings,
    accent: {
      bg: 'bg-slate-100',
      text: 'text-slate-800',
      border: 'border-slate-300',
      badge: 'bg-slate-200 text-slate-800',
      header: 'bg-slate-100/70'
    },
    description: 'Company profiles, system parameters, fiscal defaults & analytical report views',
    matcher: (p) => p.name === 'settings_manage' || p.name === 'reports_view' || 
                    p.module === 'Settings & Reports' || p.module === 'Settings' || p.module === 'Reports'
  }
];

const UserManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  // Modals
  const [showUserModal, setShowUserModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Selection
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [rolePerms, setRolePerms] = useState<string[]>([]);
  const [originalPerms, setOriginalPerms] = useState<string[]>([]);
  
  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [permSearchTerm, setPermSearchTerm] = useState('');
  const [permActionFilter, setPermActionFilter] = useState<'all' | 'view' | 'maker' | 'checker' | 'manage'>('all');
  
  // Action Loading states
  const [savingUser, setSavingUser] = useState(false);
  const [savingRights, setSavingRights] = useState(false);
  const [togglingStatusId, setTogglingStatusId] = useState<string | null>(null);
  
  // Form States
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    password: '',
    role_id: '',
    employee_id: '',
    first_name: '',
    last_name: '',
    is_active: 1
  });

  const [roleForm, setRoleForm] = useState({
    name: '',
    description: ''
  });

  const { user: currentUser, register: registerUser } = useAuthContext();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [uRes, rRes, pRes, eRes] = await Promise.all([
        ApiService.get<User>('users'),
        ApiService.get<Role>('roles'),
        ApiService.get<Permission>('permissions'),
        ApiService.get<Employee>('employees')
      ]);

      if (uRes.success) setUsers(uRes.data || []);
      if (rRes.success) {
        const sortedRoles = (rRes.data || []).sort((a, b) => {
          if (a.name === 'Super Admin') return -1;
          if (b.name === 'Super Admin') return 1;
          if (a.is_system && !b.is_system) return -1;
          return 0;
        });
        setRoles(sortedRoles);
        if (sortedRoles.length > 0 && !selectedRole) {
          setSelectedRole(sortedRoles[0]);
          loadRolePermissions(sortedRoles[0].id);
        }
      }
      if (pRes.success) setPermissions(pRes.data || []);
      if (eRes.success) setEmployees(eRes.data || []);
    } catch (error) {
      toast.error('Failed to load access control data');
    } finally {
      setLoading(false);
    }
  };

  const loadRolePermissions = async (roleId: string) => {
    try {
      const response = await ApiService.get<Permission>(`roles/${roleId}/permissions`);
      if (response.success) {
        const ids = response.data?.map(p => p.id) || [];
        setRolePerms(ids);
        setOriginalPerms(ids);
      }
    } catch (error) {
      toast.error('Failed to load role permissions');
    }
  };

  const handleSelectRole = (role: Role) => {
    setSelectedRole(role);
    loadRolePermissions(role.id);
  };

  // Group permissions strictly by modular groups matching the Sidebar
  const modularSections = useMemo(() => {
    const unassigned: Permission[] = [];
    const grouped = MODULAR_GROUPS.map(group => {
      const groupPerms = permissions.filter(p => group.matcher(p));
      return {
        ...group,
        permissions: groupPerms
      };
    });

    // Check for any unassigned permissions
    permissions.forEach(p => {
      const matched = MODULAR_GROUPS.some(g => g.matcher(p));
      if (!matched) unassigned.push(p);
    });

    if (unassigned.length > 0) {
      const otherGroup = grouped.find(g => g.id === 'settings_reports');
      if (otherGroup) {
        otherGroup.permissions.push(...unassigned);
      }
    }

    return grouped;
  }, [permissions]);

  // Statistics
  const stats = useMemo(() => {
    const totalUsers = users.length;
    const activeUsers = users.filter(u => (u as any).is_active === 1 || (u as any).is_active === true || (u as any).is_active === undefined).length;
    const inactiveUsers = totalUsers - activeUsers;
    const totalRoles = roles.length;
    const totalPermissions = permissions.length;
    return { totalUsers, activeUsers, inactiveUsers, totalRoles, totalPermissions };
  }, [users, roles, permissions]);

  // User Add/Edit Handlers
  const handleOpenAddUser = () => {
    setSelectedUser(null);
    setUserForm({
      username: '',
      email: '',
      password: '',
      role_id: roles.find(r => r.name !== 'Super Admin')?.id || roles[0]?.id || '',
      employee_id: '',
      first_name: '',
      last_name: '',
      is_active: 1
    });
    setShowUserModal(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    let firstName = user.first_name || '';
    let lastName = user.last_name || '';
    if (!firstName && !lastName && user.name) {
      const parts = user.name.split(' ');
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }
    setUserForm({
      username: user.username || '',
      email: user.email || '',
      password: '', // Blank unless admin intends to change password
      role_id: (user as any).role_id || '',
      employee_id: (user as any).employee_id || '',
      first_name: firstName,
      last_name: lastName,
      is_active: (user as any).is_active === 0 || (user as any).is_active === false ? 0 : 1
    });
    setShowUserModal(true);
  };

  const handleToggleUserStatus = async (user: User) => {
    if (user.id === currentUser?.id) {
      toast.error('You cannot deactivate your own logged-in account.');
      return;
    }

    const currentStatus = (user as any).is_active === 0 || (user as any).is_active === false ? 0 : 1;
    const newStatus = currentStatus === 1 ? 0 : 1;
    setTogglingStatusId(user.id);

    try {
      const response = await ApiService.update('users', user.id, { is_active: newStatus });
      if (response.success) {
        toast.success(newStatus === 1 ? 'User account activated' : 'User account suspended');
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: newStatus } : u));
      } else {
        toast.error(response.error || 'Failed to update account status');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error updating account status');
    } finally {
      setTogglingStatusId(null);
    }
  };

  const handleEmployeeSelect = (empId: string) => {
    const emp = employees.find(e => e.id === empId);
    if (emp) {
      setUserForm(prev => ({
        ...prev,
        employee_id: emp.id,
        first_name: emp.first_name || prev.first_name,
        last_name: emp.last_name || prev.last_name,
        email: emp.email || prev.email,
        username: prev.username || (emp.email ? emp.email.split('@')[0] : `${emp.first_name}.${emp.last_name}`.toLowerCase())
      }));
    } else {
      setUserForm(prev => ({ ...prev, employee_id: '' }));
    }
  };

  const handleSaveUser = async () => {
    const cleanEmail = userForm.email.trim().toLowerCase();
    const cleanUsername = userForm.username.trim().toLowerCase();

    if (!cleanEmail || !cleanUsername) {
      toast.error('Official email and username are required');
      return;
    }

    if (!selectedUser && (!userForm.password || userForm.password.length < 6)) {
      toast.error('Password is required and must be at least 6 characters');
      return;
    }

    if (selectedUser && userForm.password && userForm.password.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }

    setSavingUser(true);
    try {
      if (selectedUser) {
        const payload: any = {
          first_name: userForm.first_name.trim(),
          last_name: userForm.last_name.trim(),
          username: cleanUsername,
          email: cleanEmail,
          role_id: userForm.role_id || null,
          employee_id: userForm.employee_id || null,
          is_active: userForm.is_active
        };
        if (userForm.password && userForm.password.trim() !== '') {
          payload.password = userForm.password.trim();
        }

        const response = await ApiService.update('users', selectedUser.id, payload);
        if (response.success) {
          toast.success('User credentials and role updated successfully');
          setShowUserModal(false);
          loadData();
        } else {
          toast.error(response.error || 'Failed to update user');
        }
      } else {
        const response = await registerUser({
          email: cleanEmail,
          username: cleanUsername,
          password: userForm.password,
          role_id: userForm.role_id,
          employee_id: userForm.employee_id || undefined,
          first_name: userForm.first_name.trim(),
          last_name: userForm.last_name.trim(),
          is_active: userForm.is_active
        });
        if (response.success) {
          toast.success('User registered and permissions provisioned successfully');
          setShowUserModal(false);
          loadData();
        } else {
          toast.error(response.error || 'User registration failed');
        }
      }
    } catch (error: any) {
      toast.error(error?.message || 'Error saving user');
    } finally {
      setSavingUser(false);
    }
  };

  const handlePromptDeleteUser = (user: User) => {
    if (user.id === currentUser?.id) {
      toast.error('You cannot delete your own logged-in account.');
      return;
    }
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      const response = await ApiService.delete('users', userToDelete.id);
      if (response.success) {
        if ((response as any).message) {
          toast.success((response as any).message);
        } else {
          toast.success('User account removed successfully');
        }
        setShowDeleteModal(false);
        setUserToDelete(null);
        loadData();
      } else {
        toast.error(response.error || 'Failed to delete user');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Error deleting user');
    }
  };

  // Role Handlers
  const handleSaveRole = async () => {
    if (!roleForm.name.trim()) {
      toast.error('Please enter a role name');
      return;
    }
    try {
      const response = await ApiService.create<Role>('roles', {
        name: roleForm.name.trim(),
        description: roleForm.description.trim(),
        is_system: false
      });
      if (response.success) {
        toast.success(`Role '${roleForm.name}' created. You can now configure its permissions.`);
        setShowRoleModal(false);
        setRoleForm({ name: '', description: '' });
        loadData();
      } else {
        toast.error(response.error || 'Failed to create role');
      }
    } catch (error) {
      toast.error('Error creating role');
    }
  };

  // Permissions Preset & Matrix Handlers
  const togglePermission = (permId: string) => {
    setRolePerms(prev => 
      prev.includes(permId) ? prev.filter(id => id !== permId) : [...prev, permId]
    );
  };

  const handleApplyModulePreset = (groupPerms: Permission[], preset: 'all' | 'none' | 'view' | 'maker' | 'checker') => {
    const groupPermIds = groupPerms.map(p => p.id);
    let targetPermIds: string[] = [];

    if (preset === 'all') {
      targetPermIds = groupPermIds;
    } else if (preset === 'none') {
      targetPermIds = [];
    } else if (preset === 'view') {
      targetPermIds = groupPerms.filter(p => p.action === 'view' || p.name.endsWith('_view')).map(p => p.id);
    } else if (preset === 'maker') {
      targetPermIds = groupPerms.filter(p => 
        p.action === 'view' || p.action === 'create' || 
        p.name.endsWith('_view') || p.name.includes('_record') || p.name.includes('_create')
      ).map(p => p.id);
    } else if (preset === 'checker') {
      targetPermIds = groupPerms.filter(p => 
        p.action === 'view' || p.action === 'approve' || 
        p.name.endsWith('_view') || p.name.includes('_post') || p.name.includes('_approve')
      ).map(p => p.id);
    }

    setRolePerms(prev => {
      const filtered = prev.filter(id => !groupPermIds.includes(id));
      return [...filtered, ...targetPermIds];
    });

    toast.success(`Applied '${preset.toUpperCase()}' rights preset for this module`);
  };

  const handleGrantAllSystemRights = () => {
    setRolePerms(permissions.map(p => p.id));
    toast.success('Granted all system rights to this role');
  };

  const handleRevokeAllRights = () => {
    setRolePerms([]);
    toast.success('Revoked all rights for this role');
  };

  const handleSaveRolePermissions = async () => {
    if (!selectedRole) return;
    setSavingRights(true);
    try {
      const response = await ApiService.create(`roles/${selectedRole.id}/permissions`, {
        permissionIds: rolePerms
      });
      if (response.success) {
        setOriginalPerms(rolePerms);
        toast.success(`Permissions for role '${selectedRole.name}' saved successfully`);
      } else {
        toast.error(response.error || 'Failed to save permissions');
      }
    } catch (error) {
      toast.error('Failed to save permissions');
    } finally {
      setSavingRights(false);
    }
  };

  const isRightsDirty = useMemo(() => {
    if (rolePerms.length !== originalPerms.length) return true;
    const setA = new Set(rolePerms);
    return originalPerms.some(id => !setA.has(id));
  }, [rolePerms, originalPerms]);

  // Filtering System Users
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const term = searchTerm.toLowerCase().trim();
      const displayName = (user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || '').toLowerCase();
      const username = (user.username || '').toLowerCase();
      const email = (user.email || '').toLowerCase();
      const role = roles.find(r => r.id === (user as any).role_id)?.name?.toLowerCase() || '';

      const matchesSearch = !term || displayName.includes(term) || username.includes(term) || email.includes(term) || role.includes(term);

      const isActive = (user as any).is_active === 1 || (user as any).is_active === true || (user as any).is_active === undefined;
      const matchesStatus = 
        statusFilter === 'all' ? true :
        statusFilter === 'active' ? isActive : !isActive;

      return matchesSearch && matchesStatus;
    });
  }, [users, searchTerm, statusFilter, roles]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Enterprise Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Security &amp; Access Control (RBAC)</h1>
              <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
                Enterprise user accounts, modular permission matrix aligned with system navigation, and Maker-Checker segregation of duties.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button 
            onClick={loadData}
            title="Refresh access control data"
            className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:text-indigo-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
          <button 
            onClick={handleOpenAddUser}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm shadow-indigo-600/20 text-sm font-semibold transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add User Account</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Total Accounts</p>
            <p className="text-xl font-bold text-gray-900">{stats.totalUsers}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Active Logins</p>
            <p className="text-xl font-bold text-emerald-600">{stats.activeUsers}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Deactivated</p>
            <p className="text-xl font-bold text-rose-600">{stats.inactiveUsers}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Defined Roles</p>
            <p className="text-xl font-bold text-purple-600">{stats.totalRoles}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-2">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'users' 
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-xl' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Users className="w-4 h-4" />
          System Users &amp; Credentials
          <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700 font-bold">
            {stats.totalUsers}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'roles' 
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-xl' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Key className="w-4 h-4" />
          Roles &amp; Modular Rights Matrix
          <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-700 font-bold">
            {MODULAR_GROUPS.length} Modules
          </span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: SYSTEM USERS */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'users' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Filter Bar */}
          <div className="p-4 bg-gray-50/80 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, username, email, or role..." 
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm transition-all shadow-sm"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500">Filter Status:</span>
              <div className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5 shadow-sm text-xs font-medium">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    statusFilter === 'all' ? 'bg-indigo-600 text-white font-bold' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All ({stats.totalUsers})
                </button>
                <button
                  onClick={() => setStatusFilter('active')}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    statusFilter === 'active' ? 'bg-emerald-600 text-white font-bold' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Active ({stats.activeUsers})
                </button>
                <button
                  onClick={() => setStatusFilter('inactive')}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    statusFilter === 'inactive' ? 'bg-rose-600 text-white font-bold' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Deactivated ({stats.inactiveUsers})
                </button>
              </div>
            </div>
          </div>

          {/* User Accounts Table */}
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left min-w-[750px]">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-semibold border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3.5">User Identity</th>
                  <th className="px-6 py-3.5">Login Username</th>
                  <th className="px-6 py-3.5">Assigned Role</th>
                  <th className="px-6 py-3.5">Account Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      <div className="max-w-sm mx-auto space-y-2">
                        <Users className="w-10 h-10 text-gray-300 mx-auto" />
                        <p className="font-semibold text-gray-700">No matching user accounts</p>
                        <p className="text-xs text-gray-400">Try adjusting your search criteria or register a new user account.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(user => {
                    const role = roles.find(r => r.id === (user as any).role_id);
                    const isCurrentUser = user.id === currentUser?.id;
                    const displayName = user.name || [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || user.email;
                    const isActive = (user as any).is_active === 1 || (user as any).is_active === true || (user as any).is_active === undefined;
                    const isEmployee = Boolean((user as any).employee_id);

                    return (
                      <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
                              {displayName.charAt(0).toUpperCase() || '?'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-gray-900">{displayName}</p>
                                {isCurrentUser && (
                                  <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wide">
                                    You
                                  </span>
                                )}
                                {isEmployee && (
                                  <span className="text-[10px] bg-teal-50 text-teal-700 border border-teal-200 px-1.5 py-0.5 rounded font-medium">
                                    Staff Linked
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-xs bg-slate-100 text-slate-800 px-2 py-1 rounded-md border border-slate-200">
                            {user.username || '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                            role?.name === 'Super Admin' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                            role?.name === 'Admin' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                            role?.name === 'Finance Manager' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                            role?.name === 'Accountant' ? 'bg-sky-100 text-sky-800 border border-sky-200' :
                            role?.name === 'Data Entry Officer' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                            role?.name === 'Cashier' ? 'bg-rose-100 text-rose-800 border border-rose-200' : 
                            'bg-gray-100 text-gray-700 border border-gray-200'
                          }`}>
                            <Shield className="w-3 h-3" />
                            {role?.name || 'Unassigned Role'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            type="button"
                            onClick={() => handleToggleUserStatus(user)}
                            disabled={isCurrentUser || togglingStatusId === user.id}
                            title={isCurrentUser ? "You cannot modify your own login status" : isActive ? "Click to suspend account login" : "Click to enable account login"}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                              isActive 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' 
                                : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                            } ${isCurrentUser ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                          >
                            {togglingStatusId === user.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : isActive ? (
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 text-red-600" />
                            )}
                            {isActive ? 'Active (Allowed)' : 'Deactivated'}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end items-center gap-1">
                            <button 
                              type="button"
                              onClick={() => handleEditUser(user)}
                              title="Edit User Profile & Credentials"
                              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              type="button"
                              onClick={() => handlePromptDeleteUser(user)}
                              title={isCurrentUser ? "You cannot delete your own logged-in account" : "Delete User Account"}
                              disabled={isCurrentUser}
                              className={`p-2 rounded-lg transition-colors ${
                                isCurrentUser 
                                  ? 'text-gray-200 cursor-not-allowed opacity-50' 
                                  : 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                              }`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ─────────────────────────────────────────────────────────────────── */
        /* TAB 2: ROLES & MODULAR RIGHTS MATRIX (ALIGNED WITH SIDEBAR) */
        /* ─────────────────────────────────────────────────────────────────── */
        <div className="grid grid-cols-12 gap-6 items-start">
          {/* Left Column: Roles Selection */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-600" />
                    Role Profiles
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">Select a role to configure granular modular rights</p>
                </div>
                <button 
                  onClick={() => setShowRoleModal(true)}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                >
                  <Plus size={14} /> New Role
                </button>
              </div>

              <div className="space-y-2">
                {roles.map(role => {
                  const isSelected = selectedRole?.id === role.id;
                  const assignedCount = users.filter(u => (u as any).role_id === role.id).length;

                  return (
                    <button
                      key={role.id}
                      onClick={() => handleSelectRole(role)}
                      className={`w-full text-left p-4 rounded-xl border transition-all relative ${
                        isSelected 
                          ? 'border-indigo-600 bg-indigo-50/70 shadow-sm' 
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/80'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 text-sm">{role.name}</span>
                            {role.is_system ? (
                              <span className="bg-slate-100 text-slate-600 text-[10px] uppercase px-1.5 py-0.5 rounded font-extrabold border border-slate-200">
                                System
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                            {role.description || 'Standard corporate profile with customizable privileges.'}
                          </p>
                        </div>
                        <span className="text-[11px] font-semibold bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full shrink-0">
                          {assignedCount} {assignedCount === 1 ? 'user' : 'users'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Modular Permissions Matrix Matching Sidebar */}
          <div className="col-span-12 lg:col-span-8 space-y-4">
            {selectedRole ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                {/* Header with Role Details and Save Action */}
                <div className="p-5 bg-gradient-to-r from-gray-50 to-indigo-50/30 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Configuring Rights For:</span>
                      <span className="text-base font-extrabold text-indigo-600 bg-indigo-100/70 px-2.5 py-0.5 rounded-lg border border-indigo-200">
                        {selectedRole.name}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Privileges are grouped to match the <strong>Enterprise Navigation Sidebar</strong> modules.
                    </p>
                  </div>

                  {selectedRole.name !== 'Super Admin' && (
                    <div className="flex items-center gap-2">
                      {isRightsDirty && (
                        <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg animate-pulse">
                          Unsaved changes
                        </span>
                      )}
                      <button 
                        onClick={handleSaveRolePermissions}
                        disabled={savingRights}
                        className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 text-sm shadow-md shadow-indigo-600/20 transition-all disabled:opacity-60"
                      >
                        {savingRights ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Lock className="w-4 h-4" />
                        )}
                        <span>Save Rights</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Super Admin Notice or Modular Accordion List */}
                {selectedRole.name === 'Super Admin' ? (
                  <div className="p-12 text-center bg-indigo-50/40 m-6 rounded-2xl border border-indigo-100 flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 mb-4">
                      <ShieldCheck className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-indigo-900">Total System Access Override</h3>
                    <p className="text-sm text-indigo-700/80 mt-2 max-w-md leading-relaxed">
                      The <strong>Super Admin</strong> role automatically bypasses all permission checks across every table, API route, and user interface element. Rights cannot be restricted for this role.
                    </p>
                  </div>
                ) : (
                  <div className="p-6 space-y-6">
                    {/* Filter and Global Presets */}
                    <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                        <input
                          type="text"
                          value={permSearchTerm}
                          onChange={(e) => setPermSearchTerm(e.target.value)}
                          placeholder="Filter rights by keyword..."
                          className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={handleGrantAllSystemRights}
                          className="px-2.5 py-1.5 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 transition-colors shadow-sm"
                        >
                          Grant All
                        </button>
                        <button
                          type="button"
                          onClick={handleRevokeAllRights}
                          className="px-2.5 py-1.5 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 transition-colors shadow-sm"
                        >
                          Revoke All
                        </button>
                      </div>
                    </div>

                    {/* Modular Group Cards */}
                    <div className="space-y-5">
                      {modularSections.map(group => {
                        const filteredGroupPerms = group.permissions.filter(p => {
                          if (!permSearchTerm.trim()) return true;
                          const t = permSearchTerm.toLowerCase();
                          return p.name.toLowerCase().includes(t) || 
                                 (p.description || '').toLowerCase().includes(t) ||
                                 group.name.toLowerCase().includes(t);
                        });

                        if (filteredGroupPerms.length === 0 && permSearchTerm.trim()) {
                          return null;
                        }

                        const grantedCount = group.permissions.filter(p => rolePerms.includes(p.id)).length;
                        const totalCount = group.permissions.length;
                        const percent = totalCount > 0 ? Math.round((grantedCount / totalCount) * 100) : 0;
                        const isFullyGranted = grantedCount === totalCount && totalCount > 0;
                        const isPartiallyGranted = grantedCount > 0 && grantedCount < totalCount;

                        const GroupIcon = group.icon;

                        return (
                          <div 
                            key={group.id} 
                            className={`rounded-2xl border transition-all overflow-hidden ${
                              isFullyGranted ? 'border-indigo-300 shadow-sm' :
                              isPartiallyGranted ? 'border-gray-300' : 'border-gray-200'
                            }`}
                          >
                            {/* Module Card Header */}
                            <div className={`p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${group.accent.header}`}>
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 ${group.accent.bg} ${group.accent.text} border ${group.accent.border}`}>
                                  <GroupIcon className="w-5 h-5" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-gray-900 text-sm">{group.name}</h4>
                                    <span className="text-[10px] bg-white border border-gray-200 text-gray-500 font-semibold px-2 py-0.5 rounded-full">
                                      Sidebar: {group.sidebarGroup}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-0.5">{group.description}</p>
                                </div>
                              </div>

                              {/* Progress & Presets */}
                              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                                  isFullyGranted 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                    : isPartiallyGranted 
                                    ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                    : 'bg-gray-100 text-gray-500 border-gray-200'
                                }`}>
                                  {grantedCount} / {totalCount} Granted ({percent}%)
                                </span>

                                {/* Module quick-presets */}
                                <div className="inline-flex rounded-lg border border-gray-300 bg-white shadow-sm text-[11px] font-semibold divide-x divide-gray-200">
                                  <button
                                    type="button"
                                    onClick={() => handleApplyModulePreset(group.permissions, 'all')}
                                    title="Grant all rights in this module"
                                    className="px-2 py-1 hover:bg-gray-100 text-indigo-600"
                                  >
                                    All
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleApplyModulePreset(group.permissions, 'view')}
                                    title="Grant Read-Only (view) rights"
                                    className="px-2 py-1 hover:bg-gray-100 text-gray-700"
                                  >
                                    Read
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleApplyModulePreset(group.permissions, 'maker')}
                                    title="Grant Maker (View + Record/Create) rights"
                                    className="px-2 py-1 hover:bg-gray-100 text-blue-700"
                                  >
                                    Maker
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleApplyModulePreset(group.permissions, 'checker')}
                                    title="Grant Checker (View + Approve/Post GL) rights"
                                    className="px-2 py-1 hover:bg-gray-100 text-emerald-700"
                                  >
                                    Checker
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleApplyModulePreset(group.permissions, 'none')}
                                    title="Clear all rights in this module"
                                    className="px-2 py-1 hover:bg-gray-100 text-red-600"
                                  >
                                    Clear
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Permissions list in this module */}
                            <div className="divide-y divide-gray-100 bg-white">
                              {filteredGroupPerms.map(p => {
                                const isGranted = rolePerms.includes(p.id);
                                const isMaker = p.action === 'create' || p.name.includes('_record') || p.name.includes('_create');
                                const isChecker = p.action === 'approve' || p.name.includes('_post') || p.name.includes('_approve');
                                const isDelete = p.action === 'delete' || p.name.includes('_delete');
                                const isManage = p.action === 'manage' || p.name.includes('_manage');

                                return (
                                  <div 
                                    key={p.id}
                                    onClick={() => togglePermission(p.id)}
                                    className="flex items-center justify-between p-4 hover:bg-slate-50/80 cursor-pointer transition-colors"
                                  >
                                    <div className="space-y-1 pr-4">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-semibold text-gray-900 text-sm capitalize">
                                          {p.name.split('_').join(' ')}
                                        </p>
                                        <span className="font-mono text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">
                                          {p.name}
                                        </span>
                                        {isMaker && (
                                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-100 text-blue-800 uppercase tracking-wider">
                                            Maker (Draft / Submit)
                                          </span>
                                        )}
                                        {isChecker && (
                                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                                            Checker (Approve / Post GL)
                                          </span>
                                        )}
                                        {isManage && (
                                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-purple-100 text-purple-800 uppercase tracking-wider">
                                            Manager (Full Access)
                                          </span>
                                        )}
                                        {isDelete && (
                                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-red-100 text-red-800 uppercase tracking-wider">
                                            Void / Delete
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-gray-500 leading-relaxed">
                                        {p.description || `Grants access to ${p.name}`}
                                      </p>
                                    </div>

                                    {/* Toggle switch */}
                                    <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                                      <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                          type="checkbox" 
                                          className="sr-only peer"
                                          checked={isGranted}
                                          onChange={() => togglePermission(p.id)}
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                      </label>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-16 text-center">
                <Fingerprint className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h4 className="font-bold text-gray-900 text-base">Select a Role Profile</h4>
                <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                  Choose a role from the left list to view and configure its modular privileges.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: ADD / EDIT SYSTEM USER */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {showUserModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {selectedUser ? 'Edit System Account' : 'Register New System Account'}
                  </h2>
                  <p className="text-xs text-gray-500">Configure corporate identity, assigned role &amp; login status</p>
                </div>
              </div>
              <button 
                onClick={() => setShowUserModal(false)}
                className="p-2 hover:bg-gray-200 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
              {/* Employee Link Dropdown */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-700" />
                  <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">Link to Employee Profile</h4>
                </div>
                <p className="text-xs text-amber-800/80 leading-relaxed">
                  Linking an employee automatically synchronizes their full name, department, and contact info. Leave blank for system administrator accounts.
                </p>
                <select
                  value={userForm.employee_id}
                  onChange={(e) => handleEmployeeSelect(e.target.value)}
                  className="w-full mt-2 px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs font-medium text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- No linked employee profile (System-only account) --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} ({emp.employee_code || emp.email || 'Staff'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Name fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">First Name</label>
                  <input
                    type="text"
                    value={userForm.first_name}
                    onChange={(e) => setUserForm(prev => ({ ...prev, first_name: e.target.value }))}
                    placeholder="e.g. John"
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={userForm.last_name}
                    onChange={(e) => setUserForm(prev => ({ ...prev, last_name: e.target.value }))}
                    placeholder="e.g. Doe"
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Username and Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    System Username <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={userForm.username}
                    onChange={(e) => setUserForm(prev => ({ ...prev, username: e.target.value.toLowerCase().replace(/\s+/g, '') }))}
                    placeholder="e.g. john.doe"
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Used for signing into the ERP portal</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Official Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm(prev => ({ ...prev, email: e.target.value.toLowerCase().trim() }))}
                    placeholder="e.g. john@business.com"
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Primary notification &amp; login identifier</p>
                </div>
              </div>

              {/* Role Assignment */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">
                  Assign Role Profile <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {roles.map(role => {
                    const isSelected = userForm.role_id === role.id;
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => setUserForm(prev => ({ ...prev, role_id: role.id }))}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          isSelected 
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm' 
                            : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <p className="font-bold text-xs flex items-center justify-between">
                          <span>{role.name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center justify-between">
                  <span>{selectedUser ? 'Update Password (Optional)' : 'Account Password'}</span>
                  {selectedUser && (
                    <span className="text-[11px] text-gray-400 font-normal">Leave blank to keep existing password</span>
                  )}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                    placeholder={selectedUser ? 'Enter new password to reset' : 'Minimum 6 characters'}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Status Radio */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">Account Login Status</label>
                <div className="flex gap-4">
                  <label className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                    userForm.is_active === 1 
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800' 
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}>
                    <input
                      type="radio"
                      name="user_status"
                      checked={userForm.is_active === 1}
                      onChange={() => setUserForm(prev => ({ ...prev, is_active: 1 }))}
                      className="sr-only"
                    />
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Active (Allowed to sign in)</span>
                  </label>

                  <label className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                    userForm.is_active === 0 
                      ? 'border-red-500 bg-red-50 text-red-800' 
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}>
                    <input
                      type="radio"
                      name="user_status"
                      checked={userForm.is_active === 0}
                      onChange={() => setUserForm(prev => ({ ...prev, is_active: 0 }))}
                      className="sr-only"
                    />
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span>Deactivated (Blocked)</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 shrink-0">
              <button 
                type="button"
                onClick={() => setShowUserModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-100 text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleSaveUser}
                disabled={savingUser}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl text-sm font-semibold shadow-sm transition-all disabled:opacity-60 flex items-center gap-2"
              >
                {savingUser && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>{selectedUser ? 'Save Account Changes' : 'Provision User Account'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: CREATE ROLE */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-gray-900">Create New Role Profile</h3>
              </div>
              <button onClick={() => setShowRoleModal(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Role Title</label>
                <input
                  type="text"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Procurement Officer or Branch Auditor"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Description &amp; Purpose</label>
                <textarea
                  rows={3}
                  value={roleForm.description}
                  onChange={(e) => setRoleForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the operational responsibilities of users holding this role..."
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRoleModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRole}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm"
              >
                Create Role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: DELETE CONFIRMATION */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {showDeleteModal && userToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-gray-900">Confirm User Removal</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Are you sure you want to delete user account <strong className="text-gray-800">{userToDelete.email}</strong>? 
                If the user has associated transactions, the account will be safely deactivated to preserve financial audit trails.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setShowDeleteModal(false); setUserToDelete(null); }}
                className="flex-1 py-2.5 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-sm"
              >
                Confirm Removal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
