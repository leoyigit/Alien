import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { RefreshCw, FolderPlus, Handshake, X, Search } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function Scanner() {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [clientNames, setClientNames] = useState({});
  const { showToast } = useToast();

  const fetchChannels = async () => {
    setLoading(true);
    try {
      const response = await api.get('/scan-channels');
      setChannels(response.data.channels);

      // Initialize client names from suggestions
      const names = {};
      response.data.channels.forEach(ch => {
        if (ch.suggestion) {
          names[ch.id] = ch.suggestion.client;
        }
      });
      setClientNames(names);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to connect to Backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  const handleMapAsProject = async (channelId, role) => {
    const clientName = clientNames[channelId];
    if (!clientName || !clientName.trim()) {
      showToast('Please enter a client name', 'error');
      return;
    }

    try {
      await api.post('/map-channel', {
        channel_id: channelId,
        client_name: clientName,
        role: role,
        is_partnership: false
      });
      setChannels(prev => prev.filter(c => c.id !== channelId));
      showToast(`✅ Mapped as Project: ${clientName}`, 'success');
    } catch (err) {
      showToast("Error mapping channel: " + err.message, 'error');
    }
  };

  const handleMapAsPartnership = async (channelId, role) => {
    const clientName = clientNames[channelId];
    if (!clientName || !clientName.trim()) {
      showToast('Please enter a client name', 'error');
      return;
    }

    try {
      await api.post('/map-channel', {
        channel_id: channelId,
        client_name: clientName,
        role: role,
        is_partnership: true
      });
      setChannels(prev => prev.filter(c => c.id !== channelId));
      showToast(`🤝 Mapped as Partnership: ${clientName}`, 'success');
    } catch (err) {
      showToast("Error mapping channel: " + err.message, 'error');
    }
  };

  const handleIgnore = async (channelId, name) => {
    try {
      await api.post('/ignore-channel', { channel_id: channelId, channel_name: name });
      setChannels(prev => prev.filter(c => c.id !== channelId));
      showToast(`Ignored #${name}`, 'success');
    } catch (err) {
      showToast("Error ignoring channel", 'error');
    }
  };

  const detectRole = (channelName) => {
    if (channelName.includes('-internal')) return 'internal';
    if (channelName.includes('-external')) return 'external';
    return null;
  };

  const getChannelColor = (channelName) => {
    if (channelName.includes('-internal')) {
      return 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800';
    }
    if (channelName.includes('-external')) {
      return 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800';
    }
    return 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
  };

  const getRoleBadge = (role) => {
    if (role === 'internal') {
      return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-semibold">Internal</span>;
    }
    if (role === 'external') {
      return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 font-semibold">External</span>;
    }
    return null;
  };

  const filteredChannels = channels.filter(ch =>
    ch.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="animate-spin text-4xl mb-4">📡</div>
        <div className="text-gray-500 dark:text-gray-400 font-medium">Scanning Slack channels...</div>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <div className="text-red-500 dark:text-red-400 font-medium">{error}</div>
      </div>
    </div>
  );

  return (
    <div className="max-w-screen-2xl mx-auto p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">📡 Channel Scanner</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Map unmapped Slack channels to projects or partnerships</p>
        </div>
        <button
          onClick={fetchChannels}
          className="flex items-center gap-2 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 font-medium"
        >
          <RefreshCw size={18} />
          Rescan
        </button>
      </div>

      {/* Search */}
      {channels.length > 0 && (
        <div className="mb-6 relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
          <input
            type="text"
            placeholder="Search channels..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      )}

      {/* Table */}
      {filteredChannels.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
          <div className="text-4xl mb-3">🎉</div>
          <p className="font-medium text-gray-400 dark:text-gray-500 mb-1">
            {searchTerm ? 'No channels found' : 'All channels are mapped!'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-500 text-xs uppercase font-bold border-b border-gray-100 dark:border-gray-700">
              <tr>
                <th className="p-4 w-64">Channel</th>
                <th className="p-4 w-48">Client Name</th>
                <th className="p-4 w-32">Type</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {filteredChannels.map((ch) => {
                const detectedRole = detectRole(ch.name);
                const suggestedRole = ch.suggestion?.role || detectedRole || 'external';

                return (
                  <tr key={ch.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition ${getChannelColor(ch.name)}`}>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 dark:text-white">#{ch.name}</span>
                        {getRoleBadge(detectedRole)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{ch.members_count} members</div>
                    </td>
                    <td className="p-4">
                      <input
                        type="text"
                        value={clientNames[ch.id] || ''}
                        onChange={(e) => setClientNames({ ...clientNames, [ch.id]: e.target.value })}
                        placeholder="Enter client name..."
                        className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="p-4">
                      <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                        {suggestedRole === 'internal' ? 'Internal' : 'External'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleMapAsProject(ch.id, suggestedRole)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition"
                        >
                          <FolderPlus size={14} />
                          Project
                        </button>
                        <button
                          onClick={() => handleMapAsPartnership(ch.id, suggestedRole)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 transition"
                        >
                          <Handshake size={14} />
                          Partnership
                        </button>
                        <button
                          onClick={() => handleIgnore(ch.id, ch.name)}
                          className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition"
                          title="Ignore this channel"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}