import React from 'react';
import type { LadderStepData } from '../../domain/buildLadder';
import { evaluateAbility, type StepEvaluation } from '../../domain/evaluate';
import { STRINGS, loc, type Lang } from '../../domain/i18n';
import type { Evidence, EvidenceCheckMap, ManagerConfirmMap } from '../../domain/types';
import AbilityRow from './AbilityRow';
import StepProgress from './StepProgress';

/**
 * 階段の1段 (役割) (v2.3)
 */

interface LadderStepProps {
  step: LadderStepData;
  evaluation: StepEvaluation;
  evidencesByAbility: ReadonlyMap<string, Evidence[]>;
  evidenceChecks: EvidenceCheckMap;
  managerConfirms: ManagerConfirmMap;
  selectedAbilityId: string | null;
  lang: Lang;
  collapsed: boolean;
  onToggleCollapse: (roleId: string) => void;
  onSelectAbility: (abilityId: string) => void;
}

const LadderStep: React.FC<LadderStepProps> = ({
  step,
  evaluation,
  evidencesByAbility,
  evidenceChecks,
  managerConfirms,
  selectedAbilityId,
  lang,
  collapsed,
  onToggleCollapse,
  onSelectAbility,
}) => {
  const { role } = step;
  const s = STRINGS[lang];

  return (
    <section
      className={[
        'rounded-xl border bg-white shadow-sm',
        step.isTarget ? 'border-cyan-400 ring-1 ring-cyan-200' : 'border-gray-200',
        step.isPlaceholder ? 'border-dashed opacity-80' : '',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={() => onToggleCollapse(role.roleId)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={!collapsed}
      >
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold tracking-wide text-cyan-700">
              {step.stepLabel}
            </span>
            {step.isTarget && (
              <span className="rounded bg-cyan-100 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-700">
                ★ {lang === 'ko' ? '목표' : '目標'}
              </span>
            )}
            {step.isPlaceholder && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
                {s.preparing}
              </span>
            )}
          </p>
          <h3 className="mt-0.5 truncate text-sm font-bold text-gray-800">
            {loc(lang, role.titleJa, role.titleKo)}
          </h3>
          {role.shortGoal && !collapsed && (
            <p className="mt-0.5 text-[11px] text-gray-400">
              {loc(lang, role.shortGoal, role.shortGoalKo)}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {collapsed && !step.isPlaceholder && (
            <StepProgress evaluation={evaluation} lang={lang} compact />
          )}
          <span className="text-gray-300">{collapsed ? '▸' : '▾'}</span>
        </div>
      </button>

      {!collapsed && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3">
          {step.isPlaceholder ? (
            <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-xs text-gray-400">
              {s.preparingStep}
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                {step.abilities.map((ability) => (
                  <AbilityRow
                    key={ability.abilityId}
                    ability={ability}
                    evaluation={evaluateAbility(
                      evidencesByAbility.get(ability.abilityId) ?? [],
                      evidenceChecks,
                      managerConfirms[ability.abilityId] === true,
                    )}
                    selected={ability.abilityId === selectedAbilityId}
                    lang={lang}
                    onSelect={onSelectAbility}
                  />
                ))}
              </div>
              <StepProgress evaluation={evaluation} lang={lang} />
            </>
          )}
        </div>
      )}
    </section>
  );
};

export default LadderStep;
