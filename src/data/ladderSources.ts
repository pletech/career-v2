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
  /**
   * 業務ロードマップの成長ライン定義 (v2.6)。
   * 空文字 = このソースにはまだ存在しない (シートにタブを作成したら gid を設定)。
   * 空の場合、ローダーはローカル CSV の growth-lines を代わりに読む。
   */
  growthLinesCsvUrl: string;
  /** v2.7 旧素材→武器モデル (残置・未使用)。growth-lines と同じく、空ならローカル CSV へフォールバック */
  tagsCsvUrl: string;
  weaponsCsvUrl: string;
  /** v2.7m: アクション (旧 atoms)。同じく空ならローカル CSV へフォールバック */
  actionsCsvUrl: string;
  /** v2.7d カテゴリモデル (段階別カテゴリ + 包含) */
  categoriesCsvUrl: string;
}

/** 優先: Google スプレッドシート (タブを gid で指定) */
export const SHEET_SOURCES: LadderSourceUrls = {
  rolesCsvUrl: gviz('1312172290'),
  dependenciesCsvUrl: gviz('2061670704'),
  abilitiesCsvUrl: gviz('1830285706'),
  evidencesCsvUrl: gviz('439744095'),
  // TODO: シートに growth-lines タブを作成したら gviz('<gid>') に置き換える
  growthLinesCsvUrl: '',
  // TODO: シートに tags / actions / weapons タブを作成したら gviz('<gid>') に置き換える (v2.7)
  tagsCsvUrl: '',
  weaponsCsvUrl: '',
  actionsCsvUrl: '',
  categoriesCsvUrl: '',
};

/** フォールバック: ビルドに同梱したローカル CSV */
export const LOCAL_SOURCES: LadderSourceUrls = {
  rolesCsvUrl: `${base}data/roles.csv`,
  dependenciesCsvUrl: `${base}data/dependencies.csv`,
  abilitiesCsvUrl: `${base}data/abilities.csv`,
  evidencesCsvUrl: `${base}data/evidences.csv`,
  growthLinesCsvUrl: `${base}data/growth-lines.csv`,
  tagsCsvUrl: `${base}data/tags.csv`,
  weaponsCsvUrl: `${base}data/weapons.csv`,
  actionsCsvUrl: `${base}data/actions.csv`,
  categoriesCsvUrl: `${base}data/categories.csv`,
};
