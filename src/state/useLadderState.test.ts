/**
 * 2水準チェックの包含関係 (v2.9 / 2026-08-06)。
 *
 * `solo` (ひとりでできる) は `assisted` (補助ありでできる) を含む。
 * 片方向だけ繋ぐと「補助ありでは無理だが、ひとりならできる」という状態が作れてしまい、
 * クリア判定 (solo を見る) と画面のチェックが食い違う。
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

/**
 * リセットは4つのマップ全部を消す。ロードマップ側 (assisted / solo) を
 * 消し忘れると、リセットボタンを繋いだときに「押しても消えない」になる。
 */
describe('resetStates', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('業務ロードマップのチェックも消える', () => {
    const { result } = renderHook(() => useLadderState());
    act(() => result.current.toggleAction('a1', 'solo'));
    act(() => result.current.toggleEvidence('e1'));
    act(() => result.current.toggleManagerConfirm('ab1'));

    act(() => result.current.resetStates());

    expect(result.current.actionChecks).toEqual({});
    expect(result.current.actionSoloChecks).toEqual({});
    expect(result.current.evidenceChecks).toEqual({});
    expect(result.current.managerConfirms).toEqual({});
  });

  it('localStorage からも消える', () => {
    const { result } = renderHook(() => useLadderState());
    act(() => result.current.toggleAction('a1', 'solo'));
    act(() => result.current.resetStates());
    expect(JSON.parse(window.localStorage.getItem(ASSISTED_KEY) ?? '{}')).toEqual({});
    expect(JSON.parse(window.localStorage.getItem(SOLO_KEY) ?? '{}')).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// 資格チェックの撤去 (2026-08-14)
// ---------------------------------------------------------------------------
// 2026-08-12 に入れて2日で戻した。資格には有効期限があるので、☑ を持つと
// 期限切れの資格に印が残る = 古くなった時点で嘘になる。
//
// v4 のファイルは**2日ぶんだけ世に出ている**。それを読んだときに黙って
// 落とすと「読み込んだのに資格が消えた」に見えるので、1行だけ断る。

const CERT_KEY = 'career-ladder-cert-checks:v1';

const fileOf = (payload: Record<string, unknown>) =>
  ({ text: async () => JSON.stringify(payload) }) as unknown as File;

const v4WithCerts = {
  format: 'career-ladder-check-states',
  version: 4,
  exportedAt: '2026-08-13T00:00:00.000Z',
  actionChecks: { a1: true },
  certChecks: { 'cert-s1-01': true },
};

describe('資格チェックは持たない', () => {
  beforeEach(() => window.localStorage.clear());

  it('状態として公開しない — 画面から触れる口が無い', () => {
    const { result } = renderHook(() => useLadderState());
    expect('certChecks' in result.current).toBe(false);
    expect('toggleCert' in result.current).toBe(false);
  });

  it('書き出しに含めない', () => {
    const { result } = renderHook(() => useLadderState());
    let written = '';
    const orig = URL.createObjectURL;
    // Blob の中身だけ見たいので createObjectURL を差し替える
    (URL as { createObjectURL: unknown }).createObjectURL = (b: Blob) => {
      void b.text().then((t) => { written = t; });
      return 'blob:test';
    };
    (URL as { revokeObjectURL: unknown }).revokeObjectURL = () => {};
    act(() => { result.current.exportJson(); });
    (URL as { createObjectURL: unknown }).createObjectURL = orig;
    return Promise.resolve().then(() => {
      expect(written).not.toContain('certChecks');
    });
  });

  it('v4 のファイルは読める — 他の区画は落とさない', async () => {
    const { result } = renderHook(() => useLadderState());
    let res: { ok: boolean; message: string } | undefined;
    await act(async () => { res = await result.current.importJson(fileOf(v4WithCerts)); });
    expect(res?.ok).toBe(true);
    expect(result.current.actionChecks).toEqual({ a1: true });
  });

  it('資格が入っていたら、読み込まないと伝える', async () => {
    const { result } = renderHook(() => useLadderState());
    let res: { ok: boolean; message: string } | undefined;
    await act(async () => { res = await result.current.importJson(fileOf(v4WithCerts)); });
    expect(res?.message).toContain('資格は参考表示に変わった');
  });

  it('資格が入っていなければ、その一文は出さない', async () => {
    const { result } = renderHook(() => useLadderState());
    const { certChecks: _drop, ...noCerts } = v4WithCerts;
    let res: { ok: boolean; message: string } | undefined;
    await act(async () => { res = await result.current.importJson(fileOf(noCerts)); });
    expect(res?.message).not.toContain('資格');
  });

  it('読み込んでも旧キーには書き戻さない', async () => {
    const { result } = renderHook(() => useLadderState());
    await act(async () => { await result.current.importJson(fileOf(v4WithCerts)); });
    expect(window.localStorage.getItem(CERT_KEY)).toBeNull();
  });
});

/**
 * 引っ越し告知の帯を出すかどうか (2026-08-15)。
 *
 * 肝は **書き出したあとに増えた分**を拾えるか。書き出しはその時点の控えなので、
 * 「一度出したから大丈夫」で差分を落とすと、その分のチェックは戻せない。
 * 帯は閉じられない代わりに**書き出せば消える**ので、この判定が唯一の出し入れになる。
 */
describe('needsExport — 引っ越し前の書き出し催促', () => {
  beforeEach(() => {
    window.localStorage.clear();
    // jsdom に Blob URL は無い。ここで見たいのは控えの更新だけなので差し替えで足りる
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();
  });

  it('1件もチェックが無い人には出さない', () => {
    const { result } = renderHook(() => useLadderState());
    expect(result.current.needsExport).toBe(false);
  });

  it('チェックがあり、まだ書き出していなければ出す', () => {
    const { result } = renderHook(() => useLadderState());
    act(() => result.current.toggleAction('a1', 'assisted'));
    expect(result.current.needsExport).toBe(true);
  });

  it('書き出せば消える', () => {
    const { result } = renderHook(() => useLadderState());
    act(() => result.current.toggleAction('a1', 'assisted'));
    act(() => result.current.exportJson());
    expect(result.current.needsExport).toBe(false);
  });

  it('書き出したあとに増えたら、また出す — ここを拾えないと差分が消える', () => {
    const { result } = renderHook(() => useLadderState());
    act(() => result.current.toggleAction('a1', 'assisted'));
    act(() => result.current.exportJson());
    act(() => result.current.toggleAction('a2', 'assisted'));
    expect(result.current.needsExport).toBe(true);
  });

  it('控えは開き直しても残る (帯が出っぱなしにならない)', () => {
    const first = renderHook(() => useLadderState());
    act(() => first.result.current.toggleAction('a1', 'assisted'));
    act(() => first.result.current.exportJson());

    const second = renderHook(() => useLadderState());
    expect(second.result.current.needsExport).toBe(false);
  });
});
