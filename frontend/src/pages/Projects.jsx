import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useProjects } from '../context/ProjectsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import TerminalLoader from '../components/ui/TerminalLoader.jsx';
import AnimatedCounter from '../components/ui/AnimatedCounter.jsx';
import { MessageSquare, Hash, Clock, RefreshCw, ClipboardList, ArrowRight, ExternalLink, Loader, Activity, User, ChevronDown, Search, X, Filter } from 'lucide-react';
import { CHECKLIST_GROUPS, ALL_CHECKLIST_ITEMS, BLOCKER_OPTS, parseBlocker } from '../utils/constants';

export default function Projects() {
  const { projects, loading, fetchProjects } = useProjects();
  const { showToast } = useToast();
  const { canAccessProject, user } = useAuth();
  const [activeFilter, setActiveFilter] = useState('All');
  const [syncing, setSyncing] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [globalSyncing, setGlobalSyncing] = useState(false);
  const [globalSyncMessage, setGlobalSyncMessage] = useState(null);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(null); // Track which project's dropdown is open

  // Filter & Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [pmFilter, setPmFilter] = useState('all');
  const [devFilter, setDevFilter] = useState('all');
  const [sortBy, setSortBy] = useState('lastUpdated');

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchProjects(true);
    setRefreshing(false);
  };

  const handleGlobalSync = async () => {
    setGlobalSyncing(true);
    setGlobalSyncMessage('Starting global sync...');

    try {
      const res = await api.post('/sync/global');
      setGlobalSyncMessage('Sync completed successfully!');
      showToast(res.data.message, 'success');
      setTimeout(() => {
        setGlobalSyncing(false);
        setGlobalSyncMessage(null);
        fetchProjects(true);
      }, 2000);
    } catch (e) {
      setGlobalSyncMessage(null);
      showToast(e.response?.data?.error || 'Global sync failed', 'error');
      setGlobalSyncing(false);
    }
  };

  // Apply access control first (RLS-based filtering)
  const accessibleProjects = projects.filter(p => canAccessProject(p));

  // Get unique PMs and Devs for filter dropdowns
  const uniquePMs = ['all', ...new Set(accessibleProjects.map(p => p.owner).filter(Boolean))];
  const uniqueDevs = ['all', ...new Set(accessibleProjects.map(p => p.developer).filter(Boolean))];

  // Apply all filters
  let filteredProjects = activeFilter === 'All'
    ? accessibleProjects
    : accessibleProjects.filter(p => p.category === activeFilter);

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

  // Apply sort
  const sortedProjects = [...filteredProjects].sort((a, b) => {
    if (sortBy === 'lastUpdated') {
      const dateA = a.stats?.last_active ? new Date(a.stats.last_active) : new Date(0);
      const dateB = b.stats?.last_active ? new Date(b.stats.last_active) : new Date(0);
      return dateB - dateA;
    } else if (sortBy === 'name') {
      return a.client_name.localeCompare(b.client_name);
    } else if (sortBy === 'status') {
      const order = { 'Launched': 1, 'Ready': 2, 'Almost Ready': 3, 'New / In Progress': 4, 'Stuck / On Hold': 5 };
      return (order[a.category] || 99) - (order[b.category] || 99);
    }
    return 0;
  });

  const clearFilters = () => {
    setSearchTerm('');
    setPmFilter('all');
    setDevFilter('all');
    setSortBy('lastUpdated');
  };

  const activeFiltersCount = (searchTerm ? 1 : 0) + (pmFilter !== 'all' ? 1 : 0) + (devFilter !== 'all' ? 1 : 0);

  const getFilterCount = (filter) => {
    if (filter === 'All') return projects.length;
    return projects.filter(p => p.category === filter).length;
  };

  // Track syncing message counts for animation
  const [syncProgress, setSyncProgress] = useState({});

  const handleSync = async (projectId) => {
    setSyncing(projectId);

    try {
      await api.post('/sync-history', { project_id: projectId });

      // Force refresh projects to get updated counts
      await fetchProjects(true);
      setSyncing(null);
    } catch (err) {
      setSyncing(null);
    }
  };

  const timeAgo = (dateString) => {
    if (!dateString) return "No activity yet";
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const getTheme = (category) => {
    switch (category) {
      case 'Launched': return { card: 'bg-white dark:bg-gray-800 border-purple-200 dark:border-purple-500', badge: 'bg-purple-100 text-purple-700' };
      case 'Stuck / On Hold': return { card: 'bg-white dark:bg-gray-800 border-red-200 dark:border-red-500', badge: 'bg-red-100 text-red-700' };
      case 'Almost Ready': return { card: 'bg-white dark:bg-gray-800 border-yellow-200 dark:border-yellow-500', badge: 'bg-yellow-100 text-yellow-800' };
      case 'Ready': return { card: 'bg-white dark:bg-gray-800 border-green-200 dark:border-green-500', badge: 'bg-green-100 text-green-700' };
      default: return { card: 'bg-white dark:bg-gray-800 border-gray-200 dark:border-blue-500', badge: 'bg-blue-100 text-blue-700' };
    }
  };

  const getShortStatus = (category) => {
    switch (category) {
      case 'New / In Progress': return 'New';
      case 'Almost Ready': return 'Almost';
      case 'Stuck / On Hold': return 'Stuck';
      case 'Ready': return 'Ready';
      case 'Launched': return 'Live';
      default: return 'New';
    }
  };

  const getLaunchStatus = (launchDate, category) => {
    // If project is already launched, show LIVE
    if (category === 'Launched') {
      return { label: 'LIVE', color: 'bg-purple-100 text-purple-700 border-purple-200' };
    }

    if (!launchDate) return { label: 'TBD', color: 'bg-gray-100 text-gray-600 border-gray-200' };

    const now = new Date();
    const launch = new Date(launchDate);
    const daysUntil = Math.ceil((launch - now) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) return { label: 'Overdue', color: 'bg-red-100 text-red-700 border-red-200' };
    if (daysUntil <= 14) return { label: 'At Risk', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
    return { label: 'On Track', color: 'bg-green-100 text-green-700 border-green-200' };
  };

  if (loading && projects.length === 0) return <TerminalLoader />;

  return (
    <div className="max-w-7xl mx-auto p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Overview of all client communications</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white dark:bg-gray-800 border border-gray-200 p-1 rounded-lg shadow-sm">
            {['All', 'New / In Progress', 'Almost Ready', 'Ready', 'Launched', 'Stuck / On Hold'].map(filter => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition ${activeFilter === filter ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 dark:bg-gray-900'}`}
              >
                {filter === 'All' ? 'All' : filter.split(' / ')[0]}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeFilter === filter ? 'bg-white dark:bg-gray-800 text-black' : 'bg-gray-100 text-gray-500'}`}>{getFilterCount(filter)}</span>
              </button>
            ))}
          </div>
          <button onClick={handleRefresh} disabled={refreshing} className="p-2 bg-white dark:bg-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 disabled:opacity-50">
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
          {(user?.role === 'superadmin' || user?.role === 'internal') && (
            <button
              onClick={handleGlobalSync}
              disabled={globalSyncing}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-bold"
            >
              <RefreshCw size={18} className={globalSyncing ? 'animate-spin' : ''} />
              {globalSyncing ? 'Syncing All...' : 'Sync All Projects'}
            </button>
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

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-black outline-none bg-white dark:bg-gray-800"
          >
            <option value="lastUpdated">Last Updated</option>
            <option value="name">Name (A-Z)</option>
            <option value="status">Status</option>
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

      {/* GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
        {sortedProjects.map((p) => {
          const isPmUpdate = p.stats && p.stats.active_source === 'Report';
          const theme = getTheme(p.category);

          // Calculate Progress
          const checklist = p.migration_checklist || {};
          const completedCount = Object.values(checklist).filter(Boolean).length;
          const totalCount = ALL_CHECKLIST_ITEMS.length;
          const progress = Math.round((completedCount / totalCount) * 100);

          // Blockers
          const { cats: blockers } = parseBlocker(p.blocker);

          return (
            <div key={p.id} className={`group rounded-xl border hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col ${theme.card}`}>
              <div className="p-5 border-b border-black/5">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shrink-0 shadow-sm ${theme.badge}`}>
                      {p.client_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-bold text-gray-900 dark:text-white leading-tight truncate pr-2">{p.client_name}</h2>
                      <div className="relative">
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setStatusDropdownOpen(statusDropdownOpen === p.id ? null : p.id); }}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide mt-1 cursor-pointer hover:opacity-80 ${theme.badge}`}
                        >
                          <span className="hidden sm:inline">{p.category === 'Stuck / On Hold' ? 'On Hold' : (p.category || 'New')}</span>
                          <span className="sm:hidden">{getShortStatus(p.category)}</span>
                          <ChevronDown size={10} />
                        </button>
                        {statusDropdownOpen === p.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setStatusDropdownOpen(null); }} />
                            <div className="absolute left-0 top-full mt-1 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 z-50 py-1">
                              {['New / In Progress', 'Almost Ready', 'Ready', 'Launched', 'Stuck / On Hold'].map(cat => (
                                <button
                                  key={cat}
                                  onClick={async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    try {
                                      await api.post(`/projects/${p.id}/update-report`, { updates: { category: cat } });
                                      showToast('Status updated!', 'success');
                                      fetchProjects(true);
                                      setStatusDropdownOpen(null);
                                    } catch (err) { showToast('Failed to update', 'error'); }
                                  }}
                                  className={`w-full text-left px-3 py-1.5 text-[10px] font-semibold hover:bg-gray-50 dark:bg-gray-900 ${p.category === cat ? 'bg-blue-50 text-blue-600' : 'text-gray-700'}`}
                                >
                                  {cat}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Launch Status & Date - Below Stage */}
                      {(() => {
                        const launchStatus = getLaunchStatus(p.launch_date_public, p.category);
                        return (
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border ${launchStatus.color}`}>
                              {launchStatus.label}
                            </span>
                            {p.launch_date_public && (
                              <span className="text-[9px] text-gray-500 dark:text-gray-400 font-medium">
                                {new Date(p.launch_date_public).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {/* Migration Progress */}
                    <div className="bg-gray-100 dark:bg-gray-700 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600">
                      <div className="text-xl font-black text-gray-900 dark:text-white leading-none">{progress}%</div>
                      <div className="text-[8px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">Migration</div>
                    </div>
                    {/* Team Info */}
                    <div className="text-[9px] text-gray-500 dark:text-gray-400 text-right">
                      <div className="font-bold">PM: {p.owner || 'Unassigned'}</div>
                      <div className="font-bold">Dev: {p.developer || 'Unassigned'}</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-5 space-y-4 flex-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white dark:bg-gray-800/60 p-2.5 rounded-lg border border-black/5 group/msgs">
                    <div className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 flex items-center gap-1 mb-0.5">
                      <MessageSquare size={10} /> Messages
                    </div>
                    <div className={`text-lg font-bold ${syncing === p.id ? 'text-blue-600' : 'text-gray-900 dark:text-white'}`}>
                      {syncing === p.id ? (
                        <span className="animate-pulse flex items-center gap-1">
                          <RefreshCw size={14} className="animate-spin" /> Syncing...
                        </span>
                      ) : (
                        <>
                          {/* Show total normally, show breakdown on hover */}
                          <span className="group-hover/msgs:hidden">
                            {p.stats?.total_messages || 0}
                          </span>
                          <span className="hidden group-hover/msgs:inline text-[13px]">
                            <span className="text-blue-600">{p.stats?.internal_messages || 0}</span>
                            <span className="text-gray-400 dark:text-gray-500 mx-1">int</span>
                            <span className="text-green-600">{p.stats?.external_messages || 0}</span>
                            <span className="text-gray-400 dark:text-gray-500 ml-1">ext</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-800/60 p-2.5 rounded-lg border border-black/5 relative">
                    <div className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 flex items-center gap-1 mb-0.5">
                      {isPmUpdate ? <User size={10} /> : <MessageSquare size={10} />} {isPmUpdate ? "PM Update" : "Slack Activity"}
                    </div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {timeAgo(p.stats ? p.stats.last_active : null)}
                    </div>
                  </div>
                </div>
                <div>
                  <Link to={`/projects/${p.id}`} state={{ from: '/' }} className="block w-full text-left p-3 bg-white dark:bg-gray-800/80 hover:bg-white dark:bg-gray-800 border border-black/5 hover:border-blue-300 rounded-lg transition group shadow-sm">
                    <div className="flex justify-between items-center gap-2">
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed">
                        {p.status_detail || "No status update recorded yet."}
                      </p>
                      <ArrowRight size={14} className="text-gray-300 group-hover:text-blue-600 shrink-0 transition-colors" />
                    </div>
                  </Link>
                </div>
                <div className="space-y-1 pt-1 border-t border-black/5">
                  {(blockers.length > 0) ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {blockers.map(b => (
                        <span key={b} className="px-1.5 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded text-[10px] font-bold uppercase tracking-wide">{b}</span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] text-gray-400 dark:text-gray-500 italic py-1">No active blockers</div>
                  )}
                </div>
              </div>
              <div className="px-5 py-3 bg-white dark:bg-gray-800/40 border-t border-black/5 flex justify-between items-center">
                <div className="group/sync relative flex items-center">
                  <button onClick={() => handleSync(p.id)} disabled={syncing === p.id} className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1 hover:text-blue-600 disabled:opacity-50">
                    <RefreshCw size={10} className={syncing === p.id ? "animate-spin" : ""} /> {syncing === p.id ? "SYNCING..." : "SYNC"}
                  </button>
                  {/* Hover tooltip for channels */}
                  <div className="absolute bottom-full left-0 mb-2 w-max bg-black text-white text-[10px] p-2 rounded shadow-lg opacity-0 group-hover/sync:opacity-100 transition pointer-events-none z-10 flex gap-2">
                    <span className="font-mono opacity-80">INT: {p.channel_id_internal ? 'Connected' : '-'}</span>
                    <span className="font-mono opacity-80">EXT: {p.channel_id_external ? 'Connected' : '-'}</span>
                  </div>
                </div>
                <Link to={`/projects/${p.id}`} state={{ from: '/' }} className="text-[10px] font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1 hover:underline">
                  OPEN DETAILS <ArrowRight size={10} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}