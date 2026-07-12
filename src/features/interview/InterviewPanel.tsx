import React, { useState } from 'react';
import type { LadderStepData } from '../../domain/buildLadder';
import { deriveAbilityState, evaluateAbility } from '../../domain/evaluate';
import { STRINGS, WORK_TAG_LABELS, loc, type Lang } from '../../domain/i18n';
import type {
  Ability,
  Evidence,
  EvidenceCheckMap,
  ManagerConfirmMap,
} from '../../domain/types';
import NextActionList from './NextActionList';

/**
 * 右ペイン: 面談用パネル (v2.3 — 根拠チェックリスト)
 *
 * - 能力選択時: 「できると言える根拠」のチェックリスト + 業務種類タグ + セルフチェックのポイント +
 *   上長確認トグル (根拠チェックと独立に付けられる — 確定 #19)。
 *   4状態を直接選択する UI は存在しない (確定 #13)。
 * - 未選択時: いま確認すべき段のサマリー (未完了の能力 → 次に補う項目)
 */

interface InterviewPanelProps {
  selectedAbility: Ability | null;
  /** 選択中能力の根拠 (階段順) */
  selectedEvidences: Evidence[];
  /** いま確認すべき段 (最下位の未通過段) */
  focusStep: LadderStepData | null;
  evidencesByAbility: ReadonlyMap<string, Evidence[]>;
  evidenceChecks: EvidenceCheckMap;
  managerConfirms: ManagerConfirmMap;
  lang: Lang;
  onToggleEvidence: (evidenceId: string) => void;
  onToggleManagerConfirm: (abilityId: string) => void;
  onSelectAbility: (abilityId: string | null) => void;
}

const sectionLabel = 'text-[11px] font-semibold text-gray-500';

const TYPE_BADGE_CLASS: Record<Evidence['evidenceType'], string> = {
  knowledge: 'bg-sky-50 text-sky-600',
  practice: 'bg-cyan-50 text-cyan-700',
  experience: 'bg-amber-50 text-amber-700',
};

const InterviewPanel: React.FC<InterviewPanelProps> = ({
  selectedAbility,
  selectedEvidences,
  focusStep,
  evidencesByAbility,
  evidenceChecks,
  managerConfirms,
  lang,
  onToggleEvidence,
  onToggleManagerConfirm,
  onSelectAbility,
}) => {
  const [showRoleStatement, setShowRoleStatement] = useState(false);
  const s = STRINGS[lang];

  if (selectedAbility) {
    const confirmed = managerConfirms[selectedAbility.abilityId] === true;
    const evaluation = evaluateAbility(selectedEvidences, evidenceChecks, confirmed);
    const state = deriveAbilityState(evaluation);
    const unchecked = selectedEvidences.filter((ev) => evidenceChecks[ev.evidenceId] !== true);

    return (
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <div className="min-w-0">
            <p className={sectionLabel}>{s.selectedAbility}</p>
            <h3 className="mt-0.5 text-sm font-bold leading-snug text-gray-800">
              {loc(lang, selectedAbility.statement, selectedAbility.statementKo)}
            </h3>
            <p className="mt-1 text-[11px] text-gray-500">
              {s.stateWord}:{' '}
              <span className="font-semibold text-gray-700">{s.stateLabels[state]}</span>
              <span className="ml-2 text-gray-400">
                {s.evidenceWord} {evaluation.evidenceChecked}/{evaluation.evidenceTotal}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => onSelectAbility(null)}
            className="shrink-0 rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-500 hover:bg-gray-50"
          >
            {lang === 'ko' ? '목록으로' : '一覧へ'}
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div>
            <p className={sectionLabel}>{s.checklistSection}</p>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {selectedEvidences.map((ev) => {
                const checked = evidenceChecks[ev.evidenceId] === true;
                return (
                  <li key={ev.evidenceId}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() => onToggleEvidence(ev.evidenceId)}
                      className={[
                        'flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left transition-colors',
                        checked
                          ? 'border-emerald-200 bg-emerald-50/70'
                          : 'border-gray-100 bg-white hover:border-cyan-200 hover:bg-cyan-50/40',
                      ].join(' ')}
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
                          checked
                            ? 'border-emerald-500 bg-emerald-500 text-white'
                            : 'border-gray-300 bg-white text-transparent'
                        }`}
                        aria-hidden
                      >
                        ✓
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block text-xs leading-relaxed ${checked ? 'text-gray-500' : 'text-gray-800'}`}
                        >
                          {loc(lang, ev.statement, ev.statementKo)}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] ${TYPE_BADGE_CLASS[ev.evidenceType]}`}
                          >
                            {s.typeLabels[ev.evidenceType]}
                          </span>
                          {ev.workTags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-600"
                            >
                              {WORK_TAG_LABELS[tag][lang]}
                            </span>
                          ))}
                        </span>
                        {ev.selfCheckTip && (
                          <span className="mt-1 block rounded bg-cyan-50/70 px-2 py-1 text-[10px] leading-relaxed text-cyan-900">
                            ✍ {s.selfCheckLabel}: {loc(lang, ev.selfCheckTip, ev.selfCheckTipKo)}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2.5">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={() => onToggleManagerConfirm(selectedAbility.abilityId)}
                className="h-4 w-4 accent-emerald-600"
              />
              <span className="text-xs font-medium text-gray-700">{s.managerConfirm}</span>
            </label>
            <p className="mt-1 text-[10px] leading-relaxed text-gray-400">{s.managerConfirmNote}</p>
          </div>

          {unchecked.length > 0 && (
            <div>
              <p className={sectionLabel}>{s.nextItemsSection}</p>
              <ul className="mt-1 flex flex-col gap-1">
                {unchecked.map((ev) => (
                  <li key={ev.evidenceId} className="text-xs leading-relaxed text-gray-600">
                    ・{loc(lang, ev.statement, ev.statementKo)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selectedAbility.toolsReference.length > 0 && (
            <div>
              <p className={sectionLabel}>{s.toolsSection}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {selectedAbility.toolsReference.map((tool) => (
                  <span
                    key={tool}
                    className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={() => setShowRoleStatement((v) => !v)}
              className="text-[11px] text-gray-400 underline decoration-dotted hover:text-gray-600"
            >
              {showRoleStatement ? s.roleStatementHide : s.roleStatementShow}
            </button>
            {showRoleStatement && (
              <p className="mt-1 rounded-lg bg-gray-50 px-3 py-2 text-[11px] leading-relaxed text-gray-500">
                {loc(lang, selectedAbility.roleStatement, selectedAbility.roleStatementKo)}
              </p>
            )}
          </div>
        </div>

        <p className="border-t border-gray-100 px-4 py-2.5 text-[10px] leading-relaxed text-gray-400">
          {s.disclaimer}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-100 px-4 py-3">
        <p className={sectionLabel}>{s.interviewRef}</p>
        <h3 className="mt-0.5 text-sm font-bold text-gray-800">
          {focusStep
            ? `${s.focusStepPrefix}: ${focusStep.stepLabel} ${loc(lang, focusStep.role.shortLabel, focusStep.role.shortLabelKo)}`
            : s.selectAbilityPrompt}
        </h3>
        {focusStep?.role.shortGoal && (
          <p className="mt-0.5 text-[11px] text-gray-400">
            {loc(lang, focusStep.role.shortGoal, focusStep.role.shortGoalKo)}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {focusStep ? (
          <NextActionList
            abilities={focusStep.abilities}
            evidencesByAbility={evidencesByAbility}
            evidenceChecks={evidenceChecks}
            managerConfirms={managerConfirms}
            lang={lang}
            onSelectAbility={(id) => onSelectAbility(id)}
          />
        ) : (
          <p className="text-xs leading-relaxed text-gray-400">{s.selectAbilityPrompt}</p>
        )}
      </div>

      <p className="border-t border-gray-100 px-4 py-2.5 text-[10px] leading-relaxed text-gray-400">
        {s.disclaimer}
      </p>
    </div>
  );
};

export default InterviewPanel;
