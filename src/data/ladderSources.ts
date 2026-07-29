/**
 * データソース設定。
 *
 * コンテンツの値はコードに持たず、CSV を DB として参照する。
 *
 * 2026-07-29: **Google スプレッドシートの参照をやめ、リポジトリ同梱の
 * `public/data/*.csv` に一本化した。** 理由:
 *
 *  - 公開シートは「リンクを知っている全員: 閲覧者」でなければ gviz が動かない。
 *    将来サーバー移設でログインを付けても、データURLだけは公開のままで
 *    ページの認証を迂回してデータだけ取得できてしまう。ファイルなら
 *    同じ認証の後ろに置ける。
 *  - シート編集は push も Actions もローカル確認も経ずに本番へ反映される。
 *    「ローカルで確認してから配信する」運用と両立しない。
 *  - 半期ごとの見直しという運用に、即時反映の価値がほとんどない。
 *  - 誤った編集が即座に全員へ出る (実際に certs.csv の半角カンマで
 *    読み込み失敗事故があり、コミット前だったので助かった)。
 *  - 変更履歴に「なぜ」が残らない。
 *
 * 切り替え前に、シートとローカル CSV の内容が同一であることを確認済み
 * (差分は末尾改行と真偽値の大文字小文字のみ。`toBool` が小文字化するため無影響)。
 *
 * 元シート (アーカイブとして保存。ランタイムでは参照しない):
 *   https://docs.google.com/spreadsheets/d/1tQhtL-WCryTffG9iOpr2dNsUxsadVwUQ_KP3naJlv8Y/
 *   タブ gid: roles=1312172290 / dependencies=2061670704 /
 *             abilities=1830285706 / evidences=439744095
 *
 * ローダーは `url || local` でフォールバックするため、SHEET_SOURCES を
 * 空文字にすればローカル CSV を読む。シート運用へ戻す場合はここに URL を書く。
 */

const base = import.meta.env.BASE_URL;

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
  /** v2.7n: 段階別の推奨資格 (参考)。空ならローカル CSV へフォールバック */
  certsCsvUrl: string;
}

/**
 * 外部シートは使わない (全項目 空文字 → ローカル CSV を読む)。
 * シート運用へ戻す場合のみ、ここに gviz URL を入れる。
 */
export const SHEET_SOURCES: LadderSourceUrls = {
  rolesCsvUrl: '',
  dependenciesCsvUrl: '',
  abilitiesCsvUrl: '',
  evidencesCsvUrl: '',
  growthLinesCsvUrl: '',
  tagsCsvUrl: '',
  weaponsCsvUrl: '',
  actionsCsvUrl: '',
  categoriesCsvUrl: '',
  certsCsvUrl: '',
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
  certsCsvUrl: `${base}data/certs.csv`,
};
