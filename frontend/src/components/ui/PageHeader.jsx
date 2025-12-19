import React from 'react';

export default function PageHeader({ title, subtitle, actions, icon: Icon }) {
    return (
        <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4">
            <div>
                <div className="flex items-center gap-3 mb-1">
                    {Icon && <Icon size={32} className="text-gray-700 dark:text-gray-300" />}
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{title}</h1>
                </div>
                {subtitle && <p className="text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
            </div>
            {actions && (
                <div className="flex items-center gap-3">
                    {actions}
                </div>
            )}
        </div>
    );
}
