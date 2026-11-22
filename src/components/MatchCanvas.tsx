import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pause,
  Play,
  RotateCcw,
  Users,
  SlidersHorizontal,
  Gamepad2,
  LogOut,
  Trophy,
  Video,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Coins,
  Sparkles,
  Smartphone,
  Shirt,
  Target,
  Activity,
  Rewind,
  BarChart3,
  ArrowLeftRight,
  Zap,
  Flag,
} from 'lucide-react';
import { FORMATIONS, getFormation } from '../data/formations';
import { getGameModeConfig, resolveKitClash } from '../engine/gameModeManager';
import { calculateMatchCoinReward } from '../storage/saveManager';
import { TacticalFormationBoard } from './TacticalFormationBoard';
import {
  MatchEngine,
  type FreeKickControlState,
  type MatchCutsceneState,
  type MatchPhase,
  type OffsideCutsceneState,
  type RefereeCardCutsceneState,
  type VARReviewState,
  type VARScenarioType,
} from '../engine/matchEngine';
import { PITCH, type StrikeType } from '../engine/physics';
import {
  DIFFICULTY_LABELS,
  TACTICAL_LABELS,
  type GameMode,
  type GameSettings,
  type KitSelection,
  type MatchResultSummary,
  type TacticalStyle,
  type Team,
} from '../types/football';
import { soundEngine } from '../audio/soundEngine';
import { commentaryEngine, type CommentarySubtitle } from '../audio/commentaryEngine';
import { Stadium3D } from './Stadium3D';
import { TeamCoverBanner } from './TeamCoverBanner';
import { TeamCrest } from './TeamCrest';
import { TouchControls, type ChargeActionKind } from './TouchControls';

type LiveMatchStats = MatchResultSummary['homeStats'];

interface MatchCanvasProps {
  mode: GameMode;
  homeTeam: Team;
  awayTeam: Team;
  homeKit?: KitSelection;
  awayKit?: KitSelection;
  userSide: 'home' | 'away' | 'none';
  twoPlayerMode?: boolean;
  settings: GameSettings;
  equippedOptions?: {
    ballId?: string;
    retroKitId?: string;
    stadiumThemeId?: string;
  };
  isTournamentFinal?: boolean;
  startMinute?: number;
  initialHomeGoals?: number;
  initialAwayGoals?: number;
  trainingDrill?: 'free_play' | 'shooting' | 'passing' | 'dribbling' | 'free_kicks';
  onMatchFinish: (summary: MatchResultSummary) => void;
  onExitMatch: () => void;
}

interface ActivePlayerHudInfo {
  name: string;
  number: number;
  position: string;
  stamina: number;
  yellowCards: number;
  injured: boolean;
}

interface HudSnapshot {
  minute: number;
  seconds: number;
  added: number;
  half: number;
  homeScore: number;
  awayScore: number;
  phase: MatchPhase;
  banner: string | null;
  userHasBall: boolean;
  user2HasBall: boolean;
  userTactic: TacticalStyle;
  userFormation: string;
  subsUsed: number;
  shootCharging: boolean;
  shootPower: number;
  chargeAction: ChargeActionKind | null;
  shootCharging2: boolean;
  shootPower2: number;
  chargeAction2: null | ChargeActionKind;
  ballX: number;
  ballY: number;
  advantageActive: boolean;
  activePlayer: ActivePlayerHudInfo | null;
  opponentPlayer: ActivePlayerHudInfo | null;
  freeKick: FreeKickControlState | null;
  cardCutscene: RefereeCardCutsceneState | null;
  offsideCutscene: OffsideCutsceneState | null;
  cutsceneState: MatchCutsceneState | null;
  lastSkillMove: { label: string; type: string; timer: number } | null;
  varReview: VARReviewState | null;
  lightningPlayerName: string | null;
  homeStats: LiveMatchStats;
  awayStats: LiveMatchStats;
  radarPlayers: { id: string; side: 'home' | 'away'; x: number; y: number; active: boolean; calling?: boolean }[];
  replayAngle?: 'broadcast_slow' | 'low_sideline_slow' | 'behind_goal_zoom';
  replaySpeed?: number;
  replayTitle?: string;
  penalty?: {
    turn: 'home' | 'away';
    homeScored: number;
    awayScored: number;
    historyHome: ('goal' | 'miss')[];
    historyAway: ('goal' | 'miss')[];
    awaitingUserInput: boolean;
    lastOutcomeText: string;
  };
}

const CAMERA_LABELS: Record<GameSettings['visual']['cameraMode'], string> = {
  broadcast: 'TV Lateral',
  panoramica: 'Panorámica',
  dinamica: 'Cercana 3D',
  tele: 'Tele TV',
  vertical: 'TV Lateral',
};

const KIT_LABELS: Record<KitSelection, string> = {
  home: 'Local',
  away: 'Visitante',
  third: '3º Uniforme',
};

const CHARGE_ACTION_LABELS: Record<ChargeActionKind, string> = {
  pass: 'FUERZA DE PASE',
  through: 'FUERZA PASE FILTRADO',
  cross: 'FUERZA DE CENTRO',
  shoot: 'POTENCIA DE TIRO',
};

const EMPTY_STATS: LiveMatchStats = {
  goals: 0,
  shots: 0,
  shotsOnTarget: 0,
  possessionTime: 1,
  passesAttempted: 0,
  passesCompleted: 0,
  fouls: 0,
  yellowCards: 0,
  redCards: 0,
  corners: 0,
  offsides: 0,
  saves: 0,
  tackles: 0,
};

export const MatchCanvas: React.FC<MatchCanvasProps> = ({
  mode,
  homeTeam,
  awayTeam,
  homeKit: initialHomeKit = 'home',
  awayKit: initialAwayKit = 'away',
  userSide,
  twoPlayerMode = false,
  settings,
  equippedOptions,
  isTournamentFinal = false,
  startMinute,
  initialHomeGoals,
  initialAwayGoals,
  trainingDrill,
  onMatchFinish,
  onExitMatch,
}) => {
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MatchEngine | null>(null);
  const lastHudSigRef = useRef('');
  const pausedRef = useRef(false);
  const finishedSentRef = useRef(false);
  const keysHeldRef = useRef<Set<string>>(new Set());
  const touchStickRef = useRef({ x: 0, y: 0, sprint: false });
  const touchSprintBtnRef = useRef(false);
  const chargeHoldRef = useRef<{ action: ChargeActionKind; startTime: number } | null>(null);
  const touchStick2Ref = useRef({ x: 0, y: 0, sprint: false });
  const touchSprintBtn2Ref = useRef(false);
  const chargeHold2Ref = useRef<{ action: ChargeActionKind; startTime: number } | null>(null);
  const onMatchFinishRef = useRef(onMatchFinish);
  onMatchFinishRef.current = onMatchFinish;

  const [isPaused, setIsPaused] = useState(false);
  const [pauseTab, setPauseTab] = useState<'resumen' | 'posiciones' | 'jugadores' | 'estadisticas'>('resumen');
  const [swapSlotA, setSwapSlotA] = useState<string | null>(null);
  const [liveFpsLimit, setLiveFpsLimit] = useState<GameSettings['visual']['fpsLimit']>(
    settings.visual.fpsLimit ?? 60
  );
  const [liveQuality, setLiveQuality] = useState<GameSettings['visual']['quality']>(
    settings.visual.quality ?? 'alta'
  );
  const [soundMuted, setSoundMuted] = useState<boolean>(settings.audio.masterMuted);
  const [showSubsModal, setShowSubsModal] = useState(false);
  const [showTacticsMenu, setShowTacticsMenu] = useState(false);
  const [showKitMenu, setShowKitMenu] = useState(false);
  const [subOutId, setSubOutId] = useState<string | null>(null);
  const [, setRosterTick] = useState(0);

  // Interactive Penalty / Free-Kick Reticle & Power Meter State
  const [penAimX, setPenAimX] = useState<number>(0.45);
  const [penAimY, setPenAimY] = useState<number>(0.55);
  const [penPower, setPenPower] = useState<number>(0.8);
  const [penCurve, setPenCurve] = useState<number>(0.45);
  const [fkStrikeType, setFkStrikeType] = useState<StrikeType>('curva');

  // Live Camera Mode & Kit Selection
  const [activeCameraMode, setActiveCameraMode] = useState<GameSettings['visual']['cameraMode']>(
    settings.visual.cameraMode === 'vertical' ? 'broadcast' : settings.visual.cameraMode
  );
  const activeCameraModeRef = useRef(activeCameraMode);
  activeCameraModeRef.current = activeCameraMode;

  const initialResolvedKits = useMemo(
    () => resolveKitClash(homeTeam, awayTeam, initialHomeKit, initialAwayKit),
    [homeTeam, awayTeam, initialHomeKit, initialAwayKit]
  );
  const [homeKit, setHomeKit] = useState<KitSelection>(initialResolvedKits.homeKit);
  const [awayKit, setAwayKit] = useState<KitSelection>(initialResolvedKits.awayKit);
  const [activeTrainingDrill, setActiveTrainingDrill] = useState<
    'free_play' | 'shooting' | 'passing' | 'dribbling' | 'free_kicks'
  >(trainingDrill ?? 'free_play');

  // Live Commentator & Spicy Crowd state
  const [commentaryEnabled, setCommentaryEnabled] = useState<boolean>(
    settings.audio.commentaryEnabled !== false
  );
  const [spicyCrowdMode, setSpicyCrowdMode] = useState<boolean>(
    settings.audio.spicyCrowdMode !== false
  );
  const [liveSubtitle, setLiveSubtitle] = useState<CommentarySubtitle | null>(null);

  // Mandatory Horizontal (Landscape) Detection & Enforcement
  const [isViewportPortrait, setIsViewportPortrait] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < window.innerHeight : false
  );
  const [forceRotatedLandscape, setForceRotatedLandscape] = useState<boolean>(
    settings.visual.forceLandscape !== false
  );

  const userToggledTouchRef = useRef(false);
  const [showTouchOverlay, setShowTouchOverlay] = useState<boolean>(() => {
    if (twoPlayerMode || settings.controls.alwaysShowTouchControls) return true;
    if (typeof window !== 'undefined') {
      return (
        window.innerWidth < 1024 ||
        window.innerHeight < 520 ||
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        Boolean(window.matchMedia?.('(pointer: coarse)').matches)
      );
    }
    return false;
  });

  const [hud, setHud] = useState<HudSnapshot>({
    minute: startMinute ?? 0,
    seconds: 0,
    added: 0,
    half: 1,
    homeScore: initialHomeGoals ?? 0,
    awayScore: initialAwayGoals ?? 0,
    phase: 'kickoff_ready',
    banner: null,
    userHasBall: false,
    user2HasBall: false,
    userTactic: userSide === 'away' ? awayTeam.tacticalStyle : homeTeam.tacticalStyle,
    userFormation: userSide === 'away' ? awayTeam.formationId : homeTeam.formationId,
    subsUsed: 0,
    shootCharging: false,
    shootPower: 0.5,
    chargeAction: null,
    shootCharging2: false,
    shootPower2: 0.5,
    chargeAction2: null,
    ballX: PITCH.HALF_X,
    ballY: PITCH.HALF_Y,
    advantageActive: false,
    activePlayer: null,
    opponentPlayer: null,
    freeKick: null,
    cardCutscene: null,
    offsideCutscene: null,
    cutsceneState: null,
    lastSkillMove: null,
    varReview: null,
    lightningPlayerName: null,
    homeStats: { ...EMPTY_STATS },
    awayStats: { ...EMPTY_STATS },
    radarPlayers: [],
  });

  const [summary, setSummary] = useState<MatchResultSummary | null>(null);

  // Haptic feedback helper using the Web Vibration API (navigator.vibrate)
  const triggerHaptic = (pattern: number | number[]) => {
    if (!settings.controls.vibration) return;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore security/permission errors on restricted browsers
      }
    }
  };

  const startChargeAction = (action: ChargeActionKind) => {
    const eng = engineRef.current;
    if (!eng || pausedRef.current) return;
    chargeHoldRef.current = { action, startTime: performance.now() };
    triggerHaptic(action === 'shoot' ? 15 : 10);
    if (action === 'shoot') {
      eng.userInput.shootHeld = true;
    }
  };

  const releaseChargeAction = (action: ChargeActionKind) => {
    const eng = engineRef.current;
    if (!eng) return;
    const current = chargeHoldRef.current;
    const heldMs = current && current.action === action ? performance.now() - current.startTime : 180;
    const power = Math.max(0.32, Math.min(1, heldMs / 460));
    chargeHoldRef.current = null;
    soundEngine.playKickWithPower(power);

    if (action === 'pass') {
      eng.userInput.passPower = power;
      eng.userInput.passPressed = true;
      triggerHaptic(Math.round(12 + power * 10));
    } else if (action === 'through') {
      eng.userInput.throughPower = power;
      eng.userInput.throughPressed = true;
      triggerHaptic(Math.round(14 + power * 12));
    } else if (action === 'cross') {
      eng.userInput.crossPower = power;
      eng.userInput.crossPressed = true;
      triggerHaptic([14, 10, Math.round(16 + power * 12)]);
    } else if (action === 'shoot') {
      const shotPower = Math.max(0.38, power);
      eng.userInput.shootPower = shotPower;
      eng.userInput.curveInput = Math.max(-1, Math.min(1, eng.userInput.moveY * 0.85));
      eng.userInput.shootHeld = false;
      eng.userInput.shootReleased = true;
      triggerHaptic(shotPower > 0.78 ? [24, 16, 34] : [18, 12, 24]);
    }
  };

  const startChargeAction2 = (action: ChargeActionKind) => {
    const eng = engineRef.current;
    if (!eng || pausedRef.current) return;
    chargeHold2Ref.current = { action, startTime: performance.now() };
    triggerHaptic(action === 'shoot' ? 15 : 10);
    if (action === 'shoot') {
      eng.userInput2.shootHeld = true;
    }
  };

  const releaseChargeAction2 = (action: ChargeActionKind) => {
    const eng = engineRef.current;
    if (!eng) return;
    const current = chargeHold2Ref.current;
    const heldMs = current && current.action === action ? performance.now() - current.startTime : 180;
    const power = Math.max(0.32, Math.min(1, heldMs / 460));
    chargeHold2Ref.current = null;
    soundEngine.playKickWithPower(power);

    if (action === 'pass') {
      eng.userInput2.passPower = power;
      eng.userInput2.passPressed = true;
      triggerHaptic(Math.round(12 + power * 10));
    } else if (action === 'through') {
      eng.userInput2.throughPower = power;
      eng.userInput2.throughPressed = true;
      triggerHaptic(Math.round(14 + power * 12));
    } else if (action === 'cross') {
      eng.userInput2.crossPower = power;
      eng.userInput2.crossPressed = true;
      triggerHaptic([14, 10, Math.round(16 + power * 12)]);
    } else if (action === 'shoot') {
      const shotPower = Math.max(0.38, power);
      eng.userInput2.shootPower = shotPower;
      eng.userInput2.curveInput = Math.max(-1, Math.min(1, eng.userInput2.moveY * 0.85));
      eng.userInput2.shootHeld = false;
      eng.userInput2.shootReleased = true;
      triggerHaptic(shotPower > 0.78 ? [24, 16, 34] : [18, 12, 24]);
    }
  };

  // Attempt native Screen Orientation Landscape Lock on match start
  const requestNativeLandscape = async () => {
    try {
      const scr = window.screen as Screen & {
        orientation?: { lock?: (o: string) => Promise<void> };
      };
      if (scr?.orientation?.lock) {
        await scr.orientation.lock('landscape');
      }
    } catch {
      // Browser/iframe may restrict orientation.lock without fullscreen; fallback handled by rotated landscape stage
    }
  };

  useEffect(() => {
    requestNativeLandscape();
    const onResize = () => {
      const portrait = window.innerWidth < window.innerHeight;
      setIsViewportPortrait(portrait);
      if (!userToggledTouchRef.current && !settings.controls.alwaysShowTouchControls && !twoPlayerMode) {
        setShowTouchOverlay(
          window.innerWidth < 1024 ||
            window.innerHeight < 520 ||
            'ontouchstart' in window ||
            navigator.maxTouchPoints > 0 ||
            Boolean(window.matchMedia?.('(pointer: coarse)').matches)
        );
      }
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [settings.controls.alwaysShowTouchControls, twoPlayerMode]);

  // Sync sound & commentator settings
  useEffect(() => {
    soundEngine.setSettings({
      ...settings.audio,
      masterMuted: soundMuted,
      spicyCrowdMode,
    });
    commentaryEngine.setSettings({
      ...settings.audio,
      masterMuted: soundMuted,
      commentaryEnabled,
      spicyCrowdMode,
    });
  }, [settings.audio, soundMuted, commentaryEnabled, spicyCrowdMode]);

  useEffect(() => {
    commentaryEngine.setSubtitleListener((sub) => {
      setLiveSubtitle(sub);
    });
    return () => {
      commentaryEngine.setSubtitleListener(undefined);
      commentaryEngine.stop();
      soundEngine.stopMatchAmbience();
    };
  }, []);

  const initEngine = () => {
    finishedSentRef.current = false;
    setSummary(null);
    pausedRef.current = false;
    setIsPaused(false);
    setSwapSlotA(null);
    document.body.dataset.state = 'playing';

    engineRef.current = new MatchEngine({
      mode,
      homeTeam,
      awayTeam,
      userSide,
      twoPlayerMode,
      settings,
      startMinute,
      initialHomeGoals,
      initialAwayGoals,
      trainingDrill,
      onSound: (trigger) => {
        soundEngine.trigger(trigger);
        if (trigger === 'goal_roar') triggerHaptic([40, 30, 65]);
        else if (trigger === 'post') triggerHaptic([28, 16, 28]);
        else if (trigger === 'foul_card' || trigger === 'foul_boo' || trigger === 'thunder') {
          triggerHaptic([22, 18, 26]);
        }
      },
      onCommentary: (ctx) => commentaryEngine.trigger(ctx),
    });
  };

  useEffect(() => {
    initEngine();
    if (twoPlayerMode) {
      setShowTouchOverlay(true);
    }
    return () => {
      document.body.dataset.state = 'title';
      commentaryEngine.stop();
      soundEngine.stopMatchAmbience();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, homeTeam.id, awayTeam.id, userSide, twoPlayerMode]);

  // Keyboard & blur listeners (with hold-to-charge power meter on Pass, Through, Cross, and Shoot)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
        e.preventDefault();
      }

      if (code === 'Escape' || code === 'KeyP') {
        if (engineRef.current?.phase === 'fulltime') return;
        pausedRef.current = !pausedRef.current;
        setIsPaused(pausedRef.current);
        document.body.dataset.state = pausedRef.current ? 'paused' : 'playing';
        return;
      }

      if (code === 'KeyC') {
        const order: GameSettings['visual']['cameraMode'][] = ['broadcast', 'panoramica', 'dinamica', 'tele'];
        const idx = order.indexOf(activeCameraModeRef.current);
        setActiveCameraMode(order[(idx + 1) % order.length]);
        return;
      }

      if (code === 'KeyR') {
        engineRef.current?.triggerInstantReplay();
        return;
      }

      if (pausedRef.current || !engineRef.current) return;

      const eng = engineRef.current;
      const userHasBall = eng.ball.ownerId !== null && eng.ball.ownerId === eng.activeUserPlayerId;
      const user2HasBall =
        eng.twoPlayerMode && eng.ball.ownerId !== null && eng.ball.ownerId === eng.activeUser2PlayerId;

      if (!keysHeldRef.current.has(code)) {
        if (code === 'KeyJ' || code === 'Space') {
          if (userHasBall) startChargeAction('pass');
          else eng.userInput.switchPressed = true;
        }
        if (code === 'KeyU') {
          if (userHasBall) startChargeAction('through');
          else eng.userInput.slidePressed = true;
        }
        if (code === 'KeyI') {
          if (userHasBall) startChargeAction('cross');
          else eng.userInput.tacklePressed = true;
        }
        if (code === 'KeyV' || code === 'KeyX') {
          if (userHasBall) eng.userInput.skillMovePressed = true;
        }
        if (code === 'KeyL') eng.userInput.slidePressed = true;
        if (code === 'KeyQ' || code === 'KeyE') eng.userInput.switchPressed = true;
        if (code === 'KeyK' || (!eng.twoPlayerMode && code === 'Enter')) {
          if (userHasBall) startChargeAction('shoot');
          else eng.userInput.tacklePressed = true;
        }

        // Player 2 Keyboard Actions when twoPlayerMode is active
        if (eng.twoPlayerMode) {
          if (code === 'KeyM' || code === 'Numpad1') {
            if (user2HasBall) startChargeAction2('pass');
            else eng.userInput2.switchPressed = true;
          }
          if (code === 'KeyN' || code === 'Numpad2') {
            if (user2HasBall) startChargeAction2('through');
            else eng.userInput2.slidePressed = true;
          }
          if (code === 'KeyB' || code === 'Numpad3') {
            if (user2HasBall) startChargeAction2('cross');
            else eng.userInput2.tacklePressed = true;
          }
          if (code === 'Numpad4') {
            if (user2HasBall) eng.userInput2.skillMovePressed = true;
          }
          if (code === 'Enter' || code === 'Numpad0') {
            if (user2HasBall) startChargeAction2('shoot');
            else eng.userInput2.tacklePressed = true;
          }
        }
      }
      keysHeldRef.current.add(code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      keysHeldRef.current.delete(code);
      if (code === 'KeyJ' || code === 'Space') {
        if (chargeHoldRef.current?.action === 'pass') releaseChargeAction('pass');
      }
      if (code === 'KeyU') {
        if (chargeHoldRef.current?.action === 'through') releaseChargeAction('through');
      }
      if (code === 'KeyI') {
        if (chargeHoldRef.current?.action === 'cross') releaseChargeAction('cross');
      }
      if (code === 'KeyK' || (!engineRef.current?.twoPlayerMode && code === 'Enter')) {
        if (chargeHoldRef.current?.action === 'shoot') releaseChargeAction('shoot');
      }
      if (engineRef.current?.twoPlayerMode) {
        if ((code === 'KeyM' || code === 'Numpad1') && chargeHold2Ref.current?.action === 'pass') {
          releaseChargeAction2('pass');
        }
        if ((code === 'KeyN' || code === 'Numpad2') && chargeHold2Ref.current?.action === 'through') {
          releaseChargeAction2('through');
        }
        if ((code === 'KeyB' || code === 'Numpad3') && chargeHold2Ref.current?.action === 'cross') {
          releaseChargeAction2('cross');
        }
        if ((code === 'Enter' || code === 'Numpad0') && chargeHold2Ref.current?.action === 'shoot') {
          releaseChargeAction2('shoot');
        }
      }
    };

    const clearInputs = () => {
      keysHeldRef.current.clear();
      touchStickRef.current = { x: 0, y: 0, sprint: false };
      touchSprintBtnRef.current = false;
      chargeHoldRef.current = null;
      touchStick2Ref.current = { x: 0, y: 0, sprint: false };
      touchSprintBtn2Ref.current = false;
      chargeHold2Ref.current = null;
      if (engineRef.current) {
        engineRef.current.userInput.moveX = 0;
        engineRef.current.userInput.moveY = 0;
        engineRef.current.userInput.sprint = false;
        engineRef.current.userInput.shootHeld = false;
        engineRef.current.userInput.pressHeld = false;
        engineRef.current.userInput2.moveX = 0;
        engineRef.current.userInput2.moveY = 0;
        engineRef.current.userInput2.sprint = false;
        engineRef.current.userInput2.shootHeld = false;
        engineRef.current.userInput2.pressHeld = false;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearInputs);
    document.addEventListener('visibilitychange', clearInputs);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInputs);
      document.removeEventListener('visibilitychange', clearInputs);
    };
  }, []);

  // Per-frame match engine step & HUD synchronization callbacks passed to <Stadium3D />
  const handleBeforeEngineStep = (eng: MatchEngine, rawDt: number, now: number): number => {
    if (!pausedRef.current) {
      let kx = 0;
      let ky = 0;
      const keys = keysHeldRef.current;
      if (keys.has('KeyW') || (!eng.twoPlayerMode && keys.has('ArrowUp'))) ky -= 1;
      if (keys.has('KeyS') || (!eng.twoPlayerMode && keys.has('ArrowDown'))) ky += 1;
      if (keys.has('KeyA') || (!eng.twoPlayerMode && keys.has('ArrowLeft'))) kx -= 1;
      if (keys.has('KeyD') || (!eng.twoPlayerMode && keys.has('ArrowRight'))) kx += 1;

      const tx = touchStickRef.current.x;
      const ty = touchStickRef.current.y;
      eng.userInput.moveX = Math.abs(tx) + Math.abs(ty) > 0.08 ? tx : kx;
      eng.userInput.moveY = Math.abs(tx) + Math.abs(ty) > 0.08 ? ty : ky;
      eng.userInput.sprint =
        keys.has('ShiftLeft') ||
        (!eng.twoPlayerMode && keys.has('ShiftRight')) ||
        touchStickRef.current.sprint ||
        touchSprintBtnRef.current;

      if (eng.twoPlayerMode) {
        let kx2 = 0;
        let ky2 = 0;
        if (keys.has('ArrowUp')) ky2 -= 1;
        if (keys.has('ArrowDown')) ky2 += 1;
        if (keys.has('ArrowLeft')) kx2 -= 1;
        if (keys.has('ArrowRight')) kx2 += 1;

        const tx2 = touchStick2Ref.current.x;
        const ty2 = touchStick2Ref.current.y;
        eng.userInput2.moveX = Math.abs(tx2) + Math.abs(ty2) > 0.08 ? tx2 : kx2;
        eng.userInput2.moveY = Math.abs(tx2) + Math.abs(ty2) > 0.08 ? ty2 : ky2;
        eng.userInput2.sprint =
          keys.has('ShiftRight') ||
          touchStick2Ref.current.sprint ||
          touchSprintBtn2Ref.current;
      }

      eng.step(rawDt);

      // Update dynamic stadium ambience volume, crowd chants & rival whistles
      const boxDanger = Math.max(0, (Math.abs(eng.ball.x - PITCH.HALF_X) - 18) / 34);
      const rivalHasBall =
        eng.ball.ownerId !== null &&
        eng.ball.lastTouchTeam !== null &&
        eng.ball.lastTouchTeam !== (userSide === 'away' ? 'away' : 'home');
      soundEngine.updateMatchAmbience(
        boxDanger,
        eng.phase === 'live' || eng.phase === 'set_piece',
        rivalHasBall
      );
    } else {
      soundEngine.updateMatchAmbience(0, false, false);
    }

    return chargeHoldRef.current !== null
      ? Math.max(0.15, Math.min(1, (now - chargeHoldRef.current.startTime) / 460))
      : 0;
  };

  const handleAfterEngineRender = (eng: MatchEngine, shootChargePct: number, now: number) => {
    // Sync HUD at discrete intervals
    const mInt = Math.floor(eng.matchMinute);
    const sInt = Math.floor((eng.matchMinute - mInt) * 60);
    const userHasBall = eng.ball.ownerId !== null && eng.ball.ownerId === eng.activeUserPlayerId;
    const user2HasBall =
      eng.twoPlayerMode && eng.ball.ownerId !== null && eng.ball.ownerId === eng.activeUser2PlayerId;
    const userTactic = userSide === 'away' ? eng.awayTactic : eng.homeTactic;
    const userFormation = userSide === 'away' ? eng.awayFormationId : eng.homeFormationId;
    const subsUsed = userSide === 'away' ? eng.awaySubsUsed : eng.homeSubsUsed;
    const isCharging = chargeHoldRef.current !== null;
    const activeChargeKind = chargeHoldRef.current?.action ?? null;
    const chargeStep = Math.round(shootChargePct * 6);
    const isCharging2 = chargeHold2Ref.current !== null;
    const shootChargePct2 =
      chargeHold2Ref.current !== null
        ? Math.max(0.15, Math.min(1, (now - chargeHold2Ref.current.startTime) / 460))
        : 0;
    const activeChargeKind2 = chargeHold2Ref.current?.action ?? null;
    const chargeStep2 = Math.round(shootChargePct2 * 6);
    const radarTick = Math.floor(now / 500);
    const activeP = eng.players.find((p) => p.id === eng.activeUserPlayerId) ?? null;
    const oppSide = userSide === 'away' ? 'home' : 'away';
    let opponentP =
      eng.twoPlayerMode && eng.activeUser2PlayerId
        ? eng.players.find((p) => p.id === eng.activeUser2PlayerId) ?? null
        : eng.players.find((p) => p.side === oppSide && p.id === eng.ball.ownerId && !p.redCard) ?? null;
    if (!opponentP) {
      let bestOppD = Infinity;
      for (const cand of eng.players) {
        if (cand.side !== oppSide || cand.redCard) continue;
        const d = Math.hypot(cand.x - eng.ball.x, cand.y - eng.ball.y);
        if (d < bestOppD) {
          bestOppD = d;
          opponentP = cand;
        }
      }
    }
    const activeStamStep = activeP ? Math.round(activeP.stamina / 2) * 2 : 100;
    const advActive = eng.advantageState !== null;
    const fkActive = eng.freeKickState?.awaitingUserInput ?? false;
    const cardActive = eng.cardCutscene?.active ?? false;
    const offsideActive = eng.offsideCutscene?.active ?? false;
    const cutsceneKey = eng.cutsceneState?.active
      ? `${eng.cutsceneState.type}:${eng.cutsceneState.title}`
      : '';
    const skillMoveKey = eng.lastSkillMove ? `${eng.lastSkillMove.type}:${eng.lastSkillMove.label}` : '';
    const varPhase = eng.varReviewState?.active
      ? `${eng.varReviewState.scenario}:${eng.varReviewState.phase}:${eng.varReviewState.cameraAngleIndex}`
      : '';
    const lightningActive = eng.lightningState?.active ? eng.lightningState.targetPlayerName : null;

    const sig = `${mInt}|${Math.floor(sInt / 2)}|${eng.homeScore}|${eng.awayScore}|${eng.phase}|${eng.bannerText}|${userHasBall}|${user2HasBall}|${userTactic}|${userFormation}|${subsUsed}|${isCharging}|${activeChargeKind}|${chargeStep}|${isCharging2}|${activeChargeKind2}|${chargeStep2}|${radarTick}|${activeP?.id ?? ''}|${opponentP?.id ?? ''}|${activeStamStep}|${advActive}|${fkActive}|${cardActive}|${offsideActive}|${cutsceneKey}|${skillMoveKey}|${varPhase}|${lightningActive}|${eng.replayCameraAngle}|${eng.penaltyState?.homeTaken ?? 0}|${eng.penaltyState?.awayTaken ?? 0}|${eng.penaltyState?.awaitingUserInput ?? false}`;

    if (sig !== lastHudSigRef.current) {
      lastHudSigRef.current = sig;
      setHud({
        minute: mInt,
        seconds: sInt,
        added: eng.addedTimeMinutes,
        half: eng.half,
        homeScore: eng.homeScore,
        awayScore: eng.awayScore,
        phase: eng.phase,
        banner: eng.bannerText,
        userHasBall,
        user2HasBall,
        userTactic,
        userFormation,
        subsUsed,
        shootCharging: isCharging,
        shootPower: shootChargePct,
        chargeAction: activeChargeKind,
        shootCharging2: isCharging2,
        shootPower2: shootChargePct2,
        chargeAction2: activeChargeKind2,
        ballX: eng.ball.x,
        ballY: eng.ball.y,
        advantageActive: advActive,
        replayAngle: eng.replayCameraAngle,
        replaySpeed: eng.replaySpeedFactor,
        replayTitle: eng.replayPlayTitle,
        cardCutscene: eng.cardCutscene?.active ? { ...eng.cardCutscene } : null,
        offsideCutscene: eng.offsideCutscene?.active ? { ...eng.offsideCutscene } : null,
        cutsceneState: eng.cutsceneState?.active ? { ...eng.cutsceneState } : null,
        lastSkillMove: eng.lastSkillMove
          ? {
              label: eng.lastSkillMove.label,
              type: eng.lastSkillMove.type,
              timer: eng.lastSkillMove.timer,
            }
          : null,
        varReview: eng.varReviewState?.active ? { ...eng.varReviewState } : null,
        lightningPlayerName: lightningActive,
        homeStats: { ...eng.homeStats },
        awayStats: { ...eng.awayStats },
        activePlayer: activeP
          ? {
              name: activeP.player.name,
              number: activeP.player.number,
              position: activeP.player.position,
              stamina: activeP.stamina,
              yellowCards: activeP.yellowCards,
              injured: activeP.injured,
            }
          : null,
        opponentPlayer: opponentP
          ? {
              name: opponentP.player.name,
              number: opponentP.player.number,
              position: opponentP.player.position,
              stamina: opponentP.stamina,
              yellowCards: opponentP.yellowCards,
              injured: opponentP.injured,
            }
          : null,
        freeKick: eng.freeKickState ? { ...eng.freeKickState } : null,
        radarPlayers: eng.players
          .filter((p) => !p.redCard && p.y > -5)
          .map((p) => ({
            id: p.id,
            side: p.side,
            x: p.x,
            y: p.y,
            active: p.id === eng.activeUserPlayerId || (eng.twoPlayerMode && p.id === eng.activeUser2PlayerId),
            calling: p.callingForBall,
          })),
        penalty: eng.penaltyState
          ? {
              turn: eng.penaltyState.turn,
              homeScored: eng.penaltyState.homeScored,
              awayScored: eng.penaltyState.awayScored,
              historyHome: [...eng.penaltyState.historyHome],
              historyAway: [...eng.penaltyState.historyAway],
              awaitingUserInput: eng.penaltyState.awaitingUserInput,
              lastOutcomeText: eng.penaltyState.lastOutcomeText,
            }
          : undefined,
      });
    }

    if (eng.phase === 'fulltime' && !finishedSentRef.current) {
      finishedSentRef.current = true;
      document.body.dataset.state = 'gameover';
      soundEngine.stopMatchAmbience();
      const res = eng.buildResultSummary();
      setSummary(res);
      onMatchFinishRef.current(res);
    }
  };

  const togglePause = () => {
    if (!engineRef.current || engineRef.current.phase === 'fulltime') return;
    pausedRef.current = !pausedRef.current;
    setIsPaused(pausedRef.current);
    document.body.dataset.state = pausedRef.current ? 'paused' : 'playing';
  };

  const cycleCamera = () => {
    const order: GameSettings['visual']['cameraMode'][] = ['broadcast', 'panoramica', 'dinamica', 'tele'];
    const idx = order.indexOf(activeCameraMode);
    setActiveCameraMode(order[(idx + 1) % order.length]);
  };

  const updateFreeKickParam = (patch: Partial<FreeKickControlState>) => {
    if (!engineRef.current || !engineRef.current.freeKickState) return;
    Object.assign(engineRef.current.freeKickState, patch);
    setHud((prev) => ({
      ...prev,
      freeKick: prev.freeKick ? { ...prev.freeKick, ...patch } : null,
    }));
  };

  const userTeamSide: 'home' | 'away' = userSide === 'away' ? 'away' : 'home';
  const userTeamObj = userTeamSide === 'away' ? awayTeam : homeTeam;
  const userFieldPlayers =
    engineRef.current?.players.filter((p) => p.side === userTeamSide && !p.redCard) ?? [];

  // Merge live FPS limit and graphic quality override into settings passed to Stadium3D
  const effectiveSettings = useMemo<GameSettings>(
    () => ({
      ...settings,
      visual: {
        ...settings.visual,
        fpsLimit: liveFpsLimit,
        quality: liveQuality,
      },
    }),
    [settings, liveFpsLimit, liveQuality]
  );

  // When a device is held vertically (portrait), rotate the entire match stage 90 degrees into true landscape!
  const isRotated90 = isViewportPortrait && forceRotatedLandscape;
  const rotatedStageStyle: React.CSSProperties = isRotated90
    ? {
        position: 'fixed',
        top: '50%',
        left: '50%',
        width: '100dvh',
        height: '100dvw',
        transform: 'translate(-50%, -50%) rotate(90deg)',
        transformOrigin: 'center center',
      }
    : {};

  return (
    <div
      ref={stageContainerRef}
      style={rotatedStageStyle}
      className={`overflow-hidden bg-[#090F16] select-none ${
        isRotated90 ? 'z-50' : 'relative w-full h-dvh'
      }`}
    >
      {/* 3D Stadium & 1050x600 Pitch Component (Three.js + React Three Fiber) */}
      <Stadium3D
        engineRef={engineRef}
        pausedRef={pausedRef}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        homeKit={homeKit}
        awayKit={awayKit}
        settings={effectiveSettings}
        cameraMode={activeCameraMode}
        equippedOptions={equippedOptions}
        onBeforeEngineStep={handleBeforeEngineStep}
        onAfterEngineRender={handleAfterEngineRender}
      />

      {/* Top EA SPORTS FC Broadcast Scoreboard (Top-Left) & Broadcast Controls (Top-Right) */}
      <div className="pointer-events-none absolute top-0 left-0 right-0 z-20 flex items-start justify-between gap-2 px-3 pt-2 sm:px-5 sm:pt-3">
        {/* Top-Left: EA SPORTS FC Style Broadcast Scoreboard Bar */}
        <div className="pointer-events-auto flex flex-col items-start shrink-0">
          {/* Competition Micro-Label Above Score Box */}
          <div
            data-testid="scoreboard-mode-label"
            className="pl-[64px] sm:pl-[76px] mb-0.5 text-[9px] sm:text-[10px] font-display font-extrabold uppercase tracking-widest text-white/90 drop-shadow"
          >
            {getGameModeConfig(mode).broadcastLabel}
          </div>

          <div className="flex items-stretch h-7 sm:h-8 rounded-xs overflow-hidden shadow-2xl border border-black/40">
            {/* Clock Box (MM:SS) */}
            <div
              data-testid="match-clock"
              className="flex items-center justify-center bg-[#141923]/95 text-white font-mono-tabular text-xs sm:text-sm font-bold px-2.5 sm:px-3 min-w-[56px] sm:min-w-[66px]"
            >
              {mode === 'penalties' || hud.phase === 'penalty_shootout'
                ? 'PEN'
                : mode === 'training'
                  ? 'LIBRE'
                  : `${String(Math.min(120, hud.minute)).padStart(2, '0')}:${String(hud.seconds).padStart(2, '0')}${
                      hud.added > 0 && ((hud.minute >= 45 && hud.half === 1) || (hud.minute >= 90 && hud.half === 2))
                        ? ` +${hud.added}`
                        : ''
                    }`}
            </div>

            {/* Home Team Lime-Yellow Broadcast Badge */}
            <div className="flex items-center justify-center gap-1.5 bg-[#D9F938] text-[#0B1117] px-2.5 sm:px-3.5 font-display text-xs sm:text-base font-black tracking-wider">
              <span>{homeTeam.shortName}</span>
            </div>

            {/* Score Box */}
            <div className="flex items-center justify-center gap-1.5 bg-[#141923]/95 text-white font-display text-sm sm:text-lg font-black tabular-nums px-2.5 sm:px-3.5 min-w-[48px] sm:min-w-[58px]">
              <span data-testid="score-home">
                {hud.penalty ? hud.penalty.homeScored : hud.homeScore}
              </span>
              <span className="text-slate-400 text-xs">-</span>
              <span data-testid="score-away">
                {hud.penalty ? hud.penalty.awayScored : hud.awayScore}
              </span>
            </div>

            {/* Away Team Lime-Yellow Broadcast Badge */}
            <div className="flex items-center justify-center gap-1.5 bg-[#D9F938] text-[#0B1117] px-2.5 sm:px-3.5 font-display text-xs sm:text-base font-black tracking-wider">
              <span>{awayTeam.shortName}</span>
            </div>
          </div>

          {/* Live Penalty Shootout Converted / Missed Series Indicator under Scoreboard */}
          {hud.penalty && (
            <div
              data-testid="scoreboard-penalty-tracker"
              className="mt-1 flex items-center gap-3 rounded bg-[#0B1117]/90 border border-emerald-500/40 px-2.5 py-1 text-[10px] font-bold text-white shadow-lg"
            >
              <div className="flex items-center gap-1">
                <span className="text-slate-300 mr-1">{homeTeam.shortName}</span>
                {[0, 1, 2, 3, 4].map((i) => {
                  const res = hud.penalty?.historyHome[i];
                  return (
                    <span
                      key={i}
                      className={`w-2.5 h-2.5 rounded-full border ${
                        res === 'goal'
                          ? 'bg-emerald-400 border-emerald-200'
                          : res === 'miss'
                            ? 'bg-rose-500 border-rose-300'
                            : 'bg-slate-800 border-slate-600'
                      }`}
                    />
                  );
                })}
              </div>
              <span className="text-slate-500">|</span>
              <div className="flex items-center gap-1">
                <span className="text-slate-300 mr-1">{awayTeam.shortName}</span>
                {[0, 1, 2, 3, 4].map((i) => {
                  const res = hud.penalty?.historyAway[i];
                  return (
                    <span
                      key={i}
                      className={`w-2.5 h-2.5 rounded-full border ${
                        res === 'goal'
                          ? 'bg-emerald-400 border-emerald-200'
                          : res === 'miss'
                            ? 'bg-rose-500 border-rose-300'
                            : 'bg-slate-800 border-slate-600'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Live Training & Free-Kicks Drill Switcher Bar */}
          {mode === 'training' && (
            <div
              data-testid="training-drill-toolbar"
              className="mt-1.5 flex flex-wrap items-center gap-1 rounded-lg bg-[#0B1117]/90 border border-emerald-500/40 p-1 text-[10px] font-bold text-white shadow-lg"
            >
              {(
                [
                  { id: 'free_play', label: 'Práctica Libre' },
                  { id: 'free_kicks', label: 'Tiros Libres / Faltas' },
                  { id: 'shooting', label: 'Definición' },
                  { id: 'passing', label: 'Pases' },
                  { id: 'dribbling', label: 'Regates 1v1' },
                ] as const
              ).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  data-testid={`btn-drill-${d.id}`}
                  onClick={() => {
                    setActiveTrainingDrill(d.id);
                    engineRef.current?.setTrainingDrill(d.id);
                  }}
                  className={`rounded px-2 py-1 transition-colors cursor-pointer ${
                    activeTrainingDrill === d.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-900/90 text-slate-300 hover:text-white'
                  }`}
                >
                  {d.label}
                </button>
              ))}
              <button
                type="button"
                data-testid="btn-training-reset"
                onClick={() => engineRef.current?.setupTrainingScenario()}
                className="rounded bg-amber-500/20 border border-amber-400/50 text-amber-300 hover:bg-amber-500/30 px-2 py-1 cursor-pointer"
              >
                ↻ Nueva Jugada
              </button>
            </div>
          )}
        </div>

        {/* Top-Right: Broadcast Toolbar + Translucent ATLAS SPORTS LIVE Watermark Bug */}
        <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 ml-auto shrink-0">
          {/* 3D Camera Angle Switcher */}
          <button
            type="button"
            onClick={cycleCamera}
            title="Cambiar cámara de transmisión 3D (Tecla C)"
            aria-label="Cambiar cámara 3D"
            className="flex items-center gap-1 bg-[#0B1117]/80 hover:bg-slate-800 border border-white/15 rounded px-2 py-1 text-[11px] font-semibold text-sky-300 min-h-[30px] sm:min-h-[32px] cursor-pointer"
          >
            <Video className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">{CAMERA_LABELS[activeCameraMode]}</span>
          </button>

          {/* Instant 3D Replay Trigger */}
          {hud.phase === 'live' && (
            <button
              type="button"
              onClick={() => engineRef.current?.triggerInstantReplay()}
              title="Ver Repetición 3D de la última jugada (Tecla R)"
              aria-label="Repetición 3D"
              className="hidden md:flex items-center gap-1 bg-[#0B1117]/80 hover:bg-slate-800 border border-white/15 rounded px-2 py-1 text-[11px] font-semibold text-rose-300 min-h-[30px] sm:min-h-[32px] cursor-pointer"
            >
              <Rewind className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Uniforms / Kits Selector */}
          <button
            type="button"
            onClick={() => setShowKitMenu((v) => !v)}
            title="Cambiar uniforme Local / Visitante / 3º"
            aria-label="Elegir uniforme"
            className="flex items-center gap-1 bg-[#0B1117]/80 hover:bg-slate-800 border border-white/15 rounded px-2 py-1 text-[11px] font-semibold text-slate-200 min-h-[30px] sm:min-h-[32px] cursor-pointer"
          >
            <Shirt className="w-3.5 h-3.5 text-amber-400" />
          </button>

          {/* Professional Dual-Voice Commentator Toggle */}
          <button
            type="button"
            onClick={() => setCommentaryEnabled((v) => !v)}
            title={commentaryEnabled ? 'Relator + Comentarista Gemini Activos' : 'Relator Silenciado'}
            aria-label="Activar o silenciar relator"
            className={`flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-semibold min-h-[30px] sm:min-h-[32px] cursor-pointer ${
              commentaryEnabled
                ? 'bg-emerald-950/85 border-emerald-500/50 text-emerald-300'
                : 'bg-[#0B1117]/80 border-white/15 text-slate-400'
            }`}
          >
            {commentaryEnabled ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
          </button>

          {/* Modo Hinchada Picante Toggle */}
          <button
            type="button"
            data-testid="btn-spicy-crowd"
            onClick={() => setSpicyCrowdMode((v) => !v)}
            title={
              spicyCrowdMode
                ? 'Modo Hinchada Picante ACTIVO (Cánticos e insultos de tribuna)'
                : 'Modo Hinchada Picante DESACTIVADO'
            }
            aria-label="Alternar Modo Hinchada Picante"
            className={`hidden sm:flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-semibold min-h-[30px] sm:min-h-[32px] cursor-pointer ${
              spicyCrowdMode
                ? 'bg-amber-950/85 border-amber-500/50 text-amber-300'
                : 'bg-[#0B1117]/80 border-white/15 text-slate-400'
            }`}
          >
            <span>🔥</span>
          </button>

          {userSide !== 'none' && mode !== 'penalties' && (
            <>
              <button
                type="button"
                data-testid="btn-tactics-toggle"
                onClick={() => setShowTacticsMenu((v) => !v)}
                aria-label="Cambiar táctica en vivo"
                className="flex items-center gap-1 bg-[#0B1117]/80 hover:bg-slate-800 border border-white/15 rounded px-2 py-1 text-[11px] font-semibold text-slate-100 min-h-[30px] sm:min-h-[32px] cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden lg:inline">{hud.userFormation}</span>
              </button>

              <button
                type="button"
                data-testid="btn-subs-modal"
                onClick={() => {
                  pausedRef.current = true;
                  setShowSubsModal(true);
                }}
                aria-label="Sustituciones"
                className="flex items-center gap-1 bg-[#0B1117]/80 hover:bg-slate-800 border border-white/15 rounded px-2 py-1 text-[11px] font-semibold text-slate-100 min-h-[30px] sm:min-h-[32px] cursor-pointer"
              >
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-mono-tabular">
                  {hud.subsUsed}/{settings.match.maxSubstitutions}
                </span>
              </button>
            </>
          )}

          {isViewportPortrait && (
            <button
              type="button"
              onClick={() => setForceRotatedLandscape((v) => !v)}
              title="Alternar Giro Horizontal Automático"
              aria-label="Giro horizontal"
              className="flex items-center justify-center rounded border border-amber-400/50 bg-amber-950/80 text-amber-300 px-2 py-1 min-h-[30px] min-w-[30px] cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 rotate-90" />
            </button>
          )}

          {/* Master Audio Mute / Unmute Toggle */}
          <button
            type="button"
            data-testid="btn-toggle-audio-mute"
            onClick={() => setSoundMuted((v) => !v)}
            title={soundMuted ? 'Audio Silenciado' : 'Motor de Sonido Activo'}
            aria-label="Silenciar o activar audio del estadio"
            className={`flex items-center justify-center rounded border px-2 py-1 min-h-[30px] min-w-[30px] sm:min-h-[32px] sm:min-w-[32px] cursor-pointer ${
              !soundMuted
                ? 'bg-[#0B1117]/80 border-white/15 text-emerald-300'
                : 'bg-rose-950/80 border-rose-500/40 text-rose-300'
            }`}
          >
            {soundMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => {
              userToggledTouchRef.current = true;
              setShowTouchOverlay((v) => !v);
            }}
            aria-label="Mostrar u ocultar controles táctiles"
            className={`flex items-center justify-center rounded border px-2 py-1 min-h-[30px] min-w-[30px] sm:min-h-[32px] sm:min-w-[32px] cursor-pointer ${
              showTouchOverlay
                ? 'bg-emerald-700 border-emerald-400 text-white'
                : 'bg-[#0B1117]/80 border-white/15 text-slate-300'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            data-testid="btn-pause-match"
            onClick={togglePause}
            aria-label="Pausar partido"
            className="flex items-center justify-center bg-[#0B1117]/80 hover:bg-slate-800 border border-white/15 rounded px-2 py-1 text-white min-h-[30px] min-w-[30px] sm:min-h-[32px] sm:min-w-[32px] cursor-pointer"
          >
            <Pause className="w-3.5 h-3.5" />
          </button>

          {/* Translucent Broadcast TV Watermark Bug */}
          <div className="hidden md:flex flex-col items-center justify-center border border-white/25 bg-white/10 px-2 py-0.5 rounded-xs text-white/75 leading-none select-none ml-1">
            <span className="font-display text-[10px] font-black tracking-widest">ATLAS SPORTS</span>
            <span className="font-display text-[9px] font-bold tracking-[0.25em] text-white/65">L I V E</span>
          </div>
        </div>
      </div>

      {/* Live Action Power Meter HUD Banner (when holding PASAR, FILTRAR, CENTRO, or TIRO) */}
      {hud.shootCharging && hud.chargeAction && (
        <div
          data-testid="hud-power-meter"
          className="pointer-events-none absolute bottom-14 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1 rounded-xl bg-[#0B1117]/95 border border-white/25 px-4 py-2 shadow-2xl"
        >
          <div className="flex items-center justify-between w-40 text-[10px] font-display font-black tracking-widest text-white">
            <span>{CHARGE_ACTION_LABELS[hud.chargeAction]}</span>
            <span className="font-mono-tabular text-[#D9F938]">{Math.round(hud.shootPower * 100)}%</span>
          </div>
          <div className="w-40 h-2.5 rounded-full bg-slate-800 overflow-hidden border border-white/20">
            <div
              style={{ width: `${Math.round(hud.shootPower * 100)}%` }}
              className={`h-full transition-none ${
                hud.shootPower > 0.85
                  ? 'bg-rose-500'
                  : hud.shootPower > 0.55
                    ? 'bg-amber-400'
                    : 'bg-emerald-400'
              }`}
            />
          </div>
        </div>
      )}

      {/* Active Skill Move (Regate) HUD Badge */}
      {hud.lastSkillMove && (
        <div
          data-testid="skill-move-badge"
          className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-xl bg-fuchsia-950/90 border border-fuchsia-400/70 px-3.5 py-1.5 text-xs font-display font-black tracking-wider text-fuchsia-100 shadow-xl"
        >
          <Sparkles className="w-3.5 h-3.5 text-fuchsia-300" />
          <span>✨ REGATE: {hud.lastSkillMove.label}</span>
        </div>
      )}

      {/* Dynamic Broadcast Cutscene Control Bar (Cards, Corners, Throw-Ins, Goals) with Omitir & Ver Repetición */}
      {(hud.cutsceneState?.active || hud.phase === 'goal_celebration') && (
        <div
          data-testid="dynamic-cutscene-overlay"
          className="pointer-events-auto absolute bottom-28 right-3 sm:right-5 z-30 flex items-center gap-2.5 rounded-xl bg-[#0B1117]/95 border border-emerald-400/60 px-3.5 py-2 shadow-2xl"
        >
          <div className="text-left pr-1">
            <div className="text-[10px] font-display font-black uppercase tracking-widest text-emerald-400">
              {hud.cutsceneState?.title ?? '¡GOOOOL! CELEBRACIÓN EN TRIBUNA'}
            </div>
            <div className="text-[11px] font-semibold text-slate-200">
              {hud.cutsceneState?.subtitle ?? 'Los jugadores festejan junto al banderín de córner'}
            </div>
          </div>

          {(hud.cutsceneState?.type === 'goal' || hud.phase === 'goal_celebration') && (
            <button
              type="button"
              data-testid="btn-watch-replay"
              onClick={() => engineRef.current?.triggerInstantReplay()}
              className="inline-flex items-center gap-1 rounded-lg bg-rose-600 hover:bg-rose-500 px-3 py-1.5 text-xs font-extrabold text-white shadow cursor-pointer"
            >
              <Rewind className="w-3.5 h-3.5" />
              <span>Ver Repetición</span>
            </button>
          )}

          <button
            type="button"
            data-testid="btn-skip-cutscene"
            onClick={() => engineRef.current?.skipCutscene()}
            className="rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/20 px-3 py-1.5 text-xs font-extrabold text-white cursor-pointer"
          >
            Omitir ⏭
          </button>
        </div>
      )}

      {/* Referee Card Cutscene Broadcast Overlay (Pauses Match & Shows Referee Raising Yellow/Red Card) */}
      {hud.cardCutscene?.active && (
        <div
          data-testid="referee-card-cutscene"
          className="pointer-events-none absolute inset-x-0 top-20 z-30 flex justify-center px-4"
        >
          <div className="flex items-center gap-4 rounded-2xl bg-[#0B1117]/95 border-2 border-amber-400/70 px-5 py-3.5 shadow-2xl">
            <div
              className={`w-10 h-14 rounded-md shadow-xl border-2 border-white/80 flex items-center justify-center font-display text-xs font-black animate-bounce ${
                hud.cardCutscene.card === 'red'
                  ? 'bg-rose-600 text-white'
                  : 'bg-amber-400 text-slate-950'
              }`}
            >
              {hud.cardCutscene.card === 'red' ? 'ROJA' : 'AMAR.'}
            </div>
            <div>
              <div className="text-[10px] font-display font-extrabold uppercase tracking-widest text-amber-300">
                DECISIÓN DEL ÁRBITRO · FALTA SANCIONADA
              </div>
              <div className="font-display text-xl sm:text-2xl font-black text-white leading-tight">
                #{hud.cardCutscene.playerNumber} {hud.cardCutscene.playerName}
              </div>
              <div className="text-xs text-slate-300">
                {hud.cardCutscene.card === 'red'
                  ? '🟥 EXPULSIÓN DIRECTA · El jugador abandona el campo (Equipo con 10)'
                  : '🟨 AMONESTACIÓN · Tarjeta Amarilla'}{' '}
                ({hud.cardCutscene.foulLabel.toUpperCase()})
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full 5-Scenario VAR (Video Assistant Referee) Broadcast Monitor Overlay */}
      {hud.varReview?.active && (
        <div
          data-testid="var-review-overlay"
          className="pointer-events-none absolute inset-x-0 top-16 sm:top-20 z-30 flex justify-center px-4"
        >
          <div className="w-full max-w-xl rounded-2xl bg-[#0B1117]/95 border-2 border-sky-400/80 px-5 py-3.5 shadow-2xl space-y-2">
            <div className="flex items-center justify-between border-b border-white/15 pb-2">
              <div className="flex items-center gap-2.5">
                <div className="px-2.5 py-1 rounded bg-sky-500 text-slate-950 font-display text-xs font-black tracking-widest">
                  VAR · VOR
                </div>
                <span className="text-[11px] font-display font-black uppercase tracking-widest text-sky-300">
                  {hud.varReview.title}
                </span>
              </div>
              <span className="rounded bg-slate-900 border border-sky-400/40 px-2 py-0.5 text-[10px] font-mono-tabular font-bold text-sky-300">
                {hud.varReview.cameraAngleIndex === 1
                  ? 'ÁNGULO 1/3 · LÍNEA VIRTUAL 3D'
                  : hud.varReview.cameraAngleIndex === 2
                    ? 'ÁNGULO 2/3 · ZOOM CONTACTO'
                    : 'ÁNGULO 3/3 · MONITOR ÁRBITRO'}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-slate-300">{hud.varReview.subtitle}</div>
                <div
                  data-testid="var-decision-status"
                  className={`mt-1 font-display text-base sm:text-xl font-black tracking-wide ${
                    hud.varReview.phase === 'decision'
                      ? 'text-[#D9F938]'
                      : 'text-white animate-pulse'
                  }`}
                >
                  {hud.varReview.phase === 'decision'
                    ? hud.varReview.decisionText
                    : 'ANALIZANDO CUADRO POR CUADRO EN SALA VAR...'}
                </div>
              </div>
              <div className="text-right shrink-0">
                <span
                  className={`inline-block rounded-lg px-2.5 py-1 text-[10px] font-display font-black uppercase tracking-wider ${
                    hud.varReview.phase === 'decision'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-amber-400 text-slate-950'
                  }`}
                >
                  {hud.varReview.phase === 'decision' ? 'VEREDICTO OFICIAL' : 'REVISIÓN EN CURSO'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VAR Offside Cutscene Broadcast Overlay */}
      {hud.offsideCutscene?.active && !hud.varReview?.active && (
        <div
          data-testid="var-offside-cutscene"
          className="pointer-events-none absolute inset-x-0 top-20 z-30 flex justify-center px-4"
        >
          <div className="flex items-center gap-3.5 rounded-2xl bg-[#0B1117]/95 border-2 border-rose-500 px-5 py-3 shadow-2xl">
            <div className="w-10 h-10 rounded-xl bg-rose-600/25 border border-rose-400 flex items-center justify-center text-rose-400">
              <Flag className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="text-[10px] font-display font-black uppercase tracking-widest text-rose-400">
                VAR · LÍNEA DE FUERA DE JUEGO 3D
              </div>
              <div className="font-display text-lg sm:text-xl font-black text-white">
                POSICIÓN ADELANTADA · {hud.offsideCutscene.playerName}
              </div>
              <div className="text-[11px] text-slate-300">
                Tiro libre indirecto a favor de{' '}
                {hud.offsideCutscene.teamSide === 'home' ? awayTeam.name : homeTeam.name}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rain Lightning Strike Easter Egg Alert Banner */}
      {hud.lightningPlayerName && (
        <div
          data-testid="lightning-easter-egg-banner"
          className="pointer-events-none absolute top-24 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 rounded-xl bg-sky-950/95 border-2 border-sky-300 px-4 py-2 text-xs sm:text-sm font-display font-black text-sky-100 shadow-2xl animate-pulse"
        >
          <Zap className="w-5 h-5 text-amber-300" />
          <span>⚡ ¡RAYO EN LA TORMENTA! {hud.lightningPlayerName} quedó aturdido en el césped</span>
        </div>
      )}

      {/* Referee Advantage Rule Indicator (Ley de Ventaja) */}
      {hud.advantageActive && (
        <div
          data-testid="advantage-badge"
          className="pointer-events-none absolute top-14 right-3 sm:right-5 z-20 flex items-center gap-2 rounded bg-amber-500 text-slate-950 px-3 py-1 text-xs font-display font-extrabold tracking-wider shadow-lg"
        >
          <span>🟨 ÁRBITRO: LEY DE VENTAJA</span>
        </div>
      )}

      {/* Portrait Device Warning Overlay */}
      {isViewportPortrait && !forceRotatedLandscape && (
        <div className="absolute inset-0 z-50 bg-[#0B1117]/95 flex flex-col items-center justify-center p-6 text-center">
          <Smartphone className="w-14 h-14 text-emerald-400 rotate-90 mb-3 animate-bounce" />
          <h2 className="font-display text-3xl font-extrabold text-white">
            ORIENTACIÓN HORIZONTAL OBLIGATORIA
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-sm mt-2">
            Los partidos 3D de Atlas Fútbol Pro están diseñados exclusivamente para jugarse en pantalla horizontal panorámica. Gira tu celular o activa el giro horizontal automático.
          </p>
          <button
            type="button"
            onClick={() => {
              setForceRotatedLandscape(true);
              requestNativeLandscape();
            }}
            className="mt-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-xl cursor-pointer min-h-[46px]"
          >
            Jugar en Vista Horizontal Panorámica
          </button>
        </div>
      )}

      {/* Uniforms / Kits Selection Popover */}
      {showKitMenu && (
        <div className="absolute top-14 right-14 z-30 w-64 rounded-xl bg-[#101923] border border-slate-700 p-3 shadow-2xl space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white">Indumentaria 3D en Cancha</span>
            <button
              type="button"
              onClick={() => setShowKitMenu(false)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </div>
          <div>
            <div className="text-slate-400 mb-1">{homeTeam.shortName} (Local)</div>
            <div className="grid grid-cols-3 gap-1.5">
              {(['home', 'away', 'third'] as KitSelection[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setHomeKit(k)}
                  className={`rounded-lg py-1.5 px-2 font-semibold border cursor-pointer ${
                    homeKit === k
                      ? 'bg-emerald-600 border-emerald-400 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-300'
                  }`}
                >
                  {KIT_LABELS[k]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-slate-400 mb-1">{awayTeam.shortName} (Visitante)</div>
            <div className="grid grid-cols-3 gap-1.5">
              {(['home', 'away', 'third'] as KitSelection[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setAwayKit(k)}
                  className={`rounded-lg py-1.5 px-2 font-semibold border cursor-pointer ${
                    awayKit === k
                      ? 'bg-emerald-600 border-emerald-400 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-300'
                  }`}
                >
                  {KIT_LABELS[k]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Live Manager Tactics & Formations Dropdown (Técnico en Área Técnica) */}
      {showTacticsMenu && (
        <div
          data-testid="tactics-menu-popover"
          className="absolute top-14 right-3 z-30 w-72 rounded-xl bg-[#101923] border border-slate-700 p-3 shadow-2xl space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white">Pizarra del Director Técnico</span>
            <button
              type="button"
              onClick={() => setShowTacticsMenu(false)}
              className="text-slate-400 hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1.5">
              <span>Formación ({FORMATIONS.length} Esquemas)</span>
              <span className="text-emerald-400 font-mono-tabular">{hud.userFormation}</span>
            </div>
            <div className="max-h-44 overflow-y-auto grid grid-cols-1 gap-1 pr-1">
              {FORMATIONS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    engineRef.current?.setUserFormation(f.id);
                    setHud((prev) => ({ ...prev, userFormation: f.id }));
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-left text-xs font-bold border cursor-pointer flex items-center justify-between gap-2 ${
                    hud.userFormation === f.id
                      ? 'bg-emerald-600 border-emerald-400 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="truncate">{f.nombre}</span>
                  <span className="text-[10px] font-normal opacity-80 shrink-0">{f.categoria}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-slate-400 mb-1.5">Estilo de Juego</div>
            <div className="space-y-1">
              {(Object.keys(TACTICAL_LABELS) as TacticalStyle[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    engineRef.current?.setUserTactic(t);
                    setShowTacticsMenu(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    hud.userTactic === t ? 'bg-emerald-600 text-white' : 'text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {TACTICAL_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TV Replay Broadcast Overlay (3 Interactive Slow-Motion Camera Angles + Free Orbit + Skip Replay Button) */}
      {hud.phase === 'goal_replay' && (
        <div
          data-testid="tv-replay-overlay"
          className="pointer-events-auto absolute top-14 right-3 sm:right-4 z-30 flex flex-col gap-2 rounded-xl bg-[#0B1117]/95 border-2 border-rose-500 px-3.5 py-2.5 text-xs font-display font-bold tracking-wider text-white shadow-2xl"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              <div className="flex flex-col">
                <span className="text-rose-400 text-[10px] uppercase tracking-widest">
                  REPETICIÓN INSTANTÁNEA (0.5x) · {hud.replayTitle ?? 'JUGADA DESTACADA'}
                </span>
                <span className="text-white text-xs">
                  {hud.replayAngle === 'broadcast_slow'
                    ? 'CÁMARA 1 · TRANSMISIÓN TV'
                    : hud.replayAngle === 'behind_goal_zoom'
                      ? 'CÁMARA 2 · DETRÁS DEL ARCO ZOOM'
                      : 'CÁMARA 3 · CÁMARA LIBRE 360°'}
                </span>
              </div>
            </div>
            <button
              type="button"
              data-testid="btn-skip-replay"
              onClick={() => engineRef.current?.skipReplay()}
              className="rounded-lg bg-rose-600 hover:bg-rose-500 px-2.5 py-1 text-[11px] font-extrabold text-white cursor-pointer"
            >
              Saltar ⏭
            </button>
          </div>

          {/* 3 Interactive Camera Angle Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-white/15">
            <button
              type="button"
              data-testid="btn-replay-cam-tv"
              onClick={() => {
                engineRef.current?.setReplayCameraAngle('broadcast_slow');
                setHud((p) => ({ ...p, replayAngle: 'broadcast_slow' }));
              }}
              className={`rounded-md px-2 py-1 text-[10px] font-extrabold border cursor-pointer ${
                hud.replayAngle === 'broadcast_slow'
                  ? 'bg-emerald-600 border-emerald-300 text-white'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              1. Cámara TV
            </button>
            <button
              type="button"
              data-testid="btn-replay-cam-goal"
              onClick={() => {
                engineRef.current?.setReplayCameraAngle('behind_goal_zoom');
                setHud((p) => ({ ...p, replayAngle: 'behind_goal_zoom' }));
              }}
              className={`rounded-md px-2 py-1 text-[10px] font-extrabold border cursor-pointer ${
                hud.replayAngle === 'behind_goal_zoom'
                  ? 'bg-emerald-600 border-emerald-300 text-white'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              2. Detrás del Arco
            </button>
            <button
              type="button"
              data-testid="btn-replay-cam-free"
              onClick={() => {
                engineRef.current?.setReplayCameraAngle('low_sideline_slow');
                setHud((p) => ({ ...p, replayAngle: 'low_sideline_slow' }));
              }}
              className={`rounded-md px-2 py-1 text-[10px] font-extrabold border cursor-pointer ${
                hud.replayAngle === 'low_sideline_slow'
                  ? 'bg-emerald-600 border-emerald-300 text-white'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              3. Cámara Libre 360°
            </button>

            {hud.replayAngle === 'low_sideline_slow' && (
              <div className="flex items-center gap-1 ml-1">
                <button
                  type="button"
                  data-testid="btn-replay-orbit-left"
                  onClick={() => engineRef.current?.adjustReplayFreeCamAngle(-0.45)}
                  className="rounded bg-slate-800 hover:bg-slate-700 px-2 py-1 text-[10px] font-bold text-amber-300 cursor-pointer"
                >
                  ⟲ Girar
                </button>
                <button
                  type="button"
                  data-testid="btn-replay-orbit-right"
                  onClick={() => engineRef.current?.adjustReplayFreeCamAngle(0.45)}
                  className="rounded bg-slate-800 hover:bg-slate-700 px-2 py-1 text-[10px] font-bold text-amber-300 cursor-pointer"
                >
                  Girar ⟳
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Match Event Banner */}
      {hud.banner && (
        <div className="pointer-events-none absolute top-12 sm:top-14 left-1/2 -translate-x-1/2 z-20 rounded-lg bg-[#0B1117]/95 border border-emerald-500/40 px-3.5 py-1 text-xs sm:text-sm font-display font-bold tracking-wide text-white shadow-xl whitespace-nowrap">
          {hud.banner}
        </div>
      )}

      {/* Live Broadcast Dual-Voice Commentary Ticker + Crowd Chant Banner */}
      {liveSubtitle && (
        <div
          data-testid="commentary-ticker"
          className={`pointer-events-none absolute ${
            hud.banner ? 'top-[82px] sm:top-[92px]' : 'top-12 sm:top-14'
          } left-1/2 -translate-x-1/2 z-10 max-w-[68%] sm:max-w-lg rounded-lg border px-3 py-1.5 text-[11px] sm:text-xs font-medium shadow-xl transition-all flex flex-col gap-0.5 ${
            liveSubtitle.excitement === 'goal'
              ? 'bg-emerald-950/95 border-emerald-400 text-white font-bold'
              : liveSubtitle.excitement === 'high'
                ? 'bg-[#0B1117]/95 border-amber-400/50 text-amber-100'
                : 'bg-[#0B1117]/90 border-white/10 text-slate-200'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Mic className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">
              <strong className="text-emerald-300">Relator:</strong> {liveSubtitle.text}
            </span>
          </div>
          {liveSubtitle.comentaristaText && (
            <div className="text-[10px] sm:text-[11px] text-sky-200 truncate pl-4">
              <strong className="text-sky-400">Comentarista:</strong> {liveSubtitle.comentaristaText}
            </div>
          )}
          {liveSubtitle.crowdChantText && spicyCrowdMode && (
            <div className="text-[10px] text-amber-300 font-semibold truncate pl-4">
              🔥 <span>Tribuna: &ldquo;{liveSubtitle.crowdChantText}&rdquo;</span>
            </div>
          )}
        </div>
      )}

      {/* Interactive Free Kick with Wall / In-Match Penalty Control HUD */}
      {hud.phase === 'set_piece' && hud.freeKick?.awaitingUserInput && (
        <div
          data-testid="free-kick-panel"
          className="absolute bottom-36 sm:bottom-28 left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-md rounded-xl bg-[#101923]/95 border border-emerald-500/50 p-3.5 shadow-2xl text-xs space-y-2.5"
        >
          <div className="flex items-center justify-between">
            <span className="font-display text-sm font-bold text-emerald-400 flex items-center gap-1.5">
              <Target className="w-4 h-4" />
              {hud.freeKick.isInMatchPenalty
                ? 'COBRO DE PENAL · MIRA Y POTENCIA'
                : `TIRO LIBRE CON BARRERA (${hud.freeKick.wallPlayerIds.length} JUGADORES)`}
            </span>
            <span className="text-[11px] text-slate-400">Arco 3D Activo</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] text-slate-300 mb-0.5">
                Dirección ({hud.freeKick.aimOffset > 0 ? 'Der.' : hud.freeKick.aimOffset < 0 ? 'Izq.' : 'Centro'})
              </label>
              <input
                type="range"
                min={-1.05}
                max={1.05}
                step={0.05}
                value={hud.freeKick.aimOffset}
                onChange={(e) => updateFreeKickParam({ aimOffset: parseFloat(e.target.value) })}
                className="w-full accent-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[10px] text-slate-300 mb-0.5">
                Potencia ({Math.round(hud.freeKick.power * 100)}%)
              </label>
              <input
                type="range"
                min={0.4}
                max={1.0}
                step={0.03}
                value={hud.freeKick.power}
                onChange={(e) => updateFreeKickParam({ power: parseFloat(e.target.value) })}
                className="w-full accent-amber-500"
              />
            </div>

            <div>
              <label className="block text-[10px] text-slate-300 mb-0.5">
                Efecto / Curva ({Math.round(hud.freeKick.curve * 100)}%)
              </label>
              <input
                type="range"
                min={-1.0}
                max={1.0}
                step={0.05}
                value={hud.freeKick.curve}
                onChange={(e) => updateFreeKickParam({ curve: parseFloat(e.target.value) })}
                className="w-full accent-sky-400"
              />
            </div>
          </div>

          {!hud.freeKick.isInMatchPenalty && (
            <div className="flex items-center gap-1.5">
              {(['curva', 'raso', 'globo'] as StrikeType[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setFkStrikeType(st);
                    updateFreeKickParam({ strikeType: st });
                  }}
                  className={`flex-1 py-1.5 rounded-lg font-semibold border cursor-pointer capitalize ${
                    (hud.freeKick?.strikeType ?? fkStrikeType) === st
                      ? 'bg-emerald-700 border-emerald-400 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-300'
                  }`}
                >
                  {st === 'curva' ? 'Rosca sobre Barrera' : st === 'raso' ? 'Raso Potente' : 'Globo / Centro'}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                triggerHaptic([24, 16, 32]);
                engineRef.current?.executeFreeKickOrInMatchPenalty(
                  hud.freeKick!.aimOffset,
                  hud.freeKick!.aimHeight,
                  hud.freeKick!.power,
                  hud.freeKick!.curve,
                  hud.freeKick!.strikeType
                );
              }}
              className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 py-2 text-xs font-bold text-white shadow-lg cursor-pointer min-h-[38px]"
            >
              {hud.freeKick.isInMatchPenalty ? '¡Ejecutar Penal!' : '¡Disparar Tiro Libre!'}
            </button>
            {!hud.freeKick.isInMatchPenalty && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(14);
                  if (engineRef.current) engineRef.current.userInput.passPressed = true;
                }}
                className="rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 cursor-pointer min-h-[38px]"
              >
                Pase Corto
              </button>
            )}
          </div>
        </div>
      )}

      {/* EA SPORTS FC Bottom Broadcast HUD: Bottom-Left Active Player Nameplate, Bottom-Center Translucent 2D Pitch Radar, Bottom-Right Opponent Nameplate */}
      {hud.phase !== 'penalty_shootout' && (
        <>
          {/* Bottom-Left: Active User Player Nameplate */}
          {hud.activePlayer && (
            <div
              data-testid="active-player-hud"
              className="pointer-events-none absolute bottom-2.5 left-3 sm:left-5 z-20 flex items-stretch h-8 sm:h-9 shadow-2xl border border-black/50"
            >
              <div className="w-8 sm:w-9 bg-[#D9F938] flex items-center justify-center shrink-0">
                <TeamCrest team={userSide === 'away' ? awayTeam : homeTeam} size={22} />
              </div>
              <div className="relative flex items-center gap-1.5 bg-[#0F172A]/90 px-2.5 sm:px-3.5 min-w-[125px] sm:min-w-[165px]">
                {/* Top Stamina Bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-slate-800">
                  <div
                    style={{ width: `${Math.max(5, Math.round(hud.activePlayer.stamina))}%` }}
                    className={`h-full transition-all ${
                      hud.activePlayer.stamina > 50
                        ? 'bg-sky-400'
                        : hud.activePlayer.stamina > 25
                          ? 'bg-amber-400'
                          : 'bg-rose-500'
                    }`}
                  />
                </div>
                <span className="font-display text-sm sm:text-base font-black text-[#D9F938] tabular-nums">
                  {hud.activePlayer.number}
                </span>
                <span className="font-display text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white truncate max-w-[100px] sm:max-w-[130px]">
                  {hud.activePlayer.name.split(' ').slice(-1)[0]}
                </span>
                {hud.activePlayer.yellowCards > 0 && (
                  <span className="ml-auto inline-block w-2 h-3 rounded-xs bg-amber-400" title="Amonestado" />
                )}
                {hud.activePlayer.injured && (
                  <span className="ml-auto px-1 py-0.5 rounded bg-rose-600 text-[9px] font-bold text-white">+</span>
                )}
              </div>
            </div>
          )}

          {/* Bottom-Center: Ultra-Transparent EA SPORTS FC 2D Tactical Pitch Radar Minimap */}
          {settings.visual.showRadar && (
            <div
              data-testid="tactical-radar"
              className="pointer-events-none absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20"
            >
              <div className="relative w-[138px] h-[84px] sm:w-[172px] sm:h-[104px] bg-[#0B1710]/35 border border-white/20 opacity-85 overflow-hidden rounded-xs">
                {/* Outer Pitch Line */}
                <div className="absolute inset-1 border border-white/30" />
                {/* Halfway Line */}
                <div className="absolute top-1 bottom-1 left-1/2 w-px bg-white/30" />
                {/* Center Circle */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-white/30" />
                {/* Left Penalty Area */}
                <div className="absolute left-1 top-1/2 -translate-y-1/2 w-5 sm:w-6 h-11 sm:h-14 border-y border-r border-white/30" />
                {/* Right Penalty Area */}
                <div className="absolute right-1 top-1/2 -translate-y-1/2 w-5 sm:w-6 h-11 sm:h-14 border-y border-l border-white/30" />

                {/* 22 Players on Radar */}
                {hud.radarPlayers.map((rp) => (
                  <div
                    key={rp.id}
                    style={{
                      left: `${(rp.x / PITCH.LENGTH) * 100}%`,
                      top: `${(rp.y / PITCH.WIDTH) * 100}%`,
                      backgroundColor: rp.side === 'home' ? '#EF4444' : '#38BDF8',
                    }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${
                      rp.active
                        ? 'w-2.5 h-2.5 ring-2 ring-[#D9F938] z-10'
                        : rp.calling
                          ? 'w-2.5 h-2.5 ring-1 ring-amber-300'
                          : 'w-2 h-2 border border-white/75'
                    }`}
                  />
                ))}

                {/* Ball Marker on Radar */}
                <div
                  style={{
                    left: `${(hud.ballX / PITCH.LENGTH) * 100}%`,
                    top: `${(hud.ballY / PITCH.WIDTH) * 100}%`,
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#FACC15] ring-1 ring-black z-20"
                />
              </div>
            </div>
          )}

          {/* Bottom-Right: Opponent Active/Nearest Player Nameplate */}
          {hud.opponentPlayer && (
            <div
              data-testid="opponent-player-hud"
              className="pointer-events-none absolute bottom-2.5 right-3 sm:right-5 z-20 flex items-stretch h-8 sm:h-9 shadow-2xl border border-black/50"
            >
              <div className="relative flex items-center justify-end gap-1.5 bg-[#0F172A]/90 px-2.5 sm:px-3.5 min-w-[125px] sm:min-w-[165px]">
                {/* Top Stamina Bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-slate-800">
                  <div
                    style={{ width: `${Math.max(5, Math.round(hud.opponentPlayer.stamina))}%` }}
                    className={`h-full ml-auto transition-all ${
                      hud.opponentPlayer.stamina > 50
                        ? 'bg-sky-400'
                        : hud.opponentPlayer.stamina > 25
                          ? 'bg-amber-400'
                          : 'bg-rose-500'
                    }`}
                  />
                </div>
                {hud.opponentPlayer.yellowCards > 0 && (
                  <span className="mr-auto inline-block w-2 h-3 rounded-xs bg-amber-400" title="Amonestado" />
                )}
                <span className="font-display text-sm sm:text-base font-black text-[#D9F938] tabular-nums">
                  {hud.opponentPlayer.number}
                </span>
                <span className="font-display text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white truncate max-w-[100px] sm:max-w-[130px]">
                  {hud.opponentPlayer.name.split(' ').slice(-1)[0]}
                </span>
              </div>
              <div className="w-8 sm:w-9 bg-[#D9F938] flex items-center justify-center shrink-0">
                <TeamCrest team={userSide === 'away' ? homeTeam : awayTeam} size={22} />
              </div>
            </div>
          )}
        </>
      )}

      {/* Interactive Penalty Shootout Mini-System with Target Reticle (Mira) & Power/Risk Meter */}
      {hud.phase === 'penalty_shootout' && hud.penalty && (
        <div className="absolute inset-x-0 bottom-4 z-30 flex flex-col items-center px-4">
          <div className="w-full max-w-lg rounded-xl bg-[#101923]/95 border border-slate-700 p-4 shadow-2xl">
            <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
              <span className="font-bold text-white">
                {homeTeam.shortName}: {hud.penalty.homeScored}
              </span>
              <span className="text-amber-400 font-semibold">{hud.penalty.lastOutcomeText}</span>
              <span className="font-bold text-white">
                {awayTeam.shortName}: {hud.penalty.awayScored}
              </span>
            </div>

            <div className="flex justify-between gap-4 mb-3 text-xs font-mono-tabular">
              <div className="flex gap-1">
                {hud.penalty.historyHome.map((h, i) => (
                  <span
                    key={i}
                    className={`w-4 h-4 rounded-full inline-flex items-center justify-center text-[10px] font-bold ${
                      h === 'goal' ? 'bg-emerald-500 text-slate-950' : 'bg-rose-600 text-white'
                    }`}
                  >
                    {h === 'goal' ? '✓' : '✕'}
                  </span>
                ))}
              </div>
              <div className="flex gap-1">
                {hud.penalty.historyAway.map((h, i) => (
                  <span
                    key={i}
                    className={`w-4 h-4 rounded-full inline-flex items-center justify-center text-[10px] font-bold ${
                      h === 'goal' ? 'bg-emerald-500 text-slate-950' : 'bg-rose-600 text-white'
                    }`}
                  >
                    {h === 'goal' ? '✓' : '✕'}
                  </span>
                ))}
              </div>
            </div>

            {hud.penalty.awaitingUserInput ? (
              <div className="space-y-3">
                {/* Interactive Goal Frame with Movable Reticle (Mira) */}
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1">
                    <span>Mira de Dirección (Haz clic en el arco o usa controles)</span>
                    <span className={Math.abs(penAimX) > 0.92 || penAimY > 0.92 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                      {Math.abs(penAimX) > 0.92 || penAimY > 0.92 ? '¡Riesgo de Palo / Afuera!' : 'Zona de Gol'}
                    </span>
                  </div>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="Seleccionar punto de mira en el arco"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                      const ny = 1 - (e.clientY - rect.top) / rect.height;
                      setPenAimX(Math.max(-1.05, Math.min(1.05, Number(nx.toFixed(2)))));
                      setPenAimY(Math.max(0.08, Math.min(1.05, Number(ny.toFixed(2)))));
                    }}
                    className="relative h-24 w-full rounded-lg bg-slate-950/90 border-t-4 border-x-4 border-white cursor-crosshair overflow-hidden"
                  >
                    {/* Net grid inside interactive goal */}
                    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px]" />
                    {/* Reticle Target */}
                    <div
                      style={{
                        left: `${((penAimX + 1.05) / 2.1) * 100}%`,
                        top: `${(1 - penAimY / 1.08) * 100}%`,
                      }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 border-amber-400 bg-amber-400/25 flex items-center justify-center shadow-lg"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    </div>
                  </div>
                </div>

                {/* Power & Effect Meters */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="flex justify-between text-[11px] mb-0.5">
                      <span className="text-slate-300">Medidor de Potencia</span>
                      <span className={penPower > 0.91 ? 'text-rose-400 font-bold' : 'text-amber-400 font-mono-tabular'}>
                        {Math.round(penPower * 100)}% {penPower > 0.91 ? '(Riesgo Alto)' : ''}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.35}
                      max={1.0}
                      step={0.02}
                      value={penPower}
                      onChange={(e) => setPenPower(parseFloat(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-0.5">
                      <span className="text-slate-300">Efecto (Curva)</span>
                      <span className="text-sky-400 font-mono-tabular">{Math.round(penCurve * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={-1.0}
                      max={1.0}
                      step={0.05}
                      value={penCurve}
                      onChange={(e) => setPenCurve(parseFloat(e.target.value))}
                      className="w-full accent-sky-400"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic([24, 16, 34]);
                      engineRef.current?.executePenaltyKick(penAimX, penAimY, penPower, penCurve);
                    }}
                    className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 py-2.5 px-4 text-xs font-bold text-white shadow-lg cursor-pointer min-h-[42px]"
                  >
                    ¡Patear Penal!
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic([16, 12, 22]);
                      engineRef.current?.executePenaltyKick(0.02, 0.52, 0.52, 0);
                    }}
                    className="rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 py-2.5 px-3 text-xs font-semibold text-amber-300 cursor-pointer min-h-[42px]"
                  >
                    Picarla (Panenka)
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center text-xs text-slate-400 py-2">
                {hud.penalty.turn === 'away' ? `Turno de ${awayTeam.name}...` : 'Ejecutando lanzamiento...'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Horizontal Edge Touch Controls (Single Player OR Split 2-Player On-Screen Controls for J1 Local + J2 Visitante) */}
      {showTouchOverlay &&
        userSide !== 'none' &&
        hud.phase !== 'penalty_shootout' &&
        !isPaused &&
        hud.phase !== 'fulltime' && (
          <>
            <TouchControls
              settings={settings.controls}
              hasBall={hud.userHasBall}
              shootCharging={hud.shootCharging}
              shootChargePct={hud.shootPower}
              activeChargeAction={hud.chargeAction}
              rotated90={isRotated90}
              playerLayout={twoPlayerMode ? 'p1' : 'single'}
              playerBadge={twoPlayerMode ? `J1 · ${homeTeam.shortName}` : undefined}
              callbacks={{
                onMove: (x, y, sprint) => {
                  if (sprint && !touchStickRef.current.sprint) {
                    triggerHaptic(8);
                  }
                  touchStickRef.current = { x, y, sprint };
                },
                onPass: (pwr = 0.72) => {
                  triggerHaptic(14);
                  if (engineRef.current) {
                    engineRef.current.userInput.passPower = pwr;
                    engineRef.current.userInput.passPressed = true;
                  }
                },
                onThrough: (pwr = 0.75) => {
                  triggerHaptic(18);
                  if (engineRef.current) {
                    engineRef.current.userInput.throughPower = pwr;
                    engineRef.current.userInput.throughPressed = true;
                  }
                },
                onShootStart: () => startChargeAction('shoot'),
                onShootRelease: () => releaseChargeAction('shoot'),
                onCross: (pwr = 0.78) => {
                  triggerHaptic([14, 10, 20]);
                  if (engineRef.current) {
                    engineRef.current.userInput.crossPower = pwr;
                    engineRef.current.userInput.crossPressed = true;
                  }
                },
                onChargeStart: (action) => startChargeAction(action),
                onChargeRelease: (action) => releaseChargeAction(action),
                onSprintChange: (active) => {
                  if (active && !touchSprintBtnRef.current) {
                    triggerHaptic(10);
                  }
                  touchSprintBtnRef.current = active;
                },
                onTackle: () => {
                  triggerHaptic(22);
                  if (engineRef.current) engineRef.current.userInput.tacklePressed = true;
                },
                onSlide: () => {
                  triggerHaptic([26, 16, 34]);
                  if (engineRef.current) engineRef.current.userInput.slidePressed = true;
                },
                onSwitch: () => {
                  triggerHaptic(10);
                  if (engineRef.current) engineRef.current.userInput.switchPressed = true;
                },
                onPressChange: (active) => {
                  if (active) {
                    triggerHaptic(12);
                  }
                  if (engineRef.current) engineRef.current.userInput.pressHeld = active;
                },
                onSkillMove: () => {
                  triggerHaptic([14, 10, 18]);
                  if (engineRef.current) engineRef.current.userInput.skillMovePressed = true;
                },
              }}
            />

            {twoPlayerMode && (
              <TouchControls
                settings={settings.controls}
                hasBall={hud.user2HasBall}
                shootCharging={hud.shootCharging2}
                shootChargePct={hud.shootPower2}
                activeChargeAction={hud.chargeAction2}
                rotated90={isRotated90}
                playerLayout="p2"
                playerBadge={`J2 · ${awayTeam.shortName}`}
                callbacks={{
                  onMove: (x, y, sprint) => {
                    if (sprint && !touchStick2Ref.current.sprint) {
                      triggerHaptic(8);
                    }
                    touchStick2Ref.current = { x, y, sprint };
                  },
                  onPass: (pwr = 0.72) => {
                    triggerHaptic(14);
                    if (engineRef.current) {
                      engineRef.current.userInput2.passPower = pwr;
                      engineRef.current.userInput2.passPressed = true;
                    }
                  },
                  onThrough: (pwr = 0.75) => {
                    triggerHaptic(18);
                    if (engineRef.current) {
                      engineRef.current.userInput2.throughPower = pwr;
                      engineRef.current.userInput2.throughPressed = true;
                    }
                  },
                  onShootStart: () => startChargeAction2('shoot'),
                  onShootRelease: () => releaseChargeAction2('shoot'),
                  onCross: (pwr = 0.78) => {
                    triggerHaptic([14, 10, 20]);
                    if (engineRef.current) {
                      engineRef.current.userInput2.crossPower = pwr;
                      engineRef.current.userInput2.crossPressed = true;
                    }
                  },
                  onChargeStart: (action) => startChargeAction2(action),
                  onChargeRelease: (action) => releaseChargeAction2(action),
                  onSprintChange: (active) => {
                    if (active && !touchSprintBtn2Ref.current) {
                      triggerHaptic(10);
                    }
                    touchSprintBtn2Ref.current = active;
                  },
                  onTackle: () => {
                    triggerHaptic(22);
                    if (engineRef.current) engineRef.current.userInput2.tacklePressed = true;
                  },
                  onSlide: () => {
                    triggerHaptic([26, 16, 34]);
                    if (engineRef.current) engineRef.current.userInput2.slidePressed = true;
                  },
                  onSwitch: () => {
                    triggerHaptic(10);
                    if (engineRef.current) engineRef.current.userInput2.switchPressed = true;
                  },
                  onPressChange: (active) => {
                    if (active) {
                      triggerHaptic(12);
                    }
                    if (engineRef.current) engineRef.current.userInput2.pressHeld = active;
                  },
                  onSkillMove: () => {
                    triggerHaptic([14, 10, 18]);
                    if (engineRef.current) engineRef.current.userInput2.skillMovePressed = true;
                  },
                }}
              />
            )}
          </>
        )}

      {/* Halftime / Extratime Break Modal */}
      {(hud.phase === 'halftime' || hud.phase === 'extratime_break') && !isPaused && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-xl bg-[#101923] border border-slate-700 p-6 shadow-2xl text-center">
            <div className="text-xs font-semibold text-emerald-400">
              {hud.phase === 'halftime' ? 'ENTRETIEMPO · TRANSMISIÓN 3D' : 'TIEMPO SUPLEMENTARIO'}
            </div>
            <div className="flex items-center justify-center gap-4 mt-2">
              <TeamCrest team={homeTeam} size={36} />
              <h2 className="font-display text-3xl font-extrabold text-white">
                {homeTeam.shortName} {hud.homeScore} — {hud.awayScore} {awayTeam.shortName}
              </h2>
              <TeamCrest team={awayTeam} size={36} />
            </div>
            <p className="text-sm text-slate-300 mt-2">
              {hud.phase === 'halftime'
                ? 'Ajusta tu formación, táctica o realiza cambios antes de iniciar el segundo tiempo.'
                : 'Empate tras 90 minutos. Comienza la prórroga.'}
            </p>
            <div className="mt-5 flex gap-3">
              {userSide !== 'none' && (
                <button
                  type="button"
                  onClick={() => {
                    pausedRef.current = true;
                    setIsPaused(true);
                    setPauseTab('jugadores');
                  }}
                  className="rounded-lg bg-slate-800 hover:bg-slate-700 px-4 py-3 text-xs font-bold text-amber-300 cursor-pointer min-h-[44px]"
                >
                  Hacer Cambios ({hud.subsUsed}/{settings.match.maxSubstitutions})
                </button>
              )}
              <button
                type="button"
                onClick={() => engineRef.current?.resumeFromBreak()}
                className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 py-3 text-sm font-bold text-white cursor-pointer min-h-[44px]"
              >
                Iniciar {hud.phase === 'halftime' ? '2º Tiempo' : 'Prórroga'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Multi-Tab Pause Center (Control / Cambiar Posición / Jugadores / Estadísticas) */}
      {isPaused && !showSubsModal && (
        <div
          data-testid="pause-center-modal"
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 p-3 sm:p-5"
        >
          <div className="w-full max-w-4xl rounded-2xl bg-[#101923] border border-slate-700 p-4 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto space-y-4">
            {/* Top Matchup Header with Real Club Cover Banners */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
              <TeamCoverBanner team={homeTeam} compact />
              <div className="text-center py-2">
                <div className="text-[11px] font-display font-bold uppercase tracking-widest text-emerald-400">
                  CENTRO DE PAUSA · {DIFFICULTY_LABELS[settings.match.difficulty]}
                </div>
                <div className="font-display text-4xl font-black text-white tabular-nums mt-0.5">
                  {hud.homeScore} — {hud.awayScore}
                </div>
                <div className="text-xs text-slate-400">
                  Minuto {hud.minute}&apos; · {homeTeam.stadium.name}
                </div>
              </div>
              <TeamCoverBanner team={awayTeam} compact />
            </div>

            {/* Pause Navigation Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'resumen', label: 'Control y Cámara', icon: Play },
                  { id: 'posiciones', label: 'Cambiar Posición y Táctica', icon: ArrowLeftRight },
                  { id: 'jugadores', label: `Jugadores y Cambios (${hud.subsUsed}/${settings.match.maxSubstitutions})`, icon: Users },
                  { id: 'estadisticas', label: 'Estadísticas en Vivo', icon: BarChart3 },
                ].map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      data-testid={`pause-tab-${t.id}`}
                      onClick={() => setPauseTab(t.id as typeof pauseTab)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold cursor-pointer ${
                        pauseTab === t.id
                          ? 'bg-emerald-600 text-white shadow'
                          : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={togglePause}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-extrabold text-white cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Reanudar Partido</span>
              </button>
            </div>

            {/* TAB 1: Control, Camera, Calidad Gráfica, 120 FPS & Rain Lightning Easter Egg */}
            {pauseTab === 'resumen' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <button
                  type="button"
                  onClick={togglePause}
                  className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3.5 text-sm font-bold text-white cursor-pointer"
                >
                  <Play className="w-4 h-4" />
                  <span>Continuar Partido</span>
                </button>

                <button
                  type="button"
                  onClick={cycleCamera}
                  className="flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 py-3.5 text-sm font-semibold text-sky-300 cursor-pointer"
                >
                  <Video className="w-4 h-4" />
                  <span>Cámara 3D: {CAMERA_LABELS[activeCameraMode]}</span>
                </button>

                {/* Live FPS Selector (30 / 60 / 120 FPS) */}
                <div className="rounded-xl bg-slate-900 border border-slate-800 p-3 flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Tasa de Cuadros (Fluidez)</span>
                  <div className="flex gap-1.5">
                    {([30, 60, 120] as const).map((fps) => (
                      <button
                        key={fps}
                        type="button"
                        onClick={() => setLiveFpsLimit(fps)}
                        className={`px-2.5 py-1 rounded-lg font-mono-tabular font-bold border cursor-pointer ${
                          liveFpsLimit === fps
                            ? 'bg-emerald-600 border-emerald-400 text-white'
                            : 'bg-slate-950 border-slate-700 text-slate-300'
                        }`}
                      >
                        {fps} FPS
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Graphic Quality Selector (Bajo / Medio / Alto) */}
                <div
                  data-testid="pause-graphic-quality"
                  className="rounded-xl bg-slate-900 border border-slate-800 p-3 flex items-center justify-between"
                >
                  <span className="font-semibold text-slate-200">Calidad Gráfica (Móvil/PC)</span>
                  <div className="flex gap-1.5">
                    {(
                      [
                        { id: 'baja', label: 'Bajo' },
                        { id: 'media', label: 'Medio' },
                        { id: 'alta', label: 'Alto' },
                      ] as const
                    ).map((q) => (
                      <button
                        key={q.id}
                        type="button"
                        data-testid={`btn-pause-quality-${q.id}`}
                        onClick={() => setLiveQuality(q.id)}
                        className={`px-2.5 py-1 rounded-lg font-bold border cursor-pointer ${
                          liveQuality === q.id
                            ? 'bg-fuchsia-600 border-fuchsia-300 text-white'
                            : 'bg-slate-950 border-slate-700 text-slate-300'
                        }`}
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Modo Tormenta (99% Rayo) & Instant Lightning Strike Trigger */}
                <button
                  type="button"
                  data-testid="btn-trigger-lightning-easter-egg"
                  onClick={() => {
                    if (engineRef.current) {
                      engineRef.current.settings.match.weather = 'tormenta';
                      engineRef.current.triggerLightningEasterEgg(true);
                    }
                    togglePause();
                  }}
                  className="flex items-center justify-center gap-2 rounded-xl bg-sky-950/80 hover:bg-sky-900 border border-sky-400/50 py-3 text-xs font-bold text-sky-200 cursor-pointer"
                >
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span>⚡ Modo Tormenta: Caída de Rayo (99%)</span>
                </button>

                {/* Audio & Relator Mute Switch inside Pause Menu */}
                <button
                  type="button"
                  onClick={() => setSoundMuted((v) => !v)}
                  className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-xs font-bold cursor-pointer ${
                    !soundMuted
                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                  }`}
                >
                  {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  <span>{soundMuted ? 'Audio Silenciado (Activar)' : 'Sonido y Relator: Activos'}</span>
                </button>

                {/* Sala VAR Interactiva: Revisión en vivo de los 5 escenarios oficiales */}
                <div className="sm:col-span-2 rounded-xl bg-slate-900/95 border border-sky-500/40 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-xs font-black uppercase tracking-wider text-sky-300">
                      📺 Sala VAR Oficial (Intervención Automática + Prueba en Vivo de los 5 Escenarios)
                    </span>
                    <span className="text-[10px] text-slate-400">Multicámara 3D</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                    {(
                      [
                        { id: 'offside_goal', label: 'Gol Fuera de Juego' },
                        { id: 'penalty_check', label: 'Posible Penal' },
                        { id: 'foul_buildup_goal', label: 'Gol Falta Previa' },
                        { id: 'direct_red_check', label: 'Roja Directa' },
                        { id: 'mistaken_identity', label: 'Identidad Infractor' },
                      ] as { id: VARScenarioType; label: string }[]
                    ).map((sc) => (
                      <button
                        key={sc.id}
                        type="button"
                        data-testid={`btn-var-${sc.id}`}
                        onClick={() => {
                          engineRef.current?.triggerVARReviewDemo(sc.id);
                          togglePause();
                        }}
                        className="rounded-lg bg-sky-950/80 hover:bg-sky-800 border border-sky-400/40 px-2 py-2 text-[11px] font-bold text-sky-100 cursor-pointer"
                      >
                        {sc.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    togglePause();
                    engineRef.current?.triggerInstantReplay();
                  }}
                  className="flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 py-3 text-xs font-semibold text-rose-300 cursor-pointer"
                >
                  <Rewind className="w-4 h-4" />
                  <span>Ver Repetición TV 3D</span>
                </button>

                <button
                  type="button"
                  onClick={initEngine}
                  className="flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 py-3 text-xs font-semibold text-slate-100 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reiniciar Partido</span>
                </button>

                <button
                  type="button"
                  onClick={onExitMatch}
                  className="sm:col-span-2 flex items-center justify-center gap-2 rounded-xl border border-rose-500/40 bg-rose-950/30 hover:bg-rose-900/40 py-3 text-xs font-bold text-rose-200 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Salir al Menú Principal</span>
                </button>
              </div>
            )}

            {/* TAB 2: Cambiar Posición y Táctica */}
            {pauseTab === 'posiciones' && (
              <div className="space-y-4 text-xs">
                <TacticalFormationBoard
                  selectedFormationId={hud.userFormation}
                  onSelectFormation={(fId) => {
                    engineRef.current?.setUserFormation(fId);
                    setHud((prev) => ({ ...prev, userFormation: fId }));
                    setRosterTick((v) => v + 1);
                  }}
                  team={userTeamObj}
                  compact
                  title={`Pizarra Táctica en Vivo · ${userTeamObj.name} (${getFormation(hud.userFormation).nombre})`}
                />

                <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3">
                  <div className="font-bold text-white mb-2">Estilo Táctico del Equipo</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {(Object.keys(TACTICAL_LABELS) as TacticalStyle[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          engineRef.current?.setUserTactic(t);
                          setHud((prev) => ({ ...prev, userTactic: t }));
                          setRosterTick((v) => v + 1);
                        }}
                        className={`px-2.5 py-2 rounded-lg font-semibold border text-left cursor-pointer ${
                          hud.userTactic === t
                            ? 'bg-emerald-600 border-emerald-400 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {TACTICAL_LABELS[t]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-bold text-white">Intercambiar Posición de Jugadores en Cancha</span>
                      <p className="text-[11px] text-slate-400">
                        Selecciona dos titulares para intercambiar su posición táctica en tiempo real.
                      </p>
                    </div>
                    {swapSlotA && (
                      <span className="rounded bg-amber-500/20 border border-amber-400/50 px-2.5 py-1 text-[11px] font-bold text-amber-300">
                        Elige el 2º jugador para cambiar posición
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {userFieldPlayers.map((fp) => {
                      const isSelected = swapSlotA === fp.id;
                      return (
                        <button
                          key={fp.id}
                          type="button"
                          onClick={() => {
                            if (!swapSlotA) {
                              setSwapSlotA(fp.id);
                            } else if (swapSlotA === fp.id) {
                              setSwapSlotA(null);
                            } else {
                              engineRef.current?.swapPlayerPositions(userTeamSide, swapSlotA, fp.id);
                              setSwapSlotA(null);
                              setRosterTick((v) => v + 1);
                            }
                          }}
                          className={`flex items-center justify-between rounded-lg px-3 py-2 border text-left cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500/30 border-amber-400 text-white ring-2 ring-amber-400/50'
                              : 'bg-slate-950 border-slate-800 text-slate-200 hover:border-emerald-500/60'
                          }`}
                        >
                          <div className="truncate">
                            <span className="font-mono-tabular font-bold text-emerald-400 mr-1.5">
                              #{fp.player.number}
                            </span>
                            <span className="font-semibold">{fp.player.name}</span>
                          </div>
                          <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono-tabular font-bold text-sky-300">
                            {fp.player.position} · Slot {fp.slotIndex + 1}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Jugadores y Cambios (Titulares + Banco de Suplentes) */}
            {pauseTab === 'jugadores' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="font-bold text-slate-300 mb-2">
                    11 Titulares en Cancha (haz clic para sustituir)
                  </div>
                  <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                    {userFieldPlayers.map((fp) => (
                      <button
                        key={fp.id}
                        type="button"
                        onClick={() => setSubOutId(fp.id)}
                        className={`w-full flex items-center justify-between rounded-lg px-3 py-2 border cursor-pointer ${
                          subOutId === fp.id
                            ? 'bg-emerald-700/40 border-emerald-400 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <strong className="text-emerald-400 font-mono-tabular">#{fp.player.number}</strong>
                          <span className="truncate">{fp.player.name}</span>
                          <span className="text-slate-400">({fp.player.position})</span>
                          {fp.yellowCards > 0 && (
                            <span className="inline-block w-2 h-3 rounded-xs bg-amber-400" title="Amonestado" />
                          )}
                        </span>
                        <span className="font-mono-tabular font-bold text-emerald-400">
                          OVR {fp.player.overall} · {Math.round(fp.stamina)}%
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="font-bold text-slate-300 mb-2">
                    Suplentes Disponibles ({hud.subsUsed}/{settings.match.maxSubstitutions} cambios)
                  </div>
                  <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                    {userTeamObj.players.slice(11).map((sub, i) => {
                      const subIndex = 11 + i;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          disabled={!subOutId || hud.subsUsed >= settings.match.maxSubstitutions}
                          onClick={() => {
                            if (!subOutId || !engineRef.current) return;
                            engineRef.current.makeSubstitution(userTeamSide, subOutId, subIndex);
                            setSubOutId(null);
                            setRosterTick((v) => v + 1);
                          }}
                          className="w-full flex items-center justify-between rounded-lg px-3 py-2 bg-slate-900 border border-slate-800 text-slate-200 hover:bg-emerald-700/30 disabled:opacity-40 cursor-pointer"
                        >
                          <span>
                            <strong className="text-amber-300 font-mono-tabular">#{sub.number}</strong> {sub.name} (
                            {sub.position})
                          </span>
                          <span className="font-mono-tabular font-bold text-emerald-400">
                            OVR {sub.overall} · 100%
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: Estadísticas del Partido en Vivo */}
            {pauseTab === 'estadisticas' && (
              <div
                data-testid="pause-live-stats"
                className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 space-y-2.5 text-xs"
              >
                {[
                  {
                    label: 'Posesión del Balón',
                    h: `${Math.round(
                      (hud.homeStats.possessionTime /
                        Math.max(1, hud.homeStats.possessionTime + hud.awayStats.possessionTime)) *
                        100
                    )}%`,
                    a: `${Math.round(
                      (hud.awayStats.possessionTime /
                        Math.max(1, hud.homeStats.possessionTime + hud.awayStats.possessionTime)) *
                        100
                    )}%`,
                  },
                  {
                    label: 'Tiros Totales (Al Arco)',
                    h: `${hud.homeStats.shots} (${hud.homeStats.shotsOnTarget})`,
                    a: `${hud.awayStats.shots} (${hud.awayStats.shotsOnTarget})`,
                  },
                  {
                    label: 'Pases Completados / Intentados',
                    h: `${hud.homeStats.passesCompleted}/${hud.homeStats.passesAttempted}`,
                    a: `${hud.awayStats.passesCompleted}/${hud.awayStats.passesAttempted}`,
                  },
                  {
                    label: 'Atajadas del Arquero',
                    h: `${hud.homeStats.saves}`,
                    a: `${hud.awayStats.saves}`,
                  },
                  {
                    label: 'Quites / Faltas Sancionadas',
                    h: `${hud.homeStats.tackles} / ${hud.homeStats.fouls}`,
                    a: `${hud.awayStats.tackles} / ${hud.awayStats.fouls}`,
                  },
                  {
                    label: 'Tarjetas Amarillas / Rojas',
                    h: `${hud.homeStats.yellowCards} / ${hud.homeStats.redCards}`,
                    a: `${hud.awayStats.yellowCards} / ${hud.awayStats.redCards}`,
                  },
                  {
                    label: 'Tiros de Esquina / Posiciones Adelantadas',
                    h: `${hud.homeStats.corners} / ${hud.homeStats.offsides}`,
                    a: `${hud.awayStats.corners} / ${hud.awayStats.offsides}`,
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="grid grid-cols-3 items-center py-1.5 border-b border-slate-800/80 last:border-0"
                  >
                    <span className="font-mono-tabular font-extrabold text-emerald-400 text-left text-sm">
                      {row.h}
                    </span>
                    <span className="text-slate-300 font-semibold text-center">{row.label}</span>
                    <span className="font-mono-tabular font-extrabold text-sky-400 text-right text-sm">
                      {row.a}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Substitutions, Injuries & Tactical Formation Modal */}
      {showSubsModal && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-[#101923] border border-slate-700 p-5 shadow-2xl max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-white">
                  Sustituciones y Pizarra Táctica · {userTeamObj.name}
                </h2>
                <p className="text-xs text-slate-400">
                  Cambios realizados: {hud.subsUsed} de {settings.match.maxSubstitutions} · Formación actual:{' '}
                  <strong className="text-emerald-400">{hud.userFormation}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSubsModal(false);
                  pausedRef.current = false;
                }}
                className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-white cursor-pointer"
              >
                Volver al partido
              </button>
            </div>

            {/* Quick Formation Selector inside Subs Modal */}
            <div className="mb-4 rounded-lg bg-slate-900/80 border border-slate-800 p-2.5">
              <div className="text-[11px] font-semibold text-slate-400 mb-1.5">
                Cambiar Formación del Director Técnico ({FORMATIONS.length} Esquemas Disponibles)
              </div>
              <div className="max-h-28 overflow-y-auto flex flex-wrap gap-1.5 pr-1">
                {FORMATIONS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      engineRef.current?.setUserFormation(f.id);
                      setHud((prev) => ({ ...prev, userFormation: f.id }));
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-bold border cursor-pointer ${
                      hud.userFormation === f.id
                        ? 'bg-emerald-600 border-emerald-400 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {f.nombre}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-semibold text-slate-400 mb-2">Titulares en cancha (elige saliente)</div>
                <div className="space-y-1.5">
                  {userFieldPlayers.map((fp) => (
                    <button
                      key={fp.id}
                      type="button"
                      onClick={() => setSubOutId(fp.id)}
                      className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs border cursor-pointer ${
                        subOutId === fp.id
                          ? 'bg-emerald-700/40 border-emerald-400 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <span>
                          #{fp.player.number} {fp.player.name} ({fp.player.position})
                        </span>
                        {fp.injured && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            <Activity className="w-2.5 h-2.5" /> LESIÓN
                          </span>
                        )}
                        {fp.yellowCards > 0 && (
                          <span className="inline-block w-2 h-3 rounded-xs bg-amber-400" title="Amonestado" />
                        )}
                      </span>
                      <span
                        className={`font-mono-tabular font-bold ${
                          fp.stamina < 35 ? 'text-rose-400' : fp.stamina < 60 ? 'text-amber-400' : 'text-emerald-400'
                        }`}
                      >
                        {Math.round(fp.stamina)}%
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-400 mb-2">Suplentes en el banco (elige entrante)</div>
                <div className="space-y-1.5">
                  {userTeamObj.players.slice(11).map((sub, i) => {
                    const subIndex = 11 + i;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        disabled={!subOutId || hud.subsUsed >= settings.match.maxSubstitutions}
                        onClick={() => {
                          if (!subOutId || !engineRef.current) return;
                          engineRef.current.makeSubstitution(
                            userSide === 'away' ? 'away' : 'home',
                            subOutId,
                            subIndex
                          );
                          setSubOutId(null);
                          setShowSubsModal(false);
                          pausedRef.current = false;
                        }}
                        className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs bg-slate-900 border border-slate-800 text-slate-200 hover:bg-emerald-700/30 disabled:opacity-40 cursor-pointer"
                      >
                        <span>
                          #{sub.number} {sub.name} ({sub.position})
                        </span>
                        <span className="font-mono-tabular font-bold text-emerald-400">
                          OVR {sub.overall} · 100%
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full-Time Results Summary Modal */}
      {summary && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg rounded-xl bg-[#101923] border border-slate-700 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-center gap-2 text-amber-400 text-xs font-semibold mb-1">
              <Trophy className="w-4 h-4" />
              <span>FINAL DEL PARTIDO · {DIFFICULTY_LABELS[summary.difficulty]}</span>
            </div>

            {(() => {
              const userWon =
                summary.userSide !== 'none' &&
                ((summary.userSide === 'home' && summary.homeScore > summary.awayScore) ||
                  (summary.userSide === 'away' && summary.awayScore > summary.homeScore) ||
                  (summary.penaltyScore &&
                    ((summary.userSide === 'home' && summary.penaltyScore.home > summary.penaltyScore.away) ||
                      (summary.userSide === 'away' && summary.penaltyScore.away > summary.penaltyScore.home))));
              const isChamp = Boolean(isTournamentFinal && userWon);
              const earnedCoins = calculateMatchCoinReward(summary, isChamp);

              return (
                <>
                  {isChamp && (
                    <div
                      data-testid="champion-celebration-banner"
                      className="my-2 rounded-xl bg-gradient-to-r from-amber-500/25 via-yellow-400/20 to-amber-500/25 border-2 border-amber-400 p-3.5 text-center space-y-1 shadow-xl animate-pulse"
                    >
                      <div className="flex items-center justify-center gap-2 text-amber-300 font-display text-sm font-black uppercase tracking-widest">
                        <Trophy className="w-5 h-5 text-amber-400" />
                        <span>🎊 ¡CAMPEÓN DEL TORNEO! · LLUVIA DE CONFETI Y TROFEO 🎊</span>
                      </div>
                      <div className="text-xs text-white font-semibold">
                        {(summary.userSide === 'away' ? awayTeam : homeTeam).name} levanta la Copa en el centro del estadio.
                      </div>
                    </div>
                  )}

                  <div
                    data-testid="match-coins-reward"
                    className="my-2 flex items-center justify-between rounded-xl bg-amber-500/15 border border-amber-400/40 px-4 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2 text-amber-300 font-bold">
                      <Coins className="w-4 h-4 text-amber-400" />
                      <span>Recompensa de Progresión (Tienda Atlas)</span>
                    </div>
                    <span className="font-mono-tabular text-sm font-black text-white">
                      +{earnedCoins} Monedas
                    </span>
                  </div>
                </>
              );
            })()}

            <div className="flex items-center justify-between gap-4 py-4 border-b border-slate-800">
              <div className="flex-1 flex flex-col items-center text-center">
                <TeamCrest team={homeTeam} size={48} />
                <div className="font-display text-lg font-bold text-white mt-1.5">{homeTeam.name}</div>
              </div>
              <div className="text-center">
                <div className="font-display text-5xl font-extrabold text-white tabular-nums">
                  {summary.homeScore} - {summary.awayScore}
                </div>
                {summary.penaltyScore && (
                  <div className="text-xs font-mono-tabular text-emerald-400 mt-1">
                    Penales: {summary.penaltyScore.home} - {summary.penaltyScore.away}
                  </div>
                )}
              </div>
              <div className="flex-1 flex flex-col items-center text-center">
                <TeamCrest team={awayTeam} size={48} />
                <div className="font-display text-lg font-bold text-white mt-1.5">{awayTeam.name}</div>
              </div>
            </div>

            {/* Match Stats Table */}
            <div className="mt-4 space-y-2 text-xs">
              {[
                {
                  label: 'Posesión',
                  h: `${Math.round(
                    (summary.homeStats.possessionTime /
                      Math.max(1, summary.homeStats.possessionTime + summary.awayStats.possessionTime)) *
                      100
                  )}%`,
                  a: `${Math.round(
                    (summary.awayStats.possessionTime /
                      Math.max(1, summary.homeStats.possessionTime + summary.awayStats.possessionTime)) *
                      100
                  )}%`,
                },
                {
                  label: 'Remates (al arco)',
                  h: `${summary.homeStats.shots} (${summary.homeStats.shotsOnTarget})`,
                  a: `${summary.awayStats.shots} (${summary.awayStats.shotsOnTarget})`,
                },
                {
                  label: 'Pases completados',
                  h: `${summary.homeStats.passesCompleted}/${summary.homeStats.passesAttempted}`,
                  a: `${summary.awayStats.passesCompleted}/${summary.awayStats.passesAttempted}`,
                },
                {
                  label: 'Entradas / Faltas',
                  h: `${summary.homeStats.tackles} / ${summary.homeStats.fouls}`,
                  a: `${summary.awayStats.tackles} / ${summary.awayStats.fouls}`,
                },
                {
                  label: 'Atajadas / Córners',
                  h: `${summary.homeStats.saves} / ${summary.homeStats.corners}`,
                  a: `${summary.awayStats.saves} / ${summary.awayStats.corners}`,
                },
                {
                  label: 'Tarjetas (A/R)',
                  h: `${summary.homeStats.yellowCards}/${summary.homeStats.redCards}`,
                  a: `${summary.awayStats.yellowCards}/${summary.awayStats.redCards}`,
                },
              ].map((row) => (
                <div key={row.label} className="grid grid-cols-3 items-center py-1 border-b border-slate-800/60">
                  <span className="font-mono-tabular font-bold text-white text-left">{row.h}</span>
                  <span className="text-slate-400 text-center">{row.label}</span>
                  <span className="font-mono-tabular font-bold text-white text-right">{row.a}</span>
                </div>
              ))}
            </div>

            {summary.events.length > 0 && (
              <div className="mt-4 max-h-28 overflow-y-auto bg-slate-950/60 rounded-lg p-2.5 text-xs space-y-1">
                {summary.events.map((ev) => (
                  <div key={ev.id} className="flex items-center justify-between text-slate-300">
                    <span>
                      <strong className="font-mono-tabular text-emerald-400">{ev.minute}&apos;</strong>{' '}
                      {ev.type === 'goal'
                        ? '⚽ Gol'
                        : ev.type === 'yellow'
                          ? '🟨 Amarilla'
                          : ev.type === 'red'
                            ? '🟥 Roja'
                            : ev.type === 'sub'
                              ? '🔄 Cambio'
                              : ev.type}{' '}
                      · {ev.playerName}
                    </span>
                    <span className="text-slate-500">
                      {ev.teamSide === 'home' ? homeTeam.shortName : awayTeam.shortName}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={initEngine}
                className="flex-1 rounded-lg bg-slate-800 hover:bg-slate-700 py-3 text-xs font-bold text-white cursor-pointer min-h-[44px]"
              >
                Jugar Revancha
              </button>
              <button
                type="button"
                onClick={onExitMatch}
                className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 py-3 text-xs font-bold text-white cursor-pointer min-h-[44px]"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
