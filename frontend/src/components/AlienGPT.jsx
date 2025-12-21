// frontend/src/components/AlienGPT.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, X, Minimize2, Maximize2 } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function AlienGPT({ isOpen, onClose }) {
    const { user } = useAuth();
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [threadId, setThreadId] = useState(null);
    const [status, setStatus] = useState(null);
    const [minimized, setMinimized] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            fetchStatus();
        }
    }, [isOpen]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const fetchStatus = async () => {
        try {
            const res = await api.get('/alien-gpt/status');
            setStatus(res.data);
        } catch (err) {
            console.error('Failed to fetch AlienGPT status:', err);
        }
    };

    const handleSend = async () => {
        if (!message.trim() || loading) return;

        const userMessage = message;
        setMessage('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setLoading(true);

        try {
            const res = await api.post('/alien-gpt/chat', {
                message: userMessage,
                thread_id: threadId
            });

            setThreadId(res.data.thread_id);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: res.data.response,
                metadata: {
                    projects: res.data.accessible_projects,
                    stores_queried: res.data.vector_stores_queried
                }
            }]);
        } catch (err) {
            setMessages(prev => [...prev, {
                role: 'error',
                content: err.response?.data?.error || 'Failed to get response from AlienGPT'
            }]);
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

    if (!isOpen) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50">
            <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 transition-all ${minimized ? 'w-80 h-16' : 'w-96 h-[600px]'
                }`}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                        <Sparkles className="text-purple-500" size={20} />
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-white">AlienGPT</h3>
                            {status && (
                                <p className="text-xs text-gray-500">
                                    {status.user_role === 'superadmin' || status.user_role === 'internal'
                                        ? `All ${status.accessible_projects.length} projects`
                                        : `${status.accessible_projects.length} project(s)`}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setMinimized(!minimized)}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        >
                            {minimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {!minimized && (
                    <>
                        {/* Messages */}
                        <div className="h-[calc(100%-140px)] overflow-y-auto p-4 space-y-4">
                            {messages.length === 0 && (
                                <div className="text-center text-gray-500 mt-20">
                                    <Sparkles size={48} className="mx-auto mb-4 text-purple-500 opacity-50" />
                                    <p className="text-sm">Ask me anything about your projects!</p>
                                    {status && (
                                        <p className="text-xs mt-2">
                                            Access: {status.access_level}
                                        </p>
                                    )}
                                </div>
                            )}

                            {messages.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] rounded-lg p-3 ${msg.role === 'user'
                                        ? 'bg-purple-500 text-white'
                                        : msg.role === 'error'
                                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                                        }`}>
                                        <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                                        {msg.metadata && (
                                            <div className="text-xs mt-2 opacity-70">
                                                Searched {msg.metadata.stores_queried} vector stores
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {loading && (
                                <div className="flex justify-start">
                                    <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
                                        <div className="flex items-center gap-2">
                                            <div className="animate-pulse">Thinking...</div>
                                        </div>
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
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    placeholder="Ask about your projects..."
                                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white text-sm"
                                    disabled={loading}
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={loading || !message.trim()}
                                    className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Send size={16} />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
