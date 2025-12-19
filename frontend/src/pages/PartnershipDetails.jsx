import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../context/ToastContext.jsx';
import TerminalLoader from '../components/ui/TerminalLoader.jsx';
import {
    ArrowLeft, MessageSquare, Users, Mail, RefreshCw, Hash, User
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function PartnershipDetails() {
    const { id } = useParams();
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('communication');
    const [visibilityTab, setVisibilityTab] = useState('external'); // Default to external for partnerships
    const [logs, setLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [members, setMembers] = useState([]);
    const [membersLoading, setMembersLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);

    const { showToast } = useToast();
    const { canViewInternalChannel } = useAuth();

    // 1. Fetch Project Basics
    useEffect(() => {
        const fetchProject = async () => {
            try {
                const res = await api.get('/projects'); // We need to find the specific one, but api.get('/projects') returns a list.
                // Actually, let's use the partnerships endpoint or just rely on the fact that we might need a single project fetcher.
                // The current API structure is a bit list-heavy. Let's try to find it in the list first or request details via existing endpoints?
                // Wait, ProjectDetails used `useProjects` context. Let's do that for consistency if possible, OR fetch specific if we can.
                // To be safe and simple: let's fetch all partnerships and find this one, or just re-use the GET /projects logic if we had a single GET /projects/:id.
                // We don't seem to have a dedicated GET /projects/:id in routes.py shown earlier (only update-report).
                // But wait, `ProjectDetails` found it from context.
                // Let's implement a direct fetch here to be self-contained or use the context.
                // Looking at routes.py, we have `get_projects` and `get_partnerships`.
                // Let's fetch partnerships list and find it.

                const pRes = await api.get('/partnerships');
                const found = pRes.data.find(p => p.id === id);

                if (found) {
                    setProject(found);
                } else {
                    // Fallback check projects just in case
                    const allRes = await api.get('/projects');
                    const foundProject = allRes.data.find(p => p.id === id);
                    if (foundProject) setProject(foundProject);
                }
            } catch (e) {
                console.error("Failed to fetch project", e);
                showToast("Failed to load partnership details", "error");
            } finally {
                setLoading(false);
            }
        };
        fetchProject();
    }, [id]);

    // 2. Fetch Messages (Communication)
    useEffect(() => {
        if (!id || activeTab !== 'communication') return;

        const fetchMessages = async () => {
            setLogsLoading(true);
            try {
                if (visibilityTab === 'emails') {
                    const res = await api.get(`/projects/${id}/emails`);
                    setLogs(res.data || []);
                } else {
                    const res = await api.get(`/projects/${id}/logs`, { params: { visibility: visibilityTab } });
                    setLogs(res.data || []);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLogsLoading(false);
            }
        };
        fetchMessages();
    }, [id, activeTab, visibilityTab]);

    // 3. Fetch Members (Contacts)
    useEffect(() => {
        if (!id || activeTab !== 'contacts') return;

        const fetchMembers = async () => {
            setMembersLoading(true);
            try {
                const res = await api.get(`/projects/${id}/channel-members`);
                setMembers(res.data || []);
            } catch (e) {
                console.error(e);
            } finally {
                setMembersLoading(false);
            }
        };
        fetchMembers();
    }, [id, activeTab]);

    const handleSync = async () => {
        setSyncing(true);
        try {
            await api.post('/sync-history', { project_id: id });
            showToast('Partnership synced!', 'success');
            // Refresh logs if on comms tab
            if (activeTab === 'communication') {
                if (visibilityTab === 'emails') {
                    const res = await api.get(`/projects/${id}/emails`);
                    setLogs(res.data || []);
                } else {
                    const res = await api.get(`/projects/${id}/logs`, { params: { visibility: visibilityTab } });
                    setLogs(res.data || []);
                }
            }
        } catch (e) {
            showToast('Sync failed', 'error');
        } finally {
            setSyncing(false);
        }
    };

    if (loading) return <TerminalLoader />;
    if (!project) return <div className="p-10 text-center text-red-500 font-bold">Partnership not found</div>;

    return (
        <div className="max-w-7xl mx-auto bg-gray-50 dark:bg-gray-900 min-h-screen p-6 font-sans">
            {/* HEADER */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <Link to="/partnerships" className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white mb-2 font-medium text-sm transition-colors">
                        <ArrowLeft size={16} /> Back to Partnerships
                    </Link>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                        {project.client_name}
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-md uppercase tracking-wider font-bold">Partnership</span>
                    </h1>
                </div>
                <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-bold shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
                >
                    <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
                    {syncing ? "Syncing..." : "Sync Now"}
                </button>
            </div>

            {/* TABS */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 space-x-6">
                <button
                    onClick={() => setActiveTab('communication')}
                    className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'communication'
                        ? 'border-black dark:border-white text-black dark:text-white'
                        : 'border-transparent text-gray-400 hover:text-gray-600'
                        }`}
                >
                    <MessageSquare size={16} /> Communication
                </button>
                <button
                    onClick={() => setActiveTab('contacts')}
                    className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'contacts'
                        ? 'border-black dark:border-white text-black dark:text-white'
                        : 'border-transparent text-gray-400 hover:text-gray-600'
                        }`}
                >
                    <Users size={16} /> Contacts
                </button>
            </div>

            {/* CONTENT */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 min-h-[500px]">

                {/* COMMUNICATION TAB */}
                {activeTab === 'communication' && (
                    <div className="p-6">
                        {/* Sub-tabs for visibility */}
                        <div className="flex justify-center mb-6">
                            <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
                                {canViewInternalChannel() && (
                                    <button
                                        onClick={() => setVisibilityTab('internal')}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${visibilityTab === 'internal' ? 'bg-white dark:bg-gray-800 text-black dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                                    >
                                        <span className="w-2 h-2 rounded-full bg-blue-500"></span> Internal
                                    </button>
                                )}
                                <button
                                    onClick={() => setVisibilityTab('external')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${visibilityTab === 'external' ? 'bg-white dark:bg-gray-800 text-black dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                                >
                                    <span className="w-2 h-2 rounded-full bg-green-500"></span> External
                                </button>
                                <button
                                    onClick={() => setVisibilityTab('emails')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${visibilityTab === 'emails' ? 'bg-white dark:bg-gray-800 text-black dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                                >
                                    <Mail size={16} /> Emails
                                </button>
                            </div>
                        </div>

                        {/* List */}
                        {logsLoading ? (
                            <div className="flex justify-center py-12"><TerminalLoader /></div>
                        ) : logs.length === 0 ? (
                            <div className="text-center py-16 opacity-50">
                                <MessageSquare size={48} className="mx-auto mb-2" />
                                <p>No logs found for this view.</p>
                            </div>
                        ) : (
                            <div className="space-y-4 max-w-3xl mx-auto">
                                {logs.map((log) => (
                                    <div key={log.id} className="p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                                                {log.source === 'email' ? <Mail size={14} /> : <MessageSquare size={14} />}
                                                {log.sender_name || 'Unknown'}
                                            </span>
                                            <span className="text-xs text-gray-400 dark:text-gray-500">
                                                {new Date(log.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                                            {log.content}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* CONTACTS TAB */}
                {activeTab === 'contacts' && (
                    <div className="p-6">
                        {membersLoading ? (
                            <div className="flex justify-center py-12"><TerminalLoader /></div>
                        ) : members.length === 0 ? (
                            <div className="text-center py-16 opacity-50">
                                <Users size={48} className="mx-auto mb-2" />
                                <p>No members found in connected channels.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {members.map(m => (
                                    <div key={m.slack_id} className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold text-lg">
                                            {m.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-bold text-gray-900 dark:text-white truncate">{m.name}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{m.email || 'No email'}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
