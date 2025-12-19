import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../context/ToastContext.jsx';
import TerminalLoader from '../components/ui/TerminalLoader.jsx';
import { MessageSquare, RefreshCw, ArrowRight, Hash } from 'lucide-react';

export default function Partnerships() {
    const [partnerships, setPartnerships] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(null);
    const { showToast } = useToast();

    const fetchPartnerships = async (force = false) => {
        try {
            setLoading(true);
            const response = await api.get('/partnerships');
            setPartnerships(response.data);
        } catch (error) {
            showToast('Failed to load partnerships', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPartnerships();
    }, []);

    const handleSync = async (partnershipId) => {
        setSyncing(partnershipId);
        try {
            await api.post('/sync-history', { project_id: partnershipId });
            await fetchPartnerships(true);
            showToast('Partnership synced!', 'success');
        } catch (err) {
            showToast('Sync failed', 'error');
        } finally {
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

    if (loading) return <TerminalLoader />;

    return (
        <div className="max-w-7xl mx-auto p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Partnership Channels</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Track internal & partnership communications</p>
                </div>
                <button
                    onClick={() => fetchPartnerships(true)}
                    className="p-2 bg-white dark:bg-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
                >
                    <RefreshCw size={18} />
                </button>
            </div>

            {/* GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                {partnerships.map((p) => (
                    <div key={p.id} className="group rounded-xl border border-gray-200 bg-white dark:bg-gray-800 hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col">
                        <div className="p-5 border-b border-black/5">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shrink-0 shadow-sm bg-purple-100 text-purple-700">
                                        {p.client_name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="font-bold text-gray-900 dark:text-white leading-tight truncate pr-2">{p.client_name}</h2>
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide mt-1 bg-purple-100 text-purple-700">
                                            🤝 Partnership
                                        </span>
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
                                    <div className="text-lg font-bold text-gray-900 dark:text-white">
                                        {syncing === p.id ? (
                                            <span className="animate-pulse flex items-center gap-1">
                                                <RefreshCw size={14} className="animate-spin" /> Syncing...
                                            </span>
                                        ) : (
                                            <>
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
                                <div className="bg-white dark:bg-gray-800/60 p-2.5 rounded-lg border border-black/5">
                                    <div className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 flex items-center gap-1 mb-0.5">
                                        <MessageSquare size={10} /> Last Activity
                                    </div>
                                    <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                        {timeAgo(p.stats ? p.stats.last_active : null)}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="px-5 py-3 bg-white dark:bg-gray-800/40 border-t border-black/5 flex justify-between items-center">
                            <button
                                onClick={() => handleSync(p.id)}
                                disabled={syncing === p.id}
                                className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1 hover:text-blue-600 disabled:opacity-50"
                            >
                                <RefreshCw size={10} className={syncing === p.id ? "animate-spin" : ""} />
                                {syncing === p.id ? "SYNCING..." : "SYNC"}
                            </button>
                            <Link
                                to={`/projects/${p.id}`}
                                state={{ from: '/partnerships' }}
                                className="text-[10px] font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1 hover:underline"
                            >
                                OPEN DETAILS <ArrowRight size={10} />
                            </Link>
                        </div>
                    </div>
                ))}
            </div>

            {partnerships.length === 0 && (
                <div className="text-center py-16 bg-white dark:bg-gray-800 border border-dashed border-gray-300 rounded-xl text-gray-400">
                    <Hash size={48} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium mb-1">No partnership channels yet</p>
                    <p className="text-xs">Use the Scanner to mark channels as partnerships</p>
                </div>
            )}
        </div>
    );
}
