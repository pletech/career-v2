import React from 'react';
import { type PathType, PATH_TYPE_LABELS } from '../types/career';

export interface ControlBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeFilters: Set<PathType | 'all'>;
  onFilterToggle: (filter: PathType | 'all') => void;
  showFilters?: boolean;
}

const FILTER_OPTIONS: { key: PathType | 'all'; label: string }[] = [
  { key: 'all', label: 'すべて' },
  { key: 'specialist', label: PATH_TYPE_LABELS.specialist },
  { key: 'common', label: PATH_TYPE_LABELS.common },
];

export const ControlBarContent: React.FC<ControlBarProps & { showLegend?: boolean }> = ({
  searchQuery,
  onSearchChange,
  activeFilters,
  onFilterToggle,
  showLegend = true,
  showFilters = true,
}) => {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
      <div className="relative w-full md:w-auto md:flex-shrink-0">
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="ノード名 / スキル検索..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-8 pr-8 py-2 text-xs border border-gray-200 rounded-md md:w-56 md:py-1.5
                     focus:outline-none focus:ring-1 focus:ring-blue-300 focus:border-blue-300
                     placeholder:text-gray-300"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {showFilters && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-gray-400 mr-1">フィルター:</span>
          {FILTER_OPTIONS.map(({ key, label }) => {
            const isActive = activeFilters.has(key);
            return (
              <button
                key={key}
                onClick={() => onFilterToggle(key)}
                className={`
                  px-2.5 py-1 text-[11px] rounded-full border transition-all
                  ${isActive
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}
                `}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {showLegend && (
        <div className="md:ml-auto flex flex-wrap items-center gap-3 text-[10px] text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-sky-50 border border-blue-300 inline-block" />
            Specialist
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-gray-50 border border-gray-300 inline-block" />
            共通
          </span>
          <span className="flex items-center gap-1">
            <span className="text-[10px]">🔒</span>
            公開予定
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * Search box + filter chips bar.
 * Located below the header, above the main content area.
 */
const ControlBar: React.FC<ControlBarProps> = (props) => {
  return (
    <div className="px-5 py-2 bg-white border-b border-gray-100">
      <ControlBarContent {...props} />
    </div>
  );
};

export default ControlBar;
