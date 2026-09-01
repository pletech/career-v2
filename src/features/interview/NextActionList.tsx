import React from 'react';
import { evaluateAbility } from '../../domain/evaluate';
import { STRINGS } from '../../domain/i18n';
import type {
  Ability,
  Evidence,
  EvidenceCheckMap,
  ManagerConfirmMap,
} from '../../domain/types';

/**
 * 未完了の能力 → 次に補う項目の候補 (v2.3)
 *
 * 各能力の未チェック根拠が、そのまま「今後経験させたい業務」の候補になる。
 * 面談の締めに「次に何を経験させるか」をこのリストから合意することを狙う。
 */

interface NextActionListProps {
  abilities: Ability[];
  evidencesByAbility: ReadonlyMap<string, Evidence[]>;
  evidenceChecks: EvidenceCheckMap;
  managerConfirms: ManagerConfirmMap;
  onSelectAbility: (abilityId: string) => void;
}

const NextActionList: React.FC<NextActionListProps> = ({
  abilities,
  evidencesByAbility,
  evidenceChecks,
  managerConfirms,
  onSelectAbility,
}) => {
  const s = STRINGS;

  const incomplete = abilities
    .map((ability) => {
      const evidences = evidencesByAbility.get(ability.abilityId) ?? [];
      const evaluation = evaluateAbility(
        evidences,
        evidenceChecks,
        managerConfirms[ability.abilityId] === true,
      );
      const unchecked = evidences.filter((ev) => evidenceChecks[ev.evidenceId] !== true);
      return { ability, evaluation, unchecked };
    })
    .filter((x) => !x.evaluation.completed);

  if (incomplete.length === 0) {
    return <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{s.allDone}</p>;
  }

  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-500">{s.incompleteSection}</p>
      <ul className="mt-1.5 flex flex-col gap-1.5">
        {incomplete.map(({ ability, evaluation, unchecked }) => (
          <li key={ability.abilityId}>
            <button
              type="button"
              onClick={() => onSelectAbility(ability.abilityId)}
              className="w-full rounded-lg border border-gray-100 bg-white px-3 py-2 text-left text-xs leading-relaxed text-gray-700 hover:border-cyan-200 hover:bg-cyan-50/40"
            >
              <span className="flex items-start justify-between gap-2">
                <span className="font-medium text-gray-800">
                  {ability.statement}
                </span>
                <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                  {s.evidenceWord} {evaluation.evidenceChecked}/{evaluation.evidenceTotal}
                </span>
              </span>
              {unchecked[0] && (
                <span className="mt-1 block text-[11px] text-gray-500">
                  {s.nextItemPrefix}: {unchecked[0].statement}
                  {unchecked.length > 1 && s.othersSuffix(unchecked.length - 1)}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default NextActionList;
