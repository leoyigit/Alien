import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle } from 'lucide-react';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
    const [toast, setToast] = useState(null);

    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
        // Auto hide after 3 seconds
        setTimeout(() => {
            setToast(null);
        }, 3000);
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}

            {/* THE NOTIFICATION UI */}
            {toast && (
                <div className={`fixed top-5 right-5 z-[9999] flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl transform transition-all animate-in slide-in-from-top-5 duration-300 border border-gray-200 dark:border-gray-700 ${toast.type === 'error' ? 'bg-red-50 dark:bg-red-900/90 text-red-900 dark:text-red-100' : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
                    }`}>
                    {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
                    <div>
                        <p className="font-bold text-sm">{toast.type === 'error' ? 'Error' : 'Success'}</p>
                        <p className="text-sm opacity-90">{toast.message}</p>
                    </div>
                    <button onClick={() => setToast(null)} className="ml-4 opacity-50 hover:opacity-100">
                        <X size={18} />
                    </button>
                </div>
            )}
        </ToastContext.Provider>
    );
};