import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../context/ProjectsContext.jsx';
import TerminalLoader from '../components/ui/TerminalLoader.jsx';
import { Archive, ExternalLink, RefreshCw, CheckCircle, MoreHorizontal } from 'lucide-react';

export default function Archives() {
    const { projects, loading, fetchProjects } = useProjects();
    const navigate = useNavigate();

    const archivedProjects = projects.filter(p => p.category === 'Launched');
    const sortedProjects = [...archivedProjects].sort((a, b) => new Date(b.last_updated_at || 0) - new Date(a.last_updated_at || 0));

    if (loading && projects.length === 0) return <TerminalLoader />;

    return (
        <div className="max-w-screen-2xl mx-auto p-6 bg-gray-50 min-h-screen font-sans">
            <div className="flex justify-between items-end mb-6">
                <div><h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3"><Archive size={28} className="text-gray-400" /> Archives</h1><p className="text-gray-500 mt-1 text-sm">Successfully launched projects.</p></div>
                <button onClick={() => fetchProjects(true)} className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500"><RefreshCw size={18} /></button>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-400 text-[10px] uppercase font-bold border-b border-gray-100 tracking-wider">
                        <tr><th className="p-4 pl-6">Client / Owner</th><th className="p-4">Status</th><th className="p-4 w-1/3">Final Note</th><th className="p-4">Launch Date</th><th className="p-4 text-right pr-6">View</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {sortedProjects.map((p) => (
                            <tr key={p.id} onClick={() => navigate(`/projects/${p.id}`)} className="hover:bg-gray-50 transition cursor-pointer group">
                                <td className="p-4 pl-6"><div className="font-bold text-gray-900 group-hover:text-blue-600 flex items-center gap-2">{p.client_name}{p.live_url && <ExternalLink size={12} className="text-gray-300 group-hover:text-blue-400" />}</div><div className="text-xs text-gray-400">{p.owner || "Unassigned"}</div></td>
                                <td className="p-4"><span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold border bg-green-100 text-green-700 border-green-200"><CheckCircle size={10} /> Launched</span></td>
                                <td className="p-4 text-gray-500 text-xs line-clamp-1 italic">{p.status_detail || "No final notes."}</td>
                                <td className="p-4 text-gray-900 font-medium text-xs">{p.launch_date_public || p.launch_date_internal || "-"}</td>
                                <td className="p-4 pr-6 text-right"><MoreHorizontal size={18} className="text-gray-300 group-hover:text-blue-600" /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {sortedProjects.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">No launched projects yet.</div>}
            </div>
        </div>
    );
}