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
  'roleId,track,category,stageOrder,pathType,titleJa,shortLabel,summary,status,shortGoal,titleKo,shortLabelKo,summaryKo,shortGoalKo',
  'r1,infrastructure,サーバー,1,common,運用監視補助,補助,要約,published,目標,보조역할,보조,요약,목표',
  'r2,infrastructure,サーバー,2,specialist,運用監視,監視,,placeholder,,,,,',
].join('\n');

const depsCsv = [
  'dependencyId,fromId,toId,depType,gateRule,note',
  'd1,r1,r2,role-ladder,,メモ',
].join('\n');

const abilitiesCsv = [
  'abilityId,roleId,statement,statementKo,roleStatement,roleStatementKo,toolsReference,weight,isCommon,commonGroupId,sortOrder,growthLineId',
  'a1,r1,"問い合わせを受け付け、連携できる","문의를 접수, 전달할 수 있다",役割文,역할문,Outlook|Teams,1,true,grp-1,1,response',
].join('\n');

const growthLinesCsv = [
  'lineId,labelJa,labelKo,sortOrder',
  'response,依頼・障害対応,의뢰·장애 대응,1',
  'execution,作業実施（手順書→設計書）,작업 수행 (절차서→설계서),2',
].join('\n');

const evidencesCsv = [
  'evidenceId,abilityId,statement,statementKo,evidenceType,workTags,selfCheckTip,selfCheckTipKo,sortOrder',
  'a1-e1,a1,要点を記録できる,요점을 기록할 수 있다,practice,inquiry|reporting,説明できますか？,설명할 수 있나요?,1',
  'a1-e2,a1,経験がある,경험이 있다,experience,inquiry,,,2',
].join('\n');

// v2.7 素材→武器モデル
const tagsCsv = [
  'tagId,labelJa,labelKo,sortOrder',
  'inquiry,問い合わせ対応,문의 대응,1',
  'reporting,記録・報告,기록·보고,2',
].join('\n');

const actionsCsv = [
  'actionId,categoryId,statement,statementKo,sortOrder,kind',
  'at1,c1-inquiry,問い合わせを受け付けられる,문의를 접수할 수 있다,1,practice',
  'at2,c1-reporting,要点を記録できる,요점을 기록할 수 있다,1,practice',
  'at3,c2-triage,発報内容を照合できる,발보 내용을 대조할 수 있다,1,knowledge',
].join('\n');

const weaponsCsv = [
  'weaponId,roleId,tagId,statement,statementKo,composedOf,sortOrder',
  'w1,r2,inquiry,障害の概要を整理できる,장애 개요를 정리할 수 있다,at1|at2|at3,1',
].join('\n');

// v2.7d カテゴリモデル
const categoriesCsv = [
  'categoryId,stage,labelJa,labelKo,includes,sortOrder',
  'c1-inquiry,1,問い合わせ対応,문의 대응,,1',
  'c1-reporting,1,記録・報告,기록·보고,,2',
  'c2-triage,2,監視・一次対応,감시·일차 대응,c1-inquiry|c1-reporting,1',
].join('\n');

// v2.7n 推奨資格
const certsCsv = [
  'certId,stage,nameJa,nameKo,note,noteKo,sortOrder',
  'cert-1,1,ITパスポート,IT 패스포트,基礎,기초,1',
  'cert-2,2,CCNA,CCNA,,,1',
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
      titleKo: '보조역할',
    });
    expect(roles[1].shortGoal).toBeUndefined();
    expect(roles[1].titleKo).toBeUndefined();
  });

  it('abilities: パイプ区切りツール・boolean 変換・引用符付きカンマ', () => {
    const abilities = parseAbilities(abilitiesCsv);
    expect(abilities[0].toolsReference).toEqual(['Outlook', 'Teams']);
    expect(abilities[0].isCommon).toBe(true);
    expect(abilities[0].statement).toBe('問い合わせを受け付け、連携できる');
    expect(abilities[0].statementKo).toBe('문의를 접수, 전달할 수 있다');
  });

  it('evidences: workTags の検証つき変換・任意 selfCheckTip', () => {
    const evidences = parseEvidences(evidencesCsv);
    expect(evidences[0].workTags).toEqual(['inquiry', 'reporting']);
    expect(evidences[0].selfCheckTipKo).toBe('설명할 수 있나요?');
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

  // ------------------------------------------------------------------
  // 業務ロードマップ (v2.6 — AC-11.1/11.2/AC-11.12)
  // ------------------------------------------------------------------

  it('growth-lines: 型変換と任意 labelKo', () => {
    const lines = parseGrowthLines(growthLinesCsv);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ lineId: 'response', labelJa: '依頼・障害対応', sortOrder: 1 });
    expect(lines[0].labelKo).toBe('의뢰·장애 대응');
    const noKo = parseGrowthLines('lineId,labelJa,sortOrder\nx,ラベル,1');
    expect(noKo[0].labelKo).toBeUndefined();
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
      'abilityId,roleId,statement,statementKo,roleStatement,roleStatementKo,toolsReference,weight,isCommon,commonGroupId,sortOrder,growthLineId,growsInto';
    const withEdges = [
      header,
      'a1,r1,文,문,役,역,,1,false,,1,response,a2|a3',
      'a2,r1,文,문,役,역,,1,false,,2,response,',
      'a3,r1,文,문,役,역,,1,false,,3,response,',
    ].join('\n');
    const parsed = parseAbilities(withEdges);
    expect(parsed[0].growsInto).toEqual(['a2', 'a3']);
    expect(parsed[1].growsInto).toEqual([]);
    // 列自体が無い旧フォーマット
    expect(parseAbilities(abilitiesCsv)[0].growsInto).toEqual([]);
  });

  it('参照整合性: growsInto が存在しない能力を参照するとエラー (v2.6e)', () => {
    const header =
      'abilityId,roleId,statement,statementKo,roleStatement,roleStatementKo,toolsReference,weight,isCommon,commonGroupId,sortOrder,growthLineId,growsInto';
    const data = buildDataSet({
      abilities: parseAbilities([header, 'a1,r1,文,문,役,역,,1,false,,1,response,aX'].join('\n')),
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
    expect(actions[2]).toMatchObject({ actionId: 'at3', categoryId: 'c2-triage' });
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
