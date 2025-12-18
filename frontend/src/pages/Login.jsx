import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, UserPlus, Mail, Lock, User, Loader, AlertCircle } from 'lucide-react';

export default function Login() {
    const [mode, setMode] = useState('login'); // 'login', 'signup', 'forgot'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const { login, signup } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            if (mode === 'login') {
                const result = await login(email, password);
                if (result.success) {
                    navigate('/projects');
                } else {
                    setError(result.error);
                }
            } else if (mode === 'signup') {
                const result = await signup(email, password, name);
                if (result.success) {
                    setSuccess('Account created! You can now log in.');
                    setMode('login');
                    setPassword('');
                } else {
                    setError(result.error);
                }
            } else if (mode === 'forgot') {
                // Forgot password - call Supabase reset
                const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/auth/forgot-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await res.json();
                if (res.ok) {
                    setSuccess('Password reset email sent! Check your inbox.');
                    setMode('login');
                } else {
                    setError(data.error || 'Failed to send reset email');
                }
            }
        } catch (e) {
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-black font-black text-2xl shadow-lg">
                            A
                        </div>
                        <span className="text-white font-black text-3xl tracking-tight">Alien Portal</span>
                    </div>
                    <p className="text-gray-400">Project Management & Communication Hub</p>
                </div>

                {/* Login Card */}
                <div className="bg-white rounded-2xl shadow-2xl p-8">
                    {/* Tab Switcher */}
                    <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
                        <button
                            onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition ${mode === 'login' || mode === 'forgot' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <LogIn size={16} /> Sign In
                        </button>
                        <button
                            onClick={() => { setMode('signup'); setError(''); setSuccess(''); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition ${mode === 'signup' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <UserPlus size={16} /> Sign Up
                        </button>
                    </div>

                    {/* Forgot Password Header */}
                    {mode === 'forgot' && (
                        <div className="mb-4">
                            <h3 className="font-bold text-lg">Reset Password</h3>
                            <p className="text-sm text-gray-500">Enter your email to receive a reset link</p>
                        </div>
                    )}

                    {/* Error/Success Messages */}
                    {error && (
                        <div className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm font-medium">
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}
                    {success && (
                        <div className="flex items-center gap-2 bg-green-50 text-green-600 px-4 py-3 rounded-lg mb-4 text-sm font-medium">
                            ✓ {success}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {mode === 'signup' && (
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Full Name</label>
                                <div className="relative">
                                    <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition"
                                        placeholder="John Doe"
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Email</label>
                            <div className="relative">
                                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition"
                                    placeholder="you@company.com"
                                    required
                                />
                            </div>
                        </div>

                        {mode !== 'forgot' && (
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Password</label>
                                <div className="relative">
                                    <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition"
                                        placeholder="••••••••"
                                        required
                                        minLength={6}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Forgot Password Link */}
                        {mode === 'login' && (
                            <button
                                type="button"
                                onClick={() => { setMode('forgot'); setError(''); setSuccess(''); }}
                                className="text-sm text-blue-600 hover:underline"
                            >
                                Forgot your password?
                            </button>
                        )}

                        {mode === 'forgot' && (
                            <button
                                type="button"
                                onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                                className="text-sm text-gray-500 hover:underline"
                            >
                                ← Back to login
                            </button>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-black text-white py-3.5 rounded-lg font-bold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition shadow-lg"
                        >
                            {loading ? (
                                <>
                                    <Loader size={18} className="animate-spin" /> Processing...
                                </>
                            ) : mode === 'login' ? (
                                <>
                                    <LogIn size={18} /> Sign In
                                </>
                            ) : mode === 'signup' ? (
                                <>
                                    <UserPlus size={18} /> Create Account
                                </>
                            ) : (
                                <>
                                    <Mail size={18} /> Send Reset Link
                                </>
                            )}
                        </button>
                    </form>

                    {/* Role Info */}
                    {mode !== 'forgot' && (
                        <div className="mt-6 pt-6 border-t border-gray-100">
                            <p className="text-xs text-gray-400 text-center">
                                Your role will be automatically assigned based on your email domain
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <p className="text-center text-gray-500 text-xs mt-6">
                    © {new Date().getFullYear()} Power Commerce & Flyrank. All rights reserved.
                </p>
            </div>
        </div>
    );
}
