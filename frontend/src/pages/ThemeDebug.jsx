import React from 'react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeDebug() {
    const { theme, toggleTheme } = useTheme();

    // Check if window exists to avoid SSR errors (just in case)
    const htmlClassList = typeof document !== 'undefined' ? document.documentElement.classList.toString() : '';
    const localStorageTheme = typeof localStorage !== 'undefined' ? localStorage.getItem('alien_theme') : 'N/A';

    return (
        <div className="min-h-screen p-8 space-y-8 bg-gray-50 dark:bg-gray-900 text-black dark:text-white transition-colors duration-300">
            <h1 className="text-3xl font-bold">Theme Debugger</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* State Info */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-bold mb-4">Current State</h2>
                    <ul className="space-y-2 font-mono text-sm">
                        <li className="flex justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
                            <span>Context Theme:</span>
                            <span className="font-bold">{theme}</span>
                        </li>
                        <li className="flex justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
                            <span>HTML Classes:</span>
                            <span className="bg-yellow-100 dark:bg-yellow-900/30 px-2 rounded">{htmlClassList || '(empty)'}</span>
                        </li>
                        <li className="flex justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
                            <span>LocalStorage:</span>
                            <span>{localStorageTheme}</span>
                        </li>
                        <li className="flex justify-between pt-2">
                            <span>System Prefers Dark:</span>
                            <span>{window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'Yes' : 'No'}</span>
                        </li>
                    </ul>

                    <div className="mt-6 flex gap-4">
                        <button
                            onClick={toggleTheme}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                            Toggle Theme
                        </button>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-black dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                        >
                            Reload Page
                        </button>
                    </div>
                </div>

                {/* Visual Test */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-bold mb-4">Visual Verification</h2>

                    <div className="space-y-4">
                        <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-700 text-center">
                            Surface: Muted
                        </div>
                        <div className="p-4 rounded-lg bg-white dark:bg-black border border-gray-200 dark:border-gray-600 text-center">
                            Surface: Card (White/Black)
                        </div>
                        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-center">
                            Accent: Blue
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-lg border border-yellow-200 dark:border-yellow-900/30">
                <h3 className="font-bold text-yellow-800 dark:text-yellow-200 mb-2">Diagnosis Tips</h3>
                <ul className="list-disc list-inside text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                    <li>If <strong>Context Theme</strong> says 'light' but <strong>HTML Classes</strong> has 'dark', external JS or Tailwind system fallback is intervening.</li>
                    <li>If nothing changes when clicking Toggle, the Context is broken.</li>
                    <li>If colors don't change but classes do, it's a CSS variable issue.</li>
                </ul>
            </div>
        </div>
    );
}
