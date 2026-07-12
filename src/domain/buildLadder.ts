/**
 * roles + dependencies + abilities → 階段構造の導出 (v2.2)
 *
 * display は手書きせず、ロード時にここで自動生成する。
 * 能力数・根拠数は固定しない (確定 #15): 配列をそのまま並べるだけで個数非依存。
 */

import type { Ability, Dependency, Role } from './types';

export interface LadderStepData {
  role: Role;
  stepLabel: string;
  abilities: Ability[];
  isTarget: boolean;
  /** placeholder 役割 = チェック項目は準備中 */
  isPlaceholder: boolean;
}

export interface Ladder {
  targetRole: Role;
  /** 下段 (STEP 1) → 上段 (目標) の順 */
  steps: LadderStepData[];
}

/**
 * 目標役割から role-ladder 依存を逆順にたどり、前提役割の連鎖を返す。
 * 戻り値は下段 → 目標の順。
 */
export function buildLadder(
  targetRoleId: string,
  roles: Role[],
  dependencies: Dependency[],
  abilities: Ability[],
): Ladder | null {
  const roleMap = new Map(roles.map((r) => [r.roleId, r]));
  const targetRole = roleMap.get(targetRoleId);
  if (!targetRole) return null;

  const ladderDeps = dependencies.filter((d) => d.depType === 'role-ladder');
  const prereqOf = new Map(ladderDeps.map((d) => [d.toId, d.fromId]));

  const chain: Role[] = [targetRole];
  const visited = new Set<string>([targetRoleId]);
  let current = targetRoleId;
  while (prereqOf.has(current)) {
    const fromId = prereqOf.get(current)!;
    if (visited.has(fromId)) break; // 循環防御
    const role = roleMap.get(fromId);
    if (!role || role.status === 'hidden') break;
    chain.push(role);
    visited.add(fromId);
    current = fromId;
  }
  chain.reverse();

  const steps: LadderStepData[] = chain.map((role) => ({
    role,
    stepLabel: `STEP ${role.stageOrder}`,
    abilities: abilities
      .filter((a) => a.roleId === role.roleId)
      .sort((a, b) => a.sortOrder - b.sortOrder),
    isTarget: role.roleId === targetRoleId,
    isPlaceholder: role.status === 'placeholder',
  }));

  return { targetRole, steps };
}
