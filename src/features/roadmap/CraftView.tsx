import React, { useMemo, useState } from 'react';
import { STRINGS, loc, type Lang } from '../../domain/i18n';
import type { Atom, AtomCheckMap, Role, Tag, Weapon } from '../../domain/types';

/**
 * 業務ロードマップ v2.7 — 素材→武器モデル (企画書 §0-E / AC-12)
 *
 * ゲームのクラフトのように「素材 (原子能力) を集めると上位の武器 (能力) になる」構造。
 * - 行 = 段階 (下が STEP1)。当面は STEP1→STEP2 の2段フォーカス (アサリさん合意)
 * - 列 = 業務の区分 (タグ)。セルにはタグ名と素材の達成数のみ表示し、
 *   タップすると素材チェックリストが開く (ドリルダウン — 情報過多の防止)
 * - 上の段階でタグを開くと、下で身につけた素材はチェック済みのまま引き継がれ、
 *   その段階で新たに必要になる素材 (差分) が NEW として強調される
 * - 武器は構成素材の組み合わせ (多:1)。素材の文言は原文そのまま表示 (文言一致 — AC-12.4)
 * - チェックの単位は素材。武器の進捗は構成素材の達成率から自動派生
 */

interface CraftViewProps {
  roles: Role[];
  tags: Tag[];
  atoms: Atom[];
  weapons: Weapon[];
  atomChecks: AtomCheckMap;
  onToggleAtom: (atomId: string) => void;
  lang: Lang;
}

type DrawerState =
  | { kind: 'tag'; tagId: string; stage: number }
  | { kind: 'weapon'; weaponId: string }
  | null;

const CraftView: React.FC<CraftViewProps> = ({
  roles,
  tags,
  atoms,
  weapons,
  atomChecks,
  onToggleAtom,
  lang,
}) => {
  const s = STRINGS[lang];
  const ko = lang === 'ko';
  const [drawer, setDrawer] = useState<DrawerState>(null);

  const sortedTags = useMemo(() => [...tags].sort((a, b) => a.sortOrder - b.sortOrder), [tags]);

  /** 2段フォーカス: 素材データが存在する段階のみ行にする (現在は STEP1・STEP2) */
  const stagesShown = useMemo(() => {
    const stages = new Set(atoms.map((a) => a.firstStage));
    for (const w of weapons) {
      const role = roles.find((r) => r.roleId === w.roleId);
      if (role) stages.add(role.stageOrder);
    }
    return [...stages].sort((a, b) => b - a); // 上 = 高い段階
  }, [atoms, weapons, roles]);

  const roleOfStage = (stage: number): Role | undefined =>
    roles.find((r) => r.stageOrder === stage && r.status !== 'hidden');

  const stageOfWeapon = (w: Weapon): number =>
    roles.find((r) => r.roleId === w.roleId)?.stageOrder ?? 0;

  const atomsOf = (tagId: string, upToStage: number): Atom[] =>
    atoms
      .filter((a) => a.tagId === tagId && a.firstStage <= upToStage)
      .sort((a, b) => a.firstStage - b.firstStage || a.sortOrder - b.sortOrder);

  const checkedCount = (list: Atom[]): number =>
    list.filter((a) => atomChecks[a.atomId] === true).length;

  // ---------------------------------------------------------------------
  // セル
  // ---------------------------------------------------------------------
  const tagCell = (tag: Tag, stage: number) => {
    const cumulative = atomsOf(tag.tagId, stage);
    const diff = cumulative.filter((a) => a.firstStage === stage);
    const cellWeapons = weapons
      .filter((w) => w.tagId === tag.tagId && stageOfWeapon(w) === stage)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    // その段階に新規素材も武器も無いタグは、最初に登場した段階にだけセルを出す
    const isOrigin = cumulative.length > 0 && Math.min(...cumulative.map((a) => a.firstStage)) === stage;
    if (!isOrigin && diff.length === 0 && cellWeapons.length === 0) return null;

    const done = checkedCount(cumulative);
    return (
      <div className="flex h-full flex-col gap-1.5">
        <button
          type="button"
          onClick={() => setDrawer({ kind: 'tag', tagId: tag.tagId, stage })}
          className="flex w-full flex-col gap-1 rounded-lg border border-cyan-100 bg-cyan-50/60 px-2.5 py-2 text-left transition-colors hover:border-cyan-300 hover:bg-cyan-50"
        >
          <span className="text-[11.5px] font-bold leading-snug text-cyan-900">
            {loc(lang, tag.labelJa, tag.labelKo)}
          </span>
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">
              {done}/{cumulative.length}
            </span>
            {stage > 1 && diff.length > 0 && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                +{diff.length} NEW
              </span>
            )}
            {stage > 1 && diff.length === 0 && (
              <span className="text-[9.5px] text-gray-400">{ko ? '(인계만)' : '（引き継ぎのみ）'}</span>
            )}
          </span>
        </button>
        {cellWeapons.map((w) => {
          const parts = w.composedOf
            .map((id) => atoms.find((a) => a.atomId === id))
            .filter((a): a is Atom => Boolean(a));
          const wDone = checkedCount(parts);
          return (
            <button
              key={w.weaponId}
              type="button"
              onClick={() => setDrawer({ kind: 'weapon', weaponId: w.weaponId })}
              className="flex w-full flex-col gap-1 rounded-lg border border-violet-200 bg-violet-50/70 px-2.5 py-2 text-left transition-colors hover:border-violet-400 hover:bg-violet-50"
            >
              <span className="flex items-center gap-1">
                <span aria-hidden>⚔</span>
                <span className="text-[10px] font-bold text-violet-700">
                  {ko ? '조합 능력' : '組み合わせ能力'}
                </span>
              </span>
              <span className="text-[11.5px] font-semibold leading-snug text-gray-800">
                {loc(lang, w.statement, w.statementKo)}
              </span>
              <span className="text-[10px] text-gray-500">
                {ko ? '소재' : '素材'} {wDone}/{parts.length}
                {parts.length > 0 && ` ・ ${Math.round((wDone / parts.length) * 100)}%`}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  // ---------------------------------------------------------------------
  // ドロワー内容
  // ---------------------------------------------------------------------
  const atomRow = (atom: Atom, opts: { isNew?: boolean; inherited?: boolean; tagLabel?: string }) => {
    const checked = atomChecks[atom.atomId] === true;
    return (
      <label
        key={atom.atomId}
        className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 transition-colors ${
          opts.isNew
            ? 'border-amber-200 bg-amber-50/60 hover:border-amber-300'
            : opts.inherited
              ? 'border-gray-100 bg-gray-50/60 hover:border-gray-200'
              : 'border-gray-100 bg-white hover:border-cyan-200'
        }`}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggleAtom(atom.atomId)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-cyan-600"
        />
        <span className="min-w-0 flex-1">
          <span
            className={`block text-[12px] leading-snug ${
              opts.inherited && checked ? 'text-gray-400' : 'text-gray-800'
            }`}
          >
            {loc(lang, atom.statement, atom.statementKo)}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1">
            {opts.isNew && (
              <span className="rounded bg-amber-100 px-1 py-px text-[9px] font-bold text-amber-700">
                NEW
              </span>
            )}
            {opts.tagLabel && (
              <span className="rounded bg-cyan-50 px-1 py-px text-[9px] text-cyan-700">{opts.tagLabel}</span>
            )}
          </span>
        </span>
      </label>
    );
  };

  const drawerContent = () => {
    if (!drawer) return null;
    if (drawer.kind === 'tag') {
      const tag = sortedTags.find((t) => t.tagId === drawer.tagId);
      if (!tag) return null;
      const inherited = atomsOf(tag.tagId, drawer.stage - 1);
      const diff = atoms
        .filter((a) => a.tagId === tag.tagId && a.firstStage === drawer.stage)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const role = roleOfStage(drawer.stage);
      return (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3">
          <p className="text-[10px] font-semibold text-gray-400">
            STEP {drawer.stage}
            {role ? ` ・ ${loc(lang, role.shortLabel, role.shortLabelKo)}` : ''}
          </p>
          <h3 className="mt-0.5 text-[15px] font-bold text-gray-800">
            {loc(lang, tag.labelJa, tag.labelKo)}
          </h3>
          {drawer.stage > 1 && (
            <>
              <p className="mt-3 text-[11px] font-semibold text-gray-500">
                {ko
                  ? `이 단계에서 새로 필요해지는 것 (차분 ${diff.length}건)`
                  : `この段階で新たに必要になるもの（差分 ${diff.length}件）`}
              </p>
              <div className="mt-1.5 flex flex-col gap-1.5">
                {diff.length === 0 ? (
                  <p className="text-[11px] text-gray-400">{ko ? '신규 없음' : '新規なし'}</p>
                ) : (
                  diff.map((a) => atomRow(a, { isNew: true }))
                )}
              </div>
              <p className="mt-4 text-[11px] font-semibold text-gray-500">
                {ko
                  ? `아래 단계에서 인계 (체크 상태 계승 ・ ${checkedCount(inherited)}/${inherited.length})`
                  : `下の段階から引き継ぎ（チェック状態を継承 ・ ${checkedCount(inherited)}/${inherited.length}）`}
              </p>
            </>
          )}
          <div className="mt-1.5 flex flex-col gap-1.5 pb-2">
            {(drawer.stage > 1 ? inherited : atomsOf(tag.tagId, drawer.stage)).map((a) =>
              atomRow(a, { inherited: drawer.stage > 1 }),
            )}
          </div>
        </div>
      );
    }
    const weapon = weapons.find((w) => w.weaponId === drawer.weaponId);
    if (!weapon) return null;
    const wStage = stageOfWeapon(weapon);
    const parts = weapon.composedOf
      .map((id) => atoms.find((a) => a.atomId === id))
      .filter((a): a is Atom => Boolean(a));
    const inheritedParts = parts.filter((a) => a.firstStage < wStage);
    const diffParts = parts.filter((a) => a.firstStage >= wStage);
    const done = checkedCount(parts);
    const pct = parts.length > 0 ? Math.round((done / parts.length) * 100) : 0;
    const tagLabelOf = (a: Atom): string => {
      const t = sortedTags.find((t0) => t0.tagId === a.tagId);
      return t ? loc(lang, t.labelJa, t.labelKo) : a.tagId;
    };
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3">
        <p className="text-[10px] font-semibold text-violet-500">
          ⚔ {ko ? `조합 능력 (STEP ${wStage})` : `組み合わせ能力（STEP ${wStage}）`}
        </p>
        <h3 className="mt-0.5 text-[15px] font-bold text-gray-800">
          {loc(lang, weapon.statement, weapon.statementKo)}
        </h3>
        <div className="mt-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-violet-400" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-[10.5px] text-gray-500">
            {ko ? '소재' : '素材'} {done}/{parts.length} ・ {pct}%
          </p>
        </div>
        <p className="mt-3 text-[11px] font-semibold text-gray-500">
          {ko
            ? `아래 단계에서 모은 소재 (문언은 소재 원문 그대로)`
            : `下の段階で集めた素材（文言は素材の原文そのまま）`}
        </p>
        <div className="mt-1.5 flex flex-col gap-1.5">
          {inheritedParts.map((a) => atomRow(a, { tagLabel: tagLabelOf(a) }))}
        </div>
        {diffParts.length > 0 && (
          <>
            <p className="mt-4 text-[11px] font-semibold text-gray-500">
              {ko ? '이 단계에서 새로 필요한 소재' : 'この段階で新たに必要な素材'}
            </p>
            <div className="mt-1.5 flex flex-col gap-1.5 pb-2">
              {diffParts.map((a) => atomRow(a, { isNew: true, tagLabel: tagLabelOf(a) }))}
            </div>
          </>
        )}
      </div>
    );
  };

  // ---------------------------------------------------------------------
  // 行ラベル
  // ---------------------------------------------------------------------
  const stepLabel = (stage: number) => {
    const role = roleOfStage(stage);
    return (
      <div className="text-right">
        <span className="inline-flex flex-col items-end gap-0.5 md:flex-row md:items-center md:gap-1.5">
          <span className="rounded bg-cyan-100 px-1.5 py-0.5 text-[10px] font-bold text-cyan-800">
            STEP {stage}
          </span>
        </span>
        <span className="mt-1 block text-[10.5px] font-semibold leading-tight text-gray-600">
          {role ? loc(lang, role.shortLabel, role.shortLabelKo) : ''}
        </span>
      </div>
    );
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      <div className="shrink-0 px-3 pt-3 md:px-5 md:pt-4">
        <p className="text-[11px] leading-relaxed text-gray-500">{s.roadmapLegend}</p>
      </div>

      <div className="min-h-0 flex-1 px-2 pb-3 pt-3 md:px-5">
        <div className="h-full overflow-auto rounded-xl border border-gray-200 bg-white">
          <div
            className="grid w-full min-w-[1120px]"
            style={{ gridTemplateColumns: `max-content repeat(${sortedTags.length}, minmax(150px, 1fr))` }}
          >
            {/* ヘッダー行: タグ (スクロールしても上部固定) */}
            <div className="sticky left-0 top-0 z-30 w-[80px] border-b border-r border-gray-200 bg-gray-50 px-1.5 py-2.5 md:w-[120px] md:px-3" />
            {sortedTags.map((tag) => (
              <div
                key={tag.tagId}
                className="sticky top-0 z-20 border-b border-gray-200 bg-gray-50 px-2 py-2.5 text-center"
              >
                <span className="text-[11px] font-bold leading-snug text-gray-700">
                  {loc(lang, tag.labelJa, tag.labelKo)}
                </span>
              </div>
            ))}

            {/* 上位段階の拡張予告 */}
            <div className="sticky left-0 z-10 w-[80px] border-b border-r border-gray-100 bg-gray-50/60 px-1.5 py-2 md:w-[120px] md:px-3">
              <span className="block text-right text-[9.5px] leading-tight text-gray-400">STEP 3〜6</span>
            </div>
            <div
              className="border-b border-gray-100 bg-gray-50/60 px-3 py-2 text-[10px] text-gray-400"
              style={{ gridColumn: `span ${sortedTags.length}` }}
            >
              {ko
                ? '분해를 순차 확장 예정 (현재는 STEP1 전수 + STEP2 차분·조합 시연을 정비 중)'
                : '分解は順次拡張予定（現在は STEP1 の網羅と STEP2 の差分・組み合わせを整備中）'}
            </div>

            {/* データ行: 上 = 高い段階 */}
            {stagesShown.map((stage) => (
              <React.Fragment key={stage}>
                <div className="sticky left-0 z-10 w-[80px] border-b border-r border-gray-100 bg-white px-1.5 py-2.5 md:w-[120px] md:px-3">
                  {stepLabel(stage)}
                </div>
                {sortedTags.map((tag) => (
                  <div key={tag.tagId} className="border-b border-gray-100 p-1.5">
                    {tagCell(tag, stage)}
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* 非断定原則の注意文言 (確定 #3) */}
      <p className="shrink-0 border-t border-gray-100 bg-white px-3 py-2.5 text-[10px] leading-relaxed text-gray-400 md:px-5">
        {s.disclaimer}
      </p>

      {/* ドロワー: モバイル=ボトムシート / md+=右ドロワー */}
      {drawer && (
        <div className="absolute inset-0 z-40">
          <button
            type="button"
            aria-label="閉じる"
            className="absolute inset-0 bg-black/30"
            onClick={() => setDrawer(null)}
          />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[82dvh] flex-col rounded-t-2xl bg-white shadow-2xl md:inset-x-auto md:inset-y-0 md:right-0 md:max-h-none md:w-[420px] md:rounded-none md:border-l md:border-gray-200">
            <div className="flex justify-center pt-2 md:hidden">
              <span className="h-1 w-10 rounded-full bg-gray-200" />
            </div>
            {drawerContent()}
            <button
              type="button"
              onClick={() => setDrawer(null)}
              className="border-t border-gray-100 py-2.5 text-center text-xs font-medium text-gray-500"
            >
              {ko ? '닫기' : '閉じる'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CraftView;
