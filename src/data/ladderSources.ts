/**
 * 階段ビュー (v2) のデータソース設定 (確定 #24 / #25)
 *
 * コンテンツの値はコードに持たず、外部の CSV を DB として参照する。
 * データは Google スプレッドシート (1ファイルに roles/abilities/evidences/dependencies
 * の4タブ) にあり、各タブを gviz CSV エンドポイントで取得する。
 *
 * スプレッドシートが未公開でも動くよう、取得に失敗したら public/data/ の
 * ローカル CSV にフォールバックする (loadLadderData.ts)。
 *
 * ▼ スプレッドシートを差し替える場合
 *   SHEET_ID と各 gid を変更するだけ。gid は各タブの URL 末尾 (?gid=...) にある。
 *   ※ シートは「リンクを知っている全員: 閲覧者」で共有されている必要がある
 *     (でないと gviz が CSV ではなくログイン用 HTML を返し、ローカルへフォールバックする)。
 */

const base = import.meta.env.BASE_URL;

const SHEET_ID = '1tQhtL-WCryTffG9iOpr2dNsUxsadVwUQ_KP3naJlv8Y';

/** 公開シートを CSV で取得する gviz エンドポイント (CORS 対応) */
const gviz = (gid: string): string =>
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&headers=1&gid=${gid}`;

export interface LadderSourceUrls {
  rolesCsvUrl: string;
  dependenciesCsvUrl: string;
  abilitiesCsvUrl: string;
  evidencesCsvUrl: string;
}

/** 優先: Google スプレッドシート (4タブを gid で指定) */
export const SHEET_SOURCES: LadderSourceUrls = {
  rolesCsvUrl: gviz('1312172290'),
  dependenciesCsvUrl: gviz('2061670704'),
  abilitiesCsvUrl: gviz('1830285706'),
  evidencesCsvUrl: gviz('439744095'),
};

/** フォールバック: ビルドに同梱したローカル CSV */
export const LOCAL_SOURCES: LadderSourceUrls = {
  rolesCsvUrl: `${base}data/roles.csv`,
  dependenciesCsvUrl: `${base}data/dependencies.csv`,
  abilitiesCsvUrl: `${base}data/abilities.csv`,
  evidencesCsvUrl: `${base}data/evidences.csv`,
};
