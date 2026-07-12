import { describe, expect, it } from 'vitest';
import {
  deriveAbilityState,
  evaluateAbility,
  evaluateStep,
  groupEvidencesByAbility,
} from './evaluate';
import type { Ability, Evidence, EvidenceCheckMap } from './types';

const ability = (id: string, weight = 1): Ability => ({
  abilityId: id,
  roleId: 'test-role',
  statement: '',
  roleStatement: '',
  toolsReference: [],
  weight,
  isCommon: false,
  sortOrder: 0,
});

const evidence = (id: string, abilityId: string): Evidence => ({
  evidenceId: id,
  abilityId,
  statement: '',
  evidenceType: 'practice',
  workTags: ['procedure'],
  sortOrder: 0,
});

describe('evaluateAbility / deriveAbilityState (v2.3)', () => {
  const evs = [evidence('e1', 'a1'), evidence('e2', 'a1'), evidence('e3', 'a1'), evidence('e4', 'a1')];

  it('チェック0件: 未着手・進捗0', () => {
    const r = evaluateAbility(evs, {}, false);
    expect(r.progress).toBe(0);
    expect(r.completed).toBe(false);
    expect(deriveAbilityState(r)).toBe('not-started');
  });

  it('一部チェック: 経験中・進捗は チェック数/総数 の連続値', () => {
    const r = evaluateAbility(evs, { e1: true, e2: true }, false);
    expect(r.progress).toBe(0.5);
    expect(r.completed).toBe(false);
    expect(deriveAbilityState(r)).toBe('in-progress');
  });

  it('全チェック: できる (完了扱い)', () => {
    const r = evaluateAbility(evs, { e1: true, e2: true, e3: true, e4: true }, false);
    expect(r.allChecked).toBe(true);
    expect(r.completed).toBe(true);
    expect(deriveAbilityState(r)).toBe('can-do');
  });

  it('上長確認トグルは根拠チェックと独立に付けられ、面談確認済みになる (確定 #19)', () => {
    const r = evaluateAbility(evs, { e1: true }, true);
    expect(deriveAbilityState(r)).toBe('confirmed');
    expect(r.completed).toBe(true);
  });

  it('上長確認済みの能力は達成率上 100% として扱う', () => {
    const r = evaluateAbility(evs, {}, true);
    expect(r.progress).toBe(0);
    expect(r.effectiveProgress).toBe(1);
  });

  it('根拠0件の能力 (準備中相当): 進捗0・未完了', () => {
    const r = evaluateAbility([], { e1: true }, false);
    expect(r.progress).toBe(0);
    expect(r.completed).toBe(false);
  });
});

describe('evaluateStep (v2.3: ゲート = 達成率70%のみ)', () => {
  const abilities = [ability('a1'), ability('a2')];
  const evidences = [
    evidence('a1-e1', 'a1'),
    evidence('a1-e2', 'a1'),
    evidence('a2-e1', 'a2'),
    evidence('a2-e2', 'a2'),
  ];
  const byAbility = groupEvidencesByAbility(evidences);

  it('チェック0件: 達成率0・ゲート不通過', () => {
    const r = evaluateStep(abilities, byAbility, {}, {});
    expect(r.weightedRate).toBe(0);
    expect(r.gatePassed).toBe(false);
  });

  it('進捗率は根拠チェック比率の加重平均', () => {
    const checks: EvidenceCheckMap = { 'a1-e1': true }; // a1 0.5, a2 0
    const r = evaluateStep(abilities, byAbility, checks, {});
    expect(r.weightedRate).toBe(0.25);
  });

  it('達成率70%以上でゲート通過 (必須能力条件は存在しない — 確定 #18)', () => {
    // a1 全チェック (1.0), a2 半分 (0.5) → 75% ≥ 70%
    const checks: EvidenceCheckMap = { 'a1-e1': true, 'a1-e2': true, 'a2-e1': true };
    const r = evaluateStep(abilities, byAbility, checks, {});
    expect(r.weightedRate).toBe(0.75);
    expect(r.abilityCompleted).toBe(1);
    expect(r.gatePassed).toBe(true);
  });

  it('69%はゲート不通過', () => {
    // 重み 1:1, a1 全 (1.0), a2 0/2 → 50%
    const checks: EvidenceCheckMap = { 'a1-e1': true, 'a1-e2': true };
    const r = evaluateStep(abilities, byAbility, checks, {});
    expect(r.weightedRate).toBe(0.5);
    expect(r.gatePassed).toBe(false);
  });

  it('上長確認は達成率に 100% として効く', () => {
    // a1 未チェックだが確認済み (1.0), a2 半分 (0.5) → 75%
    const checks: EvidenceCheckMap = { 'a2-e1': true };
    const r = evaluateStep(abilities, byAbility, checks, { a1: true });
    expect(r.weightedRate).toBe(0.75);
    expect(r.abilityCompleted).toBe(1);
    expect(r.gatePassed).toBe(true);
  });

  it('重みが達成率に反映される', () => {
    const items = [ability('a1', 3), ability('a2', 1)];
    const evs = [evidence('a1-e1', 'a1'), evidence('a2-e1', 'a2')];
    const map = groupEvidencesByAbility(evs);
    const r = evaluateStep(items, map, { 'a1-e1': true }, {});
    expect(r.weightedRate).toBe(0.75); // 3/4
  });

  it('能力0件 (準備中の段) はゲート不通過', () => {
    const r = evaluateStep([], new Map(), {}, {});
    expect(r.gatePassed).toBe(false);
    expect(r.weightedRate).toBe(0);
  });
});
