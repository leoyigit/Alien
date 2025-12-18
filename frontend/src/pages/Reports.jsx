import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
    FileText, Loader, AlertCircle, RefreshCw, Download, Copy, Check,
    ClipboardList, BarChart3, MessageSquare, Sparkles, Calendar
} from 'lucide-react';

export default function Reports() {
    const { canEditProject } = useAuth();
    const [reportTypes, setReportTypes] = useState([]);
    const [selectedType, setSelectedType] = useState(null);
    const [generating, setGenerating] = useState(false);
    const [report, setReport] = useState(null);
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        fetchReportTypes();
    }, []);

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
        } catch (e) {
            setError(e.response?.data?.error || 'Failed to generate report');
        } finally {
            setGenerating(false);
        }
    };

    const [sendingSlack, setSendingSlack] = useState(false);

    const handleSendToSlack = async () => {
        if (!report?.content) return;
        setSendingSlack(true);
        try {
            await api.post('/reports/send-to-slack', {
                content: report.content,
                report_type: report.report_type
            });
            alert('Report sent to Slack channel #operations!');
        } catch (e) {
            alert(e.response?.data?.error || 'Failed to send to Slack');
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
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center">
                    <AlertCircle size={48} className="mx-auto mb-4 text-gray-300" />
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
                    <p className="text-gray-500">Only internal team members can access reports.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto p-8">
            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                    <Sparkles size={24} className="text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-gray-900">AI Reports</h1>
                    <p className="text-gray-500 text-sm">Generate executive reports with AI</p>
                </div>
            </div>

            {/* Report Type Selector */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
                <h3 className="text-sm font-bold text-gray-500 uppercase mb-4">Select Report Type</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {reportTypes.map(type => (
                        <button
                            key={type.id}
                            onClick={() => setSelectedType(type.id)}
                            className={`p-4 rounded-xl border-2 text-left transition ${selectedType === type.id
                                ? 'border-purple-500 bg-purple-50'
                                : 'border-gray-200 hover:border-gray-300 bg-white'
                                }`}
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`p-2 rounded-lg ${selectedType === type.id ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                    {getTypeIcon(type.id)}
                                </div>
                                <span className="text-2xl">{type.icon}</span>
                            </div>
                            <h4 className="font-bold text-gray-900">{type.name}</h4>
                            <p className="text-sm text-gray-500 mt-1">{type.description}</p>
                        </button>
                    ))}
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
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    {/* Report Header */}
                    <div className="p-6 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-lg text-gray-900">
                                {reportTypes.find(t => t.id === report.report_type)?.name || 'Report'}
                            </h3>
                            <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                <span className="flex items-center gap-1">
                                    <Calendar size={14} />
                                    {new Date(report.generated_at).toLocaleString()}
                                </span>
                                <span>{report.project_count} projects</span>
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
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 shadow-sm transition"
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
                                    return <h1 key={i} className="text-2xl font-black text-gray-900 mt-6 mb-4">{line.slice(2)}</h1>;
                                }
                                if (line.startsWith('## ')) {
                                    return <h2 key={i} className="text-xl font-bold text-gray-800 mt-5 mb-3 border-b pb-2">{line.slice(3)}</h2>;
                                }
                                if (line.startsWith('### ')) {
                                    return <h3 key={i} className="text-lg font-bold text-gray-700 mt-4 mb-2">{line.slice(4)}</h3>;
                                }
                                if (line.startsWith('- ') || line.startsWith('* ')) {
                                    return <li key={i} className="text-gray-600 ml-4">{line.slice(2)}</li>;
                                }
                                if (line.startsWith('**') && line.endsWith('**')) {
                                    return <p key={i} className="font-bold text-gray-800 my-2">{line.slice(2, -2)}</p>;
                                }
                                if (line.trim() === '') {
                                    return <br key={i} />;
                                }
                                return <p key={i} className="text-gray-600 my-1">{line}</p>;
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!report && !generating && !error && (
                <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText size={32} className="text-gray-400" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-700 mb-2">No Report Generated</h3>
                    <p className="text-gray-500">Select a report type above and click "Generate Report"</p>
                </div>
            )}
        </div>
    );
}
