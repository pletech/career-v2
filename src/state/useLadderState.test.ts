/**
 * 2水準チェックの包含関係 (v2.9 / 2026-08-06)。
 *
 * `solo` (ひとりでできる) は `assisted` (補助ありでできる) を含む。
 * 片方向だけ繋ぐと「補助ありでは無理だが、ひとりならできる」という状態が作れてしまい、
 * クリア判定 (solo を見る) と画面のチェックが食い違う。
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useLadderState } from './useLadderState';

const ASSISTED_KEY = 'career-ladder-atom-checks:v1';
const SOLO_KEY = 'career-ladder-action-solo-checks:v1';

describe('toggleAction の水準の包含 (AC-12.45)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('1人称 を付けると サポートあり も付く', () => {
    const { result } = renderHook(() => useLadderState());
    act(() => result.current.toggleAction('a1', 'solo'));
    expect(result.current.actionSoloChecks.a1).toBe(true);
    expect(result.current.actionChecks.a1).toBe(true);
  });

  it('サポートあり を外すと 1人称 も外れる — 外しても判定が残っていたバグ', () => {
    const { result } = renderHook(() => useLadderState());
    act(() => result.current.toggleAction('a1', 'solo'));
    act(() => result.current.toggleAction('a1', 'assisted'));
    expect(result.current.actionChecks.a1).toBeUndefined();
    expect(result.current.actionSoloChecks.a1).toBeUndefined();
  });

  it('1人称 だけ外しても サポートあり は残る (下位水準は満たしたまま)', () => {
    const { result } = renderHook(() => useLadderState());
    act(() => result.current.toggleAction('a1', 'solo'));
    act(() => result.current.toggleAction('a1', 'solo'));
    expect(result.current.actionSoloChecks.a1).toBeUndefined();
    expect(result.current.actionChecks.a1).toBe(true);
  });

  it('サポートあり だけ付けても 1人称 は付かない (逆は成り立たない)', () => {
    const { result } = renderHook(() => useLadderState());
    act(() => result.current.toggleAction('a1', 'assisted'));
    expect(result.current.actionChecks.a1).toBe(true);
    expect(result.current.actionSoloChecks.a1).toBeUndefined();
  });

  it('他の項目には波及しない', () => {
    const { result } = renderHook(() => useLadderState());
    act(() => result.current.toggleAction('a1', 'solo'));
    act(() => result.current.toggleAction('a2', 'solo'));
    act(() => result.current.toggleAction('a1', 'assisted'));
    expect(result.current.actionChecks.a2).toBe(true);
    expect(result.current.actionSoloChecks.a2).toBe(true);
  });

  it('両方の水準が localStorage に保存される', () => {
    const { result } = renderHook(() => useLadderState());
    act(() => result.current.toggleAction('a1', 'solo'));
    expect(JSON.parse(window.localStorage.getItem(ASSISTED_KEY) ?? '{}')).toEqual({ a1: true });
    expect(JSON.parse(window.localStorage.getItem(SOLO_KEY) ?? '{}')).toEqual({ a1: true });

    act(() => result.current.toggleAction('a1', 'assisted'));
    expect(JSON.parse(window.localStorage.getItem(ASSISTED_KEY) ?? '{}')).toEqual({});
    expect(JSON.parse(window.localStorage.getItem(SOLO_KEY) ?? '{}')).toEqual({});
  });
});
