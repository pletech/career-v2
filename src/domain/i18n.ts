/**
 * 画面に出す文言 (v2.3 — 確定 #21)
 *
 * もともとは「作成・検討は韓国語、共有時は日本語」の切り替えだった。
 * **韓国語は廃止** (2026-08-22 ユーザー指示)。2026-09-02 に呼び出し側まで畳み、
 * `Lang` 型・`KO_UI_ENABLED`・`loc()`・`lang` の受け渡しを全て落とした。
 *
 * 畳むのを待っていたのは、`main` と `draft` が分岐していて対象 16 ファイルのうち
 * 6 つが両方で変わっていたため。先に片方で外すとその 6 つが全部衝突する。
 * 合流 (f40249e) を待ってから一度に外した。
 *
 * ⚠️ CSV の `*Ko` 列と型の `*Ko` フィールドは**残してある**。値は全て空で、
 * 読む側はもう無い。列を落とすのはデータ側の移行なので別件。
 */

import type { AbilityState, EvidenceType, WorkTagId } from './types';

interface UiStrings {
  disclaimer: string;
  gatePassed: string;
  gateNotPassed: string;
  stateLabels: Record<AbilityState, string>;
  typeLabels: Record<EvidenceType, string>;
  evidenceWord: string; // 「根拠」
  canDoWord: string; // 段の達成カウンター「できる」
  totalWord: string; // 「全体」
  managerConfirm: string;
  managerConfirmNote: string;
  checklistSection: string;
  nextItemsSection: string;
  toolsSection: string;
  selectedAbility: string;
  stateWord: string;
  interviewRef: string;
  focusStepPrefix: string;
  selectAbilityPrompt: string;
  allDone: string;
  nextItemPrefix: string;
  othersSuffix: (n: number) => string;
  incompleteSection: string;
  selfCheckLabel: string;
  roleStatementShow: string;
  roleStatementHide: string;
  preparing: string; // 準備中
  preparingStep: string;
  higherSteps: string;
  kubun: string;
  bunrui: string;
  targetRole: string;
  stagePrefix: string; // 段階
  preparingNote: string;
  roadmapLegend: string;
  noLine: string;
}

export const STRINGS: UiStrings = {
  disclaimer:
    'この判定は昇格・評価を自動的に決定するものではありません。上長との面談における育成相談の参考情報です。',
  gatePassed:
    'チェックリストの達成率が基準（70%）に達しています。案件変更や次の段階への挑戦を希望する場合は、上長との面談を申請してください。（正式な検討は面談で行われます）',
  gateNotPassed:
    '未確認の項目があります。不足している経験については、上長との面談で相談してください。',
  stateLabels: {
    'not-started': '未着手',
    'in-progress': '経験中',
    'can-do': 'できる',
    confirmed: '面談確認済み',
  },
  typeLabels: { knowledge: '理解', practice: '作業', experience: '経験' },
  evidenceWord: '根拠',
  canDoWord: 'できる',
  totalWord: '全体',
  managerConfirm: '面談で確認した（上長）',
  managerConfirmNote: '根拠のチェック状況に関わらず、上長の判断で付けられます。',
  checklistSection: 'できると言える根拠（チェックリスト）',
  nextItemsSection: '次に補う項目（今後経験させたい業務）',
  toolsSection: '参考ツール（判定要件ではなく会話の手がかりです）',
  selectedAbility: '選択中の能力',
  stateWord: '状態',
  interviewRef: '育成面談の参考',
  focusStepPrefix: 'いま確認する段',
  selectAbilityPrompt:
    '階段ビューの能力項目を選ぶと、できると言える根拠のチェックリストがここに表示されます。',
  allDone: 'この段の能力は、根拠がすべてチェック済みです。',
  nextItemPrefix: '次に補う項目',
  othersSuffix: (n) => ` ほか${n}件`,
  incompleteSection: '確認が必要な項目',
  selfCheckLabel: 'セルフチェック',
  roleStatementShow: '元の役割文を表示',
  roleStatementHide: '元の役割文を閉じる',
  preparing: '準備中',
  preparingStep: 'この段階のチェック項目は準備中です（後日公開予定）',
  higherSteps: '— この先の段階 —',
  kubun: '区分',
  bunrui: '分類',
  targetRole: '目標役割',
  stagePrefix: '段階',
  preparingNote: '「準備中」の役割は、階段の段として表示されますが、チェック項目は後日公開されます。',
  roadmapLegend:
    '段階の見出しを押すと、その段階の業務カテゴリが開きます（他の段階は畳んで件数のみ）。カテゴリは「何項目中いくつできるか」を示し、7割達成で「クリア」になります。上位段階のカテゴリは、下位段階のカテゴリを1行に畳んで取り込み（押すとその場で展開）、その段階で新たに必要な項目は NEW で強調されます。',
  noLine: '（ラインなし）',
};

/** 業務種類タグの表示名 (v2.3 — 確定 #18) */
export const WORK_TAG_LABELS: Record<WorkTagId, string> = {
  inquiry: '問い合わせ対応',
  reporting: '記録・報告',
  procedure: '手順書作業',
  account: 'アカウント管理',
  kitting: '端末設定',
  monitoring: '監視',
  incident: '障害対応',
  escalation: 'エスカレーション',
  investigation: '原因調査',
  log: 'ログ確認',
  config: '設定変更',
  maintenance: '保守作業',
  release: 'パッチ・リリース',
  build: '構築',
  middleware: 'ミドルウェア',
  verification: '動作確認',
  'evidence-record': '証跡',
  'design-read': '設計書読解',
  'knowledge-base': '基礎知識',
};
