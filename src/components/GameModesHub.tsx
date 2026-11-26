import React, { useMemo, useState } from 'react';
import {
  Play,
  Trophy,
  Globe2,
  UserCheck,
  Briefcase,
  Building2,
  Target,
  Dumbbell,
  Flame,
  Swords,
  Star,
  Sparkles,
  Shield,
  ArrowRight,
} from 'lucide-react';
import {
  DIFFICULTY_LABELS,
  TACTICAL_LABELS,
  type CareerProfile,
  type CompetitionState,
  type DifficultyLevel,
  type GameMode,
  type GameSettings,
  type KitSelection,
  type PlayerPosition,
  type TacticalStyle,
  type Team,
  type TimeOfDay,
  type WeatherType,
} from '../types/football';
import { CHALLENGE_SCENARIOS } from '../data/database';
import { createCompetition, getCompetitionRoundLabel } from '../engine/competitions';
import { getGameModeConfig } from '../engine/gameModeManager';
import { TeamCrest } from './TeamCrest';
import { MatchSetupModal } from './MatchSetupModal';

export interface LaunchMatchRequest {
  mode: GameMode;
  homeTeam: Team;
  awayTeam: Team;
  homeKit?: KitSelection;
  awayKit?: KitSelection;
  userSide: 'home' | 'away';
  twoPlayerMode?: boolean;
  difficultyOverride?: DifficultyLevel;
  timeOfDayOverride?: TimeOfDay;
  weatherOverride?: WeatherType;
  qualityOverride?: GameSettings['visual']['quality'];
  startMinute?: number;
  initialHomeGoals?: number;
  initialAwayGoals?: number;
  trainingDrill?: 'free_play' | 'shooting' | 'passing' | 'dribbling' | 'free_kicks';
  competitionFixtureId?: string;
  onlineSession?: {
    roomCode: string;
    side: 'home' | 'away';
  };
}

interface GameModesHubProps {
  teams: Team[];
  settings: GameSettings;
  career: CareerProfile;
  activeCompetition: CompetitionState | null;
  survivalStreak: number;
  initialSelectedMode?: GameMode;
  preselectedHomeTeam?: Team | null;
  onUpdateDifficulty: (d: DifficultyLevel) => void;
  onUpdateCareer: (c: CareerProfile) => void;
  onStartCompetition: (comp: CompetitionState) => void;
  onClearCompetition: () => void;
  onLaunchMatch: (req: LaunchMatchRequest) => void;
  onSignPlayerToClub: (clubId: string, playerTeamId: string, playerIndex: number, feeMillions: number) => void;
}

const MODE_CARDS: { id: GameMode; title: string; subtitle: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'quick_match', title: 'Partido Rápido', subtitle: 'Elige 2 equipos y juega ya', icon: Play },
  { id: 'world_cup', title: 'Mundial', subtitle: 'Copa del Mundo de selecciones', icon: Globe2 },
  { id: 'continental_cup', title: 'Copa Continental', subtitle: 'Euro, América, AFCON, Asia', icon: Trophy },
  { id: 'league', title: 'Ligas Nacionales', subtitle: 'Temporada completa por puntos', icon: Shield },
  { id: 'club_cup', title: 'Copas de Clubes', subtitle: 'Eliminatorias internacionales', icon: Swords },
  { id: 'player_career', title: 'Carrera de Jugador', subtitle: 'Crea tu estrella y progresa', icon: UserCheck },
  { id: 'manager_career', title: 'Carrera de Entrenador', subtitle: 'Fichajes, tácticas y títulos', icon: Briefcase },
  { id: 'club_career', title: 'Carrera de Club', subtitle: 'Estadio, cantera y dinastía', icon: Building2 },
  { id: 'penalties', title: 'Penaltis', subtitle: 'Tandas decisivas al límite', icon: Target },
  { id: 'training', title: 'Entrenamiento', subtitle: 'Práctica de tiro, pase y regate', icon: Dumbbell },
  { id: 'challenges', title: 'Desafíos', subtitle: 'Remontadas y retos tácticos', icon: Flame },
  { id: 'survival', title: 'Supervivencia', subtitle: 'Racha contra IA creciente', icon: Sparkles },
  { id: 'custom_tournament', title: 'Torneo Personalizado', subtitle: 'Configura equipos y formato', icon: Trophy },
  { id: 'all_star', title: 'All-Star', subtitle: 'Estrellas mundiales e históricos', icon: Star },
];

export const GameModesHub: React.FC<GameModesHubProps> = ({
  teams,
  settings,
  career,
  activeCompetition,
  survivalStreak,
  initialSelectedMode = 'quick_match',
  preselectedHomeTeam,
  onUpdateDifficulty,
  onUpdateCareer,
  onStartCompetition,
  onClearCompetition,
  onLaunchMatch,
  onSignPlayerToClub,
}) => {
  const [selectedMode, setSelectedMode] = useState<GameMode>(initialSelectedMode);

  const clubs = useMemo(() => teams.filter((t) => t.type === 'club'), [teams]);
  const nations = useMemo(() => teams.filter((t) => t.type === 'national'), [teams]);
  const teamsMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const [homeId, setHomeId] = useState<string>(preselectedHomeTeam?.id ?? clubs[0]?.id ?? teams[0].id);
  const [leagueId, setLeagueId] = useState<string>('esp-1');
  const [confCup, setConfCup] = useState<'UEFA' | 'CONMEBOL' | 'CONCACAF' | 'CAF' | 'AFC'>('CONMEBOL');
  const [customName, setCustomName] = useState('Copa Atlas Internacional');
  const [customFormat, setCustomFormat] = useState<'knockout' | 'groups'>('knockout');
  const [customCount, setCustomCount] = useState<4 | 8 | 16>(8);
  const [modalSetupOpen, setModalSetupOpen] = useState<boolean>(false);

  const homeTeam = teamsMap.get(homeId) ?? teams[0];
  const awayTeam = clubs[1] ?? teams[1];

  const availableLeagues = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clubs) {
      if (c.leagueId && c.leagueName && c.leagueId !== 'hist' && c.leagueId !== 'allstar') {
        map.set(c.leagueId, c.leagueName);
      }
    }
    return Array.from(map.entries());
  }, [clubs]);

  const startTournament = (
    name: string,
    mode: GameMode,
    pool: Team[],
    userTeam: Team,
    knockoutOnly: boolean,
    size: number
  ) => {
    const sorted = [...pool].filter((t) => t.id !== userTeam.id).sort((a, b) => b.overall - a.overall);
    const participants = [userTeam.id, ...sorted.slice(0, size - 1).map((t) => t.id)];
    const comp = createCompetition(name, mode, participants, userTeam.id, teamsMap, knockoutOnly);
    onStartCompetition(comp);
  };

  const renderActiveCompetitionPanel = () => {
    if (!activeCompetition) return null;
    const roundFixtures = activeCompetition.fixtures.filter((f) => f.round === activeCompetition.currentRound);
    const userFixture = roundFixtures.find(
      (f) => f.homeTeamId === activeCompetition.userTeamId || f.awayTeamId === activeCompetition.userTeamId
    );
    const champ = activeCompetition.championTeamId ? teamsMap.get(activeCompetition.championTeamId) : null;

    return (
      <div
        data-testid="active-competition-panel"
        className="rounded-xl bg-[#101923] border border-emerald-500/40 p-5 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
              COMPETICIÓN ACTIVA · {getCompetitionRoundLabel(activeCompetition, activeCompetition.currentRound)}
            </div>
            <h3 className="font-display text-2xl font-extrabold text-white">{activeCompetition.name}</h3>
          </div>
          <button
            type="button"
            onClick={onClearCompetition}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:text-white cursor-pointer"
          >
            Finalizar / Nueva Competición
          </button>
        </div>

        {activeCompetition.stage === 'completed' ? (
          <div className="rounded-lg bg-amber-500/10 border border-amber-400/40 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="w-8 h-8 text-amber-400" />
              <div>
                <div className="text-xs text-amber-300 font-semibold">CAMPEÓN DEL TORNEO</div>
                <div className="font-display text-2xl font-extrabold text-white">{champ?.name ?? 'Campeón'}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClearCompetition}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white cursor-pointer"
            >
              Iniciar Otro Torneo
            </button>
          </div>
        ) : userFixture ? (
          <div className="rounded-lg bg-slate-950/80 border border-slate-800 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <TeamCrest team={teamsMap.get(userFixture.homeTeamId) ?? homeTeam} size={36} />
              <span className="font-display text-xl font-bold text-white">
                {teamsMap.get(userFixture.homeTeamId)?.name} vs {teamsMap.get(userFixture.awayTeamId)?.name}
              </span>
              <TeamCrest team={teamsMap.get(userFixture.awayTeamId) ?? awayTeam} size={36} />
            </div>
            <button
              type="button"
              onClick={() => {
                const h = teamsMap.get(userFixture.homeTeamId) ?? homeTeam;
                const a = teamsMap.get(userFixture.awayTeamId) ?? awayTeam;
                onLaunchMatch({
                  mode: activeCompetition.mode,
                  homeTeam: h,
                  awayTeam: a,
                  userSide: h.id === activeCompetition.userTeamId ? 'home' : 'away',
                  competitionFixtureId: userFixture.id,
                });
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white cursor-pointer min-h-[44px]"
            >
              <Play className="w-4 h-4" />
              <span>Jugar Partido</span>
            </button>
          </div>
        ) : (
          <div className="text-xs text-amber-300">
            Tu equipo ha quedado eliminado en esta fase. Puedes finalizar e iniciar una nueva edición.
          </div>
        )}

        {/* Standings Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Equipo</th>
                <th className="py-2 px-2 text-center">PJ</th>
                <th className="py-2 px-2 text-center">G</th>
                <th className="py-2 px-2 text-center">E</th>
                <th className="py-2 px-2 text-center">P</th>
                <th className="py-2 px-2 text-center">DG</th>
                <th className="py-2 pl-2 text-right">PTS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {activeCompetition.standings.slice(0, 12).map((row, idx) => (
                <tr key={row.teamId} className={row.teamId === activeCompetition.userTeamId ? 'bg-emerald-950/35 text-emerald-300 font-semibold' : 'text-slate-300'}>
                  <td className="py-2 pr-3 font-mono-tabular">{idx + 1}</td>
                  <td className="py-2 pr-3">{row.teamName}</td>
                  <td className="py-2 px-2 text-center font-mono-tabular">{row.played}</td>
                  <td className="py-2 px-2 text-center font-mono-tabular">{row.won}</td>
                  <td className="py-2 px-2 text-center font-mono-tabular">{row.drawn}</td>
                  <td className="py-2 px-2 text-center font-mono-tabular">{row.lost}</td>
                  <td className="py-2 px-2 text-center font-mono-tabular">{row.gd}</td>
                  <td className="py-2 pl-2 text-right font-mono-tabular font-bold text-white">{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl font-extrabold text-white">Modos de Juego</h2>
          <p className="text-sm text-slate-400">
            14 experiencias jugables completas con IA adaptable hasta ULTRA DIFÍCIL.
          </p>
        </div>

        {/* Difficulty Quick Switch */}
        <div className="flex items-center gap-2 bg-[#101923] border border-slate-800 rounded-lg px-3 py-2 text-xs">
          <span className="text-slate-400">Dificultad:</span>
          <select
            aria-label="Seleccionar nivel de dificultad"
            value={settings.match.difficulty}
            onChange={(e) => onUpdateDifficulty(Number(e.target.value) as DifficultyLevel)}
            className="bg-transparent font-bold text-emerald-400 focus:outline-none cursor-pointer"
          >
            {([1, 2, 3, 4, 5, 6, 7, 8] as DifficultyLevel[]).map((d) => (
              <option key={d} value={d} className="bg-[#101923] text-white">
                {d}. {DIFFICULTY_LABELS[d]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Mode Selector Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
        {MODE_CARDS.map((m) => {
          const Icon = m.icon;
          const active = selectedMode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedMode(m.id)}
              className={`rounded-xl p-3 border text-left transition-colors cursor-pointer flex flex-col justify-between min-h-[92px] ${
                active
                  ? 'bg-emerald-950/50 border-emerald-500 text-white'
                  : 'bg-[#101923] border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-emerald-400' : 'text-slate-400'}`} />
              <div className="mt-2">
                <div className="font-display text-sm font-bold leading-tight">{m.title}</div>
                <div className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{m.subtitle}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Competition Status if running */}
      {activeCompetition && ['world_cup', 'continental_cup', 'league', 'club_cup', 'custom_tournament'].includes(selectedMode) && renderActiveCompetitionPanel()}

      {/* Dedicated Mode Rules Summary Banner from gameModeManager */}
      <div
        data-testid="active-mode-rules-banner"
        className="rounded-xl bg-slate-950/90 border border-emerald-500/35 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="rounded bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-extrabold text-emerald-300">
              {getGameModeConfig(selectedMode).broadcastLabel}
            </span>
            <span className="font-display text-lg font-extrabold text-white">
              {getGameModeConfig(selectedMode).title}
            </span>
          </div>
          <p className="text-xs text-slate-300">{getGameModeConfig(selectedMode).rulesSummary}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {selectedMode !== 'quick_match' && selectedMode !== 'penalties' && (
            <button
              type="button"
              data-testid="btn-open-versus-modal"
              onClick={() => setModalSetupOpen(true)}
              className="rounded-lg bg-slate-900 hover:bg-slate-800 border border-emerald-500/40 px-3 py-1.5 text-xs font-bold text-emerald-300 cursor-pointer"
            >
              Elegir Local vs Visitante
            </button>
          )}
        </div>
      </div>

      {/* Mode Configuration Panels */}
      {(selectedMode === 'quick_match' || selectedMode === 'penalties') && (
        <MatchSetupModal
          teams={teams}
          initialMode={selectedMode}
          initialHomeTeam={preselectedHomeTeam ?? homeTeam}
          initialAwayTeam={awayTeam}
          difficulty={settings.match.difficulty}
          onUpdateDifficulty={onUpdateDifficulty}
          onLaunchMatch={onLaunchMatch}
          isModal={false}
        />
      )}

      {/* World Cup / Continental / Leagues / Club Cup / Custom Tournament */}
      {selectedMode === 'world_cup' && (
        <div className="rounded-xl bg-[#101923] border border-slate-800 p-5 space-y-4">
          <h3 className="font-display text-2xl font-bold text-white">Copa del Mundo de Selecciones</h3>
          <p className="text-xs text-slate-400">Elige tu selección entre las 211+ asociaciones internacionales y conquista la fase de grupos y eliminatorias.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={homeId.startsWith('nat_') ? homeId : nations[0].id}
              onChange={(e) => setHomeId(e.target.value)}
              className="flex-1 rounded-lg bg-slate-950 border border-slate-700 px-3 py-2.5 text-xs text-white"
            >
              {nations.map((n) => (
                <option key={n.id} value={n.id}>{n.flag} {n.name} ({n.confederation} · OVR {n.overall})</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                const chosen = nations.find((n) => n.id === homeId) ?? nations[0];
                startTournament('Copa del Mundo Atlas', 'world_cup', nations, chosen, false, 16);
              }}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-xs font-bold text-white cursor-pointer min-h-[44px]"
            >
              Iniciar Mundial (16 Selecciones)
            </button>
          </div>
        </div>
      )}

      {selectedMode === 'continental_cup' && (
        <div className="rounded-xl bg-[#101923] border border-slate-800 p-5 space-y-4">
          <h3 className="font-display text-2xl font-bold text-white">Copas Continentales</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <select
              value={confCup}
              onChange={(e) => setConfCup(e.target.value as typeof confCup)}
              className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2.5 text-white"
            >
              <option value="CONMEBOL">Copa América (CONMEBOL)</option>
              <option value="UEFA">Eurocopa (UEFA)</option>
              <option value="CONCACAF">Copa Oro (CONCACAF)</option>
              <option value="CAF">Copa Africana (CAF)</option>
              <option value="AFC">Copa Asiática (AFC)</option>
            </select>
            <select
              value={homeId}
              onChange={(e) => setHomeId(e.target.value)}
              className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2.5 text-white"
            >
              {nations.filter((n) => n.confederation === confCup).map((n) => (
                <option key={n.id} value={n.id}>{n.flag} {n.name} (OVR {n.overall})</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                const pool = nations.filter((n) => n.confederation === confCup);
                const chosen = pool.find((n) => n.id === homeId) ?? pool[0];
                startTournament(`Copa ${confCup}`, 'continental_cup', pool, chosen, false, Math.min(8, pool.length));
              }}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 font-bold text-white cursor-pointer min-h-[44px]"
            >
              Crear Copa Continental
            </button>
          </div>
        </div>
      )}

      {selectedMode === 'league' && (
        <div className="rounded-xl bg-[#101923] border border-slate-800 p-5 space-y-4">
          <h3 className="font-display text-2xl font-bold text-white">Modo Ligas Nacionales</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <select
              value={leagueId}
              onChange={(e) => setLeagueId(e.target.value)}
              className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2.5 text-white"
            >
              {availableLeagues.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
            <select
              value={homeId}
              onChange={(e) => setHomeId(e.target.value)}
              className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2.5 text-white"
            >
              {clubs.filter((c) => c.leagueId === leagueId).map((c) => (
                <option key={c.id} value={c.id}>{c.name} (OVR {c.overall})</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                const pool = clubs.filter((c) => c.leagueId === leagueId);
                const chosen = pool.find((c) => c.id === homeId) ?? pool[0];
                const leagueTitle = availableLeagues.find(([id]) => id === leagueId)?.[1] ?? 'Liga';
                startTournament(leagueTitle, 'league', pool, chosen, false, pool.length);
              }}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 font-bold text-white cursor-pointer min-h-[44px]"
            >
              Comenzar Temporada
            </button>
          </div>
        </div>
      )}

      {selectedMode === 'club_cup' && (
        <div className="rounded-xl bg-[#101923] border border-slate-800 p-5 space-y-4">
          <h3 className="font-display text-2xl font-bold text-white">Copa Internacional de Clubes</h3>
          <div className="flex flex-col sm:flex-row gap-3 text-xs">
            <select
              value={homeId}
              onChange={(e) => setHomeId(e.target.value)}
              className="flex-1 rounded-lg bg-slate-950 border border-slate-700 px-3 py-2.5 text-white"
            >
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.country} · OVR {c.overall})</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                const chosen = clubs.find((c) => c.id === homeId) ?? clubs[0];
                startTournament('Copa de Campeones de Clubes', 'club_cup', clubs, chosen, true, 16);
              }}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 font-bold text-white cursor-pointer min-h-[44px]"
            >
              Iniciar Eliminatoria (16 Clubes)
            </button>
          </div>
        </div>
      )}

      {selectedMode === 'custom_tournament' && (
        <div className="rounded-xl bg-[#101923] border border-slate-800 p-5 space-y-4 text-xs">
          <h3 className="font-display text-2xl font-bold text-white">Torneo Personalizado</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Nombre del torneo"
              className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
            />
            <select
              value={customFormat}
              onChange={(e) => setCustomFormat(e.target.value as 'knockout' | 'groups')}
              className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
            >
              <option value="knockout">Eliminación Directa</option>
              <option value="groups">Fase de Liga + Playoffs</option>
            </select>
            <select
              value={customCount}
              onChange={(e) => setCustomCount(Number(e.target.value) as 4 | 8 | 16)}
              className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
            >
              <option value={4}>4 Equipos</option>
              <option value={8}>8 Equipos</option>
              <option value={16}>16 Equipos</option>
            </select>
            <button
              type="button"
              onClick={() => startTournament(customName, 'custom_tournament', teams, homeTeam, customFormat === 'knockout', customCount)}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 font-bold text-white cursor-pointer min-h-[42px]"
            >
              Crear Torneo
            </button>
          </div>
        </div>
      )}

      {/* Player Career */}
      {selectedMode === 'player_career' && (
        <div className="rounded-xl bg-[#101923] border border-slate-800 p-5 space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-2xl font-bold text-white">Carrera de Jugador</h3>
              <p className="text-slate-400">Crea tu futbolista desde cero, gana experiencia en cancha y evoluciona hasta ser leyenda.</p>
            </div>
            <div className="font-display text-2xl font-extrabold text-emerald-400">
              OVR {career.playerCareer.overall} · POT {career.playerCareer.potential}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Nombre del futbolista</label>
              <input
                type="text"
                value={career.playerCareer.playerName}
                onChange={(e) =>
                  onUpdateCareer({ ...career, playerCareer: { ...career.playerCareer, active: true, playerName: e.target.value } })
                }
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Posición</label>
              <select
                value={career.playerCareer.position}
                onChange={(e) =>
                  onUpdateCareer({ ...career, playerCareer: { ...career.playerCareer, active: true, position: e.target.value as PlayerPosition } })
                }
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
              >
                {(['ST', 'LW', 'RW', 'CAM', 'CM', 'CDM', 'CB', 'LB', 'RB', 'GK'] as PlayerPosition[]).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Club actual</label>
              <select
                value={career.playerCareer.clubId}
                onChange={(e) =>
                  onUpdateCareer({ ...career, playerCareer: { ...career.playerCareer, active: true, clubId: e.target.value } })
                }
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
              >
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 pt-1">
            <div className="rounded-lg bg-slate-950 p-3 text-center">
              <div className="text-slate-400">Partidos</div>
              <div className="font-mono-tabular text-lg font-bold text-white">{career.playerCareer.matchesPlayed}</div>
            </div>
            <div className="rounded-lg bg-slate-950 p-3 text-center">
              <div className="text-slate-400">Goles</div>
              <div className="font-mono-tabular text-lg font-bold text-emerald-400">{career.playerCareer.goals}</div>
            </div>
            <div className="rounded-lg bg-slate-950 p-3 text-center">
              <div className="text-slate-400">XP</div>
              <div className="font-mono-tabular text-lg font-bold text-amber-400">{career.playerCareer.xp}</div>
            </div>
            <div className="rounded-lg bg-slate-950 p-3 text-center">
              <div className="text-slate-400">Temporada</div>
              <div className="font-mono-tabular text-lg font-bold text-white">{career.playerCareer.season}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const club = teamsMap.get(career.playerCareer.clubId) ?? clubs[0];
              const rival = clubs[(clubs.findIndex((c) => c.id === club.id) + 3) % clubs.length];
              onLaunchMatch({ mode: 'player_career', homeTeam: club, awayTeam: rival, userSide: 'home' });
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-5 py-3 text-sm font-bold text-white cursor-pointer min-h-[44px]"
          >
            <Play className="w-4 h-4" />
            <span>Jugar Siguiente Partido de Carrera</span>
          </button>
        </div>
      )}

      {/* Manager Career */}
      {selectedMode === 'manager_career' && (
        <div className="rounded-xl bg-[#101923] border border-slate-800 p-5 space-y-5 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-2xl font-bold text-white">Carrera de Entrenador</h3>
              <p className="text-slate-400">Administra fichajes, táctica del club, presupuesto y confianza de la directiva.</p>
            </div>
            <div className="font-mono-tabular text-sm font-bold text-amber-400">
              Presupuesto: €{career.managerCareer.budgetMillions}M · Confianza: {career.managerCareer.boardConfidence}%
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Club dirigido</label>
              <select
                value={career.managerCareer.clubId}
                onChange={(e) => {
                  const chosen = teamsMap.get(e.target.value);
                  onUpdateCareer({
                    ...career,
                    managerCareer: {
                      ...career.managerCareer,
                      active: true,
                      clubId: e.target.value,
                      budgetMillions: chosen?.budgetMillions ?? 40,
                    },
                  });
                }}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
              >
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} (€{c.budgetMillions}M)</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Estilo Táctico</label>
              <select
                value={career.managerCareer.tacticalStyle}
                onChange={(e) =>
                  onUpdateCareer({
                    ...career,
                    managerCareer: { ...career.managerCareer, active: true, tacticalStyle: e.target.value as TacticalStyle },
                  })
                }
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
              >
                {(Object.keys(TACTICAL_LABELS) as TacticalStyle[]).map((t) => (
                  <option key={t} value={t}>{TACTICAL_LABELS[t]}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  const club = teamsMap.get(career.managerCareer.clubId) ?? clubs[0];
                  const rival = clubs[(clubs.findIndex((c) => c.id === club.id) + 5) % clubs.length];
                  onLaunchMatch({ mode: 'manager_career', homeTeam: club, awayTeam: rival, userSide: 'home' });
                }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white cursor-pointer min-h-[42px]"
              >
                <Play className="w-4 h-4" />
                <span>Dirigir Partido</span>
              </button>
            </div>
          </div>

          {/* Transfer Market */}
          <div>
            <div className="font-semibold text-slate-300 mb-2">Mercado de Fichajes Disponible</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {clubs.slice(0, 6).map((sourceClub) => {
                const targetPlayer = sourceClub.players[9] ?? sourceClub.players[0];
                const fee = Math.max(4, Math.round((targetPlayer.overall - 60) * 1.4));
                return (
                  <div key={sourceClub.id} className="rounded-lg bg-slate-950 border border-slate-800 p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate">{targetPlayer.name}</div>
                      <div className="text-slate-400">{targetPlayer.position} · OVR {targetPlayer.overall} · {sourceClub.shortName}</div>
                    </div>
                    <button
                      type="button"
                      disabled={career.managerCareer.budgetMillions < fee || sourceClub.id === career.managerCareer.clubId}
                      onClick={() => onSignPlayerToClub(career.managerCareer.clubId, sourceClub.id, 9, fee)}
                      className="rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 px-2.5 py-1.5 text-[11px] font-bold text-white cursor-pointer shrink-0"
                    >
                      Fichar €{fee}M
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Club Career */}
      {selectedMode === 'club_career' && (
        <div className="rounded-xl bg-[#101923] border border-slate-800 p-5 space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-2xl font-bold text-white">Carrera de Club</h3>
              <p className="text-slate-400">Mejora las instalaciones del club, potencia tu cantera y construye un proyecto multitemporada.</p>
            </div>
            <div className="font-mono-tabular font-bold text-amber-400">Fondo del Club: €{career.clubCareer.budgetMillions}M</div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { key: 'stadiumLevel', label: 'Estadio' },
              { key: 'academyLevel', label: 'Cantera Juvenil' },
              { key: 'trainingLevel', label: 'Centro Entreno' },
              { key: 'medicalLevel', label: 'Área Médica' },
            ].map((fac) => {
              const lvl = Number(career.clubCareer[fac.key as keyof CareerProfile['clubCareer']]);
              const cost = lvl * 6;
              return (
                <div key={fac.key} className="rounded-lg bg-slate-950 border border-slate-800 p-3 space-y-2">
                  <div className="font-semibold text-white">{fac.label}</div>
                  <div className="font-mono-tabular text-emerald-400 font-bold">Nivel {lvl} / 5</div>
                  <button
                    type="button"
                    disabled={lvl >= 5 || career.clubCareer.budgetMillions < cost}
                    onClick={() =>
                      onUpdateCareer({
                        ...career,
                        clubCareer: {
                          ...career.clubCareer,
                          active: true,
                          budgetMillions: career.clubCareer.budgetMillions - cost,
                          [fac.key]: lvl + 1,
                        },
                      })
                    }
                    className="w-full rounded bg-slate-800 hover:bg-emerald-700 disabled:opacity-40 py-1.5 font-semibold text-white cursor-pointer"
                  >
                    {lvl >= 5 ? 'Máximo' : `Mejorar (€${cost}M)`}
                  </button>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              const club = teamsMap.get(career.clubCareer.clubId) ?? clubs[2];
              const rival = clubs[(clubs.findIndex((c) => c.id === club.id) + 4) % clubs.length];
              onLaunchMatch({ mode: 'club_career', homeTeam: club, awayTeam: rival, userSide: 'home' });
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-5 py-3 text-sm font-bold text-white cursor-pointer min-h-[44px]"
          >
            <Play className="w-4 h-4" />
            <span>Disputar Partido del Club</span>
          </button>
        </div>
      )}

      {/* Training & Free-Kicks Mode */}
      {selectedMode === 'training' && (
        <MatchSetupModal
          teams={teams}
          initialMode="training"
          initialHomeTeam={preselectedHomeTeam ?? homeTeam}
          initialAwayTeam={awayTeam}
          difficulty={settings.match.difficulty}
          onUpdateDifficulty={onUpdateDifficulty}
          onLaunchMatch={onLaunchMatch}
          isModal={false}
        />
      )}

      {/* Challenges Mode */}
      {selectedMode === 'challenges' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CHALLENGE_SCENARIOS.map((ch) => {
            const h = teamsMap.get(ch.homeTeamId) ?? homeTeam;
            const a = teamsMap.get(ch.awayTeamId) ?? awayTeam;
            return (
              <div key={ch.id} className="rounded-xl bg-[#101923] border border-slate-800 p-5 flex flex-col justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-amber-400">
                    {DIFFICULTY_LABELS[ch.difficulty]} · Inicio {ch.startMinute}&apos; ({ch.initialHomeGoals}-{ch.initialAwayGoals})
                  </div>
                  <h3 className="font-display text-xl font-bold text-white mt-1">{ch.title}</h3>
                  <p className="text-xs text-slate-400 mt-1">{ch.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onLaunchMatch({
                      mode: 'challenges',
                      homeTeam: h,
                      awayTeam: a,
                      userSide: ch.userSide,
                      difficultyOverride: ch.difficulty,
                      startMinute: ch.startMinute,
                      initialHomeGoals: ch.initialHomeGoals,
                      initialAwayGoals: ch.initialAwayGoals,
                    })
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 py-2.5 text-xs font-bold text-white cursor-pointer min-h-[42px]"
                >
                  <span>Aceptar Desafío</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Survival Mode */}
      {selectedMode === 'survival' && (
        <div className="rounded-xl bg-[#101923] border border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-2xl font-bold text-white">Modo Supervivencia</h3>
              <p className="text-xs text-slate-400">
                Cada victoria aumenta la fuerza del rival y sube automáticamente la dificultad hasta ULTRA DIFÍCIL.
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400">Racha actual</div>
              <div className="font-display text-3xl font-extrabold text-amber-400 tabular-nums">{survivalStreak}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const sorted = [...teams].sort((a, b) => a.overall - b.overall);
              const idx = Math.min(sorted.length - 1, 20 + survivalStreak * 18);
              const nextRival = sorted[idx] ?? awayTeam;
              const nextDiff = Math.min(8, Math.max(2, 2 + survivalStreak)) as DifficultyLevel;
              onLaunchMatch({
                mode: 'survival',
                homeTeam,
                awayTeam: nextRival,
                userSide: 'home',
                difficultyOverride: nextDiff,
              });
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-6 py-3 text-sm font-bold text-white cursor-pointer min-h-[44px]"
          >
            <Play className="w-4 h-4" />
            <span>Siguiente Duelo (Dificultad {DIFFICULTY_LABELS[Math.min(8, Math.max(2, 2 + survivalStreak)) as DifficultyLevel]})</span>
          </button>
        </div>
      )}

      {/* All-Star Mode */}
      {selectedMode === 'all_star' && (
        <div className="rounded-xl bg-[#101923] border border-slate-800 p-5 space-y-4">
          <h3 className="font-display text-2xl font-bold text-white">Exhibición All-Star e Históricos</h3>
          <p className="text-xs text-slate-400">
            Enfrenta a las selecciones de estrellas mundiales y clubes legendarios.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {teams.filter((t) => t.isHistoric).map((t) => (
              <div key={t.id} className="rounded-lg bg-slate-950 border border-slate-800 p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <TeamCrest team={t} size={40} />
                  <div>
                    <div className="font-display text-lg font-bold text-white">{t.name}</div>
                    <div className="text-xs text-amber-400 font-mono-tabular">OVR {t.overall} · {t.leagueName}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const opp = teams.find((o) => o.isHistoric && o.id !== t.id) ?? awayTeam;
                    onLaunchMatch({ mode: 'all_star', homeTeam: t, awayTeam: opp, userSide: 'home' });
                  }}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white cursor-pointer min-h-[38px]"
                >
                  Jugar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {modalSetupOpen && (
        <MatchSetupModal
          teams={teams}
          initialMode={selectedMode}
          initialHomeTeam={preselectedHomeTeam ?? homeTeam}
          initialAwayTeam={awayTeam}
          difficulty={settings.match.difficulty}
          onUpdateDifficulty={onUpdateDifficulty}
          onLaunchMatch={(req) => {
            setModalSetupOpen(false);
            onLaunchMatch(req);
          }}
          onClose={() => setModalSetupOpen(false)}
          isModal={true}
        />
      )}
    </div>
  );
};
