import type { Trail, UserProfile } from '../types';

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

export function getOverallModuleProgress(trails: Trail[], users: UserProfile[]) {
  // Use the same population as the dashboard's Total de Alunas card.
  const students = users.filter(user => user.role !== 'admin');
  const completions = students.map(student => new Set(student.completedChallenges || []));
  const totalStudents = students.length;
  const modules = getModuleProgress(trails).map(module => {
    let completed = 0;
    let inProgress = 0;
    for (const ids of completions) {
      const count = module.lessons.filter(lesson => ids.has(lesson.id)).length;
      if (count === module.total) completed++;
      else if (count > 0) inProgress++;
    }
    return {
      key: module.key, title: module.title, trailId: module.trailId,
      trailTitle: module.trailTitle, lessonCount: module.total,
      completed, inProgress, notStarted: totalStudents - completed - inProgress,
      completedPercent: totalStudents ? completed / totalStudents * 100 : 0,
      inProgressPercent: totalStudents ? inProgress / totalStudents * 100 : 0,
    };
  });
  return { totalStudents, modules };
}
