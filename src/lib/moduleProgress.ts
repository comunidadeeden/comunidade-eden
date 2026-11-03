import type { Trail } from '../types';

export function getModuleProgress(trails: Trail[], completedIds: string[] = []) {
  const completed = new Set(completedIds);
  return trails.flatMap(trail => (trail.modules || []).flatMap(module => {
    const lessons = [...new Map((module.items || []).filter(item => item.type === 'video').map(item => [item.id, item])).values()]
      .map(item => ({ id: item.id, title: item.title, completed: completed.has(item.id) }));
    if (!lessons.length) return [];
    const completedCount = lessons.filter(item => item.completed).length;
    return [{
      key: `${trail.id}:${module.id}`, title: module.title, trailId: trail.id, trailTitle: trail.title,
      lessons, total: lessons.length, completedCount,
      percent: Math.round(completedCount / lessons.length * 100),
      status: completedCount === lessons.length ? 'completed' : completedCount > 0 ? 'in-progress' : 'not-started'
    }];
  }));
}

export type ModuleProgress = ReturnType<typeof getModuleProgress>[number];
