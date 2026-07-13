import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
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
 * 業務ロードマップ (v2.6e — 企画書 §0-D / AC-11)
 *
 * ゲームのスキルツリーのように「下から上へ成長が登っていく」ビュー。
 * - 縦 = 段階: 左軸に STEP1 (最下段) → STEP6 (最上段)。階段ビューと同じ「上が目標」の向き
 * - 横 = 業務の種類 (growth-lines)。左ほど現場実務、右ほど設計など複雑な業務
 * - 能力単位の継承 (growsInto — 人がキュレーション) を矢印で描画。
 *   真の継承関係がある能力だけをつなぎ、後続の無い実務 (アカウント対応など) は
 *   無理につながない。growsInto が未整備のデータではライン単位の矢印にフォールバック
 * - 列ヘッダー (業務の種類) はスクロールしても上部に固定 (sticky)
 *
 * - 状態は階段ビューと同じ派生ロジック (evaluate) を再利用する
 * - 能力クリック → 階段ビューへ遷移して該当能力を選択 (閲覧専用 — AC-11.6)
 * - モバイル: ラインごとの縦セクション (AC-11.11)
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

/** ラインの色 (列順: 添字 0 = 最も現場実務寄り)。Tailwind は静的クラスが必要なため列挙 */
const LINE_COLORS = [
  {
    band: 'bg-cyan-50/70 border-cyan-100',
    dot: 'bg-cyan-500',
    text: 'text-cyan-900',
    arrow: 'text-cyan-400',
    link: 'bg-cyan-200',
    stroke: '#22d3ee',
  },
  {
    band: 'bg-violet-50/70 border-violet-100',
    dot: 'bg-violet-500',
    text: 'text-violet-900',
    arrow: 'text-violet-400',
    link: 'bg-violet-200',
    stroke: '#a78bfa',
  },
  {
    band: 'bg-emerald-50/70 border-emerald-100',
    dot: 'bg-emerald-500',
    text: 'text-emerald-900',
    arrow: 'text-emerald-400',
    link: 'bg-emerald-200',
    stroke: '#34d399',
  },
  {
    band: 'bg-amber-50/70 border-amber-100',
    dot: 'bg-amber-500',
    text: 'text-amber-900',
    arrow: 'text-amber-400',
    link: 'bg-amber-200',
    stroke: '#fbbf24',
  },
] as const;

const NO_LINE_COLOR = {
  band: 'bg-gray-50 border-gray-100',
  dot: 'bg-gray-300',
  text: 'text-gray-500',
  arrow: 'text-gray-300',
  link: 'bg-gray-200',
  stroke: '#d1d5db',
} as const;

type LineColor = (typeof LINE_COLORS)[number] | typeof NO_LINE_COLOR;

interface LineDef {
  key: string;
  label: string;
  color: LineColor;
  /** roleId -> abilities (sortOrder順) */
  cells: Map<string, Ability[]>;
  /** ラインの担当区間 (能力が存在する最小〜最大 stageOrder) */
  minStage: number;
  maxStage: number;
}

interface EdgePath {
  key: string;
  d: string;
  head: string;
  stroke: string;
}

const AbilityCard: React.FC<{
  ability: Ability;
  evaluation: AbilityEvaluation;
  lang: Lang;
  onSelect: (abilityId: string) => void;
  innerRef?: (el: HTMLButtonElement | null) => void;
}> = ({ ability, evaluation, lang, onSelect, innerRef }) => {
  const s = STRINGS[lang];
  const state = deriveAbilityState(evaluation);
  const { icon, className } = STATE_ICON[state];
  return (
    <button
      ref={innerRef}
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

  /** 業務の種類 (列)。左ほど現場実務、右ほど複雑な業務。ラインなしは右端 */
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

  /** 能力単位の継承エッジ (growsInto)。無ければライン単位矢印へフォールバック */
  const abilityEdges = useMemo(() => {
    const strokeOf = new Map<string, string>();
    for (const line of lineDefs) {
      for (const list of line.cells.values()) {
        for (const a of list) strokeOf.set(a.abilityId, line.color.stroke);
      }
    }
    const edges: { from: string; to: string; stroke: string }[] = [];
    for (const a of abilities) {
      for (const to of a.growsInto ?? []) {
        if (!strokeOf.has(a.abilityId) || !strokeOf.has(to)) continue;
        edges.push({ from: a.abilityId, to, stroke: strokeOf.get(a.abilityId) ?? NO_LINE_COLOR.stroke });
      }
    }
    return edges;
  }, [abilities, lineDefs]);

  const hasAbilityEdges = abilityEdges.length > 0;

  // ---------------------------------------------------------------------
  // カードの横位置 (スロット) 計算 — バリセンター整列
  //   1. 親 (下段からの継承元) があるカードは親の x 平均に置く → 矢印が縦にまっすぐ登る
  //   2. 同じ親から分岐する兄弟は親を中心に対称配置 (分岐・合流点は中央揃え)
  //   3. 親は無いが上へつながるカードはその右、どこにもつながらないカードは右端へ
  //   4. 衝突は右へずらして解消し、最後に列全体を左詰めに正規化
  // ---------------------------------------------------------------------
  const SLOT_W = 174; // カード 168px + 間隔 6px
  const slotByAbility = useMemo(() => {
    const parentsOf = new Map<string, string[]>();
    const childCount = new Map<string, number>();
    for (const a of abilities) {
      for (const to of a.growsInto ?? []) {
        parentsOf.set(to, [...(parentsOf.get(to) ?? []), a.abilityId]);
        childCount.set(a.abilityId, (childCount.get(a.abilityId) ?? 0) + 1);
      }
    }

    const result = new Map<string, number>();
    for (const line of lineDefs) {
      const placed = new Map<string, number>();
      // 下の段から順に配置
      for (const role of stepsAsc) {
        const cards = [...(line.cells.get(role.roleId) ?? [])].sort(
          (p, q) => p.sortOrder - q.sortOrder,
        );
        if (cards.length === 0) continue;

        interface Group { start: number; members: Ability[] }
        const groupByKey = new Map<string, { barycenter: number; members: Ability[] }>();
        const noParentLinked: Ability[] = [];
        const isolated: Ability[] = [];

        for (const a of cards) {
          const parents = (parentsOf.get(a.abilityId) ?? []).filter((p) => placed.has(p));
          if (parents.length > 0) {
            const key = [...parents].sort().join('|');
            const g = groupByKey.get(key);
            const barycenter =
              parents.reduce((sum, p) => sum + (placed.get(p) ?? 0), 0) / parents.length;
            if (g) g.members.push(a);
            else groupByKey.set(key, { barycenter, members: [a] });
          } else if ((childCount.get(a.abilityId) ?? 0) > 0) {
            noParentLinked.push(a);
          } else {
            isolated.push(a);
          }
        }

        // 同じ親を持つ兄弟は親 (バリセンター) を中心に対称に広げる
        const groups: Group[] = [...groupByKey.values()]
          .map((g) => ({ start: g.barycenter - (g.members.length - 1) / 2, members: g.members }))
          .sort((p, q) => p.start - q.start);

        let cursor = Number.NEGATIVE_INFINITY;
        for (const g of groups) {
          const start = Math.max(g.start, cursor);
          g.members.forEach((a, i) => placed.set(a.abilityId, start + i));
          cursor = start + g.members.length;
        }
        // 親なし・上へつながる → 配置済みの右隣 / 完全な末端 → さらに右
        for (const a of [...noParentLinked, ...isolated]) {
          const x = cursor === Number.NEGATIVE_INFINITY ? 0 : cursor;
          placed.set(a.abilityId, x);
          cursor = x + 1;
        }
      }
      // 列内で左詰めに正規化
      const values = [...placed.values()];
      const min = values.length > 0 ? Math.min(...values) : 0;
      for (const [id, x] of placed) result.set(id, x - min);
    }
    return result;
  }, [abilities, lineDefs, stepsAsc]);

  // ---------------------------------------------------------------------
  // 矢印の描画 (デスクトップ): カードの実位置を測って SVG オーバーレイに描く
  // ---------------------------------------------------------------------
  const gridWrapRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  const setCardRef = (id: string) => (el: HTMLButtonElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  };
  const [edgePaths, setEdgePaths] = useState<EdgePath[]>([]);

  useLayoutEffect(() => {
    const wrap = gridWrapRef.current;
    // エッジ無しのときは SVG 自体を描画しないため、状態のクリアは不要
    if (!wrap || !hasAbilityEdges) return;
    const measure = () => {
      const wrapRect = wrap.getBoundingClientRect();
      if (wrapRect.width === 0) return; // モバイルでは非表示
      // カードは横並びなので中心同士を素直につなぐ (縦積み時代の横分散は不要)
      const paths: EdgePath[] = [];
      abilityEdges.forEach((e) => {
        const fromEl = cardRefs.current.get(e.from);
        const toEl = cardRefs.current.get(e.to);
        if (!fromEl || !toEl) return;
        const f = fromEl.getBoundingClientRect();
        const t = toEl.getBoundingClientRect();
        const x1 = f.left + f.width / 2 - wrapRect.left;
        const y1 = f.top - wrapRect.top; // 出発 = 下のカードの上辺
        const x2 = t.left + t.width / 2 - wrapRect.left;
        const y2 = t.bottom - wrapRect.top; // 到着 = 上のカードの下辺 (矢印は上向き)
        const my = (y1 + y2) / 2;
        paths.push({
          key: `${e.from}->${e.to}`,
          stroke: e.stroke,
          d: `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2 + 5}`,
          head: `M ${x2} ${y2} l -4 7 h 8 z`,
        });
      });
      setEdgePaths(paths);
    };
    // ResizeObserver は observe 開始時にも一度発火するため、初回測定もここで行われる
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [abilityEdges, hasAbilityEdges, lineDefs, lang]);

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
      <div className="shrink-0 px-3 pt-3 md:px-5 md:pt-4">
        <p className="text-[11px] leading-relaxed text-gray-500">{s.roadmapLegend}</p>
      </div>

      {/* ============ デスクトップ: スキルツリー (md以上) ============ */}
      <div className="hidden min-h-0 flex-1 px-5 pb-3 pt-3 md:block">
        <div className="h-full overflow-auto rounded-xl border border-gray-200 bg-white">
          <div ref={gridWrapRef} className="relative">
            {/* 能力単位の継承矢印 (growsInto) */}
            {hasAbilityEdges && (
              <svg className="pointer-events-none absolute inset-0 z-[5] h-full w-full" aria-hidden>
                {edgePaths.map((p) => (
                  <g key={p.key} opacity={0.75}>
                    <path d={p.d} fill="none" stroke={p.stroke} strokeWidth={1.5} />
                    <path d={p.head} fill={p.stroke} />
                  </g>
                ))}
              </svg>
            )}
            <div
              className="grid min-w-[860px]"
              style={{
                // セル内はカードを横並びにするため、列幅は内容に合わせて広がる (横スクロール許容)。
                // minmax(220px, max-content) は親幅が足りないと max-content まで伸びないため、
                // ベースサイズ自体を max-content にする (最小幅はヘッダーセル側で担保)
                gridTemplateColumns: `120px repeat(${lineDefs.length}, max-content)`,
              }}
            >
              {/* ヘッダー行: 業務の種類 (スクロールしても上部に固定) */}
              <div className="sticky left-0 top-0 z-30 border-b border-r border-gray-200 bg-gray-50 px-3 py-2.5" />
              {lineDefs.map((line) => (
                <div
                  key={line.key}
                  className="sticky top-0 z-20 min-w-[220px] border-b border-gray-200 bg-gray-50 px-2 py-2.5 text-center"
                >
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
                    // growsInto 未整備データ向けフォールバック: ライン単位の上向き矢印
                    const linksUp =
                      !hasAbilityEdges &&
                      inSpan &&
                      role.stageOrder < line.maxStage &&
                      line.key !== '__no-line__';
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
                            {linksUp ? (
                              <div className="flex flex-col items-center" aria-hidden>
                                <span className={`-mb-0.5 text-[11px] leading-none ${line.color.arrow}`}>▲</span>
                                <span className={`h-2.5 w-0.5 rounded ${line.color.link}`} />
                              </div>
                            ) : (
                              <div className="h-3" aria-hidden />
                            )}
                            <div
                              className={`flex flex-1 flex-row items-start rounded-lg border px-1.5 py-1.5 ${line.color.band} ${
                                isSpanTop ? 'rounded-t-xl' : ''
                              } ${isSpanBottom ? 'rounded-b-xl' : ''}`}
                            >
                              {cellAbilities.length === 0 ? (
                                <span className="w-full py-1 text-center text-xs text-gray-300" aria-hidden>
                                  —
                                </span>
                              ) : (
                                // 横並び + バリセンター整列: 継承先の真下に置き、矢印が縦にまっすぐ登る
                                [...cellAbilities]
                                  .sort(
                                    (p, q) =>
                                      (slotByAbility.get(p.abilityId) ?? 0) -
                                      (slotByAbility.get(q.abilityId) ?? 0),
                                  )
                                  .map((a, i, sorted) => {
                                    const slot = slotByAbility.get(a.abilityId) ?? 0;
                                    const prevSlot =
                                      i === 0 ? null : (slotByAbility.get(sorted[i - 1].abilityId) ?? 0);
                                    const marginLeft =
                                      prevSlot === null
                                        ? slot * SLOT_W
                                        : Math.max(0, (slot - prevSlot) * SLOT_W - 168);
                                    return (
                                      <div
                                        key={a.abilityId}
                                        className="w-[168px] shrink-0"
                                        style={{ marginLeft }}
                                      >
                                        <AbilityCard
                                          ability={a}
                                          evaluation={evalOf(a)}
                                          lang={lang}
                                          onSelect={onSelectAbility}
                                          innerRef={setCardRef(a.abilityId)}
                                        />
                                      </div>
                                    );
                                  })
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
      </div>

      {/* ============ モバイル: ラインごとの縦セクション (AC-11.11) ============ */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-3 md:hidden">
        <div className="flex flex-col gap-4">
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
      </div>

      {/* 非断定原則の注意文言 (確定 #3 / AC-11.8) */}
      <p className="shrink-0 border-t border-gray-100 bg-white px-3 py-2.5 text-[10px] leading-relaxed text-gray-400 md:px-5">
        {s.disclaimer}
      </p>
    </div>
  );
};

export default RoadmapView;
