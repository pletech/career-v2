import { describe, expect, it } from 'vitest';
import {
  parseAbilities,
  parseActions,
  parseCategories,
  parseCerts,
  parseDependencies,
  parseEvidences,
  parseGrowthLines,
  parseRoles,
  parseTags,
  parseWeapons,
  validateReferences,
  type LadderDataSet,
} from './loadLadderData';

const rolesCsv = [
  'roleId,track,category,stageOrder,pathType,titleJa,shortLabel,summary,status,shortGoal',
  'r1,infrastructure,サーバー,1,common,運用監視補助,補助,要約,published,目標',
  'r2,infrastructure,サーバー,2,specialist,運用監視,監視,,placeholder,',
].join('\n');

const depsCsv = [
  'dependencyId,fromId,toId,depType,gateRule,note',
  'd1,r1,r2,role-ladder,,メモ',
].join('\n');

const abilitiesCsv = [
  'abilityId,roleId,statement,roleStatement,toolsReference,weight,isCommon,commonGroupId,sortOrder,growthLineId',
  'a1,r1,問い合わせを受け付け、連携できる,役割文,Outlook|Teams,1,true,grp-1,1,response',
].join('\n');

const growthLinesCsv = [
  'lineId,labelJa,sortOrder',
  'response,依頼・障害対応,1',
  'execution,作業実施（手順書→設計書）,2',
].join('\n');

const evidencesCsv = [
  'evidenceId,abilityId,statement,evidenceType,workTags,selfCheckTip,sortOrder',
  'a1-e1,a1,要点を記録できる,practice,inquiry|reporting,説明できますか？,1',
  'a1-e2,a1,経験がある,experience,inquiry,,2',
].join('\n');

// v2.7 素材→武器モデル
const tagsCsv = [
  'tagId,labelJa,sortOrder',
  'inquiry,問い合わせ対応,1',
  'reporting,記録・報告,2',
].join('\n');

const actionsCsv = [
  'actionId,categoryIds, statement,sortOrder,kind',
  'at1,c1-inquiry,問い合わせを受け付けられる,1,practice',
  'at2,c1-reporting,要点を記録できる,1,practice',
  'at3,c2-triage,発報内容を照合できる,1,knowledge',
].join('\n');

const weaponsCsv = [
  'weaponId,roleId,tagId,statement,composedOf,sortOrder',
  'w1,r2,inquiry,障害の概要を整理できる,at1|at2|at3,1',
].join('\n');

// v2.7d カテゴリモデル
const categoriesCsv = [
  'categoryId,track,subtrack,stage,labelJa,includes,sortOrder',
  'c1-inquiry,infrastructure,サーバー,1,問い合わせ対応,,1',
  'c1-reporting,infrastructure,サーバー,1,記録・報告,,2',
  'c2-triage,infrastructure,サーバー,2,監視・一次対応,c1-inquiry|c1-reporting,1',
].join('\n');

// v2.7n 推奨資格
const certsCsv = [
  'certId,track,subtrack,stage,nameJa,note,sortOrder',
  'cert-1,infrastructure,サーバー,1,ITパスポート,基礎,1',
  'cert-2,infrastructure,サーバー,2,CCNA,,1',
].join('\n');

/** validateReferences 用のフルデータセットを組み立てる */
function buildDataSet(over: Partial<LadderDataSet> = {}): LadderDataSet {
  return {
    roles: parseRoles(rolesCsv),
    dependencies: parseDependencies(depsCsv),
    abilities: parseAbilities(abilitiesCsv),
    evidences: parseEvidences(evidencesCsv),
    growthLines: parseGrowthLines(growthLinesCsv),
    tags: parseTags(tagsCsv),
    actions: parseActions(actionsCsv),
    weapons: parseWeapons(weaponsCsv),
    categories: parseCategories(categoriesCsv),
    certs: parseCerts(certsCsv),
    ...over,
  };
}

describe('loadLadderData の CSV 変換 (CSV が DB — 確定 #24)', () => {
  it('roles: 型変換と任意項目の undefined 化', () => {
    const roles = parseRoles(rolesCsv);
    expect(roles).toHaveLength(2);
    expect(roles[0]).toMatchObject({
      roleId: 'r1',
      track: 'infrastructure',
      stageOrder: 1,
      status: 'published',
    });
    expect(roles[1].shortGoal).toBeUndefined();
  });

  it('abilities: パイプ区切りツール・boolean 変換・引用符付きカンマ', () => {
    const abilities = parseAbilities(abilitiesCsv);
    expect(abilities[0].toolsReference).toEqual(['Outlook', 'Teams']);
    expect(abilities[0].isCommon).toBe(true);
    expect(abilities[0].statement).toBe('問い合わせを受け付け、連携できる');
  });

  it('evidences: workTags の検証つき変換・任意 selfCheckTip', () => {
    const evidences = parseEvidences(evidencesCsv);
    expect(evidences[0].workTags).toEqual(['inquiry', 'reporting']);
    expect(evidences[1].selfCheckTip).toBeUndefined();
  });

  it('不正な workTags はエラー', () => {
    const bad = evidencesCsv.replace('inquiry|reporting', 'unknown-tag');
    expect(() => parseEvidences(bad)).toThrow(/workTags/);
  });

  it('必要列の欠落はエラー', () => {
    expect(() => parseRoles('roleId,track\nr1,infrastructure')).toThrow(/必要な列/);
  });

  it('ID 重複はエラー', () => {
    const dup = abilitiesCsv + '\n' + abilitiesCsv.split('\n')[1];
    expect(() => parseAbilities(dup)).toThrow(/重複/);
  });

  it('参照整合性: evidence が存在しない ability を参照するとエラー', () => {
    const data = buildDataSet({
      evidences: parseEvidences(evidencesCsv.replace(/a1,/g, 'aX,').replace('a1-e1,aX', 'a1-e1,aX')),
    });
    expect(() => validateReferences(data)).toThrow(/abilityId/);
  });

  it('参照整合性: 正常データは通過', () => {
    expect(() => validateReferences(buildDataSet())).not.toThrow();
  });

  it('参照整合性: hidden の役割にぶら下がるカテゴリは落とさない', () => {
    // 公開前の職種は roles.csv を `hidden` にして選択肢から外す。その時
    // 配下のカテゴリまで「役割と一致しない」で落ちると、**データを持っている
    // のに読み込みごと死ぬ**。表示の絞り込みは画面側の仕事 (2026-09-02)
    // **そのルートの役割を全部**隠す。1つでも残っているとルートが生き、
    // 検査が通ってしまって規則を試したことにならない
    const hidden = rolesCsv.replace(',published,', ',hidden,').replace(',placeholder,', ',hidden,');
    expect(hidden.split(',hidden,').length - 1).toBe(2);
    expect(() => validateReferences(buildDataSet({ roles: parseRoles(hidden) }))).not.toThrow();
  });

  it('参照整合性: 綴りが違うカテゴリは hidden があっても落ちる', () => {
    // hidden を通すようにしたせいで綴り間違いまで通ってしまう、を防ぐ
    const data = buildDataSet({
      categories: parseCategories(categoriesCsv.replace(/,サーバー,/g, ',サーバ,')),
    });
    expect(() => validateReferences(data)).toThrow(/track\/subtrack/);
  });

  // ------------------------------------------------------------------
  // 業務ロードマップ (v2.6 — AC-11.1/11.2/AC-11.12)
  // ------------------------------------------------------------------

  it('growth-lines: 型変換', () => {
    const lines = parseGrowthLines(growthLinesCsv);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ lineId: 'response', labelJa: '依頼・障害対応', sortOrder: 1 });
  });

  it('growth-lines: lineId 重複はエラー', () => {
    const dup = growthLinesCsv + '\n' + growthLinesCsv.split('\n')[1];
    expect(() => parseGrowthLines(dup)).toThrow(/重複/);
  });

  it('abilities: growthLineId は任意 (空なら undefined = ラインなし)', () => {
    const noLine = parseAbilities(abilitiesCsv.replace(',1,response', ',1,'));
    expect(noLine[0].growthLineId).toBeUndefined();
    // 列自体が無い旧フォーマットも許容 (シート移行中)
    const legacy = parseAbilities(
      abilitiesCsv
        .replace(',sortOrder,growthLineId', ',sortOrder')
        .replace(',1,response', ',1'),
    );
    expect(legacy[0].growthLineId).toBeUndefined();
  });

  it('参照整合性: growthLineId が growth-lines に無いとエラー (AC-11.2)', () => {
    const data = buildDataSet({
      abilities: parseAbilities(abilitiesCsv.replace(',1,response', ',1,unknown-line')),
    });
    expect(() => validateReferences(data)).toThrow(/growthLineId/);
  });

  it('abilities: growsInto はパイプ区切りで変換され、列が無ければ空 (v2.6e)', () => {
    const header =
      'abilityId,roleId,statement,roleStatement,toolsReference,weight,isCommon,commonGroupId,sortOrder,growthLineId,growsInto';
    const withEdges = [
      header,
      'a1,r1,文,役,,1,false,,1,response,a2|a3',
      'a2,r1,文,役,,1,false,,2,response,',
      'a3,r1,文,役,,1,false,,3,response,',
    ].join('\n');
    const parsed = parseAbilities(withEdges);
    expect(parsed[0].growsInto).toEqual(['a2', 'a3']);
    expect(parsed[1].growsInto).toEqual([]);
    // 列自体が無い旧フォーマット
    expect(parseAbilities(abilitiesCsv)[0].growsInto).toEqual([]);
  });

  it('参照整合性: growsInto が存在しない能力を参照するとエラー (v2.6e)', () => {
    const header =
      'abilityId,roleId,statement,roleStatement,toolsReference,weight,isCommon,commonGroupId,sortOrder,growthLineId,growsInto';
    const data = buildDataSet({
      abilities: parseAbilities([header, 'a1,r1,文,役,,1,false,,1,response,aX'].join('\n')),
    });
    expect(() => validateReferences(data)).toThrow(/growsInto/);
  });
  // ------------------------------------------------------------------
  // カテゴリモデル (v2.7d)
  // ------------------------------------------------------------------

  it('categories/actions: 型変換 (v2.7d)', () => {
    const cats = parseCategories(categoriesCsv);
    expect(cats).toHaveLength(3);
    expect(cats[2]).toMatchObject({ categoryId: 'c2-triage', stage: 2 });
    expect(cats[2].includes).toEqual(['c1-inquiry', 'c1-reporting']);
    const actions = parseActions(actionsCsv);
    expect(actions[2]).toMatchObject({ actionId: 'at3', categoryIds: ['c2-triage'] });
  });

  it('参照整合性: action の categoryId が categories に無いとエラー (v2.7d)', () => {
    const data = buildDataSet({
      actions: parseActions(actionsCsv.replace('at1,c1-inquiry', 'at1,unknown-cat')),
    });
    expect(() => validateReferences(data)).toThrow(/categoryId/);
  });

  it('参照整合性: category の includes が存在しないカテゴリを参照するとエラー (v2.7d)', () => {
    const data = buildDataSet({
      categories: parseCategories(categoriesCsv.replace('c1-inquiry|c1-reporting', 'c1-inquiry|c-x')),
    });
    expect(() => validateReferences(data)).toThrow(/includes/);
  });

  it('certs: 型変換と段階・任意 note (v2.7n)', () => {
    const certs = parseCerts(certsCsv);
    expect(certs).toHaveLength(2);
    expect(certs[0]).toMatchObject({ certId: 'cert-1', stage: 1, nameJa: 'ITパスポート' });
    expect(certs[0].note).toBe('基礎');
    expect(certs[1].note).toBeUndefined();
  });

  it('参照整合性: weapon の composedOf が存在しない素材を参照するとエラー (残置)', () => {
    const data = buildDataSet({
      weapons: parseWeapons(weaponsCsv.replace('at1|at2|at3', 'at1|atX')),
    });
    expect(() => validateReferences(data)).toThrow(/composedOf/);
  });
});

/**
 * 職種 (track) は必須で、値も検査する (v2.15)。
 *
 * 綴り違いを黙って通すと、その行はどの職種にも属さず**画面から静かに消える**。
 * 段階番号の意味は職種ごとに違うので、混ざるとクリア比率まで狂う (HANDOFF §4b)。
 */
describe('categories / certs の track (v2.15)', () => {
  it('track を読む', () => {
    expect(parseCategories(categoriesCsv)[0].track).toBe('infrastructure');
    expect(parseCerts(certsCsv)[0].track).toBe('infrastructure');
  });

  it('track の列が無ければエラー', () => {
    const csv = ['categoryId,stage,labelJa,sortOrder', 'c1,1,問い合わせ,1'].join('\n');
    expect(() => parseCategories(csv)).toThrow(/track/);
  });

  it('track が空ならエラー', () => {
    const csv = ['categoryId,track,subtrack,stage,labelJa,sortOrder', 'c1,,1,問い合わせ,1'].join('\n');
    expect(() => parseCategories(csv)).toThrow(/track/);
  });

  it('綴り違いを黙って通さない', () => {
    const csv = ['categoryId,track,subtrack,stage,labelJa,sortOrder', 'c1,it-suport,1,問い合わせ,1'].join('\n');
    expect(() => parseCategories(csv)).toThrow(/it-support/);
  });

  it('certs も同じ', () => {
    const csv = ['certId,track,subtrack,stage,nameJa,sortOrder', 'x,infra,1,ITパスポート,1'].join('\n');
    expect(() => parseCerts(csv)).toThrow(/track/);
  });
});

describe('分類 (subtrack) の検証 (2026-08-15)', () => {
  const roles =
    'roleId,track,category,stageOrder,pathType,titleJa,shortLabel,status\n'
    + 'r1,it-support,ヘルプデスク系,1,manager,HD,HD,published\n'
    + 'r2,it-support,事務系,1,manager,事務,事務,published\n';
  const cat = (subtrack: string) =>
    'categoryId,track,subtrack,stage,labelJa,sortOrder\n'
    + `c1,it-support,${subtrack},1,受付,1\n`;

  it('subtrack の列が無ければエラー', () => {
    expect(() => parseCategories('categoryId,track,stage,labelJa,sortOrder\nc1,it-support,1,受付,1\n'))
      .toThrow(/subtrack/);
  });

  it('subtrack が空ならエラー', () => {
    expect(() => parseCategories(cat(''))).toThrow(/subtrack/);
  });

  it('certs も同じ', () => {
    expect(() => parseCerts('certId,track,stage,nameJa,sortOrder\nx1,it-support,1,MOS,1\n'))
      .toThrow(/subtrack/);
  });

  /*
    綴り違いは**ここで落とさないと画面から静かに消える**。
    `ヘルプデスク系` を `ヘルプデスク` と書くと、そのルートは roles.csv に無いので
    どのルートでも表示されず、エラーも警告も出ない。
  */
  const dataWith = (subtrack: string) => ({
    roles: parseRoles(roles),
    dependencies: [], abilities: [], evidences: [], growthLines: [], tags: [], weapons: [],
    categories: parseCategories(cat(subtrack)),
    actions: [], certs: [],
  });

  it('roles.csv にある組み合わせなら通る', () => {
    expect(() => validateReferences(dataWith('ヘルプデスク系'))).not.toThrow();
    expect(() => validateReferences(dataWith('事務系'))).not.toThrow();
  });

  it('roles.csv に無い分類は落とす — 黙って消えるのを防ぐ', () => {
    expect(() => validateReferences(dataWith('ヘルプデスク')))
      .toThrow(/it-support\/ヘルプデスク/);
  });

  it('職種と分類の組が合っていなければ落とす', () => {
    // 分類名は実在するが、職種が違う組み合わせ
    const bad = 'categoryId,track,subtrack,stage,labelJa,sortOrder\nc1,infrastructure,ヘルプデスク系,1,受付,1\n';
    expect(() => validateReferences({ ...dataWith('事務系'), categories: parseCategories(bad) }))
      .toThrow(/infrastructure\/ヘルプデスク系/);
  });
});
