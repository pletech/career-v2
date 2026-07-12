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
import type { EvidenceCheckMap, ManagerConfirmMap } from '../domain/types';
import { KO_UI_ENABLED } from '../domain/i18n';
import type { Lang } from '../domain/i18n';

const CHECKS_KEY = 'career-ladder-evidence-checks:v2';
const CONFIRMS_KEY = 'career-ladder-manager-confirms:v2';
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
const EXPORT_VERSION = 2;

export const DEFAULT_TARGET = 'infra-server-sp-4';

interface ExportPayload {
  format: string;
  version: number;
  exportedAt: string;
  evidenceChecks: EvidenceCheckMap;
  managerConfirms: ManagerConfirmMap;
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
  }, [evidenceChecks, managerConfirms]);

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
      if (payload.version !== EXPORT_VERSION) {
        return {
          ok: false,
          message: '旧形式のエクスポートファイルは読み込めません。新しい形式で再エクスポートしてください。',
        };
      }
      const checks = sanitizeBooleanMap(payload.evidenceChecks);
      const confirms = sanitizeBooleanMap(payload.managerConfirms);
      setEvidenceChecks(checks);
      setManagerConfirms(confirms);
      return {
        ok: true,
        message: `チェック状態を読み込みました（根拠 ${Object.keys(checks).length}件・確認 ${Object.keys(confirms).length}件）。`,
      };
    } catch {
      return { ok: false, message: 'ファイルの読み込みに失敗しました。JSONファイルを確認してください。' };
    }
  }, []);

  const resetStates = useCallback(() => {
    setEvidenceChecks({});
    setManagerConfirms({});
  }, []);

  return useMemo(
    () => ({
      targetRoleId,
      setTargetRoleId,
      evidenceChecks,
      toggleEvidence,
      managerConfirms,
      toggleManagerConfirm,
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
