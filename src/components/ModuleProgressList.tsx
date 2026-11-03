import { useState } from 'react';
import { CheckCircle, ChevronDown } from 'lucide-react';
import type { ModuleProgress } from '../lib/moduleProgress';

const statusLabels: Record<string, string> = {
  completed: 'Concluído', 'in-progress': 'Em andamento', 'not-started': 'Não iniciado'
};
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

export function ModuleProgressList({ modules }: { modules: ModuleProgress[] }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const completedModules = modules.filter(module => module.status === 'completed').length;
  const visible = modules.filter(module =>
    (filter === 'all' || module.status === filter) && normalize(`${module.title} ${module.trailTitle}`).includes(normalize(search.trim()))
  );
  const trailIds = [...new Set(visible.map(module => module.trailId))];

  return (
    <section className="space-y-5" aria-label="Progresso por módulo">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-lg font-bold text-white">Progresso por módulo</h4>
        <p className="text-sm text-gray-400"><span className="font-bold text-emerald-400">{completedModules} de {modules.length}</span> módulos concluídos</p>
      </div>
      <p className="text-sm leading-relaxed text-gray-400">Cada barra mostra as aulas com conclusão registrada. Abra um módulo para ver os detalhes.</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input aria-label="Buscar módulo" placeholder="Buscar módulo" value={search} onChange={event => setSearch(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#4bd3ff]/60" />
        <select aria-label="Filtrar módulos" value={filter} onChange={event => setFilter(event.target.value)} className="rounded-xl border border-white/10 bg-[#0b0c10] px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#4bd3ff]/60">
          <option value="all">Todos os módulos</option>
          <option value="completed">Concluídos</option>
          <option value="in-progress">Em andamento</option>
          <option value="not-started">Não iniciados</option>
        </select>
      </div>
      {trailIds.map(trailId => {
        const trailModules = visible.filter(module => module.trailId === trailId);
        return (
          <div key={trailId} className="space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-widest text-gray-400">{trailModules[0].trailTitle}</h5>
            {trailModules.map(module => (
              <details key={module.key} className="group rounded-2xl border border-white/10 bg-white/[0.03] open:border-white/20">
                <summary className="cursor-pointer list-none rounded-2xl p-4 sm:p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4bd3ff] [&::-webkit-details-marker]:hidden">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 text-base font-bold text-white">{module.title}</span>
                    <ChevronDown size={18} aria-hidden="true" className="mt-1 shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
                    <span className={module.status === 'completed' ? 'font-semibold text-emerald-400' : module.status === 'in-progress' ? 'text-[#4bd3ff]' : 'text-gray-500'}>{statusLabels[module.status]}</span>
                    <span className="text-gray-300">{module.completedCount} de {module.total} aulas <span className="ml-1 text-gray-500">· {module.percent}%</span></span>
                  </div>
                  <div role="progressbar" aria-label={`Conclusão de ${module.title}`} aria-valuemin={0} aria-valuemax={module.total} aria-valuenow={module.completedCount} aria-valuetext={`${module.completedCount} de ${module.total} aulas concluídas`} className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className={`h-full rounded-full ${module.status === 'completed' ? 'bg-emerald-400' : 'bg-[#4bd3ff]'}`} style={{ width: `${module.percent}%` }} />
                  </div>
                  <span className="mt-3 block text-xs text-gray-500"><span className="group-open:hidden">Ver aulas</span><span className="hidden group-open:inline">Recolher aulas</span></span>
                </summary>
                <ul className="border-t border-white/10 px-4 pb-2 sm:px-5">
                  {module.lessons.map(lesson => (
                    <li key={lesson.id} className="flex items-start gap-3 border-b border-white/5 py-3 last:border-0">
                      {lesson.completed ? <CheckCircle aria-hidden="true" size={17} className="mt-0.5 shrink-0 text-emerald-400" /> : <span aria-hidden="true" className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full border border-gray-600" />}
                      <span className="min-w-0 flex-1 text-sm text-gray-200">{lesson.title}</span>
                      <span className={`shrink-0 text-xs ${lesson.completed ? 'text-emerald-400' : 'text-gray-500'}`}>{lesson.completed ? 'Concluída' : 'Pendente'}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        );
      })}
      {visible.length === 0 && <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-400">{modules.length ? 'Nenhum módulo encontrado para este filtro.' : 'Nenhum módulo com aulas disponível.'}</p>}
    </section>
  );
}
