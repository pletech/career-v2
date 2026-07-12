import React, { useEffect } from 'react';
import { ControlBarContent, type ControlBarProps } from './ControlBar';

interface MobileFilterDrawerProps extends ControlBarProps {
  open: boolean;
  onClose: () => void;
}

const MobileFilterDrawer: React.FC<MobileFilterDrawerProps> = ({
  open,
  onClose,
  searchQuery,
  onSearchChange,
  activeFilters,
  onFilterToggle,
}) => {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  return (
    <>
      <div
        className={`absolute inset-0 z-40 bg-black/30 transition-opacity duration-200 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <section
        className={`absolute inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-gray-200 bg-white p-4 transition-transform duration-300 ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300" />
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">検索 / フィルター</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100"
            aria-label="検索フィルターを閉じる"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <ControlBarContent
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          activeFilters={activeFilters}
          onFilterToggle={onFilterToggle}
          showLegend={false}
        />
      </section>
    </>
  );
};

export default MobileFilterDrawer;
