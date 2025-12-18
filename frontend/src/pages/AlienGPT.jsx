import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Send, Loader, Trash2, Bot, User as UserIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function AlienGPT() {
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Initial greeting
    useEffect(() => {
        setMessages([{
            role: 'assistant',
            content: `Hello ${user?.display_name || 'there'}! 👋 I'm AlienGPT, your AI assistant for the Alien Portal.

I can help you with:
- **Project queries** - "Show me all stuck projects"
- **Team insights** - "Which PM has the most projects?"
- **Data analysis** - "List projects launching this month"
- **Communication** - "Show recent emails for [project]"

What would you like to know?`,
            timestamp: new Date().toISOString()
        }]);
    }, [user]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMessage = {
            role: 'user',
            content: input,
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        try {
            const response = await api.post('/chat/message', {
                message: input,
                history: messages.map(m => ({ role: m.role, content: m.content }))
            });

            const aiMessage = {
                role: 'assistant',
                content: response.data.message,
                timestamp: response.data.timestamp
            };

            setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
            const errorMessage = {
                role: 'assistant',
                content: `❌ Error: ${error.response?.data?.error || 'Failed to get response. Please try again.'}`,
                timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setLoading(false);
        }
    };

    const handleClear = () => {
        if (confirm('Clear all messages?')) {
            setMessages([{
                role: 'assistant',
                content: `Conversation cleared! How can I help you?`,
                timestamp: new Date().toISOString()
            }]);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="max-w-5xl mx-auto p-6 h-screen flex flex-col bg-gray-50">
            {/* Header */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
                            <Bot size={24} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-gray-900">AlienGPT</h1>
                            <p className="text-sm text-gray-500">Your AI Project Assistant</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClear}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold text-sm flex items-center gap-2 transition"
                    >
                        <Trash2 size={16} /> Clear Chat
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 p-6 overflow-y-auto mb-4">
                <div className="space-y-4">
                    {messages.map((message, index) => (
                        <div
                            key={index}
                            className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                        >
                            {/* Avatar */}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${message.role === 'user'
                                ? 'bg-blue-100 text-blue-600'
                                : 'bg-purple-100 text-purple-600'
                                }`}>
                                {message.role === 'user' ? <UserIcon size={16} /> : <Bot size={16} />}
                            </div>

                            {/* Message */}
                            <div className={`flex-1 max-w-3xl ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                                <div className={`inline-block p-4 rounded-2xl ${message.role === 'user'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-900'
                                    }`}>
                                    {message.role === 'assistant' ? (
                                        <div className="prose prose-sm max-w-none prose-table:border-collapse prose-th:border prose-th:border-gray-300 prose-th:bg-gray-100 prose-th:p-2 prose-td:border prose-td:border-gray-300 prose-td:p-2">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    table: ({ node, ...props }) => (
                                                        <table className="w-full border-collapse border border-gray-300 my-2" {...props} />
                                                    ),
                                                    thead: ({ node, ...props }) => (
                                                        <thead className="bg-gray-100" {...props} />
                                                    ),
                                                    th: ({ node, ...props }) => (
                                                        <th className="border border-gray-300 px-3 py-2 text-left font-bold" {...props} />
                                                    ),
                                                    td: ({ node, ...props }) => (
                                                        <td className="border border-gray-300 px-3 py-2" {...props} />
                                                    ),
                                                }}
                                            >
                                                {message.content}
                                            </ReactMarkdown>
                                        </div>
                                    ) : (
                                        <p className="whitespace-pre-wrap">{message.content}</p>
                                    )}
                                </div>
                                <p className="text-xs text-gray-400 mt-1 px-2">
                                    {new Date(message.timestamp).toLocaleTimeString()}
                                </p>
                            </div>
                        </div>
                    ))}

                    {loading && (
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                                <Bot size={16} />
                            </div>
                            <div className="bg-gray-100 p-4 rounded-2xl">
                                <Loader size={16} className="animate-spin text-gray-500" />
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
                <div className="flex gap-3">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Ask me anything about your projects..."
                        className="flex-1 border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                        rows={2}
                        disabled={loading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || loading}
                        className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-bold hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
                    >
                        <Send size={18} />
                        Send
                    </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">Press Enter to send, Shift+Enter for new line</p>
            </div>
        </div>
    );
}
