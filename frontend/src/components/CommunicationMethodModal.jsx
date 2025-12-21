// frontend/src/components/CommunicationMethodModal.jsx
import React, { useState } from 'react';
import { X } from 'lucide-react';

export default function CommunicationMethodModal({ isOpen, onClose, onConfirm }) {
    const [selectedMethods, setSelectedMethods] = useState([]);

    if (!isOpen) return null;

    const toggleMethod = (method) => {
        const methodKey = method.toLowerCase().replace(' ', '_');
        if (selectedMethods.includes(methodKey)) {
            setSelectedMethods(selectedMethods.filter(m => m !== methodKey));
        } else {
            setSelectedMethods([...selectedMethods, methodKey]);
        }
    };

    const handleConfirm = () => {
        onConfirm(selectedMethods);
        setSelectedMethods([]);
    };

    const handleCancel = () => {
        setSelectedMethods([]);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        How did you communicate?
                    </h3>
                    <button
                        onClick={handleCancel}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    >
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Select the communication method(s) you used for this contact.
                </p>

                {/* Method Selection */}
                <div className="flex flex-wrap gap-2 mb-6">
                    {['Slack', 'Email', 'Google Meet', 'Huddle'].map(method => {
                        const methodKey = method.toLowerCase().replace(' ', '_');
                        const isSelected = selectedMethods.includes(methodKey);
                        return (
                            <button
                                key={method}
                                onClick={() => toggleMethod(method)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${isSelected
                                        ? 'bg-blue-500 text-white shadow-md'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                            >
                                {method}
                            </button>
                        );
                    })}
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={handleCancel}
                        className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={selectedMethods.length === 0}
                        className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
}
