import React, { useState, useEffect, useRef } from 'react';
import { FileText, Filter, RefreshCw, Download, CheckCircle, XCircle, Clock, Search, ChevronDown, ChevronUp, Terminal } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

export default function AdminLogs() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        action_type: '',
        status: '',
        search: ''
    });
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [expandedLogs, setExpandedLogs] = useState({});
    const { showToast } = useToast();
    const terminalRefs = useRef({});

    useEffect(() => {
        fetchLogs();

        // Auto-refresh every 3 seconds for real-time progress
        if (autoRefresh) {
            const interval = setInterval(fetchLogs, 3000);
            return () => clearInterval(interval);
        }
    }, [filters, autoRefresh]);

    const fetchLogs = async () => {
        try {
            const params = new URLSearchParams();
            if (filters.action_type) params.append('action_type', filters.action_type);
            if (filters.status) params.append('status', filters.status);
            params.append('limit', '100');

            const res = await api.get(`/logs?${params.toString()}`);
            setLogs(res.data.logs || []);
        } catch (e) {
            console.error('Failed to fetch logs:', e);
        } finally {
            setLoading(false);
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'success': return <CheckCircle size={16} className="text-green-600" />;
            case 'error': return <XCircle size={16} className="text-red-600" />;
            case 'in_progress': return <Clock size={16} className="text-yellow-600 animate-spin" />;
            default: return null;
        }
    };

    const getActionLabel = (actionType) => {
        const labels = {
            'sync_contacts': 'Synced Contacts',
            'sync_ai_global': 'Synced AI Knowledge',
            'sync_ai_progress': 'AI Sync Progress',
            'sync_global': 'Global Sync',
            'ai_chat': 'AI Chat',
            'ai_initialize': 'Initialized AI',
            'contact_create': 'Created Contact',
            'contact_update': 'Updated Contact'
        };
        return labels[actionType] || actionType;
    };

    const filteredLogs = logs.filter(log => {
        if (filters.search) {
            const search = filters.search.toLowerCase();
            return log.user_name?.toLowerCase().includes(search) ||
                log.resource_name?.toLowerCase().includes(search) ||
                log.action_type?.toLowerCase().includes(search);
        }
        return true;
    });

    const toggleExpanded = (logId) => {
        setExpandedLogs(prev => ({
            ...prev,
            [logId]: !prev[logId]
        }));
    };

    // Auto-scroll terminal to bottom when expanded
    useEffect(() => {
        Object.keys(expandedLogs).forEach(logId => {
            if (expandedLogs[logId] && terminalRefs.current[logId]) {
                terminalRefs.current[logId].scrollTop = terminalRefs.current[logId].scrollHeight;
            }
        });
    }, [logs, expandedLogs]);

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <FileText size={32} className="text-purple-600" />
                    <h1 className="text-3xl font-black">Activity Logs</h1>
                </div>
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                            className="rounded"
                        />
                        Auto-refresh
                    </label>
                    <button
                        onClick={fetchLogs}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        <RefreshCw size={18} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-bold mb-2">Search</label>
                        <div className="relative">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={filters.search}
                                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                placeholder="Search by user, resource..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-2">Action Type</label>
                        <select
                            value={filters.action_type}
                            onChange={(e) => setFilters({ ...filters, action_type: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                        >
                            <option value="">All Actions</option>
                            <option value="sync_global">Global Sync</option>
                            <option value="sync_contacts">Sync Contacts</option>
                            <option value="sync_ai_global">Sync AI</option>
                            <option value="ai_chat">AI Chat</option>
                            <option value="ai_initialize">AI Initialize</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-2">Status</label>
                        <select
                            value={filters.status}
                            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                        >
                            <option value="">All Statuses</option>
                            <option value="success">Success</option>
                            <option value="error">Error</option>
                            <option value="in_progress">In Progress</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Logs List */}
            <div className="space-y-2">
                {loading ? (
                    <div className="text-center py-12 text-gray-400">Loading logs...</div>
                ) : filteredLogs.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">No logs found</div>
                ) : (
                    filteredLogs.map((log) => {
                        const hasConsoleOutput = log.details?.console_output && log.details.console_output.length > 0;
                        const isExpanded = expandedLogs[log.id];

                        return (
                            <div key={log.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-purple-500 transition">
                                <div className="p-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-3 flex-1">
                                            {getStatusIcon(log.status)}
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold">{log.user_name}</span>
                                                    <span className="text-gray-400">•</span>
                                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                                        {getActionLabel(log.action_type)}
                                                    </span>
                                                    {log.resource_name && (
                                                        <>
                                                            <span className="text-gray-400">•</span>
                                                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                                                {log.resource_name}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                                <div className="text-xs text-gray-400">
                                                    {new Date(log.timestamp).toLocaleString()}
                                                    {log.duration_ms && ` • ${(log.duration_ms / 1000).toFixed(2)}s`}
                                                </div>
                                                {log.details && !hasConsoleOutput && (
                                                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                                                        {log.status === 'error' ? (
                                                            <div className="text-red-600 font-mono">{log.details.error}</div>
                                                        ) : (
                                                            <div className="flex gap-4">
                                                                {Object.entries(log.details).filter(([key]) => key !== 'console_output').map(([key, value]) => (
                                                                    <span key={key}>
                                                                        <span className="font-bold">{key}:</span> {JSON.stringify(value)}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {hasConsoleOutput && (
                                            <button
                                                onClick={() => toggleExpanded(log.id)}
                                                className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                                            >
                                                <Terminal size={14} />
                                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Terminal Output */}
                                {hasConsoleOutput && isExpanded && (
                                    <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-900 p-4">
                                        <div
                                            ref={el => terminalRefs.current[log.id] = el}
                                            className="font-mono text-sm text-green-400 max-h-96 overflow-y-auto space-y-1"
                                        >
                                            {log.details.console_output.map((output, idx) => (
                                                <div key={idx} className="flex gap-2">
                                                    <span className="text-gray-500 text-xs">{output.timestamp}</span>
                                                    <span className="whitespace-pre-wrap">{output.line}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
