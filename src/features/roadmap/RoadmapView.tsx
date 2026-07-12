import React, { useMemo } from 'react';
import {
  deriveAbilityState,
  evaluateAbility,
  type AbilityEvaluation,
} from '../../domain/evaluate';
import { STRINGS, loc, type Lang } from '../../domain/i18n';
import type {
  Ability,
  Evidence,
  EvidenceCheckMap,
  GrowthLine,
  ManagerConfirmMap,
  Role,
} from '../../domain/types';

/**
 * 業務ロードマップ (v2.6c — 企画書 §0-D / AC-11)
 *
 * 横 = 段階 (役割) / 縦 = 業務の高度さ。
 * 下の行ほど基礎的な業務、上の行ほど高度な業務 (growth-lines の sortOrder = 難易度、
 * 1 が最も基礎で最下段に表示)。各ラインの担当区間を色帯で塗ることで、
 * 段階が上がるにつれて業務が左下から右上へ広がる「階段」の形が見える。
 *
 * - 状態は階段ビューと同じ派生ロジック (evaluate) を再利用する
 * - 能力クリック → 階段ビューへ遷移して該当能力を選択 (閲覧専用 — AC-11.6)
 * - 列ヘッダーは STEP 番号 + 役割名 (AC-11.4b)
 * - モバイル: ラインごとの縦セクション (基礎ライン→高度ライン順 — AC-11.11)
 */

interface RoadmapViewProps {
  roles: Role[];
  growthLines: GrowthLine[];
  abilities: Ability[];
  evidencesByAbility: ReadonlyMap<string, Evidence[]>;
  evidenceChecks: EvidenceCheckMap;
  managerConfirms: ManagerConfirmMap;
  lang: Lang;
  onSelectAbility: (abilityId: string) => void;
}

const STATE_ICON: Record<string, { icon: string; className: string }> = {
  'not-started': { icon: '○', className: 'text-gray-300' },
  'in-progress': { icon: '◐', className: 'text-amber-500' },
  'can-do': { icon: '✓', className: 'text-emerald-600' },
  confirmed: { icon: '✓', className: 'text-emerald-700' },
};

/** ラインの色帯 (難易度順: 添字 0 = 最も基礎)。Tailwind は静的クラスが必要なため列挙 */
const LINE_COLORS = [
  { band: 'bg-cyan-50/80 border-cyan-100', dot: 'bg-cyan-500', text: 'text-cyan-900' },
  { band: 'bg-emerald-50/80 border-emerald-100', dot: 'bg-emerald-500', text: 'text-emerald-900' },
  { band: 'bg-violet-50/80 border-violet-100', dot: 'bg-violet-500', text: 'text-violet-900' },
  { band: 'bg-amber-50/80 border-amber-100', dot: 'bg-amber-500', text: 'text-amber-900' },
] as const;

const NO_LINE_COLOR = { band: 'bg-gray-50 border-gray-100', dot: 'bg-gray-300', text: 'text-gray-500' } as const;

interface RowDef {
  key: string;
  label: string;
  color: (typeof LINE_COLORS)[number] | typeof NO_LINE_COLOR;
  /** roleId -> abilities (sortOrder順) */
  cells: Map<string, Ability[]>;
  /** ラインの担当区間 (能力が存在する最小〜最大 stageOrder)。区間外は帯を描かない */
  minStage: number;
  maxStage: number;
}

const AbilityCard: React.FC<{
  ability: Ability;
  evaluation: AbilityEvaluation;
  lang: Lang;
  onSelect: (abilityId: string) => void;
}> = ({ ability, evaluation, lang, onSelect }) => {
  const s = STRINGS[lang];
  const state = deriveAbilityState(evaluation);
  const { icon, className } = STATE_ICON[state];
  return (
    <button
      type="button"
      onClick={() => onSelect(ability.abilityId)}
      className="flex w-full items-start gap-1.5 rounded-lg border border-white/60 bg-white/90 px-2 py-1.5 text-left shadow-sm transition-colors hover:border-cyan-300 hover:bg-white"
    >
      <span className={`mt-px w-3.5 shrink-0 text-center text-xs font-bold ${className}`} aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11.5px] leading-snug text-gray-800">
          {loc(lang, ability.statement, ability.statementKo)}
        </span>
        <span className="mt-0.5 block text-[9.5px] text-gray-400">
          {s.stateLabels[state]} ・ {s.evidenceWord} {evaluation.evidenceChecked}/{evaluation.evidenceTotal}
        </span>
      </span>
    </button>
  );
};

const RoadmapView: React.FC<RoadmapViewProps> = ({
  roles,
  growthLines,
  abilities,
  evidencesByAbility,
  evidenceChecks,
  managerConfirms,
  lang,
  onSelectAbility,
}) => {
  const s = STRINGS[lang];

  const columns = useMemo(
    () => [...roles].filter((r) => r.status !== 'hidden').sort((a, b) => a.stageOrder - b.stageOrder),
    [roles],
  );

  /** 難易度昇順 (添字 0 = 最も基礎)。デスクトップは逆順で描画して「下 = 基礎」にする */
  const rowsByDifficulty = useMemo<RowDef[]>(() => {
    const roleIds = new Set(columns.map((r) => r.roleId));
    const stageOf = new Map(columns.map((r) => [r.roleId, r.stageOrder] as const));
    const visibleAbilities = abilities.filter((a) => roleIds.has(a.roleId));
    const sortedLines = [...growthLines].sort((a, b) => a.sortOrder - b.sortOrder);

    const build = (
      key: string,
      label: string,
      color: RowDef['color'],
      match: (a: Ability) => boolean,
    ): RowDef => {
      const cells = new Map<string, Ability[]>();
      let minStage = Number.POSITIVE_INFINITY;
      let maxStage = Number.NEGATIVE_INFINITY;
      for (const a of visibleAbilities) {
        if (!match(a)) continue;
        const list = cells.get(a.roleId);
        if (list) list.push(a);
        else cells.set(a.roleId, [a]);
        const stage = stageOf.get(a.roleId) ?? 0;
        minStage = Math.min(minStage, stage);
        maxStage = Math.max(maxStage, stage);
      }
      for (const list of cells.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);
      return { key, label, color, cells, minStage, maxStage };
    };

    const defs = sortedLines
      .map((line, i) =>
        build(
          line.lineId,
          loc(lang, line.labelJa, line.labelKo),
          LINE_COLORS[i % LINE_COLORS.length],
          (a) => a.growthLineId === line.lineId,
        ),
      )
      // 能力が1件も無いラインは表示しない (シート移行中に空行が並ぶのを防ぐ)
      .filter((row) => row.cells.size > 0);

    // ライン未配属の能力は「（ラインなし）」行で必ず表示する (AC-11.7)。
    // 難易度軸には乗らないため、先頭 (= デスクトップでは最下段) に置く
    const lineIds = new Set(sortedLines.map((l) => l.lineId));
    const noLine = build(
      '__no-line__',
      s.noLine,
      NO_LINE_COLOR,
      (a) => !a.growthLineId || !lineIds.has(a.growthLineId),
    );
    return noLine.cells.size > 0 ? [noLine, ...defs] : defs;
  }, [columns, abilities, growthLines, lang, s.noLine]);

  /** デスクトップ表示順: 高度なライン (難易度降順) が上、基礎が下 — 階段の形。ラインなしは最下段 */
  const rowsTopDown = useMemo(() => [...rowsByDifficulty].reverse(), [rowsByDifficulty]);

  /** モバイル表示順: 基礎ライン→高度ライン。ラインなしは末尾 */
  const rowsMobile = useMemo(
    () => [
      ...rowsByDifficulty.filter((r) => r.key !== '__no-line__'),
      ...rowsByDifficulty.filter((r) => r.key === '__no-line__'),
    ],
    [rowsByDifficulty],
  );

  const evalOf = (a: Ability): AbilityEvaluation =>
    evaluateAbility(
      evidencesByAbility.get(a.abilityId) ?? [],
      evidenceChecks,
      managerConfirms[a.abilityId] === true,
    );

  const stepHeader = (role: Role, block = false) => (
    <div className={block ? '' : 'text-center'}>
      <span className="inline-flex items-center gap-1.5">
        <span className="rounded bg-cyan-100 px-1.5 py-0.5 text-[10px] font-bold text-cyan-800">
          STEP {role.stageOrder}
        </span>
        {role.status === 'placeholder' && (
          <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[9.5px] text-gray-500">
            {s.preparing}
          </span>
        )}
      </span>
      <span className="mt-1 block text-[11px] font-semibold leading-tight text-gray-700">
        {loc(lang, role.titleJa, role.titleKo)}
      </span>
    </div>
  );

  const rowLabel = (row: RowDef) => (
    <span className="inline-flex items-start gap-1.5">
      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${row.color.dot}`} aria-hidden />
      <span className={`text-[11.5px] font-bold leading-snug ${row.color.text}`}>{row.label}</span>
    </span>
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-3 pt-3 md:px-5 md:pt-4">
          <p className="text-[11px] leading-relaxed text-gray-500">{s.roadmapLegend}</p>
        </div>

        {/* ============ デスクトップ: 階段マトリクス (md以上) ============ */}
        <div className="hidden px-5 pb-4 pt-3 md:flex md:gap-2">
          {/* 縦軸ラベル: 上 = 高度 / 下 = 基礎 */}
          <div className="flex shrink-0 flex-col items-center justify-center gap-2 pb-2 pt-14 text-[10px] font-semibold text-gray-400">
            <span>{lang === 'ko' ? '고도' : '高度'}</span>
            <span className="h-16 w-px bg-gradient-to-b from-gray-300 to-gray-100" aria-hidden />
            <span aria-hidden>↑</span>
            <span className="h-16 w-px bg-gradient-to-t from-gray-300 to-gray-100" aria-hidden />
            <span>{lang === 'ko' ? '기초' : '基礎'}</span>
          </div>

          <div className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <div
              className="grid min-w-[880px]"
              style={{ gridTemplateColumns: `150px repeat(${columns.length}, minmax(170px, 1fr))` }}
            >
              {/* ヘッダー行 */}
              <div className="sticky left-0 z-10 border-b border-r border-gray-200 bg-gray-50 px-3 py-2.5" />
              {columns.map((role) => (
                <div
                  key={role.roleId}
                  className={`border-b border-gray-200 px-2 py-2.5 ${
                    role.status === 'placeholder' ? 'bg-gray-50/80' : 'bg-gray-50'
                  }`}
                >
                  {stepHeader(role)}
                </div>
              ))}

              {/* データ行 (上 = 高度 / 下 = 基礎) */}
              {rowsTopDown.map((row) => (
                <React.Fragment key={row.key}>
                  <div className="sticky left-0 z-10 border-b border-r border-gray-100 bg-white px-3 py-2.5">
                    {rowLabel(row)}
                  </div>
                  {columns.map((role) => {
                    const cellAbilities = row.cells.get(role.roleId) ?? [];
                    const inSpan =
                      role.stageOrder >= row.minStage && role.stageOrder <= row.maxStage;
                    const isSpanStart = role.stageOrder === row.minStage;
                    const isSpanEnd = role.stageOrder === row.maxStage;
                    return (
                      <div key={role.roleId} className="border-b border-gray-100 p-1">
                        {/* ラインの担当区間だけ色帯を敷く → 左下から右上へ上る階段が見える */}
                        {inSpan ? (
                          <div
                            className={`flex h-full flex-col gap-1.5 border-y ${row.color.band} px-1.5 py-1.5 ${
                              isSpanStart ? 'rounded-l-lg border-l' : ''
                            } ${isSpanEnd ? 'rounded-r-lg border-r' : ''}`}
                          >
                            {cellAbilities.length === 0 ? (
                              <span className="py-1 text-center text-xs text-gray-300" aria-hidden>
                                —
                              </span>
                            ) : (
                              cellAbilities.map((a) => (
                                <AbilityCard
                                  key={a.abilityId}
                                  ability={a}
                                  evaluation={evalOf(a)}
                                  lang={lang}
                                  onSelect={onSelectAbility}
                                />
                              ))
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* ============ モバイル: ラインごとの縦セクション (基礎→高度, AC-11.11) ============ */}
        <div className="flex flex-col gap-4 px-3 pb-4 pt-3 md:hidden">
          {rowsMobile.map((row) => (
            <section key={row.key} className="rounded-xl border border-gray-200 bg-white p-3">
              <h3 className="flex items-center gap-1.5 text-[12.5px] font-bold text-gray-800">
                <span className={`h-2 w-2 rounded-full ${row.color.dot}`} aria-hidden />
                {row.label}
              </h3>
              <div className="mt-2 flex flex-col">
                {columns.map((role, i) => {
                  const cellAbilities = row.cells.get(role.roleId) ?? [];
                  if (cellAbilities.length === 0 && role.status === 'placeholder') return null;
                  const inSpan =
                    role.stageOrder >= row.minStage && role.stageOrder <= row.maxStage;
                  if (!inSpan && cellAbilities.length === 0) return null;
                  return (
                    <div key={role.roleId} className="relative pb-3 pl-4 last:pb-0">
                      {/* 縦の接続線 (階段のつながり) */}
                      {i < columns.length - 1 && role.stageOrder < row.maxStage && (
                        <span
                          className="absolute left-[5px] top-2 h-full w-px bg-cyan-100"
                          aria-hidden
                        />
                      )}
                      <span
                        className={`absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full border-2 ${
                          cellAbilities.length > 0
                            ? 'border-cyan-400 bg-white'
                            : 'border-gray-200 bg-gray-50'
                        }`}
                        aria-hidden
                      />
                      <div className="mb-1">{stepHeader(role, true)}</div>
                      {cellAbilities.length === 0 ? (
                        <p className="text-[10.5px] text-gray-300">—</p>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {cellAbilities.map((a) => (
                            <AbilityCard
                              key={a.abilityId}
                              ability={a}
                              evaluation={evalOf(a)}
                              lang={lang}
                              onSelect={onSelectAbility}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* 非断定原則の注意文言 (確定 #3 / AC-11.8) */}
        <p className="border-t border-gray-100 bg-white px-3 py-2.5 text-[10px] leading-relaxed text-gray-400 md:px-5">
          {s.disclaimer}
        </p>
      </div>
    </div>
  );
};

export default RoadmapView;
