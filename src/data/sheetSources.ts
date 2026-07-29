/**
 * 全体マップ (nodes) のデータソース。
 *
 * 2026-07-29: Google スプレッドシートの公開CSVから、リポジトリ同梱の
 * `public/data/nodes.csv` に切り替えた。理由:
 *
 *  - 公開シートは「リンクを知っている全員が閲覧可」でなければ gviz/pub が動かない。
 *    将来サーバー移設でログインを付けても、データURLだけは公開のままになり
 *    アクセス制御の意味がなくなる。ファイルなら同じ認証の後ろに置ける。
 *  - シート編集は push も Actions もローカル確認も経ずに本番へ反映される。
 *    「ローカルで確認してから配信する」運用と両立しない。
 *  - 半期ごとの見直しという運用に、即時反映の価値がほとんどない。
 *  - 誤った編集が即座に全員へ出る。ファイルならテスト・ビルド・ローカル確認が網になる。
 *
 * 元シート (アーカイブとして保存。ランタイムでは参照しない):
 *   https://docs.google.com/spreadsheets/d/e/2PACX-1vQmxVYnDbPmy4_vXfPGrnGnhn_y7CL-F2kcxOcbqc-e1Gq2oOaGH4xShCB-si0UCts2oKBGFhpyQ06_/pub?gid=29728032&single=true&output=csv
 *
 * 内容を更新するときは `public/data/nodes.csv` を直してコミットする。
 * ノードの構造・座標・エッジは `careerData.ts` 側（このCSVは表示内容のみ）。
 */
export const SHEET_SOURCES = {
  nodesCsvUrl: `${import.meta.env.BASE_URL}data/nodes.csv`,
} as const;
