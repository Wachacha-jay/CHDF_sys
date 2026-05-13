import React, { useEffect, useState } from 'react';
import { Child, Guardian } from '../../types';
import { FundAccountingService } from '../../services/fundAccountingService';
import { UserPlus, Search, Filter, MoreHorizontal, GraduationCap, HeartHandshake, Plus } from 'lucide-react';
import { toast } from 'react-hot-toast';

const ChildManagement: React.FC = () => {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [formData, setFormData] = useState<any>({
    first_name: '',
    last_name: '',
    code: '',
    date_of_birth: '',
    gender: 'Male',
    status: 'active',
    enrollment_date: new Date().toISOString().split('T')[0],
    guardian_id: '',
    new_guardian_name: '',
    new_guardian_phone: '',
    new_guardian_relationship: 'Parent'
  });

  const loadChildren = async () => {
    setLoading(true);
    const [childrenData, guardiansData] = await Promise.all([
      FundAccountingService.getChildren(),
      FundAccountingService.getGuardians()
    ]);
    setChildren(childrenData);
    setGuardians(guardiansData);
    setLoading(false);
  };

  useEffect(() => {
    loadChildren();
  }, []);

  useEffect(() => {
    if (showModal) {
      FundAccountingService.getNextChildCode().then(code => {
        setFormData(prev => ({ ...prev, code }));
      });
    }
  }, [showModal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let guardianId = formData.guardian_id;

    // Create new guardian if info is provided
    if (!guardianId && formData.new_guardian_name) {
      const guardian = await FundAccountingService.createGuardian({
        name: formData.new_guardian_name,
        phone: formData.new_guardian_phone,
        relationship: formData.new_guardian_relationship
      });
      if (guardian) {
        guardianId = guardian.id;
      }
    }

    const result = await FundAccountingService.createChild({
      first_name: formData.first_name,
      last_name: formData.last_name,
      code: formData.code,
      date_of_birth: formData.date_of_birth,
      gender: formData.gender,
      status: formData.status,
      enrollment_date: formData.enrollment_date,
      guardian_id: guardianId
    });

    if (result) {
      setShowModal(false);
      setFormData({
        first_name: '',
        last_name: '',
        code: '',
        date_of_birth: '',
        gender: 'Male',
        status: 'active',
        enrollment_date: new Date().toISOString().split('T')[0],
        guardian_id: '',
        new_guardian_name: '',
        new_guardian_phone: '',
        new_guardian_relationship: 'Parent'
      });
      loadChildren();
      toast.success('Child registered successfully');
    }
  };

  const filteredChildren = children.filter(c => 
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Child Beneficiaries</h1>
          <p className="text-gray-500">Manage profiles and sponsorship linkages</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus size={18} />
          Register New Child
        </button>
      </div>

      {/* Registration Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden overflow-y-auto max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-50/50">
              <h2 className="text-xl font-bold text-gray-900">Register New Beneficiary</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">First Name</label>
                    <input 
                      type="text" 
                      required 
                      className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500" 
                      value={formData.first_name}
                      onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Last Name</label>
                    <input 
                      type="text" 
                      required 
                      className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500" 
                      value={formData.last_name}
                      onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Child Code (Auto)</label>
                    <input 
                      type="text" 
                      required 
                      readOnly
                      className="mt-1 w-full rounded-xl border-gray-100 bg-gray-50 text-gray-500 font-mono" 
                      value={formData.code}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Gender</label>
                    <select 
                      className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                      value={formData.gender}
                      onChange={(e) => setFormData({...formData, gender: e.target.value})}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                    <input 
                      type="date" 
                      required 
                      className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500" 
                      value={formData.date_of_birth}
                      onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Enrollment Date</label>
                    <input 
                      type="date" 
                      required 
                      className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500" 
                      value={formData.enrollment_date}
                      onChange={(e) => setFormData({...formData, enrollment_date: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Guardian Details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Select Existing Guardian</label>
                    <select 
                      className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                      value={formData.guardian_id}
                      onChange={(e) => setFormData({...formData, guardian_id: e.target.value})}
                    >
                      <option value="">-- Or register a new one below --</option>
                      {guardians.map(g => (
                        <option key={g.id} value={g.id}>{g.name} ({g.relationship})</option>
                      ))}
                    </select>
                  </div>
                  
                  {!formData.guardian_id && (
                    <div className="bg-gray-50 p-4 rounded-2xl border border-dashed border-gray-200 grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700">New Guardian Name</label>
                        <input 
                          type="text" 
                          placeholder="Full Name"
                          className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 bg-white" 
                          value={formData.new_guardian_name}
                          onChange={(e) => setFormData({...formData, new_guardian_name: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Relationship</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Mother, Uncle"
                          className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 bg-white" 
                          value={formData.new_guardian_relationship}
                          onChange={(e) => setFormData({...formData, new_guardian_relationship: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                        <input 
                          type="tel" 
                          placeholder="Phone"
                          className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 bg-white" 
                          value={formData.new_guardian_phone}
                          onChange={(e) => setFormData({...formData, new_guardian_phone: e.target.value})}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 flex gap-3 sticky bottom-0 bg-white pb-2">
                <button type="submit" className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100">Register Child</button>
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-4 items-center justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by name or code..." 
              className="w-full pl-10 pr-4 py-2 rounded-xl border-gray-200 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
              <Filter size={16} />
              Filter
            </button>
          </div>
        </div>

        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4 font-semibold">Child Details</th>
              <th className="px-6 py-4 font-semibold">Code</th>
              <th className="px-6 py-4 font-semibold">Guardian</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold">Enrollment</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              [1, 2, 3].map(i => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={6} className="px-6 py-8 h-16 bg-gray-50/50"></td>
                </tr>
              ))
            ) : filteredChildren.map((child) => (
              <tr key={child.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                      {child.first_name[0]}{child.last_name[0]}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{child.first_name} {child.last_name}</div>
                      <div className="text-xs text-gray-500">{child.gender} • {new Date().getFullYear() - new Date(child.date_of_birth).getFullYear()} yrs</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm font-mono text-gray-600">{child.code}</td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {child.guardian?.name || 'N/A'}
                  <div className="text-xs text-gray-400">{child.guardian?.phone}</div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    child.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 
                    child.status === 'graduated' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {child.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {new Date(child.enrollment_date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2 justify-end">
                    <button className="p-2 hover:bg-white rounded-lg text-gray-400 hover:text-indigo-600 border border-transparent hover:border-gray-100 transition-all">
                      <HeartHandshake size={18} title="Link Sponsor" />
                    </button>
                    <button className="p-2 hover:bg-white rounded-lg text-gray-400 hover:text-emerald-600 border border-transparent hover:border-gray-100 transition-all">
                      <GraduationCap size={18} title="View Education" />
                    </button>
                    <button className="p-2 hover:bg-white rounded-lg text-gray-400 hover:text-gray-600 border border-transparent hover:border-gray-100 transition-all">
                      <MoreHorizontal size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && filteredChildren.length === 0 && (
          <div className="p-12 text-center">
            <div className="inline-flex p-4 rounded-full bg-gray-50 text-gray-400 mb-4">
              <UserPlus size={32} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">No children found</h3>
            <p className="text-gray-500 max-w-xs mx-auto mt-1">Try adjusting your search or add a new beneficiary to the system.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChildManagement;
