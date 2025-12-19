import React from 'react';
import { Search, X } from 'lucide-react';

export default function FilterBar({
    searchTerm,
    onSearchChange,
    filters = [],
    onClearFilters,
    activeFiltersCount = 0
}) {
    return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-6">
            <div className="flex flex-col md:flex-row gap-3">
                {/* Search */}
                <div className="flex-1 relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-black dark:focus:ring-white outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                </div>

                {/* Additional Filters */}
                {filters.map((filter, idx) => (
                    <div key={idx}>{filter}</div>
                ))}

                {/* Clear Filters */}
                {activeFiltersCount > 0 && (
                    <button
                        onClick={onClearFilters}
                        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-semibold text-sm flex items-center gap-2 transition whitespace-nowrap"
                    >
                        <X size={14} />
                        Clear ({activeFiltersCount})
                    </button>
                )}
            </div>
        </div>
    );
}
