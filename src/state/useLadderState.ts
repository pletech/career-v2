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
/*
 * 推奨資格のチェックは **撤去した** (2026-08-14)。2026-08-12 に入れて2日で戻した。
 *
 * 資格には **有効期限がある** (MD-102・SC-300 は1年、CCNA・ITIL4 は3年)。
 * チェックを持つと、期限切れの資格に ☑ が付いたままになる —
 * 「金額は表示しない」と同じ理由で、**古くなった時点で嘘になる**。
 * しかも手当は人事が自分の記録で払うので、このチェックを読む人がどこにもいない。
 *
 * 資格は**参考表示だけ**に戻した。取得期間や手当ランクも出さない —
 * 出せばその数字を保守する責任が発生する (2026-08-14 判断)。
 *
 * ※ 旧キー `career-ladder-cert-checks:v1` は **消さずに放置**する。
 *   2日ぶんの他人の記録を、こちらの都合で消しに行く必要はない。
 */
/**
 * 「いつ・何件の状態で書き出したか」の控え (2026-08-15、引っ越し告知のため)。
 *
 * **チェックそのものではない**ので、消えても失うものは無い (帯がもう一度出るだけ)。
 * 件数まで持つのは、**書き出したあとに続けてチェックした分**を拾うため —
 * 書き出しはその時点の控えなので、「一度出したから安心」で取りこぼす。
 */
const EXPORT_MARK_KEY = 'career-ladder-export-mark:v1';

interface ExportMark {
  at: string;
  /** 書き出した時点のチェック総数。**今と違えば書き出し後に増えている** */
  count: number;
}

function loadExportMark(): ExportMark | null {
  try {
    const raw = window.localStorage.getItem(EXPORT_MARK_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { at, count } = parsed as Partial<ExportMark>;
    if (typeof at !== 'string' || typeof count !== 'number') return null;
    return { at, count };
  } catch {
    return null;
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
  /**
   * 取得済みの推奨資格。**v4 のファイルにだけ入っている** (2026-08-12〜08-14 の2日間)。
   *
   * もう書き出さないし読み込まないが、**型からは消さない** — 消すと
   * 「この区画が来たら何もしない」という判断が読めなくなる。
   * 読み込み時は黙って捨てず、1行だけ断る (`importJson`)。
   */
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

  /** 上長の「面談で確認した」トグル (能力単位) */
  const toggleManagerConfirm = useCallback((abilityId: string) => {
    setManagerConfirms((prev) => {
      const next = { ...prev };
      if (next[abilityId]) delete next[abilityId];
      else next[abilityId] = true;
      return next;
    });
  }, []);

  /**
   * チェックの総数。引っ越し告知の帯を出すかどうかにだけ使う。
   *
   * 4つのマップとも**チェックされた項目だけが鍵として残る** (外すと delete される)
   * ので、鍵の数がそのまま件数になる。
   */
  const checkedCount = useMemo(
    () =>
      Object.keys(evidenceChecks).length +
      Object.keys(managerConfirms).length +
      Object.keys(actionChecks).length +
      Object.keys(actionSoloChecks).length,
    [evidenceChecks, managerConfirms, actionChecks, actionSoloChecks],
  );

  const [exportMark, setExportMark] = useState<ExportMark | null>(loadExportMark);

  /**
   * 「書き出してください」と言う必要があるか。
   *
   * **1件もチェックが無い人には言わない** — 失うものが無いのに警告を出しても
   * 帯が景色になるだけで、本当に必要な人への効き目まで落ちる。
   */
  const needsExport =
    checkedCount > 0 && (exportMark === null || exportMark.count !== checkedCount);

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

    // 出し終えた時点の控え。これで引っ越し告知の帯が消える。
    const mark: ExportMark = { at: new Date().toISOString(), count: checkedCount };
    setExportMark(mark);
    try {
      window.localStorage.setItem(EXPORT_MARK_KEY, JSON.stringify(mark));
    } catch {
      // 控えが残せなくてもファイルは出ている。帯がもう一度出るだけなので握りつぶす
    }
  }, [evidenceChecks, managerConfirms, actionChecks, actionSoloChecks, checkedCount]);

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
      if (parts.length === 0) {
        return { ok: false, message: 'ファイルにチェック状態が入っていませんでした。' };
      }
      /*
        資格のチェックは撤去した (有効期限があり、☑ が古くなると嘘になる)。
        黙って捨てると「読み込んだのに資格が消えた」と見えるので、入っていたら断る。
        **区画の有無だけを見る** — 件数は言わない (もう持っていない値なので)。
      */
      const certsDropped = payload.certChecks !== undefined;
      return {
        ok: true,
        message: `チェック状態を読み込みました（${parts.join('・')}）。`
          + (payload.version < EXPORT_VERSION
            ? ' ※旧形式のため、業務ロードマップのチェックはこのファイルに含まれていません。'
            : '')
          + (certsDropped
            ? ' ※資格は参考表示に変わったため、ファイル内の資格チェックは読み込みません。'
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
      selectedAbilityId,
      setSelectedAbilityId,
      exportJson,
      importJson,
      resetStates,
      needsExport,
    }),
    [
      needsExport,
      targetRoleId,
      setTargetRoleId,
      evidenceChecks,
      toggleEvidence,
      managerConfirms,
      toggleManagerConfirm,
      actionChecks,
      actionSoloChecks,
      toggleAction,
      selectedAbilityId,
      setSelectedAbilityId,
      exportJson,
      importJson,
      resetStates,
    ],
  );
}
