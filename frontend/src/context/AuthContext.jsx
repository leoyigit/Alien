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

    // Function to set authorization header for API requests
    const setAuthHeader = (token) => {
        if (token) {
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        } else {
            delete api.defaults.headers.common['Authorization'];
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
            setAuthHeader(null);
            setUser(null);
        }
    };

    const refreshToken = async () => {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
            console.log('No refresh token found, cannot refresh.');
            return;
        }

        try {
            const res = await api.post('/auth/refresh-token', { refreshToken });
            if (res.data.success && res.data.session) {
                const { access_token } = res.data.session;
                localStorage.setItem('access_token', access_token);
                setAuthHeader(access_token);
                console.log('Access token refreshed successfully.');
                // Optionally, re-fetch user data to ensure it's up-to-date
                await fetchCurrentUser(access_token);
            } else {
                console.error('Failed to refresh token:', res.data.error);
                logout(); // Log out if refresh fails
            }
        } catch (err) {
            console.error('Token refresh failed:', err);
            if (err.response?.status === 401) {
                logout(); // Log out if refresh endpoint returns 401
            }
        }
    };

    const fetchCurrentUser = async (token) => {
        try {
            setAuthHeader(token);
            const res = await api.get('/auth/me');
            setUser(res.data.user);
        } catch (e) {
            console.error('Session expired or invalid during fetchCurrentUser:', e);
            logout(); // Log out if fetching current user fails
        } finally {
            setLoading(false);
        }
    };

    // Check for existing session on mount and set up refresh interval
    useEffect(() => {
        const initializeAuth = async () => {
            const token = localStorage.getItem('access_token');
            if (token) {
                await fetchCurrentUser(token);
            } else {
                setLoading(false);
            }
        };

        initializeAuth();

        // Set up token refresh interval (every 5 minutes)
        const refreshInterval = setInterval(() => {
            refreshToken();
        }, 5 * 60 * 1000); // 5 minutes

        return () => clearInterval(refreshInterval);
    }, []);

    const login = async (email, password) => {
        setError(null);
        try {
            const res = await api.post('/auth/login', { email, password });

            if (res.data.success) {
                const { access_token, refresh_token } = res.data.session;

                if (!res.data.user.profile) {
                    return {
                        success: false,
                        error: 'Account exists but has no profile. I attempted to self-heal it but it failed (likely missing SUPABASE_SERVICE_ROLE_KEY in .env). Please check backend logs or Sign Up with a NEW email.'
                    };
                }

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

    // Project access filtering based on RLS rules
    const canAccessProject = (project) => {
        if (!user || !project) return false;

        // Superadmin and internal team see everything
        if (user.role === 'superadmin' || user.role === 'internal') return true;
        if (user.email?.includes('@flyrank.com') || user.email?.includes('@powercommerce.com')) return true;

        // Shopline users see external channels and partnerships only
        if (user.email?.includes('@shopline.com')) {
            return project.channel_id_external !== null || project.is_partnership === true;
        }

        // Merchants see only assigned projects
        if (user.role === 'merchant') {
            return user.assigned_projects?.includes(project.id);
        }

        return false;
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
        canManageUsers,
        canAccessProject
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
