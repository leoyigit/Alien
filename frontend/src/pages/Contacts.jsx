import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Users, Search, Mail, Phone, Briefcase, Plus, Edit2, Trash2, RefreshCw, Loader, X, Check, Building2, FileText } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { useAuth } from '../context/AuthContext';

export default function Contacts() {
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingContact, setEditingContact] = useState(null);
    const [syncing, setSyncing] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        role: 'Internal',
        phone: '',
        company: '',
        notes: ''
    });

    const { showToast } = useToast();
    const { confirm } = useConfirm();
    const { canAccessSettings } = useAuth();

    useEffect(() => {
        fetchContacts();
    }, []);

    const fetchContacts = async () => {
        try {
            const res = await api.get('/contacts');
            setContacts(res.data || []);
        } catch (err) {
            console.error('Failed to load contacts:', err);
            showToast('Failed to load contacts', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSyncSlack = async () => {
        setSyncing(true);
        try {
            const res = await api.post('/contacts/sync-slack');
            showToast(res.data.message, 'success');
            fetchContacts(); // Refresh to show updated Slack IDs
        } catch (e) {
            showToast(e.response?.data?.error || 'Failed to sync Slack IDs', 'error');
        } finally {
            setSyncing(false);
        }
    };

    const handleScanChannels = async () => {
        setScanning(true);
        try {
            const res = await api.post('/contacts/scan-channels');
            showToast(res.data.message, 'success');
            fetchContacts(); // Refresh to show new contacts
        } catch (e) {
            showToast(e.response?.data?.error || 'Failed to scan channels', 'error');
        } finally {
            setScanning(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            if (editingContact) {
                await api.put(`/contacts/${editingContact.id}`, formData);
                showToast('Contact updated!', 'success');
            } else {
                await api.post('/contacts', formData);
                showToast('Contact added!', 'success');
            }

            setShowAddModal(false);
            setEditingContact(null);
            setFormData({ name: '', email: '', role: 'Internal', phone: '', company: '', notes: '' });
            fetchContacts();
        } catch (e) {
            showToast(e.response?.data?.error || 'Failed to save contact', 'error');
        }
    };

    const handleEdit = (contact) => {
        setEditingContact(contact);
        setFormData({
            name: contact.name || '',
            email: contact.email || '',
            role: contact.role || 'Internal',
            phone: contact.phone || '',
            company: contact.company || '',
            notes: contact.notes || ''
        });
        setShowAddModal(true);
    };

    const handleDelete = async (contact) => {
        const confirmed = await confirm({
            title: 'Delete Contact',
            message: `Are you sure you want to delete ${contact.name}?`,
            variant: 'danger'
        });

        if (!confirmed) return;

        try {
            await api.delete(`/contacts/${contact.id}`);
            showToast('Contact deleted!', 'success');
            fetchContacts();
        } catch (e) {
            showToast('Failed to delete contact', 'error');
        }
    };

    const filteredContacts = contacts.filter(contact => {
        const matchesSearch = !searchTerm ||
            contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            contact.company?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesRole = roleFilter === 'all' || contact.role === roleFilter;

        return matchesSearch && matchesRole;
    });

    const roleOptions = ['Internal', 'PM', 'Dev', 'Both', 'Shopline Team', 'External', 'Merchant'];
    const roleColors = {
        'PM': 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
        'Dev': 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
        'Both': 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
        'Internal': 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
        'Shopline Team': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
        'External': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
        'Merchant': 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <PageHeader
                icon={Users}
                title="Contacts"
                description="Manage team members and contacts"
            />

            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                {/* Search */}
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search contacts..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-white dark:bg-gray-800 dark:text-white"
                    />
                </div>

                {/* Role Filter */}
                <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white font-medium"
                >
                    <option value="all">All Roles</option>
                    {roleOptions.map(role => (
                        <option key={role} value={role}>{role}</option>
                    ))}
                </select>

                {/* Scan Channels */}
                {canAccessSettings && (
                    <button
                        onClick={handleScanChannels}
                        disabled={scanning}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition"
                    >
                        {scanning ? <Loader size={18} className="animate-spin" /> : <Users size={18} />}
                        {scanning ? 'Scanning...' : 'Scan Channels'}
                    </button>
                )}

                {/* Sync Slack IDs */}
                {canAccessSettings && (
                    <button
                        onClick={handleSyncSlack}
                        disabled={syncing}
                        className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50 transition"
                    >
                        {syncing ? <Loader size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                        {syncing ? 'Syncing...' : 'Sync Slack IDs'}
                    </button>
                )}

                {/* Add Contact */}
                {canAccessSettings && (
                    <button
                        onClick={() => {
                            setEditingContact(null);
                            setFormData({ name: '', email: '', role: 'Internal', phone: '', company: '', notes: '' });
                            setShowAddModal(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-black text-white rounded-lg font-bold hover:bg-gray-800 transition"
                    >
                        <Plus size={18} />
                        Add Contact
                    </button>
                )}
            </div>

            {/* Contacts Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader size={32} className="animate-spin text-gray-400" />
                </div>
            ) : filteredContacts.length === 0 ? (
                <div className="text-center py-20">
                    <Users size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">No contacts found</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredContacts.map(contact => (
                        <div key={contact.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-lg transition">
                            {/* Header */}
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">{contact.name}</h3>
                                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[contact.role] || roleColors['Internal']}`}>
                                        {contact.role}
                                    </span>
                                </div>

                                {canAccessSettings && (
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => handleEdit(contact)}
                                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900 rounded transition"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(contact)}
                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded transition"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Contact Info */}
                            <div className="space-y-2">
                                {contact.email && (
                                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                        <Mail size={14} className="flex-shrink-0" />
                                        <span className="truncate">{contact.email}</span>
                                    </div>
                                )}

                                {contact.phone && (
                                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                        <Phone size={14} className="flex-shrink-0" />
                                        <span>{contact.phone}</span>
                                    </div>
                                )}

                                {contact.company && (
                                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                        <Building2 size={14} className="flex-shrink-0" />
                                        <span className="truncate">{contact.company}</span>
                                    </div>
                                )}

                                {contact.slack_user_id && (
                                    <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 font-medium">
                                        <Check size={14} />
                                        <span>Slack Synced</span>
                                    </div>
                                )}

                                {contact.notes && (
                                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                                        <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
                                            <FileText size={12} className="flex-shrink-0 mt-0.5" />
                                            <span className="line-clamp-2">{contact.notes}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full border-2 border-gray-200 dark:border-gray-700">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                {editingContact ? 'Edit Contact' : 'Add Contact'}
                            </h3>
                            <button
                                onClick={() => {
                                    setShowAddModal(false);
                                    setEditingContact(null);
                                }}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                    Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                                    placeholder="John Doe"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                                    placeholder="john@example.com"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                    Role
                                </label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                                >
                                    {roleOptions.map(role => (
                                        <option key={role} value={role}>{role}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                    Phone
                                </label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                                    placeholder="+1 234 567 8900"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                    Company
                                </label>
                                <input
                                    type="text"
                                    value={formData.company}
                                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                                    placeholder="Acme Inc."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                    Notes
                                </label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    rows={3}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-none bg-white dark:bg-gray-700 dark:text-white"
                                    placeholder="Additional notes..."
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddModal(false);
                                        setEditingContact(null);
                                    }}
                                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition"
                                >
                                    {editingContact ? 'Update' : 'Add'} Contact
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
