/**
 * 表示言語 (v2.3 — 確定 #21)
 *
 * 作成・検討作業は韓国語、共有時は日本語に切り替えられるようにする。
 * 既定値は日本語 (共有時の事故防止)。韓国語は作業用の便宜であり、正本は日本語。
 *
 * コンテンツ (役割・能力・根拠・ヒント) の韓国語はシードの *Ko フィールド、
 * 固定文言はこの STRINGS で切り替える。
 */

import type { AbilityState, EvidenceType, WorkTagId } from './types';

export type Lang = 'ja' | 'ko';

/**
 * 韓国語 UI の有効条件: dev サーバー、または VITE_ENABLE_KO=true のビルドのみ。
 * 公開ビルド (GitHub Pages) は日本語のみ — 韓国語はローカル作業用 (確定 #21)
 */
export const KO_UI_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_KO === 'true';

/** 韓国語フィールドがあればそれを、なければ日本語を返す */
export const loc = (lang: Lang, ja: string, ko?: string): string =>
  lang === 'ko' && ko ? ko : ja;

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
  langLabel: string;
  roadmapLegend: string;
  noLine: string;
}

export const STRINGS: Record<Lang, UiStrings> = {
  ja: {
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
    langLabel: '表示言語',
    roadmapLegend:
      '縦 = 段階（下が STEP1）／ 横 = 業務の区分（タグ）。タグを開くと「できると言える」素材が並びます。上の段階では下で身につけた素材が引き継がれ、新たに必要な素材（NEW）だけが増えます。素材の組み合わせが上位の能力（⚔）になります。',
    noLine: '（ラインなし）',
  },
  ko: {
    disclaimer:
      '이 판정은 승격·평가를 자동으로 결정하는 것이 아닙니다. 상장과의 면담에서 육성 상담의 참고 정보입니다.',
    gatePassed:
      '체크리스트 달성률이 기준(70%)에 도달했습니다. 안건 변경이나 다음 단계 도전을 희망하는 경우, 상장과의 면담을 신청해 주세요. (정식 검토는 면담에서 이루어집니다)',
    gateNotPassed: '미확인 항목이 있습니다. 부족한 경험은 상장과의 면담에서 상담해 주세요.',
    stateLabels: {
      'not-started': '미착수',
      'in-progress': '경험 중',
      'can-do': '가능',
      confirmed: '면담 확인 완료',
    },
    typeLabels: { knowledge: '이해', practice: '작업', experience: '경험' },
    evidenceWord: '근거',
    canDoWord: '가능',
    totalWord: '전체',
    managerConfirm: '면담에서 확인함 (상장)',
    managerConfirmNote: '근거 체크 상황과 무관하게 상장 판단으로 표시할 수 있습니다.',
    checklistSection: '가능하다고 말할 수 있는 근거 (체크리스트)',
    nextItemsSection: '다음에 보완할 항목 (앞으로 경험시킬 업무)',
    toolsSection: '참고 도구 (판정 요건이 아닌 대화의 실마리입니다)',
    selectedAbility: '선택 중인 능력',
    stateWord: '상태',
    interviewRef: '육성 면담 참고',
    focusStepPrefix: '지금 확인할 단',
    selectAbilityPrompt: '계단 뷰에서 능력 항목을 선택하면 근거 체크리스트가 여기에 표시됩니다.',
    allDone: '이 단의 능력은 근거가 모두 체크되었습니다.',
    nextItemPrefix: '다음에 보완할 항목',
    othersSuffix: (n) => ` 외 ${n}건`,
    incompleteSection: '확인이 필요한 항목',
    selfCheckLabel: '자가진단 팁',
    roleStatementShow: '원래 역할 문장 표시',
    roleStatementHide: '원래 역할 문장 닫기',
    preparing: '준비 중',
    preparingStep: '이 단계의 체크 항목은 준비 중입니다 (추후 공개 예정)',
    higherSteps: '— 이후의 단계 —',
    kubun: '구분',
    bunrui: '분류',
    targetRole: '목표 역할',
    stagePrefix: '단계',
    preparingNote: '「준비 중」인 역할은 계단의 단으로 표시되지만, 체크 항목은 추후 공개됩니다.',
    langLabel: '표시 언어',
    roadmapLegend:
      '세로 = 단계(아래가 STEP1) / 가로 = 업무의 구분(태그). 태그를 열면 "가능하다고 말할 수 있는" 소재가 나열됩니다. 위 단계에서는 아래에서 익힌 소재가 인계되고, 새로 필요한 소재(NEW)만 늘어납니다. 소재의 조합이 상위 능력(⚔)이 됩니다.',
    noLine: '(라인 없음)',
  },
};

/** 業務種類タグの表示名 (v2.3 — 確定 #18) */
export const WORK_TAG_LABELS: Record<WorkTagId, { ja: string; ko: string }> = {
  inquiry: { ja: '問い合わせ対応', ko: '문의 대응' },
  reporting: { ja: '記録・報告', ko: '기록·보고' },
  procedure: { ja: '手順書作業', ko: '절차서 작업' },
  account: { ja: 'アカウント管理', ko: '계정 관리' },
  kitting: { ja: '端末設定', ko: '단말 설정' },
  monitoring: { ja: '監視', ko: '감시' },
  incident: { ja: '障害対応', ko: '장애 대응' },
  escalation: { ja: 'エスカレーション', ko: '에스컬레이션' },
  investigation: { ja: '原因調査', ko: '원인 조사' },
  log: { ja: 'ログ確認', ko: '로그 확인' },
  config: { ja: '設定変更', ko: '설정 변경' },
  maintenance: { ja: '保守作業', ko: '보수 작업' },
  release: { ja: 'パッチ・リリース', ko: '패치·릴리스' },
  build: { ja: '構築', ko: '구축' },
  middleware: { ja: 'ミドルウェア', ko: '미들웨어' },
  verification: { ja: '動作確認', ko: '동작 확인' },
  'evidence-record': { ja: '証跡', ko: '증적' },
  'design-read': { ja: '設計書読解', ko: '설계서 읽기' },
  'knowledge-base': { ja: '基礎知識', ko: '기초 지식' },
};
