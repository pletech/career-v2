import React, { useMemo, useState } from 'react';
import type { Ladder } from '../../domain/buildLadder';
import { evaluateStep, type StepEvaluation } from '../../domain/evaluate';
import { STRINGS, loc, type Lang } from '../../domain/i18n';
import type {
  Evidence,
  EvidenceCheckMap,
  ManagerConfirmMap,
  Role,
} from '../../domain/types';
import LadderStep from './LadderStep';

/**
 * 中央ペイン: 階段ビュー (v2.3)
 */

interface LadderViewProps {
  ladder: Ladder;
  /** 目標より上の段階 (同分類・stageOrder が大きい役割)。準備中プレビュー用 */
  higherRoles: Role[];
  evidencesByAbility: ReadonlyMap<string, Evidence[]>;
  evidenceChecks: EvidenceCheckMap;
  managerConfirms: ManagerConfirmMap;
  selectedAbilityId: string | null;
  lang: Lang;
  onSelectAbility: (abilityId: string) => void;
}

const EMPTY_EVAL: StepEvaluation = {
  abilityTotal: 0,
  abilityCompleted: 0,
  weightedRate: 0,
  gatePassed: false,
};

const LadderView: React.FC<LadderViewProps> = ({
  ladder,
  higherRoles,
  evidencesByAbility,
  evidenceChecks,
  managerConfirms,
  selectedAbilityId,
  lang,
  onSelectAbility,
}) => {
  const s = STRINGS[lang];

  const evaluations = useMemo(() => {
    const map = new Map<string, StepEvaluation>();
    for (const step of ladder.steps) {
      map.set(
        step.role.roleId,
        evaluateStep(step.abilities, evidencesByAbility, evidenceChecks, managerConfirms),
      );
    }
    return map;
  }, [ladder, evidencesByAbility, evidenceChecks, managerConfirms]);

  // 既定の折りたたみは初期表示時に一度だけ判定する。
  // 面談中にチェックした瞬間、目の前の段が勝手に閉じてゲート表示が
  // 見えなくなるのを防ぐため (チェックの変化では折りたたみ直さない)。
  // 目標変更時は LadderScreen 側の key で再マウントされ、再判定される。
  const [initialCollapse] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const step of ladder.steps) {
      if (!step.isTarget && !step.isPlaceholder) {
        init[step.role.roleId] = evaluateStep(
          step.abilities,
          evidencesByAbility,
          evidenceChecks,
          managerConfirms,
        ).gatePassed;
      }
    }
    return init;
  });

  // 手動トグルの記録 (roleId -> ユーザー指定の折りたたみ状態)
  const [manualCollapse, setManualCollapse] = useState<Record<string, boolean>>({});

  const isCollapsed = (roleId: string): boolean => {
    if (roleId in manualCollapse) return manualCollapse[roleId];
    return initialCollapse[roleId] ?? false;
  };

  const toggleCollapse = (roleId: string) => {
    setManualCollapse((prev) => ({ ...prev, [roleId]: !isCollapsed(roleId) }));
  };

  // 表示は上段 (目標) → 下段 (STEP 1)
  const displaySteps = [...ladder.steps].reverse();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-3 py-4 md:px-6">
      {higherRoles.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {[...higherRoles]
            .sort((a, b) => b.stageOrder - a.stageOrder)
            .map((role) => (
              <div
                key={role.roleId}
                className="flex items-center gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50/60 px-4 py-2 text-[11px] text-gray-400"
              >
                <span className="shrink-0 font-semibold">STEP {role.stageOrder}</span>
                <span className="truncate">{loc(lang, role.titleJa, role.titleKo)}</span>
                <span className="ml-auto shrink-0 rounded bg-gray-200/70 px-1.5 py-0.5 text-[10px]">
                  {s.preparing}
                </span>
              </div>
            ))}
          <p className="text-center text-[10px] text-gray-300">{s.higherSteps}</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {displaySteps.map((step, i) => (
          <React.Fragment key={step.role.roleId}>
            <LadderStep
              step={step}
              evaluation={evaluations.get(step.role.roleId) ?? EMPTY_EVAL}
              evidencesByAbility={evidencesByAbility}
              evidenceChecks={evidenceChecks}
              managerConfirms={managerConfirms}
              selectedAbilityId={selectedAbilityId}
              lang={lang}
              collapsed={isCollapsed(step.role.roleId)}
              onToggleCollapse={toggleCollapse}
              onSelectAbility={onSelectAbility}
            />
            {i < displaySteps.length - 1 && (
              <div className="flex justify-center text-gray-300" aria-hidden>
                ↑
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      <p className="mt-2 rounded-lg bg-gray-100/80 px-3 py-2 text-center text-[10px] leading-relaxed text-gray-500">
        {s.disclaimer}
      </p>
    </div>
  );
};

export default LadderView;
