import React, { useMemo, useState } from 'react';
import { STRINGS, loc, type Lang } from '../../domain/i18n';
import type { Atom, AtomCheckMap, Role, Tag } from '../../domain/types';

/**
 * 業務ロードマップ v2.7 — 段階アコーディオン (企画書 §0-E / AC-12)
 *
 * - 行 = 段階 (下が STEP1)。列 = 業務の区分 (タグ)
 * - 段階の見出しを押すと、その段階だけ「チェックリスト」が表の中で開く。
 *   同時に開くのは1段階のみ。閉じている段階は件数だけを表示する
 *   (アサリさん: クリックしないと見えないのが不満 / 情報過多も避ける → 折衷)
 * - 上の段階を開くと、下で身につけた項目はチェック済みのまま引き継がれ、
 *   その段階で新たに必要になる項目 (差分) が NEW として強調される
 * - チェックの単位は原子 (できると言える項目)。ドリルダウンのドロワーは廃止し、
 *   表の中でインライン展開する
 * - モバイル: 段階ごとの縦セクション (列を横に並べない)
 */

interface CraftViewProps {
  roles: Role[];
  tags: Tag[];
  atoms: Atom[];
  atomChecks: AtomCheckMap;
  onToggleAtom: (atomId: string) => void;
  lang: Lang;
}

const CraftView: React.FC<CraftViewProps> = ({
  roles,
  tags,
  atoms,
  atomChecks,
  onToggleAtom,
  lang,
}) => {
  const s = STRINGS[lang];
  const ko = lang === 'ko';

  const sortedTags = useMemo(() => [...tags].sort((a, b) => a.sortOrder - b.sortOrder), [tags]);

  /** 素材データが存在する段階のみ (現在は STEP1・STEP2) */
  const stagesDesc = useMemo(
    () => [...new Set(atoms.map((a) => a.firstStage))].sort((a, b) => b - a), // 上 = 高い段階
    [atoms],
  );
  const stagesAsc = useMemo(() => [...stagesDesc].reverse(), [stagesDesc]);

  // 既定で STEP1 を開く。同時に開くのは1段階のみ (null = 全て閉じる)
  const [openStage, setOpenStage] = useState<number | null>(
    () => (atoms.length > 0 ? Math.min(...atoms.map((a) => a.firstStage)) : 1),
  );

  const roleOfStage = (stage: number): Role | undefined =>
    roles.find((r) => r.stageOrder === stage && r.status !== 'hidden');

  const atomsUpTo = (tagId: string, stage: number): Atom[] =>
    atoms
      .filter((a) => a.tagId === tagId && a.firstStage <= stage)
      .sort((a, b) => a.firstStage - b.firstStage || a.sortOrder - b.sortOrder);

  const diffAtoms = (tagId: string, stage: number): Atom[] =>
    atoms
      .filter((a) => a.tagId === tagId && a.firstStage === stage)
      .sort((a, b) => a.sortOrder - b.sortOrder);

  const checkedCount = (list: Atom[]): number =>
    list.filter((a) => atomChecks[a.atomId] === true).length;

  // ---------------------------------------------------------------------
  // 部品
  // ---------------------------------------------------------------------
  const atomRow = (atom: Atom, opts: { isNew?: boolean; inherited?: boolean } = {}) => {
    const checked = atomChecks[atom.atomId] === true;
    return (
      <label
        key={atom.atomId}
        className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2 py-1.5 transition-colors ${
          opts.isNew
            ? 'border-amber-200 bg-amber-50/70 hover:border-amber-300'
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
            className={`block text-[11.5px] leading-snug ${
              opts.inherited && checked ? 'text-gray-400' : 'text-gray-800'
            }`}
          >
            {loc(lang, atom.statement, atom.statementKo)}
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

  /** 開いた段階のセル: チェックリストをインライン展開 */
  const checklistBody = (tag: Tag, stage: number) => {
    const inherited = atomsUpTo(tag.tagId, stage - 1);
    const diff = diffAtoms(tag.tagId, stage);
    if (stage === Math.min(...stagesAsc)) {
      // 最下段: 差分/継承の区別なく全件
      const all = atomsUpTo(tag.tagId, stage);
      return <div className="flex flex-col gap-1">{all.map((a) => atomRow(a))}</div>;
    }
    return (
      <div className="flex flex-col gap-1">
        {diff.length > 0 && (
          <p className="text-[9.5px] font-semibold text-amber-700">
            {ko ? `이 단계에서 추가 (${diff.length})` : `この段階で追加（${diff.length}）`}
          </p>
        )}
        {diff.map((a) => atomRow(a, { isNew: true }))}
        {inherited.length > 0 && (
          <p className="mt-1 text-[9.5px] font-semibold text-gray-400">
            {ko ? '아래 단계에서 인계' : '下の段階から引き継ぎ'}
          </p>
        )}
        {inherited.map((a) => atomRow(a, { inherited: true }))}
      </div>
    );
  };

  /** 閉じた段階のセル: 件数のみ (「チェックリスト n/m」) */
  const summaryBody = (tag: Tag, stage: number) => {
    const cumulative = atomsUpTo(tag.tagId, stage);
    const diff = diffAtoms(tag.tagId, stage);
    const done = checkedCount(cumulative);
    const complete = cumulative.length > 0 && done === cumulative.length;
    return (
      <span className="flex flex-col gap-1">
        <span className="flex flex-wrap items-center gap-1">
          <span className="text-[9.5px] text-gray-400">{ko ? '체크리스트' : 'チェックリスト'}</span>
          <span
            className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
              complete ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-gray-700'
            }`}
          >
            {done}/{cumulative.length}
          </span>
          {stage > 1 && diff.length > 0 && (
            <span className="rounded bg-amber-100 px-1 py-0.5 text-[9.5px] font-bold text-amber-700">
              +{diff.length} NEW
            </span>
          )}
        </span>
      </span>
    );
  };

  const stepLabelText = (stage: number) => {
    const role = roleOfStage(stage);
    return { stage, role };
  };

  const toggle = (stage: number) => setOpenStage((cur) => (cur === stage ? null : stage));

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      <div className="shrink-0 px-3 pt-3 md:px-5 md:pt-4">
        <p className="text-[11px] leading-relaxed text-gray-500">{s.roadmapLegend}</p>
      </div>

      {/* ============ デスクトップ: アコーディオン表 (md以上) ============ */}
      <div className="hidden min-h-0 flex-1 px-2 pb-3 pt-3 md:block md:px-5">
        <div className="h-full overflow-auto rounded-xl border border-gray-200 bg-white">
          <div
            className="grid w-full min-w-[1120px]"
            style={{ gridTemplateColumns: `160px repeat(${sortedTags.length}, minmax(150px, 1fr))` }}
          >
            {/* ヘッダー行: タグ (上部固定) */}
            <div className="sticky left-0 top-0 z-30 w-40 border-b border-r border-gray-200 bg-gray-50 px-3 py-2.5" />
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

            {/* 上位段階の予告 */}
            <div className="sticky left-0 z-10 w-40 border-b border-r border-gray-100 bg-gray-50/60 px-3 py-2">
              <span className="block text-right text-[9.5px] leading-tight text-gray-400">STEP 3〜6</span>
            </div>
            <div
              className="border-b border-gray-100 bg-gray-50/60 px-3 py-2 text-[10px] text-gray-400"
              style={{ gridColumn: `span ${sortedTags.length}` }}
            >
              {ko
                ? '분해는 순차 확장 예정 (현재는 STEP1 전수 + STEP2 차분을 정비 중)'
                : '分解は順次拡張予定（現在は STEP1 の網羅と STEP2 の差分を整備中）'}
            </div>

            {/* データ行: 上 = 高い段階 */}
            {stagesDesc.map((stage) => {
              const open = openStage === stage;
              const { role } = stepLabelText(stage);
              return (
                <React.Fragment key={stage}>
                  <button
                    type="button"
                    onClick={() => toggle(stage)}
                    className={`sticky left-0 z-10 flex w-40 flex-col items-start gap-1 border-b border-r border-gray-100 px-3 py-2.5 text-left ${
                      open ? 'bg-cyan-50' : 'bg-white hover:bg-gray-50'
                    }`}
                  >
                    <span className="rounded bg-cyan-100 px-1.5 py-0.5 text-[10px] font-bold text-cyan-800">
                      STEP {stage}
                    </span>
                    <span className="text-[10.5px] font-semibold leading-tight text-gray-600">
                      {role ? loc(lang, role.shortLabel, role.shortLabelKo) : ''}
                    </span>
                    <span className="text-[10px] font-medium text-cyan-700">
                      {open
                        ? ko
                          ? '닫기 ▾'
                          : '閉じる ▾'
                        : ko
                          ? '체크리스트 열기 ▸'
                          : 'チェックリストを開く ▸'}
                    </span>
                  </button>
                  {sortedTags.map((tag) => (
                    <div
                      key={tag.tagId}
                      className="flex flex-col border-b border-gray-100 p-1.5"
                    >
                      {open ? (
                        checklistBody(tag, stage)
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggle(stage)}
                          className="flex h-full w-full flex-col justify-center rounded-lg px-1 py-1 text-left hover:bg-gray-50"
                        >
                          {summaryBody(tag, stage)}
                        </button>
                      )}
                    </div>
                  ))}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* ============ モバイル: 段階ごとの縦セクション ============ */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-3 md:hidden">
        <div className="mb-3 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2 text-[10px] text-gray-400">
          {ko ? 'STEP 3~6 분해는 순차 확장 예정' : 'STEP 3〜6 の分解は順次拡張予定'}
        </div>
        <div className="flex flex-col gap-3">
          {stagesAsc.map((stage) => {
            const open = openStage === stage;
            const { role } = stepLabelText(stage);
            return (
              <section key={stage} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <button
                  type="button"
                  onClick={() => toggle(stage)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left ${
                    open ? 'bg-cyan-50' : 'bg-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="rounded bg-cyan-100 px-1.5 py-0.5 text-[10px] font-bold text-cyan-800">
                      STEP {stage}
                    </span>
                    <span className="text-[12px] font-semibold text-gray-700">
                      {role ? loc(lang, role.shortLabel, role.shortLabelKo) : ''}
                    </span>
                  </span>
                  <span className="text-[11px] font-medium text-cyan-700">
                    {open ? (ko ? '닫기 ▾' : '閉じる ▾') : ko ? '체크리스트 열기 ▸' : 'チェックリストを開く ▸'}
                  </span>
                </button>
                <div className="flex flex-col divide-y divide-gray-100">
                  {sortedTags.map((tag) => {
                    const cumulative = atomsUpTo(tag.tagId, stage);
                    const done = checkedCount(cumulative);
                    const complete = cumulative.length > 0 && done === cumulative.length;
                    const diff = diffAtoms(tag.tagId, stage);
                    return (
                      <div key={tag.tagId} className="px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[12px] font-bold text-gray-800">
                            {loc(lang, tag.labelJa, tag.labelKo)}
                          </span>
                          <span className="flex items-center gap-1">
                            {stage > 1 && diff.length > 0 && (
                              <span className="rounded bg-amber-100 px-1 py-0.5 text-[9.5px] font-bold text-amber-700">
                                +{diff.length} NEW
                              </span>
                            )}
                            <span
                              className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
                                complete ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {done}/{cumulative.length}
                            </span>
                          </span>
                        </div>
                        {open && <div className="mt-1.5">{checklistBody(tag, stage)}</div>}
                      </div>
                    );
                  })}
                </div>
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
