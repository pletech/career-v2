/**
 * 達成率・派生状態・ゲート判定 (v2.3 — 根拠チェック基盤)
 *
 * UI から分離した純粋関数。テスト: evaluate.test.ts
 *
 * v2.3 の規則 (確定 #18/#19):
 * - 必須/任意の区分は廃止。能力の「できる」派生 = 根拠すべてチェック済み
 * - 上長の「面談で確認した」トグルは根拠チェックと独立して付けられる。
 *   トグル ON の能力は面談確認済みとなり、達成率上も 100% として扱う
 *   (上長確認が根拠チェックを代替する)
 * - 段の達成率 = Σ(能力weight × 実効進捗率) / Σ(weight)
 * - ゲート = 段の達成率 70% 以上 (必須能力条件は削除)
 *
 * ゲートは案件変更・次段階挑戦の「面談申請の目安」であり、
 * 昇格・評価の自動判定ではない (確定 #3/#16)。
 */

import type {
  Ability,
  AbilityState,
  Evidence,
  EvidenceCheckMap,
  ManagerConfirmMap,
} from './types';

export const GATE_TOTAL_RATE_THRESHOLD = 0.7;

// ---------------------------------------------------------------------------
// 能力単位
// ---------------------------------------------------------------------------

export interface AbilityEvaluation {
  /** 根拠総数 */
  evidenceTotal: number;
  /** チェック済み根拠数 */
  evidenceChecked: number;
  /** 根拠チェック率 0〜1 (根拠0件は0) */
  progress: number;
  /** 根拠がすべてチェック済みか */
  allChecked: boolean;
  /** 上長確認トグル */
  managerConfirmed: boolean;
  /** 達成率計算に使う実効進捗率 (上長確認済みなら1.0) */
  effectiveProgress: number;
  /** 完了扱い (全チェック または 上長確認) */
  completed: boolean;
}

export function evaluateAbility(
  evidences: Evidence[],
  checks: EvidenceCheckMap,
  managerConfirmed: boolean,
): AbilityEvaluation {
  const checked = evidences.filter((e) => checks[e.evidenceId] === true).length;
  const progress = evidences.length === 0 ? 0 : checked / evidences.length;
  const allChecked = evidences.length > 0 && checked === evidences.length;
  const completed = allChecked || managerConfirmed;
  return {
    evidenceTotal: evidences.length,
    evidenceChecked: checked,
    progress,
    allChecked,
    managerConfirmed,
    effectiveProgress: managerConfirmed ? 1 : progress,
    completed,
  };
}

/**
 * 能力の派生状態。直接選択は存在しない (確定 #13)。
 * - 面談確認済み: 上長確認トグル ON (根拠チェックと独立 — 確定 #19)
 * - できる:       根拠すべてチェック済み
 * - 経験中:       根拠1件以上チェック
 * - 未着手:       チェック0件
 */
export function deriveAbilityState(evaluation: AbilityEvaluation): AbilityState {
  if (evaluation.managerConfirmed) return 'confirmed';
  if (evaluation.allChecked) return 'can-do';
  return evaluation.evidenceChecked > 0 ? 'in-progress' : 'not-started';
}

// ---------------------------------------------------------------------------
// 段 (役割) 単位
// ---------------------------------------------------------------------------

export interface StepEvaluation {
  /** 能力総数 */
  abilityTotal: number;
  /** 完了 (全チェック または 上長確認) した能力数 */
  abilityCompleted: number;
  /** 重み付き達成率 0〜1 */
  weightedRate: number;
  /** ゲート通過 = 面談申請を案内する目安 (達成率 70% 以上) */
  gatePassed: boolean;
}

export function evaluateStep(
  abilities: Ability[],
  evidencesByAbility: ReadonlyMap<string, Evidence[]>,
  checks: EvidenceCheckMap,
  confirms: ManagerConfirmMap,
): StepEvaluation {
  const evals = abilities.map((a) =>
    evaluateAbility(
      evidencesByAbility.get(a.abilityId) ?? [],
      checks,
      confirms[a.abilityId] === true,
    ),
  );

  const abilityCompleted = evals.filter((e) => e.completed).length;

  const totalWeight = abilities.reduce((sum, a) => sum + a.weight, 0);
  const earnedWeight = abilities.reduce(
    (sum, a, i) => sum + a.weight * evals[i].effectiveProgress,
    0,
  );
  const weightedRate = totalWeight === 0 ? 0 : earnedWeight / totalWeight;

  return {
    abilityTotal: abilities.length,
    abilityCompleted,
    weightedRate,
    gatePassed: abilities.length > 0 && weightedRate >= GATE_TOTAL_RATE_THRESHOLD,
  };
}

// マップ生成ユーティリティ
export function groupEvidencesByAbility(evidences: Evidence[]): Map<string, Evidence[]> {
  const map = new Map<string, Evidence[]>();
  for (const e of evidences) {
    const list = map.get(e.abilityId);
    if (list) list.push(e);
    else map.set(e.abilityId, [e]);
  }
  for (const list of map.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);
  return map;
}
