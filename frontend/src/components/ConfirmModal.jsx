import React, { useEffect } from 'react';
import { X, AlertTriangle, Info, AlertCircle } from 'lucide-react';

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, variant = 'danger' }) {
    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };

        const handleEnter = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                onConfirm();
            }
        };

        document.addEventListener('keydown', handleEscape);
        document.addEventListener('keydown', handleEnter);

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.removeEventListener('keydown', handleEnter);
        };
    }, [isOpen, onClose, onConfirm]);

    if (!isOpen) return null;

    const variants = {
        danger: {
            icon: <AlertCircle className="text-red-500" size={24} />,
            iconBg: 'bg-red-100 dark:bg-red-900',
            confirmBtn: 'bg-red-600 hover:bg-red-700 text-white',
            border: 'border-red-200 dark:border-red-800'
        },
        warning: {
            icon: <AlertTriangle className="text-yellow-500" size={24} />,
            iconBg: 'bg-yellow-100 dark:bg-yellow-900',
            confirmBtn: 'bg-yellow-600 hover:bg-yellow-700 text-white',
            border: 'border-yellow-200 dark:border-yellow-800'
        },
        info: {
            icon: <Info className="text-blue-500" size={24} />,
            iconBg: 'bg-blue-100 dark:bg-blue-900',
            confirmBtn: 'bg-blue-600 hover:bg-blue-700 text-white',
            border: 'border-blue-200 dark:border-blue-800'
        }
    };

    const currentVariant = variants[variant];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
            <div
                className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full border-2 ${currentVariant.border} animate-scale-in`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start gap-4 p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className={`p-3 rounded-full ${currentVariant.iconBg}`}>
                        {currentVariant.icon}
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            {title}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Message */}
                <div className="p-6">
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                        {message}
                    </p>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 p-6 bg-gray-50 dark:bg-gray-900 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2 rounded-lg font-medium transition ${currentVariant.confirmBtn}`}
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
}
