/**
 * 階段ビューの状態管理 (v2.2)
 *
 * - 目標選択 (URLクエリ ?target= に反映: 上長が面談前にリンク共有できる)
 * - 根拠チェック (evidenceId 単位) + 上長確認 (abilityId 単位) — 確定 #13/#17
 * - localStorage 永続化 + JSONエクスポート/インポート (確定 #4)
 *
 * MVP のチェック状態は端末ローカルのみ。サーバー保存・認証は対象外。
 * 旧 v1 形式 (4状態直接記録) のデータは根拠へ写像できないため引き継がない。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ActionCheckMap, EvidenceCheckMap, ManagerConfirmMap, CheckLevel } from '../domain/types';
import { KO_UI_ENABLED } from '../domain/i18n';
import type { Lang } from '../domain/i18n';

const CHECKS_KEY = 'career-ladder-evidence-checks:v2';
const CONFIRMS_KEY = 'career-ladder-manager-confirms:v2';
// キー文字列は v2.7 (旧 atom 呼称) 当時のまま維持 — 変更すると公開サイトの既存チェック状態が失われる
const ACTION_CHECKS_KEY = 'career-ladder-atom-checks:v1';
/**
 * 「1人称 (支援なし) でできる」水準のチェック (v2.9 — 外部レビュー 大場さん提案)。
 *
 * 段階ごとの目安で最下段は「補助・確認してくれる人がいればできる」としたため、
 * 最下段のクリアは「ひとりでできる」を意味しない。上位段階が同じカテゴリを
 * 引き継ぐときは 1 人称で問い直す必要があるが、チェックが項目 ID ごとに 1 つしか
 * 無いと再確認が起きない。そこで水準を 2 段に分ける。
 *
 * **既存キー (ACTION_CHECKS_KEY) は「補助あり」水準として そのまま使う。**
 * これで既存の保存データは意味が変わらずに引き継がれ、移行処理が要らない。
 */
const ACTION_SOLO_CHECKS_KEY = 'career-ladder-action-solo-checks:v1';
/**
 * 推奨資格のチェック (2026-08-07)。
 *
 * 資格は **参考であって判定要件ではない** (AC-12.27 の周辺)。
 * `stageProgress` にも `stat()` にも入れない — 入れた瞬間「資格を取らないと上がれない」
 * という制度になってしまう。持っているものを記録できるだけ。
 */
const CERT_CHECKS_KEY = 'career-ladder-cert-checks:v1';
const LANG_KEY = 'career-ladder-lang:v1';

/** 既定は日本語 (共有時の事故防止 — 確定 #21)。韓国語は作業用 */
function loadLang(): Lang {
  if (!KO_UI_ENABLED) return 'ja';
  try {
    return window.localStorage.getItem(LANG_KEY) === 'ko' ? 'ko' : 'ja';
  } catch {
    return 'ja';
  }
}
const EXPORT_FORMAT = 'career-ladder-check-states';
/**
 * v3 で **業務ロードマップのチェック (`actionChecks` / `actionSoloChecks`) を含めた**。
 *
 * v2 までは全体マップ側の `evidenceChecks` / `managerConfirms` しか書き出しておらず、
 * 今みんなが実際に使っているロードマップのチェックが**1件も入っていなかった**。
 * サーバー保存もログインも意図的に持っていないので、端末が変わると全部消える。
 *
 * v2 のファイルも読める (無い区画は触らない)。**payload に無い区画を空で上書きしない** —
 * 古いファイルを読んだだけでロードマップのチェックが消えるのは事故になる。
 */
const EXPORT_VERSION = 4;
const EXPORT_MIN_VERSION = 2;

export const DEFAULT_TARGET = 'infra-server-sp-4';

interface ExportPayload {
  format: string;
  version: number;
  exportedAt: string;
  evidenceChecks?: EvidenceCheckMap;
  managerConfirms?: ManagerConfirmMap;
  /** 業務ロードマップ: サポートあり水準 (v3〜) */
  actionChecks?: ActionCheckMap;
  /** 業務ロードマップ: 1人称水準 (v3〜) */
  actionSoloChecks?: ActionCheckMap;
  /** 取得済みの推奨資格 (v4〜)。参考情報で、判定には使わない */
  certChecks?: ActionCheckMap;
}

function loadBooleanMap(key: string): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const result: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v === true) result[k] = true;
    }
    return result;
  } catch {
    return {};
  }
}

function sanitizeBooleanMap(raw: unknown): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  if (typeof raw === 'object' && raw !== null) {
    for (const [k, v] of Object.entries(raw)) {
      if (v === true) result[k] = true;
    }
  }
  return result;
}

/**
 * URL の ?target= を読む。役割の実在検証はデータロード後に
 * LadderScreen 側で行う (存在しなければ DEFAULT_TARGET へフォールバック)。
 */
function readTargetFromUrl(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const target = params.get('target');
    if (target) return target;
  } catch {
    /* URL が読めない環境では既定値 */
  }
  return DEFAULT_TARGET;
}

export function useLadderState() {
  const [targetRoleId, setTargetRoleIdRaw] = useState<string>(readTargetFromUrl);
  const [evidenceChecks, setEvidenceChecks] = useState<EvidenceCheckMap>(() =>
    loadBooleanMap(CHECKS_KEY),
  );
  const [managerConfirms, setManagerConfirms] = useState<ManagerConfirmMap>(() =>
    loadBooleanMap(CONFIRMS_KEY),
  );
  const [selectedAbilityId, setSelectedAbilityId] = useState<string | null>(null);
  // v2.7 アクション単位のチェック — 業務ロードマップ用
  const [actionChecks, setActionChecks] = useState<ActionCheckMap>(() =>
    loadBooleanMap(ACTION_CHECKS_KEY),
  );
  const [actionSoloChecks, setActionSoloChecks] = useState<ActionCheckMap>(() =>
    loadBooleanMap(ACTION_SOLO_CHECKS_KEY),
  );
  const [certChecks, setCertChecks] = useState<ActionCheckMap>(() =>
    loadBooleanMap(CERT_CHECKS_KEY),
  );
  const [lang, setLangRaw] = useState<Lang>(loadLang);

  const setLang = useCallback((next: Lang) => {
    setLangRaw(next);
    try {
      window.localStorage.setItem(LANG_KEY, next);
    } catch {
      /* noop */
    }
  }, []);

  // localStorage 永続化
  useEffect(() => {
    try {
      window.localStorage.setItem(CHECKS_KEY, JSON.stringify(evidenceChecks));
    } catch {
      /* プライベートモード等で保存不可の場合は黙って続行 (エクスポートで代替) */
    }
  }, [evidenceChecks]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CONFIRMS_KEY, JSON.stringify(managerConfirms));
    } catch {
      /* 同上 */
    }
  }, [managerConfirms]);

  useEffect(() => {
    try {
      window.localStorage.setItem(ACTION_CHECKS_KEY, JSON.stringify(actionChecks));
    } catch {
      /* 同上 */
    }
  }, [actionChecks]);

  useEffect(() => {
    try {
      window.localStorage.setItem(ACTION_SOLO_CHECKS_KEY, JSON.stringify(actionSoloChecks));
    } catch {
      /* 同上 */
    }
  }, [actionSoloChecks]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CERT_CHECKS_KEY, JSON.stringify(certChecks));
    } catch {
      /* 同上 */
    }
  }, [certChecks]);

  const setTargetRoleId = useCallback((roleId: string) => {
    setTargetRoleIdRaw(roleId);
    setSelectedAbilityId(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('target', roleId);
      window.history.replaceState(null, '', url.toString());
    } catch {
      /* noop */
    }
  }, []);

  /** 根拠のチェックを反転 */
  const toggleEvidence = useCallback((evidenceId: string) => {
    setEvidenceChecks((prev) => {
      const next = { ...prev };
      if (next[evidenceId]) delete next[evidenceId];
      else next[evidenceId] = true;
      return next;
    });
  }, []);

  /**
   * アクションのチェックを反転 (v2.9: 水準を指定する)。
   *
   * `assisted` = 補助・確認してくれる人がいればできる / `solo` = ひとりでできる。
   * **solo ⊃ assisted** — ひとりでできるなら補助ありでも当然できる。
   * この包含を両方向で保つ:
   *
   *   - solo を付ける  → assisted も付ける
   *   - assisted を外す → solo も外す   (2026-08-06 指摘)
   *
   * 下向きを繋がないと「補助ありでは無理だが、ひとりならできる」という
   * ありえない状態が残る。しかも判定は solo を見るので、見た目は外れているのに
   * 上位段階の引き継ぎと知識はクリアのまま — 直前に直した
   * 「押しても数字が動かない」と区別が付かない見え方になる。
   *
   * setter を入れ子で呼ぶが、add/drop はキー単位の冪等操作なので
   * StrictMode の二重実行でも結果は変わらない。
   */
  const toggleAction = useCallback((actionId: string, level: CheckLevel = 'assisted') => {
    const drop = (prev: ActionCheckMap): ActionCheckMap => {
      if (!prev[actionId]) return prev;
      const next = { ...prev };
      delete next[actionId];
      return next;
    };
    const add = (prev: ActionCheckMap): ActionCheckMap =>
      prev[actionId] ? prev : { ...prev, [actionId]: true };

    if (level === 'solo') {
      setActionSoloChecks((prev) => {
        if (prev[actionId]) return drop(prev);
        setActionChecks(add);
        return add(prev);
      });
      return;
    }
    setActionChecks((prev) => {
      if (prev[actionId]) {
        setActionSoloChecks(drop);
        return drop(prev);
      }
      return add(prev);
    });
  }, []);

  /** 取得済みの資格を記録する。**判定には一切使わない** */
  const toggleCert = useCallback((certId: string) => {
    setCertChecks((prev) => {
      const next = { ...prev };
      if (next[certId]) delete next[certId];
      else next[certId] = true;
      return next;
    });
  }, []);

  /** 上長の「面談で確認した」トグル (能力単位) */
  const toggleManagerConfirm = useCallback((abilityId: string) => {
    setManagerConfirms((prev) => {
      const next = { ...prev };
      if (next[abilityId]) delete next[abilityId];
      else next[abilityId] = true;
      return next;
    });
  }, []);

  /** JSONエクスポート: ファイルダウンロード */
  const exportJson = useCallback(() => {
    const payload: ExportPayload = {
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      evidenceChecks,
      managerConfirms,
      actionChecks,
      actionSoloChecks,
      certChecks,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `career-ladder-checks-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [evidenceChecks, managerConfirms, actionChecks, actionSoloChecks, certChecks]);

  /**
   * JSONインポート。成否メッセージ (日本語) を返す。
   * 既存の状態はインポート内容で置き換える。
   */
  const importJson = useCallback(async (file: File): Promise<{ ok: boolean; message: string }> => {
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        (parsed as ExportPayload).format !== EXPORT_FORMAT
      ) {
        return { ok: false, message: 'このファイルはチェック状態のエクスポートファイルではありません。' };
      }
      const payload = parsed as ExportPayload;
      if (
        typeof payload.version !== 'number' ||
        payload.version < EXPORT_MIN_VERSION ||
        payload.version > EXPORT_VERSION
      ) {
        return {
          ok: false,
          message: '対応していない形式のファイルです。新しい形式で再エクスポートしてください。',
        };
      }
      // **ファイルに入っている区画だけを差し替える。** 無い区画を空で上書きすると、
      // v2 のファイルを読んだだけでロードマップのチェックが消える
      const parts: string[] = [];
      if (payload.evidenceChecks) {
        const m = sanitizeBooleanMap(payload.evidenceChecks);
        setEvidenceChecks(m);
        parts.push(`根拠 ${Object.keys(m).length}件`);
      }
      if (payload.managerConfirms) {
        const m = sanitizeBooleanMap(payload.managerConfirms);
        setManagerConfirms(m);
        parts.push(`確認 ${Object.keys(m).length}件`);
      }
      if (payload.actionChecks) {
        const m = sanitizeBooleanMap(payload.actionChecks);
        setActionChecks(m);
        parts.push(`サポートあり ${Object.keys(m).length}件`);
      }
      if (payload.actionSoloChecks) {
        const m = sanitizeBooleanMap(payload.actionSoloChecks);
        setActionSoloChecks(m);
        parts.push(`1人称 ${Object.keys(m).length}件`);
      }
      if (payload.certChecks) {
        const m = sanitizeBooleanMap(payload.certChecks);
        setCertChecks(m);
        parts.push(`資格 ${Object.keys(m).length}件`);
      }
      if (parts.length === 0) {
        return { ok: false, message: 'ファイルにチェック状態が入っていませんでした。' };
      }
      return {
        ok: true,
        message: `チェック状態を読み込みました（${parts.join('・')}）。`
          + (payload.version < EXPORT_VERSION
            ? ' ※旧形式のため、業務ロードマップのチェックはこのファイルに含まれていません。'
            : ''),
      };
    } catch {
      return { ok: false, message: 'ファイルの読み込みに失敗しました。JSONファイルを確認してください。' };
    }
  }, []);

  /**
   * チェック状態を全消去する。
   *
   * **4つのマップすべてを消す。** 以前は全体マップ側 (`evidenceChecks` /
   * `managerConfirms`) だけを消しており、今みんなが実際に使っている
   * 業務ロードマップのチェックが残ったままだった。呼び出し元がまだ無いので
   * 表には出ていないが、リセットボタンを繋いだ瞬間「押しても消えない」になる。
   * エクスポートで同じ取りこぼしをしたのと同じ原因 (v3 で修正済み)。
   *
   * チェックのマップを増やすときは **ここと exportJson / importJson の3か所**を
   * 併せて直すこと。
   */
  const resetStates = useCallback(() => {
    setEvidenceChecks({});
    setManagerConfirms({});
    setActionChecks({});
    setActionSoloChecks({});
    setCertChecks({});
  }, []);

  return useMemo(
    () => ({
      targetRoleId,
      setTargetRoleId,
      evidenceChecks,
      toggleEvidence,
      managerConfirms,
      toggleManagerConfirm,
      actionChecks,
      actionSoloChecks,
      toggleAction,
      certChecks,
      toggleCert,
      selectedAbilityId,
      setSelectedAbilityId,
      lang,
      setLang,
      exportJson,
      importJson,
      resetStates,
    }),
    [
      targetRoleId,
      setTargetRoleId,
      evidenceChecks,
      toggleEvidence,
      managerConfirms,
      toggleManagerConfirm,
      actionChecks,
      actionSoloChecks,
      toggleAction,
      certChecks,
      toggleCert,
      selectedAbilityId,
      setSelectedAbilityId,
      lang,
      setLang,
      exportJson,
      importJson,
      resetStates,
    ],
  );
}
