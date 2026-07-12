import { describe, expect, it } from 'vitest';
import {
  parseAbilities,
  parseDependencies,
  parseEvidences,
  parseRoles,
  validateReferences,
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
  'abilityId,roleId,statement,statementKo,roleStatement,roleStatementKo,toolsReference,weight,isCommon,commonGroupId,sortOrder',
  'a1,r1,"問い合わせを受け付け、連携できる","문의를 접수, 전달할 수 있다",役割文,역할문,Outlook|Teams,1,true,grp-1,1',
].join('\n');

const evidencesCsv = [
  'evidenceId,abilityId,statement,statementKo,evidenceType,workTags,selfCheckTip,selfCheckTipKo,sortOrder',
  'a1-e1,a1,要点を記録できる,요점을 기록할 수 있다,practice,inquiry|reporting,説明できますか？,설명할 수 있나요?,1',
  'a1-e2,a1,経験がある,경험이 있다,experience,inquiry,,,2',
].join('\n');

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
    const data = {
      roles: parseRoles(rolesCsv),
      dependencies: parseDependencies(depsCsv),
      abilities: parseAbilities(abilitiesCsv),
      evidences: parseEvidences(evidencesCsv.replace(/a1,/g, 'aX,').replace('a1-e1,aX', 'a1-e1,aX')),
    };
    expect(() => validateReferences(data)).toThrow(/abilityId/);
  });

  it('参照整合性: 正常データは通過', () => {
    const data = {
      roles: parseRoles(rolesCsv),
      dependencies: parseDependencies(depsCsv),
      abilities: parseAbilities(abilitiesCsv),
      evidences: parseEvidences(evidencesCsv),
    };
    expect(() => validateReferences(data)).not.toThrow();
  });
});
