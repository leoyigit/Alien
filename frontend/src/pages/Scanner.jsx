import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { RefreshCw, FolderPlus, Handshake, X, Search, Hash } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function Scanner() {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingChannel, setEditingChannel] = useState(null); // For editing client name
  const { showToast } = useToast();

  const fetchChannels = async () => {
    setLoading(true);
    try {
      const response = await api.get('/scan-channels');
      setChannels(response.data.channels);
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

  const handleMapAsProject = async (channelId, client, role) => {
    try {
      await api.post('/map-channel', {
        channel_id: channelId,
        client_name: client,
        role: role,
        is_partnership: false
      });
      setChannels(prev => prev.filter(c => c.id !== channelId));
      showToast(`✅ Mapped as Project: ${client}`, 'success');
    } catch (err) {
      showToast("Error mapping channel: " + err.message, 'error');
    }
  };

  const handleMapAsPartnership = async (channelId, client, role) => {
    try {
      await api.post('/map-channel', {
        channel_id: channelId,
        client_name: client,
        role: role,
        is_partnership: true
      });
      setChannels(prev => prev.filter(c => c.id !== channelId));
      showToast(`🤝 Mapped as Partnership: ${client}`, 'success');
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

  const filteredChannels = channels.filter(ch =>
    ch.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin text-4xl mb-4">📡</div>
        <div className="text-gray-500 font-medium">Scanning Slack channels...</div>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <div className="text-red-500 font-medium">{error}</div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">📡 Channel Scanner</h1>
          <p className="text-gray-500 mt-1">Map unmapped Slack channels to projects or partnerships</p>
        </div>
        <button
          onClick={fetchChannels}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 font-medium"
        >
          <RefreshCw size={18} />
          Rescan
        </button>
      </div>

      {/* SEARCH */}
      {channels.length > 0 && (
        <div className="mb-6 relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search channels..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      )}

      {/* CHANNELS GRID */}
      {filteredChannels.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-gray-300 rounded-xl">
          <Hash size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-400 mb-1">
            {searchTerm ? 'No channels found' : 'All channels are mapped! 🎉'}
          </p>
          {searchTerm && (
            <p className="text-xs text-gray-400">Try a different search term</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredChannels.map((ch) => (
            <div key={ch.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Hash size={18} className="text-gray-400" />
                      <h3 className="font-bold text-lg text-gray-900">{ch.name}</h3>
                    </div>
                    <p className="text-sm text-gray-500">{ch.members_count} members</p>
                  </div>
                </div>

                {ch.suggestion ? (
                  <div className="space-y-4">
                    {/* AI SUGGESTION */}
                    <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center shrink-0">
                        💡
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-bold text-blue-600 uppercase mb-0.5">AI Suggestion</div>
                        <div className="font-bold text-gray-900">
                          {editingChannel === ch.id ? (
                            <input
                              type="text"
                              defaultValue={ch.suggestion.client}
                              onBlur={(e) => {
                                ch.suggestion.client = e.target.value;
                                setEditingChannel(null);
                              }}
                              autoFocus
                              className="px-2 py-1 border rounded"
                            />
                          ) : (
                            <span
                              onClick={() => setEditingChannel(ch.id)}
                              className="cursor-pointer hover:underline"
                            >
                              {ch.suggestion.client}
                            </span>
                          )}
                          <span className={`ml-2 text-xs px-2 py-0.5 rounded ${ch.suggestion.role === 'internal' ? 'bg-blue-200 text-blue-700' : 'bg-green-200 text-green-700'}`}>
                            {ch.suggestion.role}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">Click name to edit</div>
                      </div>
                    </div>

                    {/* ACTION BUTTONS */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleMapAsProject(ch.id, ch.suggestion.client, ch.suggestion.role)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition"
                      >
                        <FolderPlus size={18} />
                        Add as Project
                      </button>
                      <button
                        onClick={() => handleMapAsPartnership(ch.id, ch.suggestion.client, ch.suggestion.role)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition"
                      >
                        <Handshake size={18} />
                        Add as Partnership
                      </button>
                      <button
                        onClick={() => handleIgnore(ch.id, ch.name)}
                        className="px-4 py-3 border border-gray-300 text-gray-600 rounded-lg hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition"
                        title="Ignore this channel"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">No AI suggestion available</span>
                    <button
                      onClick={() => handleIgnore(ch.id, ch.name)}
                      className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition text-sm font-medium"
                    >
                      Ignore
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}