import React, { useState, useEffect } from 'react';
import { Terminal } from 'lucide-react';

const MESSAGES = [
    "Initializing Secure Connection...",
    "Authenticating User Credentials...",
    "Connecting to Alien Database...",
    "Fetching Project Manifests...",
    "Decrypting Client Status...",
    "Syncing Slack Channels...",
    "Calibrating Dashboard Metrics...",
    "Almost there..."
];

export default function TerminalLoader() {
    const [currentLine, setCurrentLine] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentLine((prev) => (prev < MESSAGES.length - 1 ? prev + 1 : prev));
        }, 800);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-50 font-mono">
            <div className="bg-black text-green-400 p-8 rounded-xl shadow-2xl w-full max-w-md border border-gray-800 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-green-900/10 pointer-events-none" />
                <div className="flex items-center gap-3 mb-6 border-b border-green-900/50 pb-4">
                    <Terminal size={24} className="animate-pulse" />
                    <span className="font-bold tracking-wider text-sm">ALIEN_OS v2.0</span>
                </div>
                <div className="space-y-2 text-xs">
                    {MESSAGES.map((msg, index) => (
                        <div key={index} className={`flex items-center gap-2 transition-opacity duration-300 ${index > currentLine ? "opacity-0 hidden" : "opacity-100"} ${index === currentLine ? "text-green-300 font-bold" : "text-green-700"}`}>
                            <span className="opacity-50">[{new Date().toLocaleTimeString()}]</span>
                            <span>{index === currentLine ? "> " + msg : msg}</span>
                            {index === currentLine && <span className="animate-blink">_</span>}
                        </div>
                    ))}
                </div>
                <div className="mt-6 h-1 w-full bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 transition-all duration-500 ease-out" style={{ width: `${((currentLine + 1) / MESSAGES.length) * 100}%` }} />
                </div>
            </div>
        </div>
    );
}