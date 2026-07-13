import React, { useEffect, useRef, useState } from 'react';
import TrackTabs from './components/TrackTabs';
import SubtrackTabs from './components/SubtrackTabs';
import SkillTreeGraph from './components/SkillTreeGraph';
import DetailPanel from './components/DetailPanel';
import MobileDetailDrawer from './components/MobileDetailDrawer';
import MobileFilterDrawer from './components/MobileFilterDrawer';
import MobileGestureTutorial from './components/MobileGestureTutorial';
import LoadingSkeleton from './components/LoadingSkeleton';
import { useCareerPathState } from './hooks/useCareerPathState';
import { TRACK_LABELS, type CareerDataSet } from './types/career';
import { loadCareerDataFromSheets } from './data/loadCareerDataFromSheets';
import LadderScreen from './features/ladder/LadderScreen';

/**
 * 階段ビュー (v2, 育成面談用) を既定とし、既存の全体マップは補助画面として残す。
 * roadmap = 業務ロードマップ (v2.6): 行=業務の成長ライン × 列=段階のマトリクス。
 */
type ViewMode = 'ladder' | 'roadmap' | 'map';

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('ladder');
  const [data, setData] = useState<CareerDataSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [showMobileTutorial, setShowMobileTutorial] = useState(false);
  const hasCheckedMobileTutorialRef = useRef(false);

  const TUTORIAL_KEY = 'career-mobile-tutorial-seen:v4';

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const ds = await loadCareerDataFromSheets();
      setData(ds);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load data from Google Sheets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const {
    activeTrack,
    activeSubtrack,
    availableSubtracks,
    selectedNodeId,
    selectedNode,
    searchQuery,
    activeFilters,
    filteredNodes,
    filteredEdges,
    connectedNodeIds,
    handleTrackChange,
    handleSubtrackChange,
    handleNodeClick,
    setSearchQuery,
    handleFilterToggle,
    getNodeById,
  } = useCareerPathState(data?.nodes ?? [], data?.edges ?? []);

  const isSelectedNodeLocked = (selectedNode?.stage ?? 0) >= 5;

  const handleGraphNodeClick = (nodeId: string) => {
    handleNodeClick(nodeId);
    setIsMobileDetailOpen(true);
  };

  useEffect(() => {
    if (!selectedNode) {
      setIsMobileDetailOpen(false);
    }
  }, [selectedNode]);

  // Decide whether to show the mobile tutorial AFTER data is loaded.
  // (If we check on mount, the UI might still be in loading skeleton state and the
  // tutorial can be missed or never rendered.)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (viewMode !== 'map') return; // ジェスチャーチュートリアルは全体マップのみ対象
    if (loading) return;
    if (hasCheckedMobileTutorialRef.current) return;
    hasCheckedMobileTutorialRef.current = true;

    const isMobileViewport = window.matchMedia('(max-width: 767px)').matches;
    if (!isMobileViewport) return;

    const params = new URLSearchParams(window.location.search);
    const forceTutorial = params.get('tutorial') === '1';

    if (forceTutorial) {
      setShowMobileTutorial(true);
      return;
    }

    const hasSeenTutorial = window.localStorage.getItem(TUTORIAL_KEY) === '1';
    setShowMobileTutorial(!hasSeenTutorial);
  }, [loading, viewMode]);

  const closeMobileTutorial = () => {
    setShowMobileTutorial(false);
  };

  const dontShowMobileTutorialAgain = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TUTORIAL_KEY, '1');
    }
    setShowMobileTutorial(false);
  };

  const inlineErrorBanner = loadError && data ? (
    <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 md:px-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">Google Sheetsの読み込みで問題が発生しました。</p>
          <p className="mt-1 whitespace-pre-line break-words text-[11px] leading-relaxed text-amber-800">
            {loadError}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          className="shrink-0 rounded-md border border-amber-200 bg-white px-2 py-1 text-[11px] text-amber-900 hover:bg-amber-100"
        >
          Retry
        </button>
      </div>
    </div>
  ) : null;

  const fullErrorState = loadError && !data && !loading ? (
    <div className="flex-1 bg-gray-50 px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-red-700 md:text-lg">
              Google Sheetsの読み込みに失敗しました
            </h2>
            <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-gray-700">
              {loadError}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-gray-500">
              シートの公開設定、列名、ノードID／エッジ参照、座標値を確認してください。
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            className="shrink-0 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="h-[100dvh] flex flex-col bg-gray-50 overflow-hidden">
      <header className="flex-shrink-0 bg-white border-b border-gray-200 px-3 py-1.5 md:px-5 md:py-3">
        <div className="flex flex-col gap-1 md:gap-3">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="min-w-0">
              <h1 className="text-base md:text-xl font-bold text-gray-800 tracking-tight truncate leading-tight">Career Path</h1>
              <p className="text-[9px] md:text-[11px] text-gray-400 truncate">
                {viewMode === 'ladder'
                  ? '階段型キャリアパス（育成面談用）'
                  : viewMode === 'roadmap'
                    ? '業務ロードマップ（業務×段階の成長マップ）'
                    : 'キャリアパスモデル（育成面談用）'}
              </p>
            </div>
            <div className="inline-flex shrink-0 items-center gap-2">
              <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === 'ladder'}
                  onClick={() => setViewMode('ladder')}
                  className={`rounded-md px-2.5 py-1 text-[11px] md:text-xs font-medium transition-colors ${
                    viewMode === 'ladder' ? 'bg-white text-cyan-700 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  階段ビュー
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === 'roadmap'}
                  onClick={() => setViewMode('roadmap')}
                  className={`rounded-md px-2.5 py-1 text-[11px] md:text-xs font-medium transition-colors ${
                    viewMode === 'roadmap' ? 'bg-white text-cyan-700 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  業務ロードマップ
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === 'map'}
                  onClick={() => setViewMode('map')}
                  className={`rounded-md px-2.5 py-1 text-[11px] md:text-xs font-medium transition-colors ${
                    viewMode === 'map' ? 'bg-white text-cyan-700 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  全体マップ
                </button>
              </div>
              {viewMode === 'map' && (
                <button
                  type="button"
                  onClick={() => setShowMobileTutorial(true)}
                  className="md:hidden inline-flex items-center justify-center rounded-md border border-gray-200 p-1.5 text-gray-600"
                  aria-label="操作ガイド"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.024 2.6-2.5 2.93-.92.206-1.5.98-1.5 1.93v.14" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 17h.01" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                  </svg>
                </button>
              )}
              {viewMode === 'map' && (
                <div className="hidden md:block text-xs text-gray-400 shrink-0">
                  現在の表示:{' '}
                  <span className="font-semibold text-gray-600">{TRACK_LABELS[activeTrack]}</span>
                  <span className="ml-1 text-gray-500">/ {activeSubtrack === 'all' ? '全分類' : activeSubtrack}</span>
                  {filteredNodes.length > 0 && (
                    <span className="ml-2 text-gray-300">({filteredNodes.length} ノード)</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {viewMode === 'map' && (
            <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:flex-row md:items-center md:gap-5 min-w-0">
              <div className="flex items-center gap-1.5 shrink-0 min-w-0">
                <span className="text-[10px] md:text-xs font-semibold text-gray-500 shrink-0">区分</span>
                <TrackTabs activeTrack={activeTrack} onTrackChange={handleTrackChange} />
              </div>
              <SubtrackTabs
                track={activeTrack}
                subtracks={availableSubtracks}
                activeSubtrack={activeSubtrack}
                onSubtrackChange={handleSubtrackChange}
                showLabel
              />
            </div>
          )}
        </div>
      </header>

      {viewMode === 'ladder' || viewMode === 'roadmap' ? (
        <LadderScreen mode={viewMode === 'roadmap' ? 'roadmap' : 'steps'} />
      ) : (
        <>
      {inlineErrorBanner}



      {loading ? (
        <div className="flex-1 overflow-hidden">
          <LoadingSkeleton />
        </div>
      ) : fullErrorState ? (
        fullErrorState
      ) : (
        <>
          <div className="hidden md:flex flex-1 overflow-hidden">
            <div className="flex-[2] min-w-0 border-r border-gray-200 bg-white">
              <SkillTreeGraph
                careerNodes={filteredNodes}
                careerEdges={filteredEdges}
                selectedNodeId={selectedNodeId}
                connectedNodeIds={connectedNodeIds}
                track={activeTrack}
                onNodeClick={handleGraphNodeClick}
                showMiniMap
                showControls
              />
            </div>

            <div className="flex-[1] min-w-[320px] max-w-[420px] bg-white border-l border-gray-100">
              <DetailPanel
                node={selectedNode}
                isLocked={isSelectedNodeLocked}
                onNodeClick={handleGraphNodeClick}
                getNodeById={getNodeById}
              />
            </div>
          </div>

          <div className="md:hidden flex-1 relative overflow-hidden">
            <div className="absolute inset-0 bg-white">
              <SkillTreeGraph
                careerNodes={filteredNodes}
                careerEdges={filteredEdges}
                selectedNodeId={selectedNodeId}
                connectedNodeIds={connectedNodeIds}
                track={activeTrack}
                onNodeClick={handleGraphNodeClick}
                showMiniMap={false}
                showControls={false}
              />
            </div>

            <MobileDetailDrawer
              open={isMobileDetailOpen}
              node={selectedNode}
              isLocked={isSelectedNodeLocked}
              onClose={() => setIsMobileDetailOpen(false)}
              onNodeClick={handleGraphNodeClick}
              getNodeById={getNodeById}
            />

            <MobileFilterDrawer
              open={isMobileFilterOpen}
              onClose={() => setIsMobileFilterOpen(false)}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              activeFilters={activeFilters}
              onFilterToggle={handleFilterToggle}
              showFilters={activeTrack !== 'it-support'}
            />

            <MobileGestureTutorial
              open={showMobileTutorial}
              onClose={closeMobileTutorial}
              onDontShowAgain={dontShowMobileTutorialAgain}
            />
          </div>
        </>
      )}
        </>
      )}
    </div>
  );
};

export default App;
