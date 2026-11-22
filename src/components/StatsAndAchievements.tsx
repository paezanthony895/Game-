import React from 'react';
import { Award, Trophy, History, CheckCircle2, Lock } from 'lucide-react';
import type { Achievement, CareerStatsAggregate } from '../types/football';
import { DIFFICULTY_LABELS } from '../types/football';

interface StatsAndAchievementsProps {
  stats: CareerStatsAggregate;
  achievements: Achievement[];
  initialTab?: 'stats' | 'achievements';
}

export const StatsAndAchievements: React.FC<StatsAndAchievementsProps> = ({
  stats,
  achievements,
  initialTab = 'stats',
}) => {
  const [tab, setTab] = React.useState<'stats' | 'achievements'>(initialTab);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-extrabold text-white">Estadísticas y Logros</h2>
          <p className="text-sm text-slate-400">
            Historial completo de partidos, vitrina de trofeos, récords personales y recompensas desbloqueadas.
          </p>
        </div>

        <div className="inline-flex rounded-lg bg-[#101923] border border-slate-800 p-1">
          <button
            type="button"
            onClick={() => setTab('stats')}
            className={`px-4 py-2 rounded-md text-xs font-semibold cursor-pointer ${
              tab === 'stats' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Estadísticas e Historial
          </button>
          <button
            type="button"
            onClick={() => setTab('achievements')}
            className={`px-4 py-2 rounded-md text-xs font-semibold cursor-pointer ${
              tab === 'achievements' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Logros ({unlockedCount}/{achievements.length})
          </button>
        </div>
      </div>

      {tab === 'stats' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Partidos Jugados', val: stats.matchesPlayed },
              { label: 'Victorias / Empates / Derrotas', val: `${stats.wins} / ${stats.draws} / ${stats.losses}` },
              { label: 'Goles a Favor / En Contra', val: `${stats.goalsScored} / ${stats.goalsConceded}` },
              { label: 'Victorias en ULTRA DIFÍCIL', val: stats.ultraDifficultWins },
              { label: 'Porterías a Cero', val: stats.cleanSheets },
              { label: 'Tandas de Penales Ganadas', val: stats.penaltiesWon },
              { label: 'Mejor Racha Supervivencia', val: stats.survivalBestStreak },
              { label: 'Trofeos Conquistados', val: stats.trophies.length },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl bg-[#101923] border border-slate-800 p-4">
                <div className="text-xs text-slate-400">{kpi.label}</div>
                <div className="font-display text-3xl font-extrabold text-white tabular-nums mt-1">{kpi.val}</div>
              </div>
            ))}
          </div>

          {/* Trophies */}
          <div className="rounded-xl bg-[#101923] border border-slate-800 p-5">
            <div className="flex items-center gap-2 text-amber-400 font-display text-xl font-bold mb-3">
              <Trophy className="w-5 h-5" />
              <span>Vitrina de Trofeos</span>
            </div>
            {stats.trophies.length === 0 ? (
              <p className="text-xs text-slate-400">Aún no hay trofeos en la vitrina. Gana un Mundial, Liga o Copa para inaugurarla.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {stats.trophies.map((tr, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs font-semibold text-amber-200">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span>{tr}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Match History */}
          <div className="rounded-xl bg-[#101923] border border-slate-800 p-5">
            <div className="flex items-center gap-2 text-white font-display text-xl font-bold mb-3">
              <History className="w-5 h-5 text-emerald-400" />
              <span>Resultados Recientes</span>
            </div>
            {stats.history.length === 0 ? (
              <p className="text-xs text-slate-400">Todavía no se han registrado partidos en este perfil.</p>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {stats.history.map((m) => (
                  <div key={m.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-white">{m.homeTeamName}</span>
                      <span className="font-mono-tabular font-extrabold text-emerald-400 text-sm">
                        {m.homeScore} - {m.awayScore}
                      </span>
                      <span className="font-bold text-white">{m.awayTeamName}</span>
                    </div>
                    <div className="text-slate-400">
                      {DIFFICULTY_LABELS[m.difficulty]} · {new Date(m.dateIso).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {achievements.map((ach) => (
            <div
              key={ach.id}
              className={`rounded-xl border p-4 flex items-start justify-between gap-4 ${
                ach.unlocked
                  ? 'bg-emerald-950/25 border-emerald-500/40'
                  : 'bg-[#101923] border-slate-800'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-lg ${ach.unlocked ? 'bg-emerald-600/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-white">{ach.title}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{ach.description}</p>
                  <div className="mt-2 h-1.5 w-40 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${Math.min(100, (ach.progress / ach.target) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                {ach.unlocked ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    Completado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-mono-tabular text-slate-500">
                    <Lock className="w-3.5 h-3.5" />
                    {ach.progress}/{ach.target}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
