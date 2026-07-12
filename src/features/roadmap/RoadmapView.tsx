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
 * 業務ロードマップ (v2.6 — 企画書 §0-D / AC-11)
 *
 * 行 = 成長ライン (growth-lines) / 列 = 段階 (役割)。
 * 「同じ業務が段階とともにどう深まるか」の全体像 (森) を見せる閲覧専用ビュー。
 * - 状態は階段ビューと同じ派生ロジック (evaluate) を再利用する
 * - 能力クリック → 階段ビューへ遷移して該当能力を選択 (チェック操作は階段ビューに一元化)
 * - 列ヘッダーは STEP 番号 + 役割名 (AC-11.4b — 列=役割が伝わること)
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

interface RowDef {
  key: string;
  label: string;
  /** roleId -> abilities (sortOrder順) */
  cells: Map<string, Ability[]>;
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
      className="flex w-full items-start gap-1.5 rounded-lg border border-gray-100 bg-white px-2 py-1.5 text-left transition-colors hover:border-cyan-300 hover:bg-cyan-50/40"
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

  const rows = useMemo<RowDef[]>(() => {
    const roleIds = new Set(columns.map((r) => r.roleId));
    const visibleAbilities = abilities.filter((a) => roleIds.has(a.roleId));
    const sortedLines = [...growthLines].sort((a, b) => a.sortOrder - b.sortOrder);

    const build = (match: (a: Ability) => boolean): Map<string, Ability[]> => {
      const cells = new Map<string, Ability[]>();
      for (const a of visibleAbilities) {
        if (!match(a)) continue;
        const list = cells.get(a.roleId);
        if (list) list.push(a);
        else cells.set(a.roleId, [a]);
      }
      for (const list of cells.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);
      return cells;
    };

    const defs: RowDef[] = sortedLines.map((line) => ({
      key: line.lineId,
      label: loc(lang, line.labelJa, line.labelKo),
      cells: build((a) => a.growthLineId === line.lineId),
    }));

    // ライン未配属の能力は「（ラインなし）」行で必ず表示する (AC-11.7)
    const lineIds = new Set(sortedLines.map((l) => l.lineId));
    const noLineCells = build((a) => !a.growthLineId || !lineIds.has(a.growthLineId));
    if (noLineCells.size > 0) {
      defs.push({ key: '__no-line__', label: s.noLine, cells: noLineCells });
    }
    return defs;
  }, [columns, abilities, growthLines, lang, s.noLine]);

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

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-3 pt-3 md:px-5 md:pt-4">
          <p className="text-[11px] leading-relaxed text-gray-500">{s.roadmapLegend}</p>
        </div>

        {/* ============ デスクトップ: マトリクス (md以上) ============ */}
        <div className="hidden px-5 pb-4 pt-3 md:block">
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
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

              {/* データ行 */}
              {rows.map((row) => (
                <React.Fragment key={row.key}>
                  <div className="sticky left-0 z-10 border-b border-r border-gray-100 bg-white px-3 py-2.5">
                    <span className="text-[11.5px] font-bold leading-snug text-gray-700">
                      {row.label}
                    </span>
                  </div>
                  {columns.map((role) => {
                    const cellAbilities = row.cells.get(role.roleId) ?? [];
                    return (
                      <div
                        key={role.roleId}
                        className={`flex flex-col gap-1.5 border-b border-gray-100 px-2 py-2 ${
                          role.status === 'placeholder' ? 'bg-gray-50/50' : ''
                        }`}
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
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* ============ モバイル: ラインごとの縦セクション (AC-11.11) ============ */}
        <div className="flex flex-col gap-4 px-3 pb-4 pt-3 md:hidden">
          {rows.map((row) => (
            <section key={row.key} className="rounded-xl border border-gray-200 bg-white p-3">
              <h3 className="text-[12.5px] font-bold text-gray-800">{row.label}</h3>
              <div className="mt-2 flex flex-col">
                {columns.map((role, i) => {
                  const cellAbilities = row.cells.get(role.roleId) ?? [];
                  if (cellAbilities.length === 0 && role.status === 'placeholder') return null;
                  return (
                    <div key={role.roleId} className="relative pb-3 pl-4 last:pb-0">
                      {/* 縦の接続線 (階段のつながり) */}
                      {i < columns.length - 1 && (
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
