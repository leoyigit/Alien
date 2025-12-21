import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../context/ToastContext.jsx';
import { useProjects } from '../context/ProjectsContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import TerminalLoader from '../components/ui/TerminalLoader.jsx';
import CommunicationMethodModal from '../components/CommunicationMethodModal.jsx';
import {
  Plus, AlertCircle, ArrowRight, ExternalLink, Save, X,
  Pencil, RefreshCw, MoreHorizontal, HelpCircle, Search
} from 'lucide-react';
import { BLOCKER_OPTS, parseBlocker } from '../utils/constants';

export default function PMStation() {
  const { projects, loading, fetchProjects, updateLocalProject } = useProjects();
  const { canAccessProject, canEditProject } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientOwner, setNewClientOwner] = useState("");
  const [activeFilter, setActiveFilter] = useState('All Active');
  const [editingProject, setEditingProject] = useState(null);
  const [formData, setFormData] = useState({});
  const [showCommMethodModal, setShowCommMethodModal] = useState(false);
  const [pendingLastCallDate, setPendingLastCallDate] = useState(null);
  const [users, setUsers] = useState({});
  const [teamMembers, setTeamMembers] = useState([]);
  const [syncingProject, setSyncingProject] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'last_active', direction: 'desc' });

  // Filter & Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [pmFilter, setPmFilter] = useState('all');
  const [devFilter, setDevFilter] = useState('all');

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchProjects(true);
    setRefreshing(false);
  };

  React.useEffect(() => {
    api.get('/slack-users').then(res => setUsers(res.data)).catch(console.error);
    api.get('/settings/team').then(res => setTeamMembers(res.data || [])).catch(console.error);
  }, []);

  const navigate = useNavigate();
  const { showToast } = useToast();

  // Apply access control first (RLS-based filtering)
  const accessibleProjects = projects.filter(p => canAccessProject(p));

  // Get unique PMs and Devs for filter dropdowns
  const uniquePMs = ['all', ...new Set(accessibleProjects.map(p => p.owner).filter(Boolean))];
  const uniqueDevs = ['all', ...new Set(accessibleProjects.map(p => p.developer).filter(Boolean))];

  const activeProjects = accessibleProjects.filter(p => p.category !== 'Launched');

  const sortProjects = (projs) => {
    return [...projs].sort((a, b) => {
      // Always put 'Stuck' at top if sorting by default/last_active, but maybe not if explicit sort?
      // User asked for A-Z sort. Let's make explicit sort override "Stuck" logic if user clicks a header.
      // But let's keep "Stuck" logic for default view or specific categories logic if desirable.
      // For simplicity and user request "sort A-Z", strict sorting is better.

      let valA = a[sortConfig.key] || "";
      let valB = b[sortConfig.key] || "";

      // Special handling for Client Name (Client / Owner column)
      if (sortConfig.key === 'client_name') {
        valA = a.client_name?.toLowerCase() || "";
        valB = b.client_name?.toLowerCase() || "";
      }

      // Special handlings for dates
      if (['last_contact_date', 'next_call'].includes(sortConfig.key)) {
        valA = new Date(valA).getTime() || 0;
        valB = new Date(valB).getTime() || 0;
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const sortedProjects = sortProjects(activeProjects);

  const filters = ['All Active', 'New / In Progress', 'Almost Ready', 'Ready', 'Stuck / On Hold'];

  const getFilterCount = (filter) => {
    if (filter === 'All Active') return sortedProjects.length;
    return sortedProjects.filter(p => p.category === filter).length;
  };

  // Apply category filter
  let filteredProjects = activeFilter === 'All Active'
    ? sortedProjects
    : sortedProjects.filter(p => p.category === activeFilter);

  // Apply search
  if (searchTerm) {
    filteredProjects = filteredProjects.filter(p =>
      p.client_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  // Apply PM filter
  if (pmFilter !== 'all') {
    filteredProjects = filteredProjects.filter(p => p.owner === pmFilter);
  }

  // Apply Dev filter
  if (devFilter !== 'all') {
    filteredProjects = filteredProjects.filter(p => p.developer === devFilter);
  }

  const clearFilters = () => {
    setSearchTerm('');
    setPmFilter('all');
    setDevFilter('all');
  };

  const activeFiltersCount = (searchTerm ? 1 : 0) + (pmFilter !== 'all' ? 1 : 0) + (devFilter !== 'all' ? 1 : 0);

  const handleSort = (key) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleEditClick = (e, project) => {
    e.stopPropagation();
    setEditingProject(project);
    const { cats, desc } = parseBlocker(project.blocker);
    setFormData({
      status_detail: project.status_detail || "",
      blocker_cats: cats,
      blocker_desc: desc,
      last_contact_date: project.last_contact_date || "",
      next_call: project.next_call || "",
      comm_channels: project.comm_channels || "",
      category: project.category || "New / In Progress",
      owner: project.owner || "",
      developer: project.developer || "",
      client_name: project.client_name || "" // Added for rename
    });
  };

  const handleCreateProject = async () => {
    if (!newClientName.trim()) return;
    try {
      const response = await api.post('/create-project', { client_name: newClientName, owner: newClientOwner });
      const newProjectId = response.data.project_id;
      showToast("Project Created! Redirecting to details...", "success");
      setNewClientName("");
      setNewClientOwner("");
      setShowAddModal(false);
      // Navigate to project details page for full setup
      navigate(`/projects/${newProjectId}`);
    } catch (err) { showToast("Error: " + err.message, "error"); }
  };

  const toggleBlockerCat = (cat) => {
    setFormData(prev => {
      const cats = prev.blocker_cats || [];
      return cats.includes(cat)
        ? { ...prev, blocker_cats: cats.filter(c => c !== cat) }
        : { ...prev, blocker_cats: [...cats, cat] };
    });
  };

  // Handle Last Call date change - trigger modal if date is being set
  const handleLastCallChange = (newDate) => {
    const oldDate = formData.last_contact_date;

    // If date is being set or changed (not cleared)
    if (newDate && newDate !== oldDate) {
      setPendingLastCallDate(newDate);
      setShowCommMethodModal(true);
    } else {
      // If clearing the date, just update
      setFormData({ ...formData, last_contact_date: newDate });
    }
  };

  // Handle communication method confirmation from modal
  const handleCommMethodConfirm = (methods) => {
    setFormData({
      ...formData,
      last_contact_date: pendingLastCallDate,
      last_communication_via: methods
    });
    setShowCommMethodModal(false);
    setPendingLastCallDate(null);
  };

  const handleCommMethodCancel = () => {
    setShowCommMethodModal(false);
    setPendingLastCallDate(null);
  };

  const handleSaveReport = async () => {
    if (!editingProject) return;
    try {
      // Serialize Blocker
      let finalBlocker = "-";
      if (formData.blocker_cats?.length > 0 || formData.blocker_desc?.trim()) {
        const catStr = formData.blocker_cats.join(', ');
        const descStr = formData.blocker_desc?.trim() || "";
        finalBlocker = `${catStr} | ${descStr}`;
      }

      const finalUpdates = {
        ...formData,
        blocker: finalBlocker
      };

      // Remove temporary fields before sending
      delete finalUpdates.blocker_cats;
      delete finalUpdates.blocker_desc;

      await api.post(`/projects/${editingProject.id}/update-report`, { user_email: "leo@flyrank.com", updates: finalUpdates });
      showToast("Report Updated!", "success");

      // Optimistic update including name change
      const updatedProj = { ...editingProject, ...finalUpdates };
      // If we have a dedicated updateLocalProject, use it. But we provided updates.
      // Re-fetch to be safe or update local state manually if needed.
      // For now, let's just trigger a re-fetch or rely on updateLocalProject logic if it handles full object merges.
      // Assuming updateLocalProject creates a merge.
      updateLocalProject(editingProject.id, finalUpdates);

      setEditingProject(null);
    } catch (err) { showToast("Error: " + err.message, "error"); }
  };

  const getCategoryStyle = (cat) => {
    if (cat === 'Stuck / On Hold') return "bg-red-50 text-red-600 border-red-100";
    if (cat === 'Almost Ready') return "bg-yellow-50 text-yellow-700 border-yellow-200";
    if (cat === 'Ready') return "bg-green-50 text-green-700 border-green-200";
    if (cat === 'Launched') return "bg-purple-50 text-purple-700 border-purple-200";
    return "bg-blue-50 text-blue-700 border-blue-100";
  };

  const handleSyncProject = async (e, projectId) => {
    e.stopPropagation();
    setSyncingProject(projectId);
    try {
      await api.post('/sync-history', { project_id: projectId });
      showToast('Sync complete!', 'success');
    } catch (err) {
      showToast('Sync failed: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setSyncingProject(null);
    }
  };

  if (loading && projects.length === 0) return <TerminalLoader />;

  return (
    <div className="max-w-screen-2xl mx-auto p-6 bg-gray-50 dark:bg-gray-900 min-h-screen font-sans">
      <div className="flex flex-col xl:flex-row justify-between items-end mb-6 gap-4">
        <div><h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">PM Station</h1><p className="text-gray-500 mt-1 text-sm">Manage active migrations.</p></div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white dark:bg-gray-800 border border-gray-200 p-1 rounded-lg shadow-sm">
            {filters.map(f => (
              <button key={f} onClick={() => setActiveFilter(f)} className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition ${activeFilter === f ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 dark:bg-gray-900'}`}>
                {f === 'All Active' ? 'All Active' : f.split(' / ')[0]}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeFilter === f ? 'bg-white dark:bg-gray-800 text-black' : 'bg-gray-100 text-gray-500'}`}>{getFilterCount(f)}</span>
              </button>
            ))}
          </div>
          <button onClick={handleRefresh} disabled={refreshing} className="p-2 bg-white dark:bg-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 disabled:opacity-50">
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
          {canEditProject() && (
            <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 shadow-lg transition"><Plus size={16} /> New Client</button>
          )}
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 shadow-sm mb-6">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-black outline-none"
            />
          </div>

          {/* PM Filter */}
          <select
            value={pmFilter}
            onChange={(e) => setPmFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-black outline-none bg-white dark:bg-gray-800"
          >
            <option value="all">All PMs</option>
            {uniquePMs.filter(pm => pm !== 'all').map(pm => (
              <option key={pm} value={pm}>{pm}</option>
            ))}
          </select>

          {/* Dev Filter */}
          <select
            value={devFilter}
            onChange={(e) => setDevFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-black outline-none bg-white dark:bg-gray-800"
          >
            <option value="all">All Devs</option>
            {uniqueDevs.filter(dev => dev !== 'all').map(dev => (
              <option key={dev} value={dev}>{dev}</option>
            ))}
          </select>

          {/* Clear Filters */}
          {activeFiltersCount > 0 && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold text-sm flex items-center gap-2 transition whitespace-nowrap"
            >
              <X size={14} /> Clear ({activeFiltersCount})
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900 text-gray-400 text-[10px] uppercase font-bold border-b border-gray-100 select-none">
            <tr>
              <th className="p-4 pl-6 w-44 cursor-pointer hover:text-gray-700 dark:text-gray-200" onClick={() => handleSort('client_name')}>Client {sortConfig.key === 'client_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
              <th className="p-4 w-28 cursor-pointer hover:text-gray-700 dark:text-gray-200" onClick={() => handleSort('category')}>Stage {sortConfig.key === 'category' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
              <th className="p-4 min-w-[280px]">Latest Status</th>
              <th className="p-4 w-28">Blocker</th>
              <th className="p-4 w-24 cursor-pointer hover:text-gray-700 dark:text-gray-200" onClick={() => handleSort('last_contact_date')}>Last {sortConfig.key === 'last_contact_date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
              <th className="p-4 w-24 cursor-pointer hover:text-gray-700 dark:text-gray-200" onClick={() => handleSort('next_call')}>Next {sortConfig.key === 'next_call' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
              <th className="p-4 text-right pr-6 w-28">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredProjects.map((p) => (
              <tr key={p.id} onClick={() => navigate(`/projects/${p.id}`, { state: { from: '/pm' } })} className="hover:bg-gray-50 dark:bg-gray-900 transition cursor-pointer group">
                <td className="p-4 pl-6"><div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">{p.client_name}<ExternalLink size={12} className="opacity-0 group-hover:opacity-100 text-blue-400" /></div><div className="text-xs text-gray-400">{p.owner || "Unassigned"}</div></td>
                <td className="p-4"><span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border ${getCategoryStyle(p.category)}`}>{p.category}</span></td>
                <td className="p-4"><p className="text-gray-600 dark:text-gray-300 text-xs line-clamp-2">{p.status_detail || "No update."}</p></td>
                <td className="p-4">
                  {(() => {
                    const { cats, desc } = parseBlocker(p.blocker);
                    if (cats.length === 0 && !desc) return <span className="text-gray-300">-</span>;
                    return (
                      <div className="group relative flex flex-wrap gap-0.5">
                        {cats.map(c => (
                          <span key={c} className="px-1 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded text-[9px] font-semibold">{c}</span>
                        ))}
                        {cats.length === 0 && <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[80px]">{desc}</span>}
                        {desc && (
                          <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-black text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-20">
                            {desc}
                            <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-black"></div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </td>
                <td className="p-4 text-gray-500 dark:text-gray-400 font-mono text-xs">{p.last_contact_date ? new Date(p.last_contact_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : "-"}</td>
                <td className="p-4 text-gray-500 dark:text-gray-400 font-mono text-xs">
                  {(() => {
                    if (!p.next_call) return "-";
                    const callDate = new Date(p.next_call);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (today > callDate) return "-"; // Hide past dates (strictly before today)
                    return callDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                  })()}
                </td>
                <td className="p-4 pr-6 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={(e) => handleSyncProject(e, p.id)}
                      disabled={syncingProject === p.id}
                      className="p-1.5 hover:bg-blue-50 rounded text-gray-400 dark:text-gray-500 hover:text-blue-600 transition"
                      title="Sync Slack"
                    >
                      <RefreshCw size={14} className={syncingProject === p.id ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={(e) => handleEditClick(e, p)} className="p-1.5 hover:bg-gray-100 dark:bg-gray-700 rounded text-gray-400 hover:text-gray-600">
                      <Pencil size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editingProject && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setEditingProject(null)} />
          <div className="bg-white dark:bg-gray-800 w-full max-w-lg h-full shadow-2xl relative z-10 flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
              <div className="w-full mr-4">
                <input
                  className="text-xl font-bold text-gray-900 dark:text-white bg-transparent border-b border-transparent hover:border-gray-300 focus:border-black outline-none w-full"
                  value={formData.client_name}
                  onChange={e => setFormData({ ...formData, client_name: e.target.value })}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-1">Quick Edit - Click name to rename</p>
              </div>
              <button onClick={() => setEditingProject(null)} className="p-2 hover:bg-gray-200 rounded-full transition"><X size={20} className="text-gray-500" /></button>
            </div>
            <div className="p-8 flex-1 overflow-y-auto space-y-6">
              <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Stage</label><div className="grid grid-cols-2 gap-2">{['New / In Progress', 'Almost Ready', 'Ready', 'Launched', 'Stuck / On Hold'].map(cat => (<button key={cat} onClick={() => setFormData({ ...formData, category: cat })} className={`p-2 rounded border text-xs font-bold transition ${formData.category === cat ? getCategoryStyle(cat) + " ring-2 ring-offset-1 ring-gray-200" : "bg-white dark:bg-gray-800 border-gray-200 text-gray-500 hover:bg-gray-50"}`}>{cat}</button>))}</div></div>

              {/* Last Communication Via */}
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Last Communication Via</label>
                <div className="flex flex-wrap gap-2">
                  {['Slack', 'Email', 'Google Meet', 'Huddle'].map(method => {
                    const methodKey = method.toLowerCase().replace(' ', '_');
                    const isSelected = formData.last_communication_via?.includes(methodKey);
                    return (
                      <button
                        key={method}
                        onClick={() => {
                          const current = formData.last_communication_via || [];
                          const updated = isSelected
                            ? current.filter(m => m !== methodKey)
                            : [...current, methodKey];
                          setFormData({ ...formData, last_communication_via: updated });
                        }}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition ${isSelected
                          ? 'bg-blue-500 text-white shadow-sm'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                      >
                        {method}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-100">
                <input
                  type="checkbox"
                  id="send_slack"
                  checked={formData.send_slack || false}
                  onChange={e => setFormData({ ...formData, send_slack: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="send_slack" className="text-xs font-bold text-blue-700 uppercase cursor-pointer">
                  Send update to Slack channel (#operations)
                </label>
              </div>
              <div><label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Status Note</label><textarea className="w-full border border-gray-300 rounded-lg p-3 text-sm h-32 focus:ring-2 focus:ring-black outline-none shadow-sm" value={formData.status_detail} onChange={e => setFormData({ ...formData, status_detail: e.target.value })} placeholder="What's new?" /></div>
              <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                <label className="block text-xs font-bold text-red-600 uppercase mb-2 flex items-center gap-2"><AlertCircle size={14} /> Blockers</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {BLOCKER_OPTS.map(opt => (
                    <button
                      key={opt}
                      onClick={() => toggleBlockerCat(opt)}
                      className={`px-3 py-1.5 rounded text-xs font-bold border transition ${formData.blocker_cats?.includes(opt)
                        ? 'bg-red-600 text-white border-red-600 shadow-sm'
                        : 'bg-white dark:bg-gray-800 text-gray-600 border-red-200 hover:bg-red-100'
                        }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <textarea
                  className="w-full border border-red-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-red-500 outline-none bg-white dark:bg-gray-800 min-h-[60px]"
                  value={formData.blocker_desc}
                  onChange={e => setFormData({ ...formData, blocker_desc: e.target.value })}
                  placeholder="Explain the blocker..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Last Call</label><input type="date" className="w-full border rounded-lg p-2.5 text-sm outline-none" value={formData.last_contact_date} onChange={e => handleLastCallChange(e.target.value)} /></div><div><label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Next Call</label><input type="date" className="w-full border rounded-lg p-2.5 text-sm outline-none" value={formData.next_call} onChange={e => setFormData({ ...formData, next_call: e.target.value })} /></div></div>


              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">PM (Owner)</label>
                  <select className="w-full border rounded-lg p-2.5 text-sm outline-none bg-white dark:bg-gray-800" value={formData.owner} onChange={e => setFormData({ ...formData, owner: e.target.value })}>
                    <option value="">Unassigned</option>
                    {teamMembers.filter(m => m.role === 'PM' || m.role === 'Both').map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Developer</label>
                  <select className="w-full border rounded-lg p-2.5 text-sm outline-none bg-white dark:bg-gray-800" value={formData.developer} onChange={e => setFormData({ ...formData, developer: e.target.value })}>
                    <option value="">Unassigned</option>
                    {teamMembers.filter(m => m.role === 'Dev' || m.role === 'Both').map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="pt-6 border-t"><button onClick={() => navigate(`/projects/${editingProject.id}`)} className="w-full py-3 bg-gray-50 dark:bg-gray-900 text-gray-600 font-bold rounded-xl hover:bg-gray-100 flex items-center justify-center gap-2 border transition">Open Full Page <ExternalLink size={14} /></button></div>
            </div>
            <div className="p-4 border-t bg-gray-50 dark:bg-gray-900"><button onClick={handleSaveReport} className="w-full py-3 bg-black text-white font-bold rounded-xl hover:bg-gray-800 flex justify-center gap-2 shadow-lg transition"><Save size={18} /> Save Update</button></div>
          </div>
        </div>
      )}

      {/* New Client Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md relative z-10 p-8 space-y-6 animate-in zoom-in-50 duration-200">
            <div className="flex justify-between items-start">
              <div><h2 className="text-2xl font-black text-gray-900 dark:text-white">New Client</h2><p className="text-sm text-gray-500 mt-1">Create a new migration project.</p></div>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 dark:bg-gray-700 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Client Name</label>
                <input className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-black outline-none font-bold" placeholder="e.g. Fresh Peaches" value={newClientName} onChange={e => setNewClientName(e.target.value)} autoFocus />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Assigned PM</label>
                <select className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none bg-white dark:bg-gray-800" value={newClientOwner} onChange={e => setNewClientOwner(e.target.value)}>
                  <option value="">Unassigned</option>
                  {teamMembers.filter(m => m.role === 'PM' || m.role === 'Both').map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                </select>
              </div>
            </div>
            <div className="pt-2">
              <button onClick={handleCreateProject} disabled={!newClientName.trim()} className="w-full bg-black text-white py-3 rounded-xl font-bold hover:bg-gray-800 disabled:opacity-50 transition shadow-lg flex justify-center items-center gap-2">
                Create Project <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Communication Method Modal */}
      <CommunicationMethodModal
        isOpen={showCommMethodModal}
        onClose={handleCommMethodCancel}
        onConfirm={handleCommMethodConfirm}
      />
    </div>
  );
}