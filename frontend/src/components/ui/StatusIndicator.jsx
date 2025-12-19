import React from 'react';

/**
 * Status Indicator Component
 * Shows colored dots for project categories with consistent colors across the portal
 */

const STATUS_COLORS = {
    'Stuck / On Hold': {
        dot: 'bg-red-500',
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200'
    },
    'Ready': {
        dot: 'bg-green-500',
        bg: 'bg-green-50',
        text: 'text-green-700',
        border: 'border-green-200'
    },
    'Launched': {
        dot: 'bg-purple-500',
        bg: 'bg-purple-50',
        text: 'text-purple-700',
        border: 'border-purple-200'
    },
    'New / In Progress': {
        dot: 'bg-blue-500',
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200'
    },
    'Almost Ready': {
        dot: 'bg-yellow-500',
        bg: 'bg-yellow-50',
        text: 'text-yellow-700',
        border: 'border-yellow-200'
    }
};

export default function StatusIndicator({ status, showDot = true, showLabel = true, size = 'md' }) {
    const colors = STATUS_COLORS[status] || STATUS_COLORS['New / In Progress'];

    const sizeClasses = {
        sm: 'w-2 h-2',
        md: 'w-2.5 h-2.5',
        lg: 'w-3 h-3'
    };

    const dotSize = sizeClasses[size];

    return (
        <div className="flex items-center gap-2">
            {showDot && (
                <div className={`${dotSize} rounded-full ${colors.dot}`} />
            )}
            {showLabel && (
                <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border ${colors.bg} ${colors.text} ${colors.border}`}>
                    {status}
                </span>
            )}
        </div>
    );
}

// Export the colors map for use in other components
export { STATUS_COLORS };
