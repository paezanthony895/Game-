import React, { useEffect, useMemo, useState } from 'react';
import {
  Play,
  Trophy,
  Shield,
  Globe2,
  Briefcase,
  Dumbbell,
  PenTool,
  BarChart3,
  Award,
  Settings,
  Gamepad2,
  Home,
  ShoppingBag,
  Coins,
} from 'lucide-react';
import { getAllTeamsWithCustom, mergeImportedTeamsPatch } from './data/database';
import { advanceCompetitionRound } from './engine/competitions';
import {
  equipUnlockableItem,
  getDefaultSaveState,
  loadSaveState,
  persistSaveState,
  purchaseUnlockableItem,
  recordMatchIntoSave,
  type SaveState,
} from './storage/saveManager';
import type { GameMode, MatchResultSummary, Team } from './types/football';
import { soundEngine } from './audio/soundEngine';
import { MatchCanvas } from './components/MatchCanvas';
import { GameModesHub, type LaunchMatchRequest } from './components/GameModesHub';
import { MatchSetupModal } from './components/MatchSetupModal';
import { StoreModal } from './components/StoreModal';
import { resolveKitClash } from './engine/gameModeManager';
import { DatabaseBrowser } from './components/DatabaseBrowser';
import { EditorStudio } from './components/EditorStudio';
import { StatsAndAchievements } from './components/StatsAndAchievements';
import { SettingsModal } from './components/SettingsModal';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';

type AppSection =
  | 'title'
  | 'modes'
  | 'clubs'
  | 'nations'
  | 'leagues'
  | 'tournaments'
  | 'career'
  | 'training'
  | 'store'
  | 'editor'
  | 'stats'
  | 'achievements'
  | 'settings';

export default function App() {
  const [save, setSave] = useState<SaveState>(() => loadSaveState());
  const [section, setSection] = useState<AppSection>('title');
  const [activeMatch, setActiveMatch] = useState<LaunchMatchRequest | null>(null);
  const [preselectedHome, setPreselectedHome] = useState<Team | null>(null);
  const [storeModalOpen, setStoreModalOpen] = useState<boolean>(false);
  const [preMatchSetup, setPreMatchSetup] = useState<{
    mode: GameMode;
    homeTeam?: Team | null;
    twoPlayer?: boolean;
    trainingDrill?: 'free_play' | 'shooting' | 'passing' | 'dribbling' | 'free_kicks';
  } | null>(null);

  const allTeams = useMemo(() => getAllTeamsWithCustom(save.customTeams), [save.customTeams]);
  const teamsMap = useMemo(() => new Map(allTeams.map((t) => [t.id, t])), [allTeams]);

  // Persist save changes
  useEffect(() => {
    persistSaveState(save);
    soundEngine.setSettings(save.settings.audio);
  }, [save]);

  const handleLaunchMatch = (req: LaunchMatchRequest) => {
    const kits = resolveKitClash(
      req.homeTeam,
      req.awayTeam,
      req.homeKit ?? 'home',
      req.awayKit ?? 'home'
    );
    setPreMatchSetup(null);
    setActiveMatch({
      ...req,
      homeKit: kits.homeKit,
      awayKit: kits.awayKit,
    });
  };

  // ?autostart=1 support for instant live match entry
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1' && !activeMatch) {
      const h = allTeams[0];
      const a = allTeams[1] ?? allTeams[0];
      handleLaunchMatch({
        mode: 'quick_match',
        homeTeam: h,
        awayTeam: a,
        userSide: 'home',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enter / Space opens Pre-Match Team Selector when on Title stage
  useEffect(() => {
    if (activeMatch || preMatchSetup || storeModalOpen || section !== 'title') return;
    document.body.dataset.state = 'title';
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        openPreMatchSetup('quick_match');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMatch, preMatchSetup, storeModalOpen, section, allTeams]);

  const openPreMatchSetup = (
    mode: GameMode = 'quick_match',
    homeOverride?: Team,
    twoPlayer = false,
    trainingDrill?: 'free_play' | 'shooting' | 'passing' | 'dribbling' | 'free_kicks'
  ) => {
    soundEngine.playUiClick();
    const fav = teamsMap.get(save.settings.profile.favoriteTeamId);
    const home = homeOverride ?? preselectedHome ?? fav ?? allTeams[0];
    setPreMatchSetup({
      mode,
      homeTeam: home,
      twoPlayer,
      trainingDrill,
    });
  };

  const handleMatchFinish = (summary: MatchResultSummary) => {
    setSave((prev) => {
      let next = recordMatchIntoSave(prev, summary);

      // Update Competition if match belonged to active tournament/league
      if (activeMatch?.competitionFixtureId && next.activeCompetition) {
        const updatedComp = advanceCompetitionRound(
          next.activeCompetition,
          activeMatch.competitionFixtureId,
          summary.homeScore,
          summary.awayScore,
          teamsMap
        );
        const trophies = [...next.stats.trophies];
        const wonTitle =
          updatedComp.stage === 'completed' && updatedComp.championTeamId === updatedComp.userTeamId;
        if (wonTitle) {
          trophies.push(`${updatedComp.name} (${new Date().getFullYear()})`);
        }
        next = {
          ...next,
          activeCompetition: updatedComp,
          stats: { ...next.stats, trophies },
          store: wonTitle
            ? { ...next.store, coins: next.store.coins + 200 }
            : next.store,
        };
      }

      // Update Career progress
      if (summary.mode === 'player_career') {
        const goalsEarned = summary.userSide === 'home' ? summary.homeScore : summary.awayScore;
        const xpGain = 45 + goalsEarned * 30;
        const newXp = next.career.playerCareer.xp + xpGain;
        const ovrUp = newXp >= 150 && next.career.playerCareer.overall < next.career.playerCareer.potential ? 1 : 0;
        next = {
          ...next,
          career: {
            ...next.career,
            playerCareer: {
              ...next.career.playerCareer,
              active: true,
              matchesPlayed: next.career.playerCareer.matchesPlayed + 1,
              goals: next.career.playerCareer.goals + goalsEarned,
              xp: ovrUp ? newXp - 150 : newXp,
              overall: next.career.playerCareer.overall + ovrUp,
            },
          },
        };
      } else if (summary.mode === 'manager_career') {
        const ug = summary.userSide === 'home' ? summary.homeScore : summary.awayScore;
        const og = summary.userSide === 'home' ? summary.awayScore : summary.homeScore;
        const won = ug > og;
        const drew = ug === og;
        next = {
          ...next,
          career: {
            ...next.career,
            managerCareer: {
              ...next.career.managerCareer,
              active: true,
              wins: next.career.managerCareer.wins + (won ? 1 : 0),
              draws: next.career.managerCareer.draws + (drew ? 1 : 0),
              losses: next.career.managerCareer.losses + (!won && !drew ? 1 : 0),
              budgetMillions: next.career.managerCareer.budgetMillions + (won ? 3 : 1),
              boardConfidence: Math.max(15, Math.min(100, next.career.managerCareer.boardConfidence + (won ? 4 : drew ? 0 : -5))),
            },
          },
        };
      } else if (summary.mode === 'club_career') {
        const ug = summary.userSide === 'home' ? summary.homeScore : summary.awayScore;
        const og = summary.userSide === 'home' ? summary.awayScore : summary.homeScore;
        next = {
          ...next,
          career: {
            ...next.career,
            clubCareer: {
              ...next.career.clubCareer,
              active: true,
              budgetMillions: next.career.clubCareer.budgetMillions + (ug > og ? 4 : 2),
            },
          },
        };
      }

      return next;
    });
  };

  const handleSaveCustomTeam = (team: Team) => {
    setSave((prev) => {
      const others = prev.customTeams.filter((t) => t.id !== team.id);
      const achievements = prev.achievements.map((a) =>
        a.id === 'ach_creator'
          ? { ...a, progress: 1, unlocked: true, unlockedAt: a.unlockedAt ?? new Date().toISOString() }
          : a
      );
      return {
        ...prev,
        customTeams: [team, ...others],
        achievements,
      };
    });
  };

  const handleSignPlayerToClub = (clubId: string, sourceClubId: string, playerIdx: number, feeMillions: number) => {
    const dest = teamsMap.get(clubId);
    const src = teamsMap.get(sourceClubId);
    if (!dest || !src) return;
    const signed = structuredClone(src.players[playerIdx] ?? src.players[0]);
    signed.id = `${clubId}_signed_${Date.now()}`;
    const updatedClub: Team = {
      ...structuredClone(dest),
      rosterSource: 'custom',
      players: [signed, ...dest.players.slice(0, 17)],
    };
    setSave((prev) => {
      const others = prev.customTeams.filter((t) => t.id !== updatedClub.id);
      return {
        ...prev,
        customTeams: [updatedClub, ...others],
        career: {
          ...prev.career,
          managerCareer: {
            ...prev.career.managerCareer,
            budgetMillions: Math.max(0, prev.career.managerCareer.budgetMillions - feeMillions),
          },
        },
      };
    });
  };

  // ==================== ACTIVE MATCH FULL-VIEWPORT ====================
  if (activeMatch) {
    const matchSettings = {
      ...save.settings,
      match: {
        ...save.settings.match,
        difficulty: activeMatch.difficultyOverride ?? save.settings.match.difficulty,
        timeOfDay: activeMatch.timeOfDayOverride ?? save.settings.match.timeOfDay,
        weather: activeMatch.weatherOverride ?? save.settings.match.weather,
      },
      visual: {
        ...save.settings.visual,
        quality: activeMatch.qualityOverride ?? save.settings.visual.quality,
      },
    };
    const isTournamentFinal = Boolean(
      activeMatch.competitionFixtureId &&
        save.activeCompetition &&
        save.activeCompetition.fixtures.filter((f) => f.round === save.activeCompetition!.currentRound).length === 1
    );

    return (
      <>
        <MatchCanvas
          mode={activeMatch.mode}
          homeTeam={activeMatch.homeTeam}
          awayTeam={activeMatch.awayTeam}
          homeKit={activeMatch.homeKit}
          awayKit={activeMatch.awayKit}
          userSide={activeMatch.userSide}
          twoPlayerMode={activeMatch.twoPlayerMode}
          settings={matchSettings}
          equippedOptions={{
            ballId: save.store.equippedBallId,
            retroKitId: save.store.equippedRetroKitId,
            stadiumThemeId: save.store.equippedStadiumThemeId,
          }}
          isTournamentFinal={isTournamentFinal}
          startMinute={activeMatch.startMinute}
          initialHomeGoals={activeMatch.initialHomeGoals}
          initialAwayGoals={activeMatch.initialAwayGoals}
          trainingDrill={activeMatch.trainingDrill}
          onMatchFinish={handleMatchFinish}
          onExitMatch={() => {
            setActiveMatch(null);
            if (activeMatch.competitionFixtureId) setSection('tournaments');
          }}
        />
        <OfflineIndicator />
      </>
    );
  }

  // Map AppSection to initial Hub Mode
  const hubInitialMode: GameMode =
    section === 'leagues'
      ? 'league'
      : section === 'tournaments'
        ? 'world_cup'
        : section === 'career'
          ? 'manager_career'
          : section === 'training'
            ? 'training'
            : 'quick_match';

  // ==================== TITLE STAGE ====================
  if (section === 'title') {
    return (
      <div className="relative min-h-dvh w-full bg-[#0B1117] text-white overflow-x-hidden flex flex-col justify-between">
        {/* Background Stadium Photography with Negative Space Scrim */}
        <div className="absolute inset-0 z-0">
          <img
            src="/src/assets/images/title_stadium_bg_1795035954242.jpg"
            alt="Estadio iluminado"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0B1117] via-[#0B1117]/88 to-[#0B1117]/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B1117] via-transparent to-[#0B1117]/70" />
        </div>

        {/* Top Utility Strip (Title emblem + Store Coin Wallet + PWA Install) */}
        <header className="relative z-10 flex items-center justify-between px-5 sm:px-10 pt-5">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 64 64" className="w-9 h-9 shrink-0" aria-hidden="true">
              <path d="M32 5L55 13V31C55 44.5 45.2 54.8 32 59C18.8 54.8 9 44.5 9 31V13L32 5Z" fill="#064E3B" stroke="#F59E0B" strokeWidth="3.5" />
              <circle cx="32" cy="31" r="11" fill="#0B1117" stroke="#10B981" strokeWidth="2.5" />
              <polygon points="32,24 37,28 35,34 29,34 27,28" fill="#F8FAFC" />
            </svg>
            <span className="font-display text-xl font-extrabold tracking-wide text-white whitespace-nowrap">
              ATLAS FÚTBOL PRO
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              data-testid="btn-open-store"
              onClick={() => {
                soundEngine.playUiClick();
                setStoreModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 px-3 py-2 text-xs font-extrabold text-amber-300 min-h-[40px] cursor-pointer"
            >
              <Coins className="w-4 h-4 text-amber-400" />
              <span>Tienda · {save.store.coins}</span>
            </button>
            <PWAInstallButton compact />
            <button
              type="button"
              onClick={() => setSection('settings')}
              className="rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-200 min-h-[40px] cursor-pointer"
            >
              Ajustes
            </button>
          </div>
        </header>

        {/* Main Hero Focal Composition */}
        <main className="relative z-10 px-5 sm:px-10 py-10 max-w-6xl w-full mx-auto flex flex-col lg:flex-row lg:items-end justify-between gap-10">
          <div className="max-w-xl space-y-5">
            <h1 className="font-display text-5xl sm:text-7xl font-extrabold tracking-tight leading-[0.95] text-white [text-wrap:balance]">
              Fútbol Total en Cada Cancha del Mundo
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-lg">
              Disputa partidos completos 11v11 con 211+ selecciones y clubes internacionales, 8 niveles de inteligencia artificial hasta Ultra Difícil, modos Carrera, Mundial, Ligas y controles táctiles diseñados para celular.
            </p>

            {/* Primary CTA + Secondary Entry */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                data-testid="btn-title-quick-match"
                onClick={() => openPreMatchSetup('quick_match')}
                className="inline-flex items-center gap-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-6 py-3.5 text-base font-bold text-white shadow-xl cursor-pointer min-h-[48px] transition-colors"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>Elegir Equipos · Partido Rápido</span>
              </button>

              <button
                type="button"
                data-testid="btn-title-2p"
                onClick={() => openPreMatchSetup('quick_match', undefined, true)}
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 px-5 py-3.5 text-sm font-extrabold text-slate-950 shadow-xl cursor-pointer min-h-[48px] transition-colors"
              >
                <Gamepad2 className="w-4 h-4 text-slate-950" />
                <span>2 Jugadores (J1 vs J2)</span>
              </button>

              <button
                type="button"
                data-testid="btn-title-penalties"
                onClick={() => openPreMatchSetup('penalties')}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-3.5 text-sm font-extrabold text-slate-950 shadow-xl cursor-pointer min-h-[48px] transition-colors"
              >
                <Trophy className="w-4 h-4 text-slate-950" />
                <span>Tanda de Penales</span>
              </button>

              <button
                type="button"
                data-testid="btn-title-freekicks"
                onClick={() => openPreMatchSetup('training', undefined, false, 'free_kicks')}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-emerald-500/50 px-4 py-3.5 text-sm font-bold text-emerald-300 cursor-pointer min-h-[48px] transition-colors"
              >
                <Dumbbell className="w-4 h-4 text-emerald-400" />
                <span>Tiros Libres / Faltas</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  setSection('modes');
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 px-5 py-3.5 text-sm font-semibold text-white cursor-pointer min-h-[48px] transition-colors"
              >
                <Gamepad2 className="w-4 h-4 text-emerald-400" />
                <span>14 Modos de Juego</span>
              </button>
            </div>
          </div>

          {/* 12-Section Quick Access Grid */}
          <nav aria-label="Menú principal del juego" className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 w-full lg:max-w-lg">
            {[
              { id: 'modes', label: 'Modos de Juego', icon: Gamepad2 },
              { id: 'clubs', label: 'Equipos', icon: Shield },
              { id: 'nations', label: 'Selecciones', icon: Globe2 },
              { id: 'leagues', label: 'Ligas', icon: Trophy },
              { id: 'tournaments', label: 'Torneos', icon: Trophy },
              { id: 'career', label: 'Carrera', icon: Briefcase },
              { id: 'training', label: 'Entrenamiento', icon: Dumbbell },
              { id: 'store', label: 'Tienda Pro', icon: ShoppingBag },
              { id: 'editor', label: 'Editor', icon: PenTool },
              { id: 'stats', label: 'Estadísticas', icon: BarChart3 },
              { id: 'achievements', label: 'Logros', icon: Award },
              { id: 'settings', label: 'Ajustes', icon: Settings },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setSection(item.id as AppSection);
                  }}
                  className="flex items-center gap-2 rounded-xl bg-[#101923]/92 hover:bg-slate-800 border border-white/10 px-3 py-3 text-left text-xs font-semibold text-slate-100 transition-colors cursor-pointer min-h-[46px]"
                >
                  <Icon className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="whitespace-nowrap">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </main>

        {/* Bottom Safe Control Hint */}
        <footer className="relative z-10 px-5 sm:px-10 pb-4 pt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span>WASD / Joystick Mover · Espacio / Pasar · K / Disparar · V / Regate · L / Barrida · P Pausa</span>
          <span>Offline PWA · {allTeams.length} Equipos Disponibles</span>
        </footer>
        {preMatchSetup && (
          <MatchSetupModal
            teams={allTeams}
            initialMode={preMatchSetup.mode}
            initialHomeTeam={preMatchSetup.homeTeam}
            initialTwoPlayerMode={preMatchSetup.twoPlayer}
            initialTrainingDrill={preMatchSetup.trainingDrill}
            difficulty={save.settings.match.difficulty}
            onUpdateDifficulty={(d) =>
              setSave((p) => ({
                ...p,
                settings: { ...p.settings, match: { ...p.settings.match, difficulty: d } },
              }))
            }
            onLaunchMatch={handleLaunchMatch}
            onClose={() => setPreMatchSetup(null)}
            isModal={true}
          />
        )}
        {storeModalOpen && (
          <StoreModal
            store={save.store}
            onPurchaseItem={(id) => setSave((p) => purchaseUnlockableItem(p, id).state)}
            onEquipItem={(id) => setSave((p) => equipUnlockableItem(p, id))}
            onClose={() => setStoreModalOpen(false)}
            isModal={true}
          />
        )}
        <OfflineIndicator />
      </div>
    );
  }

  // ==================== APP HUB SHELL (SECTIONS) ====================
  const NAV_ITEMS: { id: AppSection; label: string }[] = [
    { id: 'title', label: 'Inicio' },
    { id: 'modes', label: 'Modos' },
    { id: 'clubs', label: 'Equipos' },
    { id: 'nations', label: 'Selecciones' },
    { id: 'leagues', label: 'Ligas' },
    { id: 'tournaments', label: 'Torneos' },
    { id: 'career', label: 'Carrera' },
    { id: 'training', label: 'Entreno' },
    { id: 'store', label: 'Tienda' },
    { id: 'editor', label: 'Editor' },
    { id: 'stats', label: 'Estadísticas' },
    { id: 'achievements', label: 'Logros' },
    { id: 'settings', label: 'Ajustes' },
  ];

  return (
    <div className="min-h-dvh bg-[#0B1117] text-slate-100 flex flex-col pb-20 md:pb-8">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-[#0B1117]/95 border-b border-slate-800 px-4 sm:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setSection('title')}
            className="font-display text-xl font-extrabold text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            ATLAS FÚTBOL PRO
          </button>

          <nav aria-label="Navegación principal" className="hidden lg:flex items-center gap-4 overflow-x-auto">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`text-xs font-semibold whitespace-nowrap shrink-0 py-1.5 border-b-2 transition-colors cursor-pointer ${
                  section === item.id
                    ? 'border-emerald-500 text-white'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              data-testid="btn-navbar-store"
              onClick={() => setSection('store')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 px-3 py-2 text-xs font-extrabold text-amber-300 whitespace-nowrap shrink-0 min-h-[38px] cursor-pointer"
            >
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>{save.store.coins}</span>
            </button>
            <PWAInstallButton compact />
            <button
              type="button"
              data-testid="btn-navbar-jugar-ya"
              onClick={() => openPreMatchSetup('quick_match')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white whitespace-nowrap shrink-0 min-h-[38px] cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Elegir Equipos / Jugar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 py-6">
        {(section === 'modes' || section === 'leagues' || section === 'tournaments' || section === 'career' || section === 'training') && (
          <GameModesHub
            key={section}
            teams={allTeams}
            settings={save.settings}
            career={save.career}
            activeCompetition={save.activeCompetition}
            survivalStreak={save.survivalStreak}
            initialSelectedMode={hubInitialMode}
            preselectedHomeTeam={preselectedHome}
            onUpdateDifficulty={(d) =>
              setSave((p) => ({ ...p, settings: { ...p.settings, match: { ...p.settings.match, difficulty: d } } }))
            }
            onUpdateCareer={(c) => setSave((p) => ({ ...p, career: c }))}
            onStartCompetition={(comp) => setSave((p) => ({ ...p, activeCompetition: comp }))}
            onClearCompetition={() => setSave((p) => ({ ...p, activeCompetition: null }))}
            onLaunchMatch={handleLaunchMatch}
            onSignPlayerToClub={handleSignPlayerToClub}
          />
        )}

        {(section === 'clubs' || section === 'nations') && (
          <DatabaseBrowser
            key={section}
            teams={allTeams}
            initialTab={section === 'nations' ? 'nations' : 'clubs'}
            onSelectForQuickMatch={(team) => {
              setPreselectedHome(team);
              openPreMatchSetup('quick_match', team);
            }}
            onImportTeams={(imported) =>
              setSave((p) => ({
                ...p,
                customTeams: mergeImportedTeamsPatch(p.customTeams, imported),
              }))
            }
          />
        )}

        {section === 'store' && (
          <StoreModal
            store={save.store}
            onPurchaseItem={(id) => setSave((p) => purchaseUnlockableItem(p, id).state)}
            onEquipItem={(id) => setSave((p) => equipUnlockableItem(p, id))}
            isModal={false}
          />
        )}

        {section === 'editor' && (
          <EditorStudio teams={allTeams} onSaveTeam={handleSaveCustomTeam} />
        )}

        {(section === 'stats' || section === 'achievements') && (
          <StatsAndAchievements
            key={section}
            stats={save.stats}
            achievements={save.achievements}
            initialTab={section === 'achievements' ? 'achievements' : 'stats'}
          />
        )}

        {section === 'settings' && (
          <SettingsModal
            settings={save.settings}
            teams={allTeams}
            onChange={(nextSettings) => setSave((p) => ({ ...p, settings: nextSettings }))}
            onResetAllSave={() => setSave(getDefaultSaveState())}
          />
        )}
      </main>

      {/* Mobile Bottom Thumb-Zone Tab Bar (< 15% viewport height) */}
      <nav
        aria-label="Barra móvil"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#0B1117]/95 border-t border-slate-800 grid grid-cols-5 h-16"
      >
        {[
          { id: 'title', label: 'Inicio', icon: Home },
          { id: 'modes', label: 'Jugar', icon: Gamepad2 },
          { id: 'clubs', label: 'Equipos', icon: Shield },
          { id: 'store', label: 'Tienda', icon: ShoppingBag },
          { id: 'settings', label: 'Ajustes', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = section === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSection(tab.id as AppSection)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold cursor-pointer ${
                active ? 'text-emerald-400' : 'text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {preMatchSetup && (
        <MatchSetupModal
          teams={allTeams}
          initialMode={preMatchSetup.mode}
          initialHomeTeam={preMatchSetup.homeTeam}
          initialTwoPlayerMode={preMatchSetup.twoPlayer}
          initialTrainingDrill={preMatchSetup.trainingDrill}
          difficulty={save.settings.match.difficulty}
          onUpdateDifficulty={(d) =>
            setSave((p) => ({
              ...p,
              settings: { ...p.settings, match: { ...p.settings.match, difficulty: d } },
            }))
          }
          onLaunchMatch={handleLaunchMatch}
          onClose={() => setPreMatchSetup(null)}
          isModal={true}
        />
      )}

      {storeModalOpen && (
        <StoreModal
          store={save.store}
          onPurchaseItem={(id) => setSave((p) => purchaseUnlockableItem(p, id).state)}
          onEquipItem={(id) => setSave((p) => equipUnlockableItem(p, id))}
          onClose={() => setStoreModalOpen(false)}
          isModal={true}
        />
      )}

      <OfflineIndicator />
    </div>
  );
}
