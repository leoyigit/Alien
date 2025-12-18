import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { RefreshCw, ArrowRight, Check, X } from 'lucide-react';

export default function Scanner() {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 1. Fetch channels from Python
  const fetchChannels = async () => {
    setLoading(true);
    try {
      const response = await api.get('/scan-channels');
      setChannels(response.data.channels);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to connect to Backend (Is port 5001 running?)');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  // 2. Handle Mapping Action
  const handleMap = async (channelId, client, role) => {
    try {
      await api.post('/map-channel', {
        channel_id: channelId,
        client_name: client,
        role: role
      });
      // Remove from list locally for instant feedback
      setChannels(prev => prev.filter(c => c.id !== channelId));
    } catch (err) {
      alert("Error mapping channel: " + err.message);
    }
  };

  const handleIgnore = async (channelId, name) => {
    try {
      await api.post('/ignore-channel', { channel_id: channelId, channel_name: name });
      setChannels(prev => prev.filter(c => c.id !== channelId));
    } catch (err) {
      alert("Error ignoring channel");
    }
  };

  if (loading) return <div className="p-10 text-center">Scanning Slack... 👽</div>;
  if (error) return <div className="p-10 text-red-500 text-center">{error}</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">📡 Channel Scanner</h1>
        <button 
          onClick={fetchChannels} 
          className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
        >
          <RefreshCw size={16} /> Rescan
        </button>
      </div>

      <div className="bg-white rounded-lg shadow border">
        {channels.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            All channels are mapped! 🎉
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 text-sm">
              <tr>
                <th className="p-4">Channel Name</th>
                <th className="p-4">AI Suggestion</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {channels.map((ch) => (
                <tr key={ch.id} className="hover:bg-gray-50">
                  <td className="p-4 font-medium">#{ch.name}</td>
                  <td className="p-4">
                    {ch.suggestion ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${
                        ch.suggestion.role === 'internal' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {ch.suggestion.client} ({ch.suggestion.role})
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">No match</span>
                    )}
                  </td>
                  <td className="p-4 flex justify-end gap-2">
                    {ch.suggestion && (
                      <button
                        onClick={() => handleMap(ch.id, ch.suggestion.client, ch.suggestion.role)}
                        className="p-2 bg-green-50 text-green-600 rounded hover:bg-green-100 border border-green-200"
                        title="Accept Suggestion"
                      >
                        <Check size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => handleIgnore(ch.id, ch.name)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                      title="Ignore Channel"
                    >
                      <X size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}