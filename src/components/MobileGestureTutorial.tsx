import React from 'react';

interface MobileGestureTutorialProps {
  open: boolean;
  onClose: () => void;
  onDontShowAgain: () => void;
}

const MobileGestureTutorial: React.FC<MobileGestureTutorialProps> = ({ open, onClose, onDontShowAgain }) => {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-[60] bg-black/55 backdrop-blur-[1px] px-4 py-6 flex items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-gray-100 p-4">
        <h3 className="text-base font-bold text-gray-800">モバイル操作ガイド</h3>
        <p className="mt-1 text-xs text-gray-500">この画面はタッチ操作に対応しています。</p>

        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-lg" aria-hidden="true">☝️</span>
              <p className="text-sm font-semibold text-gray-700">1本指でドラッグ</p>
            </div>
            <p className="mt-1 text-xs text-gray-500">マップを移動できます。</p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-lg" aria-hidden="true">🤏</span>
              <p className="text-sm font-semibold text-gray-700">2本指でピンチ</p>
            </div>
            <p className="mt-1 text-xs text-gray-500">拡大・縮小できます。</p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-lg" aria-hidden="true">👆</span>
              <p className="text-sm font-semibold text-gray-700">ノードをタップ</p>
            </div>
            <p className="mt-1 text-xs text-gray-500">詳細パネルが下から開きます。</p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium py-2"
          >
            閉じる
          </button>

          <button
            type="button"
            onClick={onDontShowAgain}
            className="flex-1 rounded-lg bg-gray-800 text-white text-sm font-medium py-2"
          >
            今後表示しない
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileGestureTutorial;
