import React, { useState, useEffect } from 'react';
import { 
  Users, Shield, Key, Plus, Search, Edit2, Trash2, CheckCircle, 
  XCircle, UserPlus, Fingerprint, Lock, ShieldCheck, UserCheck 
} from 'lucide-react';
import { ApiService } from '../services/api';
import { User, Role, Permission, Employee } from '../types';
import { useAuthContext } from '../contexts/useAuthContext';
import toast from 'react-hot-toast';

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
  
  // Selection
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [rolePerms, setRolePerms] = useState<string[]>([]);
  
  // Form States
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    password: '',
    role_id: '',
    employee_id: '',
    first_name: '',
    last_name: ''
  });

  const [roleForm, setRoleForm] = useState({
    name: '',
    description: ''
  });

  const { register: registerUser } = useAuthContext();

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
      if (rRes.success) setRoles(rRes.data || []);
      if (pRes.success) setPermissions(pRes.data || []);
      if (eRes.success) setEmployees(eRes.data || []);
    } catch (error) {
      toast.error('Failed to load management data');
    } finally {
      setLoading(false);
    }
  };

  const loadRolePermissions = async (roleId: string) => {
    try {
      const response = await ApiService.get<Permission>(`roles/${roleId}/permissions`);
      if (response.success) {
        setRolePerms(response.data?.map(p => p.id) || []);
      }
    } catch (error) {
      toast.error('Failed to load role permissions');
    }
  };

  const handleSaveUser = async () => {
    try {
      if (selectedUser) {
        // Update user (logic to be implemented if needed, focusing on creation per request)
        const response = await ApiService.update('users', selectedUser.id, userForm);
        if (response.success) {
          toast.success('User updated successfully');
          setShowUserModal(false);
          loadData();
        }
      } else {
        // Register new user
        const response = await registerUser(userForm);
        if (response.success) {
          toast.success('User registered successfully');
          setShowUserModal(false);
          loadData();
        } else {
          toast.error(response.error || 'Registration failed');
        }
      }
    } catch (error) {
      toast.error('Error saving user');
    }
  };

  const handleSaveRolePermissions = async () => {
    if (!selectedRole) return;
    try {
      const response = await ApiService.create(`roles/${selectedRole.id}/permissions`, {
        permissionIds: rolePerms
      });
      if (response.success) {
        toast.success('Permissions updated successfully');
      }
    } catch (error) {
      toast.error('Failed to save permissions');
    }
  };

  const togglePermission = (permId: string) => {
    setRolePerms(prev => 
      prev.includes(permId) ? prev.filter(id => id !== permId) : [...prev, permId]
    );
  };

  // Group permissions by module for the matrix
  const groupedPermissions = permissions.reduce((acc, p) => {
    if (!acc[p.module]) acc[p.module] = [];
    acc[p.module].push(p);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Shield className="mr-2 text-indigo-600" />
            User Management & RBAC
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage system access, roles, and granular technical permissions</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center px-6 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'users' 
              ? 'bg-white text-indigo-600 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="w-4 h-4 mr-2" />
          System Users
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`flex items-center px-6 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'roles' 
              ? 'bg-white text-indigo-600 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Key className="w-4 h-4 mr-2" />
          Roles & Rights
        </button>
      </div>

      {activeTab === 'users' ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Search users by name, email or username..." 
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
            </div>
            <button 
              onClick={() => {
                setSelectedUser(null);
                setUserForm({
                  username: '',
                  email: '',
                  password: '',
                  role_id: '',
                  employee_id: '',
                  first_name: '',
                  last_name: ''
                });
                setShowUserModal(true);
              }}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center shadow-sm transition-colors"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add User Account
            </button>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-left min-w-[700px]">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-4">User Identity</th>
                <th className="px-6 py-4">Username</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map(user => {
                const role = roles.find(r => r.id === (user as any).role_id);
                return (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold mr-3 border border-indigo-200">
                          {user.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{user.name}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{user.username || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        role?.name === 'Super Admin' ? 'bg-purple-100 text-purple-700' :
                        role?.name === 'Admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {role?.name || 'No Role Assigned'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center text-xs text-green-600 font-medium">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Active
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <button className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          {/* Roles List */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                <ShieldCheck className="w-5 h-5 mr-2 text-indigo-600" />
                Defined Roles
              </h3>
              <div className="space-y-2">
                {roles.map(role => (
                  <button
                    key={role.id}
                    onClick={() => {
                      setSelectedRole(role);
                      loadRolePermissions(role.id);
                    }}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      selectedRole?.id === role.id 
                        ? 'border-indigo-600 bg-indigo-50 shadow-sm' 
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-gray-900">{role.name}</span>
                      {role.is_system && (
                        <span className="bg-gray-100 text-gray-500 text-[10px] uppercase px-1.5 py-0.5 rounded font-bold">System</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{role.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Permissions Matrix */}
          <div className="col-span-12 lg:col-span-8">
            {selectedRole ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full">
                <div className="p-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-gray-900 flex items-center">
                      Permissions for: <span className="ml-2 text-indigo-600">{selectedRole.name}</span>
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">Select the modules and actions this role is authorized to perform</p>
                  </div>
                  <button 
                    onClick={handleSaveRolePermissions}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 shadow-sm font-medium flex items-center transition-colors"
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Save Rights
                  </button>
                </div>
                
                <div className="p-6 overflow-y-auto max-h-[600px] custom-scrollbar">
                  {selectedRole.name === 'Super Admin' ? (
                    <div className="flex flex-col items-center justify-center p-12 bg-indigo-50 rounded-2xl border border-indigo-100">
                      <ShieldCheck className="w-16 h-16 text-indigo-600 mb-4" />
                      <h4 className="text-lg font-bold text-indigo-900">Total Access Override</h4>
                      <p className="text-indigo-600/70 text-center mt-2 max-w-sm">
                        Super Admin accounts have implicit access to all functions and tables in the system. Permissions cannot be restricted for this role.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {Object.entries(groupedPermissions).map(([module, perms]) => (
                        <div key={module} className="border border-gray-200 rounded-xl overflow-hidden">
                          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 font-bold text-sm text-gray-700 uppercase tracking-tight">
                            {module} Module
                          </div>
                          <div className="divide-y divide-gray-100">
                            {perms.map(p => (
                              <div key={p.id} className="flex items-center justify-between px-4 py-4 hover:bg-gray-50 transition-colors">
                                <div>
                                  <p className="font-medium text-gray-900 capitalize">{p.name.split('_').join(' ')}</p>
                                  <p className="text-xs text-gray-500">{p.description}</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    className="sr-only peer"
                                    checked={rolePerms.includes(p.id)}
                                    onChange={() => togglePermission(p.id)}
                                  />
                                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center p-20">
                <div className="p-4 bg-gray-50 rounded-full mb-4">
                  <Fingerprint className="w-12 h-12 text-gray-400" />
                </div>
                <h3 className="font-bold text-gray-900">Select a Role</h3>
                <p className="text-gray-500 text-sm mt-1">Choose a role from the left to configure its access rights.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <UserPlus className="w-5 h-5 mr-2 text-indigo-600" />
                {selectedUser ? 'Edit System Account' : 'Register New System User'}
              </h2>
              <button 
                onClick={() => setShowUserModal(false)}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <XCircle className="w-6 h-6 text-gray-400" />
              </button>
            </div>
            
            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-4">
                <div className="bg-amber-100 p-2 rounded-lg h-fit">
                    <Users className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                    <h4 className="text-sm font-bold text-amber-900">Link to Employee Profile</h4>
                    <p className="text-xs text-amber-800/70 mt-0.5 leading-relaxed">
                        Selecting an employee will automatically fill identity details. Leave blank for "system-only" administrative accounts.
                    </p>
                    <select 
                      className="mt-3 w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                      value={userForm.employee_id}
                      onChange={(e) => {
                        const emp = employees.find(emp => emp.id === e.target.value);
                        if (emp) {
                          setUserForm(prev => ({
                            ...prev,
                            employee_id: emp.id,
                            first_name: emp.first_name,
                            last_name: emp.last_name,
                            email: emp.email
                          }));
                        } else {
                          setUserForm(prev => ({ ...prev, employee_id: '' }));
                        }
                      }}
                    >
                      <option value="">-- No Employee Link (System Only Account) --</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.code})</option>
                      ))}
                    </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">First Name</label>
                  <input 
                    type="text" 
                    value={userForm.first_name}
                    onChange={(e) => setUserForm(prev => ({ ...prev, first_name: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Last Name</label>
                  <input 
                    type="text" 
                    value={userForm.last_name}
                    onChange={(e) => setUserForm(prev => ({ ...prev, last_name: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 font-mono">@Username</label>
                  <input 
                    type="text" 
                    value={userForm.username}
                    onChange={(e) => setUserForm(prev => ({ ...prev, username: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    placeholder="e.g. jdoe_admin"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Official Email</label>
                  <input 
                    type="email" 
                    value={userForm.email}
                    onChange={(e) => setUserForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Assign System Role</label>
                <div className="grid grid-cols-3 gap-3">
                  {roles.map(role => (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => setUserForm(prev => ({ ...prev, role_id: role.id }))}
                      className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                        userForm.role_id === role.id 
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm' 
                          : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {role.name}
                    </button>
                  ))}
                </div>
              </div>

              {!selectedUser && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Secure Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input 
                      type="password" 
                      value={userForm.password}
                      onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                      placeholder="Enter a strong password"
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-2 italic px-1">Note: Passwords must be at least 8 characters with a mix of letters and symbols.</p>
                </div>
              )}
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
              <button 
                onClick={() => setShowUserModal(false)}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveUser}
                className="bg-indigo-600 text-white px-8 py-2 rounded-lg hover:bg-indigo-700 shadow-md font-bold transition-all transform active:scale-95"
              >
                {selectedUser ? 'Save Updates' : 'Finish & Create Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
