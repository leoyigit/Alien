import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
    FileText, Loader, AlertCircle, RefreshCw, Download, Copy, Check,
    ClipboardList, BarChart3, MessageSquare, Sparkles, Calendar, Trash2
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function Reports() {
    const { canEditProject, user } = useAuth();
    const [reportTypes, setReportTypes] = useState([]);
    const [selectedType, setSelectedType] = useState(null);
    const [generating, setGenerating] = useState(false);
    const [report, setReport] = useState(null);
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(false);
    const [reportHistory, setReportHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [selectedHistoryReport, setSelectedHistoryReport] = useState(null);
    const [sendTo, setSendTo] = useState('channel'); // channel or user
    const [selectedUser, setSelectedUser] = useState('');
    const [teamMembers, setTeamMembers] = useState([]);

    useEffect(() => {
        fetchReportTypes();
        fetchReportHistory();
        fetchTeamMembers();
    }, []);
    
    const fetchTeamMembers = async () => {
        try {
            const res = await api.get('/settings/team');
            setTeamMembers(res.data || []);
        } catch (err) {
            console.error('Failed to fetch team members');
        }
    };

    const fetchReportTypes = async () => {
        try {
            const res = await api.get('/reports/types');
            setReportTypes(res.data);
            if (res.data.length > 0) {
                setSelectedType(res.data[0].id);
            }
        } catch (e) {
            console.error('Failed to fetch report types:', e);
        }
    };

    const fetchReportHistory = async () => {
        setLoadingHistory(true);
        try {
            const res = await api.get('/reports/history');
            setReportHistory(res.data || []);
        } catch (e) {
            console.error('Failed to fetch report history:', e);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleGenerateReport = async () => {
        if (!selectedType) return;

        setGenerating(true);
        setError(null);
        setReport(null);

        try {
            const res = await api.post('/reports/generate', {
                report_type: selectedType
            });
            setReport(res.data);
            // Refresh history after generating new report
            fetchReportHistory();
        } catch (e) {
            setError(e.response?.data?.error || 'Failed to generate report');
        } finally {
            setGenerating(false);
        }
    };

    const [sendingSlack, setSendingSlack] = useState(false);

    const { showToast } = useToast();

    const handleSendToSlack = async () => {
        if (!report?.content) return;
        setSendingSlack(true);
        try {
            await api.post('/reports/send-to-slack', {
                content: report.content,
                report_type: report.report_type
            });
            showToast('Report sent to Slack channel #operations!', 'success');
        } catch (e) {
            showToast(e.response?.data?.error || 'Failed to send to Slack', 'error');
        } finally {
            setSendingSlack(false);
        }
    };

    const handleCopy = async () => {
        if (!report?.content) return;
        await navigator.clipboard.writeText(report.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleViewHistoryReport = async (reportId) => {
        try {
            const res = await api.get(`/ reports / ${reportId} `);
            setSelectedHistoryReport(res.data);
        } catch (e) {
            console.error('Error loading report:', e);
            const errorMsg = e.response?.data?.error || 'Failed to load report. Make sure the database migration is complete.';
            showToast(errorMsg, 'error');
        }
    };

    const handleCopyReportId = async (reportId) => {
        await navigator.clipboard.writeText(reportId);
        showToast(`Report ID ${reportId} copied!`, 'success');
    };

    const handleDeleteReport = async (reportId) => {
        if (!confirm('Are you sure you want to delete this report?')) return;

        try {
            await api.delete(`/ reports / history / ${reportId} `);
            showToast('Report deleted!', 'success');
            fetchReportHistory(); // Refresh the list
        } catch (e) {
            showToast(e.response?.data?.error || 'Failed to delete report', 'error');
        }
    };

    const getTypeIcon = (typeId) => {
        switch (typeId) {
            case 'pm_status': return <ClipboardList size={20} />;
            case 'migration_tracker': return <BarChart3 size={20} />;
            case 'communication': return <MessageSquare size={20} />;
            default: return <FileText size={20} />;
        }
    };

    if (!canEditProject()) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                    <AlertCircle size={48} className="mx-auto mb-4 text-gray-300" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
                    <p className="text-gray-500">Only internal team members can access reports.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                    <Sparkles size={24} className="text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">AI Reports</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Generate executive reports with AI</p>
                </div>
            </div>

            {/* Report Type Selector */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 p-6 mb-6">
                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-4">Select Report Type</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {reportTypes.map(type => (
                        <button
                            key={type.id}
                            onClick={() => setSelectedType(type.id)}
                            className={`p - 4 rounded - xl border - 2 text - left transition ${selectedType === type.id
                                ? 'border-purple-500 bg-purple-50'
                                : 'border-gray-200 hover:border-gray-300 bg-white dark:bg-gray-800'
                                } `}
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`p - 2 rounded - lg ${selectedType === type.id ? 'bg-purple-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'} `}>
                                    {getTypeIcon(type.id)}
                                </div>
                                <span className="text-2xl">{type.icon}</span>
                            </div>
                            <h4 className="font-bold text-gray-900 dark:text-white">{type.name}</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{type.description}</p>
                        </button>
                    ))}
                </div>

                {/* Send Options */}
                <div className="mt-6 space-y-4">
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
                        Send Report To
                    </label>
                    
                    {/* Send Method Selection */}
                    <div className="flex gap-2 mb-3">
                        <button
                            type="button"
                            onClick={() => setSendTo('channel')}
                            className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition ${
                                sendTo === 'channel'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                        >
                            📢 Slack Channel
                        </button>
                        <button
                            type="button"
                            onClick={() => setSendTo('user')}
                            className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition ${
                                sendTo === 'user'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                        >
                            👤 Specific User
                        </button>
                    </div>

                    {/* User Selection Dropdown (only shown when 'user' is selected) */}
                    {sendTo === 'user' && (
                        <select
                            value={selectedUser}
                            onChange={(e) => setSelectedUser(e.target.value)}
                            className="w-full px-4 py-3 bg-white dark:bg-gray-800 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium focus:ring-2 focus:ring-purple-500 outline-none"
                        >
                            <option value="">Select a user...</option>
                            <optgroup label="Internal Team">
                                {teamMembers.filter(m => m.email && (m.email.includes('@flyrank.com') || m.email.includes('@powercommerce.com'))).map(m => (
                                    <option key={m.email} value={m.email}>{m.name}</option>
                                ))}
                            </optgroup>
                            <optgroup label="External Team">
                                {teamMembers.filter(m => m.email && m.email.includes('@shopline.com')).map(m => (
                                    <option key={m.email} value={m.email}>{m.name}</option>
                                ))}
                            </optgroup>
                        </select>
                    )}

                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {sendTo === 'channel' 
                            ? 'Report will be sent to #operations Slack channel' 
                            : 'Report will be sent as a direct message to the selected user'}
                    </p>
                </div>

                {/* Generate Button */}
                <button
                    onClick={handleGenerateReport}
                    disabled={generating || !selectedType}
                    className="mt-6 w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg transition"
                >
                    {generating ? (
                        <>
                            <Loader size={20} className="animate-spin" />
                            Generating Report...
                        </>
                    ) : (
                        <>
                            <Sparkles size={20} />
                            Generate Report
                        </>
                    )}
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
                    <AlertCircle size={20} className="text-red-500" />
                    <span className="text-red-700">{error}</span>
                </div>
            )}

            {/* Generated Report */}
            {report && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 overflow-hidden">
                    {/* Report Header */}
                    <div className="p-6 border-b border-gray-100 bg-gray-50 dark:bg-gray-900 flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                                {reportTypes.find(t => t.id === report.report_type)?.name || 'Report'}
                            </h3>
                            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
                                <span className="flex items-center gap-1">
                                    <Calendar size={14} />
                                    {new Date(report.generated_at).toLocaleString()}
                                </span>
                                <span>{report.project_count} projects</span>
                                {report.report_id && (
                                    <button
                                        onClick={() => handleCopyReportId(report.report_id)}
                                        className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded font-mono text-xs font-bold hover:bg-purple-200 transition"
                                        title="Click to copy Report ID"
                                    >
                                        ID: {report.report_id}
                                        <Copy size={12} />
                                    </button>
                                )}
                                {user && (
                                    <span className="text-gray-400">
                                        Created by: <span className="text-gray-600 dark:text-gray-300 font-medium">{user.display_name || user.email}</span>
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleSendToSlack}
                                disabled={sendingSlack}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-lg hover:bg-blue-700 transition disabled:opacity-50"
                            >
                                {sendingSlack ? <Loader size={16} className="animate-spin" /> : <MessageSquare size={16} />}
                                Send to Slack
                            </button>
                            <button
                                onClick={handleCopy}
                                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 shadow-sm transition"
                            >
                                {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                                {copied ? 'Copied!' : 'Copy'}
                            </button>
                            <button
                                onClick={handleGenerateReport}
                                disabled={generating}
                                className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200 transition"
                            >
                                <RefreshCw size={16} className={generating ? 'animate-spin' : ''} />
                                Regenerate
                            </button>
                        </div>
                    </div>

                    {/* Report Content */}
                    <div className="p-6">
                        <div className="prose prose-sm max-w-none">
                            {report.content.split('\n').map((line, i) => {
                                // Simple markdown-like formatting
                                if (line.startsWith('# ')) {
                                    return <h1 key={i} className="text-2xl font-black text-gray-900 dark:text-white mt-6 mb-4">{line.slice(2)}</h1>;
                                }
                                if (line.startsWith('## ')) {
                                    return <h2 key={i} className="text-xl font-bold text-gray-800 dark:text-gray-100 mt-5 mb-3 border-b pb-2">{line.slice(3)}</h2>;
                                }
                                if (line.startsWith('### ')) {
                                    return <h3 key={i} className="text-lg font-bold text-gray-700 dark:text-gray-200 mt-4 mb-2">{line.slice(4)}</h3>;
                                }
                                if (line.startsWith('- ') || line.startsWith('* ')) {
                                    return <li key={i} className="text-gray-600 dark:text-gray-300 ml-4">{line.slice(2)}</li>;
                                }
                                if (line.startsWith('**') && line.endsWith('**')) {
                                    return <p key={i} className="font-bold text-gray-800 dark:text-gray-100 my-2">{line.slice(2, -2)}</p>;
                                }
                                if (line.trim() === '') {
                                    return <br key={i} />;
                                }
                                return <p key={i} className="text-gray-600 dark:text-gray-300 my-1">{line}</p>;
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!report && !generating && !error && (
                <div className="bg-gray-50 dark:bg-gray-900 border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText size={32} className="text-gray-400" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-2">No Report Generated</h3>
                    <p className="text-gray-500">Select a report type above and click "Generate Report"</p>
                </div>
            )}

            {/* Report History Section */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 p-6 mt-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">📚 Report History</h3>

                {loadingHistory ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <Loader size={24} className="animate-spin mx-auto mb-2" />
                        Loading history...
                    </div>
                ) : reportHistory.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        No reports generated yet
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 text-sm">
                                <tr>
                                    <th className="p-3 rounded-tl-lg">Report ID</th>
                                    <th className="p-3">Type</th>
                                    <th className="p-3">Generated</th>
                                    <th className="p-3">Projects</th>
                                    <th className="p-3 rounded-tr-lg text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {reportHistory.map((histReport) => (
                                    <tr key={histReport.id} className="hover:bg-gray-50 dark:bg-gray-900 transition">
                                        <td className="p-3">
                                            <button
                                                onClick={() => handleCopyReportId(histReport.report_id)}
                                                className="font-mono font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1"
                                            >
                                                {histReport.report_id}
                                                <Copy size={12} />
                                            </button>
                                        </td>
                                        <td className="p-3">
                                            <span className="text-sm">
                                                {reportTypes.find(t => t.id === histReport.report_type)?.icon || '📄'}
                                                {' '}
                                                {reportTypes.find(t => t.id === histReport.report_type)?.name || histReport.report_type}
                                            </span>
                                        </td>
                                        <td className="p-3 text-sm text-gray-600 dark:text-gray-300">
                                            {new Date(histReport.generated_at).toLocaleDateString()}
                                            {' '}
                                            {new Date(histReport.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="p-3 text-sm text-gray-600 dark:text-gray-300">
                                            {histReport.project_count}
                                        </td>
                                        <td className="p-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleViewHistoryReport(histReport.report_id)}
                                                    className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
                                                >
                                                    View
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteReport(histReport.report_id)}
                                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                                                    title="Delete Report"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* History Report Modal */}
            {selectedHistoryReport && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedHistoryReport(null)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="p-6 border-b border-gray-100 bg-gray-50 dark:bg-gray-900 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                                    {reportTypes.find(t => t.id === selectedHistoryReport.report_type)?.name || 'Report'}
                                </h3>
                                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    <span className="flex items-center gap-1">
                                        <Calendar size={14} />
                                        {new Date(selectedHistoryReport.generated_at).toLocaleString()}
                                    </span>
                                    <span>{selectedHistoryReport.project_count} projects</span>
                                    <button
                                        onClick={() => handleCopyReportId(selectedHistoryReport.report_id)}
                                        className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded font-mono text-xs font-bold hover:bg-purple-200 transition"
                                    >
                                        ID: {selectedHistoryReport.report_id}
                                        <Copy size={12} />
                                    </button>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedHistoryReport(null)}
                                className="p-2 hover:bg-gray-200 rounded-lg transition"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                            <div className="prose prose-sm max-w-none">
                                {selectedHistoryReport.content.split('\n').map((line, i) => {
                                    if (line.startsWith('# ')) {
                                        return <h1 key={i} className="text-2xl font-black text-gray-900 dark:text-white mt-6 mb-4">{line.slice(2)}</h1>;
                                    }
                                    if (line.startsWith('## ')) {
                                        return <h2 key={i} className="text-xl font-bold text-gray-800 dark:text-gray-100 mt-5 mb-3 border-b pb-2">{line.slice(3)}</h2>;
                                    }
                                    if (line.startsWith('### ')) {
                                        return <h3 key={i} className="text-lg font-bold text-gray-700 dark:text-gray-200 mt-4 mb-2">{line.slice(4)}</h3>;
                                    }
                                    if (line.startsWith('- ') || line.startsWith('* ')) {
                                        return <li key={i} className="text-gray-600 dark:text-gray-300 ml-4">{line.slice(2)}</li>;
                                    }
                                    if (line.startsWith('**') && line.endsWith('**')) {
                                        return <p key={i} className="font-bold text-gray-800 dark:text-gray-100 my-2">{line.slice(2, -2)}</p>;
                                    }
                                    if (line.trim() === '') {
                                        return <br key={i} />;
                                    }
                                    return <p key={i} className="text-gray-600 dark:text-gray-300 my-1">{line}</p>;
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
