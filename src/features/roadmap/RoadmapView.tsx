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
 * 業務ロードマップ (v2.6d — 企画書 §0-D / AC-11)
 *
 * ゲームのスキルツリーのように「下から上へ成長が登っていく」ビュー。
 * - 縦 = 段階: 左軸に STEP1 (最下段) → STEP6 (最上段)。階段ビューと同じ「上が目標」の向き
 * - 横 = 業務の種類 (growth-lines)。基礎的なラインが左、高度なラインが右
 * - 同じラインの能力は、下の段から上の段へ矢印 (▲) でつながる
 *
 * - 状態は階段ビューと同じ派生ロジック (evaluate) を再利用する
 * - 能力クリック → 階段ビューへ遷移して該当能力を選択 (閲覧専用 — AC-11.6)
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

/** ラインの色 (難易度順: 添字 0 = 最も基礎)。Tailwind は静的クラスが必要なため列挙 */
const LINE_COLORS = [
  {
    band: 'bg-cyan-50/70 border-cyan-100',
    dot: 'bg-cyan-500',
    text: 'text-cyan-900',
    arrow: 'text-cyan-400',
    link: 'bg-cyan-200',
  },
  {
    band: 'bg-emerald-50/70 border-emerald-100',
    dot: 'bg-emerald-500',
    text: 'text-emerald-900',
    arrow: 'text-emerald-400',
    link: 'bg-emerald-200',
  },
  {
    band: 'bg-violet-50/70 border-violet-100',
    dot: 'bg-violet-500',
    text: 'text-violet-900',
    arrow: 'text-violet-400',
    link: 'bg-violet-200',
  },
  {
    band: 'bg-amber-50/70 border-amber-100',
    dot: 'bg-amber-500',
    text: 'text-amber-900',
    arrow: 'text-amber-400',
    link: 'bg-amber-200',
  },
] as const;

const NO_LINE_COLOR = {
  band: 'bg-gray-50 border-gray-100',
  dot: 'bg-gray-300',
  text: 'text-gray-500',
  arrow: 'text-gray-300',
  link: 'bg-gray-200',
} as const;

interface LineDef {
  key: string;
  label: string;
  color: (typeof LINE_COLORS)[number] | typeof NO_LINE_COLOR;
  /** roleId -> abilities (sortOrder順) */
  cells: Map<string, Ability[]>;
  /** ラインの担当区間 (能力が存在する最小〜最大 stageOrder) */
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
      className="flex w-full items-start gap-1.5 rounded-lg border border-white/70 bg-white/95 px-2 py-1.5 text-left shadow-sm transition-colors hover:border-cyan-300 hover:bg-white"
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

  /** 段階 昇順 (モバイル・区間計算用)。デスクトップは逆順で「上 = 高い段階」にする */
  const stepsAsc = useMemo(
    () => [...roles].filter((r) => r.status !== 'hidden').sort((a, b) => a.stageOrder - b.stageOrder),
    [roles],
  );
  const stepsDesc = useMemo(() => [...stepsAsc].reverse(), [stepsAsc]);

  /** 業務の種類 (列)。基礎ラインが左、高度なラインが右。ラインなしは右端 */
  const lineDefs = useMemo<LineDef[]>(() => {
    const roleIds = new Set(stepsAsc.map((r) => r.roleId));
    const stageOf = new Map(stepsAsc.map((r) => [r.roleId, r.stageOrder] as const));
    const visibleAbilities = abilities.filter((a) => roleIds.has(a.roleId));
    const sortedLines = [...growthLines].sort((a, b) => a.sortOrder - b.sortOrder);

    const build = (
      key: string,
      label: string,
      color: LineDef['color'],
      match: (a: Ability) => boolean,
    ): LineDef => {
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
      // 能力が1件も無いラインは表示しない (シート移行中に空列が並ぶのを防ぐ)
      .filter((line) => line.cells.size > 0);

    // ライン未配属の能力は「（ラインなし）」列で必ず表示する (AC-11.7)
    const lineIds = new Set(sortedLines.map((l) => l.lineId));
    const noLine = build(
      '__no-line__',
      s.noLine,
      NO_LINE_COLOR,
      (a) => !a.growthLineId || !lineIds.has(a.growthLineId),
    );
    return noLine.cells.size > 0 ? [...defs, noLine] : defs;
  }, [stepsAsc, abilities, growthLines, lang, s.noLine]);

  const evalOf = (a: Ability): AbilityEvaluation =>
    evaluateAbility(
      evidencesByAbility.get(a.abilityId) ?? [],
      evidenceChecks,
      managerConfirms[a.abilityId] === true,
    );

  const stepLabel = (role: Role, block = false) => (
    <div className={block ? '' : 'text-right'}>
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
      <span className="mt-1 block text-[10.5px] font-semibold leading-tight text-gray-600">
        {loc(lang, role.shortLabel, role.shortLabelKo)}
      </span>
    </div>
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-3 pt-3 md:px-5 md:pt-4">
          <p className="text-[11px] leading-relaxed text-gray-500">{s.roadmapLegend}</p>
        </div>

        {/* ============ デスクトップ: スキルツリー (md以上) ============ */}
        <div className="hidden px-5 pb-4 pt-3 md:block">
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <div
              className="grid min-w-[860px]"
              style={{ gridTemplateColumns: `120px repeat(${lineDefs.length}, minmax(200px, 1fr))` }}
            >
              {/* ヘッダー行: 業務の種類 */}
              <div className="sticky left-0 z-10 border-b border-r border-gray-200 bg-gray-50 px-3 py-2.5" />
              {lineDefs.map((line) => (
                <div key={line.key} className="border-b border-gray-200 bg-gray-50 px-2 py-2.5 text-center">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${line.color.dot}`} aria-hidden />
                    <span className={`text-[11.5px] font-bold leading-snug ${line.color.text}`}>
                      {line.label}
                    </span>
                  </span>
                </div>
              ))}

              {/* データ行: 上 = 高い段階 (STEP6) / 下 = 低い段階 (STEP1) */}
              {stepsDesc.map((role) => (
                <React.Fragment key={role.roleId}>
                  <div
                    className={`sticky left-0 z-10 border-b border-r border-gray-100 px-3 py-2.5 ${
                      role.status === 'placeholder' ? 'bg-gray-50/80' : 'bg-white'
                    }`}
                  >
                    {stepLabel(role)}
                  </div>
                  {lineDefs.map((line) => {
                    const cellAbilities = line.cells.get(role.roleId) ?? [];
                    const inSpan =
                      role.stageOrder >= line.minStage && role.stageOrder <= line.maxStage;
                    // このセルの上の段もラインの区間内なら、上へ登る矢印でつなぐ (スキルツリー)
                    const linksUp = inSpan && role.stageOrder < line.maxStage && line.key !== '__no-line__';
                    const isSpanTop = role.stageOrder === line.maxStage;
                    const isSpanBottom = role.stageOrder === line.minStage;
                    return (
                      <div
                        key={line.key}
                        className={`border-b border-gray-100 px-2 ${
                          role.status === 'placeholder' ? 'bg-gray-50/50' : ''
                        }`}
                      >
                        {inSpan ? (
                          <div className="flex h-full flex-col items-stretch">
                            {/* 上の段への接続線 (矢印は上向き = 成長方向) */}
                            {linksUp ? (
                              <div className="flex flex-col items-center" aria-hidden>
                                <span className={`-mb-0.5 text-[11px] leading-none ${line.color.arrow}`}>▲</span>
                                <span className={`h-2.5 w-0.5 rounded ${line.color.link}`} />
                              </div>
                            ) : (
                              <div className="h-3" aria-hidden />
                            )}
                            <div
                              className={`flex flex-1 flex-col gap-1.5 rounded-lg border px-1.5 py-1.5 ${line.color.band} ${
                                isSpanTop ? 'rounded-t-xl' : ''
                              } ${isSpanBottom ? 'rounded-b-xl' : ''}`}
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
                            <div className="h-3" aria-hidden />
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
          {lineDefs.map((line) => (
            <section key={line.key} className="rounded-xl border border-gray-200 bg-white p-3">
              <h3 className="flex items-center gap-1.5 text-[12.5px] font-bold text-gray-800">
                <span className={`h-2 w-2 rounded-full ${line.color.dot}`} aria-hidden />
                {line.label}
              </h3>
              <div className="mt-2 flex flex-col">
                {stepsAsc.map((role, i) => {
                  const cellAbilities = line.cells.get(role.roleId) ?? [];
                  if (cellAbilities.length === 0 && role.status === 'placeholder') return null;
                  const inSpan =
                    role.stageOrder >= line.minStage && role.stageOrder <= line.maxStage;
                  if (!inSpan && cellAbilities.length === 0) return null;
                  return (
                    <div key={role.roleId} className="relative pb-3 pl-4 last:pb-0">
                      {/* 縦の接続線 (階段のつながり) */}
                      {i < stepsAsc.length - 1 && role.stageOrder < line.maxStage && (
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
                      <div className="mb-1">{stepLabel(role, true)}</div>
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
