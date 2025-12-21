import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader, Bot, User, RefreshCw, Sparkles } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

export default function AIChat({ projectId }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [threadId, setThreadId] = useState(null);
    const [visibility, setVisibility] = useState('external');
    const [aiStatus, setAiStatus] = useState(null);
    const [initializing, setInitializing] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const messagesEndRef = useRef(null);
    const { showToast } = useToast();
    const { user } = useAuth();

    const canAccessInternal = user?.role === 'superadmin' || user?.role === 'internal';

    useEffect(() => {
        fetchAIStatus();
    }, [projectId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const fetchAIStatus = async () => {
        try {
            const res = await api.get(`/projects/${projectId}/ai/status`);
            setAiStatus(res.data);
        } catch (e) {
            console.error('Failed to fetch AI status:', e);
        }
    };

    const handleInitialize = async () => {
        setInitializing(true);
        try {
            await api.post(`/projects/${projectId}/ai/initialize`);
            showToast('AI assistants initialized successfully!', 'success');
            fetchAIStatus();
        } catch (e) {
            showToast(e.response?.data?.error || 'Failed to initialize AI', 'error');
        } finally {
            setInitializing(false);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await api.post(`/projects/${projectId}/ai/sync`);
            showToast(res.data.message, 'success');
            fetchAIStatus();
        } catch (e) {
            showToast(e.response?.data?.error || 'Failed to sync knowledge base', 'error');
        } finally {
            setSyncing(false);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMessage = input.trim();
        setInput('');

        // Add user message to chat
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setLoading(true);

        try {
            const res = await api.post(`/projects/${projectId}/ai/chat`, {
                message: userMessage,
                visibility,
                thread_id: threadId
            });

            // Add AI response to chat
            setMessages(prev => [...prev, { role: 'assistant', content: res.data.response }]);
            setThreadId(res.data.thread_id);
        } catch (e) {
            showToast(e.response?.data?.error || 'Failed to send message', 'error');
            // Remove user message on error
            setMessages(prev => prev.slice(0, -1));
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Not initialized
    if (!aiStatus?.initialized) {
        return (
            <div className="flex flex-col items-center justify-center h-96 space-y-4">
                <Sparkles size={48} className="text-purple-500" />
                <h3 className="text-xl font-bold">AI Assistant Not Initialized</h3>
                <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
                    Initialize AI assistants to chat with project-specific knowledge from Slack channels.
                </p>
                {canAccessInternal && (
                    <button
                        onClick={handleInitialize}
                        disabled={initializing}
                        className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50"
                    >
                        {initializing ? <Loader size={18} className="animate-spin" /> : <Sparkles size={18} />}
                        {initializing ? 'Initializing...' : 'Initialize AI Assistants'}
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[600px] bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                    <Bot size={20} className="text-purple-600" />
                    <span className="font-bold">AI Assistant</span>
                    {aiStatus?.sync_status === 'synced' && (
                        <span className="text-xs text-green-600">● Synced</span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {/* Visibility Toggle (only for internal users) */}
                    {canAccessInternal && (
                        <select
                            value={visibility}
                            onChange={(e) => setVisibility(e.target.value)}
                            className="text-xs px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                        >
                            <option value="internal">Internal Knowledge</option>
                            <option value="external">External Knowledge</option>
                        </select>
                    )}
                    {/* Sync Button */}
                    {canAccessInternal && (
                        <button
                            onClick={handleSync}
                            disabled={syncing}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            title="Sync latest Slack messages"
                        >
                            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                            {syncing ? 'Syncing...' : 'Sync'}
                        </button>
                    )}
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <Bot size={48} className="mb-2" />
                        <p className="text-sm">Ask me anything about this project!</p>
                    </div>
                ) : (
                    messages.map((msg, idx) => (
                        <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'assistant' && (
                                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center flex-shrink-0">
                                    <Bot size={16} className="text-purple-600" />
                                </div>
                            )}
                            <div className={`max-w-[80%] px-4 py-2 rounded-lg ${msg.role === 'user'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                                }`}>
                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            </div>
                            {msg.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                                    <User size={16} className="text-blue-600" />
                                </div>
                            )}
                        </div>
                    ))
                )}
                {loading && (
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                            <Bot size={16} className="text-purple-600" />
                        </div>
                        <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 rounded-lg">
                            <Loader size={16} className="animate-spin text-purple-600" />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Ask about the project..."
                        className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 outline-none focus:border-purple-500"
                        disabled={loading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={loading || !input.trim()}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Send size={18} />
                    </button>
                </div>
                {aiStatus?.last_sync_external && (
                    <p className="text-xs text-gray-400 mt-2">
                        Last synced: {new Date(aiStatus.last_sync_external).toLocaleString()}
                    </p>
                )}
            </div>
        </div>
    );
}
