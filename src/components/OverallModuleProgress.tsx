import { useState } from 'react';
import { getOverallModuleProgress } from '../lib/moduleProgress';
import type { Trail, UserProfile } from '../types';

const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
const percent = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

export function OverallModuleProgress({ trails, users }: { trails: Trail[]; users: UserProfile[] }) {
  const [search, setSearch] = useState('');
  const { totalStudents, modules } = getOverallModuleProgress(trails, users);
  const visible = modules.filter(module => normalize(`${module.title} ${module.trailTitle}`).includes(normalize(search.trim())));
  const trailIds = [...new Set(visible.map(module => module.trailId))];

  return (
    <section aria-label="Progresso geral por módulo" className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-xl font-bold text-white">Progresso geral por módulo</h3>
          <p className="mt-2 text-sm text-gray-400">Base: <strong className="text-white">{totalStudents} alunas</strong> · mesmo total do painel, sem administradores.</p>
        </div>
        <input aria-label="Buscar módulo no progresso geral" placeholder="Buscar módulo ou trilha" value={search} onChange={event => setSearch(event.target.value)} className="w-full sm:w-64 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#4bd3ff]/60" />
      </div>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-300">
          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />Concluíram o módulo</span>
          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#4bd3ff]" />Em andamento</span>
          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-gray-600" />Sem conclusão registrada</span>
        </div>
        <p className="text-xs leading-relaxed text-gray-400">Cada barra representa todas as alunas. “Em andamento” indica pelo menos uma aula concluída. Os dados consideram as marcações de conclusão, não o tempo assistido.</p>
      </div>
      {totalStudents === 0 && <p className="text-sm text-gray-400">Ainda não há alunas cadastradas para calcular o progresso.</p>}
      {trailIds.map(trailId => {
        const trailModules = visible.filter(module => module.trailId === trailId);
        return (
          <div key={trailId} className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400">{trailModules[0].trailTitle}</h4>
            <div className="grid gap-3 xl:grid-cols-2">
              {trailModules.map(module => (
                <article key={module.key} className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h5 className="font-bold text-white">{module.title}</h5>
                    <span className="shrink-0 text-xs text-gray-400">{module.lessonCount} aulas</span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm text-gray-300"><strong className="text-lg text-emerald-400">{module.completed}</strong> de {totalStudents} concluíram</p>
                    <span className="text-sm font-bold text-emerald-400">{percent(module.completedPercent)}%</span>
                  </div>
                  <div role="img" aria-label={`${module.title}: ${module.completed} concluíram, ${module.inProgress} em andamento e ${module.notStarted} sem conclusão registrada, de ${totalStudents} alunas`} className="mt-3 flex h-3 overflow-hidden rounded-full bg-gray-600">
                    <div className="h-full bg-emerald-400" style={{ width: `${module.completedPercent}%` }} />
                    <div className="h-full bg-[#4bd3ff]" style={{ width: `${module.inProgressPercent}%` }} />
                  </div>
                  <div className="mt-3 flex flex-wrap justify-between gap-x-4 gap-y-2 text-xs">
                    <p className="text-[#4bd3ff]"><strong>{module.inProgress}</strong> em andamento</p>
                    <p className="text-gray-400"><strong>{module.notStarted}</strong> sem conclusão</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        );
      })}
      {visible.length === 0 && <p className="py-4 text-sm text-gray-400">{modules.length ? 'Nenhum módulo encontrado para esta busca.' : 'Nenhum módulo com aulas disponível.'}</p>}
    </section>
  );
}
