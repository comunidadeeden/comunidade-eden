import test from 'node:test';
import assert from 'node:assert/strict';
import { getModuleProgress, getOverallModuleProgress } from '../src/lib/moduleProgress';
import type { ContentItem, Trail, UserProfile } from '../src/types';

const lesson = (id: string, type: ContentItem['type'] = 'video'): ContentItem => ({ id, title: id, type, description: '', imageUrl: '' });
const trails: Trail[] = [{ id: 't', title: 'Trilha', modules: [
  { id: 'a', title: 'Primeiro', imageUrl: '', items: [lesson('1'), lesson('2'), lesson('pdf', 'material')] },
  { id: 'b', title: 'Segundo', imageUrl: '', items: [lesson('3')] },
  { id: 'empty', title: 'Em breve', imageUrl: '', items: [] },
] }];

test('agrupa conclusões por módulo e ignora materiais e IDs antigos', () => {
  const result = getModuleProgress(trails, ['1', '1', 'pdf', 'antiga']);
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(m => [m.completedCount, m.total, m.percent, m.status]), [[1, 2, 50, 'in-progress'], [0, 1, 0, 'not-started']]);
  assert.equal(result[0].lessons[1].completed, false);
  assert.equal(result[0].trailTitle, 'Trilha');
});

test('só considera o módulo concluído quando todas as aulas estão concluídas', () => {
  const result = getModuleProgress(trails, ['1', '2', '3']);
  assert.ok(result.every(m => m.status === 'completed' && m.percent === 100));
});

test('aluno sem conclusões e catálogo vazio não geram progresso indevido', () => {
  assert.ok(getModuleProgress(trails).every(m => m.completedCount === 0 && m.percent === 0));
  assert.deepEqual(getModuleProgress([]), []);
});

test('não conta duas vezes uma aula repetida dentro do módulo', () => {
  const repeated: Trail[] = [{ id: 't', title: 'Trilha', modules: [{ id: 'm', title: 'Módulo', imageUrl: '', items: [lesson('1'), lesson('1')] }] }];
  assert.equal(getModuleProgress(repeated, ['1'])[0].total, 1);
});

const student = (uid: string, completedChallenges: string[] = [], extra: Partial<UserProfile> = {}): UserProfile => ({
  uid, name: uid, email: `${uid}@example.test`, points: 0, role: 'student', completedChallenges, ...extra
});

test('resumo geral conta pessoas por módulo, sem admins e com a mesma base do painel', () => {
  const result = getOverallModuleProgress(trails, [
    student('complete', ['1', '2']), student('partial', ['1', '1', 'pdf']),
    student('blocked', ['3'], { isBlocked: true }), student('never', ['removed']),
    student('admin', ['1', '2', '3'], { role: 'admin' }),
  ]);
  assert.equal(result.totalStudents, 4);
  assert.equal(result.modules.length, 2);
  assert.deepEqual(result.modules.map(m => [m.completed, m.inProgress, m.notStarted]), [[1, 1, 2], [1, 0, 3]]);
  assert.equal(result.modules[0].completedPercent, 25);
  assert.equal(result.modules[0].inProgressPercent, 25);
  for (const m of result.modules) assert.equal(m.completed + m.inProgress + m.notStarted, result.totalStudents);
});

test('resumo geral sem alunas retorna percentuais finitos iguais a zero', () => {
  const result = getOverallModuleProgress(trails, [student('admin', [], { role: 'admin' })]);
  assert.equal(result.totalStudents, 0);
  for (const m of result.modules) {
    assert.equal(m.completedPercent, 0);
    assert.equal(m.inProgressPercent, 0);
    assert.equal(m.notStarted, 0);
  }
});

test('resumo geral acompanha o total real e conclusões ausentes', () => {
  const users = Array.from({ length: 228 }, (_, i) => student(String(i), i < 20 ? ['1', '2'] : []));
  users[227].completedChallenges = undefined;
  const result = getOverallModuleProgress(trails, users);
  assert.equal(result.totalStudents, 228);
  assert.equal(result.modules[0].completed, 20);
  assert.equal(result.modules[0].notStarted, 208);
  assert.deepEqual(getOverallModuleProgress([], users).modules, []);
});
