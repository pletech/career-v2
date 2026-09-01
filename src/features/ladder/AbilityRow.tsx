import React from 'react';
import type { AbilityEvaluation } from '../../domain/evaluate';
import { deriveAbilityState } from '../../domain/evaluate';
import { STRINGS } from '../../domain/i18n';
import type { Ability } from '../../domain/types';

/**
 * 能力項目1行 (v2.3)
 *
 * 能力の1文 + 派生状態アイコン + 「根拠 n/m」カウンター。
 * 状態は根拠チェック・上長確認から派生した表示であり、ここで選択はしない。
 * 必須/推奨バッジは廃止 (確定 #18)。
 */

interface AbilityRowProps {
  ability: Ability;
  evaluation: AbilityEvaluation;
  selected: boolean;
  onSelect: (abilityId: string) => void;
}

const STATE_ICON: Record<string, { icon: string; className: string }> = {
  'not-started': { icon: '○', className: 'text-gray-300' },
  'in-progress': { icon: '◐', className: 'text-amber-500' },
  'can-do': { icon: '✓', className: 'text-emerald-600' },
  confirmed: { icon: '✓', className: 'text-emerald-700' },
};

const AbilityRow: React.FC<AbilityRowProps> = ({
  ability,
  evaluation,
  selected,
  onSelect,
}) => {
  const state = deriveAbilityState(evaluation);
  const { icon, className } = STATE_ICON[state];
  const s = STRINGS;

  return (
    <button
      type="button"
      onClick={() => onSelect(ability.abilityId)}
      className={[
        'flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left transition-colors',
        selected
          ? 'border-cyan-400 bg-cyan-50'
          : 'border-gray-100 bg-white hover:border-cyan-200 hover:bg-cyan-50/40',
      ].join(' ')}
    >
      <span className={`mt-0.5 w-4 shrink-0 text-center text-sm font-bold ${className}`} aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] leading-snug text-gray-800">
          {ability.statement}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          {state === 'confirmed' && (
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
              ★ {s.stateLabels.confirmed}
            </span>
          )}
          <span className="text-[10px] text-gray-400">{s.stateLabels[state]}</span>
        </span>
      </span>
      <span className="mt-0.5 shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
        {s.evidenceWord} {evaluation.evidenceChecked}/{evaluation.evidenceTotal}
      </span>
    </button>
  );
};

export default AbilityRow;
