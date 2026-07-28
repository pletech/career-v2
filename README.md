# Career Path — キャリアパス育成ツール

日本のSES企業向けキャリアパス可視化・育成面談支援アプリ。React + TypeScript 製。

公開URL: **https://pletech.github.io/career-v2/**

> **位置づけ**: 昇格・評価を自動で決めるツールではありません。上長と部下が同じ画面を見ながら「今どこまでできて、次に何を経験すればよいか」を確認する**育成面談の補助ツール**です。

---

## 2つのビュー

アプリは役割の異なる2画面で構成されます（ヘッダーのタブで切り替え）。

| | 業務ロードマップ（既定） | 全体マップ |
|---|---|---|
| 見せるもの | 「何ができるようになればよいか」のチェックリスト | キャリアの地形図（役割とつながり） |
| 答える問い | 次の段階へ行くには今何を埋めるか | どんな道があり、自分はどこにいるか |
| 使う場面 | 実際の育成面談（一緒にチェックする） | 全体の説明・方向相談 |
| 粒度 | 狭く深く（インフラ>サーバー STEP1・2 を行動単位で） | 広く浅く（全職種・全段階を一望） |
| データ | `categories.csv` / `actions.csv` / `certs.csv` | 別スプレッドシートの `nodes` シート + `careerData.ts` |

2つはデータソースが別で内容の粒度も異なるため、全体マップのノード詳細から業務ロードマップへの導線を出しています（整備済みの役割は遷移ボタン、未整備は「準備中」表示）。

---

## 業務ロードマップのモデル（3階層）

```
段階（STEP1 → STEP2 → …）        ← キャリアの階段。上が高度
  └ 業務カテゴリ                  ← その段階で求められる業務の区分（段階ごとに独立した集合）
       ├ 包含した下位カテゴリ      ← 下の段階のカテゴリを丸ごと取り込む（1行ロールアップ）
       └ アクション               ← 「〜できる」1文1概念の行動項目（チェックの単位）
```

### 主要ルール

- **カテゴリは段階ごとに独立**。名前が偶然一致することはあっても、同じカテゴリが段階を貫通するわけではない。
- **上位カテゴリ = 下位段階のカテゴリを丸ごと包含（`includes`）+ その段階固有のアクション**。再帰的な木構造。「この業務ができて初めて上に進める」という考え方。
- **包含した下位カテゴリは1行に畳んで表示**（カテゴリ名 + n/m + 達成バッジ）。押すとその場で展開してチェックできる。
- **その段階で新たに増えるアクションは `NEW` で強調**（差分だけ見れば足りる）。
- **クリア判定 = 達成率7割以上 かつ 包含した下位カテゴリが全てクリア済み**。下位を飛ばして上位だけクリアになることはない。
  - 達成率 = (クリアした下位カテゴリ数 + チェック済みアクション数) / 総項目数
  - 未達なら「クリアまであと◯」、比率は足りていても下位が未クリアなら「下位カテゴリ未クリア」と表示
- **推奨資格は段階単位**（カテゴリ単位ではない）。「次の段階へ進むための参考」として、開いた段階の上部に参考チップで表示。判定要件ではない。
- アコーディオンで**一度に開く段階は1つ**（既定は最下段）。2回目以降の面談用に「未チェックのみ表示」フィルタあり。

### チェック状態

- 保存先は **localStorage**（端末ローカルのみ。サーバー保存・認証は未実装）
- キー: `career-ladder-atom-checks:v1`（Action 改称前の名前を維持。既存データ互換のため）

---

## データ（CSV が DB）

コンテンツの値はコードに持たず、CSV を参照します。Google スプレッドシートの公開CSVを優先し、取得失敗時は同梱のローカルCSVへフォールバックします（`src/data/loadLadderData.ts`）。

### `public/data/` のファイル

| ファイル | 用途 | 主な列 |
|---|---|---|
| `categories.csv` | 段階別の業務カテゴリ | `categoryId` `stage` `labelJa` `labelKo` `includes` `sortOrder` |
| `actions.csv` | アクション（行動項目） | `actionId` `categoryId` `statement` `statementKo` `sortOrder` |
| `certs.csv` | 段階別の推奨資格 | `certId` `stage` `nameJa` `nameKo` `note` `noteKo` `sortOrder` |
| `roles.csv` | 役割（段階の名前・状態） | `roleId` `track` `category` `stageOrder` `titleJa` `shortLabel` `status` … |
| `dependencies.csv` | 段階間の前提関係 | `dependencyId` `fromId` `toId` `depType` |
| `abilities.csv` / `evidences.csv` | 旧「階段ビュー」用（残置・タブ非表示） | — |
| `tags.csv` / `weapons.csv` / `growth-lines.csv` | 旧モデルの残置（未使用） | — |

`includes` のような複数値はパイプ区切り（`A|B|C`）。日本語が正本で、`*Ko` 列は作業用の韓国語併記（公開ビルドでは日本語固定）。

### ローダーの検証

`loadLadderData.ts` は以下を検証し、失敗時は日本語のエラーメッセージ + Retry を表示します。

- 必須ヘッダーの存在 / 型（数値・enum）/ ID重複
- 参照整合性: `action → category`、`category.includes → category`、`ability → role`、`evidence → ability`

> ⚠️ CSV の無引用フィールドに**半角カンマ**を書くと列がずれます（区切り文字扱い）。日本語は `、`、韓国語は `·` を使ってください。

### 編集の流れ

1. **業務ロードマップの内容**（カテゴリ・アクション・資格）→ `public/data/*.csv`（またはスプレッドシートの対応タブ）
2. **全体マップの表示内容** → 別スプレッドシートの `nodes` シート
3. **全体マップの構造・座標・エッジ** → `src/data/careerData.ts`
4. **スプレッドシートの参照先** → `src/data/ladderSources.ts`（ロードマップ）/ `src/data/sheetSources.ts`（全体マップ）

---

## Quick Start

```bash
npm install
npm run dev
```

`http://localhost:5173/career-v2/` を開きます（`vite.config.ts` の `base` が `/career-v2/`）。

```bash
npm run build     # tsc -b && vite build
npm run preview
npm run lint
npm run test      # vitest（ローダーの変換・検証テスト）
```

### 韓国語UI（作業用）

作成・検討作業を韓国語で行うためのトグルがありますが、**dev サーバーまたは `VITE_ENABLE_KO=true` のビルドのみ有効**です。公開ビルドは日本語のみ（共有時の事故防止）。

---

## 整備状況

- ✅ **STEP1（運用監視補助）**: 業務カテゴリ11種を網羅的に整備
- ✅ **STEP2（運用監視・一次対応）**: 業務カテゴリ7種（監視・異常検知 / 障害状況の一次確認 / 初動対応の実施 / 復旧確認・完了処理 / エスカレーション・引き継ぎ / インシデント記録・進行管理 / 定常運用の自立実施）
- 🔜 **STEP3〜6**: 順次拡張予定。UI にも「準備中」と明示
- 参考: 業務項目は厚生労働省の職業分類・IPA iCD・SFIA 9・ITIL と突き合わせて洗い出し

### ロードマップ対応範囲を広げるとき

`src/App.tsx` の `ROADMAP_READY_STAGES` と、`CraftView.tsx` の「STEP3〜6 は順次拡張予定」の文言を併せて更新します（全体マップの「準備中」バナー判定に使われます）。

---

## ファイル構成

```text
public/data/            CSV（コンテンツの実体）
src/
├── components/         全体マップ (React Flow) 系
│   ├── CareerNode.tsx  DetailPanel.tsx  SkillTreeGraph.tsx
│   ├── MobileDetailDrawer.tsx  MobileFilterDrawer.tsx …
├── features/
│   ├── roadmap/
│   │   └── CraftView.tsx      業務ロードマップ本体（カテゴリ/アクション/資格）
│   ├── ladder/
│   │   ├── LadderScreen.tsx   データ読み込み + ビュー切り替えの器
│   │   └── LadderView.tsx …   旧階段ビュー（タブ非表示・残置）
│   ├── interview/  selector/  旧階段ビュー用
├── data/
│   ├── loadLadderData.ts      ロードマップCSVの取得・検証
│   ├── ladderSources.ts       ロードマップのCSV参照先
│   ├── loadCareerDataFromSheets.ts / sheetSources.ts / careerData.ts   全体マップ用
├── domain/
│   ├── types.ts               Category / Action / Cert / Role …
│   ├── i18n.ts                固定文言（ja/ko）
│   ├── evaluate.ts  buildLadder.ts   旧階段ビュー用
├── state/useLadderState.ts    チェック状態・言語・目標選択
├── hooks/useCareerPathState.ts 全体マップの検索・フィルタ
└── App.tsx                    タブ（業務ロードマップ / 全体マップ）
```

`?view=ladder` で旧「階段ビュー」を呼び出せます（タブからは外していますが、STEP3〜4のコンテンツ移行元として残置）。

---

## 全体マップ（旧v1機能）の挙動

- 区分（開発 / インフラ / ITサポート）と分類のタブ切り替え、キーワード検索、パスタイプ（Specialist / Manager / 共通）フィルタ
- ノードをクリックすると右ペイン（モバイルはドロワー）に詳細。**業務ロードマップへの導線バナー付き**
- `Specialist`/`Manager` 選択時も `共通` ノードは表示し、経路が途切れて見えないようにする
- フィルタで選択中ノードが隠れたら選択を自動解除
- 5〜6段階のプレースホルダーは「追って公開予定」のロック表示
- ノードの `id` は `careerData.ts` のローカルノードIDと完全一致が必要（不一致・重複・必須ヘッダー欠落は検証エラー）

---

## ドキュメント

`../docs/` に企画・受け入れ基準・実装メモがあります（ハーネス運用: 企画者 → 開発者 → 検収者）。

| ファイル | 内容 |
|---|---|
| `career-path-v2-plan.md` | 企画書（§0-E がカテゴリ包含モデルの確定事項） |
| `career-path-v2-acceptance-criteria.md` | 受け入れ基準（AC-12 が現行モデル） |
| `career-path-v2-implementation-notes.md` | 実装メモ（変更履歴。最新が先頭） |
| `career-path-v2-review-report.md` | 検収報告 |
| `career-path-status-for-manager-ja.md` | 上長向けの現状サマリ |

---

## 未実装 / 今後

1. **ログイン・アクセス制御**（社内限定公開）— 現在の静的ホスティングでは安全に実装できないため、サーバー移設時に対応
2. アクションのチェック状態のJSONエクスポート/インポート統合
3. STEP3〜6・他職種への拡張
4. 個人別データのサーバー保存

---

## Tech Stack

React 19 / TypeScript / Vite 7 / Tailwind CSS 4 / `@xyflow/react` (React Flow) / Vitest

デプロイは GitHub Actions → GitHub Pages（`main` への push で自動）。
