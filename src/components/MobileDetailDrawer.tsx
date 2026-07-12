import React, { useEffect } from 'react';
import DetailPanel from './DetailPanel';
import type { CareerNode } from '../types/career';

interface MobileDetailDrawerProps {
  open: boolean;
  node: CareerNode | null;
  isLocked?: boolean;
  onClose: () => void;
  onNodeClick: (nodeId: string) => void;
  getNodeById: (nodeId: string) => CareerNode | undefined;
}

const MobileDetailDrawer: React.FC<MobileDetailDrawerProps> = ({
  open,
  node,
  isLocked = false,
  onClose,
  onNodeClick,
  getNodeById,
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
        className={`absolute inset-0 z-20 bg-black/30 transition-opacity duration-200 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <section
        className={`absolute inset-x-0 bottom-0 z-30 max-h-[70vh] rounded-t-2xl bg-white shadow-2xl border-t border-gray-200 transition-transform duration-300 ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="px-4 pt-2 pb-2 border-b border-gray-100">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-gray-300" />
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-700 truncate">
              {node?.titleJa ?? '詳細'}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              aria-label="詳細を閉じる"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="h-[calc(70vh-4rem)] overflow-y-auto">
          <DetailPanel node={node} isLocked={isLocked} onNodeClick={onNodeClick} getNodeById={getNodeById} />
        </div>
      </section>
    </>
  );
};

export default MobileDetailDrawer;
