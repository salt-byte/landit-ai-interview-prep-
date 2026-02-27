
import React, { useState } from 'react';
import { Plus, Building2, Briefcase, ExternalLink, Search } from 'lucide-react';
import { TargetRole } from '../types';

interface TargetRoleListProps {
  onSelectWorkspace: (role: TargetRole) => void;
}

const INITIAL_ROLES: TargetRole[] = [
  {
    id: '1',
    title: 'Senior Software Engineer',
    company: 'Stripe',
    jd: 'Working on core payment infrastructure...',
    teamInfo: 'Infrastructure Team based in San Francisco'
  },
  {
    id: '2',
    title: 'Product Manager',
    company: 'Airbnb',
    jd: 'Leading the discovery team for guest experiences...',
    teamInfo: 'Growth & Product Core'
  }
];

const TargetRoleList: React.FC<TargetRoleListProps> = ({ onSelectWorkspace }) => {
  const [roles, setRoles] = useState<TargetRole[]>(INITIAL_ROLES);
  const [showModal, setShowModal] = useState(false);
  const [newRole, setNewRole] = useState({ title: '', company: '', jd: '', teamInfo: '' });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const role: TargetRole = {
      ...newRole,
      id: Math.random().toString(36).substr(2, 9),
    };
    setRoles([role, ...roles]);
    setShowModal(false);
    setNewRole({ title: '', company: '', jd: '', teamInfo: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Target Role Workspaces</h2>
          <p className="text-slate-500">Select a workspace to start your role-specific preparation.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all transform hover:-translate-y-0.5"
        >
          <Plus className="w-5 h-5" />
          Create New Workspace
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roles.map(role => (
          <div 
            key={role.id}
            onClick={() => onSelectWorkspace(role)}
            className="group bg-white border border-slate-200 rounded-2xl p-6 hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-50/50 transition-all cursor-pointer relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <ExternalLink className="w-5 h-5 text-indigo-500" />
            </div>
            <div className="bg-indigo-50 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Building2 className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{role.title}</h3>
            <p className="text-slate-600 font-medium mb-4">{role.company}</p>
            <div className="flex flex-wrap gap-2 mt-auto">
              <span className="px-2 py-1 bg-slate-100 text-slate-500 text-xs font-semibold rounded uppercase tracking-wider">Full-time</span>
              <span className="px-2 py-1 bg-green-50 text-green-600 text-xs font-semibold rounded uppercase tracking-wider">Ready to prep</span>
            </div>
          </div>
        ))}
      </div>

      {/* New Workspace Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-8 shadow-2xl animate-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-slate-900 mb-6">Create Role Workspace</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Target Job Title</label>
                <input 
                  required
                  type="text" 
                  value={newRole.title}
                  onChange={e => setNewRole({...newRole, title: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                  placeholder="e.g. Senior Frontend Engineer"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Company / Team</label>
                <input 
                  required
                  type="text" 
                  value={newRole.company}
                  onChange={e => setNewRole({...newRole, company: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                  placeholder="e.g. Google - Cloud Marketing"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Job Description (JD)</label>
                <textarea 
                  required
                  rows={4}
                  value={newRole.jd}
                  onChange={e => setNewRole({...newRole, jd: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none" 
                  placeholder="Paste the job description here..."
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-md shadow-indigo-100"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TargetRoleList;
