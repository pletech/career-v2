import React, { useEffect, useMemo, useRef, useState } from 'react';
import { buildLadder } from '../../domain/buildLadder';
import { evaluateStep, groupEvidencesByAbility } from '../../domain/evaluate';
import { loadLadderData, type LadderDataSet } from '../../data/loadLadderData';
import type { TrackId } from '../../domain/types';
import { DEFAULT_TARGET, useLadderState } from '../../state/useLadderState';
import InterviewPanel from '../interview/InterviewPanel';
import CraftView from '../roadmap/CraftView';
import MyPageView from '../roadmap/MyPageView';
import { scopeToRoute } from '../../domain/stageProgress';
import { TRACK_LABELS } from '../../types/career';
import TargetSelector from '../selector/TargetSelector';
import LadderView from './LadderView';

/**
 * 階段ビュー画面 (v2.4)
 *
 * - データはコードではなく CSV (ローカル or Google スプレッドシート公開 CSV) から
 *   ロードする (確定 #24)。値のハードコードは持たない。
 * - デスクトップ: 左 = 目標選択 / 中央 = 階段ビュー / 右 = 面談用パネル の3カラム
 * - モバイル: 縦スクロール + 目標選択ドロワー + ボトムシート (確定 #11)
 */

interface LadderScreenProps {
  /**
   * steps = 階段ビュー (既定) / roadmap = 業務ロードマップ (v2.6)。
   * データロード・チェック状態・言語を両ビューで共有するため、同じ画面が両モードを描画する。
   * ロードマップの能力タップはビューを遷移せず、その場でチェックリストを開く (v2.6i)。
   */
  mode?: 'steps' | 'roadmap' | 'mypage';
  /** マイページの「→」から業務ロードマップへ切り替えてもらう */
  onNavigate?: (mode: 'roadmap') => void;
}

const LadderScreen: React.FC<LadderScreenProps> = ({ mode = 'steps', onNavigate }) => {
  /**
   * マイページ → 業務ロードマップ の受け渡し。
   * この画面は両モードで**同じインスタンスのまま**描き分けているので、
   * タブを切り替えても state が残る (App 側で別コンポーネントにすると消える)。
   */
  const [focusRequest, setFocusRequest] = React.useState<
    { stage: number; categoryId: string } | null
  >(null);
  const {
    targetRoleId,
    setTargetRoleId,
    evidenceChecks,
    toggleEvidence,
    managerConfirms,
    toggleManagerConfirm,
    actionChecks,
    actionSoloChecks,
    toggleAction,
    selectedAbilityId,
    setSelectedAbilityId,
    exportJson,
    importJson,
  } = useLadderState();

  const [data, setData] = useState<LadderDataSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setData(await loadLadderData());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'データの読み込みに失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const [isSelectorDrawerOpen, setIsSelectorDrawerOpen] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const evidencesByAbility = useMemo(
    () => groupEvidencesByAbility(data?.evidences ?? []),
    [data],
  );

  // URL の ?target= が実在しない場合は既定へフォールバック
  const effectiveTargetId = useMemo(() => {
    if (!data) return targetRoleId;
    return data.roles.some((r) => r.roleId === targetRoleId) ? targetRoleId : DEFAULT_TARGET;
  }, [data, targetRoleId]);

  const ladder = useMemo(
    () =>
      data
        ? buildLadder(effectiveTargetId, data.roles, data.dependencies, data.abilities)
        : null,
    [data, effectiveTargetId],
  );

  const targetRole = ladder?.targetRole ?? null;

  // -------------------------------------------------------------------------
  // 業務ロードマップの対象範囲 (ルート = 区分 × 分類)
  //
  // 以前はロードマップの範囲を旧「階段ビュー」の目標役割 (targetRole) から導いていた。
  // ロードマップ側には目標役割を変える UI が無いため、**見えない画面の状態に
  // ぶら下がっている**状態で、実質サーバー固定だった。旧ビューを触ると
  // ロードマップの範囲が動くという絡まりでもある。
  // → ロードマップは自分のルート選択を持つ。旧ビューとは独立させる。
  //
  // 選択肢は**データから導く** (UI にハードコードしない)。役割が存在するルートが
  // 選択肢になり、`categories` に段階が無いルートは CraftView 側で「準備中」を出す。
  // -------------------------------------------------------------------------
  const roadmapRoutes = useMemo(() => {
    if (!data) return [];
    const seen = new Map<string, { key: string; track: TrackId; subtrack: string }>();
    data.roles
      .filter((r) => r.status !== 'hidden')
      .forEach((r) => {
        // ⚠️ キーは今 **2軸**。`pathType` を含めていないため、同じサブトラックに
        // スペシャリストとマネジメントが並ぶと1ルートに潰れる (HANDOFF §4b)。
        // 現状は roles.csv 6行が全て サーバー・specialist なので衝突していないだけ。
        const key = `${r.track}/${r.category}`;
        if (!seen.has(key)) seen.set(key, { key, track: r.track, subtrack: r.category });
      });
    return [...seen.values()];
  }, [data]);

  const [roadmapRouteKey, setRoadmapRouteKey] = useState<string | null>(null);
  const activeRoute =
    roadmapRoutes.find((r) => r.key === roadmapRouteKey) ?? roadmapRoutes[0] ?? null;

  // 目標より上の段階 (準備中プレビュー)
  const higherRoles = useMemo(() => {
    if (!data || !targetRole) return [];
    return data.roles.filter(
      (r) => r.category === targetRole.category && r.stageOrder > targetRole.stageOrder,
    );
  }, [data, targetRole]);

  // いま確認すべき段 = 最下位のゲート未通過段 (全通過なら目標の段)
  const focusStep = useMemo(() => {
    if (!ladder) return null;
    const actionable = ladder.steps.filter((s) => !s.isPlaceholder);
    if (actionable.length === 0) return null;
    return (
      actionable.find(
        (s) =>
          !evaluateStep(s.abilities, evidencesByAbility, evidenceChecks, managerConfirms)
            .gatePassed,
      ) ?? actionable[actionable.length - 1]
    );
  }, [ladder, evidencesByAbility, evidenceChecks, managerConfirms]);

  const selectedAbility = useMemo(
    () => data?.abilities.find((a) => a.abilityId === selectedAbilityId) ?? null,
    [data, selectedAbilityId],
  );

  const selectedEvidences = useMemo(
    () => (selectedAbility ? (evidencesByAbility.get(selectedAbility.abilityId) ?? []) : []),
    [selectedAbility, evidencesByAbility],
  );

  const handleImportFile = async (file: File | null) => {
    if (!file) return;
    const result = await importJson(file);
    setImportMessage(result.message);
    window.setTimeout(() => setImportMessage(null), 5000);
  };

  const dataControls = (
    <div className="flex flex-col gap-1.5 px-4 pb-4">
      <p className="text-[11px] font-semibold text-gray-500">
        {'チェック状態の保存'}
      </p>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={exportJson}
          className="flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[11px] text-gray-600 hover:bg-gray-50"
        >
          JSONエクスポート
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[11px] text-gray-600 hover:bg-gray-50"
        >
          JSONインポート
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          void handleImportFile(e.target.files?.[0] ?? null);
          e.target.value = '';
        }}
      />
      {importMessage && (
        <p className="rounded bg-cyan-50 px-2 py-1 text-[10px] text-cyan-800">{importMessage}</p>
      )}
      <p className="text-[10px] leading-relaxed text-gray-400">
        {'チェック状態はこの端末のブラウザにのみ保存されます。面談後はJSONエクスポートでの保存をおすすめします。'}
      </p>
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
        {'データを読み込んでいます…'}
      </div>
    );
  }

  if (loadError || !data || !ladder) {
    return (
      <div className="flex flex-1 items-start justify-center bg-gray-50 px-4 py-8">
        <div className="w-full max-w-2xl rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-red-700">
            階段データ（CSV）の読み込みに失敗しました
          </h2>
          <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-gray-700">
            {loadError ?? 'データが見つかりませんでした。'}
          </p>
          <p className="mt-3 text-xs leading-relaxed text-gray-500">
            public/data/ の CSV（またはスプレッドシートの公開設定・列名・ID参照）を確認してください。
          </p>
          <button
            type="button"
            onClick={() => void loadData()}
            className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const ladderView = (
    <LadderView
      key={effectiveTargetId}
      ladder={ladder}
      higherRoles={higherRoles}
      evidencesByAbility={evidencesByAbility}
      evidenceChecks={evidenceChecks}
      managerConfirms={managerConfirms}
      selectedAbilityId={selectedAbilityId}
      onSelectAbility={(id) => setSelectedAbilityId(id)}
    />
  );

  const interviewPanel = (
    <InterviewPanel
      selectedAbility={selectedAbility}
      selectedEvidences={selectedEvidences}
      focusStep={focusStep}
      evidencesByAbility={evidencesByAbility}
      evidenceChecks={evidenceChecks}
      managerConfirms={managerConfirms}
      onToggleEvidence={toggleEvidence}
      onToggleManagerConfirm={toggleManagerConfirm}
      onSelectAbility={setSelectedAbilityId}
    />
  );

  const selector = (
    <TargetSelector
      roles={data.roles}
      targetRoleId={effectiveTargetId}
      onTargetChange={setTargetRoleId}
    />
  );

  // ===================== 業務ロードマップ (v2.7 — 素材→武器モデル) =====================
  // セル = タグ (区分)。タップでビューは遷移せず、その場で素材チェックリストが開く
  // (ドロワーは CraftView が自前で持つ)
  if (mode === 'roadmap' || mode === 'mypage') {
    /**
     * **ルート (職種 × 分類) で絞ってから渡す** (v2.16 / HANDOFF §4b)。
     * 絞り方は `scopeToRoute` が持つ — ここに書くと、消しても何も落ちない。
     */
    const {
      categories: routeCategories,
      actions: routeActions,
      certs: routeCerts,
    } = scopeToRoute(activeRoute, data);

    // ルート内の役割だけを渡す。旧ビューの targetRole は参照しない
    const routeRoles = activeRoute
      ? data.roles.filter(
          (r) => r.track === activeRoute.track && r.category === activeRoute.subtrack,
        )
      : [];
    if (mode === 'mypage') {
      return (
        <div className="relative flex flex-1 overflow-hidden bg-gray-50">
          <MyPageView
            routeLabel={
              activeRoute
                ? `${TRACK_LABELS[activeRoute.track] ?? activeRoute.track} / ${activeRoute.subtrack}`
                : ''
            }
            roles={routeRoles}
            categories={routeCategories}
            actions={routeActions}
            certs={routeCerts}
            actionChecks={actionChecks}
            actionSoloChecks={actionSoloChecks}
            onJump={(stage, categoryId) => {
              setFocusRequest({ stage, categoryId });
              onNavigate?.('roadmap');
            }}
          />
        </div>
      );
    }

    return (
      <div className="relative flex flex-1 overflow-hidden bg-gray-50">
        <CraftView
          routes={roadmapRoutes}
          activeRouteKey={activeRoute?.key ?? null}
          onRouteChange={setRoadmapRouteKey}
          roles={routeRoles}
          categories={routeCategories}
          actions={routeActions}
          certs={routeCerts}
          actionChecks={actionChecks}
          actionSoloChecks={actionSoloChecks}
          onToggleAction={toggleAction}
          onExport={exportJson}
          onImport={importJson}
          focusRequest={focusRequest}
          onFocusHandled={() => setFocusRequest(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* ===================== デスクトップ: 3カラム ===================== */}
      <div className="hidden flex-1 overflow-hidden md:flex">
        <aside className="flex w-60 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-white">
          {selector}
          <div className="mt-auto">{dataControls}</div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto bg-gray-50">{ladderView}</main>

        <aside className="w-[340px] shrink-0 overflow-hidden border-l border-gray-200 bg-white lg:w-[380px]">
          {interviewPanel}
        </aside>
      </div>

      {/* ===================== モバイル: 縦スクロール + ドロワー + ボトムシート ===================== */}
      <div className="relative flex flex-1 flex-col overflow-hidden md:hidden">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-2">
          <p className="min-w-0 truncate text-xs text-gray-600">
            <span className="text-gray-400">
              {'インフラ > サーバー > '}
            </span>
            <span className="font-semibold text-gray-800">
              {targetRole ? targetRole.shortLabel : ''}
            </span>
          </p>
          <button
            type="button"
            onClick={() => setIsSelectorDrawerOpen(true)}
            className="shrink-0 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1.5 text-[11px] font-medium text-cyan-700"
          >
            {'目標を選ぶ'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {ladderView}
          <div className="border-t border-gray-100 bg-white pt-3">{dataControls}</div>
        </div>

        {/* 目標選択ドロワー */}
        {isSelectorDrawerOpen && (
          <div className="absolute inset-0 z-40">
            <button
              type="button"
              aria-label="閉じる"
              className="absolute inset-0 bg-black/30"
              onClick={() => setIsSelectorDrawerOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 flex w-[82%] max-w-[320px] flex-col overflow-y-auto bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <p className="text-sm font-bold text-gray-800">
                  {'目標を選ぶ'}
                </p>
                <button
                  type="button"
                  onClick={() => setIsSelectorDrawerOpen(false)}
                  className="rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-500"
                >
                  {'閉じる'}
                </button>
              </div>
              <TargetSelector
                roles={data.roles}
                targetRoleId={effectiveTargetId}
                onTargetChange={(roleId) => {
                  setTargetRoleId(roleId);
                  setIsSelectorDrawerOpen(false);
                }}
              />
            </div>
          </div>
        )}

        {/* 能力詳細 (根拠チェックリスト) ボトムシート */}
        {selectedAbility && (
          <div className="absolute inset-0 z-40">
            <button
              type="button"
              aria-label="閉じる"
              className="absolute inset-0 bg-black/30"
              onClick={() => setSelectedAbilityId(null)}
            />
            <div className="absolute inset-x-0 bottom-0 flex max-h-[82dvh] flex-col rounded-t-2xl bg-white shadow-2xl">
              <div className="flex justify-center pt-2">
                <span className="h-1 w-10 rounded-full bg-gray-200" />
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">{interviewPanel}</div>
              <button
                type="button"
                onClick={() => setSelectedAbilityId(null)}
                className="border-t border-gray-100 py-2.5 text-center text-xs font-medium text-gray-500"
              >
                {'閉じる'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LadderScreen;
