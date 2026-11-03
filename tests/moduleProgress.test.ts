import test from 'node:test';
import assert from 'node:assert/strict';
import { getModuleProgress } from '../src/lib/moduleProgress';
import type { ContentItem, Trail } from '../src/types';

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
