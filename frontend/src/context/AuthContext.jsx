import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

const ROLE_HIERARCHY = {
    superadmin: 4,
    internal: 3,
    shopline: 2,
    merchant: 1
};

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Check for existing session on mount
    useEffect(() => {
        const token = localStorage.getItem('access_token');
        if (token) {
            fetchCurrentUser(token);
        } else {
            setLoading(false);
        }
    }, []);

    const fetchCurrentUser = async (token) => {
        try {
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            const res = await api.get('/auth/me');
            setUser(res.data.user);
        } catch (e) {
            console.error('Session expired or invalid');
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            delete api.defaults.headers.common['Authorization'];
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        setError(null);
        try {
            const res = await api.post('/auth/login', { email, password });

            if (res.data.success) {
                const { access_token, refresh_token } = res.data.session;
                localStorage.setItem('access_token', access_token);
                localStorage.setItem('refresh_token', refresh_token);
                api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
                setUser(res.data.user.profile);
                return { success: true };
            }
        } catch (e) {
            const msg = e.response?.data?.error || 'Login failed';
            setError(msg);
            return { success: false, error: msg };
        }
    };

    const signup = async (email, password, name) => {
        setError(null);
        try {
            const res = await api.post('/auth/signup', { email, password, name });
            if (res.data.success) {
                return { success: true, message: res.data.message };
            }
        } catch (e) {
            const msg = e.response?.data?.error || 'Signup failed';
            setError(msg);
            return { success: false, error: msg };
        }
    };

    const logout = async () => {
        try {
            await api.post('/auth/logout');
        } catch (e) {
            console.error('Logout error:', e);
        } finally {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            delete api.defaults.headers.common['Authorization'];
            setUser(null);
        }
    };

    // Role-based access helpers
    const hasRole = (...roles) => {
        if (!user) return false;
        return roles.includes(user.role);
    };

    const hasMinRole = (minRole) => {
        if (!user) return false;
        return ROLE_HIERARCHY[user.role] >= ROLE_HIERARCHY[minRole];
    };

    const canViewInternalChannel = () => {
        return hasRole('superadmin', 'internal');
    };

    const canEditProject = () => {
        return hasRole('superadmin', 'internal');
    };

    const canAccessSettings = () => {
        return hasRole('superadmin');
    };

    const canManageUsers = () => {
        return hasRole('superadmin');
    };

    const value = {
        user,
        loading,
        error,
        isLoggedIn: !!user,
        login,
        signup,
        logout,
        hasRole,
        hasMinRole,
        canViewInternalChannel,
        canEditProject,
        canAccessSettings,
        canManageUsers
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export default AuthContext;
