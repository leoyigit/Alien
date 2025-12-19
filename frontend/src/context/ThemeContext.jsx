import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function useTheme() {
    return useContext(ThemeContext);
}

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        // Force light mode on first load, clear any dark class
        document.documentElement.classList.remove('dark');
        const saved = localStorage.getItem('alien_theme');
        return saved || 'light';
    });

    useEffect(() => {
        localStorage.setItem('alien_theme', theme);
        // Apply theme to document - ALWAYS remove first to clear
        document.documentElement.classList.remove('dark');
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        }
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    const value = {
        theme,
        setTheme,
        toggleTheme,
        isDark: theme === 'dark'
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}
