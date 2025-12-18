import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { useToast } from './ToastContext.jsx';

const ProjectsContext = createContext();

export const useProjects = () => useContext(ProjectsContext);

export const ProjectsProvider = ({ children }) => {
    const [projects, setProjects] = useState(() => {
        const saved = localStorage.getItem('projects_cache');
        return saved ? JSON.parse(saved) : [];
    });

    const [loading, setLoading] = useState(() => !localStorage.getItem('projects_cache'));
    const lastFetchRef = useRef(0);
    const isFetchingRef = useRef(false);
    const { showToast } = useToast();

    const fetchProjects = useCallback(async (force = false) => {
        // Prevent multiple simultaneous fetches
        if (isFetchingRef.current) return;

        const now = Date.now();
        const hasCachedData = localStorage.getItem('projects_cache');

        // Skip if recently fetched (within 5 minutes) unless forced
        if (!force && hasCachedData && (now - lastFetchRef.current < 300000)) return;

        isFetchingRef.current = true;
        if (!hasCachedData) setLoading(true);

        try {
            const res = await api.get('/projects');
            setProjects(res.data);
            localStorage.setItem('projects_cache', JSON.stringify(res.data));
            lastFetchRef.current = now;
        } catch (err) {
            console.error(err);
            if (!hasCachedData) showToast("Failed to connect to server", "error");
        } finally {
            setLoading(false);
            isFetchingRef.current = false;
        }
    }, [showToast]);

    // Fetch once on mount
    useEffect(() => {
        fetchProjects();
    }, []); // Empty deps - only run once

    const updateLocalProject = (id, newData) => {
        setProjects(prev => {
            const updated = prev.map(p => p.id === id ? { ...p, ...newData } : p);
            localStorage.setItem('projects_cache', JSON.stringify(updated));
            return updated;
        });
    };

    return (
        <ProjectsContext.Provider value={{ projects, loading, fetchProjects, updateLocalProject }}>
            {children}
        </ProjectsContext.Provider>
    );
};