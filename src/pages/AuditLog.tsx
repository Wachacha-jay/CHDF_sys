import React, { useState, useEffect } from 'react';
import { Activity, Clock, Filter, RefreshCw } from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { useAuthContext } from '../contexts/useAuthContext';

interface ActivityLog {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  module: string;
  entity_id: string;
  entity_label: string;
  details: string;
  ip_address: string;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
  APPROVE: 'bg-purple-100 text-purple-800',
  PAY: 'bg-emerald-100 text-emerald-800',
  GENERATE: 'bg-amber-100 text-amber-800',
  LOGIN: 'bg-slate-100 text-slate-700',
  LOGOUT: 'bg-slate-100 text-slate-700',
};

const MODULES = ['', 'Payroll', 'Employee', 'Invoice', 'Journal Entry', 'Expense', 'Supplier', 'Customer', 'Inventory'];

const AuditLog: React.FC = () => {
  const { user } = useAuthContext();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [module, setModule] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [users, setUsers] = useState<{ user_id: string; user_name: string }[]>([]);

  useEffect(() => {
    fetchLogs();
    fetchUsers();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (module) params.set('module', module);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (userFilter) params.set('user_id', userFilter);
      params.set('limit', '200');
      const data = await apiClient.get<ActivityLog[]>('/audit?' + params.toString());
      setLogs(Array.isArray(data) ? data : []);
    } catch (e) {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await apiClient.get<{ user_id: string; user_name: string }[]>('/audit/users');
      setUsers(Array.isArray(data) ? data : []);
    } catch (_) {}
  };

  const fmt = (dt: string) => {
    if (!dt) return '-';
    return new Date(dt).toLocaleString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-indigo-600" />
            Audit Log
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Track all user actions and system events across modules</p>
        </div>
        <button
          onClick={fetchLogs}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium shadow-sm"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Module</label>
            <select
              value={module}
              onChange={e => setModule(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Modules</option>
              {MODULES.filter(Boolean).map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">User</label>
            <select
              value={userFilter}
              onChange={e => setUserFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Users</option>
              {users.map(u => <option key={u.user_id} value={u.user_id}>{u.user_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">From Date</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">To Date</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button onClick={fetchLogs}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-semibold">
            <Filter className="h-4 w-4" /> Apply Filters
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16">
            <Activity className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-700">No activity logs found</h3>
            <p className="text-sm text-slate-400 mt-1">Activity will appear here as users interact with the system.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Module</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Clock className="h-3 w-3" />
                        {fmt(log.created_at)}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold">
                          {(log.user_name || 'S').charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-slate-800">{log.user_name || 'System'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={"inline-flex px-2.5 py-0.5 text-xs font-bold rounded-full " + (ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-700')}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{log.module}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-700">{log.entity_label || '-'}</p>
                      {log.entity_id && <p className="text-xs text-slate-400 font-mono mt-0.5">ID: {log.entity_id.slice(0, 8)}...</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 text-center">
        Showing up to 200 most recent entries &middot; Logged in as: <strong>{user?.name || user?.email}</strong>
      </p>
    </div>
  );
};

export default AuditLog;
