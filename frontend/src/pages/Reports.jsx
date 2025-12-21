import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
    FileText, Loader, AlertCircle, RefreshCw, Download, Copy, Check,
    ClipboardList, BarChart3, MessageSquare, Sparkles, Calendar, Trash2, X
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import jsPDF from 'jspdf';

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
    const [userFilter, setUserFilter] = useState('all'); // 'all', 'internal', 'external'

    // Stage filtering
    const [selectedStages, setSelectedStages] = useState(['all']);
    const [excludedProjects, setExcludedProjects] = useState([]);
    const [projects, setProjects] = useState([]);

    useEffect(() => {
        fetchReportTypes();
        fetchReportHistory();
        fetchTeamMembers();
        fetchProjects();
    }, []);

    const fetchTeamMembers = async () => {
        try {
            const res = await api.get('/contacts');
            // Keep only internal team members (not merchants)
            const filtered = (res.data || []).filter(member => {
                const role = member.role?.toLowerCase() || '';
                return role === 'internal' || role === 'pm' || role === 'dev' || role === 'both';
            });
            console.log('Team members loaded:', filtered);
            setTeamMembers(filtered);
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

    const fetchProjects = async () => {
        try {
            const res = await api.get('/projects');
            setProjects(res.data || []);
        } catch (err) {
            console.error('Failed to fetch projects');
        }
    };

    const handleStageToggle = (stage) => {
        console.log('Toggling stage:', stage, 'Current stages:', selectedStages);
        if (stage === 'all') {
            setSelectedStages(['all']);
        } else {
            const newStages = selectedStages.filter(s => s !== 'all');
            if (newStages.includes(stage)) {
                const filtered = newStages.filter(s => s !== stage);
                setSelectedStages(filtered.length === 0 ? ['all'] : filtered);
            } else {
                setSelectedStages([...newStages, stage]);
            }
        }
    };

    const handleProjectExclusionToggle = (projectId) => {
        if (excludedProjects.includes(projectId)) {
            setExcludedProjects(excludedProjects.filter(id => id !== projectId));
        } else {
            setExcludedProjects([...excludedProjects, projectId]);
        }
    };

    const handleGenerateReport = async () => {
        if (!selectedType) return;

        setGenerating(true);
        setError(null);
        setReport(null);

        try {
            const res = await api.post('/reports/generate', {
                report_type: selectedType,
                stages: selectedStages.includes('all') ? null : selectedStages,
                excluded_projects: excludedProjects
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
    const { confirm } = useConfirm();

    const handleSendToSlack = async () => {
        if (!report?.content) return;
        setSendingSlack(true);
        try {
            const payload = {
                content: report.content,
                report_type: report.report_type
            };

            // Add user_id if sending to specific user
            if (sendTo === 'user' && selectedUser) {
                payload.user_id = selectedUser; // This is the slack_user_id
            }

            await api.post('/reports/send-to-slack', payload);

            const message = sendTo === 'user'
                ? 'Report sent as DM!'
                : 'Report sent to Slack channel #operations!';
            showToast(message, 'success');
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
            const res = await api.get(`/reports/${reportId}`);
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
        console.log("Attempting to delete report:", reportId);

        const confirmed = await confirm({
            title: 'Delete Report',
            message: 'Are you sure you want to delete this report? This action cannot be undone.',
            variant: 'danger'
        });

        if (!confirmed) return;

        try {
            await api.delete(`/reports/history/${reportId}`);
            // Clear selected report if it was the one deleted
            if (selectedHistoryReport?.report_id === reportId) {
                setSelectedHistoryReport(null);
            }
            showToast('Report deleted!', 'success');
            // Refresh the list
            await fetchReportHistory();
        } catch (e) {
            console.error("Delete failed:", e);
            showToast(e.response?.data?.error || 'Failed to delete report', 'error');
        }
    };

    const handleDownloadPDF = () => {
        if (!selectedHistoryReport) return;

        const reportTitle = reportTypes.find(t => t.id === selectedHistoryReport.report_type)?.name || 'Report';
        const date = new Date(selectedHistoryReport.generated_at).toLocaleString();
        const creator = selectedHistoryReport.generated_by_name || 'Unknown';
        const docId = selectedHistoryReport.report_id;

        // Create PDF
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;
        const maxWidth = pageWidth - (margin * 2);
        let yPos = 20;

        // Header
        doc.setFontSize(18);
        doc.setFont(undefined, 'bold');
        doc.text(reportTitle, margin, yPos);
        yPos += 10;

        // Metadata
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(`Report created at: ${date}`, margin, yPos);
        yPos += 6;
        doc.text(`Created by: ${creator}`, margin, yPos);
        yPos += 6;
        doc.text(`Doc. ID: ${docId}`, margin, yPos);
        yPos += 12;

        // Line separator
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 10;

        // Content
        doc.setFontSize(10);
        const lines = selectedHistoryReport.content.split('\n');

        lines.forEach((line) => {
            // Check if we need a new page
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }

            if (line.startsWith('# ')) {
                doc.setFontSize(16);
                doc.setFont(undefined, 'bold');
                const text = line.slice(2);
                const splitText = doc.splitTextToSize(text, maxWidth);
                doc.text(splitText, margin, yPos);
                yPos += splitText.length * 8;
                doc.setFontSize(10);
            } else if (line.startsWith('## ')) {
                doc.setFontSize(14);
                doc.setFont(undefined, 'bold');
                const text = line.slice(3);
                const splitText = doc.splitTextToSize(text, maxWidth);
                doc.text(splitText, margin, yPos);
                yPos += splitText.length * 7;
                doc.setFontSize(10);
            } else if (line.startsWith('### ')) {
                doc.setFontSize(12);
                doc.setFont(undefined, 'bold');
                const text = line.slice(4);
                const splitText = doc.splitTextToSize(text, maxWidth);
                doc.text(splitText, margin, yPos);
                yPos += splitText.length * 6;
                doc.setFontSize(10);
            } else if (line.startsWith('- ') || line.startsWith('* ')) {
                doc.setFont(undefined, 'normal');
                const text = '• ' + line.slice(2);
                const splitText = doc.splitTextToSize(text, maxWidth - 5);
                doc.text(splitText, margin + 5, yPos);
                yPos += splitText.length * 5;
            } else if (line.trim() === '') {
                yPos += 4;
            } else {
                doc.setFont(undefined, 'normal');
                const splitText = doc.splitTextToSize(line, maxWidth);
                doc.text(splitText, margin, yPos);
                yPos += splitText.length * 5;
            }
        });

        // Save PDF
        doc.save(`${docId}_${reportTitle.replace(/ /g, '_')}.pdf`);
        showToast('PDF downloaded successfully!', 'success');
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
                            className={`p-4 rounded-xl border-2 text-left transition ${selectedType === type.id
                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
                                }`}
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`p-2 rounded-lg ${selectedType === type.id ? 'bg-purple-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
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
                            className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition ${sendTo === 'channel'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            📢 Slack Channel
                        </button>
                        <button
                            type="button"
                            onClick={() => setSendTo('user')}
                            className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition ${sendTo === 'user'
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
                            {teamMembers.filter(m => m.slack_user_id).length === 0 ? (
                                <option disabled>No team members with Slack IDs (Click "Sync Slack IDs" in Settings)</option>
                            ) : (
                                teamMembers.filter(m => m.slack_user_id).map(m => (
                                    <option key={m.slack_user_id} value={m.slack_user_id}>
                                        {m.name} ✓
                                    </option>
                                ))
                            )}
                        </select>
                    )}

                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {sendTo === 'channel'
                            ? 'Report will be sent to #leo-playground Slack channel'
                            : 'Report will be sent as a direct message to the selected user'}
                    </p>
                </div>

                {/* Stage Filter Section */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mt-6">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-4">Filter by Project Stage</h3>

                    {/* Stage Checkboxes */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={selectedStages.includes('all')} onChange={() => handleStageToggle('all')} className="w-4 h-4 text-blue-600 rounded" />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">All Projects</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={selectedStages.includes('New / In Progress')} onChange={() => handleStageToggle('New / In Progress')} className="w-4 h-4 text-blue-600 rounded" />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">New / In Progress</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={selectedStages.includes('Almost Ready')} onChange={() => handleStageToggle('Almost Ready')} className="w-4 h-4 text-yellow-600 rounded" />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Almost Ready</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={selectedStages.includes('Ready')} onChange={() => handleStageToggle('Ready')} className="w-4 h-4 text-green-600 rounded" />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Ready</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={selectedStages.includes('Launched')} onChange={() => handleStageToggle('Launched')} className="w-4 h-4 text-purple-600 rounded" />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Launched</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={selectedStages.includes('Stuck / On Hold')} onChange={() => handleStageToggle('Stuck / On Hold')} className="w-4 h-4 text-red-600 rounded" />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Stuck / On Hold</span>
                        </label>
                    </div>

                    {/* Project Exclusion */}
                    <details className="mt-4">
                        <summary className="cursor-pointer text-sm font-bold text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                            Exclude Specific Projects ({excludedProjects.length} excluded)
                        </summary>
                        <div className="mt-3 max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-900">
                            {projects.length === 0 ? (
                                <p className="text-sm text-gray-500 dark:text-gray-400">Loading projects...</p>
                            ) : (
                                <div className="space-y-2">
                                    {projects.map(p => (
                                        <label key={p.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 p-1 rounded">
                                            <input type="checkbox" checked={excludedProjects.includes(p.id)} onChange={() => handleProjectExclusionToggle(p.id)} className="w-4 h-4 text-red-600 rounded" />
                                            <span className="text-sm text-gray-700 dark:text-gray-300">{p.client_name}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    </details>
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
                                            <div>
                                                <span className="text-sm">
                                                    {reportTypes.find(t => t.id === histReport.report_type)?.icon || '📄'}
                                                    {' '}
                                                    {reportTypes.find(t => t.id === histReport.report_type)?.name || histReport.report_type}
                                                </span>
                                                {/* Filter Info */}
                                                {histReport.metadata && (
                                                    <div className="mt-1 flex flex-wrap gap-1">
                                                        {histReport.metadata.stages && histReport.metadata.stages !== 'all' && (
                                                            <span className="text-[10px] px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full font-medium">
                                                                Stages: {Array.isArray(histReport.metadata.stages) ? histReport.metadata.stages.join(', ') : histReport.metadata.stages}
                                                            </span>
                                                        )}
                                                        {histReport.metadata.excluded_projects && histReport.metadata.excluded_projects.length > 0 && (
                                                            <span className="text-[10px] px-2 py-0.5 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-full font-medium">
                                                                Excluded: {histReport.metadata.excluded_projects.length}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
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
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                    <h3 className="font-black text-2xl text-gray-900 dark:text-white mb-2">
                                        {reportTypes.find(t => t.id === selectedHistoryReport.report_type)?.name || 'Report'}
                                    </h3>
                                    <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                                        <div>Report created at: <span className="font-medium text-gray-900 dark:text-white">{new Date(selectedHistoryReport.generated_at).toLocaleString()}</span></div>
                                        <div>Created by: <span className="font-medium text-gray-900 dark:text-white">{selectedHistoryReport.generated_by_name || 'Unknown'}</span></div>
                                        <div>Doc. ID: <span className="font-mono font-bold text-purple-600 dark:text-purple-400">{selectedHistoryReport.report_id}</span></div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleDownloadPDF}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                                    >
                                        <Download size={16} />
                                        Download
                                    </button>
                                    <button
                                        onClick={() => setSelectedHistoryReport(null)}
                                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
                                    >
                                        <X size={20} className="text-gray-600 dark:text-gray-400" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                            <div className="prose prose-sm max-w-none">
                                {selectedHistoryReport.content.split('\n').map((line, i) => {
                                    if (line.startsWith('# ')) {
                                        return <h1 key={i} className="text-2xl font-black text-gray-900 dark:text-white mt-6 mb-4">{line.slice(2)}</h1>;
                                    }
                                    if (line.startsWith('## ')) {
                                        return <h2 key={i} className="text-xl font-black text-gray-900 dark:text-white mt-5 mb-3 border-b border-gray-300 dark:border-gray-600 pb-2">{line.slice(3)}</h2>;
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
