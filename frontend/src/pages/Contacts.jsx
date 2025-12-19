import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Users, Plus, Trash2, Edit2, X, Save } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import PageHeader from '../components/ui/PageHeader';

export default function Contacts() {
    const [contacts, setContacts] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingContact, setEditingContact] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        company: '',
        role: 'Merchant',
        slack_user_id: '',
        notes: '',
        project_ids: []
    });
    const { showToast } = useToast();

    useEffect(() => {
        fetchContacts();
        fetchProjects();
    }, []);

    const fetchContacts = async () => {
        try {
            const res = await api.get('/contacts');
            setContacts(res.data);
        } catch (err) {
            showToast('Failed to load contacts', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchProjects = async () => {
        try {
            const res = await api.get('/projects');
            setProjects(res.data);
        } catch (err) {
            console.error('Failed to load projects');
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
                showToast('Contact created!', 'success');
            }
            setShowModal(false);
            setEditingContact(null);
            resetForm();
            fetchContacts();
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to save contact', 'error');
        }
    };

    const handleDelete = async (contactId) => {
        if (!confirm('Delete this contact?')) return;
        try {
            await api.delete(`/contacts/${contactId}`);
            showToast('Contact deleted', 'success');
            fetchContacts();
        } catch (err) {
            showToast('Failed to delete contact', 'error');
        }
    };

    const openEditModal = (contact) => {
        setEditingContact(contact);
        setFormData({
            name: contact.name || '',
            email: contact.email || '',
            phone: contact.phone || '',
            company: contact.company || '',
            role: contact.role || 'Merchant',
            slack_user_id: contact.slack_user_id || '',
            notes: contact.notes || '',
            project_ids: contact.project_ids || []
        });
        setShowModal(true);
    };

    const openCreateModal = () => {
        setEditingContact(null);
        resetForm();
        setShowModal(true);
    };

    const resetForm = () => {
        setFormData({
            name: '',
            email: '',
            phone: '',
            company: '',
            role: 'Merchant',
            slack_user_id: '',
            notes: '',
            project_ids: []
        });
    };

    const getProjectName = (projectId) => {
        const project = projects.find(p => p.id === projectId);
        return project?.client_name || 'Unknown Project';
    };

    if (loading) {
        return <div className="p-10 text-center text-gray-500 dark:text-gray-400">Loading...</div>;
    }

    return (
        <div className="max-w-7xl mx-auto p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
            <PageHeader
                title="Contacts"
                subtitle="Manage all stakeholders and partners"
                icon={Users}
                actions={
                    <button
                        onClick={openCreateModal}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    >
                        <Plus size={18} />
                        Add Contact
                    </button>
                }
            />

            {/* Contacts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {contacts.map((contact) => (
                    <div key={contact.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition">
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900 dark:text-white">{contact.name}</h3>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-semibold">
                                    {contact.role}
                                </span>
                            </div>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => openEditModal(contact)}
                                    className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                                >
                                    <Edit2 size={14} />
                                </button>
                                <button
                                    onClick={() => handleDelete(contact.id)}
                                    className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1 text-sm">
                            {contact.email && (
                                <div className="text-gray-600 dark:text-gray-300 truncate">{contact.email}</div>
                            )}
                            {contact.company && (
                                <div className="text-gray-500 dark:text-gray-400">{contact.company}</div>
                            )}
                            {contact.project_ids && contact.project_ids.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                                    <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Projects:</div>
                                    <div className="flex flex-wrap gap-1">
                                        {contact.project_ids.slice(0, 2).map(pid => (
                                            <span key={pid} className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                                                {getProjectName(pid)}
                                            </span>
                                        ))}
                                        {contact.project_ids.length > 2 && (
                                            <span className="text-xs text-gray-400 dark:text-gray-500">+{contact.project_ids.length - 2}</span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {contacts.length === 0 && (
                <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                    <Users size={48} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                    <p className="text-gray-500 dark:text-gray-400">No contacts yet. Add your first contact!</p>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white">
                                {editingContact ? 'Edit Contact' : 'New Contact'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                                <X size={20} className="text-gray-500 dark:text-gray-400" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                                    <input
                                        type="text"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Company</label>
                                    <input
                                        type="text"
                                        value={formData.company}
                                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Role</label>
                                    <select
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    >
                                        <option value="Merchant">Merchant</option>
                                        <option value="Partner">Partner</option>
                                        <option value="Shopline">Shopline</option>
                                        <option value="Internal">Internal</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white h-20"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
                                >
                                    <Save size={16} />
                                    {editingContact ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
