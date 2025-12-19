import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { RefreshCw, FolderPlus, Handshake, X, Search, Check, CheckSquare, Square } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function Scanner() {
  const [channels, setChannels] = useState([]);
  const [ignoredChannels, setIgnoredChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [clientNames, setClientNames] = useState({});
  const [filterTab, setFilterTab] = useState('unmapped'); // 'unmapped', 'ignored', 'all'
  const [selectedChannels, setSelectedChannels] = useState(new Set());
  const [bulkClientName, setBulkClientName] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkAction, setBulkAction] = useState(null); // 'project', 'partnership', 'ignore'
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

  const fetchIgnoredChannels = async () => {
    try {
      const response = await api.get('/ignored-channels');
      setIgnoredChannels(response.data || []);
    } catch (err) {
      console.error('Failed to fetch ignored channels:', err);
    }
  };

  useEffect(() => {
    fetchChannels();
    fetchIgnoredChannels();
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
      fetchIgnoredChannels(); // Refresh ignored list
    } catch (err) {
      showToast("Error ignoring channel", 'error');
    }
  };

  const handleBulkAction = (action) => {
    if (selectedChannels.size === 0) {
      showToast('Please select at least one channel', 'error');
      return;
    }
    setBulkAction(action);
    if (action === 'ignore') {
      executeBulkIgnore();
    } else {
      setShowBulkModal(true);
    }
  };

  const executeBulkIgnore = async () => {
    try {
      const channelNames = {};
      selectedChannels.forEach(id => {
        const ch = channels.find(c => c.id === id);
        if (ch) channelNames[id] = ch.name;
      });

      await api.post('/bulk-ignore-channels', {
        channel_ids: Array.from(selectedChannels),
        channel_names: channelNames
      });

      setChannels(prev => prev.filter(c => !selectedChannels.has(c.id)));
      setSelectedChannels(new Set());
      showToast(`✅ Ignored ${selectedChannels.size} channels`, 'success');
      fetchIgnoredChannels();
    } catch (err) {
      showToast('Bulk ignore failed: ' + err.message, 'error');
    }
  };

  const executeBulkMap = async () => {
    if (!bulkClientName.trim()) {
      showToast('Please enter a client name', 'error');
      return;
    }

    try {
      // Detect role from first selected channel
      const firstChannel = channels.find(c => selectedChannels.has(c.id));
      const role = detectRole(firstChannel?.name) || 'external';

      await api.post('/bulk-map-channels', {
        channel_ids: Array.from(selectedChannels),
        client_name: bulkClientName,
        is_partnership: bulkAction === 'partnership',
        role: role
      });

      setChannels(prev => prev.filter(c => !selectedChannels.has(c.id)));
      setSelectedChannels(new Set());
      setBulkClientName('');
      setShowBulkModal(false);
      showToast(`✅ Mapped ${selectedChannels.size} channels`, 'success');
    } catch (err) {
      showToast('Bulk mapping failed: ' + err.message, 'error');
    }
  };

  const toggleChannelSelection = (channelId) => {
    const newSet = new Set(selectedChannels);
    if (newSet.has(channelId)) {
      newSet.delete(channelId);
    } else {
      newSet.add(channelId);
    }
    setSelectedChannels(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedChannels.size === filteredChannels.length) {
      setSelectedChannels(new Set());
    } else {
      setSelectedChannels(new Set(filteredChannels.map(c => c.id)));
    }
  };

  const detectRole = (channelName) => {
    if (!channelName) return null;
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

  // Determine which channels to show based on filter tab
  let displayChannels = [];
  if (filterTab === 'unmapped') {
    displayChannels = channels;
  } else if (filterTab === 'ignored') {
    displayChannels = ignoredChannels.map(ig => ({ id: ig.channel_id, name: ig.channel_name, members_count: 0, isIgnored: true }));
  } else if (filterTab === 'all') {
    const ignoredIds = new Set(ignoredChannels.map(ig => ig.channel_id));
    displayChannels = [
      ...channels,
      ...ignoredChannels.filter(ig => !ignoredIds.has(ig.channel_id)).map(ig => ({ id: ig.channel_id, name: ig.channel_name, members_count: 0, isIgnored: true }))
    ];
  }

  const filteredChannels = displayChannels.filter(ch =>
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
          onClick={() => { fetchChannels(); fetchIgnoredChannels(); }}
          className="flex items-center gap-2 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 font-medium"
        >
          <RefreshCw size={18} />
          Rescan
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilterTab('unmapped')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition ${filterTab === 'unmapped' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'}`}
        >
          Unmapped ({channels.length})
        </button>
        <button
          onClick={() => setFilterTab('ignored')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition ${filterTab === 'ignored' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'}`}
        >
          Ignored ({ignoredChannels.length})
        </button>
        <button
          onClick={() => setFilterTab('all')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition ${filterTab === 'all' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'}`}
        >
          All
        </button>
      </div>

      {/* Search */}
      {displayChannels.length > 0 && (
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

      {/* Bulk Actions Bar */}
      {selectedChannels.size > 0 && filterTab === 'unmapped' && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center justify-between">
          <span className="font-bold text-blue-900 dark:text-blue-100">{selectedChannels.size} selected</span>
          <div className="flex gap-2">
            <button
              onClick={() => handleBulkAction('ignore')}
              className="px-4 py-2 bg-gray-600 text-white text-sm font-bold rounded-lg hover:bg-gray-700 transition"
            >
              <X size={14} className="inline mr-1" />
              Ignore
            </button>
            <button
              onClick={() => handleBulkAction('project')}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition"
            >
              <FolderPlus size={14} className="inline mr-1" />
              Map as Projects
            </button>
            <button
              onClick={() => handleBulkAction('partnership')}
              className="px-4 py-2 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 transition"
            >
              <Handshake size={14} className="inline mr-1" />
              Map as Partnerships
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {filteredChannels.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
          <div className="text-4xl mb-3">🎉</div>
          <p className="font-medium text-gray-400 dark:text-gray-500 mb-1">
            {searchTerm ? 'No channels found' : filterTab === 'unmapped' ? 'All channels are mapped!' : 'No channels in this view'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-500 text-xs uppercase font-bold border-b border-gray-100 dark:border-gray-700">
              <tr>
                {filterTab === 'unmapped' && (
                  <th className="p-4 w-12">
                    <button onClick={toggleSelectAll} className="text-gray-600 dark:text-gray-400 hover:text-blue-600">
                      {selectedChannels.size === filteredChannels.length ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>
                  </th>
                )}
                <th className="p-4 w-64">Channel</th>
                {filterTab !== 'ignored' && <th className="p-4 w-48">Client Name</th>}
                {filterTab !== 'ignored' && <th className="p-4 w-32">Type</th>}
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {filteredChannels.map((ch) => {
                const detectedRole = detectRole(ch.name);
                const suggestedRole = ch.suggestion?.role || detectedRole || 'external';

                return (
                  <tr key={ch.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition ${getChannelColor(ch.name)}`}>
                    {filterTab === 'unmapped' && (
                      <td className="p-4">
                        <button
                          onClick={() => toggleChannelSelection(ch.id)}
                          className="text-gray-600 dark:text-gray-400 hover:text-blue-600"
                        >
                          {selectedChannels.has(ch.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>
                      </td>
                    )}
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 dark:text-white">#{ch.name}</span>
                        {getRoleBadge(detectedRole)}
                        {ch.isIgnored && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 font-semibold">Ignored</span>}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{ch.members_count} members</div>
                    </td>
                    {filterTab !== 'ignored' && (
                      <td className="p-4">
                        <input
                          type="text"
                          value={clientNames[ch.id] || ''}
                          onChange={(e) => setClientNames({ ...clientNames, [ch.id]: e.target.value })}
                          placeholder="Enter client name..."
                          className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                    )}
                    {filterTab !== 'ignored' && (
                      <td className="p-4">
                        <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                          {suggestedRole === 'internal' ? 'Internal' : 'External'}
                        </span>
                      </td>
                    )}
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        {!ch.isIgnored ? (
                          <>
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
                          </>
                        ) : (
                          <span className="text-xs text-gray-500 italic">No actions available</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk Mapping Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowBulkModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Bulk Map as {bulkAction === 'project' ? 'Projects' : 'Partnerships'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Enter a base client name. If multiple channels are selected, they will be numbered (e.g., "Acme 1", "Acme 2").
            </p>
            <input
              type="text"
              value={bulkClientName}
              onChange={(e) => setBulkClientName(e.target.value)}
              placeholder="Enter client name..."
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={executeBulkMap}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
              >
                Map {selectedChannels.size} Channels
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}