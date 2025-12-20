import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
    Settings as SettingsIcon, Key, Users, Shield, Save, Trash2,
    Check, X, Eye, EyeOff, RefreshCw, Loader, AlertCircle, Zap, UserPlus, UserCog
} from 'lucide-react';

export default function Settings() {
    const { user, canAccessSettings, canManageUsers } = useAuth();
    const [activeTab, setActiveTab] = useState('integrations');
    const [settings, setSettings] = useState([]);
    const [users, setUsers] = useState([]);
    const [teamMembers, setTeamMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(null);
    const [testing, setTesting] = useState(null);
    const [editingKey, setEditingKey] = useState(null);
    const [newValue, setNewValue] = useState('');
    const [showValue, setShowValue] = useState({});
    const [message, setMessage] = useState(null);
    const [newMemberName, setNewMemberName] = useState('');
    const [newMemberRole, setNewMemberRole] = useState('Both');

    useEffect(() => {
        if (activeTab === 'integrations') {
            fetchSettings();
        } else if (activeTab === 'users') {
            fetchUsers();
        } else if (activeTab === 'team') {
            fetchTeamMembers();
        }
    }, [activeTab]);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await api.get('/settings/');
            console.log('Settings API Response:', res.data);
            console.log('Number of settings:', res.data?.length);
            setSettings(res.data);
        } catch (e) {
            console.error('Failed to fetch settings:', e);
            console.error('Error response:', e.response?.data);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await api.get('/auth/users');
            setUsers(res.data);
        } catch (e) {
            console.error('Failed to fetch users:', e);
        } finally {
            setLoading(false);
        }
    };

    const fetchTeamMembers = async () => {
        setLoading(true);
        try {
            const res = await api.get('/settings/team');
            setTeamMembers(res.data || []);
        } catch (e) {
            console.error('Failed to fetch team:', e);
            setTeamMembers([]);
        } finally {
            setLoading(false);
        }
    };

    const handleAddTeamMember = async () => {
        if (!newMemberName.trim()) return;
        setSaving('new-member');
        try {
            await api.post('/settings/team/add', { name: newMemberName.trim(), role: newMemberRole });
            setMessage({ type: 'success', text: `Added ${newMemberName} to team!` });
            setNewMemberName('');
            setNewMemberRole('Both');
            fetchTeamMembers();
        } catch (e) {
            setMessage({ type: 'error', text: e.response?.data?.error || 'Failed to add member' });
        } finally {
            setSaving(null);
        }
    };

    const handleRemoveTeamMember = async (name) => {
        // Using toast for confirmation instead of browser confirm
        if (!window.confirm(`Remove ${name} from team?`)) return;  // Keep for now, will enhance later
        setSaving(name);
        try {
            await api.delete(`/settings/team/${encodeURIComponent(name)}`);
            setMessage({ type: 'success', text: `Removed ${name} from team` });
            fetchTeamMembers();
        } catch (e) {
            setMessage({ type: 'error', text: e.response?.data?.error || 'Failed to remove' });
        } finally {
            setSaving(null);
        }
    };

    const handleUpdateSetting = async (key) => {
        setSaving(key);
        try {
            await api.put(`/settings/${key}`, { value: newValue });
            setMessage({ type: 'success', text: `${key} updated successfully!` });
            setEditingKey(null);
            setNewValue('');
            fetchSettings();
        } catch (e) {
            setMessage({ type: 'error', text: e.response?.data?.error || 'Failed to update' });
        } finally {
            setSaving(null);
        }
    };

    const handleTestConnection = async (service) => {
        setTesting(service);
        try {
            const res = await api.post(`/settings/test-connection/${service}`);
            if (res.data.success) {
                setMessage({ type: 'success', text: `${service} connection successful!` });
            } else {
                setMessage({ type: 'error', text: res.data.error });
            }
        } catch (e) {
            setMessage({ type: 'error', text: e.response?.data?.error || 'Connection test failed' });
        } finally {
            setTesting(null);
        }
    };

    const handleUpdateUserRole = async (userId, newRole) => {
        setSaving(userId);
        try {
            await api.put(`/auth/users/${userId}/role`, { role: newRole });
            setMessage({ type: 'success', text: 'User role updated!' });
            fetchUsers();
        } catch (e) {
            setMessage({ type: 'error', text: e.response?.data?.error || 'Failed to update' });
        } finally {
            setSaving(null);
        }
    };

    const handleApproveUser = async (userId) => {
        setSaving(userId);
        try {
            await api.post(`/auth/users/${userId}/approve`);
            setMessage({ type: 'success', text: 'User approved!' });
            fetchUsers();
        } catch (e) {
            setMessage({ type: 'error', text: e.response?.data?.error || 'Failed to approve' });
        } finally {
            setSaving(null);
        }
    };

    const handleRejectUser = async (userId) => {
        if (!window.confirm('Are you sure you want to reject this user?')) return;
        setSaving(userId);
        try {
            await api.post(`/auth/users/${userId}/reject`);
            setMessage({ type: 'success', text: 'User rejected' });
            fetchUsers();
        } catch (e) {
            setMessage({ type: 'error', text: e.response?.data?.error || 'Failed to reject' });
        } finally {
            setSaving(null);
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!window.confirm('Are you sure you want to delete this user? This cannot be undone.')) return;
        setSaving(userId);
        try {
            await api.delete(`/auth/users/${userId}`);
            setMessage({ type: 'success', text: 'User deleted' });
            fetchUsers();
        } catch (e) {
            setMessage({ type: 'error', text: e.response?.data?.error || 'Failed to delete' });
        } finally {
            setSaving(null);
        }
    };

    const getRoleBadgeColor = (role) => {
        switch (role) {
            case 'superadmin': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'internal': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'shopline': return 'bg-green-100 text-green-700 border-green-200';
            case 'merchant': return 'bg-gray-100 dark:bg-gray-700 text-gray-700 border-gray-200';
            default: return 'bg-gray-100 dark:bg-gray-700 text-gray-600';
        }
    };

    const getMemberRoleBadge = (role) => {
        switch (role) {
            case 'PM': return 'bg-blue-100 text-blue-700';
            case 'Dev': return 'bg-green-100 text-green-700';
            case 'Both': return 'bg-purple-100 text-purple-700';
            default: return 'bg-gray-100 dark:bg-gray-700 text-gray-600';
        }
    };

    if (!canAccessSettings()) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                    <Shield size={48} className="mx-auto mb-4 text-gray-300" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
                    <p className="text-gray-500">Only superadmins can access settings.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
            <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center">
                    <SettingsIcon size={24} className="text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">Settings</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Manage integrations, users, and team</p>
                </div>
            </div>

            {/* Message Toast */}
            {message && (
                <div className={`flex items-center gap-2 px-4 py-3 rounded-lg mb-6 text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {message.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                    {message.text}
                    <button onClick={() => setMessage(null)} className="ml-auto hover:opacity-70">
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Tabs */}
            <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl mb-8 w-fit">
                <button
                    onClick={() => setActiveTab('integrations')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition ${activeTab === 'integrations' ? 'bg-white dark:bg-gray-800 text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <Key size={16} /> API Keys
                </button>
                <button
                    onClick={() => setActiveTab('team')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition ${activeTab === 'team' ? 'bg-white dark:bg-gray-800 text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <UserCog size={16} /> Team
                </button>
                <button
                    onClick={() => setActiveTab('users')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition ${activeTab === 'users' ? 'bg-white dark:bg-gray-800 text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <Users size={16} /> Portal Users
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader size={24} className="animate-spin text-gray-400 dark:text-gray-500" />
                </div>
            ) : activeTab === 'integrations' ? (
                <div className="space-y-4">
                    {/* Slack Section */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                <span className="text-xl">💬</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">Slack Integration</h3>
                                <p className="text-gray-500 dark:text-gray-400 text-sm">Connect your Slack workspace</p>
                            </div>
                            <button
                                onClick={() => handleTestConnection('slack')}
                                disabled={testing === 'slack'}
                                className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg text-sm font-medium hover:bg-purple-100 disabled:opacity-50"
                            >
                                {testing === 'slack' ? <Loader size={14} className="animate-spin" /> : <Zap size={14} />}
                                Test Connection
                            </button>
                        </div>

                        {settings.filter(s => s.key.includes('SLACK')).map(setting => (
                            <SettingRow
                                key={setting.key}
                                setting={setting}
                                editingKey={editingKey}
                                setEditingKey={setEditingKey}
                                newValue={newValue}
                                setNewValue={setNewValue}
                                showValue={showValue}
                                setShowValue={setShowValue}
                                saving={saving}
                                onSave={handleUpdateSetting}
                            />
                        ))}
                    </div>

                    {/* OpenAI Section */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                <span className="text-xl">🤖</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">OpenAI Integration</h3>
                                <p className="text-gray-500 dark:text-gray-400 text-sm">API Key, Assistant, and Vector Store</p>
                            </div>
                            <button
                                onClick={() => handleTestConnection('openai')}
                                disabled={testing === 'openai'}
                                className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-sm font-medium hover:bg-green-100 disabled:opacity-50"
                            >
                                {testing === 'openai' ? <Loader size={14} className="animate-spin" /> : <Zap size={14} />}
                                Test Connection
                            </button>
                        </div>

                        {settings.filter(s => s.key.includes('OPENAI') || s.key.includes('ASSISTANT') || s.key.includes('VECTOR')).map(setting => (
                            <SettingRow
                                key={setting.key}
                                setting={setting}
                                editingKey={editingKey}
                                setEditingKey={setEditingKey}
                                newValue={newValue}
                                setNewValue={setNewValue}
                                showValue={showValue}
                                setShowValue={setShowValue}
                                saving={saving}
                                onSave={handleUpdateSetting}
                            />
                        ))}

                        {/* Setup Guide Link */}
                        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                            <p className="text-sm text-blue-700">
                                <strong>Need help?</strong> Go to <a href="https://platform.openai.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">platform.openai.com</a> to create your API key, Assistant, and Vector Store.
                            </p>
                        </div>
                    </div>
                </div>
            ) : activeTab === 'team' ? (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                        <h3 className="font-bold text-lg">Internal Team Members</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">These names appear in PM/Dev dropdowns</p>
                    </div>

                    {/* Add New Member */}
                    <div className="p-4 border-b border-gray-100 bg-gray-50 dark:bg-gray-900">
                        <div className="flex items-center gap-3">
                            <input
                                type="text"
                                value={newMemberName}
                                onChange={(e) => setNewMemberName(e.target.value)}
                                placeholder="Enter name..."
                                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-black outline-none"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddTeamMember()}
                            />
                            <select
                                value={newMemberRole}
                                onChange={(e) => setNewMemberRole(e.target.value)}
                                className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium bg-white dark:bg-gray-800"
                            >
                                <option value="Both">PM & Dev</option>
                                <option value="PM">PM Only</option>
                                <option value="Dev">Dev Only</option>
                            </select>
                            <button
                                onClick={handleAddTeamMember}
                                disabled={!newMemberName.trim() || saving === 'new-member'}
                                className="flex items-center gap-2 px-4 py-2.5 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-800 disabled:opacity-50"
                            >
                                {saving === 'new-member' ? <Loader size={16} className="animate-spin" /> : <UserPlus size={16} />}
                                Add
                            </button>
                        </div>
                    </div>

                    {/* Team List */}
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {teamMembers.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 dark:text-gray-500">
                                <UserCog size={32} className="mx-auto mb-2 opacity-50" />
                                <p>No team members yet. Add your first one above.</p>
                            </div>
                        ) : (
                            teamMembers.map((member, idx) => (
                                <div key={idx} className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:bg-gray-900 transition">
                                    <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center font-bold text-gray-600">
                                        {member.name?.charAt(0) || '?'}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-gray-900 dark:text-white">{member.name}</div>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${getMemberRoleBadge(member.role)}`}>
                                        {member.role === 'Both' ? 'PM & Dev' : member.role}
                                    </span>
                                    <button
                                        onClick={() => handleRemoveTeamMember(member.name)}
                                        disabled={saving === member.name}
                                        className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                    >
                                        {saving === member.name ? <Loader size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                        <h3 className="font-bold text-lg">Portal Users</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">Manage user roles and permissions</p>
                    </div>

                    {/* Pending Users Section */}
                    {users.filter(u => u.status === 'pending').length > 0 && (
                        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-100 dark:border-yellow-900/30">
                            <div className="flex items-center gap-2 mb-3">
                                <AlertCircle size={16} className="text-yellow-600" />
                                <h4 className="font-bold text-yellow-900 dark:text-yellow-200">Pending Approval ({users.filter(u => u.status === 'pending').length})</h4>
                            </div>
                            <div className="space-y-2">
                                {users.filter(u => u.status === 'pending').map(u => (
                                    <div key={u.id} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-yellow-200 dark:border-yellow-900/50">
                                        <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center font-bold text-yellow-700">
                                            {u.display_name?.charAt(0) || u.email?.charAt(0) || '?'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-gray-900 dark:text-white truncate">{u.display_name || 'Unnamed'}</div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{u.email}</div>
                                        </div>
                                        <span className="px-2 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-200">
                                            Pending
                                        </span>
                                        <button
                                            onClick={() => handleApproveUser(u.id)}
                                            disabled={saving === u.id}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                                        >
                                            {saving === u.id ? <Loader size={14} className="animate-spin" /> : <Check size={14} />}
                                            Approve
                                        </button>
                                        <button
                                            onClick={() => handleRejectUser(u.id)}
                                            disabled={saving === u.id}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                                        >
                                            <X size={14} />
                                            Reject
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {users.filter(u => u.status !== 'pending').map(u => (
                            <div key={u.id} className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-900 transition">
                                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center font-bold text-gray-600">
                                    {u.display_name?.charAt(0) || u.email?.charAt(0) || '?'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-gray-900 dark:text-white truncate">{u.display_name || 'Unnamed'}</div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{u.email}</div>
                                </div>
                                {u.status === 'rejected' && (
                                    <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                                        Rejected
                                    </span>
                                )}
                                <select
                                    value={u.role}
                                    onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                                    disabled={u.email === user?.email || saving === u.id || u.status === 'rejected'}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-bold border ${getRoleBadgeColor(u.role)} ${u.email === user?.email || u.status === 'rejected' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                    <option value="superadmin">Superadmin</option>
                                    <option value="internal">Internal</option>
                                    <option value="shopline">Shopline</option>
                                    <option value="merchant">Merchant</option>
                                </select>
                                {u.email !== user?.email && (
                                    <button
                                        onClick={() => handleDeleteUser(u.id)}
                                        disabled={saving === u.id}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                                    >
                                        {saving === u.id ? <Loader size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function SettingRow({ setting, editingKey, setEditingKey, newValue, setNewValue, showValue, setShowValue, saving, onSave }) {
    const isEditing = editingKey === setting.key;
    const [revealedValue, setRevealedValue] = React.useState(null);
    const [revealing, setRevealing] = React.useState(false);

    const handleReveal = async () => {
        if (revealedValue) {
            setRevealedValue(null);
            return;
        }
        setRevealing(true);
        try {
            const res = await api.get(`/settings/${setting.key}/reveal`);
            setRevealedValue(res.data.value);
        } catch (e) {
            console.error('Failed to reveal:', e);
        } finally {
            setRevealing(false);
        }
    };

    return (
        <div className="flex items-center gap-4 py-3 border-t border-gray-100 dark:border-gray-700 first:border-0">
            <div className="flex-1 min-w-0">
                <div className="font-mono text-sm font-bold text-gray-700 dark:text-gray-200">{setting.key}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500">{setting.description}</div>
            </div>
            {isEditing ? (
                <div className="flex items-center gap-2 flex-1 max-w-md">
                    <input
                        type={showValue[setting.key] ? 'text' : 'password'}
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono focus:ring-2 focus:ring-black outline-none"
                        placeholder="Enter new value..."
                        autoFocus
                    />
                    <button onClick={() => setShowValue(prev => ({ ...prev, [setting.key]: !prev[setting.key] }))} className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-300">
                        {showValue[setting.key] ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button
                        onClick={() => onSave(setting.key)}
                        disabled={saving === setting.key}
                        className="px-3 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-800 disabled:opacity-50 flex items-center gap-1"
                    >
                        {saving === setting.key ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
                    </button>
                    <button onClick={() => { setEditingKey(null); setNewValue(''); setRevealedValue(null); }} className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500">
                        <X size={16} />
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-2">
                    <div className="font-mono text-sm text-gray-500 bg-gray-50 dark:bg-gray-900 px-3 py-1.5 rounded max-w-[300px] truncate" title={revealedValue || setting.masked_value}>
                        {!setting.has_value ? '(not set)' : revealedValue ? revealedValue : setting.masked_value}
                    </div>
                    {setting.has_value && (
                        <button
                            onClick={handleReveal}
                            disabled={revealing}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:bg-gray-700 rounded transition"
                            title={revealedValue ? 'Hide value' : 'Reveal value'}
                        >
                            {revealing ? <Loader size={16} className="animate-spin" /> : revealedValue ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    )}
                    <button
                        onClick={() => { setEditingKey(setting.key); setNewValue(''); setRevealedValue(null); }}
                        className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200"
                    >
                        Edit
                    </button>
                </div>
            )}
        </div>
    );
}
