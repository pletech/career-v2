import React, { useMemo, useState } from 'react';
import { STRINGS, loc, type Lang } from '../../domain/i18n';
import type { Atom, AtomCheckMap, Category, Role } from '../../domain/types';

/**
 * 業務ロードマップ v2.7d — 段階別カテゴリ + 包含モデル (アサリさん面談 2026-07-14)
 *
 * - 段階を開くと、その段階「固有」のカテゴリ群が出る (段階ごとに別集合)。
 * - 上位段階のカテゴリは、下位段階のカテゴリを丸ごと包含 (includes) し、
 *   さらにその段階固有の原子 (できると言える項目) を持つ。
 * - 包含された下位カテゴリは 1行に畳んで (ロールアップ) 表示し、
 *   「何個中何個」を示す。達成率が閾値 (70%) 以上なら「クリア」、未満なら不足が一目で分かる。
 * - チェックの単位は原子。カテゴリの達成率 = (達成した下位カテゴリ数 + チェック済み原子数) / 総項目数。
 * - 一度に開く段階は1つ (アコーディオン)。既定は最下段 (STEP1)。
 */

const CLEAR = 0.7; // クリア閾値 (7割)

interface CraftViewProps {
  roles: Role[];
  categories: Category[];
  atoms: Atom[];
  atomChecks: AtomCheckMap;
  onToggleAtom: (atomId: string) => void;
  lang: Lang;
}

interface CatStat {
  done: number;
  total: number;
  ratio: number;
  cleared: boolean;
  /** 達成率は基準を満たしているが、包含した下位カテゴリが未クリアで待たされている状態 */
  blockedByChild: boolean;
}

const CraftView: React.FC<CraftViewProps> = ({
  roles,
  categories,
  atoms,
  atomChecks,
  onToggleAtom,
  lang,
}) => {
  const s = STRINGS[lang];
  const ko = lang === 'ko';

  /** ロールアップ (包含カテゴリ) のその場展開状態。キーは "親>子" (同じ子が複数の親に出るため) */
  const [expandedRollups, setExpandedRollups] = useState<Set<string>>(() => new Set());
  const toggleRollup = (key: string) =>
    setExpandedRollups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  /** 2回目以降の面談用: チェック済みを隠して残りだけ見る (アサリさん FB) */
  const [onlyUnchecked, setOnlyUnchecked] = useState(false);

  const catById = useMemo(() => {
    const m = new Map<string, Category>();
    for (const c of categories) m.set(c.categoryId, c);
    return m;
  }, [categories]);

  const atomsByCat = useMemo(() => {
    const m = new Map<string, Atom[]>();
    for (const a of atoms) {
      const list = m.get(a.categoryId);
      if (list) list.push(a);
      else m.set(a.categoryId, [a]);
    }
    for (const list of m.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);
    return m;
  }, [atoms]);

  const directAtoms = (catId: string): Atom[] => atomsByCat.get(catId) ?? [];

  /**
   * カテゴリ達成統計 (再帰: 包含した下位カテゴリは「達成なら1」として数える)。
   *
   * 「クリア」は達成率 (CLEAR) 以上であることに加え、包含した下位カテゴリが
   * 全て個別にクリア済みであることを必須とする。下位が未クリアのまま、
   * この段階固有の新規項目だけを埋めて比率上クリアに達してしまうのを防ぐ
   * (アサリさん概念: 「この業務ができて初めて上の業務に進める」 — 下位を飛ばして
   * 上位だけクリアと表示することはない、2026-07-15 指摘)。
   */
  const stat = (catId: string): CatStat => {
    const cat = catById.get(catId);
    if (!cat) return { done: 0, total: 0, ratio: 0, cleared: false, blockedByChild: false };
    const own = directAtoms(catId);
    const ownDone = own.filter((a) => atomChecks[a.atomId] === true).length;
    const childStats = cat.includes.map((id) => stat(id));
    const childDone = childStats.filter((s) => s.cleared).length;
    const allChildrenCleared = childStats.every((s) => s.cleared);
    const total = own.length + cat.includes.length;
    const done = ownDone + childDone;
    const ratio = total === 0 ? 0 : done / total;
    const ratioMet = total > 0 && ratio >= CLEAR;
    return {
      done,
      total,
      ratio,
      cleared: ratioMet && allChildrenCleared,
      blockedByChild: ratioMet && !allChildrenCleared,
    };
  };

  const stagesDesc = useMemo(
    () => [...new Set(categories.map((c) => c.stage))].sort((a, b) => b - a),
    [categories],
  );
  /** 最下段 (基礎)。この段より上のカテゴリの固有原子は「この段階で追加」= NEW 扱い */
  const minStage = useMemo(
    () => (categories.length > 0 ? Math.min(...categories.map((c) => c.stage)) : 1),
    [categories],
  );

  const [openStage, setOpenStage] = useState<number | null>(
    () => (categories.length > 0 ? Math.min(...categories.map((c) => c.stage)) : 1),
  );

  const catsOfStage = (stage: number): Category[] =>
    categories.filter((c) => c.stage === stage).sort((a, b) => a.sortOrder - b.sortOrder);

  const roleOfStage = (stage: number): Role | undefined =>
    roles.find((r) => r.stageOrder === stage && r.status !== 'hidden');

  const toggle = (stage: number) => setOpenStage((cur) => (cur === stage ? null : stage));

  // ---------------------------------------------------------------------
  // 達成バッジ
  // ---------------------------------------------------------------------
  const statusBadge = (st: CatStat, size: 'sm' | 'md' = 'md') => {
    const need = Math.max(0, Math.ceil(st.total * CLEAR) - st.done);
    const pad = size === 'md' ? 'px-2 py-0.5 text-[11px]' : 'px-1.5 py-0.5 text-[10px]';
    return (
      <span className="flex items-center gap-1">
        <span className={`rounded font-bold ${pad} ${st.cleared ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>
          {st.done}/{st.total}
        </span>
        {st.cleared ? (
          <span className={`rounded bg-emerald-500 font-bold text-white shadow-sm ${pad}`}>
            {ko ? '✓ 클리어' : '✓ クリア'}
          </span>
        ) : st.blockedByChild ? (
          <span className={`rounded bg-amber-100 font-bold text-amber-700 ${pad}`}>
            {ko ? '하위 카테고리 미클리어' : '下位カテゴリ未クリア'}
          </span>
        ) : (
          <span className={`rounded bg-amber-100 font-bold text-amber-700 ${pad}`}>
            {ko ? `클리어까지 앞으로 ${need}` : `クリアまであと${need}`}
          </span>
        )}
      </span>
    );
  };

  // ---------------------------------------------------------------------
  // 原子1行 (チェックボックス)。「未チェックのみ」フィルタ対応
  // ---------------------------------------------------------------------
  const atomRow = (a: Atom, opts: { isNew?: boolean } = {}) => {
    const checked = atomChecks[a.atomId] === true;
    if (onlyUnchecked && checked) return null;
    return (
      <label
        key={a.atomId}
        className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2 py-1.5 transition-colors ${
          opts.isNew
            ? 'border-amber-200 bg-amber-50/60 hover:border-amber-300'
            : 'border-gray-100 bg-white hover:border-cyan-200'
        }`}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggleAtom(a.atomId)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-cyan-600"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[11.5px] leading-snug text-gray-800">
            {loc(lang, a.statement, a.statementKo)}
          </span>
          {opts.isNew && (
            <span className="mt-0.5 inline-block rounded bg-amber-100 px-1 py-px text-[9px] font-bold text-amber-700">
              NEW
            </span>
          )}
        </span>
      </label>
    );
  };

  // ---------------------------------------------------------------------
  // 包含カテゴリのロールアップ 1行 — 押すとその場で展開 (再帰)。段階の移動はしない
  // ---------------------------------------------------------------------
  const childRollup = (childId: string, parentKey: string): React.ReactNode => {
    const child = catById.get(childId);
    if (!child) return null;
    const cst = stat(childId);
    const key = `${parentKey}>${childId}`;
    const expanded = expandedRollups.has(key);
    return (
      <div key={key} className="flex flex-col">
        <button
          type="button"
          onClick={() => toggleRollup(key)}
          className={`flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-left ${
            cst.cleared ? 'border-emerald-300 bg-emerald-50' : 'border-amber-100 bg-amber-50/40'
          } hover:brightness-95`}
        >
          <span className="flex min-w-0 items-center gap-1">
            <span className="w-3 shrink-0 text-[10px] text-gray-500" aria-hidden>
              {expanded ? '▾' : '▸'}
            </span>
            <span className="rounded bg-white/80 px-1 py-px text-[9px] font-bold text-gray-400">
              STEP {child.stage}
            </span>
            <span
              className={`truncate text-[11.5px] font-semibold ${
                cst.cleared ? 'text-emerald-800' : 'text-gray-700'
              }`}
            >
              {cst.cleared && <span aria-hidden>✓ </span>}
              {loc(lang, child.labelJa, child.labelKo)}
            </span>
          </span>
          {statusBadge(cst, 'sm')}
        </button>
        {expanded && (
          <div className="ml-2.5 mt-1 flex flex-col gap-1 border-l-2 border-gray-100 pl-2">
            {child.includes.map((id) => childRollup(id, key))}
            {directAtoms(childId).map((a) => atomRow(a))}
          </div>
        )}
      </div>
    );
  };

  // ---------------------------------------------------------------------
  // カテゴリカード (開いた段階)
  // ---------------------------------------------------------------------
  const categoryCard = (cat: Category) => {
    const st = stat(cat.categoryId);
    const own = directAtoms(cat.categoryId);
    const ownIsNew = cat.stage > minStage; // 上位段階の固有原子 = この段階で追加 (差分)
    return (
      <div
        key={cat.categoryId}
        className={`flex flex-col overflow-hidden rounded-xl border-2 ${
          st.cleared ? 'border-emerald-400' : 'border-gray-200'
        } bg-white`}
      >
        {/* クリアしたカテゴリはヘッダーを反転して一目で分かるように */}
        <div
          className={`flex items-start justify-between gap-2 px-3 py-2 ${
            st.cleared ? 'bg-emerald-500' : 'bg-gray-50'
          }`}
        >
          <span
            className={`text-[12.5px] font-bold leading-snug ${
              st.cleared ? 'text-white' : 'text-gray-800'
            }`}
          >
            {st.cleared && <span aria-hidden>✓ </span>}
            {loc(lang, cat.labelJa, cat.labelKo)}
          </span>
          {st.cleared ? (
            <span className="rounded bg-white/95 px-2 py-0.5 text-[11px] font-bold text-emerald-600 shadow-sm">
              {st.done}/{st.total} {ko ? '클리어' : 'クリア'}
            </span>
          ) : (
            statusBadge(st)
          )}
        </div>

        {/* 達成率バー (70% にクリア基準線) */}
        <div className="relative h-1.5 w-full bg-gray-100" aria-hidden>
          <div
            className={`h-full transition-all ${st.cleared ? 'bg-emerald-500' : 'bg-cyan-400'}`}
            style={{ width: `${Math.min(100, Math.round(st.ratio * 100))}%` }}
          />
          <span className="absolute top-0 h-full w-px bg-gray-400/80" style={{ left: '70%' }} />
        </div>

        <div className={`flex flex-col gap-1 p-2 ${st.cleared ? 'bg-emerald-50/40' : ''}`}>
          {/* 包含した下位カテゴリ = 1行ロールアップ (その場で展開) */}
          {cat.includes.length > 0 && (
            <p className="px-0.5 text-[9.5px] font-semibold text-gray-400">
              {ko ? '아래 단계에서 인계' : '下の段階から引き継ぎ'}
            </p>
          )}
          {cat.includes.map((id) => childRollup(id, cat.categoryId))}

          {/* その段階固有の原子 (チェック対象)。上位段階では NEW として強調 */}
          {own.length > 0 && ownIsNew && (
            <p className="mt-1 px-0.5 text-[9.5px] font-semibold text-amber-700">
              {ko ? `이 단계에서 추가 (${own.length})` : `この段階で追加（${own.length}）`}
            </p>
          )}
          {own.map((a) => atomRow(a, { isNew: ownIsNew }))}
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------
  // カテゴリチップ (閉じた段階)
  // ---------------------------------------------------------------------
  const categoryChip = (cat: Category) => {
    const st = stat(cat.categoryId);
    return (
      <button
        key={cat.categoryId}
        type="button"
        onClick={() => setOpenStage(cat.stage)}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 transition-colors ${
          st.cleared
            ? 'border-emerald-500 bg-emerald-500 hover:brightness-95'
            : 'border-gray-200 bg-white hover:border-cyan-300 hover:bg-cyan-50/40'
        }`}
      >
        <span
          className={`text-[11px] font-semibold ${st.cleared ? 'text-white' : 'text-gray-700'}`}
        >
          {st.cleared && <span aria-hidden>✓ </span>}
          {loc(lang, cat.labelJa, cat.labelKo)}
        </span>
        <span
          className={`rounded px-1 py-0.5 text-[10px] font-bold ${
            st.cleared ? 'bg-white/95 text-emerald-600' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {st.done}/{st.total}
        </span>
      </button>
    );
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex shrink-0 flex-col gap-1.5 px-3 pt-3 md:flex-row md:items-start md:justify-between md:gap-4 md:px-5 md:pt-4">
        <p className="text-[11px] leading-relaxed text-gray-500">{s.roadmapLegend}</p>
        {/* 2回目以降の面談: 残っているものだけを見る (アサリさん FB) */}
        <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-1.5">
          <input
            type="checkbox"
            checked={onlyUnchecked}
            onChange={(e) => setOnlyUnchecked(e.target.checked)}
            className="h-3.5 w-3.5 accent-cyan-600"
          />
          <span className="text-[10.5px] font-medium text-gray-600">
            {ko ? '미체크만 표시' : '未チェックのみ表示'}
          </span>
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-3 md:px-5">
        <div className="mb-3 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2 text-[10px] text-gray-400">
          {ko
            ? 'STEP 3~6 카테고리는 순차 확장 예정 (현재는 STEP1 전수 + STEP2 운용감시 전 카테고리 반영)'
            : 'STEP 3〜6 のカテゴリは順次拡張予定（現在は STEP1 の網羅と STEP2 運用監視の全カテゴリを反映）'}
        </div>

        <div className="flex flex-col gap-3">
          {stagesDesc.map((stage) => {
            const open = openStage === stage;
            const role = roleOfStage(stage);
            const cats = catsOfStage(stage);
            return (
              <section key={stage} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <button
                  type="button"
                  onClick={() => toggle(stage)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left ${
                    open ? 'bg-cyan-50' : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="rounded bg-cyan-100 px-1.5 py-0.5 text-[10px] font-bold text-cyan-800">
                      STEP {stage}
                    </span>
                    <span className="text-[12.5px] font-semibold text-gray-700">
                      {role ? loc(lang, role.shortLabel, role.shortLabelKo) : ''}
                    </span>
                  </span>
                  <span className="text-[11px] font-medium text-cyan-700">
                    {open
                      ? ko
                        ? '닫기 ▾'
                        : '閉じる ▾'
                      : ko
                        ? '체크리스트 열기 ▸'
                        : 'チェックリストを開く ▸'}
                  </span>
                </button>

                {open ? (
                  <div className="grid grid-cols-1 gap-2.5 border-t border-gray-100 bg-gray-50/40 p-2.5 md:grid-cols-2 xl:grid-cols-3">
                    {cats.map((c) => categoryCard(c))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 border-t border-gray-100 px-3 py-2.5">
                    {cats.map((c) => categoryChip(c))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {/* 非断定原則の注意文言 (確定 #3) */}
      <p className="shrink-0 border-t border-gray-100 bg-white px-3 py-2.5 text-[10px] leading-relaxed text-gray-400 md:px-5">
        {s.disclaimer}
      </p>
    </div>
  );
};

export default CraftView;
