import React, { useEffect, useMemo, useState } from 'react';
import {
  Play,
  Shuffle,
  SlidersHorizontal,
  Shield,
  Swords,
  Target,
  Dumbbell,
  Sparkles,
  Star,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import {
  DIFFICULTY_LABELS,
  TACTICAL_LABELS,
  type DifficultyLevel,
  type GameMode,
  type GameSettings,
  type KitSelection,
  type TacticalStyle,
  type Team,
  type TimeOfDay,
  type WeatherType,
} from '../types/football';
import { resolveActiveKitColors } from '../data/authenticAssets';
import { FORMATIONS, getFormation } from '../data/formations';
import { getGameModeConfig, resolveKitClash } from '../engine/gameModeManager';
import { TeamCrest } from './TeamCrest';
import { TeamCoverBanner } from './TeamCoverBanner';
import { TacticalFormationBoard } from './TacticalFormationBoard';
import type { LaunchMatchRequest } from './GameModesHub';

export interface MatchSetupModalProps {
  teams: Team[];
  initialMode: GameMode;
  initialHomeTeam?: Team | null;
  initialAwayTeam?: Team | null;
  initialTwoPlayerMode?: boolean;
  initialTrainingDrill?: 'free_play' | 'shooting' | 'passing' | 'dribbling' | 'free_kicks';
  difficulty: DifficultyLevel;
  onUpdateDifficulty?: (d: DifficultyLevel) => void;
  onLaunchMatch: (req: LaunchMatchRequest) => void;
  onClose?: () => void;
  isModal?: boolean;
}

type TeamFilterCategory = 'all' | 'club' | 'national' | 'historic';

export const MatchSetupModal: React.FC<MatchSetupModalProps> = ({
  teams,
  initialMode,
  initialHomeTeam,
  initialAwayTeam,
  initialTwoPlayerMode = false,
  initialTrainingDrill = 'free_play',
  difficulty,
  onUpdateDifficulty,
  onLaunchMatch,
  onClose,
  isModal = false,
}) => {
  const [activeMode, setActiveMode] = useState<GameMode>(initialMode);
  const [trainingDrill, setTrainingDrill] = useState<
    'free_play' | 'shooting' | 'passing' | 'dribbling' | 'free_kicks'
  >(initialTrainingDrill);

  useEffect(() => {
    setActiveMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    setTrainingDrill(initialTrainingDrill);
  }, [initialTrainingDrill]);

  const teamsMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const clubs = useMemo(() => teams.filter((t) => t.type === 'club'), [teams]);

  const [homeFilter, setHomeFilter] = useState<TeamFilterCategory>('all');
  const [awayFilter, setAwayFilter] = useState<TeamFilterCategory>('all');
  const [homeId, setHomeId] = useState<string>(
    initialHomeTeam?.id ?? clubs[0]?.id ?? teams[0]?.id ?? ''
  );
  const [awayId, setAwayId] = useState<string>(
    initialAwayTeam?.id ?? clubs[1]?.id ?? teams[1]?.id ?? teams[0]?.id ?? ''
  );

  const baseHomeTeam = teamsMap.get(homeId) ?? teams[0];
  const baseAwayTeam = teamsMap.get(awayId) ?? teams[1] ?? teams[0];

  const [homeFormationId, setHomeFormationId] = useState<string>(
    baseHomeTeam.formationId || '4-3-3'
  );
  const [awayFormationId, setAwayFormationId] = useState<string>(
    baseAwayTeam.formationId || '4-2-3-1'
  );
  const [homeTactic, setHomeTactic] = useState<TacticalStyle>(
    baseHomeTeam.tacticalStyle || 'equilibrado'
  );
  const [awayTactic, setAwayTactic] = useState<TacticalStyle>(
    baseAwayTeam.tacticalStyle || 'contraataque'
  );

  const [requestedHomeKit, setRequestedHomeKit] = useState<KitSelection>('home');
  const [requestedAwayKit, setRequestedAwayKit] = useState<KitSelection>('home');
  const [twoPlayerMode, setTwoPlayerMode] = useState<boolean>(initialTwoPlayerMode);
  const [showTacticsDrawer, setShowTacticsDrawer] = useState<boolean>(false);
  const [tacticalBoardSide, setTacticalBoardSide] = useState<'home' | 'away'>('home');
  const [setupTimeOfDay, setSetupTimeOfDay] = useState<TimeOfDay | 'aleatorio'>('noche');
  const [setupWeather, setSetupWeather] = useState<WeatherType | 'aleatorio'>('despejado');
  const [setupQuality, setSetupQuality] = useState<GameSettings['visual']['quality']>('alta');

  // Auto-resolve kit clash when both sides choose the same team or similar primary kit colors
  const kitResolution = useMemo(
    () => resolveKitClash(baseHomeTeam, baseAwayTeam, requestedHomeKit, requestedAwayKit),
    [baseHomeTeam, baseAwayTeam, requestedHomeKit, requestedAwayKit]
  );

  const homeTeam = useMemo<Team>(
    () => ({
      ...baseHomeTeam,
      formationId: homeFormationId,
      tacticalStyle: homeTactic,
    }),
    [baseHomeTeam, homeFormationId, homeTactic]
  );

  const awayTeam = useMemo<Team>(
    () => ({
      ...baseAwayTeam,
      formationId: awayFormationId,
      tacticalStyle: awayTactic,
    }),
    [baseAwayTeam, awayFormationId, awayTactic]
  );

  const filterTeamPool = (cat: TeamFilterCategory): Team[] => {
    if (cat === 'club') {
      return teams.filter(
        (t) => t.type === 'club' && t.leagueId !== 'hist' && t.leagueId !== 'allstar'
      );
    }
    if (cat === 'national') {
      return teams.filter((t) => t.type === 'national');
    }
    if (cat === 'historic') {
      return teams.filter((t) => t.leagueId === 'hist' || t.leagueId === 'allstar');
    }
    return teams;
  };

  const homePool = useMemo(() => filterTeamPool(homeFilter), [homeFilter, teams]);
  const awayPool = useMemo(() => filterTeamPool(awayFilter), [awayFilter, teams]);

  const handleSelectHomeTeam = (nextId: string) => {
    setHomeId(nextId);
    const nextTeam = teamsMap.get(nextId);
    if (nextTeam) {
      setHomeFormationId(nextTeam.formationId || '4-3-3');
      setHomeTactic(nextTeam.tacticalStyle || 'equilibrado');
    }
  };

  const handleSelectAwayTeam = (nextId: string) => {
    setAwayId(nextId);
    const nextTeam = teamsMap.get(nextId);
    if (nextTeam) {
      setAwayFormationId(nextTeam.formationId || '4-2-3-1');
      setAwayTactic(nextTeam.tacticalStyle || 'contraataque');
    }
  };

  const cycleTeam = (side: 'home' | 'away', dir: -1 | 1) => {
    const pool = side === 'home' ? homePool : awayPool;
    if (pool.length === 0) return;
    const currentId = side === 'home' ? homeId : awayId;
    const idx = pool.findIndex((t) => t.id === currentId);
    const nextIdx = idx === -1 ? 0 : (idx + dir + pool.length) % pool.length;
    const chosen = pool[nextIdx];
    if (side === 'home') handleSelectHomeTeam(chosen.id);
    else handleSelectAwayTeam(chosen.id);
  };

  const pickRandomRival = () => {
    const candidates = awayPool.length > 1 ? awayPool : teams;
    const filtered = candidates.filter((t) => t.id !== awayId);
    const pool = filtered.length > 0 ? filtered : candidates;
    const randomTeam = pool[Math.floor(Math.random() * pool.length)];
    if (randomTeam) {
      handleSelectAwayTeam(randomTeam.id);
    }
  };

  const modeConfig = getGameModeConfig(activeMode);

  const handleStartMatch = () => {
    const times: TimeOfDay[] = ['dia', 'atardecer', 'noche'];
    const weathers: WeatherType[] = ['despejado', 'lluvia', 'neblina', 'tormenta'];
    const resolvedTime: TimeOfDay =
      setupTimeOfDay === 'aleatorio'
        ? times[Math.floor(Math.random() * times.length)]
        : setupTimeOfDay;
    const resolvedWeather: WeatherType =
      setupWeather === 'aleatorio'
        ? weathers[Math.floor(Math.random() * weathers.length)]
        : setupWeather;

    onLaunchMatch({
      mode: activeMode,
      homeTeam,
      awayTeam,
      homeKit: kitResolution.homeKit,
      awayKit: kitResolution.awayKit,
      userSide: 'home',
      twoPlayerMode,
      timeOfDayOverride: resolvedTime,
      weatherOverride: resolvedWeather,
      qualityOverride: setupQuality,
      trainingDrill: activeMode === 'training' ? trainingDrill : undefined,
    });
  };

  const renderStatBar = (label: string, val: number, colorClass: string) => (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-slate-400">{label}</span>
        <span className="font-mono-tabular font-extrabold text-white">{val}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`h-full rounded-full ${colorClass}`}
          style={{ width: `${Math.max(25, Math.min(100, val))}%` }}
        />
      </div>
    </div>
  );

  const content = (
    <div
      data-testid="match-setup-container"
      className="rounded-2xl bg-[#101923] border border-slate-800 p-4 sm:p-6 space-y-5 shadow-2xl"
    >
      {/* Header & Mode Rules Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-400">
            <span>CONFIGURACIÓN DE ENFRENTAMIENTO · MATCH SETUP</span>
            <span className="rounded bg-emerald-500/15 border border-emerald-500/40 px-2 py-0.5 text-[10px] text-emerald-300">
              {modeConfig.broadcastLabel}
            </span>
          </div>
          <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
            {activeMode === 'training' && trainingDrill === 'free_kicks'
              ? 'Laboratorio de Tiros Libres y Faltas'
              : modeConfig.title}
          </h3>
          <p className="text-xs text-slate-300 max-w-3xl">{modeConfig.rulesSummary}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Horario del Partido Selector */}
          <div className="flex items-center gap-1.5 bg-slate-950/90 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs">
            <span className="text-slate-400">Horario:</span>
            <select
              aria-label="Horario del partido"
              data-testid="select-setup-time"
              value={setupTimeOfDay}
              onChange={(e) => setSetupTimeOfDay(e.target.value as TimeOfDay | 'aleatorio')}
              className="bg-transparent font-bold text-amber-300 focus:outline-none cursor-pointer"
            >
              <option value="dia" className="bg-[#101923] text-white">☀ Día / Tarde</option>
              <option value="atardecer" className="bg-[#101923] text-white">🌅 Atardecer</option>
              <option value="noche" className="bg-[#101923] text-white">🌙 Noche (LED)</option>
              <option value="aleatorio" className="bg-[#101923] text-white">🎲 Aleatorio</option>
            </select>
          </div>

          {/* Clima Dinámico Selector */}
          <div className="flex items-center gap-1.5 bg-slate-950/90 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs">
            <span className="text-slate-400">Clima:</span>
            <select
              aria-label="Clima del partido"
              data-testid="select-setup-weather"
              value={setupWeather}
              onChange={(e) => setSetupWeather(e.target.value as WeatherType | 'aleatorio')}
              className="bg-transparent font-bold text-sky-300 focus:outline-none cursor-pointer"
            >
              <option value="despejado" className="bg-[#101923] text-white">☀ Despejado</option>
              <option value="lluvia" className="bg-[#101923] text-white">🌧 Lluvia Intensa</option>
              <option value="neblina" className="bg-[#101923] text-white">🌫 Neblina Ligera</option>
              <option value="tormenta" className="bg-[#101923] text-white">⚡ Tormenta</option>
              <option value="aleatorio" className="bg-[#101923] text-white">🎲 Aleatorio</option>
            </select>
          </div>

          {/* Calidad Gráfica Selector */}
          <div className="flex items-center gap-1.5 bg-slate-950/90 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs">
            <span className="text-slate-400">Gráficos:</span>
            <select
              aria-label="Calidad gráfica"
              data-testid="select-setup-quality"
              value={setupQuality}
              onChange={(e) => setSetupQuality(e.target.value as GameSettings['visual']['quality'])}
              className="bg-transparent font-bold text-fuchsia-300 focus:outline-none cursor-pointer"
            >
              <option value="baja" className="bg-[#101923] text-white">Bajo (Fluidez)</option>
              <option value="media" className="bg-[#101923] text-white">Medio</option>
              <option value="alta" className="bg-[#101923] text-white">Alto (Sombras 3D)</option>
            </select>
          </div>

          {onUpdateDifficulty && (
            <div className="flex items-center gap-2 bg-slate-950/90 border border-slate-800 rounded-lg px-3 py-1.5 text-xs">
              <span className="text-slate-400">Dificultad IA:</span>
              <select
                aria-label="Dificultad del partido"
                value={difficulty}
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
          )}

          {isModal && onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar selector de equipos"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/90 hover:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Cerrar</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Mode & Scenario Variant Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-950/75 border border-slate-800/90 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-400 mr-1">Modo Directo:</span>
          {(
            [
              { id: 'quick_match', label: 'Partido Rápido 11v11', drill: undefined, icon: Play },
              { id: 'penalties', label: 'Tanda de Penales', drill: undefined, icon: Target },
              {
                id: 'training',
                label: 'Tiros Libres / Faltas',
                drill: 'free_kicks' as const,
                icon: Sparkles,
              },
              {
                id: 'training',
                label: 'Entrenamiento Libre',
                drill: 'free_play' as const,
                icon: Dumbbell,
              },
              { id: 'survival', label: 'Supervivencia (Gol de Oro)', drill: undefined, icon: Swords },
              { id: 'all_star', label: 'All-Star / Leyendas', drill: undefined, icon: Star },
            ] as const
          ).map((item, idx) => {
            const Icon = item.icon;
            const isSelected =
              activeMode === item.id &&
              (item.id !== 'training' ||
                (item.drill === 'free_kicks'
                  ? trainingDrill === 'free_kicks'
                  : trainingDrill !== 'free_kicks'));
            return (
              <button
                key={`${item.id}_${idx}`}
                type="button"
                data-testid={`setup-mode-${item.id}${item.drill ? `-${item.drill}` : ''}`}
                onClick={() => {
                  setActiveMode(item.id);
                  if (item.drill) setTrainingDrill(item.drill);
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold border transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-600 border-emerald-400 text-white shadow'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Training Drill Sub-Selector when mode === 'training' */}
        {activeMode === 'training' && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-amber-300">Ejercicio:</span>
            {(
              [
                { id: 'free_play', label: 'Partido Libre' },
                { id: 'free_kicks', label: 'Tiros Libres con Barrera' },
                { id: 'shooting', label: 'Definición' },
                { id: 'passing', label: 'Pases y Rondo' },
                { id: 'dribbling', label: 'Regates 1v1' },
              ] as const
            ).map((d) => (
              <button
                key={d.id}
                type="button"
                data-testid={`setup-drill-${d.id}`}
                onClick={() => setTrainingDrill(d.id)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-bold border cursor-pointer ${
                  trainingDrill === d.id
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* LOCAL VS VISITANTE TEAM SELECTOR GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ==================== EQUIPO LOCAL (TÚ / J1) ==================== */}
        <div
          data-testid="setup-home-panel"
          className="rounded-xl bg-slate-950/75 border border-slate-800 p-4 space-y-3.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-extrabold text-emerald-300">
                LOCAL · TÚ (J1)
              </span>
              <span className="text-xs font-bold text-white">{homeTeam.name}</span>
            </div>
            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'all', label: 'Todos' },
                  { id: 'club', label: 'Clubes' },
                  { id: 'national', label: 'Selecciones' },
                  { id: 'historic', label: 'Leyendas' },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setHomeFilter(cat.id);
                    const nextPool = filterTeamPool(cat.id);
                    if (nextPool.length > 0 && !nextPool.some((t) => t.id === homeId)) {
                      handleSelectHomeTeam(nextPool[0].id);
                    }
                  }}
                  className={`rounded px-2 py-0.5 text-[10px] font-bold cursor-pointer ${
                    homeFilter === cat.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <TeamCoverBanner team={homeTeam} />

          {/* Team Selector Dropdown + Prev/Next */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Equipo local anterior"
              onClick={() => cycleTeam('home', -1)}
              className="rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 p-2 text-slate-300 hover:text-white cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <select
              aria-label="Equipo local"
              data-testid="select-setup-home-team"
              value={homeId}
              onChange={(e) => handleSelectHomeTeam(e.target.value)}
              className="flex-1 rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-bold text-white"
            >
              {homePool.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.type === 'national' ? `${t.flag ?? ''} ` : ''}
                  {t.name} (OVR {t.overall} · ATA {t.attack} · MED {t.midfield} · DEF {t.defense})
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label="Siguiente equipo local"
              onClick={() => cycleTeam('home', 1)}
              className="rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 p-2 text-slate-300 hover:text-white cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Team Stats Bars: Ataque, Medio, Defensa & Default Formation */}
          <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-3 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <TeamCrest team={homeTeam} size={26} />
                <div>
                  <div className="text-xs font-extrabold text-white">
                    Media Global OVR: <span className="text-emerald-400">{homeTeam.overall}</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Formación Activa:{' '}
                    <span className="text-emerald-300 font-bold">
                      {getFormation(homeFormationId).nombre}
                    </span>
                  </div>
                </div>
              </div>
              <span
                className="w-5 h-5 rounded-full border border-white/30"
                style={{ backgroundColor: homeTeam.primaryColor }}
                title={`Color principal ${homeTeam.primaryColor}`}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              {renderStatBar('ATAQUE', homeTeam.attack, 'bg-emerald-500')}
              {renderStatBar('MEDIO', homeTeam.midfield, 'bg-sky-400')}
              {renderStatBar('DEFENSA', homeTeam.defense, 'bg-amber-400')}
            </div>
          </div>

          {/* Quick Formation & Tactical Style Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-semibold">Esquema Táctico:</label>
              <select
                aria-label="Formación equipo local"
                data-testid="select-home-formation"
                value={homeFormationId}
                onChange={(e) => {
                  setHomeFormationId(e.target.value);
                  setTacticalBoardSide('home');
                }}
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-emerald-300 font-semibold"
              >
                {FORMATIONS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nombre} · ({f.categoria})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-semibold">Estilo Táctico:</label>
              <select
                aria-label="Estilo táctico local"
                value={homeTactic}
                onChange={(e) => setHomeTactic(e.target.value as TacticalStyle)}
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-white font-semibold"
              >
                {(Object.keys(TACTICAL_LABELS) as TacticalStyle[]).map((st) => (
                  <option key={st} value={st}>
                    {TACTICAL_LABELS[st]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Home Kit Selection */}
          <div className="flex items-center justify-between pt-1 text-xs">
            <span className="text-slate-400 font-semibold">Uniforme Local:</span>
            <div className="flex items-center gap-1.5">
              {(['home', 'away', 'third'] as KitSelection[]).map((k) => {
                const colors = resolveActiveKitColors(homeTeam, k);
                return (
                  <button
                    key={k}
                    type="button"
                    data-testid={`btn-home-kit-${k}`}
                    onClick={() => setRequestedHomeKit(k)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 border text-[11px] font-semibold cursor-pointer ${
                      kitResolution.homeKit === k
                        ? 'bg-emerald-950 border-emerald-400 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-400'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-white/40"
                      style={{ backgroundColor: colors.primary }}
                    />
                    <span>{k === 'home' ? 'Local' : k === 'away' ? 'Suplente' : '3ra'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ==================== EQUIPO VISITANTE (RIVAL CPU O J2) ==================== */}
        <div
          data-testid="setup-away-panel"
          className="rounded-xl bg-slate-950/75 border border-slate-800 p-4 space-y-3.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded bg-sky-500/20 border border-sky-500/40 px-2 py-0.5 text-[10px] font-extrabold text-sky-300">
                {twoPlayerMode ? 'VISITANTE · JUGADOR 2' : 'VISITANTE · RIVAL CPU'}
              </span>
              <span className="text-xs font-bold text-white">{awayTeam.name}</span>
            </div>

            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'all', label: 'Todos' },
                  { id: 'club', label: 'Clubes' },
                  { id: 'national', label: 'Selecciones' },
                  { id: 'historic', label: 'Leyendas' },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setAwayFilter(cat.id);
                    const nextPool = filterTeamPool(cat.id);
                    if (nextPool.length > 0 && !nextPool.some((t) => t.id === awayId)) {
                      handleSelectAwayTeam(nextPool[0].id);
                    }
                  }}
                  className={`rounded px-2 py-0.5 text-[10px] font-bold cursor-pointer ${
                    awayFilter === cat.id
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Visitor Control Switch (IA Rival vs Jugador 2) + Random Rival Button */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-900/90 border border-slate-700/80 p-1.5 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-300 font-semibold pl-1">Control:</span>
              <button
                type="button"
                data-testid="btn-visitor-ai"
                onClick={() => setTwoPlayerMode(false)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                  !twoPlayerMode
                    ? 'bg-emerald-600 text-white shadow'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                IA Rival
              </button>
              <button
                type="button"
                data-testid="btn-visitor-p2"
                onClick={() => setTwoPlayerMode(true)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                  twoPlayerMode
                    ? 'bg-emerald-600 text-white shadow'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Jugador 2 (2P)
              </button>
            </div>

            <button
              type="button"
              data-testid="btn-random-rival"
              onClick={pickRandomRival}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 px-2.5 py-1 text-[11px] font-bold text-amber-300 cursor-pointer"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>Rival Aleatorio</span>
            </button>
          </div>

          <TeamCoverBanner team={awayTeam} />

          {/* Team Selector Dropdown + Prev/Next */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Equipo visitante anterior"
              onClick={() => cycleTeam('away', -1)}
              className="rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 p-2 text-slate-300 hover:text-white cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <select
              aria-label="Equipo visitante"
              data-testid="select-setup-away-team"
              value={awayId}
              onChange={(e) => handleSelectAwayTeam(e.target.value)}
              className="flex-1 rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-bold text-white"
            >
              {awayPool.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.type === 'national' ? `${t.flag ?? ''} ` : ''}
                  {t.name} (OVR {t.overall} · ATA {t.attack} · MED {t.midfield} · DEF {t.defense})
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label="Siguiente equipo visitante"
              onClick={() => cycleTeam('away', 1)}
              className="rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 p-2 text-slate-300 hover:text-white cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Team Stats Bars: Ataque, Medio, Defensa & Default Formation */}
          <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-3 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <TeamCrest team={awayTeam} size={26} />
                <div>
                  <div className="text-xs font-extrabold text-white">
                    Media Global OVR: <span className="text-sky-400">{awayTeam.overall}</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Formación Activa:{' '}
                    <span className="text-sky-300 font-bold">
                      {getFormation(awayFormationId).nombre}
                    </span>
                  </div>
                </div>
              </div>
              <span
                className="w-5 h-5 rounded-full border border-white/30"
                style={{
                  backgroundColor: resolveActiveKitColors(awayTeam, kitResolution.awayKit).primary,
                }}
                title="Color activo visitante"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              {renderStatBar('ATAQUE', awayTeam.attack, 'bg-emerald-500')}
              {renderStatBar('MEDIO', awayTeam.midfield, 'bg-sky-400')}
              {renderStatBar('DEFENSA', awayTeam.defense, 'bg-amber-400')}
            </div>
          </div>

          {/* Quick Formation & Tactical Style Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-semibold">Esquema Táctico:</label>
              <select
                aria-label="Formación equipo visitante"
                data-testid="select-away-formation"
                value={awayFormationId}
                onChange={(e) => {
                  setAwayFormationId(e.target.value);
                  setTacticalBoardSide('away');
                }}
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-sky-300 font-semibold"
              >
                {FORMATIONS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nombre} · ({f.categoria})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-semibold">Estilo Táctico:</label>
              <select
                aria-label="Estilo táctico visitante"
                value={awayTactic}
                onChange={(e) => setAwayTactic(e.target.value as TacticalStyle)}
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-white font-semibold"
              >
                {(Object.keys(TACTICAL_LABELS) as TacticalStyle[]).map((st) => (
                  <option key={st} value={st}>
                    {TACTICAL_LABELS[st]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Away Kit Selection + Auto Kit-Clash Notification */}
          <div className="space-y-1.5 pt-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-semibold">Uniforme Visitante:</span>
              <div className="flex items-center gap-1.5">
                {(['home', 'away', 'third'] as KitSelection[]).map((k) => {
                  const colors = resolveActiveKitColors(awayTeam, k);
                  return (
                    <button
                      key={k}
                      type="button"
                      data-testid={`btn-away-kit-${k}`}
                      onClick={() => setRequestedAwayKit(k)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 border text-[11px] font-semibold cursor-pointer ${
                        kitResolution.awayKit === k
                          ? 'bg-emerald-950 border-emerald-400 text-white'
                          : 'bg-slate-900 border-slate-700 text-slate-400'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-white/40"
                        style={{ backgroundColor: colors.primary }}
                      />
                      <span>{k === 'home' ? 'Local' : k === 'away' ? 'Suplente' : '3ra'}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {kitResolution.autoResolved && kitResolution.reason && (
              <div
                data-testid="kit-clash-badge"
                className="flex items-center gap-1.5 rounded-lg bg-amber-500/15 border border-amber-400/40 px-2.5 py-1 text-[11px] font-semibold text-amber-300"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{kitResolution.reason}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Access to Tactics & Interactive 2D Formation Board */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-950/70 border border-slate-800 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-xs font-extrabold text-white">
                Pizarra Táctica Interactiva (37 Esquemas de Fútbol 11)
              </div>
              <div className="text-[11px] text-slate-400">
                Local: <span className="text-emerald-300 font-bold">{homeFormationId}</span> ·
                Visitante: <span className="text-sky-300 font-bold">{awayFormationId}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="btn-toggle-setup-tactics"
              onClick={() => setShowTacticsDrawer((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-emerald-500/40 px-3 py-1.5 text-xs font-bold text-emerald-300 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>
                {showTacticsDrawer ? 'Ocultar Pizarra 2D' : 'Cambiar Formación en Cancha 2D'}
              </span>
            </button>
          </div>
        </div>

        {showTacticsDrawer && (
          <div className="space-y-2.5 rounded-xl bg-slate-950/60 border border-slate-800 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold text-slate-300">
                Editando coordenadas de:{' '}
                <span className="text-emerald-400">
                  {tacticalBoardSide === 'home'
                    ? `${homeTeam.name} (${getFormation(homeFormationId).nombre})`
                    : `${awayTeam.name} (${getFormation(awayFormationId).nombre})`}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  data-testid="btn-board-team-home"
                  onClick={() => setTacticalBoardSide('home')}
                  className={`rounded-lg px-3 py-1 text-xs font-bold border cursor-pointer ${
                    tacticalBoardSide === 'home'
                      ? 'bg-emerald-600 border-emerald-400 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  Táctica Local ({homeTeam.shortName})
                </button>
                <button
                  type="button"
                  data-testid="btn-board-team-away"
                  onClick={() => setTacticalBoardSide('away')}
                  className={`rounded-lg px-3 py-1 text-xs font-bold border cursor-pointer ${
                    tacticalBoardSide === 'away'
                      ? 'bg-emerald-600 border-emerald-400 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  Táctica Visitante ({awayTeam.shortName})
                </button>
              </div>
            </div>

            <TacticalFormationBoard
              selectedFormationId={
                tacticalBoardSide === 'home' ? homeFormationId : awayFormationId
              }
              onSelectFormation={(fId) => {
                if (tacticalBoardSide === 'home') {
                  setHomeFormationId(fId);
                } else {
                  setAwayFormationId(fId);
                }
              }}
              team={tacticalBoardSide === 'home' ? homeTeam : awayTeam}
            />
          </div>
        )}
      </div>

      {/* Footer Launch Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-800 pt-4">
        <div className="flex items-center gap-3">
          <TeamCrest team={homeTeam} size={34} />
          <div className="text-xs">
            <div className="font-display text-base font-extrabold text-white">
              {homeTeam.name} <span className="text-emerald-400">({homeFormationId})</span> vs{' '}
              {awayTeam.name} <span className="text-sky-400">({awayFormationId})</span>
            </div>
            <div className="text-[11px] text-slate-400">
              Condición de Victoria: <span className="text-slate-200">{modeConfig.winConditionLabel}</span>
            </div>
          </div>
          <TeamCrest team={awayTeam} size={34} />
        </div>

        <button
          type="button"
          data-start="true"
          data-testid="btn-start-match-setup"
          onClick={handleStartMatch}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-7 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-emerald-950/60 cursor-pointer min-h-[48px]"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>
            {activeMode === 'penalties'
              ? 'Iniciar Tanda de Penales'
              : activeMode === 'training' && trainingDrill === 'free_kicks'
                ? 'Iniciar Tiros Libres'
                : activeMode === 'training'
                  ? 'Iniciar Entrenamiento'
                  : 'Iniciar Partido'}
          </span>
        </button>
      </div>
    </div>
  );

  if (!isModal) {
    return content;
  }

  return (
    <div
      data-testid="match-setup-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto"
    >
      <div className="w-full max-w-6xl my-auto max-h-[92dvh] overflow-y-auto">{content}</div>
    </div>
  );
};
