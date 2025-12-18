import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { ArrowLeft, User, Clock, ShieldCheck, Globe } from 'lucide-react';

// Common Slack emoji mappings
const SLACK_EMOJIS = {
  // Faces
  'grinning': '😀', 'smile': '😄', 'laughing': '😆', 'blush': '😊', 'wink': '😉',
  'heart_eyes': '😍', 'kissing_heart': '😘', 'thinking_face': '🤔', 'raised_eyebrow': '🤨',
  'neutral_face': '😐', 'expressionless': '😑', 'rolling_eyes': '🙄', 'grimacing': '😬',
  'relieved': '😌', 'pensive': '😔', 'sleepy': '😪', 'drooling_face': '🤤', 'sleeping': '😴',
  'mask': '😷', 'thermometer_face': '🤒', 'sunglasses': '😎', 'nerd_face': '🤓',
  'confused': '😕', 'worried': '😟', 'frowning': '☹️', 'persevere': '😣', 'cry': '😢',
  'sob': '😭', 'scream': '😱', 'angry': '😠', 'rage': '😡', 'skull': '💀',
  // Hands
  'thumbsup': '👍', 'thumbsdown': '👎', '+1': '👍', '-1': '👎', 'ok_hand': '👌',
  'wave': '👋', 'clap': '👏', 'raised_hands': '🙌', 'pray': '🙏', 'handshake': '🤝',
  'point_up': '☝️', 'point_down': '👇', 'point_left': '👈', 'point_right': '👉',
  'muscle': '💪', 'fist': '✊', 'v': '✌️', 'metal': '🤘', 'call_me_hand': '🤙',
  // Hearts & Symbols
  'heart': '❤️', 'orange_heart': '🧡', 'yellow_heart': '💛', 'green_heart': '💚',
  'blue_heart': '💙', 'purple_heart': '💜', 'black_heart': '🖤', 'white_heart': '🤍',
  'broken_heart': '💔', 'fire': '🔥', 'star': '⭐', 'star2': '🌟', 'sparkles': '✨',
  'boom': '💥', 'zap': '⚡', '100': '💯', 'check': '✅', 'x': '❌', 'warning': '⚠️',
  'question': '❓', 'exclamation': '❗', 'bulb': '💡', 'bell': '🔔', 'mega': '📣',
  // Objects & Work
  'rocket': '🚀', 'tada': '🎉', 'party_popper': '🎉', 'gift': '🎁', 'trophy': '🏆',
  'medal': '🏅', 'calendar': '📅', 'chart_with_upwards_trend': '📈', 'chart': '📈',
  'clipboard': '📋', 'memo': '📝', 'pencil': '✏️', 'email': '📧', 'envelope': '✉️',
  'computer': '💻', 'phone': '📱', 'link': '🔗', 'lock': '🔒', 'key': '🔑',
  'hammer': '🔨', 'wrench': '🔧', 'gear': '⚙️', 'package': '📦', 'truck': '🚚',
  // Misc
  'eyes': '👀', 'eye': '👁️', 'brain': '🧠', 'money_mouth_face': '🤑', 'money_bag': '💰',
  'gem': '💎', 'hourglass': '⏳', 'clock': '🕐', 'sunny': '☀️', 'moon': '🌙',
  'rainbow': '🌈', 'umbrella': '☂️', 'snowflake': '❄️', 'coffee': '☕', 'beer': '🍺',
  'pizza': '🍕', 'cake': '🍰', 'cookie': '🍪', 'apple': '🍎', 'banana': '🍌',
  'dog': '🐕', 'cat': '🐈', 'unicorn': '🦄', 'alien': '👽',
  // Common custom/slack specific
  'slightly_smiling_face': '🙂', 'upside_down_face': '🙃', 'sweat_smile': '😅',
  'joy': '😂', 'rofl': '🤣', 'hugging_face': '🤗', 'star-struck': '🤩',
  'partying_face': '🥳', 'smirk': '😏', 'unamused': '😒', 'disappointed': '😞',
  'weary': '😩', 'pleading_face': '🥺', 'facepalm': '🤦', 'shrug': '🤷',
  'crossed_fingers': '🤞', 'palms_up_together': '🤲', 'writing_hand': '✍️',
  'dart': '🎯', 'bowling': '🎳', 'video_game': '🎮', 'slot_machine': '🎰',
  'thinking': '🤔', 'face_with_monocle': '🧐', 'white_check_mark': '✅', 'heavy_check_mark': '✔️'
};

// Parse :emoji: codes to unicode
const parseEmojis = (text) => {
  if (!text) return '';
  return text.replace(/:([a-z0-9_+-]+):/gi, (match, code) => {
    return SLACK_EMOJIS[code.toLowerCase()] || match;
  });
};

export default function ProjectLogs() {
  const { id } = useParams();
  const [logs, setLogs] = useState([]);
  const [project, setProject] = useState(null);
  const [userMap, setUserMap] = useState({}); // Stores { "U123": "Leo" }
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('internal');

  useEffect(() => {
    // 1. Fetch Project Details
    api.get('/projects').then(res => {
      const found = res.data.find(p => p.id.toString() === id);
      setProject(found);
    });

    // 2. Fetch User "Address Book"
    api.get('/slack-users').then(res => {
      setUserMap(res.data);
    });
  }, [id]);

  useEffect(() => {
    // 3. Fetch Logs based on Tab
    setLoading(true);
    api.get(`/projects/${id}/logs`, { params: { visibility: activeTab } }).then(res => {
      setLogs(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id, activeTab]);

  // Helper: "Hey <@U123>"  -->  "Hey @Leo"
  const formatMessageContent = (text) => {
    if (!text) return "";
    // First replace mentions
    let formatted = text.replace(/<@([A-Z0-9]+)>/g, (match, userId) => {
      const name = userMap[userId];
      return name ? `@${name}` : `@${userId}`;
    });
    // Then parse emojis
    return parseEmojis(formatted);
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateHeader = (dateStr) => {
    if (!dateStr) return "Unknown Date";
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }

    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
  };

  // Group logs by day
  const groupLogsByDay = (logs) => {
    const groups = {};
    logs.forEach(log => {
      const dateKey = new Date(log.created_at).toDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(log);
    });
    return groups;
  };

  const groupedLogs = groupLogsByDay(logs);
  const sortedDays = Object.keys(groupedLogs).sort((a, b) => new Date(b) - new Date(a));

  return (
    <div className="max-w-4xl mx-auto p-8">
      <Link to="/projects" className="flex items-center gap-2 text-gray-500 hover:text-blue-600 mb-6 transition">
        <ArrowLeft size={18} /> Back to Dashboard
      </Link>

      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {project ? project.client_name : "Loading..."}
          </h1>
          <p className="text-gray-500">Communication History</p>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-gray-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('internal')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'internal' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <ShieldCheck size={16} /> Internal
          </button>
          <button
            onClick={() => setActiveTab('external')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'external' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Globe size={16} /> External
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {loading ? (
          <div className="text-center py-10 text-gray-400 font-mono text-sm animate-pulse">Syncing logs...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-20 bg-white border border-dashed border-gray-300 rounded-2xl text-gray-400">
            <p className="mb-2 font-medium">No {activeTab} messages found.</p>
            <p className="text-xs">Click "Fetch History" on the dashboard to sync.</p>
          </div>
        ) : (
          sortedDays.map(day => (
            <div key={day}>
              {/* Day Separator */}
              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px bg-gray-200"></div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider px-3 py-1 bg-gray-100 rounded-full">
                  {formatDateHeader(day)}
                </span>
                <div className="flex-1 h-px bg-gray-200"></div>
              </div>

              {/* Messages for this day */}
              <div className="space-y-3">
                {groupedLogs[day].map((log) => (
                  <div key={log.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex gap-3 transition hover:shadow-md hover:border-blue-100">
                    {/* Avatar / Initials */}
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${log.sender_name?.toLowerCase().includes('bot') ? 'bg-gray-100 text-gray-400' : 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'}`}>
                      {log.sender_name ? log.sender_name.charAt(0).toUpperCase() : "?"}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="font-bold text-gray-900 text-sm">{log.sender_name}</span>
                        <span className="text-[11px] text-gray-400">
                          {formatTime(log.created_at)}
                        </span>
                      </div>

                      {/* Message Content with Emojis */}
                      <p className="text-gray-700 text-[13px] leading-relaxed whitespace-pre-wrap break-words">
                        {formatMessageContent(log.content)}
                      </p>

                      {/* Emoji Reactions */}
                      {log.reactions && log.reactions.length > 0 && (
                        <div className="flex gap-1.5 mt-2">
                          {log.reactions.map((r, i) => (
                            <span key={i} className="inline-flex items-center px-2 py-0.5 bg-gray-50 border border-gray-100 rounded-md text-xs">
                              {parseEmojis(`:${r.name || r.emoji || 'emoji'}:`)}
                              <span className="ml-1 text-[10px] font-bold text-gray-400">{r.count || 1}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}