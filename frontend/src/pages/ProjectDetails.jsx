import React, { useEffect, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useProjects } from '../context/ProjectsContext';
import { useAuth } from '../context/AuthContext';
import TerminalLoader from '../components/ui/TerminalLoader';
import {
    ArrowLeft, MessageSquare, ClipboardList, Save, Clock,
    Hash, Code, User, Globe, Key, CheckSquare,
    Plus, Trash2, Users, ExternalLink, Loader, AlertCircle, ChevronDown, Mail
} from 'lucide-react';
import { CHECKLIST_GROUPS, ALL_CHECKLIST_ITEMS, BLOCKER_OPTS, parseBlocker } from '../utils/constants';

export default function ProjectDetails() {
    const { id } = useParams();
    const { projects, loading: globalLoading, fetchProjects } = useProjects(); // Use Global Context
    const [project, setProject] = useState(null);
    const [logs, setLogs] = useState([]);
    const [userMap, setUserMap] = useState({});
    const [activeTab, setActiveTab] = useState('report');
    const [visibilityTab, setVisibilityTab] = useState('internal');
    const [loading, setLoading] = useState(true);
    const [logsLoading, setLogsLoading] = useState(false);
    const [messageCounts, setMessageCounts] = useState({ internal: 0, external: 0, emails: 0 });
    const [countsLoading, setCountsLoading] = useState(false);

    const { showToast } = useToast();
    const { canEditProject, canViewInternalChannel } = useAuth();
    const [formData, setFormData] = useState({});
    const [checklist, setChecklist] = useState({});
    const [stakeholders, setStakeholders] = useState([]);
    const [teamMembers, setTeamMembers] = useState([]); // Internal team for PM/Dev dropdowns
    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

    useEffect(() => {
        if (globalLoading && projects.length === 0) return; // Wait for global load

        // 1. Get Project info instantly from context
        const found = projects.find(p => p.id.toString() === id);
        if (found) {
            setProject(found);
            const { cats, desc } = parseBlocker(found.blocker);
            setFormData({
                status_detail: found.status_detail || "",
                blocker_cats: cats,
                blocker_desc: desc,
                next_call: found.next_call || "",
                last_contact_date: found.last_contact_date || "",
                comm_channels: found.comm_channels || "",
                category: found.category || "New / In Progress",
                owner: found.owner || "",
                developer: found.developer || "",
                shopify_url: found.shopify_url || "",
                shopline_url: found.shopline_url || "",
                shopline_preview_pass: found.shopline_preview_pass || "",
                live_url: found.live_url || "",
                other_url: found.other_url || "",
                launch_date_internal: found.launch_date_internal || "",
                launch_date_public: found.launch_date_public || "",
                merchant_name: found.merchant_name || "",
                merchant_email: found.merchant_email || "",
                channel_id_internal: found.channel_id_internal || "",
                channel_id_external: found.channel_id_external || ""
            });
            const dbChecklist = found.migration_checklist || {};
            const orderedChecklist = {};
            ALL_CHECKLIST_ITEMS.forEach(key => orderedChecklist[key] = dbChecklist[key] || false);
            setChecklist(orderedChecklist);
            setStakeholders(found.stakeholders || []);
            setLoading(false); // Stop loading UI immediately for metadata
        }

        // 2. Fetch Channel Members for stakeholders
        const fetchChannelMembers = async () => {
            try {
                const membersRes = await api.get(`/projects/${id}/channel-members`);
                setUserMap(membersRes.data || []);
            } catch (e) {
                console.error(e);
                setUserMap([]);
            }
        };
        fetchChannelMembers();

        // 3. Fetch Team Members for PM/Dev dropdowns
        const fetchTeam = async () => {
            try {
                const tRes = await api.get('/settings/team');
                setTeamMembers(tRes.data || []);
            } catch (e) { console.error(e); }
        };
        fetchTeam();

    }, [id, projects, globalLoading]);

    // Set message counts from cached project data
    useEffect(() => {
        if (!project) return;

        // Use cached counts from database (updated by trigger)
        const internal = project.comm_count_internal || 0;
        const external = project.comm_count_external || 0;
        const emails = external; // Emails are counted as external messages

        setMessageCounts({
            internal,
            external,
            emails
        });
    }, [project]);

    // Fetch messages when visibility tab changes
    useEffect(() => {
        if (!id) return;

        const loadMessages = async () => {
            if (activeTab !== 'chat') return;

            setLogsLoading(true);
            try {
                if (visibilityTab === 'emails') {
                    // Fetch emails
                    const emailsRes = await api.get(`/projects/${id}/emails`);
                    setLogs(emailsRes.data || []);
                } else {
                    // Fetch Slack messages
                    const logsRes = await api.get(`/projects/${id}/logs`, { params: { visibility: visibilityTab } });
                    setLogs(logsRes.data);
                }
            } catch (e) {
                console.error('Failed to load messages:', e);
                setLogs([]);
            }
            setLogsLoading(false);
        };
        loadMessages();
    }, [id, visibilityTab, activeTab]);

    const handleSaveReport = async () => {
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
                blocker: finalBlocker,
                migration_checklist: checklist,
                stakeholders: stakeholders
            };

            // Remove temporary fields
            delete finalUpdates.blocker_cats;
            delete finalUpdates.blocker_desc;

            await api.post(`/projects/${id}/update-report`, {
                user_email: "leo@flyrank.com",
                updates: finalUpdates
            });

            // Update local project state immediately
            setProject(prev => ({ ...prev, ...finalUpdates, blocker: finalBlocker }));

            // Refresh global projects context
            await fetchProjects(true);

            showToast("Project Data Saved!", "success");
        } catch (err) { showToast("Error saving: " + err.message, "error"); }
    };

    const toggleBlockerCat = (cat) => {
        setFormData(prev => {
            const cats = prev.blocker_cats || [];
            return cats.includes(cat)
                ? { ...prev, blocker_cats: cats.filter(c => c !== cat) }
                : { ...prev, blocker_cats: [...cats, cat] };
        });
    };

    const addStakeholder = () => setStakeholders([...stakeholders, { name: "", alias: "", role: "Merchant", title: "", email: "", isManual: false }]);
    const removeStakeholder = (i) => { const n = [...stakeholders]; n.splice(i, 1); setStakeholders(n); };
    const updateStakeholder = (i, f, v) => {
        const n = [...stakeholders];
        n[i][f] = v;

        // Auto-fill email when selecting from dropdown
        if (f === 'name' && !n[i].isManual) {
            const member = userMap.find(m => m.name === v);
            if (member) {
                n[i].email = member.email || '';
            }
        }

        setStakeholders(n);
    };
    const toggleManualEntry = (i) => {
        const n = [...stakeholders];
        n[i].isManual = !n[i].isManual;
        if (n[i].isManual) {
            n[i].name = '';
            n[i].email = '';
        }
        setStakeholders(n);
    };
    const toggleChecklist = (key) => setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
    const formatMessage = (text) => text?.replace(/<@([A-Z0-9]+)>/g, (_, uid) => userMap[uid] ? `@${userMap[uid]}` : `@${uid}`) || "";
    const getDevName = (devId) => {
        if (!devId) return "Unassigned";
        if (devId.startsWith("U") && userMap[devId]) return userMap[devId];
        return devId;
    };

    if (loading) return <TerminalLoader />;
    if (!project) return <div className="p-10 text-center text-red-500 font-bold">Project not found</div>;

    const completedCount = Object.values(checklist).filter(Boolean).length;
    const totalCount = ALL_CHECKLIST_ITEMS.length;
    const progress = Math.round((completedCount / totalCount) * 100);

    const location = useLocation();
    const backPath = location.state?.from || '/';

    return (
        <div className="max-w-7xl mx-auto p-6 min-h-screen bg-gray-50 font-sans">
            <Link to={backPath} className="flex items-center gap-2 text-gray-500 hover:text-black mb-6 font-medium text-sm">
                <ArrowLeft size={16} /> Back
            </Link>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h1 className="text-3xl font-black text-gray-900 mb-2">{project.client_name}</h1>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                                {/* PM - Inline Edit for superadmin/internal */}
                                {canEditProject() ? (
                                    <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded border border-gray-100 group hover:border-blue-300 transition">
                                        <User size={14} />
                                        <span className="text-gray-500">PM:</span>
                                        <select
                                            value={formData.owner || ''}
                                            onChange={async (e) => {
                                                const newOwner = e.target.value;
                                                setFormData(prev => ({ ...prev, owner: newOwner }));
                                                try {
                                                    await api.post(`/projects/${id}/update-report`, {
                                                        user_email: 'system',
                                                        updates: { owner: newOwner }
                                                    });
                                                    // Update local project state
                                                    setProject(prev => ({ ...prev, owner: newOwner }));
                                                    // Refresh global context
                                                    await fetchProjects(true);
                                                    showToast('PM updated!', 'success');
                                                } catch (err) {
                                                    showToast('Failed to update PM', 'error');
                                                }
                                            }}
                                            className="font-bold bg-transparent border-none outline-none cursor-pointer pr-4 appearance-none hover:text-blue-600"
                                        >
                                            <option value="">Unassigned</option>
                                            {teamMembers.filter(m => m.role === 'PM' || m.role === 'Both').map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                                        </select>
                                        <ChevronDown size={12} className="text-gray-400 -ml-3" />
                                    </div>
                                ) : (
                                    <span className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                        <User size={14} /> PM: <b>{project.owner || '-'}</b>
                                    </span>
                                )}

                                {/* Dev - Inline Edit for superadmin/internal */}
                                {canEditProject() ? (
                                    <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded border border-gray-100 group hover:border-blue-300 transition">
                                        <Code size={14} />
                                        <span className="text-gray-500">Dev:</span>
                                        <select
                                            value={formData.developer || ''}
                                            onChange={async (e) => {
                                                const newDev = e.target.value;
                                                setFormData(prev => ({ ...prev, developer: newDev }));
                                                try {
                                                    await api.post(`/projects/${id}/update-report`, {
                                                        user_email: 'system',
                                                        updates: { developer: newDev }
                                                    });
                                                    // Update local project state
                                                    setProject(prev => ({ ...prev, developer: newDev }));
                                                    // Refresh global context
                                                    await fetchProjects(true);
                                                    showToast('Developer updated!', 'success');
                                                } catch (err) {
                                                    showToast('Failed to update Developer', 'error');
                                                }
                                            }}
                                            className="font-bold bg-transparent border-none outline-none cursor-pointer pr-4 appearance-none hover:text-blue-600"
                                        >
                                            <option value="">Unassigned</option>
                                            {teamMembers.filter(m => m.role === 'Dev' || m.role === 'Both').map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                                        </select>
                                        <ChevronDown size={12} className="text-gray-400 -ml-3" />
                                    </div>
                                ) : (
                                    <span className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                        <Code size={14} /> Dev: <b>{getDevName(project.developer)}</b>
                                    </span>
                                )}

                                <span className="flex items-center gap-1 text-xs">
                                    <Hash size={14} /> {project.channel_id_internal ? (
                                        <span className="font-semibold">
                                            {messageCounts.internal}i • {messageCounts.external}e • {messageCounts.emails}m
                                        </span>
                                    ) : 'No Channel'}
                                </span>
                            </div>
                        </div>
                        {/* Clickable Status Badge - Click to open */}
                        <div className="relative">
                            <button
                                onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                                className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase cursor-pointer hover:opacity-80 transition flex items-center gap-1 whitespace-nowrap ${project.category === 'Launched' ? 'bg-purple-100 text-purple-700' :
                                    project.category === 'Almost Ready' ? 'bg-yellow-100 text-yellow-700' :
                                        project.category === 'Ready' ? 'bg-green-100 text-green-700' :
                                            project.category === 'Stuck / On Hold' ? 'bg-red-100 text-red-700' :
                                                'bg-blue-100 text-blue-700'
                                    }`}>
                                {project.category === 'Stuck / On Hold' ? 'On Hold' : (project.category || 'New')}
                                <ChevronDown size={10} />
                            </button>
                            {statusDropdownOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setStatusDropdownOpen(false)} />
                                    <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-xl border border-gray-200 z-50 py-1">
                                        {['New / In Progress', 'Almost Ready', 'Ready', 'Launched', 'Stuck / On Hold'].map(cat => (
                                            <button
                                                key={cat}
                                                onClick={async () => {
                                                    try {
                                                        await api.post(`/projects/${id}/update-report`, { updates: { category: cat } });
                                                        setProject({ ...project, category: cat });
                                                        fetchProjects(true); // Refresh global context
                                                        showToast('Status updated!', 'success');
                                                        setStatusDropdownOpen(false);
                                                    } catch (err) { showToast('Failed to update', 'error'); }
                                                }}
                                                className={`w-full text-left px-3 py-1.5 text-[11px] font-semibold hover:bg-gray-50 ${project.category === cat ? 'bg-blue-50 text-blue-600' : 'text-gray-700'}`}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 border-t border-gray-100 pt-6">
                        <div className="overflow-hidden">
                            <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Live Domain</div>
                            {project.live_url ? (
                                <a href={project.live_url.startsWith('http') ? project.live_url : `https://${project.live_url}`} target="_blank" rel="noreferrer" className="text-sm font-bold text-blue-600 hover:underline flex items-center gap-1 truncate">
                                    <span className="truncate">{project.live_url}</span> <ExternalLink size={10} className="flex-shrink-0" />
                                </a>
                            ) : <span className="text-xs text-gray-300 italic">Not deployed</span>}
                        </div>
                        <div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Launch (Internal)</div>
                            <div className="font-mono text-sm">{project.launch_date_internal || "-"}</div>
                        </div>
                        <div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Launch (Public)</div>
                            <div className="font-mono text-sm font-bold text-green-700">{project.launch_date_public || "-"}</div>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 flex flex-col justify-center">
                    <h3 className="text-gray-500 font-bold text-xs uppercase mb-4 flex items-center gap-2">
                        <CheckSquare size={14} /> Migration Progress
                    </h3>
                    <div className="flex items-end gap-2 mb-2">
                        <span className="text-4xl font-black text-gray-900">{progress}%</span>
                        <span className="text-gray-400 text-sm mb-1">completed</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div className="bg-green-500 h-full rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                    </div>
                    <div className="mt-4 text-xs text-gray-400">
                        {completedCount} of {totalCount} tasks done
                    </div>
                </div>
            </div>

            <div className="flex border-b border-gray-200 mb-6 bg-white px-4 rounded-t-xl overflow-x-auto">
                <button onClick={() => setActiveTab('report')} className={`px-6 py-4 font-bold text-sm border-b-2 transition whitespace-nowrap ${activeTab === 'report' ? 'border-black' : 'border-transparent text-gray-400'}`}>Status & Checklist</button>
                <button onClick={() => setActiveTab('info')} className={`px-6 py-4 font-bold text-sm border-b-2 transition whitespace-nowrap ${activeTab === 'info' ? 'border-black' : 'border-transparent text-gray-400'}`}>Metadata & Stakeholders</button>
                <button onClick={() => setActiveTab('chat')} className={`px-6 py-4 font-bold text-sm border-b-2 transition whitespace-nowrap ${activeTab === 'chat' ? 'border-black' : 'border-transparent text-gray-400'}`}>
                    Communication ({countsLoading ? '...' : messageCounts.internal + messageCounts.external + messageCounts.emails})
                </button>
                <button onClick={() => setActiveTab('settings')} className={`px-6 py-4 font-bold text-sm border-b-2 transition whitespace-nowrap ${activeTab === 'settings' ? 'border-black' : 'border-transparent text-gray-400'}`}>Project Settings</button>
            </div>

            {activeTab === 'report' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                            <h3 className="font-bold text-lg mb-4">Latest Notes</h3>
                            <textarea className="w-full border border-gray-300 rounded-lg p-3 h-32 focus:ring-2 focus:ring-black outline-none text-sm" value={formData.status_detail} onChange={e => setFormData({ ...formData, status_detail: e.target.value })} />
                            <div className="grid grid-cols-2 gap-4 mt-4">
                                <div className="bg-red-50 p-4 rounded-lg border border-red-100 mt-4">
                                    <label className="block text-xs font-bold text-red-600 uppercase mb-2 flex items-center gap-2"><AlertCircle size={14} /> Blockers</label>
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {BLOCKER_OPTS.map(opt => (
                                            <button
                                                key={opt}
                                                onClick={() => toggleBlockerCat(opt)}
                                                className={`px-3 py-1.5 rounded text-xs font-bold border transition ${formData.blocker_cats?.includes(opt)
                                                    ? 'bg-red-600 text-white border-red-600 shadow-sm'
                                                    : 'bg-white text-gray-600 border-red-200 hover:bg-red-100'
                                                    }`}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                    <textarea
                                        className="w-full border border-red-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-red-500 outline-none bg-white min-h-[60px]"
                                        value={formData.blocker_desc}
                                        onChange={e => setFormData({ ...formData, blocker_desc: e.target.value })}
                                        placeholder="Explain the blocker..."
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div><label className="text-xs font-bold text-gray-500 uppercase">Next Call</label><input type="date" className="w-full border border-gray-300 rounded p-2 text-sm" value={formData.next_call} onChange={e => setFormData({ ...formData, next_call: e.target.value })} /></div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                            <h3 className="font-bold text-lg mb-6">Migration Checklist</h3>
                            <div className="space-y-8">
                                {Object.entries(CHECKLIST_GROUPS).map(([groupName, items]) => (
                                    <div key={groupName}>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase border-b border-gray-100 pb-2 mb-3 tracking-wider">{groupName}</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                                            {items.map(key => (
                                                <label key={key} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer transition group">
                                                    <input type="checkbox" checked={checklist[key] || false} onChange={() => toggleChecklist(key)} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300" />
                                                    <span className={`text-sm transition-colors ${checklist[key] ? 'text-gray-400 line-through' : 'text-gray-700 font-medium'}`}>{key}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <button onClick={handleSaveReport} className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 flex justify-center gap-2 shadow-lg transition"><Save size={18} /> Save All Changes</button>
                    </div>
                    <div>
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm sticky top-6">
                            <h3 className="font-bold mb-4 flex items-center gap-2"><Clock size={16} /> Audit Log</h3>
                            <div className="space-y-6 pl-4 border-l-2 border-gray-100">
                                {project.history?.slice(0, 5).map((h, i) => {
                                    const date = new Date(h.timestamp);
                                    const now = new Date();
                                    const diffMs = now - date;
                                    const diffMins = Math.floor(diffMs / 60000);
                                    const diffHours = Math.floor(diffMins / 60);
                                    const diffDays = Math.floor(diffHours / 24);
                                    let relTime = '';
                                    if (diffMins < 1) relTime = 'just now';
                                    else if (diffMins < 60) relTime = `${diffMins}m ago`;
                                    else if (diffHours < 24) relTime = `${diffHours}h ago`;
                                    else if (diffDays === 1) relTime = 'yesterday';
                                    else relTime = `${diffDays}d ago`;

                                    return (
                                        <div key={i} className="relative">
                                            <div className="text-[10px] text-gray-400 mb-1">
                                                {date.toLocaleDateString()} · <span className="text-gray-500">{relTime}</span>
                                            </div>
                                            {Object.keys(h.changes).map(k => (
                                                <div key={k} className="text-xs mb-1"><span className="font-bold capitalize">{k}:</span> <span className="text-green-600">{h.changes[k].new}</span></div>
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'info' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="font-bold text-lg mb-6 flex items-center gap-2"><Globe size={18} /> Project Links</h3>
                        <div className="space-y-4">
                            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Live Domain</label><input className="w-full border border-gray-300 rounded p-2 text-sm" value={formData.live_url} onChange={e => setFormData({ ...formData, live_url: e.target.value })} placeholder="https://..." /></div>
                            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Shopify URL</label><input className="w-full border border-gray-300 rounded p-2 text-sm" value={formData.shopify_url} onChange={e => setFormData({ ...formData, shopify_url: e.target.value })} /></div>
                            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Shopline URL</label><input className="w-full border border-gray-300 rounded p-2 text-sm text-blue-600 font-medium" value={formData.shopline_url} onChange={e => setFormData({ ...formData, shopline_url: e.target.value })} /></div>
                            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Shopline Preview Pass</label><div className="flex items-center gap-2"><Key size={14} className="text-gray-400" /><input className="w-full border border-gray-300 rounded p-2 text-sm font-mono" value={formData.shopline_preview_pass} onChange={e => setFormData({ ...formData, shopline_preview_pass: e.target.value })} /></div></div>
                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">PM (Owner)</label>
                                    <select className="w-full border border-gray-300 rounded p-2 text-sm outline-none bg-white" value={formData.owner} onChange={e => setFormData({ ...formData, owner: e.target.value })}>
                                        <option value="">Unassigned</option>
                                        {teamMembers.filter(m => m.role === 'PM' || m.role === 'Both').map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Developer</label>
                                    <select className="w-full border border-gray-300 rounded p-2 text-sm outline-none bg-white" value={formData.developer} onChange={e => setFormData({ ...formData, developer: e.target.value })}>
                                        <option value="">Unassigned</option>
                                        {teamMembers.filter(m => m.role === 'Dev' || m.role === 'Both').map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Slack Channels Section */}
                    <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="font-bold text-lg mb-6 flex items-center gap-2"><Hash size={18} /> Slack Channels</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Internal Channel ID</label>
                                <input
                                    className="w-full border border-gray-300 rounded p-2 text-sm font-mono"
                                    value={formData.channel_id_internal}
                                    onChange={e => setFormData({ ...formData, channel_id_internal: e.target.value })}
                                    placeholder="C0123456789"
                                />
                                <p className="text-[10px] text-gray-400 mt-1">Find in Slack: Right-click channel → View channel details → Copy channel ID</p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">External Channel ID</label>
                                <input
                                    className="w-full border border-gray-300 rounded p-2 text-sm font-mono"
                                    value={formData.channel_id_external}
                                    onChange={e => setFormData({ ...formData, channel_id_external: e.target.value })}
                                    placeholder="C0123456789"
                                />
                                <p className="text-[10px] text-gray-400 mt-1">For private/connect channels not visible in Scanner</p>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 mt-4">
                                <div className="text-[10px] uppercase font-bold text-gray-400 mb-2">Current Status</div>
                                <div className="flex gap-4 text-xs">
                                    <span className={`flex items-center gap-1 ${formData.channel_id_internal ? 'text-green-600' : 'text-gray-400'}`}>
                                        <Hash size={12} /> Internal: {formData.channel_id_internal ? '✓ Connected' : '✗ Not set'}
                                    </span>
                                    <span className={`flex items-center gap-1 ${formData.channel_id_external ? 'text-green-600' : 'text-gray-400'}`}>
                                        <Hash size={12} /> External: {formData.channel_id_external ? '✓ Connected' : '✗ Not set'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg flex items-center gap-2"><Users size={18} /> Stakeholders</h3>
                            <button onClick={addStakeholder} className="text-xs font-bold flex items-center gap-1 bg-black text-white px-3 py-1.5 rounded hover:bg-gray-800"><Plus size={12} /> Add</button>
                        </div>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {stakeholders.map((person, index) => (
                                <div key={index} className="bg-gray-50 p-3 rounded border border-gray-100 space-y-2">
                                    {/* First Row - Name/Dropdown + Role */}
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 min-w-0">
                                            {person.isManual ? (
                                                <input
                                                    placeholder="Name"
                                                    className="w-full bg-white text-sm font-bold outline-none border border-gray-200 rounded px-2 py-1.5"
                                                    value={person.name}
                                                    onChange={(e) => updateStakeholder(index, 'name', e.target.value)}
                                                />
                                            ) : (
                                                <select
                                                    className="w-full bg-white text-sm font-bold outline-none border border-gray-200 rounded px-2 py-1.5"
                                                    value={person.name}
                                                    onChange={(e) => updateStakeholder(index, 'name', e.target.value)}
                                                >
                                                    <option value="">Select from channel...</option>
                                                    {Array.isArray(userMap) && userMap.map((member) => <option key={member.slack_id} value={member.name}>{member.name}</option>)}
                                                </select>
                                            )}
                                        </div>
                                        <select
                                            className="bg-white text-xs border border-gray-200 rounded px-2 py-1.5 outline-none"
                                            value={person.role}
                                            onChange={(e) => updateStakeholder(index, 'role', e.target.value)}
                                        >
                                            <option>Merchant</option>
                                            <option>Shopline Rep</option>
                                            <option>Agency Partner</option>
                                            <option>Other</option>
                                        </select>
                                        <button
                                            onClick={() => toggleManualEntry(index)}
                                            className="text-gray-400 hover:text-blue-600 text-xs whitespace-nowrap px-1"
                                            title={person.isManual ? "Switch to dropdown" : "Manual entry"}
                                        >
                                            {person.isManual ? '🔽' : '✏️'}
                                        </button>
                                        <button onClick={() => removeStakeholder(index)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                                    </div>
                                    {/* Second Row - Alias + Title + Email */}
                                    <div className="flex items-center gap-2">
                                        <input
                                            placeholder="Alias (optional)"
                                            className="flex-1 min-w-0 bg-white text-xs outline-none border border-gray-200 rounded px-2 py-1.5"
                                            value={person.alias || ''}
                                            onChange={(e) => updateStakeholder(index, 'alias', e.target.value)}
                                        />
                                        <input
                                            placeholder="Title (CEO, CTO...)"
                                            className="flex-1 min-w-0 bg-white text-xs outline-none border border-gray-200 rounded px-2 py-1.5"
                                            value={person.title || ''}
                                            onChange={(e) => updateStakeholder(index, 'title', e.target.value)}
                                        />
                                        <input
                                            placeholder="email"
                                            className="flex-1 min-w-0 bg-white text-xs outline-none border border-gray-200 rounded px-2 py-1.5"
                                            value={person.email}
                                            onChange={(e) => updateStakeholder(index, 'email', e.target.value)}
                                        />
                                    </div>
                                </div>
                            ))}
                            {stakeholders.length === 0 && (
                                <p className="text-sm text-gray-400 text-center py-4">No stakeholders added yet</p>
                            )}
                        </div>
                    </div>
                    <div className="col-span-1 md:col-span-2 pt-4 border-t border-gray-100 text-right"><button onClick={handleSaveReport} className="bg-black text-white px-8 py-3 rounded-lg font-bold hover:bg-gray-800 inline-flex items-center gap-2 shadow-lg transition"><Save size={18} /> Save Metadata</button></div>
                </div>
            )
            }

            {
                activeTab === 'settings' && (
                    <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm max-w-4xl">
                        <h2 className="text-2xl font-bold mb-6">Project Settings</h2>

                        <div className="space-y-6">
                            {/* Slack Channels Section */}
                            <div className="border-b border-gray-100 pb-6">
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <Hash size={18} /> Slack Channels
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Internal Channel ID</label>
                                        <input
                                            className="w-full border border-gray-300 rounded-lg p-3 text-sm font-mono focus:ring-2 focus:ring-black outline-none"
                                            value={formData.channel_id_internal || ''}
                                            onChange={e => setFormData({ ...formData, channel_id_internal: e.target.value })}
                                            placeholder="C0123456789"
                                        />
                                        <p className="text-[10px] text-gray-400 mt-1">Find in Slack: Right-click channel → View channel details → Copy channel ID</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">External Channel ID</label>
                                        <input
                                            className="w-full border border-gray-300 rounded-lg p-3 text-sm font-mono focus:ring-2 focus:ring-black outline-none"
                                            value={formData.channel_id_external || ''}
                                            onChange={e => setFormData({ ...formData, channel_id_external: e.target.value })}
                                            placeholder="C0123456789"
                                        />
                                        <p className="text-[10px] text-gray-400 mt-1">For private/connect channels not visible in Scanner</p>
                                    </div>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 mt-4">
                                    <div className="text-[10px] uppercase font-bold text-gray-400 mb-2">Current Status</div>
                                    <div className="flex gap-4 text-xs">
                                        <span className={`flex items-center gap-1 ${formData.channel_id_internal ? 'text-green-600' : 'text-gray-400'}`}>
                                            <Hash size={12} /> Internal: {formData.channel_id_internal ? '✓ Connected' : '✗ Not set'}
                                        </span>
                                        <span className={`flex items-center gap-1 ${formData.channel_id_external ? 'text-green-600' : 'text-gray-400'}`}>
                                            <Hash size={12} /> External: {formData.channel_id_external ? '✓ Connected' : '✗ Not set'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Launch Dates Section */}
                            <div className="pb-6">
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <Clock size={18} /> Launch Dates
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Launch Date (Internal)</label>
                                        <input
                                            type="date"
                                            className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-black outline-none"
                                            value={formData.launch_date_internal || ''}
                                            onChange={e => setFormData({ ...formData, launch_date_internal: e.target.value })}
                                        />
                                        <p className="text-[10px] text-gray-400 mt-1">When internal team can access the site</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Go Live Date (Public)</label>
                                        <input
                                            type="date"
                                            className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                                            value={formData.launch_date_public || ''}
                                            onChange={e => setFormData({ ...formData, launch_date_public: e.target.value })}
                                        />
                                        <p className="text-[10px] text-gray-400 mt-1">Public launch date</p>
                                    </div>
                                </div>
                            </div>

                            {/* Save Button */}
                            <div className="pt-4 border-t border-gray-100 flex justify-end">
                                <button
                                    onClick={handleSaveReport}
                                    className="bg-black text-white px-8 py-3 rounded-lg font-bold hover:bg-gray-800 inline-flex items-center gap-2 shadow-lg transition"
                                >
                                    <Save size={18} /> Save Settings
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                activeTab === 'chat' && (
                    <div className="max-w-3xl mx-auto">
                        {/* Internal / External / Emails Tab Selector */}
                        <div className="flex justify-center mb-6">
                            <div className="flex bg-gray-100 p-1 rounded-xl">
                                {/* Internal tab - only visible to internal team */}
                                {canViewInternalChannel() && (
                                    <button
                                        onClick={() => setVisibilityTab('internal')}
                                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition ${visibilityTab === 'internal' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                        Internal {messageCounts.internal > 0 && `(${messageCounts.internal})`}
                                    </button>
                                )}
                                <button
                                    onClick={() => setVisibilityTab('external')}
                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition ${visibilityTab === 'external' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                    External {messageCounts.external > 0 && `(${messageCounts.external})`}
                                </button>
                                <button
                                    onClick={() => setVisibilityTab('emails')}
                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition ${visibilityTab === 'emails' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    <Mail size={16} />
                                    Emails {messageCounts.emails > 0 && `(${messageCounts.emails})`}
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="space-y-4">
                            {logsLoading ? (
                                <div className="text-center py-10 text-gray-400 font-mono text-sm animate-pulse">Loading messages...</div>
                            ) : logs.length === 0 ? (
                                <div className="text-center py-16 bg-white border border-dashed border-gray-300 rounded-xl text-gray-400">
                                    <MessageSquare size={32} className="mx-auto mb-3 opacity-30" />
                                    <p className="font-medium mb-1">No {visibilityTab} messages found.</p>
                                    <p className="text-xs mb-4">Sync from Slack to load conversation history.</p>
                                    <button
                                        onClick={async () => {
                                            setLogsLoading(true);
                                            try {
                                                if (visibilityTab === 'emails') {
                                                    // For emails, just refetch from API
                                                    const emailsRes = await api.get(`/projects/${id}/emails`);
                                                    setLogs(emailsRes.data || []);
                                                    showToast('Emails refreshed!', 'success');
                                                } else {
                                                    // For Slack messages, sync then fetch
                                                    await api.post('/sync-history', { project_id: id });
                                                    const logsRes = await api.get(`/projects/${id}/logs`, { params: { visibility: visibilityTab } });
                                                    setLogs(logsRes.data);
                                                    showToast('Messages synced!', 'success');
                                                }
                                            } catch (err) {
                                                showToast('Sync failed', 'error');
                                                console.error(err);
                                            }
                                            setLogsLoading(false);
                                        }}
                                        className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition"
                                    >
                                        {visibilityTab === 'emails' ? 'Refresh Emails' : 'Fetch Now'}
                                    </button>
                                </div>
                            ) : (
                                logs.map(log => {
                                    const isReply = log.thread_ts && log.thread_ts !== log.slack_ts;
                                    return (
                                        <div key={log.id} className={`bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex gap-4 ${isReply ? 'ml-12 border-l-4 border-l-gray-300' : ''}`}>
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border shrink-0 ${visibilityTab === 'internal' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-green-50 text-green-600 border-green-100'}`}>{log.sender_name?.charAt(0) || '?'}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-baseline">
                                                    <div className="font-bold text-gray-900">{log.sender_name}</div>
                                                    <div className="text-[10px] text-gray-400 font-mono">{new Date(log.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                                                </div>
                                                <div className="text-sm text-gray-600 mt-1 whitespace-pre-wrap break-words leading-relaxed">{formatMessage(log.content)}</div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )
            }
        </div >
    );
}