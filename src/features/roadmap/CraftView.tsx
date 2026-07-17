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
 *   「何個中何個」を示す。達成率が閾値 (80%) 以上なら「達成」、未満なら不足が一目で分かる。
 * - チェックの単位は原子。カテゴリの達成率 = (達成した下位カテゴリ数 + チェック済み原子数) / 総項目数。
 * - 一度に開く段階は1つ (アコーディオン)。既定は最下段 (STEP1)。
 */

const CLEAR = 0.8; // クリア閾値 (8割)

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

  /** カテゴリ達成統計 (再帰: 包含した下位カテゴリは「達成なら1」として数える) */
  const stat = (catId: string): CatStat => {
    const cat = catById.get(catId);
    if (!cat) return { done: 0, total: 0, ratio: 0, cleared: false };
    const own = directAtoms(catId);
    const ownDone = own.filter((a) => atomChecks[a.atomId] === true).length;
    const childDone = cat.includes.filter((id) => stat(id).cleared).length;
    const total = own.length + cat.includes.length;
    const done = ownDone + childDone;
    const ratio = total === 0 ? 0 : done / total;
    return { done, total, ratio, cleared: total > 0 && ratio >= CLEAR };
  };

  const stagesDesc = useMemo(
    () => [...new Set(categories.map((c) => c.stage))].sort((a, b) => b - a),
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
          <span className={`rounded bg-emerald-500 font-bold text-white ${pad}`}>
            {ko ? '달성 ✓' : '達成 ✓'}
          </span>
        ) : (
          <span className={`rounded bg-amber-100 font-bold text-amber-700 ${pad}`}>
            {ko ? `앞으로 ${need}` : `あと${need}`}
          </span>
        )}
      </span>
    );
  };

  // ---------------------------------------------------------------------
  // カテゴリカード (開いた段階)
  // ---------------------------------------------------------------------
  const categoryCard = (cat: Category) => {
    const st = stat(cat.categoryId);
    const own = directAtoms(cat.categoryId);
    return (
      <div
        key={cat.categoryId}
        className={`flex flex-col overflow-hidden rounded-xl border ${
          st.cleared ? 'border-emerald-200' : 'border-gray-200'
        } bg-white`}
      >
        <div
          className={`flex items-start justify-between gap-2 px-3 py-2 ${
            st.cleared ? 'bg-emerald-50/70' : 'bg-gray-50'
          }`}
        >
          <span className="text-[12.5px] font-bold leading-snug text-gray-800">
            {loc(lang, cat.labelJa, cat.labelKo)}
          </span>
          {statusBadge(st)}
        </div>

        <div className="flex flex-col gap-1 p-2">
          {/* 包含した下位カテゴリ = 1行ロールアップ (押すと下位段階へ) */}
          {cat.includes.map((id) => {
            const child = catById.get(id);
            if (!child) return null;
            const cst = stat(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => setOpenStage(child.stage)}
                className={`flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-left ${
                  cst.cleared
                    ? 'border-emerald-100 bg-emerald-50/50'
                    : 'border-amber-100 bg-amber-50/40'
                } hover:brightness-95`}
              >
                <span className="flex min-w-0 items-center gap-1">
                  <span className="text-[10px] text-gray-400" aria-hidden>
                    STEP {child.stage} ▸
                  </span>
                  <span className="truncate text-[11.5px] font-semibold text-gray-700">
                    {loc(lang, child.labelJa, child.labelKo)}
                  </span>
                </span>
                {statusBadge(cst, 'sm')}
              </button>
            );
          })}

          {/* その段階固有の原子 (チェック対象) */}
          {own.map((a) => {
            const checked = atomChecks[a.atomId] === true;
            return (
              <label
                key={a.atomId}
                className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-100 bg-white px-2 py-1.5 hover:border-cyan-200"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleAtom(a.atomId)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-cyan-600"
                />
                <span className="text-[11.5px] leading-snug text-gray-800">
                  {loc(lang, a.statement, a.statementKo)}
                </span>
              </label>
            );
          })}
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
      <span
        key={cat.categoryId}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 ${
          st.cleared ? 'border-emerald-200 bg-emerald-50/70' : 'border-gray-200 bg-white'
        }`}
      >
        <span className="text-[11px] font-semibold text-gray-700">
          {loc(lang, cat.labelJa, cat.labelKo)}
        </span>
        <span
          className={`rounded px-1 py-0.5 text-[10px] font-bold ${
            st.cleared ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {st.done}/{st.total}
        </span>
      </span>
    );
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="shrink-0 px-3 pt-3 md:px-5 md:pt-4">
        <p className="text-[11px] leading-relaxed text-gray-500">{s.roadmapLegend}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-3 md:px-5">
        <div className="mb-3 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2 text-[10px] text-gray-400">
          {ko
            ? 'STEP 3~6 카테고리는 순차 확장 예정 (현재는 STEP1 전수 + STEP2 감시·일차 대응 시연)'
            : 'STEP 3〜6 のカテゴリは順次拡張予定（現在は STEP1 の網羅と STEP2 監視・一次対応の試作）'}
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
