import React from 'react';
import type { StepEvaluation } from '../../domain/evaluate';
import { STRINGS } from '../../domain/i18n';

/**
 * 段の達成率バー・ゲート表示 (v2.3)
 *
 * UI に見せる数字は「できる n/m」「全体 %」の2つだけ。計算式は出さない。
 * ゲート = 達成率70%以上 → 面談申請の案内 (確定 #16/#18)。
 * 断定表現 (合格/自動判定など) は使用しない (確定 #3)。
 */

interface StepProgressProps {
  evaluation: StepEvaluation;
  /** 折りたたみ時のコンパクト表示 */
  compact?: boolean;
}

const StepProgress: React.FC<StepProgressProps> = ({ evaluation, compact = false }) => {
  const percent = Math.round(evaluation.weightedRate * 100);
  const s = STRINGS;

  if (compact) {
    return (
      <span className="inline-flex items-center gap-2 text-[11px] text-gray-500">
        <span>
          {s.canDoWord} {evaluation.abilityCompleted}/{evaluation.abilityTotal}
        </span>
        <span>
          {s.totalWord} {percent}%
        </span>
        {evaluation.gatePassed && <span className="text-emerald-600">✓</span>}
      </span>
    );
  }

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-[11px] text-gray-500">
        <span>
          {s.canDoWord}{' '}
          <span className="font-semibold text-gray-700">
            {evaluation.abilityCompleted}/{evaluation.abilityTotal}
          </span>
        </span>
        <span>
          {s.totalWord} <span className="font-semibold text-gray-700">{percent}%</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all ${evaluation.gatePassed ? 'bg-emerald-400' : 'bg-cyan-400'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p
        className={`mt-1.5 text-[11px] leading-relaxed ${
          evaluation.gatePassed ? 'font-medium text-emerald-700' : 'text-gray-500'
        }`}
      >
        {evaluation.gatePassed ? s.gatePassed : s.gateNotPassed}
      </p>
    </div>
  );
};

export default StepProgress;
