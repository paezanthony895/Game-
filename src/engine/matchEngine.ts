import { getFormation } from '../data/formations';
import type { CommentaryContext } from '../audio/commentaryEngine';
import type {
  DifficultyLevel,
  GameMode,
  GameSettings,
  MatchEventRecord,
  MatchResultSummary,
  MatchTeamStats,
  TacticalStyle,
  Team,
} from '../types/football';
import {
  generateFreeKickPracticeSpot,
  getGameModeConfig,
  type GameModeRuleConfig,
} from './gameModeManager';
import {
  chooseAdaptiveTactic,
  computeBallInterceptPoint,
  computeGoalkeeperAI,
  computeOffBallMovement,
  computeOutfieldCarrierDecision,
  evaluateTeamBrain,
  getDifficultyProfile,
  shouldExecuteFirstTouchShot,
  type AIPlayerNode,
  type AIPlayerState,
  type OutfieldDecision,
  type TeamBrainState,
} from './ai';
import {
  PITCH,
  PHYSICS_TUNING,
  createInitialBall,
  resolvePlayerCollisions,
  stepBallPhysics,
  stepPlayerMovement,
  type BallState,
  type MatchPlayerState,
  type PlayerAnimState,
  type StrikeType,
} from './physics';
import {
  checkBallOutcome,
  evaluateAerialDuel,
  evaluateTackleOutcome,
  isPlayerOffside,
  type RestartType,
} from './rules';

export type MatchPhase =
  | 'kickoff_ready'
  | 'live'
  | 'set_piece'
  | 'goal_celebration'
  | 'goal_replay'
  | 'halftime'
  | 'extratime_break'
  | 'penalty_shootout'
  | 'fulltime';

export type SoundTrigger =
  | 'whistle_start'
  | 'whistle_short'
  | 'whistle_fulltime'
  | 'kick_light'
  | 'kick_hard'
  | 'header_thud'
  | 'footstep_grass'
  | 'body_clash'
  | 'net_swish'
  | 'post'
  | 'goal_roar'
  | 'save_clap'
  | 'foul_card'
  | 'foul_boo'
  | 'near_miss_gasp'
  | 'thunder';

export type CoachMood = 'idle' | 'instruct' | 'protest' | 'despair' | 'celebrate';
export type CrowdMood = 'calm' | 'dangerous_play' | 'goal_roar' | 'foul_boos' | 'save_applause';
export type ReplayCameraAngle = 'broadcast_slow' | 'low_sideline_slow' | 'behind_goal_zoom';

/**
 * 18 segundos a 60 FPS = 1080 frames en buffer circular (entre 15 y 20 segundos)
 */
export const MAX_REPLAY_FRAMES = 1080;

export interface PitchParticleEvent {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  kind: 'turf' | 'dust' | 'spark';
  life: number;
}

export interface RefereeState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  signalTimer: number;
  signalType: 'none' | 'advantage' | 'foul' | 'yellow' | 'red';
}

export interface AdvantageState {
  side: 'home' | 'away';
  timer: number;
  foulX: number;
  foulY: number;
  offenderName: string;
}

export interface FreeKickControlState {
  awaitingUserInput: boolean;
  isInMatchPenalty: boolean;
  aimOffset: number; // -1..1 (left to right relative to goal)
  aimHeight: number; // 0..1 (low to high)
  power: number;     // 0.35..1
  curve: number;     // -1..1 lateral Magnus spin
  strikeType: StrikeType;
  wallPlayerIds: string[];
}

export type SkillMoveType = 'bicicleta' | 'amague' | 'sombrerito';

export type MatchCutsceneType =
  | 'yellow_card'
  | 'red_card'
  | 'corner'
  | 'throw_in'
  | 'goal'
  | 'champion';

export interface MatchCutsceneState {
  active: boolean;
  type: MatchCutsceneType;
  timer: number;
  duration: number;
  title: string;
  subtitle: string;
  teamSide: 'home' | 'away';
  teamName: string;
  playerId?: string;
  playerName?: string;
  playerNumber?: number;
  focusX: number;
  focusY: number;
  skippable: boolean;
}

export interface UserInputState {
  moveX: number;
  moveY: number;
  sprint: boolean;
  passPressed: boolean;
  passPower?: number; // 0..1
  throughPressed: boolean;
  throughPower?: number; // 0..1
  shootHeld: boolean;
  shootReleased: boolean;
  shootPower: number; // 0..1
  crossPressed: boolean;
  crossPower?: number; // 0..1
  tacklePressed: boolean;
  slidePressed: boolean;
  switchPressed: boolean;
  pressHeld: boolean;
  skillMovePressed?: boolean;
  curveInput?: number; // -1..1 Magnus effect directional input
}

export interface RefereeCardCutsceneState {
  active: boolean;
  timer: number;
  card: 'yellow' | 'red';
  playerId: string;
  playerName: string;
  playerNumber: number;
  teamSide: 'home' | 'away';
  teamName: string;
  foulLabel: string;
  x: number;
  y: number;
}

export interface OffsideCutsceneState {
  active: boolean;
  timer: number;
  lineX: number;
  playerId: string;
  playerName: string;
  playerNumber: number;
  teamSide: 'home' | 'away';
  teamName: string;
  x: number;
  y: number;
}

export type VARScenarioType =
  | 'offside_goal'
  | 'penalty_check'
  | 'foul_buildup_goal'
  | 'direct_red_check'
  | 'mistaken_identity';

export interface VARReviewState {
  active: boolean;
  scenario: VARScenarioType;
  title: string;
  subtitle: string;
  phase: 'checking' | 'decision';
  timer: number;
  totalDuration: number;
  cameraAngleIndex: 1 | 2 | 3;
  decisionText: string;
  decisionConfirmed: boolean; // true = VAR intervenes/confirms infraction or overturns, false = original call stands
  involvedPlayerName: string;
  involvedPlayerNumber: number;
  teamSide: 'home' | 'away';
  teamName: string;
  lineX: number;
  defenderLineX: number;
  focusX: number;
  focusY: number;
  onResolve?: () => void;
}

export interface LightningEasterEggState {
  active: boolean;
  timer: number;
  targetPlayerId: string;
  targetPlayerName: string;
  teamSide: 'home' | 'away';
  x: number;
  y: number;
}

export interface ReplayPlayerSnapshot {
  id: string;
  side: 'home' | 'away';
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  lookTargetAngle?: number;
  animState?: PlayerAnimState;
  stridePhase?: number;
  leanForward?: number;
  leanBank?: number;
  kickAnimTimer?: number;
  slideTimer?: number;
  diveTimer?: number;
  diveDirY?: number;
  fallTimer?: number;
  footIkLeftY?: number;
  footIkRightY?: number;
  number: number;
}

export interface ReplayFrame {
  ballX: number;
  ballY: number;
  ballZ: number;
  ballVx?: number;
  ballVy?: number;
  ballVz?: number;
  ballSpin?: number;
  soundEvent?: SoundTrigger;
  players: ReplayPlayerSnapshot[];
}

export interface PenaltyShootoutState {
  round: number;
  turn: 'home' | 'away';
  homeTaken: number;
  awayTaken: number;
  homeScored: number;
  awayScored: number;
  historyHome: ('goal' | 'miss')[];
  historyAway: ('goal' | 'miss')[];
  aimX: number; // -1..1 left to right inside goal
  aimY: number; // 0..1 low to high
  power: number; // 0.3..1
  awaitingUserInput: boolean;
  kickAnimTimer: number;
  lastOutcomeText: string;
}

export interface MatchEngineConfig {
  mode: GameMode;
  homeTeam: Team;
  awayTeam: Team;
  userSide: 'home' | 'away' | 'none';
  settings: GameSettings;
  startMinute?: number;
  initialHomeGoals?: number;
  initialAwayGoals?: number;
  trainingDrill?: 'free_play' | 'shooting' | 'passing' | 'dribbling' | 'free_kicks';
  twoPlayerMode?: boolean;
  onSound?: (trigger: SoundTrigger) => void;
  onCommentary?: (ctx: CommentaryContext) => void;
}

function emptyStats(): MatchTeamStats {
  return {
    goals: 0,
    shots: 0,
    shotsOnTarget: 0,
    possessionTime: 0,
    passesAttempted: 0,
    passesCompleted: 0,
    tackles: 0,
    fouls: 0,
    corners: 0,
    offsides: 0,
    saves: 0,
    yellowCards: 0,
    redCards: 0,
  };
}

function mapRoleCategory(pos: string): 'GK' | 'DEF' | 'MID' | 'FWD' {
  if (pos === 'GK') return 'GK';
  if (pos === 'CB' || pos === 'LB' || pos === 'RB') return 'DEF';
  if (pos === 'CDM' || pos === 'CM' || pos === 'CAM') return 'MID';
  return 'FWD';
}

function mapTacticCategory(tactic: TacticalStyle): 'attacking' | 'balanced' | 'defensive' {
  if (tactic === 'PRESION_ALTA' || tactic === 'DEFENSA_ADELANTADA' || tactic === 'JUEGO_BANDAS') {
    return 'attacking';
  }
  if (tactic === 'BLOQUE_BAJO' || tactic === 'CONTRAATAQUE') {
    return 'defensive';
  }
  return 'balanced';
}

export class MatchEngine {
  public mode: GameMode;
  public homeTeam: Team;
  public awayTeam: Team;
  public userSide: 'home' | 'away' | 'none';
  public twoPlayerMode = false;
  public settings: GameSettings;
  public difficulty: DifficultyLevel;
  public trainingDrill: NonNullable<MatchEngineConfig['trainingDrill']>;

  public phase: MatchPhase = 'kickoff_ready';
  public half: 1 | 2 | 3 | 4 = 1;
  public matchMinute = 0;
  public addedTimeMinutes = 0;
  public phaseTimer = 0.8;
  public hitstopTimer = 0;
  public slowMoTimer = 0;
  public slowMoFactor = 0.28;
  public cameraShake = 0;

  public ball: BallState = createInitialBall();
  public players: (MatchPlayerState & { aiState?: AIPlayerState })[] = [];
  public homeSubsUsed = 0;
  public awaySubsUsed = 0;
  public homeTactic: TacticalStyle;
  public awayTactic: TacticalStyle;
  public homeFormationId: string;
  public awayFormationId: string;

  public homeCoachMood: CoachMood = 'idle';
  public awayCoachMood: CoachMood = 'idle';
  public coachMoodTimer = 0;
  public crowdMood: CrowdMood = 'calm';
  public crowdMoodTimer = 0;

  public referee: RefereeState = {
    x: PITCH.HALF_X,
    y: PITCH.HALF_Y - 8,
    vx: 0,
    vy: 0,
    facing: 0,
    signalTimer: 0,
    signalType: 'none',
  };
  public advantageState: AdvantageState | null = null;
  public freeKickState: FreeKickControlState | null = null;
  public particleEvents: PitchParticleEvent[] = [];

  public activeUserPlayerId: string | null = null;
  public activeUser2PlayerId: string | null = null;
  public homeScore = 0;
  public awayScore = 0;
  public homeStats: MatchTeamStats = emptyStats();
  public awayStats: MatchTeamStats = emptyStats();
  public events: MatchEventRecord[] = [];
  public bannerText: string | null = null;
  public bannerTimer = 0;

  public restartType: RestartType = 'kickoff';
  public restartTeam: 'home' | 'away' = 'home';
  public restartX: number = PITCH.HALF_X;
  public restartY: number = PITCH.HALF_Y;

  // TV Replay System (Circular buffer of 1080 frames = 18s at 60 FPS + 3 slow-motion camera angles)
  public replayBuffer: ReplayFrame[] = [];
  public replayPlaybackFrames: ReplayFrame[] = [];
  public replayPlaybackIndex = 0;
  public replayFloatIndex = 0;
  public replayCameraAngle: ReplayCameraAngle = 'broadcast_slow';
  public manualReplayCameraOverride: ReplayCameraAngle | null = null;
  public replayFreeCamAngle = 0;
  public replaySpeedFactor = 0.45;
  public replayScorerId: string | null = null;
  public replayPlayTitle = 'REPETICIÓN OFICIAL';
  public replayReturnToKickoff = false;
  private frameSoundEvent: SoundTrigger | undefined = undefined;

  public homeBrainState: TeamBrainState | null = null;
  public awayBrainState: TeamBrainState | null = null;

  public penaltyState: PenaltyShootoutState | null = null;
  public cardCutscene: RefereeCardCutsceneState | null = null;
  public offsideCutscene: OffsideCutsceneState | null = null;
  public cutsceneState: MatchCutsceneState | null = null;
  public lastSkillMove: { playerId: string; playerName: string; type: SkillMoveType; label: string; timer: number } | null = null;
  public varReviewState: VARReviewState | null = null;
  public targetedPassMateId: string | null = null;
  public targetedPassMateId2: string | null = null;
  public autoSwitchCooldown = 0;
  public autoSwitchCooldown2 = 0;
  private aerialDuelCooldown = 0;
  private lastAttackingContactSide: 'home' | 'away' | null = null;
  private lastAttackingContactMinute = -10;
  private lastAttackingContactPlayerName = '';
  public lightningState: LightningEasterEggState | null = null;
  private lightningRolledThisMatch = false;
  private lightningWillStrikeThisMatch = false;
  private lightningTargetMinute = 26;

  public userInput: UserInputState = {
    moveX: 0,
    moveY: 0,
    sprint: false,
    passPressed: false,
    passPower: 0.65,
    throughPressed: false,
    throughPower: 0.72,
    shootHeld: false,
    shootReleased: false,
    shootPower: 0.65,
    crossPressed: false,
    crossPower: 0.75,
    tacklePressed: false,
    slidePressed: false,
    switchPressed: false,
    pressHeld: false,
    skillMovePressed: false,
    curveInput: 0,
  };

  public userInput2: UserInputState = {
    moveX: 0,
    moveY: 0,
    sprint: false,
    passPressed: false,
    passPower: 0.65,
    throughPressed: false,
    throughPower: 0.72,
    shootHeld: false,
    shootReleased: false,
    shootPower: 0.65,
    crossPressed: false,
    crossPower: 0.75,
    tacklePressed: false,
    slidePressed: false,
    switchPressed: false,
    pressHeld: false,
    skillMovePressed: false,
    curveInput: 0,
  };

  private rngState = 1337;
  private aiTimer = 0;
  private cachedCarrierDecisions = new Map<string, OutfieldDecision>();
  private cachedOffBallDecisions = new Map<
    string,
    { targetX: number; targetY: number; sprint: boolean; desiredState: AIPlayerState }
  >();
  private offBallCacheTick = 0;
  private replaySampleTick = 0;
  private onSound?: (trigger: SoundTrigger) => void;
  private onCommentary?: (ctx: CommentaryContext) => void;
  private pendingPassCheck: {
    passerId: string;
    side: 'home' | 'away';
    ballX: number;
    offsideTargets: Set<string>;
  } | null = null;
  private addedTimeAnnouncedHalf = 0;
  private lastDribbleTapTime = 0;
  public modeConfig: GameModeRuleConfig;
  private freeKickPracticeIndex = 0;
  private freeKickShotTimer = 0;
  private goldenGoalTriggered = false;

  constructor(config: MatchEngineConfig) {
    this.mode = config.mode;
    this.modeConfig = getGameModeConfig(config.mode);
    this.homeTeam = config.homeTeam;
    this.awayTeam = config.awayTeam;
    this.userSide = config.userSide;
    this.twoPlayerMode = Boolean(config.twoPlayerMode);
    this.settings = config.settings;
    this.difficulty = config.settings.match.difficulty;
    this.homeTactic = config.homeTeam.tacticalStyle;
    this.awayTactic = config.awayTeam.tacticalStyle;
    this.homeFormationId = config.homeTeam.formationId;
    this.awayFormationId = config.awayTeam.formationId;
    this.trainingDrill = config.trainingDrill ?? 'free_play';
    this.onSound = (trig: SoundTrigger) => {
      this.frameSoundEvent = trig;
      config.onSound?.(trig);
    };
    this.onCommentary = config.onCommentary;

    this.matchMinute = config.startMinute ?? 0;
    if (this.matchMinute >= 45) this.half = 2;
    this.homeScore = config.initialHomeGoals ?? 0;
    this.awayScore = config.initialAwayGoals ?? 0;
    this.homeStats.goals = this.homeScore;
    this.awayStats.goals = this.awayScore;

    this.spawnPlayers();

    if (this.mode === 'penalties' || this.modeConfig.clockMode === 'shootout_only') {
      this.startPenaltyShootout();
    } else if (this.mode === 'training') {
      this.setupTrainingScenario();
    } else {
      this.setupKickoff('home');
      this.onCommentary?.({
        type: 'match_intro',
        teamName: this.homeTeam.name,
        opponentName: this.awayTeam.name,
        stadiumName: this.homeTeam.stadium.name,
      });
    }
  }

  private rng = (): number => {
    this.rngState = (this.rngState * 1664525 + 1013904223) >>> 0;
    return this.rngState / 4294967296;
  };

  public emitParticles(x: number, y: number, z: number, count: number, kind: 'turf' | 'dust' | 'spark'): void {
    for (let i = 0; i < count; i++) {
      const ang = this.rng() * Math.PI * 2;
      const spd = 0.8 + this.rng() * 2.6;
      this.particleEvents.push({
        x,
        y,
        z,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        vz: 1.2 + this.rng() * 2.8,
        kind,
        life: 0.45 + this.rng() * 0.35,
      });
    }
    if (this.particleEvents.length > 90) {
      this.particleEvents.splice(0, this.particleEvents.length - 90);
    }
  }

  private setCoachMoods(home: CoachMood, away: CoachMood, duration = 3.2): void {
    this.homeCoachMood = home;
    this.awayCoachMood = away;
    this.coachMoodTimer = duration;
  }

  private setCrowdMood(mood: CrowdMood, duration = 3.5): void {
    this.crowdMood = mood;
    this.crowdMoodTimer = duration;
  }

  private spawnPlayers(): void {
    this.players = [];
    const buildSide = (team: Team, side: 'home' | 'away') => {
      const formation = getFormation(side === 'home' ? this.homeFormationId : this.awayFormationId);
      const count = 11;
      for (let i = 0; i < count; i++) {
        const player = team.players[i] ?? team.players[0];
        const slot = formation.slots[i] ?? formation.slots[0];
        const x =
          side === 'home'
            ? slot.x * PITCH.HALF_X * 1.85
            : PITCH.LENGTH - slot.x * PITCH.HALF_X * 1.85;
        const y = slot.y * PITCH.WIDTH;
        this.players.push({
          id: `${side}_${i}_${player.id}`,
          player,
          side,
          slotIndex: i,
          x,
          y,
          vx: 0,
          vy: 0,
          facing: side === 'home' ? 0 : Math.PI,
          lookTargetAngle: side === 'home' ? 0 : Math.PI,
          stamina: Math.max(60, player.fitness),
          yellowCards: 0,
          redCard: false,
          injured: false,
          tackleCooldown: 0,
          stunTimer: 0,
          slideTimer: 0,
          kickAnimTimer: 0,
          diveTimer: 0,
          diveDirY: 0,
          stridePhase: 0,
          angularVel: 0,
          leanForward: 0,
          leanBank: 0,
          fallTimer: 0,
          brakeTimer: 0,
          jostleTimer: 0,
          animState: 'idle',
          aiState: 'COVERING_SPACE',
          callingForBall: false,
          inWall: false,
        });
      }
    };
    buildSide(this.homeTeam, 'home');
    buildSide(this.awayTeam, 'away');
    this.selectNearestUserPlayer();
  }

  public setupKickoff(team: 'home' | 'away'): void {
    this.phase = 'kickoff_ready';
    this.phaseTimer = 0.65;
    this.restartType = 'kickoff';
    this.restartTeam = team;
    this.pendingPassCheck = null;
    this.advantageState = null;
    this.freeKickState = null;
    this.replayReturnToKickoff = false;

    this.ball = createInitialBall();
    this.ball.x = PITCH.HALF_X;
    this.ball.y = PITCH.HALF_Y;
    this.ball.lastTouchTeam = team;

    this.referee.x = PITCH.HALF_X - 4;
    this.referee.y = PITCH.HALF_Y - 11.5;
    this.referee.facing = Math.PI / 2;

    const homeForm = getFormation(this.homeFormationId);
    const awayForm = getFormation(this.awayFormationId);
    const circleRadius = 9.15;

    // Ángulos para formar la RONDA alrededor del círculo central en el saque del medio
    const kickingRondaSlots = [4, 5, 6, 7, 8];
    const defendingRondaSlots = [5, 6, 7, 8, 9, 10];

    for (const p of this.players) {
      if (p.redCard) continue;
      p.vx = 0;
      p.vy = 0;
      p.stunTimer = 0;
      p.slideTimer = 0;
      p.fallTimer = 0;
      p.brakeTimer = 0;
      p.jostleTimer = 0;
      p.animState = 'idle';
      p.inWall = false;
      p.callingForBall = false;
      const form = p.side === 'home' ? homeForm : awayForm;
      const slot = form.slots[p.slotIndex] ?? form.slots[0];

      if (p.side === 'home') {
        p.x = Math.min(PITCH.HALF_X - 2.5, slot.x * PITCH.LENGTH * 0.64);
        p.y = slot.y * PITCH.WIDTH;
      } else {
        p.x = Math.max(PITCH.HALF_X + 2.5, PITCH.LENGTH - slot.x * PITCH.LENGTH * 0.64);
        p.y = slot.y * PITCH.WIDTH;
      }

      if (p.side === team) {
        if (p.slotIndex === 9) {
          // Sacador central junto a la pelota en el punto medio
          p.x = PITCH.HALF_X + (team === 'home' ? -0.42 : 0.42);
          p.y = PITCH.HALF_Y - 0.32;
          this.ball.ownerId = p.id;
          this.ball.lastTouchPlayerId = p.id;
          this.ball.lastTouchPlayerName = p.player.name;
        } else if (p.slotIndex === 10) {
          // Compañero receptor dentro del círculo central para tocar en ronda
          p.x = PITCH.HALF_X + (team === 'home' ? -0.35 : 0.35);
          p.y = PITCH.HALF_Y + 1.95;
        } else {
          const rIdx = kickingRondaSlots.indexOf(p.slotIndex);
          if (rIdx !== -1) {
            // Semicírculo del equipo que saca formando la ronda central
            const norm = (rIdx - (kickingRondaSlots.length - 1) / 2) / 2.6;
            const angle = team === 'home' ? Math.PI + norm * 1.28 : norm * 1.28;
            p.x = PITCH.HALF_X + Math.cos(angle) * circleRadius;
            p.y = PITCH.HALF_Y + Math.sin(angle) * circleRadius;
          }
        }
      } else {
        const dIdx = defendingRondaSlots.indexOf(p.slotIndex);
        if (dIdx !== -1) {
          // Semicírculo del equipo rival cerrando la ronda de 360° alrededor del círculo central
          const norm = (dIdx - (defendingRondaSlots.length - 1) / 2) / 3.0;
          const angle = p.side === 'home' ? Math.PI + norm * 1.35 : norm * 1.35;
          p.x = PITCH.HALF_X + Math.cos(angle) * (circleRadius + 0.15);
          p.y = PITCH.HALF_Y + Math.sin(angle) * (circleRadius + 0.15);
        }
      }

      // Todos los jugadores miran hacia el centro de la ronda en el saque inicial / post-gol
      p.facing = Math.atan2(PITCH.HALF_Y - p.y, PITCH.HALF_X - p.x);
      p.lookTargetAngle = p.facing;
    }

    const centerTaker = this.players.find((p) => p.id === this.ball.ownerId);
    this.selectNearestUserPlayer();
    if (centerTaker && team === this.userSide) {
      this.activeUserPlayerId = centerTaker.id;
    } else if (centerTaker && this.twoPlayerMode && team === 'away') {
      this.activeUser2PlayerId = centerTaker.id;
    }
  }

  public setTrainingDrill(
    drill: 'free_play' | 'shooting' | 'passing' | 'dribbling' | 'free_kicks'
  ): void {
    this.trainingDrill = drill;
    if (this.mode === 'training') {
      this.setupTrainingScenario();
    }
  }

  public setupTrainingScenario(): void {
    const attackingSide: 'home' | 'away' = this.userSide === 'away' ? 'away' : 'home';
    const defendingSide: 'home' | 'away' = attackingSide === 'home' ? 'away' : 'home';
    this.freeKickShotTimer = 0;
    this.pendingPassCheck = null;
    this.advantageState = null;

    if (this.trainingDrill === 'free_kicks') {
      const spot = generateFreeKickPracticeSpot(attackingSide, this.freeKickPracticeIndex++);
      this.triggerSetPiece('free_kick', attackingSide, spot.x, spot.y);

      // Position non-wall, non-taker, non-GK players outside the shooting lane so the box is clean
      const takerId = this.ball.ownerId;
      for (const p of this.players) {
        if (p.id === takerId || p.inWall || p.player.position === 'GK') {
          if (p.player.position === 'GK') {
            p.x = p.side === 'home' ? 0.6 : PITCH.LENGTH - 0.6;
            p.y = PITCH.HALF_Y;
            p.facing = p.side === 'home' ? 0 : Math.PI;
          }
          continue;
        }
        // Keep a couple of rebound teammates near the edge of the box and bench the rest off-pitch
        if (p.side === attackingSide && (p.slotIndex === 8 || p.slotIndex === 10)) {
          p.x = attackingSide === 'home' ? PITCH.LENGTH - 17.5 : 17.5;
          p.y = PITCH.HALF_Y + (p.slotIndex === 8 ? -11 : 11);
          p.facing = attackingSide === 'home' ? 0 : Math.PI;
        } else {
          p.x = PITCH.HALF_X + (p.slotIndex - 5) * 2.0;
          p.y = -18;
        }
        p.vx = 0;
        p.vy = 0;
      }

      this.showBanner(`🎯 TIRO LIBRE · ${spot.angleLabel}`);
      return;
    }

    this.freeKickState = null;
    this.phase = 'live';
    this.ball = createInitialBall();

    const homeForm = getFormation(this.homeFormationId);
    const awayForm = getFormation(this.awayFormationId);

    for (const p of this.players) {
      p.inWall = false;
      p.vx = 0;
      p.vy = 0;
      p.stunTimer = 0;
      p.slideTimer = 0;
      p.animState = 'idle';
      const form = p.side === 'home' ? homeForm : awayForm;
      const slot = form.slots[p.slotIndex] ?? form.slots[0];

      if (p.player.position === 'GK') {
        p.x = p.side === 'home' ? 1.2 : PITCH.LENGTH - 1.2;
        p.y = PITCH.HALF_Y;
        p.facing = p.side === 'home' ? 0 : Math.PI;
        continue;
      }

      if (this.trainingDrill === 'shooting' && p.side === defendingSide && p.slotIndex < 8) {
        // Bench most defenders in shooting drill so the user has an open shooting lane against the GK + 2 defenders
        p.x = PITCH.HALF_X;
        p.y = -18;
        continue;
      }

      p.x =
        p.side === 'home'
          ? slot.x * PITCH.LENGTH * 0.78
          : PITCH.LENGTH - slot.x * PITCH.LENGTH * 0.78;
      p.y = slot.y * PITCH.WIDTH;
      p.facing = p.side === 'home' ? 0 : Math.PI;
    }

    const userAttacker =
      this.players.find((p) => p.side === attackingSide && p.slotIndex === 9) ??
      this.players.find((p) => p.side === attackingSide && p.player.position !== 'GK') ??
      this.players[0];

    if (userAttacker) {
      if (this.trainingDrill === 'shooting') {
        userAttacker.x = attackingSide === 'home' ? PITCH.LENGTH - 23.5 : 23.5;
        userAttacker.y = PITCH.HALF_Y + (this.rng() - 0.5) * 10;
        this.showBanner('🥅 PRÁCTICA DE DEFINICIÓN · Encara y remata al arco');
      } else if (this.trainingDrill === 'dribbling') {
        userAttacker.x = attackingSide === 'home' ? PITCH.HALF_X + 6 : PITCH.HALF_X - 6;
        userAttacker.y = PITCH.HALF_Y;
        this.showBanner('⚡ CIRCUITO DE REGATES 1v1 · Supera la línea defensiva');
      } else if (this.trainingDrill === 'passing') {
        userAttacker.x = attackingSide === 'home' ? PITCH.HALF_X + 2 : PITCH.HALF_X - 2;
        userAttacker.y = PITCH.HALF_Y;
        this.showBanner('🎯 RONDO Y POSESIÓN · Combina pases cortos y filtrados');
      } else {
        userAttacker.x = PITCH.HALF_X;
        userAttacker.y = PITCH.HALF_Y;
        this.showBanner('🏟️ PRÁCTICA LIBRE · Sin límite de tiempo');
      }
      userAttacker.facing = attackingSide === 'home' ? 0 : Math.PI;
      this.ball.x = userAttacker.x + (attackingSide === 'home' ? 0.55 : -0.55);
      this.ball.y = userAttacker.y;
      this.ball.ownerId = userAttacker.id;
      this.ball.lastTouchTeam = attackingSide;
      this.ball.lastTouchPlayerId = userAttacker.id;
      this.ball.lastTouchPlayerName = userAttacker.player.name;
      this.activeUserPlayerId = userAttacker.id;
    }
  }

  public startPenaltyShootout(): void {
    this.phase = 'penalty_shootout';
    this.freeKickState = null;
    this.penaltyState = {
      round: 1,
      turn: 'home',
      homeTaken: 0,
      awayTaken: 0,
      homeScored: 0,
      awayScored: 0,
      historyHome: [],
      historyAway: [],
      aimX: 0,
      aimY: 0.4,
      power: 0.78,
      awaitingUserInput: this.userSide === 'home',
      kickAnimTimer: 0,
      lastOutcomeText: '¡Apunta con la mira, elige potencia y dispara el penal!',
    };
    this.positionForSinglePenalty('home');
  }

  private positionForSinglePenalty(kickingSide: 'home' | 'away'): void {
    this.ball = createInitialBall();
    this.ball.x = PITCH.LENGTH - PITCH.PENALTY_SPOT_X;
    this.ball.y = PITCH.HALF_Y;

    const gkSide = kickingSide === 'home' ? 'away' : 'home';
    const kickerOrder = [9, 10, 8, 7, 6, 5, 4, 3, 2, 1, 0];
    const takenCount =
      kickingSide === 'home'
        ? this.penaltyState?.homeTaken ?? 0
        : this.penaltyState?.awayTaken ?? 0;
    const preferredSlot = kickerOrder[takenCount % kickerOrder.length];
    const chosenKicker =
      this.players.find((p) => p.side === kickingSide && p.slotIndex === preferredSlot && !p.redCard) ??
      this.players.find((p) => p.side === kickingSide && p.slotIndex === 9 && !p.redCard) ??
      this.players.find((p) => p.side === kickingSide && p.player.position !== 'GK');

    // Referee watches from the edge of the penalty box
    this.referee.x = PITCH.LENGTH - 15.2;
    this.referee.y = PITCH.HALF_Y - 8.5;
    this.referee.facing = Math.PI / 2;

    for (const p of this.players) {
      p.animState = 'idle';
      p.diveTimer = 0;
      p.kickAnimTimer = 0;
      if (p.side === gkSide && p.player.position === 'GK') {
        p.x = PITCH.LENGTH - 0.6;
        p.y = PITCH.HALF_Y;
        p.facing = Math.PI;
        p.lookTargetAngle = Math.PI;
      } else if (chosenKicker && p.id === chosenKicker.id) {
        p.x = PITCH.LENGTH - PITCH.PENALTY_SPOT_X - 2.6;
        p.y = PITCH.HALF_Y;
        p.facing = 0;
        p.lookTargetAngle = 0;
        this.ball.lastTouchPlayerId = p.id;
        this.ball.lastTouchPlayerName = p.player.name;
        this.ball.lastTouchTeam = kickingSide;
        if (kickingSide === this.userSide) {
          this.activeUserPlayerId = p.id;
        } else if (this.twoPlayerMode && kickingSide === 'away') {
          this.activeUser2PlayerId = p.id;
        }
      } else {
        // Park all non-participating players off-pitch so ONLY the kicker and goalkeeper occupy the penalty area
        p.x = PITCH.HALF_X - 6 + p.slotIndex * 1.2;
        p.y = -18;
        p.facing = 0;
      }
      p.vx = 0;
      p.vy = 0;
    }
  }

  public executePenaltyKick(aimX: number, aimY: number, power: number, curve = 0): void {
    if (this.phase === 'set_piece' && this.restartType === 'penalty') {
      this.executeFreeKickOrInMatchPenalty(aimX, aimY, power, curve, 'curva');
      return;
    }

    if (
      this.phase !== 'penalty_shootout' ||
      !this.penaltyState ||
      this.penaltyState.kickAnimTimer > 0
    )
      return;

    const st = this.penaltyState;
    const kickingSide = st.turn;
    const defendingSide = kickingSide === 'home' ? 'away' : 'home';
    const gk = this.players.find((p) => p.side === defendingSide && p.player.position === 'GK');
    const kicker = this.players.find(
      (p) => p.side === kickingSide && p.y > 0 && Math.abs(p.x - (PITCH.LENGTH - PITCH.PENALTY_SPOT_X - 2.6)) < 4
    );
    if (kicker) {
      kicker.kickAnimTimer = 0.35;
      kicker.animState = 'shoot';
    }
    const profile = getDifficultyProfile(this.difficulty);

    const overchargeError = power > 0.91 ? (power - 0.91) * 4.8 : 0;
    const spreadY = Math.max(-1.22, Math.min(1.22, aimX + (this.rng() - 0.5) * overchargeError));
    const spreadZ = Math.max(
      0.08,
      Math.min(1.28, aimY + (power > 0.92 ? (power - 0.91) * 2.2 : 0))
    );

    const targetY = PITCH.HALF_Y + spreadY * (PITCH.GOAL_HALF - 0.12);
    const targetZ = spreadZ * (PITCH.GOAL_HEIGHT - 0.05);

    const speed =
      PHYSICS_TUNING.SHOT_SPEED_MIN_MPS +
      power * (PHYSICS_TUNING.SHOT_SPEED_MAX_MPS - PHYSICS_TUNING.SHOT_SPEED_MIN_MPS);
    const dx = PITCH.LENGTH - this.ball.x;
    const dy = targetY - this.ball.y;
    const dist = Math.hypot(dx, dy);
    this.ball.vx = (dx / dist) * speed;
    this.ball.vy = (dy / dist) * speed;
    this.ball.vz = targetZ / (dist / speed) + 1.85;
    this.ball.spin = curve * 2.1;
    this.onSound?.('kick_hard');
    this.emitParticles(this.ball.x, this.ball.y, 0.05, 10, 'turf');

    if (gk) {
      const isUserDefending =
        defendingSide === this.userSide || (this.twoPlayerMode && defendingSide === 'away');
      const defInput =
        this.twoPlayerMode && defendingSide === 'away' ? this.userInput2 : this.userInput;
      const readChance = isUserDefending ? 0.38 : 0.28 + profile.gkReflexes * 0.52;
      const diveSide =
        isUserDefending && Math.abs(defInput.moveY) > 0.2
          ? Math.sign(defInput.moveY)
          : this.rng() < readChance
          ? Math.sign(aimX || (this.rng() - 0.5))
          : this.rng() < 0.5
          ? -1
          : 1;
      gk.diveTimer = 0.75;
      gk.diveDirY = diveSide;
      const powerReactionPenalty = Math.max(0.75, 1.08 - power * 0.25);
      gk.vy = diveSide * (5.2 + profile.gkReflexes * 3.1) * powerReactionPenalty;
    }

    st.awaitingUserInput = false;
    st.kickAnimTimer = 1.45;
  }

  private resolvePenaltyKickResult(scored: boolean): void {
    const st = this.penaltyState;
    if (!st) return;

    if (st.turn === 'home') {
      st.homeTaken++;
      if (scored) {
        st.homeScored++;
        st.historyHome.push('goal');
        this.setCoachMoods('celebrate', 'despair', 3.0);
      } else {
        st.historyHome.push('miss');
        this.setCoachMoods('despair', 'celebrate', 3.0);
      }
      st.lastOutcomeText = scored ? '¡GOOOL en la tanda!' : '¡Atajada / Al palo o afuera!';
      st.turn = 'away';
    } else {
      st.awayTaken++;
      if (scored) {
        st.awayScored++;
        st.historyAway.push('goal');
        this.setCoachMoods('despair', 'celebrate', 3.0);
      } else {
        st.historyAway.push('miss');
        this.setCoachMoods('celebrate', 'despair', 3.0);
      }
      st.lastOutcomeText = scored ? '¡GOL del visitante!' : '¡Falló el visitante!';
      st.turn = 'home';
      st.round++;
    }

    if (this.mode === 'penalties') {
      this.homeScore = st.homeScored;
      this.awayScore = st.awayScored;
      this.homeStats.goals = st.homeScored;
      this.awayStats.goals = st.awayScored;
    }

    const diff = Math.abs(st.homeScored - st.awayScored);
    const homeRem = Math.max(0, 5 - st.homeTaken);
    const awayRem = Math.max(0, 5 - st.awayTaken);
    const decidedInFive =
      (st.homeTaken <= 5 && st.awayTaken <= 5) &&
      (st.homeScored > st.awayScored + awayRem || st.awayScored > st.homeScored + homeRem);
    const suddenDeathDecided =
      st.homeTaken >= 5 && st.awayTaken >= 5 && st.homeTaken === st.awayTaken && diff > 0;

    if (decidedInFive || suddenDeathDecided) {
      this.phase = 'fulltime';
      this.onSound?.('whistle_fulltime');
      return;
    }

    this.positionForSinglePenalty(st.turn);
    st.awaitingUserInput =
      st.turn === this.userSide || (this.twoPlayerMode && st.turn === 'away');
  }

  public executeFreeKickOrInMatchPenalty(
    aimOffset: number,
    aimHeight: number,
    power: number,
    curve: number,
    strikeType: StrikeType = 'curva'
  ): void {
    const taker =
      this.players.find((p) => p.id === this.ball.ownerId) ??
      this.players.find((p) => p.side === this.restartTeam && !p.redCard);
    if (!taker) return;

    this.freeKickState = null;
    this.phase = 'live';
    if (this.mode === 'training' && this.trainingDrill === 'free_kicks') {
      this.freeKickShotTimer = 3.2;
    }
    for (const p of this.players) {
      p.inWall = false;
    }

    const oppGoalX = taker.side === 'home' ? PITCH.LENGTH : 0;
    const stats = taker.side === 'home' ? this.homeStats : this.awayStats;
    stats.shots++;

    const overchargeSpread = power > 0.92 ? (power - 0.92) * 8.5 : 0;
    const targetY =
      PITCH.HALF_Y +
      Math.max(-1.25, Math.min(1.25, aimOffset)) * (PITCH.GOAL_HALF - 0.1) +
      (this.rng() - 0.5) * overchargeSpread;

    if (Math.abs(targetY - PITCH.HALF_Y) < PITCH.GOAL_HALF) {
      stats.shotsOnTarget++;
    }

    const dx = oppGoalX - this.ball.x;
    const dy = targetY - this.ball.y;
    const dist = Math.max(1, Math.hypot(dx, dy));

    const speed =
      strikeType === 'globo'
        ? 19 + power * 7
        : PHYSICS_TUNING.SHOT_SPEED_MIN_MPS +
          power * (PHYSICS_TUNING.SHOT_SPEED_MAX_MPS - PHYSICS_TUNING.SHOT_SPEED_MIN_MPS);
    const liftVz =
      strikeType === 'raso'
        ? 0.8 + aimHeight * 1.4
        : strikeType === 'globo'
        ? 6.4 + aimHeight * 3.8
        : 3.4 + aimHeight * 4.5 + (power > 0.92 ? 2.2 : 0);

    this.ball.ownerId = null;
    this.ball.lastTouchTeam = taker.side;
    this.ball.lastTouchPlayerId = taker.id;
    this.ball.lastTouchPlayerName = taker.player.name;
    this.ball.vx = (dx / dist) * speed;
    this.ball.vy = (dy / dist) * speed;
    this.ball.vz = liftVz;
    this.ball.spin = curve * 2.8;
    this.ball.topSpin = strikeType === 'curva' ? 1.4 : strikeType === 'globo' ? -0.8 : 0.4;
    this.ball.strikeType = strikeType;

    taker.kickAnimTimer = 0.32;
    taker.animState = 'shoot';
    taker.facing = Math.atan2(dy, dx);
    this.onSound?.('kick_hard');
    this.emitParticles(this.ball.x, this.ball.y, 0.05, 10, 'turf');

    if (this.restartType === 'penalty') {
      const defendingSide = taker.side === 'home' ? 'away' : 'home';
      const gk = this.players.find((p) => p.side === defendingSide && p.player.position === 'GK');
      if (gk) {
        const profile = getDifficultyProfile(this.difficulty);
        const readChance = 0.28 + profile.gkReflexes * 0.5;
        const diveSide =
          this.rng() < readChance
            ? Math.sign(aimOffset || (this.rng() - 0.5))
            : this.rng() < 0.5
            ? -1
            : 1;
        gk.diveTimer = 0.72;
        gk.diveDirY = diveSide;
        gk.vy = diveSide * (5.2 + profile.gkReflexes * 2.8);
      }
    }

    this.onCommentary?.({
      type: 'shot',
      playerName: taker.player.name,
      teamName: taker.side === 'home' ? this.homeTeam.name : this.awayTeam.name,
    });
  }

  public step(rawDt: number): void {
    let dt = Math.min(rawDt, 0.05);
    const speedMult =
      this.settings.match.gameSpeed === 'lento'
        ? 0.88
        : this.settings.match.gameSpeed === 'rapido'
        ? 1.15
        : 1.0;

    this.cameraShake = Math.max(0, this.cameraShake - dt * 2.8);
    if (this.bannerTimer > 0) {
      this.bannerTimer = Math.max(0, this.bannerTimer - dt);
      if (this.bannerTimer === 0) this.bannerText = null;
    }
    if (this.coachMoodTimer > 0) {
      this.coachMoodTimer = Math.max(0, this.coachMoodTimer - dt);
      if (this.coachMoodTimer === 0) {
        this.homeCoachMood = 'instruct';
        this.awayCoachMood = 'instruct';
      }
    }
    if (this.crowdMoodTimer > 0) {
      this.crowdMoodTimer = Math.max(0, this.crowdMoodTimer - dt);
      if (this.crowdMoodTimer === 0) {
        this.crowdMood = 'calm';
      }
    }
    if (this.referee.signalTimer > 0) {
      this.referee.signalTimer = Math.max(0, this.referee.signalTimer - dt);
      if (this.referee.signalTimer === 0) {
        this.referee.signalType = 'none';
      }
    }

    // Step 3D pitch particles
    for (let i = this.particleEvents.length - 1; i >= 0; i--) {
      const pt = this.particleEvents[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        this.particleEvents.splice(i, 1);
      } else {
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vz -= 12.5 * dt;
        pt.z = Math.max(0, pt.z + pt.vz * dt);
      }
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      return;
    }

    if (this.lastSkillMove && this.lastSkillMove.timer > 0) {
      this.lastSkillMove.timer = Math.max(0, this.lastSkillMove.timer - dt);
      if (this.lastSkillMove.timer === 0) {
        this.lastSkillMove = null;
      }
    }

    if (this.slowMoTimer > 0) {
      this.slowMoTimer = Math.max(0, this.slowMoTimer - dt);
      dt = dt * this.slowMoFactor;
    }

    if (this.lightningState?.active) {
      this.lightningState.timer = Math.max(0, this.lightningState.timer - dt);
      if (this.lightningState.timer <= 0) {
        this.lightningState.active = false;
      }
    }

    if (this.varReviewState?.active) {
      this.stepVARReview(dt);
      return;
    }

    if (this.cutsceneState?.active) {
      this.cutsceneState.timer = Math.max(0, this.cutsceneState.timer - dt);
      if (this.cutsceneState.timer <= 0) {
        this.cutsceneState = null;
      }
    }

    if (this.cardCutscene?.active) {
      this.cardCutscene.timer = Math.max(0, this.cardCutscene.timer - dt);
      this.referee.x += (this.cardCutscene.x - 1.35 - this.referee.x) * Math.min(1, dt * 8);
      this.referee.y += (this.cardCutscene.y + 0.45 - this.referee.y) * Math.min(1, dt * 8);
      this.referee.facing = Math.atan2(
        this.cardCutscene.y - this.referee.y,
        this.cardCutscene.x - this.referee.x
      );
      this.referee.signalType = this.cardCutscene.card;
      this.referee.signalTimer = 1.0;

      // Si es tarjeta roja, el jugador expulsado camina hacia el túnel/lateral abandonando el campo
      if (this.cardCutscene.card === 'red') {
        const sentOff = this.players.find((p) => p.id === this.cardCutscene?.playerId);
        if (sentOff) {
          sentOff.animState = 'walk';
          sentOff.facing = Math.PI / 2;
          sentOff.y += 2.6 * dt;
        }
      }

      if (this.cardCutscene.timer <= 0) {
        this.cardCutscene = null;
        if (this.cutsceneState?.type === 'yellow_card' || this.cutsceneState?.type === 'red_card') {
          this.cutsceneState = null;
        }
      } else {
        return;
      }
    }

    if (this.offsideCutscene?.active) {
      this.offsideCutscene.timer = Math.max(0, this.offsideCutscene.timer - dt);
      this.referee.signalType = 'foul';
      this.referee.signalTimer = 1.0;
      if (this.offsideCutscene.timer <= 0) {
        this.offsideCutscene = null;
      } else {
        return;
      }
    }

    // Modo Tormenta (99% de probabilidad de rayo) y Easter Egg de Lluvia (99% en tormenta / 75% en lluvia)
    const isStormOrRain =
      this.settings.match.weather === 'tormenta' || this.settings.match.weather === 'lluvia';
    if (isStormOrRain && this.phase === 'live' && this.mode !== 'training') {
      const strikeProbability = this.settings.match.weather === 'tormenta' ? 0.99 : 0.75;
      if (!this.lightningRolledThisMatch) {
        this.lightningRolledThisMatch = true;
        this.lightningWillStrikeThisMatch = Math.random() < strikeProbability;
        this.lightningTargetMinute =
          this.settings.match.weather === 'tormenta'
            ? 2 + Math.random() * 10
            : 10 + Math.random() * 45;
      }
      if (
        this.lightningWillStrikeThisMatch &&
        this.matchMinute >= this.lightningTargetMinute &&
        !this.lightningState
      ) {
        this.lightningWillStrikeThisMatch = false;
        this.triggerLightningEasterEgg(true);
        // En modo tormenta pueden caer más rayos a lo largo del partido con 99% de probabilidad
        if (this.settings.match.weather === 'tormenta' && this.matchMinute < 75) {
          this.lightningWillStrikeThisMatch = Math.random() < 0.99;
          this.lightningTargetMinute = this.matchMinute + 18 + Math.random() * 16;
        }
      }
    }

    const simDt = dt * speedMult;

    if (
      this.phase === 'fulltime' ||
      this.phase === 'halftime' ||
      this.phase === 'extratime_break'
    ) {
      return;
    }

    if (this.phase === 'penalty_shootout' && this.penaltyState) {
      this.stepPenaltyShootout(simDt);
      return;
    }

    if (this.phase === 'goal_celebration') {
      this.phaseTimer -= dt;
      const scorer = this.players.find((p) => p.id === this.replayScorerId);
      const cornerFlagX = this.restartTeam === 'away' ? PITCH.LENGTH - 4 : 4;
      const cornerFlagY = PITCH.WIDTH - 4;
      for (const p of this.players) {
        if (!p.redCard) {
          if (p.id === this.replayScorerId || p.side !== this.restartTeam) {
            const targetCelX = p.id === this.replayScorerId ? cornerFlagX : (scorer?.x ?? cornerFlagX);
            const targetCelY = p.id === this.replayScorerId ? cornerFlagY : (scorer?.y ?? cornerFlagY);
            const dx = targetCelX - p.x;
            const dy = targetCelY - p.y;
            const d = Math.max(0.1, Math.hypot(dx, dy));
            stepPlayerMovement(
              p,
              (dx / d) * 0.72,
              (dy / d) * 0.72,
              true,
              false,
              simDt,
              this.settings.match.pitchCondition
            );
            p.animState = 'celebrate';
          } else {
            stepPlayerMovement(
              p,
              0,
              0,
              false,
              false,
              simDt,
              this.settings.match.pitchCondition
            );
            p.animState = 'lament';
          }
        }
      }
      stepBallPhysics(
        this.ball,
        simDt,
        this.settings.match.pitchCondition,
        this.settings.match.weather
      );
      this.recordReplayFrame();

      if (this.phaseTimer <= 0) {
        this.cutsceneState = null;
        if (this.goldenGoalTriggered) {
          this.phase = 'fulltime';
          this.onSound?.('whistle_fulltime');
          return;
        }
        if (this.mode === 'training') {
          this.setupTrainingScenario();
          return;
        }
        if (this.replayBuffer.length > 20 && this.settings.visual.animations) {
          this.startTVReplay(true, this.replayPlayTitle);
        } else {
          this.setupKickoff(this.restartTeam);
        }
      }
      return;
    }

    if (this.phase === 'goal_replay') {
      this.stepTVReplay();
      return;
    }

    if (this.phase === 'kickoff_ready' || this.phase === 'set_piece') {
      const setPieceInput =
        this.twoPlayerMode && this.restartTeam === 'away' ? this.userInput2 : this.userInput;
      const isRestartTeamUserControlled =
        this.restartTeam === this.userSide ||
        (this.twoPlayerMode && this.restartTeam === 'away');

      if (this.phase === 'set_piece' && this.freeKickState?.awaitingUserInput) {
        if (Math.abs(setPieceInput.moveX) > 0.1 || Math.abs(setPieceInput.moveY) > 0.1) {
          this.freeKickState.aimOffset = Math.max(
            -1.1,
            Math.min(1.1, this.freeKickState.aimOffset + setPieceInput.moveY * dt * 1.2)
          );
        }
        if (setPieceInput.shootReleased) {
          setPieceInput.shootReleased = false;
          this.executeFreeKickOrInMatchPenalty(
            this.freeKickState.aimOffset,
            this.freeKickState.aimHeight,
            Math.max(0.45, setPieceInput.shootPower || this.freeKickState.power),
            this.freeKickState.curve,
            this.freeKickState.strikeType
          );
        } else if (setPieceInput.passPressed) {
          setPieceInput.passPressed = false;
          this.freeKickState = null;
          this.phase = 'live';
          for (const p of this.players) p.inWall = false;
          const taker = this.players.find((p) => p.id === this.ball.ownerId);
          if (taker) {
            const target = this.findPassTargetForUser(taker, false, setPieceInput);
            this.performPass(taker, target.x, target.y, false);
          }
        }
        return;
      }

      // Si es saque de arco (goal_kick), córner (corner) o lateral (throw_in) y el usuario pulsa pase/tiro/centro antes de que termine el timer, ejecuta de inmediato
      if (
        this.phase === 'set_piece' &&
        (this.restartType === 'goal_kick' ||
          this.restartType === 'corner' ||
          this.restartType === 'throw_in') &&
        isRestartTeamUserControlled &&
        (setPieceInput.passPressed ||
          setPieceInput.throughPressed ||
          setPieceInput.crossPressed ||
          setPieceInput.shootReleased)
      ) {
        const wantsShortPass = setPieceInput.passPressed && this.restartType !== 'throw_in';
        setPieceInput.passPressed = false;
        setPieceInput.throughPressed = false;
        setPieceInput.crossPressed = false;
        setPieceInput.shootReleased = false;
        this.cutsceneState = null;
        this.phase = 'live';
        for (const p of this.players) p.inWall = false;
        this.onSound?.('whistle_short');
        this.executeAiSetPiece(wantsShortPass);
        return;
      }

      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.cutsceneState = null;
        this.phase = 'live';
        for (const p of this.players) p.inWall = false;
        if (this.restartType === 'kickoff') {
          this.onSound?.('whistle_start');
          // En el saque del medio en ronda, el sacador central toca la pelota a su compañero del círculo central
          const kicker =
            this.players.find((p) => p.id === this.ball.ownerId) ??
            this.players.find((p) => p.side === this.restartTeam && p.slotIndex === 9);
          const partner =
            this.players.find(
              (p) => p.side === this.restartTeam && p.slotIndex === 10 && !p.redCard
            ) ??
            this.players.find(
              (p) =>
                p.side === this.restartTeam &&
                p.id !== kicker?.id &&
                !p.redCard &&
                p.player.position !== 'GK'
            );
          if (kicker && partner) {
            this.performPass(kicker, partner.x, partner.y, false, 0.52);
            if (this.restartTeam === this.userSide) {
              this.activeUserPlayerId = partner.id;
            } else if (this.twoPlayerMode && this.restartTeam === 'away') {
              this.activeUser2PlayerId = partner.id;
            }
          }
        } else {
          this.onSound?.('whistle_short');
          // Ejecutar saque de meta, córner, lateral o tiro libre
          if (
            this.restartType === 'goal_kick' ||
            this.restartType === 'corner' ||
            this.restartType === 'throw_in' ||
            !isRestartTeamUserControlled
          ) {
            this.executeAiSetPiece(false);
          }
        }
      }
      return;
    }

    // ==================== LIVE SIMULATION ====================
    this.frameSoundEvent = undefined;
    if (this.mode === 'training' && this.trainingDrill === 'free_kicks' && this.freeKickShotTimer > 0) {
      this.freeKickShotTimer -= simDt;
      if (this.freeKickShotTimer <= 0 || this.ball.ownerId !== null) {
        this.setupTrainingScenario();
        return;
      }
    }
    this.stepMatchClock(simDt);
    this.stepAdvantageRule(simDt);
    this.stepSmartAutoPlayerSwitch(simDt);
    this.stepUserAndAI(simDt);
    this.stepAerialDuels(simDt);
    this.stepRefereePosition(simDt);
    this.stepBallOwnershipAndOutcome(simDt);
    this.recordReplayFrame();
  }

  /**
   * Inicia la repetición estilo transmisión de TV con 3 ángulos de cámara seleccionables y cámara lenta (0.5x).
   */
  public startTVReplay(returnToKickoff: boolean, title = 'REPETICIÓN OFICIAL'): void {
    // Tomamos los últimos ~380 frames (~6.3 segundos de jugada previa + definición) del buffer circular de 18s
    const sliceStart = Math.max(0, this.replayBuffer.length - 360);
    this.replayPlaybackFrames = this.replayBuffer.slice(sliceStart);
    this.replayPlaybackIndex = 0;
    this.replayFloatIndex = 0;
    this.replayCameraAngle = 'broadcast_slow';
    this.manualReplayCameraOverride = null;
    this.replaySpeedFactor = 0.5;
    this.replayPlayTitle = title;
    this.replayReturnToKickoff = returnToKickoff;
    this.cutsceneState = null;
    this.phase = 'goal_replay';

    const scorer = this.players.find((p) => p.id === this.replayScorerId);
    this.onCommentary?.({
      type: 'replay_analysis',
      playerName: scorer?.player.name,
    });
  }

  public setReplayCameraAngle(angle: ReplayCameraAngle | null): void {
    this.manualReplayCameraOverride = angle;
    if (angle) {
      this.replayCameraAngle = angle;
    }
  }

  public adjustReplayFreeCamAngle(deltaRad: number): void {
    this.replayFreeCamAngle += deltaRad;
  }

  /**
   * Permite omitir cualquier cinemática activa (tarjeta, córner, lateral, celebración de gol o repetición)
   * y devolver la cámara suavemente al juego.
   */
  public skipCutscene(): void {
    this.cutsceneState = null;
    this.cardCutscene = null;
    this.offsideCutscene = null;
    if (this.phase === 'goal_celebration') {
      this.phaseTimer = 0;
      if (this.goldenGoalTriggered) {
        this.phase = 'fulltime';
        this.onSound?.('whistle_fulltime');
      } else if (this.mode === 'training') {
        this.setupTrainingScenario();
      } else {
        this.setupKickoff(this.restartTeam);
      }
      return;
    }
    if (this.phase === 'goal_replay') {
      this.skipReplay();
      return;
    }
    if (this.phase === 'set_piece' && this.phaseTimer > 0.15) {
      this.phaseTimer = 0.12;
    }
  }

  /**
   * Avanza la repetición con cámara lenta (0.5x) y cambio automático o manual entre los 3 ángulos de TV:
   * 1) Cámara TV Broadcast ('broadcast_slow')
   * 2) Cámara Libre / Lateral a ras de césped ('low_sideline_slow')
   * 3) Cámara Detrás del Arco con zoom al remate y entrada a la red ('behind_goal_zoom')
   */
  private stepTVReplay(): void {
    const total = this.replayPlaybackFrames.length;
    if (total === 0) {
      this.skipReplay();
      return;
    }

    const progress = this.replayFloatIndex / total;
    if (this.manualReplayCameraOverride) {
      this.replayCameraAngle = this.manualReplayCameraOverride;
      this.replaySpeedFactor = 0.5;
    } else if (progress < 0.38) {
      this.replayCameraAngle = 'broadcast_slow';
      this.replaySpeedFactor = 0.5;
    } else if (progress < 0.70) {
      this.replayCameraAngle = 'low_sideline_slow';
      this.replaySpeedFactor = 0.45;
    } else {
      this.replayCameraAngle = 'behind_goal_zoom';
      this.replaySpeedFactor = 0.35;
    }

    const prevIdx = Math.floor(this.replayFloatIndex);
    this.replayFloatIndex += this.replaySpeedFactor;
    this.replayPlaybackIndex = Math.min(total - 1, Math.floor(this.replayFloatIndex));

    // Reproducir sonido sincronizado del impacto, roce con la red y grito de gol durante la repetición
    if (this.replayPlaybackIndex !== prevIdx) {
      const frame = this.replayPlaybackFrames[this.replayPlaybackIndex];
      if (frame?.soundEvent) {
        this.onSound?.(frame.soundEvent);
      }
    }

    if (this.replayFloatIndex >= total) {
      this.skipReplay();
    }
  }

  /**
   * Permite saltar la repetición en cualquier momento ("Saltar Repetición")
   */
  public skipReplay(): void {
    if (this.phase !== 'goal_replay') return;
    this.manualReplayCameraOverride = null;
    if (this.replayReturnToKickoff) {
      this.setupKickoff(this.restartTeam);
    } else {
      this.phase = 'live';
    }
  }

  public triggerInstantReplay(customTitle?: string): void {
    if (
      this.replayBuffer.length > 20 &&
      (this.phase === 'live' || this.phase === 'set_piece' || this.phase === 'goal_celebration')
    ) {
      const wasCelebration = this.phase === 'goal_celebration';
      this.startTVReplay(wasCelebration, customTitle || this.replayPlayTitle || 'REPETICIÓN · JUGADA DESTACADA');
    }
  }

  private stepAdvantageRule(dt: number): void {
    if (!this.advantageState) return;
    this.advantageState.timer -= dt;
    const owner = this.players.find((p) => p.id === this.ball.ownerId);

    if (owner && owner.side !== this.advantageState.side) {
      const adv = this.advantageState;
      this.advantageState = null;
      this.onSound?.('whistle_short');
      this.showBanner(`Falta previa sancionada · Tiro libre`);
      this.triggerSetPiece('free_kick', adv.side, adv.foulX, adv.foulY);
      return;
    }

    if (this.advantageState.timer <= 0) {
      this.advantageState = null;
    }
  }

  private stepRefereePosition(dt: number): void {
    const targetX = Math.max(
      8,
      Math.min(PITCH.LENGTH - 8, this.ball.x + (this.ball.x > PITCH.HALF_X ? -8.5 : 8.5))
    );
    const targetY = Math.max(
      6,
      Math.min(PITCH.WIDTH - 6, this.ball.y + (this.ball.y > PITCH.HALF_Y ? -9.5 : 9.5))
    );
    const dx = targetX - this.referee.x;
    const dy = targetY - this.referee.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.8) {
      const spd = Math.min(6.5, dist * 1.45);
      this.referee.vx += ((dx / dist) * spd - this.referee.vx) * Math.min(1, dt * 6);
      this.referee.vy += ((dy / dist) * spd - this.referee.vy) * Math.min(1, dt * 6);
      this.referee.x += this.referee.vx * dt;
      this.referee.y += this.referee.vy * dt;
    } else {
      this.referee.vx *= 0.8;
      this.referee.vy *= 0.8;
    }
    this.referee.facing = Math.atan2(this.ball.y - this.referee.y, this.ball.x - this.referee.x);
  }

  private stepPenaltyShootout(dt: number): void {
    const st = this.penaltyState;
    if (!st) return;

    if (st.kickAnimTimer > 0) {
      st.kickAnimTimer -= dt;
      const gk = this.players.find((p) => p.side !== st.turn && p.player.position === 'GK');
      if (gk) {
        stepPlayerMovement(gk, 0, 0, false, false, dt, this.settings.match.pitchCondition);
      }
      const { hitPost, hitNet } = stepBallPhysics(
        this.ball,
        dt,
        this.settings.match.pitchCondition,
        this.settings.match.weather
      );
      if (hitPost) {
        this.onSound?.('post');
        this.cameraShake = 0.35;
      }
      if (hitNet) {
        this.onSound?.('net_swish');
      }

      if (
        gk &&
        Math.hypot(this.ball.x - gk.x, this.ball.y - gk.y) < 1.15 &&
        this.ball.z < 2.25
      ) {
        this.ball.vx = -Math.abs(this.ball.vx) * 0.45;
        this.ball.vy += (this.rng() - 0.5) * 4;
        this.onSound?.('save_clap');
      }

      if (
        this.ball.x > PITCH.LENGTH + 0.1 &&
        Math.abs(this.ball.y - PITCH.HALF_Y) < PITCH.GOAL_HALF &&
        this.ball.z <= PITCH.GOAL_HEIGHT
      ) {
        this.onSound?.('net_swish');
        this.onSound?.('goal_roar');
        this.resolvePenaltyKickResult(true);
        return;
      }

      if (st.kickAnimTimer <= 0) {
        this.resolvePenaltyKickResult(false);
      }
      return;
    }

    if (!st.awaitingUserInput) {
      const profile = getDifficultyProfile(this.difficulty);
      const aimX =
        (this.rng() < 0.5 ? -1 : 1) * (0.52 + (1 - profile.shotErrorMeters / 6) * 0.36);
      const aimY = 0.25 + this.rng() * 0.58;
      const power = 0.74 + profile.offensiveAggression * 0.18;
      this.executePenaltyKick(aimX, aimY, power);
    }
  }

  private stepMatchClock(dt: number): void {
    if (this.mode === 'training' || this.modeConfig.clockMode === 'no_limit' || this.modeConfig.clockMode === 'shootout_only') {
      return;
    }

    const halfMinutes = this.settings.match.halfDurationMinutes;
    const totalHalfSeconds = halfMinutes * 60;
    const gameMinutesPerRealSecond = 45 / totalHalfSeconds;
    this.matchMinute += dt * gameMinutesPerRealSecond;

    if (this.half === 1 && this.matchMinute >= 43 && this.addedTimeAnnouncedHalf < 1) {
      this.addedTimeAnnouncedHalf = 1;
      if (this.addedTimeMinutes === 0) this.addedTimeMinutes = Math.floor(1 + this.rng() * 3);
      this.onCommentary?.({
        type: 'added_time',
        addedMinutes: this.addedTimeMinutes,
      });
    }

    if (this.half === 2 && this.matchMinute >= 88 && this.addedTimeAnnouncedHalf < 2) {
      this.addedTimeAnnouncedHalf = 2;
      if (this.addedTimeMinutes === 0) this.addedTimeMinutes = Math.floor(2 + this.rng() * 3);
      this.onCommentary?.({
        type: 'added_time',
        addedMinutes: this.addedTimeMinutes,
      });
    }

    if (this.half === 1 && this.matchMinute >= 45 + this.addedTimeMinutes) {
      this.half = 2;
      this.matchMinute = 45;
      this.addedTimeMinutes = Math.floor(1 + this.rng() * 3);
      this.phase = 'halftime';
      this.onSound?.('whistle_short');
      this.onCommentary?.({
        type: 'halftime',
        teamName: this.homeTeam.name,
        opponentName: this.awayTeam.name,
        homeScore: this.homeScore,
        awayScore: this.awayScore,
      });
      return;
    }

    const forceKnockoutTiebreak = [
      'world_cup',
      'continental_cup',
      'club_cup',
      'survival',
      'all_star',
      'custom_tournament',
    ].includes(this.mode);
    const canExtraTime =
      this.modeConfig.extraTimeOnDraw &&
      (this.settings.match.extraTimeEnabled || forceKnockoutTiebreak);
    const canPenalties =
      this.modeConfig.penaltiesOnDraw &&
      (this.settings.match.penaltiesEnabled || forceKnockoutTiebreak);

    if (this.half === 2 && this.matchMinute >= 90 + this.addedTimeMinutes) {
      if (this.homeScore === this.awayScore && canExtraTime) {
        this.half = 3;
        this.matchMinute = 90;
        this.addedTimeMinutes = 1;
        this.phase = 'extratime_break';
        this.onSound?.('whistle_short');
        if (this.modeConfig.goldenGoalInExtraTime) {
          this.showBanner('⚡ ¡PRÓRROGA CON GOL DE ORO! El primero que anote gana el partido');
        }
        this.onCommentary?.({
          type: 'extra_time',
          teamName: this.homeTeam.name,
          opponentName: this.awayTeam.name,
        });
      } else if (this.homeScore === this.awayScore && canPenalties) {
        this.startPenaltyShootout();
      } else {
        this.phase = 'fulltime';
        this.onSound?.('whistle_fulltime');
        this.onCommentary?.({
          type: 'fulltime',
          teamName: this.homeTeam.name,
          opponentName: this.awayTeam.name,
          homeScore: this.homeScore,
          awayScore: this.awayScore,
        });
      }
      return;
    }

    if (this.half === 3 && this.matchMinute >= 105 + this.addedTimeMinutes) {
      this.half = 4;
      this.matchMinute = 105;
      this.addedTimeMinutes = 1;
      this.setupKickoff('away');
      return;
    }

    if (this.half === 4 && this.matchMinute >= 120 + this.addedTimeMinutes) {
      if (this.homeScore === this.awayScore && canPenalties) {
        this.startPenaltyShootout();
      } else {
        this.phase = 'fulltime';
        this.onSound?.('whistle_fulltime');
        this.onCommentary?.({
          type: 'fulltime',
          teamName: this.homeTeam.name,
          opponentName: this.awayTeam.name,
          homeScore: this.homeScore,
          awayScore: this.awayScore,
        });
      }
    }
  }

  public resumeFromBreak(): void {
    if (this.phase === 'halftime') {
      this.setupKickoff('away');
      this.onCommentary?.({
        type: 'second_half',
        teamName: this.homeTeam.name,
        opponentName: this.awayTeam.name,
      });
    } else if (this.phase === 'extratime_break') {
      this.setupKickoff('home');
    }
  }

  private toAINode(p: MatchPlayerState & { aiState?: AIPlayerState }): AIPlayerNode {
    const form = getFormation(p.side === 'home' ? this.homeFormationId : this.awayFormationId);
    const slot = form.slots[p.slotIndex] ?? form.slots[0];
    const baseX =
      p.side === 'home'
        ? slot.x * PITCH.LENGTH * 0.85
        : PITCH.LENGTH - slot.x * PITCH.LENGTH * 0.85;
    const baseY = slot.y * PITCH.WIDTH;

    return {
      id: p.id,
      team: p.side,
      role: mapRoleCategory(p.player.position),
      x: p.x,
      y: p.y,
      vx: p.vx,
      vy: p.vy,
      baseX,
      baseY,
      stamina: p.stamina,
      hasBall: this.ball.ownerId === p.id,
      overall: p.player.overall,
      pace: p.player.attributes.pace,
      shooting: p.player.attributes.finishing,
      passing: p.player.attributes.shortPassing,
      dribbling: p.player.attributes.dribbling,
      defending: p.player.attributes.tackling,
      physical: p.player.attributes.strength,
      aiState: p.aiState,
    };
  }

  private stepUserAndAI(dt: number): void {
    const profile = getDifficultyProfile(this.difficulty);
    const homeTeamDiff = this.homeScore - this.awayScore;
    const effectiveHomeTactic =
      this.userSide === 'home'
        ? this.homeTactic
        : chooseAdaptiveTactic(this.homeTactic, homeTeamDiff, this.matchMinute, profile);
    const effectiveAwayTactic =
      this.userSide === 'away' || this.twoPlayerMode
        ? this.awayTactic
        : chooseAdaptiveTactic(this.awayTactic, -homeTeamDiff, this.matchMinute, profile);

    this.aiTimer -= dt;
    const refreshAI = this.aiTimer <= 0;
    if (refreshAI) {
      this.aiTimer = profile.reactionDelaySec;
    }

    if (this.userInput.switchPressed) {
      this.userInput.switchPressed = false;
      this.switchToNextBestUserPlayer(this.userSide === 'away' ? 'away' : 'home');
    }
    if (this.twoPlayerMode && this.userInput2.switchPressed) {
      this.userInput2.switchPressed = false;
      this.switchToNextBestUserPlayer('away');
    }

    const owner = this.players.find((p) => p.id === this.ball.ownerId) ?? null;
    const activePlayers = this.players.filter((p) => !p.redCard);
    const homeNodes = activePlayers.filter((p) => p.side === 'home').map((p) => this.toAINode(p));
    const awayNodes = activePlayers.filter((p) => p.side === 'away').map((p) => this.toAINode(p));
    const nodeById = new Map<string, AIPlayerNode>();
    for (const n of homeNodes) nodeById.set(n.id, n);
    for (const n of awayNodes) nodeById.set(n.id, n);

    const ballInfo = {
      x: this.ball.x,
      y: this.ball.y,
      z: this.ball.z,
      vx: this.ball.vx,
      vy: this.ball.vy,
      vz: this.ball.vz,
      spin: this.ball.spin,
      ownerTeam: owner?.side ?? this.ball.lastTouchTeam,
      ownerId: owner?.id ?? null,
    };

    // Evaluar el "Cerebro Táctico" (Team Brain) de cada equipo en ticks alternados (~30Hz) o en refreshAI
    this.offBallCacheTick = (this.offBallCacheTick + 1) % 2;
    const refreshOffBall = refreshAI || this.offBallCacheTick === 0 || !this.homeBrainState || !this.awayBrainState;
    if (refreshOffBall) {
      this.homeBrainState = evaluateTeamBrain(
        'home',
        homeNodes,
        awayNodes,
        ballInfo,
        homeTeamDiff,
        this.matchMinute,
        profile
      );
      this.awayBrainState = evaluateTeamBrain(
        'away',
        awayNodes,
        homeNodes,
        ballInfo,
        -homeTeamDiff,
        this.matchMinute,
        profile
      );
    }

    const lookAtBall = { x: this.ball.x, y: this.ball.y };
    const baseLivePaceBoost = 1.24;

    for (const p of this.players) {
      if (p.redCard) continue;

      const isUser1Controlled = p.id === this.activeUserPlayerId && this.userSide === p.side;
      const isUser2Controlled =
        this.twoPlayerMode && p.side === 'away' && p.id === this.activeUser2PlayerId;
      const isUserControlled = isUser1Controlled || isUser2Controlled;
      const hasBall = this.ball.ownerId === p.id;

      // Multiplicador de velocidad en partido: ritmo ágil (1.24x base) + ventaja de IA en dificultades altas
      const isRivalAI =
        p.side !== this.userSide && !(this.twoPlayerMode && p.side === 'away');
      const speedMult = baseLivePaceBoost * (isRivalAI ? profile.aiSpeedMultiplier : 1.0);

      // Si el jugador está barriéndose en este momento (solo cuando el usuario presionó el botón de barrer), evaluar robo continuo
      if (p.slideTimer > 0.04) {
        if (this.rng() < 0.45) {
          this.emitParticles(p.x, p.y, 0.02, 1, 'turf');
        }
        if (!p.slideHitResolved) {
          const currentCarrier = this.players.find((o) => o.id === this.ball.ownerId) ?? null;
          if (
            currentCarrier &&
            currentCarrier.side !== p.side &&
            Math.hypot(currentCarrier.x - p.x, currentCarrier.y - p.y) < 2.28
          ) {
            p.slideHitResolved = true;
            this.attemptTackle(p, currentCarrier, true);
          } else if (
            !this.ball.ownerId &&
            this.ball.z < 0.85 &&
            Math.hypot(this.ball.x - p.x, this.ball.y - p.y) < 1.85
          ) {
            p.slideHitResolved = true;
            const pStats = p.side === 'home' ? this.homeStats : this.awayStats;
            pStats.tackles++;
            this.ball.ownerId = p.id;
            this.ball.vx = p.vx * 0.6;
            this.ball.vy = p.vy * 0.6;
            this.ball.vz = 0;
            this.ball.z = 0;
            this.ball.lastTouchTeam = p.side;
            this.ball.lastTouchPlayerId = p.id;
            this.ball.lastTouchPlayerName = p.player.name;
            this.pendingPassCheck = null;
            this.onSound?.('kick_light');
            this.emitParticles(p.x, p.y, 0.04, 6, 'turf');
            if (p.side === this.userSide) {
              this.activeUserPlayerId = p.id;
            } else if (this.twoPlayerMode && p.side === 'away') {
              this.activeUser2PlayerId = p.id;
            }
          }
        }
      }

      if (isUserControlled) {
        p.aiState = hasBall ? 'WITH_BALL' : 'PRESSING';
        this.handleUserControlledPlayer(
          p,
          hasBall,
          dt,
          baseLivePaceBoost,
          isUser2Controlled ? this.userInput2 : this.userInput,
          isUser2Controlled
        );
        continue;
      }

      const myNode = nodeById.get(p.id) ?? this.toAINode(p);
      const myTeamNodes = p.side === 'home' ? homeNodes : awayNodes;
      const oppTeamNodes = p.side === 'home' ? awayNodes : homeNodes;
      const myBrain = p.side === 'home' ? this.homeBrainState : this.awayBrainState;
      const tacticCat = mapTacticCategory(
        p.side === 'home' ? effectiveHomeTactic : effectiveAwayTactic
      );

      // PORTERO (Advanced Goalkeeper AI)
      if (p.player.position === 'GK') {
        const gkAI = computeGoalkeeperAI(myNode, ballInfo, oppTeamNodes, profile);
        const dx = gkAI.targetX - p.x;
        const dy = gkAI.targetY - p.y;
        const d = Math.hypot(dx, dy);
        const mx = d > 0.2 ? dx / d : 0;
        const my = d > 0.2 ? dy / d : 0;

        if (gkAI.diveDirection !== 'none' && p.diveTimer <= 0) {
          p.diveTimer = 0.64;
          p.gkAction = 'dive_save';
          p.diveDirY =
            gkAI.diveDirection === 'left' ? -1 : gkAI.diveDirection === 'right' ? 1 : 0;
          // Impulso lateral explosivo para cubrir el arco amplio de 9.8m
          if (gkAI.diveSpeedY) {
            p.vy = gkAI.diveSpeedY;
            p.vx = (p.side === 'home' ? 1 : -1) * 1.4;
          }
        } else if (gkAI.sprint && d > 1.4) {
          p.gkAction = 'rush_out';
        }

        stepPlayerMovement(
          p,
          mx,
          my,
          gkAI.sprint,
          hasBall,
          dt,
          this.settings.match.pitchCondition,
          speedMult * 1.08,
          lookAtBall
        );

        if (hasBall) {
          // El portero retiene brevemente mientras ambos equipos suben hacia mitad de cancha y luego distribuye solo
          if (p.aiHoldTimer && p.aiHoldTimer > 0) {
            p.aiHoldTimer = Math.max(0, p.aiHoldTimer - dt);
            p.gkAction = 'idle';
            continue;
          }
          p.gkAction = 'distribute';
          let bestReceiver: AIPlayerNode | null = null;
          let bestRecScore = -Infinity;
          const dir = p.side === 'home' ? 1 : -1;
          for (const m of myTeamNodes) {
            if (m.role === 'GK') continue;
            const distFromGk = Math.hypot(m.x - p.x, m.y - p.y);
            if (distFromGk < 14 || distFromGk > 62) continue;
            let nearestOppToMate = Infinity;
            for (const o of oppTeamNodes) {
              const od = Math.hypot(o.x - m.x, o.y - m.y);
              if (od < nearestOppToMate) nearestOppToMate = od;
            }
            const score = nearestOppToMate * 2.8 + (m.x - p.x) * dir * 0.55;
            if (score > bestRecScore) {
              bestRecScore = score;
              bestReceiver = m;
            }
          }
          const tx = bestReceiver ? bestReceiver.x : PITCH.HALF_X;
          const ty = bestReceiver ? bestReceiver.y : PITCH.HALF_Y;
          this.performPass(p, tx, ty, false, 0.85);
        }
        continue;
      }

      // JUGADOR DE CAMPO CON BALÓN (Estado 'WITH_BALL')
      if (hasBall) {
        p.aiState = 'WITH_BALL';
        if (p.aiHoldTimer && p.aiHoldTimer > 0) {
          p.aiHoldTimer = Math.max(0, p.aiHoldTimer - dt);
        }

        const decision =
          refreshAI || !this.cachedCarrierDecisions.has(p.id)
            ? computeOutfieldCarrierDecision(
                myNode,
                myTeamNodes,
                oppTeamNodes,
                profile,
                tacticCat
              )
            : this.cachedCarrierDecisions.get(p.id)!;
        this.cachedCarrierDecisions.set(p.id, decision);

        // Detectar presión inmediata para decidir entre amague/regate 1v1 o soltar rápido
        let nearestOppDist = Infinity;
        for (const opp of oppTeamNodes) {
          const od = Math.hypot(opp.x - p.x, opp.y - p.y);
          if (od < nearestOppDist) nearestOppDist = od;
        }

        // Si el jugador IA tiene alta habilidad y un defensor se acerca a 2.3-4.0m, ejecutar amague/recorte 1v1
        const canDoSkillFeint =
          nearestOppDist > 1.8 &&
          nearestOppDist < 4.0 &&
          (p.player.attributes.dribbling >= 76 || profile.skillMoveFreq > 0.65) &&
          (!p.feintTimer || p.feintTimer <= 0) &&
          this.rng() < 0.08 + profile.skillMoveFreq * 0.14;

        if (canDoSkillFeint) {
          p.feintTimer = 0.28;
          p.animState = 'feint';
        }

        const dx = decision.targetX - p.x;
        const dy = decision.targetY - p.y;
        const d = Math.max(0.01, Math.hypot(dx, dy));

        stepPlayerMovement(
          p,
          dx / d,
          dy / d,
          decision.sprint || nearestOppDist > 3.5,
          true,
          dt,
          this.settings.match.pitchCondition,
          speedMult,
          { x: decision.targetX, y: decision.targetY }
        );

        const oppGoalX = p.side === 'home' ? PITCH.LENGTH : 0;
        const distToOppGoal = Math.hypot(oppGoalX - p.x, PITCH.HALF_Y - p.y);
        const holdExpired = (p.aiHoldTimer ?? 0) <= 0 || nearestOppDist < 2.15 || distToOppGoal < 19.5;

        if (decision.action === 'shoot') {
          this.performShot(p, decision.targetX, decision.targetY, decision.power);
        } else if ((decision.action === 'pass' || decision.action === 'through') && holdExpired) {
          this.performPass(p, decision.targetX, decision.targetY, decision.action === 'through');
        } else if (decision.action === 'cross' && holdExpired) {
          this.kickBallToward(
            p,
            decision.targetX,
            decision.targetY,
            22.5,
            7.4,
            false,
            'globo'
          );
        }
      } else {
        // JUGADOR DE CAMPO SIN BALÓN (Estados: 'OFF_BALL_ATTACK', 'DEFENDING_MARK', 'PRESSING', 'COVERING_SPACE', 'RECOVERING_POS')
        const userPressOverride =
          ((p.side === this.userSide && this.userInput.pressHeld) ||
            (this.twoPlayerMode && p.side === 'away' && this.userInput2.pressHeld)) &&
          p.id === myBrain?.primaryPresserId;

        const cachedOff = this.cachedOffBallDecisions.get(p.id);
        const offBall =
          refreshOffBall || !cachedOff
            ? computeOffBallMovement(
                myNode,
                myTeamNodes,
                oppTeamNodes,
                ballInfo,
                profile,
                tacticCat,
                myBrain ?? undefined
              )
            : cachedOff;
        if (refreshOffBall || !cachedOff) {
          this.cachedOffBallDecisions.set(p.id, offBall);
        }

        p.aiState = userPressOverride ? 'PRESSING' : offBall.desiredState;
        p.callingForBall =
          p.aiState === 'OFF_BALL_ATTACK' &&
          (myBrain?.giveAndGoRunnerId === p.id ||
            myBrain?.thirdManRunnerId === p.id ||
            myBrain?.overlapFullbackId === p.id);

        const dx = offBall.targetX - p.x;
        const dy = offBall.targetY - p.y;
        const d = Math.hypot(dx, dy);

        if (d > 0.35) {
          stepPlayerMovement(
            p,
            dx / d,
            dy / d,
            offBall.sprint || userPressOverride,
            false,
            dt,
            this.settings.match.pitchCondition,
            speedMult,
            lookAtBall
          );
        } else {
          stepPlayerMovement(
            p,
            0,
            0,
            false,
            false,
            dt,
            this.settings.match.pitchCondition,
            speedMult,
            lookAtBall
          );
        }

        // Quite limpio de pie con un solo pie (standing tackle poke):
        // En modo entrenamiento (passiveRivalAI), la defensa es pasiva para permitir practicar controles, regates y remates.
        if (
          !this.modeConfig.passiveRivalAI &&
          owner &&
          owner.side !== p.side &&
          p.tackleCooldown <= 0 &&
          p.slideTimer <= 0
        ) {
          const distToCarrier = Math.hypot(owner.x - p.x, owner.y - p.y);
          const tackleReach = isRivalAI && profile.level >= 7 ? 1.92 : 1.65;
          if (distToCarrier < tackleReach) {
            const tackleTriggerChance =
              isRivalAI && profile.level >= 7
                ? 0.88
                : 0.24 + profile.pressingIntensity * 0.38;
            if (this.rng() < tackleTriggerChance || userPressOverride) {
              this.initiateStandingTackle(p, owner);
            }
          }
        }
      }
    }

    // Colisiones físicas entre jugadores con peso, inercia, forcejeo y robo hombro con hombro (sin cobrar faltas por roce)
    const colRes = resolvePlayerCollisions(this.players, this.ball.ownerId, this.rng);
    if (colRes.hadHardBodyClash) {
      this.onSound?.('body_clash');
    }
    if (colRes.dispossessedCarrierId && colRes.newOwnerId) {
      const winner = this.players.find((p) => p.id === colRes.newOwnerId);
      if (winner) {
        const wStats = winner.side === 'home' ? this.homeStats : this.awayStats;
        wStats.tackles++;
        winner.standingTackleTimer = 0.26;
        winner.animState = 'standing_tackle';
        this.ball.ownerId = winner.id;
        this.ball.lastTouchTeam = winner.side;
        this.ball.lastTouchPlayerId = winner.id;
        this.ball.lastTouchPlayerName = winner.player.name;
        this.pendingPassCheck = null;
        this.emitParticles(winner.x, winner.y, 0.05, 5, 'dust');
        if (winner.side === this.userSide) {
          this.activeUserPlayerId = winner.id;
        } else if (this.twoPlayerMode && winner.side === 'away') {
          this.activeUser2PlayerId = winner.id;
        }
      }
    }
  }

  /**
   * Quite de pie estirando un solo pie para sacar la pelota limpiamente sin tirarse al piso.
   */
  public initiateStandingTackle(p: MatchPlayerState, targetCarrier?: MatchPlayerState | null): void {
    const targetX = targetCarrier ? this.ball.x : this.ball.x + this.ball.vx * 0.08;
    const targetY = targetCarrier ? this.ball.y : this.ball.y + this.ball.vy * 0.08;
    const dx = targetX - p.x;
    const dy = targetY - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.05) {
      p.facing = Math.atan2(dy, dx);
    }
    p.standingTackleTimer = 0.32;
    p.tackleCooldown = 0.52;
    p.animState = 'standing_tackle';
    // Pequeño paso hacia el balón con el pie extendido
    if (dist > 0.1 && dist < 2.2) {
      p.vx += (dx / dist) * 2.2;
      p.vy += (dy / dist) * 2.2;
    }
    if (targetCarrier) {
      this.attemptTackle(p, targetCarrier, false);
    } else if (!this.ball.ownerId && dist < 1.85 && this.ball.z < 1.1) {
      const pStats = p.side === 'home' ? this.homeStats : this.awayStats;
      pStats.tackles++;
      this.ball.ownerId = p.id;
      this.ball.vx = p.vx;
      this.ball.vy = p.vy;
      this.ball.vz = 0;
      this.ball.z = 0;
      this.ball.lastTouchTeam = p.side;
      this.ball.lastTouchPlayerId = p.id;
      this.ball.lastTouchPlayerName = p.player.name;
      this.pendingPassCheck = null;
      this.onSound?.('kick_light');
      if (p.side === this.userSide) {
        this.activeUserPlayerId = p.id;
      } else if (this.twoPlayerMode && p.side === 'away') {
        this.activeUser2PlayerId = p.id;
      }
    }
  }

  /**
   * Inicia una barrida física con gran desplazamiento a ras de césped (5.5 a 7.0 metros).
   * SOLO se ejecuta cuando el jugador presiona explícitamente el botón de barrer.
   */
  public initiateSlideTackle(
    p: MatchPlayerState,
    aimDirX?: number,
    aimDirY?: number
  ): void {
    const inputMag = Math.hypot(aimDirX ?? 0, aimDirY ?? 0);
    let slideAngle = p.facing;
    if (inputMag > 0.15) {
      slideAngle = Math.atan2(aimDirY!, aimDirX!);
    } else {
      const distToBall = Math.hypot(this.ball.x - p.x, this.ball.y - p.y);
      if (distToBall > 0.2 && distToBall < 11.5) {
        slideAngle = Math.atan2(
          this.ball.y + this.ball.vy * 0.12 - p.y,
          this.ball.x + this.ball.vx * 0.12 - p.x
        );
      }
    }

    const paceBonus = (p.player.attributes.pace / 100) * 1.6;
    const lungeSpeed = 13.6 + paceBonus;
    p.facing = slideAngle;
    p.slideTimer = 0.62;
    p.slideHitResolved = false;
    p.tackleCooldown = 0.82;
    p.animState = 'slide';
    p.leanForward = -0.96;
    p.vx = Math.cos(slideAngle) * lungeSpeed;
    p.vy = Math.sin(slideAngle) * lungeSpeed;
    this.onSound?.('footstep_grass');
    this.emitParticles(p.x, p.y, 0.03, 12, 'turf');
  }

  private handleUserControlledPlayer(
    p: MatchPlayerState,
    hasBall: boolean,
    dt: number,
    paceMult = 1.24,
    input: UserInputState = this.userInput,
    isPlayer2 = false
  ): void {
    // Procesar barrida (SOLO con slidePressed) o quite con un solo pie (con tacklePressed) ANTES de stepPlayerMovement
    if (!hasBall && (input.slidePressed || input.tacklePressed)) {
      const isSlide = input.slidePressed;
      input.slidePressed = false;
      input.tacklePressed = false;
      if (p.tackleCooldown <= 0 && p.slideTimer <= 0) {
        const oppCarrier = this.players.find(
          (o) =>
            o.side !== p.side &&
            o.id === this.ball.ownerId &&
            Math.hypot(o.x - p.x, o.y - p.y) < (isSlide ? 2.35 : 1.85)
        );
        if (isSlide) {
          this.initiateSlideTackle(p, input.moveX, input.moveY);
          if (oppCarrier) {
            p.slideHitResolved = true;
            this.attemptTackle(p, oppCarrier, true);
          }
        } else {
          this.initiateStandingTackle(p, oppCarrier ?? null);
        }
      }
    }

    // Al pulsar el botón de esprintar, el jugador corre de verdad con aceleración y velocidad explosiva (+44% boost en partido)
    const effectiveUserPaceMult = input.sprint ? paceMult * 1.44 : paceMult;

    stepPlayerMovement(
      p,
      input.moveX,
      input.moveY,
      input.sprint,
      hasBall,
      dt,
      this.settings.match.pitchCondition,
      effectiveUserPaceMult,
      { x: this.ball.x, y: this.ball.y }
    );

    if (input.sprint && (Math.abs(input.moveX) > 0.1 || Math.abs(input.moveY) > 0.1)) {
      p.animState = 'sprint';
      p.leanForward = Math.max(p.leanForward ?? 0, 0.22);
    }

    const speed = Math.hypot(p.vx, p.vy);
    if (speed > 3.6) {
      this.onSound?.('footstep_grass');
      if (input.sprint && this.rng() < 0.32) {
        this.emitParticles(p.x, p.y, 0.02, 2, 'turf');
      }
    }

    if (hasBall) {
      const currentTargetId = isPlayer2 ? this.targetedPassMateId2 : this.targetedPassMateId;
      if (this.offBallCacheTick === 0 || !currentTargetId) {
        const previewTarget = this.findPassTargetForUser(p, false, input);
        if (isPlayer2) {
          this.targetedPassMateId2 = previewTarget.mateId;
        } else {
          this.targetedPassMateId = previewTarget.mateId;
        }
      }

      if (input.skillMovePressed) {
        input.skillMovePressed = false;
        this.triggerSkillMove(p.side);
      } else if (input.shootReleased) {
        input.shootReleased = false;
        const oppGoalX = p.side === 'home' ? PITCH.LENGTH : 0;
        const aimOffsetY = this.settings.controls.shotAssist
          ? input.moveY * 3.1
          : input.moveY * 5.2;
        const curveSpin =
          input.curveInput !== undefined && Math.abs(input.curveInput) > 0.05
            ? input.curveInput
            : -input.moveY;
        this.performShot(p, oppGoalX, PITCH.HALF_Y + aimOffsetY, input.shootPower, curveSpin);
      } else if (input.passPressed) {
        input.passPressed = false;
        const target = this.findPassTargetForUser(p, false, input);
        this.performPass(p, target.x, target.y, false, input.passPower ?? 0.65);
      } else if (input.throughPressed) {
        input.throughPressed = false;
        const target = this.findPassTargetForUser(p, true, input);
        this.performPass(p, target.x, target.y, true, input.throughPower ?? 0.72);
      } else if (input.crossPressed) {
        input.crossPressed = false;
        const pwr = Math.max(0.28, Math.min(1.0, input.crossPower ?? 0.75));
        const oppBoxX = p.side === 'home' ? PITCH.LENGTH - 10 : 10;
        this.kickBallToward(
          p,
          oppBoxX,
          PITCH.HALF_Y + input.moveY * 5,
          17.5 + pwr * 8.0,
          5.6 + pwr * 3.2,
          false,
          'globo'
        );
        this.ball.spin = (-input.moveY || 0.45) * 1.85;
      }
    } else if (isPlayer2) {
      this.targetedPassMateId2 = null;
    } else {
      this.targetedPassMateId = null;
    }

    input.passPressed = false;
    input.throughPressed = false;
    input.crossPressed = false;
    input.shootReleased = false;
    input.skillMovePressed = false;
  }

  /**
   * Ejecuta un regate especial (Bicicleta, Amague de cuerpo o Sombrerito) según la dirección del joystick,
   * otorgando una ventana de evasión sobre los defensores cercanos.
   */
  public triggerSkillMove(side?: 'home' | 'away', preferredType?: SkillMoveType): boolean {
    const targetSide = side ?? (this.userSide === 'away' ? 'away' : 'home');
    const carrier =
      this.players.find((p) => p.id === this.ball.ownerId && p.side === targetSide) ??
      this.players.find(
        (p) =>
          p.id ===
          (targetSide === 'away' && this.twoPlayerMode
            ? this.activeUser2PlayerId
            : this.activeUserPlayerId)
      );
    if (!carrier || carrier.redCard) return false;

    const input = targetSide === 'away' && this.twoPlayerMode ? this.userInput2 : this.userInput;
    const attackDir = carrier.side === 'home' ? 1 : -1;

    let skillType: SkillMoveType = preferredType ?? 'bicicleta';
    if (!preferredType) {
      if (Math.abs(input.moveY) > 0.55) {
        skillType = 'amague';
      } else if (input.moveX * attackDir > 0.65 && carrier.player.attributes.dribbling >= 78) {
        skillType = 'sombrerito';
      } else {
        skillType = 'bicicleta';
      }
    }

    carrier.feintTimer = 0.48;
    carrier.animState = 'feint';
    const burstAngle =
      Math.hypot(input.moveX, input.moveY) > 0.15
        ? Math.atan2(input.moveY, input.moveX)
        : carrier.facing + (skillType === 'amague' ? 0.45 : 0);

    carrier.facing = burstAngle;
    carrier.vx = Math.cos(burstAngle) * 7.8;
    carrier.vy = Math.sin(burstAngle) * 7.8;

    if (skillType === 'sombrerito' && this.ball.ownerId === carrier.id) {
      this.ball.z = 0.68;
      this.ball.vz = 2.4;
    }

    // Ventana de evasión: desequilibra al defensor rival más cercano en un radio de 2.8m
    for (const opp of this.players) {
      if (opp.side === carrier.side || opp.redCard || opp.player.position === 'GK') continue;
      const d = Math.hypot(opp.x - carrier.x, opp.y - carrier.y);
      if (d < 2.8) {
        opp.stunTimer = Math.max(opp.stunTimer, 0.58);
        opp.tackleCooldown = Math.max(opp.tackleCooldown, 0.65);
      }
    }

    const label =
      skillType === 'bicicleta'
        ? 'Bicicleta'
        : skillType === 'sombrerito'
        ? 'Sombrerito'
        : 'Amague Rápido';
    this.lastSkillMove = {
      playerId: carrier.id,
      playerName: carrier.player.name,
      type: skillType,
      label,
      timer: 1.1,
    };
    this.showBanner(`✨ ${label} · ${carrier.player.name}`);
    this.emitParticles(carrier.x, carrier.y, 0.03, 6, 'turf');
    this.onSound?.('footstep_grass');
    this.onCommentary?.({
      type: 'dribble_encara',
      playerName: carrier.player.name,
      teamName: carrier.side === 'home' ? this.homeTeam.name : this.awayTeam.name,
    });
    return true;
  }

  private findPassTargetForUser(
    passer: MatchPlayerState,
    through: boolean,
    input: UserInputState = this.userInput
  ): { x: number; y: number; mateId: string | null } {
    const hasStickAim = Math.abs(input.moveX) + Math.abs(input.moveY) > 0.14;
    const dirX = hasStickAim ? input.moveX : Math.cos(passer.facing);
    const dirY = hasStickAim ? input.moveY : Math.sin(passer.facing);
    const dirMag = Math.max(0.01, Math.hypot(dirX, dirY));
    const ux = dirX / dirMag;
    const uy = dirY / dirMag;
    const attackDir = passer.side === 'home' ? 1 : -1;

    let bestMate: MatchPlayerState | null = null;
    let bestScore = -999;
    let bestLeadX = 0;
    let bestLeadY = 0;

    const opponents = this.players.filter((o) => o.side !== passer.side && !o.redCard);

    for (const m of this.players) {
      if (m.side !== passer.side || m.id === passer.id || m.redCard) continue;
      const leadX = through
        ? Math.max(3, Math.min(PITCH.LENGTH - 3, m.x + attackDir * (6.2 + (m.player.attributes.pace / 100) * 2.4) + m.vx * 0.35))
        : m.x + m.vx * 0.22;
      const leadY = Math.max(3, Math.min(PITCH.WIDTH - 3, m.y + m.vy * 0.28));

      const dx = leadX - passer.x;
      const dy = leadY - passer.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 2.0 || dist > 58) continue;

      const dot = (dx / dist) * ux + (dy / dist) * uy;
      if (hasStickAim && dot < -0.15) continue;

      // Evaluar si algún rival bloquea la línea de pase
      let laneBlockPenalty = 0;
      for (const opp of opponents) {
        const ox = opp.x - passer.x;
        const oy = opp.y - passer.y;
        const proj = (ox * dx + oy * dy) / (dist * dist);
        if (proj > 0.12 && proj < 0.92) {
          const perpDist = Math.abs(ox * (-dy / dist) + oy * (dx / dist));
          if (perpDist < 1.65) {
            laneBlockPenalty += (1.65 - perpDist) * 4.5;
          }
        }
      }

      const assistWeight = this.settings.controls.passAssist ? 30 : 18;
      const callBonus = m.callingForBall ? 5.2 : 0;
      const forwardBonus = through ? ((leadX - passer.x) * attackDir) * 0.24 : 0;
      const score = dot * assistWeight - dist * 0.21 + callBonus + forwardBonus - laneBlockPenalty;
      if (score > bestScore) {
        bestScore = score;
        bestMate = m;
        bestLeadX = leadX;
        bestLeadY = leadY;
      }
    }

    if (bestMate && bestScore > -5) {
      return {
        x: bestLeadX,
        y: bestLeadY,
        mateId: bestMate.id,
      };
    }
    return {
      x: Math.max(2, Math.min(PITCH.LENGTH - 2, passer.x + ux * (through ? 22 : 15))),
      y: Math.max(2, Math.min(PITCH.WIDTH - 2, passer.y + uy * (through ? 22 : 15))),
      mateId: null,
    };
  }

  /**
   * PASE RASO / FILTRADO / CAMBIO DE FRENTE: Velocidad real calibrada entre 15 y 25 m/s
   * con dispersión realista según atributos, ángulo corporal, fatiga y presión rival.
   */
  private performPass(
    passer: MatchPlayerState,
    targetX: number,
    targetY: number,
    isThrough: boolean,
    powerRatio = 0.68
  ): void {
    const stats = passer.side === 'home' ? this.homeStats : this.awayStats;
    stats.passesAttempted++;

    if (this.settings.match.offsideEnabled && this.mode !== 'training') {
      const attackDir = passer.side === 'home' ? 1 : -1;
      const offsideSet = new Set<string>();
      for (const mate of this.players) {
        if (
          mate.side === passer.side &&
          !mate.redCard &&
          isPlayerOffside(mate, passer, this.ball.x, this.players, attackDir)
        ) {
          offsideSet.add(mate.id);
        }
      }
      this.pendingPassCheck = {
        passerId: passer.id,
        side: passer.side,
        ballX: this.ball.x,
        offsideTargets: offsideSet,
      };
    }

    const passSkill =
      (isThrough
        ? passer.player.attributes.vision * 0.55 + passer.player.attributes.shortPassing * 0.45
        : passer.player.attributes.shortPassing * 0.7 + passer.player.attributes.vision * 0.3) / 100;
    const dist = Math.hypot(targetX - passer.x, targetY - passer.y);
    const clampedPower = Math.max(0.25, Math.min(1.0, powerRatio));

    // Calcular presión defensiva y ángulo corporal para errores realistas tipo FIFA
    let nearestOppDist = Infinity;
    for (const o of this.players) {
      if (o.side === passer.side || o.redCard) continue;
      const od = Math.hypot(o.x - passer.x, o.y - passer.y);
      if (od < nearestOppDist) nearestOppDist = od;
    }
    const passAngle = Math.atan2(targetY - passer.y, targetX - passer.x);
    const bodyAngleDiff = Math.abs(
      Math.atan2(Math.sin(passAngle - passer.facing), Math.cos(passAngle - passer.facing))
    );
    const pressurePenalty = nearestOppDist < 1.9 ? (1.9 - nearestOppDist) * 0.75 : 0;
    const bodyPenalty = bodyAngleDiff > 1.35 ? (bodyAngleDiff - 1.35) * 0.55 : 0;
    const fatiguePenalty = passer.stamina < 35 ? (35 - passer.stamina) * 0.025 : 0;

    const isRivalAI =
      passer.side !== this.userSide && !(this.twoPlayerMode && passer.side === 'away');
    const profile = getDifficultyProfile(this.difficulty);
    const errorScale = isRivalAI ? Math.min(1.0, profile.passErrorMeters / 3.0) : 0.35;
    const maxSpreadMeters = ((1 - passSkill) * 1.9 + pressurePenalty + bodyPenalty + fatiguePenalty) * errorScale;

    const finalTargetX = Math.max(1.5, Math.min(PITCH.LENGTH - 1.5, targetX + (this.rng() - 0.5) * maxSpreadMeters));
    const finalTargetY = Math.max(1.5, Math.min(PITCH.WIDTH - 1.5, targetY + (this.rng() - 0.5) * maxSpreadMeters));

    // Velocidad estrictamente en el rango 15 a 25 m/s modulada por el medidor de fuerza
    const speed = Math.min(
      PHYSICS_TUNING.PASS_SPEED_MAX_MPS,
      Math.max(
        PHYSICS_TUNING.PASS_SPEED_MIN_MPS,
        15.2 + dist * 0.17 + passSkill * 2.4 + (clampedPower - 0.5) * 5.4
      )
    );
    const isLongLob = dist > 28 || clampedPower > 0.9;
    passer.animState = 'pass';
    this.kickBallToward(
      passer,
      finalTargetX,
      finalTargetY,
      speed,
      isLongLob ? 4.4 + clampedPower * 1.4 : isThrough ? 1.05 + clampedPower * 0.45 : 0.28,
      true,
      isLongLob ? 'globo' : 'raso'
    );
    const pTeam = passer.side === 'home' ? this.homeTeam.name : this.awayTeam.name;
    this.onCommentary?.({
      type: isThrough ? 'through_pass' : 'pass',
      playerName: passer.player.name,
      teamName: pTeam,
    });
  }

  /**
   * TIRO AL ARCO (Colocado con efecto, potente, raso, de primera, volea o cabezazo):
   * Velocidad real calibrada entre 25 y 33 m/s con precisión dependiente de atributos, ángulo, fatiga y presión rival.
   */
  private performShot(
    shooter: MatchPlayerState,
    goalX: number,
    targetY: number,
    power: number,
    directionalCurveInput?: number
  ): void {
    const stats = shooter.side === 'home' ? this.homeStats : this.awayStats;
    stats.shots++;
    this.pendingPassCheck = null;
    this.advantageState = null;

    const finishAttr = shooter.player.attributes.finishing / 100;
    const powerAttr = shooter.player.attributes.shotPower / 100;
    const accuracyAttr = shooter.player.attributes.accuracy / 100;
    const headingAttr = shooter.player.attributes.heading / 100;
    const fatiguePenalty = shooter.stamina < 40 ? (40 - shooter.stamina) * 0.038 : 0;

    // Presión defensiva cercana sobre el rematador
    let nearestDefDist = Infinity;
    for (const o of this.players) {
      if (o.side === shooter.side || o.redCard) continue;
      const od = Math.hypot(o.x - shooter.x, o.y - shooter.y);
      if (od < nearestDefDist) nearestDefDist = od;
    }
    const pressurePenalty = nearestDefDist < 1.85 ? (1.85 - nearestDefDist) * 0.65 : 0;

    const isHeader = this.ball.z > 1.18;
    const isVolley = !isHeader && this.ball.z > 0.32;
    const goalAngle = Math.atan2(targetY - shooter.y, goalX - shooter.x);
    const bodyToGoalAngle = Math.abs(
      Math.atan2(Math.sin(goalAngle - shooter.facing), Math.cos(goalAngle - shooter.facing))
    );
    const bodyAnglePenalty = bodyToGoalAngle > 1.25 ? (bodyToGoalAngle - 1.25) * 0.55 : 0;
    const isChilena = isVolley && this.ball.z > 0.78 && bodyToGoalAngle > 1.15;
    const isRabona =
      !isHeader &&
      !isVolley &&
      shooter.player.attributes.dribbling >= 80 &&
      bodyToGoalAngle > 0.85 &&
      power >= 0.55;

    // Disparo colocado ('curva' a media potencia 0.48..0.78) vs potente ('curva'/'raso' > 0.78) vs raso (< 0.48)
    const isPlacedFinesseShot = !isHeader && !isVolley && power >= 0.48 && power <= 0.78;
    const strikeType: StrikeType = isHeader
      ? 'cabezazo'
      : isChilena
      ? 'chilena'
      : isVolley
      ? 'volea'
      : isRabona
      ? 'rabona'
      : power < 0.48
      ? 'raso'
      : 'curva';

    const skillFactor = isHeader ? headingAttr : finishAttr * 0.55 + accuracyAttr * 0.45;
    const isRivalAI =
      shooter.side !== this.userSide && !(this.twoPlayerMode && shooter.side === 'away');
    const isExtremeRivalAI = isRivalAI && this.difficulty >= 7;
    const aiAccuracyScale = isExtremeRivalAI
      ? 0.008
      : isRivalAI
      ? Math.min(1.0, getDifficultyProfile(this.difficulty).shotErrorMeters / 3.2)
      : isPlacedFinesseShot
      ? 0.72
      : 1.0;

    // En dificultad máxima, el rival apunta milimétricamente al poste más lejano del arquero del usuario (99% efectividad)
    let effectiveTargetY = targetY;
    if (isExtremeRivalAI) {
      const oppGk = this.players.find((p) => p.side !== shooter.side && p.player.position === 'GK');
      const gkY = oppGk ? oppGk.y : PITCH.HALF_Y;
      const lethalCornerMargin = Math.max(3.6, PITCH.GOAL_HALF - 0.42);
      effectiveTargetY =
        gkY >= PITCH.HALF_Y
          ? PITCH.HALF_Y - lethalCornerMargin
          : PITCH.HALF_Y + lethalCornerMargin;
    }

    // Sobrecarga (> 93% de barra) aumenta riesgo de mandarla arriba o desviada
    const overchargePenalty = !isRivalAI && power > 0.93 ? (power - 0.93) * 8.5 : 0;
    const spread =
      ((1 - skillFactor) * 2.55 + fatiguePenalty + pressurePenalty + bodyAnglePenalty + overchargePenalty) *
      aiAccuracyScale;
    const finalY = effectiveTargetY + (this.rng() - 0.5) * spread;

    // Velocidad de tiro fuerte entre 25 y 33 m/s (máxima potencia letal en dificultad máxima)
    const shotSpeed = isExtremeRivalAI
      ? PHYSICS_TUNING.SHOT_SPEED_MAX_MPS - 0.3
      : isHeader
      ? 20 + power * 6 + headingAttr * 3
      : Math.min(
          PHYSICS_TUNING.SHOT_SPEED_MAX_MPS,
          Math.max(
            PHYSICS_TUNING.SHOT_SPEED_MIN_MPS,
            PHYSICS_TUNING.SHOT_SPEED_MIN_MPS + power * 5.2 + powerAttr * 2.8
          )
        );
    const liftVz = isExtremeRivalAI
      ? 2.85
      : strikeType === 'raso'
      ? 0.85 + power * 1.35
      : strikeType === 'cabezazo'
      ? 1.15 + power * 2.15
      : strikeType === 'chilena' || strikeType === 'volea'
      ? 2.2 + power * 3.7
      : isPlacedFinesseShot
      ? 2.35 + power * 2.85
      : 2.5 + power * 4.2 + (overchargePenalty > 0 ? 1.4 : 0);

    if (Math.abs(finalY - PITCH.HALF_Y) < PITCH.GOAL_HALF) {
      stats.shotsOnTarget++;
    } else {
      this.onSound?.('near_miss_gasp');
    }

    if (isHeader) {
      shooter.headerTimer = 0.36;
      shooter.jumpTimer = 0.36;
      shooter.animState = 'header';
    } else if (isVolley) {
      shooter.volleyTimer = 0.36;
      shooter.jumpTimer = isChilena ? 0.42 : 0.25;
      shooter.animState = 'volley';
    } else {
      shooter.animState = 'shoot';
    }
    this.kickBallToward(shooter, goalX, finalY, shotSpeed, liftVz, false, strikeType);
    if (directionalCurveInput !== undefined && Math.abs(directionalCurveInput) > 0.08) {
      this.ball.spin = Math.max(-3.2, Math.min(3.2, directionalCurveInput * (2.2 + accuracyAttr * 1.2)));
    } else if (isPlacedFinesseShot || isExtremeRivalAI) {
      const cornerSign = finalY > PITCH.HALF_Y ? -1 : 1;
      this.ball.spin = cornerSign * (isExtremeRivalAI ? 2.55 : 1.65 + accuracyAttr * 1.15);
    }
    this.onSound?.(isHeader ? 'header_thud' : 'kick_hard');
    this.emitParticles(this.ball.x, this.ball.y, 0.04, 8, 'turf');
    this.setCrowdMood('dangerous_play', 3.0);

    this.onCommentary?.({
      type: 'shot',
      playerName: shooter.player.name,
      teamName: shooter.side === 'home' ? this.homeTeam.name : this.awayTeam.name,
    });
  }

  private kickBallToward(
    kicker: MatchPlayerState,
    tx: number,
    ty: number,
    speed: number,
    vz: number,
    isPass: boolean,
    strikeType: StrikeType = 'raso'
  ): void {
    const dx = tx - this.ball.x;
    const dy = ty - this.ball.y;
    const dist = Math.max(0.01, Math.hypot(dx, dy));

    if (
      this.ball.lastTouchTeam === kicker.side &&
      this.ball.lastTouchPlayerId &&
      this.ball.lastTouchPlayerId !== kicker.id
    ) {
      this.ball.assistCandidateId = this.ball.lastTouchPlayerId;
      this.ball.assistCandidateName = this.ball.lastTouchPlayerName;
    }

    this.ball.ownerId = null;
    this.ball.lastTouchTeam = kicker.side;
    this.ball.lastTouchPlayerId = kicker.id;
    this.ball.lastTouchPlayerName = kicker.player.name;

    this.ball.vx = (dx / dist) * speed;
    this.ball.vy = (dy / dist) * speed;
    this.ball.vz = vz;
    this.ball.strikeType = strikeType;

    const curveSign = ty > PITCH.HALF_Y ? -1 : 1;
    this.ball.spin = isPass
      ? strikeType === 'globo'
        ? curveSign * 0.6
        : 0
      : curveSign * (0.85 + this.rng() * 1.4);
    this.ball.topSpin = strikeType === 'volea' ? 1.5 : strikeType === 'globo' ? -0.9 : 0.35;

    kicker.kickAnimTimer = 0.28;
    kicker.facing = Math.atan2(dy, dx);
    if (isPass) this.onSound?.('kick_light');
  }

  private attemptTackle(
    tackler: MatchPlayerState,
    carrier: MatchPlayerState,
    isSlide: boolean
  ): void {
    const outcome = evaluateTackleOutcome(tackler, carrier, isSlide, this.rng, this.ball);
    const tStats = tackler.side === 'home' ? this.homeStats : this.awayStats;

    if (outcome.knockdown) {
      carrier.fallTimer = 0.85;
      carrier.animState = 'fall';
      this.emitParticles(carrier.x, carrier.y, 0.05, 8, 'dust');
    }

    if (outcome.injuryTriggered && !carrier.injured) {
      carrier.injured = true;
      this.onCommentary?.({
        type: 'injury',
        playerName: carrier.player.name,
        teamName: carrier.side === 'home' ? this.homeTeam.name : this.awayTeam.name,
      });
    }

    if (outcome.isFoul && this.mode !== 'training') {
      tStats.fouls++;
      this.setCrowdMood('foul_boos', 3.5);
      this.setCoachMoods(
        tackler.side === 'home' ? 'instruct' : 'protest',
        tackler.side === 'away' ? 'instruct' : 'protest',
        3.5
      );

      const canPlayAdvantage =
        !outcome.isPenalty &&
        outcome.card !== 'red' &&
        !outcome.knockdown &&
        (carrier.side === 'home'
          ? carrier.x > PITCH.HALF_X - 8
          : carrier.x < PITCH.HALF_X + 8);

      if (canPlayAdvantage && this.rng() < 0.45) {
        this.advantageState = {
          side: carrier.side,
          timer: 3.2,
          foulX: carrier.x,
          foulY: carrier.y,
          offenderName: tackler.player.name,
        };
        this.referee.signalType = 'advantage';
        this.referee.signalTimer = 3.0;
        this.showBanner(
          `¡LEY DE VENTAJA para ${
            carrier.side === 'home' ? this.homeTeam.shortName : this.awayTeam.shortName
          }!`
        );
        this.onCommentary?.({
          type: 'advantage',
          teamName: carrier.side === 'home' ? this.homeTeam.name : this.awayTeam.name,
        });
        return;
      }

      this.onSound?.('foul_card');
      this.onSound?.('foul_boo');
      this.hitstopTimer = 0.04;
      this.cameraShake = 0.25;
      this.referee.signalType =
        outcome.card === 'red' ? 'red' : outcome.card === 'yellow' ? 'yellow' : 'foul';
      this.referee.signalTimer = 2.6;

      const foulLabel =
        outcome.foulType === 'plancha'
          ? 'Plancha peligrosa'
          : outcome.foulType === 'falta_tactica'
          ? 'Falta táctica en contragolpe'
          : outcome.foulType === 'empujon'
          ? 'Empujón antirreglamentario'
          : outcome.foulType === 'agarron'
          ? 'Agarrón táctico'
          : outcome.foulType === 'por_detras'
          ? 'Entrada por detrás'
          : 'Entrada a destiempo';

      // Revisión VAR automática en jugadas límite de penal, posible tarjeta roja directa o confusión de identidad en tumulto
      const nearbyTeammate = this.players.find(
        (m) =>
          m.side === tackler.side &&
          m.id !== tackler.id &&
          !m.redCard &&
          m.player.position !== 'GK' &&
          Math.hypot(m.x - tackler.x, m.y - tackler.y) < 2.15
      );

      if (outcome.isPenalty && this.rng() < 0.42) {
        this.triggerVARReview(
          'penalty_check',
          tackler,
          carrier.x,
          carrier.y,
          true,
          () => {
            this.triggerSetPiece(
              'penalty',
              carrier.side,
              carrier.side === 'home' ? PITCH.LENGTH - PITCH.PENALTY_SPOT_X : PITCH.PENALTY_SPOT_X,
              PITCH.HALF_Y
            );
          }
        );
        return;
      }

      if (
        (outcome.foulType === 'plancha' || outcome.foulType === 'por_detras') &&
        outcome.severity > 0.62 &&
        outcome.card === 'yellow' &&
        this.rng() < 0.28
      ) {
        this.triggerVARReview(
          'direct_red_check',
          tackler,
          tackler.x,
          tackler.y,
          true,
          () => {
            tackler.redCard = true;
            tStats.redCards++;
            this.pushEvent('red', tackler.side, tackler.player.name, undefined, `VAR · Roja Directa (${foulLabel})`);
            this.triggerSetPiece('free_kick', carrier.side, carrier.x, carrier.y);
          }
        );
        return;
      }

      if (outcome.card === 'yellow' && nearbyTeammate && this.rng() < 0.25) {
        this.triggerVARReview(
          'mistaken_identity',
          nearbyTeammate,
          tackler.x,
          tackler.y,
          true,
          () => {
            nearbyTeammate.yellowCards++;
            tStats.yellowCards++;
            this.pushEvent(
              'yellow',
              nearbyTeammate.side,
              nearbyTeammate.player.name,
              undefined,
              `VAR Identidad Corregida (${foulLabel})`
            );
            this.triggerSetPiece('free_kick', carrier.side, carrier.x, carrier.y);
          }
        );
        return;
      }

      if (outcome.card === 'yellow') {
        tackler.yellowCards++;
        tStats.yellowCards++;
        const isSecondYellow = tackler.yellowCards >= 2;
        if (isSecondYellow) {
          tackler.redCard = true;
          tStats.redCards++;
          this.pushEvent(
            'red',
            tackler.side,
            tackler.player.name,
            undefined,
            `Doble amarilla (${foulLabel})`
          );
          this.showBanner(`¡ROJA! Expulsado ${tackler.player.name} (${foulLabel})`);
          this.onCommentary?.({
            type: 'red_card',
            playerName: tackler.player.name,
            teamName: tackler.side === 'home' ? this.homeTeam.name : this.awayTeam.name,
          });
        } else {
          this.pushEvent('yellow', tackler.side, tackler.player.name, undefined, foulLabel);
          this.showBanner(`Amarilla · ${tackler.player.name} (${foulLabel})`);
          this.onCommentary?.({
            type: 'yellow_card',
            playerName: tackler.player.name,
            teamName: tackler.side === 'home' ? this.homeTeam.name : this.awayTeam.name,
          });
        }
        this.cardCutscene = {
          active: true,
          timer: 2.8,
          card: isSecondYellow ? 'red' : 'yellow',
          playerId: tackler.id,
          playerName: tackler.player.name,
          playerNumber: tackler.player.number,
          teamSide: tackler.side,
          teamName: tackler.side === 'home' ? this.homeTeam.name : this.awayTeam.name,
          foulLabel: isSecondYellow ? `Doble Amarilla · ${foulLabel}` : foulLabel,
          x: tackler.x,
          y: tackler.y,
        };
        this.cutsceneState = {
          active: true,
          type: isSecondYellow ? 'red_card' : 'yellow_card',
          timer: 2.8,
          duration: 2.8,
          skippable: true,
          focusX: tackler.x,
          focusY: tackler.y,
          playerId: tackler.id,
          playerName: tackler.player.name,
          playerNumber: tackler.player.number,
          teamSide: tackler.side,
          teamName: tackler.side === 'home' ? this.homeTeam.name : this.awayTeam.name,
          title: isSecondYellow ? 'TARJETA ROJA · DOBLE AMARILLA' : 'TARJETA AMARILLA',
          subtitle: `${tackler.player.name} (#${tackler.player.number}) · ${foulLabel}`,
        };
      } else if (outcome.card === 'red') {
        tackler.redCard = true;
        tStats.redCards++;
        this.pushEvent('red', tackler.side, tackler.player.name, undefined, foulLabel);
        this.showBanner(`¡TARJETA ROJA directa para ${tackler.player.name}! (${foulLabel})`);
        this.onCommentary?.({
          type: 'red_card',
          playerName: tackler.player.name,
          teamName: tackler.side === 'home' ? this.homeTeam.name : this.awayTeam.name,
        });
        this.cardCutscene = {
          active: true,
          timer: 3.1,
          card: 'red',
          playerId: tackler.id,
          playerName: tackler.player.name,
          playerNumber: tackler.player.number,
          teamSide: tackler.side,
          teamName: tackler.side === 'home' ? this.homeTeam.name : this.awayTeam.name,
          foulLabel: `Roja Directa · ${foulLabel}`,
          x: tackler.x,
          y: tackler.y,
        };
        this.cutsceneState = {
          active: true,
          type: 'red_card',
          timer: 3.1,
          duration: 3.1,
          skippable: true,
          focusX: tackler.x,
          focusY: tackler.y,
          playerId: tackler.id,
          playerName: tackler.player.name,
          playerNumber: tackler.player.number,
          teamSide: tackler.side,
          teamName: tackler.side === 'home' ? this.homeTeam.name : this.awayTeam.name,
          title: '¡TARJETA ROJA DIRECTA! · EXPULSADO',
          subtitle: `${tackler.player.name} (#${tackler.player.number}) · ${foulLabel}`,
        };
      }

      if (outcome.isPenalty) {
        this.triggerSetPiece(
          'penalty',
          carrier.side,
          carrier.side === 'home'
            ? PITCH.LENGTH - PITCH.PENALTY_SPOT_X
            : PITCH.PENALTY_SPOT_X,
          PITCH.HALF_Y
        );
        this.showBanner(
          `¡PENAL para ${
            carrier.side === 'home' ? this.homeTeam.shortName : this.awayTeam.shortName
          }! (${foulLabel})`
        );
        this.onCommentary?.({
          type: 'penalty_awarded',
          teamName: carrier.side === 'home' ? this.homeTeam.name : this.awayTeam.name,
        });
      } else {
        this.triggerSetPiece('free_kick', carrier.side, carrier.x, carrier.y);
        if (outcome.card === 'none') {
          this.showBanner(`Falta (${foulLabel}) · Tiro libre`);
          this.onCommentary?.({
            type: 'foul',
            playerName: tackler.player.name,
            teamName: carrier.side === 'home' ? this.homeTeam.name : this.awayTeam.name,
          });
        }
      }
      return;
    }

    if (outcome.wonBall) {
      tStats.tackles++;
      carrier.stunTimer = 0.45;
      this.lastAttackingContactSide = tackler.side;
      this.lastAttackingContactMinute = this.matchMinute;
      this.lastAttackingContactPlayerName = tackler.player.name;
      this.ball.ownerId = tackler.id;
      this.ball.lastTouchTeam = tackler.side;
      this.ball.lastTouchPlayerId = tackler.id;
      this.ball.lastTouchPlayerName = tackler.player.name;
      this.pendingPassCheck = null;
      this.onSound?.('kick_light');
      this.emitParticles(tackler.x, tackler.y, 0.04, 5, 'turf');
      if (tackler.side === this.userSide) {
        this.activeUserPlayerId = tackler.id;
      } else if (this.twoPlayerMode && tackler.side === 'away') {
        this.activeUser2PlayerId = tackler.id;
      }
    }
  }

  private stepBallOwnershipAndOutcome(dt: number): void {
    const owner = this.players.find((p) => p.id === this.ball.ownerId) ?? null;

    if (owner) {
      // Conducción realista: el jugador lleva el balón pegado al pie con toques cada pocos pasos,
      // y el balón se separa más hacia adelante al sprintar (> 6.8 m/s).
      const speed = Math.hypot(owner.vx, owner.vy);
      const isSprinting = speed > 6.8;
      const strideTouchWave = speed > 0.5 ? Math.max(0, Math.sin(owner.stridePhase * 0.85)) : 0;

      const baseFootDist = isSprinting ? 0.78 : 0.48;
      const touchKickOut = isSprinting ? strideTouchWave * 0.46 : strideTouchWave * 0.18;
      const lead = baseFootDist + touchKickOut;

      // Oscilación lateral sutil entre pie izquierdo y derecho durante la conducción
      const footLateral = speed > 0.8 ? Math.cos(owner.stridePhase * 0.85) * 0.12 : 0;
      const cosF = Math.cos(owner.facing);
      const sinF = Math.sin(owner.facing);

      this.ball.x = owner.x + cosF * lead - sinF * footLateral;
      this.ball.y = owner.y + sinF * lead + cosF * footLateral;
      this.ball.vx = owner.vx;
      this.ball.vy = owner.vy;

      // Giro visual del balón rodando sobre el césped
      if (speed > 2.5 && strideTouchWave > 0.88 && this.matchMinute - this.lastDribbleTapTime > 0.015) {
        this.lastDribbleTapTime = this.matchMinute;
        this.emitParticles(this.ball.x, this.ball.y, 0.01, 1, 'turf');
      }

      if (owner.side === 'home') this.homeStats.possessionTime += dt;
      else this.awayStats.possessionTime += dt;

      const ownerTeamName = owner.side === 'home' ? this.homeTeam.name : this.awayTeam.name;
      const distToOppGoal = owner.side === 'home' ? PITCH.LENGTH - owner.x : owner.x;
      if (distToOppGoal < 18.5 && Math.abs(owner.y - PITCH.HALF_Y) < 19) {
        this.setCrowdMood('dangerous_play', 2.0);
        this.onCommentary?.({
          type: 'approach_box',
          playerName: owner.player.name,
          teamName: ownerTeamName,
        });
      } else if (distToOppGoal < 38 && speed > 5.8) {
        this.onCommentary?.({
          type: this.rng() < 0.5 ? 'counter_attack' : 'dribble_encara',
          playerName: owner.player.name,
          teamName: ownerTeamName,
        });
      } else if (distToOppGoal < 55 && speed > 3.2) {
        this.onCommentary?.({
          type: 'attack_buildup',
          playerName: owner.player.name,
          teamName: ownerTeamName,
          homeScore: this.homeScore,
          awayScore: this.awayScore,
        });
      }
    } else {
      const { hitPost, bouncedOnGrass, hitNet } = stepBallPhysics(
        this.ball,
        dt,
        this.settings.match.pitchCondition,
        this.settings.match.weather
      );
      if (bouncedOnGrass) {
        this.emitParticles(this.ball.x, this.ball.y, 0.03, 4, 'turf');
      }
      if (hitNet) {
        this.onSound?.('net_swish');
      }
      if (hitPost) {
        this.onSound?.('post');
        this.onSound?.('near_miss_gasp');
        this.cameraShake = 0.55;
        this.slowMoTimer = 0.3;
        this.emitParticles(this.ball.x, this.ball.y, this.ball.z, 12, 'spark');
        this.setCoachMoods('despair', 'despair', 2.8);
        this.onCommentary?.({
          type: 'shot_post',
          playerName: this.ball.lastTouchPlayerName ?? 'el delantero',
        });
      }

      const profile = getDifficultyProfile(this.difficulty);

      for (const p of this.players) {
        if (p.redCard || p.stunTimer > 0 || p.kickAnimTimer > 0.14) continue;
        const isGk = p.player.position === 'GK';
        const isRivalAI =
          p.side !== this.userSide && !(this.twoPlayerMode && p.side === 'away');
        // Radio de captura magnético: si un jugador está cerca de la pelota o pasa cerca, la controla (mayor anticipación de IA en dificultad máxima)
        const reach = isGk
          ? p.diveTimer > 0
            ? 2.45
            : 1.95
          : isRivalAI && profile.level >= 7
          ? 1.76
          : 1.46;
        const maxHeight = isGk ? PITCH.GOAL_HEIGHT + 0.18 : 1.82;
        const d = Math.hypot(this.ball.x - p.x, this.ball.y - p.y);
        if (d < reach && this.ball.z <= maxHeight) {
          if (
            this.pendingPassCheck &&
            this.pendingPassCheck.side === p.side &&
            this.pendingPassCheck.offsideTargets.has(p.id)
          ) {
            const stats = p.side === 'home' ? this.homeStats : this.awayStats;
            stats.offsides++;
            this.pushEvent('offside', p.side, p.player.name);
            this.showBanner(`¡POSICIÓN ADELANTADA! · ${p.player.name}`);
            this.onSound?.('whistle_short');
            this.onCommentary?.({
              type: 'offside',
              playerName: p.player.name,
            });
            this.offsideCutscene = {
              active: true,
              timer: 2.1,
              lineX: p.x,
              playerId: p.id,
              playerName: p.player.name,
              playerNumber: p.player.number,
              teamSide: p.side,
              teamName: p.side === 'home' ? this.homeTeam.name : this.awayTeam.name,
              x: p.x,
              y: p.y,
            };
            this.triggerSetPiece(
              'free_kick',
              p.side === 'home' ? 'away' : 'home',
              p.x,
              p.y
            );
            return;
          }

          const wasReceivingPass =
            this.pendingPassCheck &&
            this.pendingPassCheck.side === p.side &&
            this.pendingPassCheck.passerId !== p.id;

          if (wasReceivingPass) {
            const stats = p.side === 'home' ? this.homeStats : this.awayStats;
            stats.passesCompleted++;
            p.orientedControlTimer = 0.28;
            p.animState = 'oriented_control';
          }
          this.pendingPassCheck = null;

          const ballSpeed = Math.hypot(this.ball.vx, this.ball.vy);
          if (isGk && ballSpeed > 9.5 && this.ball.lastTouchTeam !== p.side) {
            const gStats = p.side === 'home' ? this.homeStats : this.awayStats;
            gStats.saves++;
            p.diveTimer = 0.78;
            p.diveDirY = this.ball.y >= p.y ? 1 : -1;
            p.gkAction =
              ballSpeed > 24.5 || this.ball.z > 2.25
                ? 'punch_clear'
                : this.ball.z < 0.48 && Math.abs(this.ball.y - p.y) < 0.65
                ? 'block'
                : 'dive_save';
            p.animState = 'gk_action';
            this.onSound?.('save_clap');
            this.setCrowdMood('save_applause', 3.0);
            this.setCoachMoods(
              p.side === 'home' ? 'instruct' : 'despair',
              p.side === 'away' ? 'instruct' : 'despair',
              2.8
            );
            this.onCommentary?.({
              type: 'save',
              playerName: p.player.name,
              teamName: p.side === 'home' ? this.homeTeam.name : this.awayTeam.name,
              minute: Math.max(1, Math.round(this.matchMinute)),
            });

            if (ballSpeed > 24.5 || this.ball.z > 2.25) {
              this.showBanner(`¡Vuelo espectacular y rechace de ${p.player.name}!`);
              const dirAwayX = p.side === 'home' ? 1 : -1;
              const deflectSideY = this.ball.y >= PITCH.HALF_Y ? 1 : -1;
              this.ball.vx = dirAwayX * (8.2 + this.rng() * 4.5);
              this.ball.vy = deflectSideY * (10.2 + this.rng() * 5.0);
              this.ball.vz = 3.2 + this.rng() * 2.5;
              this.ball.lastTouchTeam = p.side;
              this.ball.lastTouchPlayerId = p.id;
              this.ball.lastTouchPlayerName = p.player.name;
              p.tackleCooldown = 0.35;
              this.emitParticles(this.ball.x, this.ball.y, this.ball.z, 6, 'spark');
              break;
            } else {
              this.showBanner(`¡Atajada limpia de ${p.player.name}!`);
              // El arquero ataja ÉL SOLO: retenemos 0.85s mientras compañeros y rivales suben hacia mitad de cancha
              p.aiHoldTimer = 0.85;
            }
          }

          // Remate DE PRIMERA INTENCIÓN (First-Time Shot) para la IA cuando recibe un pase o centro en zona de gol (<22.5m)
          const isUserPlayer =
            (p.side === this.userSide && p.id === this.activeUserPlayerId) ||
            (this.twoPlayerMode && p.side === 'away' && p.id === this.activeUser2PlayerId);
          if (!isGk && !isUserPlayer && wasReceivingPass) {
            const oppNodes = this.players
              .filter((o) => o.side !== p.side && !o.redCard)
              .map((o) => this.toAINode(o));
            const firstTouch = shouldExecuteFirstTouchShot(
              this.toAINode(p),
              oppNodes,
              profile
            );
            if (firstTouch.shouldShoot) {
              this.performShot(p, firstTouch.targetX, firstTouch.targetY, firstTouch.power);
              break;
            }
          }

          this.ball.ownerId = p.id;
          this.ball.vx = 0;
          this.ball.vy = 0;
          this.ball.vz = 0;
          this.ball.z = 0;
          this.ball.lastTouchTeam = p.side;
          this.ball.lastTouchPlayerId = p.id;
          this.ball.lastTouchPlayerName = p.player.name;
          if (!isGk) {
            // En dificultad máxima la IA mueve la pelota a un toque (0.04s) con jugadas casi imposibles
            p.aiHoldTimer =
              isRivalAI && profile.level >= 7
                ? 0.04 + this.rng() * 0.05
                : 0.24 + this.rng() * 0.24;
          }

          // Cuando el arquero controla la pelota, NO cambiamos activeUserPlayerId a un jugador pegado ni teletransportamos a nadie;
          // el arquero la tiene él solo.
          if (p.side === this.userSide) {
            this.activeUserPlayerId = p.id;
          } else if (this.twoPlayerMode && p.side === 'away') {
            this.activeUser2PlayerId = p.id;
          }
          break;
        }
      }
    }

    const outcome = checkBallOutcome(this.ball);
    if (outcome.event === 'goal_home' || outcome.event === 'goal_away') {
      const scoringSide = outcome.event === 'goal_home' ? 'home' : 'away';
      this.handleGoalScored(scoringSide);
    } else if (outcome.event === 'corner') {
      // Regla oficial IFAB: si la pelota cruza la línea de fondo tocada por última vez por el equipo defensor
      // (o desviada por el arquero), se ejecuta un TIRO DE ESQUINA (córner) desde el banderín más cercano.
      if (this.mode === 'training') {
        this.setupTrainingScenario();
        return;
      }
      const attackingSide = outcome.restartTeam ?? (this.ball.x <= PITCH.HALF_X ? 'away' : 'home');
      if (attackingSide === 'home') {
        this.homeStats.corners++;
      } else {
        this.awayStats.corners++;
      }
      this.triggerSetPiece(
        'corner',
        attackingSide,
        outcome.restartX ?? (attackingSide === 'home' ? PITCH.LENGTH - 0.6 : 0.6),
        outcome.restartY ?? (this.ball.y < PITCH.HALF_Y ? 0.6 : PITCH.WIDTH - 0.6)
      );
    } else if (outcome.event === 'goal_kick') {
      // Regla oficial IFAB: si la pelota cruza la línea de fondo tocada por última vez por el equipo atacante,
      // el balón se coloca en el área chica, los defensores se abren para recibir y el ARQUERO ejecuta el saque de meta.
      if (this.mode === 'training') {
        this.setupTrainingScenario();
        return;
      }
      const keeperSide: 'home' | 'away' =
        outcome.restartTeam ?? (this.ball.x <= PITCH.HALF_X ? 'home' : 'away');
      const goalBoxX = keeperSide === 'home' ? 5.5 : PITCH.LENGTH - 5.5;
      this.triggerSetPiece('goal_kick', keeperSide, goalBoxX, PITCH.HALF_Y);
    } else if (outcome.event === 'throw_in') {
      if (this.mode === 'training') {
        this.setupTrainingScenario();
        return;
      }
      this.triggerSetPiece(
        'throw_in',
        outcome.restartTeam ?? 'home',
        outcome.restartX ?? PITCH.HALF_X,
        outcome.restartY ?? PITCH.HALF_Y
      );
    }
  }

  private handleGoalScored(scoringSide: 'home' | 'away', bypassVAR = false): void {
    const scorerPlayer =
      this.players.find(
        (p) => p.side === scoringSide && p.id === this.ball.lastTouchPlayerId
      ) ??
      this.players.find((p) => p.side === scoringSide && p.slotIndex === 9) ??
      this.players[0];

    // Intervención automática del VAR en goles con posible infracción previa en la recuperación o fuera de juego milimétrico
    if (!bypassVAR && this.mode !== 'training' && scorerPlayer) {
      const hadRecentAttackingContact =
        this.lastAttackingContactSide === scoringSide &&
        this.matchMinute - this.lastAttackingContactMinute < 1.1;

      if (hadRecentAttackingContact && this.rng() < 0.16) {
        const disallow = this.rng() < 0.42;
        this.triggerVARReview(
          'foul_buildup_goal',
          scorerPlayer,
          scorerPlayer.x,
          scorerPlayer.y,
          disallow,
          () => {
            if (disallow) {
              const defendingSide = scoringSide === 'home' ? 'away' : 'home';
              const sStats = scoringSide === 'home' ? this.homeStats : this.awayStats;
              sStats.fouls++;
              this.showBanner('📺 VAR: ¡GOL ANULADO POR INFRACCIÓN PREVIA EN LA RECUPERACIÓN!');
              this.triggerSetPiece('free_kick', defendingSide, PITCH.HALF_X, PITCH.HALF_Y);
            } else {
              this.handleGoalScored(scoringSide, true);
            }
          }
        );
        return;
      }

      if (this.settings.match.offsideEnabled && this.rng() < 0.12) {
        const disallowOffside = this.rng() < 0.35;
        this.triggerVARReview(
          'offside_goal',
          scorerPlayer,
          scorerPlayer.x,
          scorerPlayer.y,
          disallowOffside,
          () => {
            if (disallowOffside) {
              const defendingSide = scoringSide === 'home' ? 'away' : 'home';
              const sStats = scoringSide === 'home' ? this.homeStats : this.awayStats;
              sStats.offsides++;
              this.pushEvent('offside', scoringSide, scorerPlayer.player.name, undefined, 'Gol anulado por VAR');
              this.showBanner(`📺 VAR: ¡GOL ANULADO POR FUERA DE JUEGO DE ${scorerPlayer.player.name.toUpperCase()}!`);
              this.triggerSetPiece('free_kick', defendingSide, scorerPlayer.x, scorerPlayer.y);
            } else {
              this.handleGoalScored(scoringSide, true);
            }
          }
        );
        return;
      }
    }

    this.replayScorerId = scorerPlayer?.id ?? null;
    for (const pl of this.players) {
      if (pl.redCard) continue;
      if (pl.side === scoringSide) {
        pl.animState = 'celebrate';
      } else {
        pl.lamentTimer = 2.6;
        pl.animState = 'lament';
      }
    }

    const wasTopCornerGoal =
      this.ball.z > 1.55 || Math.abs(this.ball.y - PITCH.HALF_Y) > PITCH.GOAL_HALF * 0.65;
    if (wasTopCornerGoal) {
      this.slowMoTimer = 0.3;
    }

    this.ball.ownerId = null;
    this.pendingPassCheck = null;
    this.advantageState = null;
    this.freeKickState = null;
    this.hitstopTimer = 0.06;
    this.cameraShake = 0.62;
    this.onSound?.('net_swish');
    this.onSound?.('goal_roar');
    this.setCrowdMood('goal_roar', 6.0);
    this.setCoachMoods(
      scoringSide === 'home' ? 'celebrate' : 'despair',
      scoringSide === 'away' ? 'celebrate' : 'despair',
      6.0
    );

    if (scoringSide === 'home') {
      this.homeScore++;
      this.homeStats.goals = this.homeScore;
    } else {
      this.awayScore++;
      this.awayStats.goals = this.awayScore;
    }

    const scorerName =
      this.ball.lastTouchTeam === scoringSide && this.ball.lastTouchPlayerName
        ? this.ball.lastTouchPlayerName
        : scorerPlayer?.player.name ?? 'Delantero';
    const assistName = this.ball.assistCandidateName ?? undefined;
    const teamName = scoringSide === 'home' ? this.homeTeam.name : this.awayTeam.name;
    const shortTeam =
      scoringSide === 'home' ? this.homeTeam.shortName : this.awayTeam.shortName;
    const minuteRounded = Math.max(1, Math.round(this.matchMinute));

    this.replayPlayTitle = `GOL DE ${shortTeam} · ${scorerName.toUpperCase()} (${minuteRounded}')`;

    this.pushEvent('goal', scoringSide, scorerName, assistName);
    if (this.half >= 3 && this.modeConfig.goldenGoalInExtraTime) {
      this.goldenGoalTriggered = true;
      this.showBanner(`⚡ ¡GOL DE ORO DE ${shortTeam}! · ¡${scorerName} DEFINE EL PARTIDO!`);
    } else {
      this.showBanner(`¡GOOOL DE ${shortTeam}! · ${scorerName}`);
    }

    const isLate = this.matchMinute >= 80;
    const isSpectacular =
      this.ball.z > 1.45 || Math.hypot(this.ball.vx, this.ball.vy) > 27;
    this.onCommentary?.({
      type: isLate ? 'goal_late' : isSpectacular ? 'goal_spectacular' : 'goal',
      playerName: scorerName,
      teamName,
      opponentName: scoringSide === 'home' ? this.awayTeam.name : this.homeTeam.name,
      minute: minuteRounded,
      homeScore: this.homeScore,
      awayScore: this.awayScore,
    });

    this.recordReplayFrame();
    this.phase = 'goal_celebration';
    this.phaseTimer = 2.65;
    this.cutsceneState = {
      active: true,
      type: 'goal',
      timer: 2.65,
      duration: 2.65,
      skippable: true,
      focusX: scorerPlayer?.x ?? this.ball.x,
      focusY: scorerPlayer?.y ?? this.ball.y,
      playerId: scorerPlayer?.id,
      playerName: scorerName,
      playerNumber: scorerPlayer?.player.number,
      teamSide: scoringSide,
      teamName,
      title: `¡GOOOL DE ${shortTeam}! (${this.homeScore} - ${this.awayScore})`,
      subtitle: `${scorerName}${assistName ? ` · Asistencia: ${assistName}` : ''} · ${minuteRounded}'`,
    };
    this.restartTeam = scoringSide === 'home' ? 'away' : 'home';
  }

  private triggerSetPiece(
    type: RestartType,
    team: 'home' | 'away',
    x: number,
    y: number
  ): void {
    this.phase = 'set_piece';
    this.phaseTimer = type === 'corner' || type === 'throw_in' ? 1.45 : 0.75;
    this.restartType = type;
    this.restartTeam = team;
    this.restartX = Math.max(0.5, Math.min(PITCH.LENGTH - 0.5, x));
    this.restartY = Math.max(0.5, Math.min(PITCH.WIDTH - 0.5, y));
    this.pendingPassCheck = null;
    this.advantageState = null;
    this.freeKickState = null;

    for (const p of this.players) {
      p.inWall = false;
      p.vx = 0;
      p.vy = 0;
      p.animState = 'idle';
    }

    this.ball = createInitialBall();
    this.ball.x = this.restartX;
    this.ball.y = this.restartY;
    this.ball.lastTouchTeam = team;

    const defendingSide: 'home' | 'away' = team === 'home' ? 'away' : 'home';
    const shortTeam = team === 'home' ? this.homeTeam.shortName : this.awayTeam.shortName;
    const fullTeam = team === 'home' ? this.homeTeam.name : this.awayTeam.name;

    // 1. SAQUE DE META (GOAL KICK): el balón se coloca en el área chica, los defensores se abren para recibir
    // y comp./rivales suben hacia mitad de cancha; el ARQUERO ejecuta el saque.
    if (type === 'goal_kick') {
      this.restartX = team === 'home' ? 5.5 : PITCH.LENGTH - 5.5;
      this.restartY = PITCH.HALF_Y;
      this.ball.x = this.restartX;
      this.ball.y = this.restartY;
    }

    // Selección del ejecutante según el tipo de reanudación IFAB
    let taker: MatchPlayerState | undefined;
    if (type === 'goal_kick') {
      taker =
        this.players.find((p) => p.side === team && !p.redCard && p.player.position === 'GK') ??
        this.players.find((p) => p.side === team && !p.redCard);
    } else if (type === 'corner') {
      // Córner: elegir un extremo o mediocampista técnico (slotIndex 6..10) cercano a la banda del córner
      const candidates = this.players.filter(
        (p) => p.side === team && !p.redCard && p.player.position !== 'GK'
      );
      taker =
        candidates
          .slice()
          .sort(
            (a, b) =>
              b.player.attributes.shortPassing +
              (b.slotIndex >= 5 ? 12 : 0) -
              Math.abs(b.y - this.restartY) * 0.25 -
              (a.player.attributes.shortPassing +
                (a.slotIndex >= 5 ? 12 : 0) -
                Math.abs(a.y - this.restartY) * 0.25)
          )[0] ?? candidates[0];
    } else if (type === 'throw_in') {
      // Saque de banda: el jugador de campo más cercano al punto exacto donde salió el balón
      const candidates = this.players.filter(
        (p) => p.side === team && !p.redCard && p.player.position !== 'GK'
      );
      taker =
        candidates
          .slice()
          .sort(
            (a, b) =>
              Math.hypot(a.x - this.restartX, a.y - this.restartY) -
              Math.hypot(b.x - this.restartX, b.y - this.restartY)
          )[0] ?? candidates[0];
    } else {
      taker =
        this.players.find((p) => p.side === team && !p.redCard && p.player.position !== 'GK') ??
        this.players[1];
    }

    if (taker) {
      if (type === 'throw_in') {
        const touchlineY = this.restartY < PITCH.HALF_Y ? 0.15 : PITCH.WIDTH - 0.15;
        taker.x = this.restartX;
        taker.y = touchlineY;
        taker.facing = this.restartY < PITCH.HALF_Y ? Math.PI / 2 : -Math.PI / 2;
        taker.animState = 'throw_in';
        this.ball.x = taker.x;
        this.ball.y = taker.y;
        this.ball.z = 1.85; // Sostenida con ambas manos sobre la cabeza
      } else if (type === 'corner') {
        const cornerSignX = this.restartX < PITCH.HALF_X ? -1 : 1;
        const cornerSignY = this.restartY < PITCH.HALF_Y ? -1 : 1;
        taker.x = this.restartX + cornerSignX * 0.45;
        taker.y = this.restartY + cornerSignY * 0.45;
        const boxTargetX = team === 'home' ? PITCH.LENGTH - 11 : 11;
        taker.facing = Math.atan2(PITCH.HALF_Y - taker.y, boxTargetX - taker.x);
      } else {
        taker.x = this.restartX + (team === 'home' ? -0.65 : 0.65);
        taker.y = this.restartY;
        taker.facing = team === 'home' ? 0 : Math.PI;
      }

      this.ball.ownerId = taker.id;
      this.ball.lastTouchPlayerId = taker.id;
      this.ball.lastTouchPlayerName = taker.player.name;
      if (team === this.userSide) {
        this.activeUserPlayerId = taker.id;
      } else if (this.twoPlayerMode && team === 'away') {
        this.activeUser2PlayerId = taker.id;
      }
    }

    if (type === 'goal_kick') {
      const homeForm = getFormation(this.homeFormationId);
      const awayForm = getFormation(this.awayFormationId);
      for (const p of this.players) {
        if (p.redCard || p.id === taker?.id || p.player.position === 'GK') continue;
        const form = p.side === 'home' ? homeForm : awayForm;
        const slot = form.slots[p.slotIndex] ?? form.slots[0];
        // Los 2 defensores centrales del equipo que saca se abren a los costados del área grande para opción de saque en corto,
        // mientras el resto de compañeros y rivales suben hacia mitad de cancha (37m .. 68m)
        if (p.side === team && (p.slotIndex === 2 || p.slotIndex === 3)) {
          p.x = team === 'home' ? 16.5 : PITCH.LENGTH - 16.5;
          p.y = p.slotIndex === 2 ? PITCH.HALF_Y - 13.5 : PITCH.HALF_Y + 13.5;
          p.facing = team === 'home' ? 0 : Math.PI;
          continue;
        }
        const normX = Math.max(0.18, Math.min(0.85, slot.x));
        if (p.side === 'home') {
          p.x = 37 + normX * 28;
          p.facing = 0;
        } else {
          p.x = PITCH.LENGTH - (37 + normX * 28);
          p.facing = Math.PI;
        }
        p.y = Math.max(5, Math.min(PITCH.WIDTH - 5, slot.y * PITCH.WIDTH));
      }
      this.showBanner(
        `Saque de meta · ${taker?.player.name ?? 'Arquero'} (${shortTeam})`
      );
    } else if (type === 'corner') {
      // Posicionar atacantes y defensores dentro del área penal listos para cabecear,
      // más una opción de córner en corto y dos jugadores en la medialuna para el rebote
      const goalX = team === 'home' ? PITCH.LENGTH : 0;
      const boxDir = team === 'home' ? -1 : 1; // Hacia el centro de la cancha desde la línea de gol
      const attackers = this.players.filter(
        (p) => p.side === team && !p.redCard && p.id !== taker?.id && p.player.position !== 'GK'
      );
      const defenders = this.players.filter(
        (p) => p.side === defendingSide && !p.redCard && p.player.position !== 'GK'
      );

      const headerSpots = [
        { dx: 7.2, y: PITCH.HALF_Y - 3.8 }, // Primer palo
        { dx: 9.5, y: PITCH.HALF_Y + 0.4 }, // Punto penal
        { dx: 11.2, y: PITCH.HALF_Y + 4.5 }, // Segundo palo
        { dx: 13.4, y: PITCH.HALF_Y - 2.2 }, // Entrada del corazón del área
        { dx: 8.4, y: PITCH.HALF_Y + 6.2 }, // Diagonal segundo palo
      ];

      attackers.forEach((att, idx) => {
        if (idx < headerSpots.length) {
          const spot = headerSpots[idx];
          att.x = goalX + boxDir * spot.dx;
          att.y = spot.y;
        } else if (idx === 5) {
          // Opción de córner en corto cerca del banderín
          att.x = goalX + boxDir * 9.5;
          att.y = this.restartY < PITCH.HALF_Y ? 7.5 : PITCH.WIDTH - 7.5;
        } else if (idx === 6) {
          // Medialuna para cazar el rebote
          att.x = goalX + boxDir * 20.5;
          att.y = PITCH.HALF_Y;
        } else {
          // Cobertura defensiva en mitad de cancha contra el contragolpe
          att.x = PITCH.HALF_X + -boxDir * (6 + idx * 2.5);
          att.y = PITCH.HALF_Y + (idx % 2 === 0 ? -10 : 10);
        }
        att.facing = Math.atan2(PITCH.HALF_Y - att.y, goalX - att.x);
      });

      defenders.forEach((def, idx) => {
        if (idx < headerSpots.length) {
          // Marca personal dentro del área chica/punto penal
          const spot = headerSpots[idx];
          def.x = goalX + boxDir * Math.max(4.5, spot.dx - 1.1);
          def.y = spot.y + (idx % 2 === 0 ? 0.6 : -0.6);
        } else if (idx === 5) {
          // Defensor en el primer palo
          def.x = goalX + boxDir * 1.4;
          def.y =
            this.restartY < PITCH.HALF_Y
              ? PITCH.HALF_Y - PITCH.GOAL_HALF + 0.5
              : PITCH.HALF_Y + PITCH.GOAL_HALF - 0.5;
        } else if (idx < 8) {
          // Borde del área
          def.x = goalX + boxDir * 15.5;
          def.y = PITCH.HALF_Y + (idx === 6 ? -6 : 6);
        } else {
          // Delantero rival listo para contragolpear en el círculo central
          def.x = PITCH.HALF_X;
          def.y = PITCH.HALF_Y + (idx % 2 === 0 ? -7 : 7);
        }
        def.facing = Math.atan2(this.restartY - def.y, this.restartX - def.x);
      });

      this.showBanner(
        `🚩 Tiro de esquina · ${taker?.player.name ?? shortTeam} (${shortTeam})`
      );
      this.onCommentary?.({
        type: 'corner',
        playerName: taker?.player.name,
        teamName: fullTeam,
      });

      this.cutsceneState = {
        active: true,
        type: 'corner',
        timer: 1.85,
        duration: 1.85,
        skippable: true,
        focusX: this.restartX,
        focusY: this.restartY,
        playerId: taker?.id,
        playerName: taker?.player.name,
        playerNumber: taker?.player.number,
        teamSide: team,
        teamName: fullTeam,
        title: `TIRO DE ESQUINA · ${shortTeam}`,
        subtitle: `Ejecuta ${taker?.player.name ?? 'Especialista'} (#${taker?.player.number ?? 10})`,
      };
    } else if (type === 'throw_in') {
      // Posicionar receptores cercanos en la banda para que el saque de banda con las manos sea fluido y realista
      const inwardDirY = this.restartY < PITCH.HALF_Y ? 1 : -1;
      const forwardDirX = team === 'home' ? 1 : -1;
      const mates = this.players
        .filter((p) => p.side === team && !p.redCard && p.id !== taker?.id && p.player.position !== 'GK')
        .sort(
          (a, b) =>
            Math.hypot(a.x - this.restartX, a.y - this.restartY) -
            Math.hypot(b.x - this.restartX, b.y - this.restartY)
        );

      const receiverSpots = [
        { dx: forwardDirX * 7.5, dy: inwardDirY * 6.5 },
        { dx: -forwardDirX * 5.5, dy: inwardDirY * 5.8 },
        { dx: forwardDirX * 13.0, dy: inwardDirY * 12.0 },
      ];
      mates.slice(0, 3).forEach((m, idx) => {
        const sp = receiverSpots[idx];
        m.x = Math.max(3, Math.min(PITCH.LENGTH - 3, this.restartX + sp.dx));
        m.y = Math.max(4, Math.min(PITCH.WIDTH - 4, this.restartY + sp.dy));
        m.facing = Math.atan2(this.restartY - m.y, this.restartX - m.x);
      });

      this.showBanner(
        `Saque de banda · ${taker?.player.name ?? shortTeam} (${shortTeam})`
      );

      this.cutsceneState = {
        active: true,
        type: 'throw_in',
        timer: 1.5,
        duration: 1.5,
        skippable: true,
        focusX: this.restartX,
        focusY: this.restartY,
        playerId: taker?.id,
        playerName: taker?.player.name,
        playerNumber: taker?.player.number,
        teamSide: team,
        teamName: fullTeam,
        title: `SAQUE DE BANDA · ${shortTeam}`,
        subtitle: `${taker?.player.name ?? 'Lateral'} (#${taker?.player.number ?? 2})`,
      };
    }

    const oppGoalX = team === 'home' ? PITCH.LENGTH : 0;
    const distToOppGoal = Math.hypot(
      oppGoalX - this.restartX,
      PITCH.HALF_Y - this.restartY
    );

    const wallIds: string[] = [];
    if (type === 'free_kick' && distToOppGoal < 42) {
      const dx = oppGoalX - this.restartX;
      const dy = PITCH.HALF_Y - this.restartY;
      const d = Math.max(1, Math.hypot(dx, dy));
      const ux = dx / d;
      const uy = dy / d;
      const px = -uy;
      const py = ux;

      const wallDist = Math.min(9.15, d * 0.55);
      const wallCenterX = this.restartX + ux * wallDist;
      const wallCenterY = this.restartY + uy * wallDist;

      const wallCandidates = this.players
        .filter((p) => p.side === defendingSide && !p.redCard && p.player.position !== 'GK')
        .slice(0, distToOppGoal < 26 ? 4 : 3);

      wallCandidates.forEach((wp, idx) => {
        const offset = (idx - (wallCandidates.length - 1) / 2) * 0.86;
        wp.x = Math.max(2, Math.min(PITCH.LENGTH - 2, wallCenterX + px * offset));
        wp.y = Math.max(2, Math.min(PITCH.WIDTH - 2, wallCenterY + py * offset));
        wp.facing = Math.atan2(-uy, -ux);
        wp.inWall = true;
        wallIds.push(wp.id);
      });

      this.onCommentary?.({
        type: 'free_kick',
        playerName: taker?.player.name,
        teamName: team === 'home' ? this.homeTeam.name : this.awayTeam.name,
      });
    }

    if (
      (team === this.userSide || (this.twoPlayerMode && team === 'away')) &&
      (type === 'penalty' || (type === 'free_kick' && distToOppGoal < 40))
    ) {
      this.freeKickState = {
        awaitingUserInput: true,
        isInMatchPenalty: type === 'penalty',
        aimOffset: 0.25,
        aimHeight: type === 'penalty' ? 0.45 : 0.68,
        power: 0.78,
        curve: type === 'penalty' ? 0.15 : 0.55,
        strikeType: 'curva',
        wallPlayerIds: wallIds,
      };
    }
  }

  private executeAiSetPiece(preferShortOption = false): void {
    // En saque de arco (goal_kick), garantizar que SIEMPRE patee el ARQUERO (position === 'GK')
    const taker =
      this.restartType === 'goal_kick'
        ? this.players.find(
            (p) => p.side === this.restartTeam && !p.redCard && p.player.position === 'GK'
          ) ?? this.players.find((p) => p.id === this.ball.ownerId)
        : this.players.find((p) => p.id === this.ball.ownerId);
    if (!taker) return;

    if (this.restartType === 'goal_kick') {
      this.ball.ownerId = taker.id;
      this.ball.x = taker.side === 'home' ? 5.5 : PITCH.LENGTH - 5.5;
      this.ball.y = PITCH.HALF_Y;
      taker.x = this.ball.x + (taker.side === 'home' ? -0.55 : 0.55);
      taker.y = PITCH.HALF_Y;
      taker.facing = taker.side === 'home' ? 0 : Math.PI;
      taker.gkAction = 'distribute';
      taker.animState = 'pass';

      const candidates = this.players.filter(
        (p) =>
          p.side === taker.side &&
          p.id !== taker.id &&
          !p.redCard &&
          p.player.position !== 'GK'
      );

      // Si el usuario pulsa PASE (preferShortOption = true), el arquero toca en corto a un defensor central abierto;
      // de lo contrario, ejecuta el pelotazo largo al mediocampo.
      const shortDefender = preferShortOption
        ? candidates
            .slice()
            .sort(
              (a, b) =>
                Math.hypot(a.x - taker.x, a.y - taker.y) -
                Math.hypot(b.x - taker.x, b.y - taker.y)
            )[0]
        : undefined;

      const targetMate =
        shortDefender ??
        candidates.find((p) => p.slotIndex >= 5 && p.slotIndex <= 8) ??
        candidates[Math.floor(this.rng() * Math.max(1, candidates.length))];

      const tx = targetMate ? targetMate.x : PITCH.HALF_X;
      const ty = targetMate ? targetMate.y : PITCH.HALF_Y + (this.rng() - 0.5) * 18;
      if (shortDefender) {
        this.kickBallToward(taker, tx, ty, 15.5, 0.35, true, 'colocado');
      } else {
        this.kickBallToward(taker, tx, ty, 23.5, 5.4, true, 'globo');
      }
      if (taker.side === this.userSide && targetMate) {
        this.activeUserPlayerId = targetMate.id;
      } else if (this.twoPlayerMode && taker.side === 'away' && targetMate) {
        this.activeUser2PlayerId = targetMate.id;
      }
      const gkTeam = taker.side === 'home' ? this.homeTeam.name : this.awayTeam.name;
      this.onCommentary?.({
        type: 'pass',
        playerName: taker.player.name,
        teamName: gkTeam,
      });
      return;
    }

    if (this.restartType === 'corner') {
      // Tiro de esquina IFAB: centro bombeado con rosca (chanfle) al punto penal/cabeceadores, o córner en corto si preferShortOption
      const mates = this.players.filter(
        (p) =>
          p.side === taker.side &&
          p.id !== taker.id &&
          !p.redCard &&
          p.player.position !== 'GK'
      );
      if (preferShortOption) {
        const nearest = mates
          .slice()
          .sort(
            (a, b) =>
              Math.hypot(a.x - taker.x, a.y - taker.y) -
              Math.hypot(b.x - taker.x, b.y - taker.y)
          )[0];
        if (nearest) {
          this.performPass(taker, nearest.x, nearest.y, false);
          return;
        }
      }
      const boxHeaders = mates.filter((m) =>
        taker.side === 'home' ? m.x > PITCH.LENGTH - 18 : m.x < 18
      );
      const targetHeader =
        boxHeaders[Math.floor(this.rng() * Math.max(1, boxHeaders.length))] ?? mates[0];
      const goalX = taker.side === 'home' ? PITCH.LENGTH : 0;
      const boxDir = taker.side === 'home' ? -1 : 1;
      const tx = targetHeader ? targetHeader.x : goalX + boxDir * 9.5;
      const ty = targetHeader ? targetHeader.y : PITCH.HALF_Y + (this.rng() - 0.5) * 6;

      taker.kickAnimTimer = 0.34;
      taker.animState = 'cross';
      this.ball.z = 0.08;
      this.kickBallToward(taker, tx, ty, 20.5, 5.6, true, 'curva');
      // Chanfle / Efecto Magnus hacia el arco en el tiro de esquina
      const inswingSign =
        (taker.side === 'home' && taker.y < PITCH.HALF_Y) ||
        (taker.side === 'away' && taker.y >= PITCH.HALF_Y)
          ? 1
          : -1;
      this.ball.spin = inswingSign * 4.2;

      if (taker.side === this.userSide && targetHeader) {
        this.activeUserPlayerId = targetHeader.id;
      } else if (this.twoPlayerMode && taker.side === 'away' && targetHeader) {
        this.activeUser2PlayerId = targetHeader.id;
      }
      return;
    }

    if (this.restartType === 'throw_in') {
      // Saque de banda IFAB ejecutado con ambas manos desde arriba de la cabeza hacia el receptor más cercano
      const mates = this.players
        .filter(
          (p) =>
            p.side === taker.side &&
            p.id !== taker.id &&
            !p.redCard &&
            p.player.position !== 'GK'
        )
        .sort(
          (a, b) =>
            Math.hypot(a.x - taker.x, a.y - taker.y) -
            Math.hypot(b.x - taker.x, b.y - taker.y)
        );
      const targetMate = mates[0];
      const tx = targetMate ? targetMate.x : PITCH.HALF_X;
      const ty = targetMate
        ? targetMate.y
        : taker.y < PITCH.HALF_Y
        ? 8.5
        : PITCH.WIDTH - 8.5;

      taker.facing = Math.atan2(ty - taker.y, tx - taker.x);
      taker.kickAnimTimer = 0.32;
      taker.animState = 'throw_in';
      this.ball.x = taker.x;
      this.ball.y = taker.y;
      this.ball.z = 1.85;
      this.kickBallToward(taker, tx, ty, 13.5, 1.45, true, 'colocado');
      if (taker.side === this.userSide && targetMate) {
        this.activeUserPlayerId = targetMate.id;
      } else if (this.twoPlayerMode && taker.side === 'away' && targetMate) {
        this.activeUser2PlayerId = targetMate.id;
      }
      return;
    }

    const oppGoalX = taker.side === 'home' ? PITCH.LENGTH : 0;
    const distToGoal = Math.hypot(oppGoalX - taker.x, PITCH.HALF_Y - taker.y);

    if (
      this.restartType === 'penalty' ||
      (this.restartType === 'free_kick' && distToGoal < 27)
    ) {
      this.executeFreeKickOrInMatchPenalty(
        (this.rng() < 0.5 ? -1 : 1) * (0.45 + this.rng() * 0.35),
        0.55,
        0.78,
        (this.rng() < 0.5 ? -1 : 1) * 0.55,
        'curva'
      );
      return;
    }
    const targetMate = this.players.find(
      (p) => p.side === taker.side && p.id !== taker.id && !p.redCard && p.player.position !== 'GK'
    );
    if (targetMate) {
      this.performPass(taker, targetMate.x, targetMate.y, false);
    }
  }

  public setUserTactic(tactic: TacticalStyle): void {
    if (this.userSide === 'home') this.homeTactic = tactic;
    else if (this.userSide === 'away') this.awayTactic = tactic;
    this.setCoachMoods(
      this.userSide === 'home' ? 'instruct' : this.homeCoachMood,
      this.userSide === 'away' ? 'instruct' : this.awayCoachMood,
      3.0
    );
    this.showBanner(`Táctica del Técnico: ${tactic.replace('_', ' ')}`);
  }

  public setUserFormation(formationId: string): void {
    if (this.userSide === 'home') {
      this.homeFormationId = formationId;
      this.homeTeam.formationId = formationId;
    } else if (this.userSide === 'away') {
      this.awayFormationId = formationId;
      this.awayTeam.formationId = formationId;
    }
    this.setCoachMoods(
      this.userSide === 'home' ? 'instruct' : this.homeCoachMood,
      this.userSide === 'away' ? 'instruct' : this.awayCoachMood,
      3.2
    );
    this.showBanner(`Formación del Técnico: ${formationId}`);
  }

  public makeSubstitution(
    side: 'home' | 'away',
    outPlayerId: string,
    inSubIndex: number
  ): boolean {
    const maxSubs = this.settings.match.maxSubstitutions;
    const used = side === 'home' ? this.homeSubsUsed : this.awaySubsUsed;
    if (used >= maxSubs) return false;

    const team = side === 'home' ? this.homeTeam : this.awayTeam;
    const outState = this.players.find((p) => p.id === outPlayerId && p.side === side);
    const subPlayer = team.players[inSubIndex];
    if (!outState || !subPlayer || outState.redCard) return false;

    const outName = outState.player.name;
    outState.player = subPlayer;
    outState.stamina = 100;
    outState.yellowCards = 0;
    outState.injured = false;
    if (side === 'home') this.homeSubsUsed++;
    else this.awaySubsUsed++;

    this.pushEvent('sub', side, subPlayer.name, undefined, `Entra por ${outName}`);
    this.showBanner(`Cambio ${team.shortName}: Entra ${subPlayer.name} por ${outName}`);
    this.setCoachMoods(
      side === 'home' ? 'instruct' : this.homeCoachMood,
      side === 'away' ? 'instruct' : this.awayCoachMood,
      3.0
    );
    this.onCommentary?.({
      type: 'substitution',
      playerName: subPlayer.name,
      teamName: team.name,
    });
    return true;
  }

  /**
   * Intercambia la posición táctica en cancha entre dos titulares (para el menú de Pausa -> Cambiar Posición).
   */
  public swapPlayerPositions(side: 'home' | 'away', playerAId: string, playerBId: string): boolean {
    if (playerAId === playerBId) return false;
    const pA = this.players.find((p) => p.side === side && p.id === playerAId);
    const pB = this.players.find((p) => p.side === side && p.id === playerBId);
    if (!pA || !pB) return false;

    const tmpSlot = pA.slotIndex;
    pA.slotIndex = pB.slotIndex;
    pB.slotIndex = tmpSlot;

    const tmpX = pA.x;
    const tmpY = pA.y;
    pA.x = pB.x;
    pA.y = pB.y;
    pB.x = tmpX;
    pB.y = tmpY;

    this.showBanner(`Cambio táctico de posición: ${pA.player.name} ⇄ ${pB.player.name}`);
    return true;
  }

  /**
   * Modo Tormenta (99% de probabilidad) y Easter Egg de Lluvia:
   * Un rayo cae del cielo sobre un jugador de campo al azar, con trueno, chispas y aturdimiento temporal.
   */
  public triggerLightningEasterEgg(force = false): boolean {
    if (
      !force &&
      this.settings.match.weather !== 'lluvia' &&
      this.settings.match.weather !== 'tormenta'
    ) {
      return false;
    }
    const candidates = this.players.filter((p) => !p.redCard && p.player.position !== 'GK');
    if (candidates.length === 0) return false;

    const victim = candidates[Math.floor(Math.random() * candidates.length)];
    victim.fallTimer = 2.4;
    victim.stunTimer = 2.6;
    victim.animState = 'fall';
    victim.vx = 0;
    victim.vy = 0;

    if (this.ball.ownerId === victim.id) {
      this.ball.ownerId = null;
      this.ball.vx = (this.rng() - 0.5) * 9;
      this.ball.vy = (this.rng() - 0.5) * 9;
      this.ball.vz = 4.2;
    }

    this.lightningState = {
      active: true,
      timer: 1.85,
      targetPlayerId: victim.id,
      targetPlayerName: victim.player.name,
      teamSide: victim.side,
      x: victim.x,
      y: victim.y,
    };

    this.cameraShake = 0.85;
    this.onSound?.('thunder');
    this.emitParticles(victim.x, victim.y, 0.2, 22, 'spark');
    this.showBanner(`⚡ ¡RAYO EN EL CAMPO! ¡Impactó cerca de ${victim.player.name}!`);
    return true;
  }

  /**
   * 3. CAMBIO AUTOMÁTICO DE JUGADOR INTELIGENTE (Smart Auto-Switching tipo EA SPORTS FC):
   * - Cambia automáticamente al futbolista de campo del usuario mejor posicionado para interceptar
   *   la trayectoria futura del balón cuando se pierde la posesión o el balón viaja a otra zona.
   * - Incluye histéresis (0.22s) y umbral de ventaja (1.25m) para que el cambio sea fluido, natural y sin parpadeos.
   */
  public stepSmartAutoPlayerSwitch(dt: number): void {
    if (this.userSide !== 'none') {
      this.stepSmartAutoSwitchForSide(this.userSide, dt, false);
    }
    if (this.twoPlayerMode) {
      this.stepSmartAutoSwitchForSide('away', dt, true);
    }
  }

  private stepSmartAutoSwitchForSide(side: 'home' | 'away', dt: number, isPlayer2: boolean): void {
    if (isPlayer2) {
      this.autoSwitchCooldown2 = Math.max(0, this.autoSwitchCooldown2 - dt);
    } else {
      this.autoSwitchCooldown = Math.max(0, this.autoSwitchCooldown - dt);
    }

    const activeId = isPlayer2 ? this.activeUser2PlayerId : this.activeUserPlayerId;
    const cooldown = isPlayer2 ? this.autoSwitchCooldown2 : this.autoSwitchCooldown;

    const owner = this.players.find((p) => p.id === this.ball.ownerId) ?? null;
    if (owner && owner.side === side) {
      if (isPlayer2) {
        this.activeUser2PlayerId = owner.id;
      } else {
        this.activeUserPlayerId = owner.id;
      }
      return;
    }

    const currentActive = this.players.find(
      (p) => p.id === activeId && p.side === side && !p.redCard
    );

    // Si el jugador activo está barriéndose o muy cerca del balón (< 2.1m), mantener el control para no interrumpir al usuario
    if (currentActive) {
      const distCurrentToBall = Math.hypot(currentActive.x - this.ball.x, currentActive.y - this.ball.y);
      if (currentActive.slideTimer > 0 || distCurrentToBall < 2.1) {
        return;
      }
    }

    if (cooldown > 0 && currentActive) return;

    const ballInfo = {
      x: this.ball.x,
      y: this.ball.y,
      z: this.ball.z,
      vx: this.ball.vx,
      vy: this.ball.vy,
      vz: this.ball.vz,
      spin: this.ball.spin,
      ownerTeam: owner?.side ?? this.ball.lastTouchTeam,
      ownerId: owner?.id ?? null,
    };

    let bestCandidate: MatchPlayerState | null = null;
    let bestInterceptDist = Infinity;
    let currentInterceptDist = Infinity;

    for (const p of this.players) {
      if (p.side !== side || p.redCard || p.player.position === 'GK') continue;
      const node = this.toAINode(p);
      const interceptPt = owner
        ? {
            x: owner.x + Math.cos(owner.facing) * 1.4,
            y: owner.y + Math.sin(owner.facing) * 1.4,
          }
        : computeBallInterceptPoint(node, ballInfo);
      const d = Math.hypot(p.x - interceptPt.x, p.y - interceptPt.y);
      if (p.id === currentActive?.id) {
        currentInterceptDist = d;
      }
      if (d < bestInterceptDist) {
        bestInterceptDist = d;
        bestCandidate = p;
      }
    }

    const userInputForSide = isPlayer2 ? this.userInput2 : this.userInput;
    const isActivelySteering =
      Math.hypot(userInputForSide.moveX, userInputForSide.moveY) > 0.15;
    const switchAdvantageMargin = isActivelySteering ? 3.5 : 1.25;

    if (
      bestCandidate &&
      (!currentActive ||
        (bestCandidate.id !== currentActive.id &&
          bestInterceptDist + switchAdvantageMargin < currentInterceptDist))
    ) {
      if (isPlayer2) {
        this.activeUser2PlayerId = bestCandidate.id;
        this.autoSwitchCooldown2 = 0.24;
      } else {
        this.activeUserPlayerId = bestCandidate.id;
        this.autoSwitchCooldown = 0.24;
      }
    }
  }

  /**
   * 4 & 8. DISPUTAS AÉREAS Y CABEZAZOS REALISTAS:
   * Cuando la pelota viaja por el aire (z > 0.95m), los jugadores cercanos saltan y disputan
   * el balón aéreo según cabeceo (heading), fuerza física (strength), altura y fatiga.
   */
  private stepAerialDuels(dt: number): void {
    this.aerialDuelCooldown = Math.max(0, this.aerialDuelCooldown - dt);
    if (this.aerialDuelCooldown > 0 || this.ball.ownerId !== null || this.ball.z < 0.95 || this.ball.z > 2.65) {
      return;
    }

    const homeContenders = this.players
      .filter(
        (p) =>
          p.side === 'home' &&
          !p.redCard &&
          p.player.position !== 'GK' &&
          p.stunTimer <= 0 &&
          Math.hypot(p.x - this.ball.x, p.y - this.ball.y) < 1.95
      )
      .sort((a, b) => Math.hypot(a.x - this.ball.x, a.y - this.ball.y) - Math.hypot(b.x - this.ball.x, b.y - this.ball.y));

    const awayContenders = this.players
      .filter(
        (p) =>
          p.side === 'away' &&
          !p.redCard &&
          p.player.position !== 'GK' &&
          p.stunTimer <= 0 &&
          Math.hypot(p.x - this.ball.x, p.y - this.ball.y) < 1.95
      )
      .sort((a, b) => Math.hypot(a.x - this.ball.x, a.y - this.ball.y) - Math.hypot(b.x - this.ball.x, b.y - this.ball.y));

    if (homeContenders.length === 0 || awayContenders.length === 0) return;

    const pHome = homeContenders[0];
    const pAway = awayContenders[0];

    pHome.jumpTimer = 0.38;
    pAway.jumpTimer = 0.38;
    pHome.animState = 'jump';
    pAway.animState = 'jump';

    const duel = evaluateAerialDuel(pHome, pAway, this.ball, this.rng);
    const winner = duel.winnerId === pHome.id ? pHome : pAway;
    const loser = duel.winnerId === pHome.id ? pAway : pHome;

    winner.headerTimer = 0.36;
    winner.animState = 'header';
    loser.stunTimer = 0.28;
    this.aerialDuelCooldown = 0.55;

    const attackDir = winner.side === 'home' ? 1 : -1;
    const oppGoalX = winner.side === 'home' ? PITCH.LENGTH : 0;
    const distToOppGoal = Math.hypot(oppGoalX - winner.x, PITCH.HALF_Y - winner.y);

    if (distToOppGoal < 18.5) {
      // Cabezazo directo al arco en área rival
      this.performShot(
        winner,
        oppGoalX,
        PITCH.HALF_Y + (this.rng() - 0.5) * 4.2,
        0.72
      );
    } else {
      // Cabezazo de despeje o habilitación a compañero
      const targetX = Math.max(4, Math.min(PITCH.LENGTH - 4, winner.x + attackDir * 14));
      const targetY = Math.max(4, Math.min(PITCH.WIDTH - 4, winner.y + (this.rng() - 0.5) * 12));
      this.kickBallToward(winner, targetX, targetY, 15.5, 2.8, true, 'cabezazo');
      this.onSound?.('header_thud');
    }
  }

  /**
   * 6. SISTEMA COMPLETO DE VAR (Video Assistant Referee) con los 5 escenarios oficiales:
   * - 'offside_goal': Posible gol en fuera de juego
   * - 'penalty_check': Posible penal en el área
   * - 'foul_buildup_goal': Gol anulado por infracción previa en la jugada
   * - 'direct_red_check': Posible tarjeta roja directa
   * - 'mistaken_identity': Confusión de identidad sobre quién cometió la infracción
   */
  public triggerVARReview(
    scenario: VARScenarioType,
    subjectPlayer: MatchPlayerState,
    focusX: number,
    focusY: number,
    decisionConfirmed: boolean,
    onResolve?: () => void
  ): void {
    const teamName = subjectPlayer.side === 'home' ? this.homeTeam.name : this.awayTeam.name;
    const shortTeam = subjectPlayer.side === 'home' ? this.homeTeam.shortName : this.awayTeam.shortName;

    const scenarioMeta: Record<
      VARScenarioType,
      { title: string; subtitle: string; decisionTrue: string; decisionFalse: string }
    > = {
      offside_goal: {
        title: 'REVISIÓN VAR · POSIBLE FUERA DE JUEGO EN GOL',
        subtitle: `Trazando línea virtual 3D sobre #${subjectPlayer.player.number} ${subjectPlayer.player.name}`,
        decisionTrue: `DECISIÓN FINAL: GOL ANULADO POR FUERA DE JUEGO (${shortTeam})`,
        decisionFalse: `DECISIÓN FINAL: GOL CONVALIDADO · POSICIÓN HABILITADA (${shortTeam})`,
      },
      penalty_check: {
        title: 'REVISIÓN VAR · POSIBLE PENAL EN EL ÁREA',
        subtitle: `Analizando contacto defensivo de #${subjectPlayer.player.number} ${subjectPlayer.player.name}`,
        decisionTrue: `DECISIÓN FINAL: ¡PENAL CONFIRMADO POR EL VAR!`,
        decisionFalse: `DECISIÓN FINAL: NO HAY PENAL · CONTACTO LEGAL AL BALÓN`,
      },
      foul_buildup_goal: {
        title: 'REVISIÓN VAR · POSIBLE INFRACCIÓN PREVIA AL GOL',
        subtitle: `Revisando recuperación previa de #${subjectPlayer.player.number} ${subjectPlayer.player.name}`,
        decisionTrue: `DECISIÓN FINAL: GOL ANULADO POR FALTA PREVIA EN LA JUGADA`,
        decisionFalse: `DECISIÓN FINAL: GOL VÁLIDO · RECUPERACIÓN LIMPIA`,
      },
      direct_red_check: {
        title: 'REVISIÓN VAR · POSIBLE TARJETA ROJA DIRECTA',
        subtitle: `Evaluando intensidad y punto de impacto de #${subjectPlayer.player.number} ${subjectPlayer.player.name}`,
        decisionTrue: `DECISIÓN FINAL: 🟥 TARJETA ROJA DIRECTA CONFIRMADA (#${subjectPlayer.player.number} ${subjectPlayer.player.name})`,
        decisionFalse: `DECISIÓN FINAL: SE MANTIENE TARJETA AMARILLA`,
      },
      mistaken_identity: {
        title: 'REVISIÓN VAR · IDENTIDAD DEL INFRACTOR',
        subtitle: `Verificando dorsal del jugador que cometió la falta (${teamName})`,
        decisionTrue: `DECISIÓN FINAL: RECTIFICACIÓN · TARJETA PARA #${subjectPlayer.player.number} ${subjectPlayer.player.name}`,
        decisionFalse: `DECISIÓN FINAL: IDENTIDAD ORIGINAL CONFIRMADA`,
      },
    };

    const meta = scenarioMeta[scenario];
    const totalDuration = 3.2;

    this.varReviewState = {
      active: true,
      scenario,
      title: meta.title,
      subtitle: meta.subtitle,
      phase: 'checking',
      timer: totalDuration,
      totalDuration,
      cameraAngleIndex: 1,
      decisionText: decisionConfirmed ? meta.decisionTrue : meta.decisionFalse,
      decisionConfirmed,
      involvedPlayerName: subjectPlayer.player.name,
      involvedPlayerNumber: subjectPlayer.player.number,
      teamSide: subjectPlayer.side,
      teamName,
      lineX: focusX,
      defenderLineX: Math.max(4, Math.min(PITCH.LENGTH - 4, focusX + (subjectPlayer.side === 'home' ? -0.45 : 0.45))),
      focusX,
      focusY,
      onResolve,
    };

    this.onSound?.('whistle_short');
    this.showBanner(`📺 VAR EN REVISIÓN: ${meta.title}`);
  }

  /**
   * Permite activar o probar cualquiera de los 5 escenarios del VAR en vivo (desde el Centro de Pausa o en jugadas).
   */
  public triggerVARReviewDemo(scenario: VARScenarioType = 'offside_goal'): boolean {
    const candidates = this.players.filter((p) => !p.redCard && p.player.position !== 'GK');
    if (candidates.length === 0) return false;
    const subject =
      candidates.find((p) => p.id === this.activeUserPlayerId) ??
      candidates[Math.floor(this.rng() * candidates.length)];

    const focusX =
      scenario === 'penalty_check'
        ? subject.side === 'home'
          ? PITCH.LENGTH - 11
          : 11
        : subject.x;
    const focusY = scenario === 'penalty_check' ? PITCH.HALF_Y : subject.y;

    this.triggerVARReview(scenario, subject, focusX, focusY, true, () => {
      this.showBanner(this.varReviewState?.decisionText ?? 'Decisión VAR aplicada');
    });
    return true;
  }

  private stepVARReview(dt: number): void {
    const vr = this.varReviewState;
    if (!vr || !vr.active) return;

    vr.timer = Math.max(0, vr.timer - dt);
    const elapsed = vr.totalDuration - vr.timer;
    const progress = elapsed / vr.totalDuration;

    if (progress < 0.32) {
      vr.cameraAngleIndex = 1;
      vr.phase = 'checking';
    } else if (progress < 0.64) {
      vr.cameraAngleIndex = 2;
      vr.phase = 'checking';
    } else {
      vr.cameraAngleIndex = 3;
      if (vr.phase !== 'decision') {
        vr.phase = 'decision';
        this.onSound?.('whistle_short');
        this.showBanner(`📺 ${vr.decisionText}`);
      }
    }

    if (vr.timer <= 0) {
      const callback = vr.onResolve;
      this.varReviewState = null;
      callback?.();
    }
  }

  private findNearestOutfieldId(
    side: 'home' | 'away',
    excludeId?: string | null
  ): string | null {
    let bestId: string | null = null;
    let bestDist = 9999;
    for (const p of this.players) {
      if (
        p.side !== side ||
        p.redCard ||
        p.player.position === 'GK' ||
        p.id === excludeId
      )
        continue;
      const d =
        Math.hypot(p.x - this.ball.x, p.y - this.ball.y) +
        Math.abs(p.y - this.ball.y) * 0.025;
      if (d < bestDist) {
        bestDist = d;
        bestId = p.id;
      }
    }
    return bestId;
  }

  public selectNearestUserPlayer(): void {
    if (this.userSide !== 'none') {
      this.activeUserPlayerId = this.findNearestOutfieldId(this.userSide);
    }
    if (this.twoPlayerMode) {
      this.activeUser2PlayerId = this.findNearestOutfieldId('away');
    }
  }

  public switchToNextBestUserPlayer(side?: 'home' | 'away'): void {
    const targetSide = side ?? (this.userSide === 'away' ? 'away' : 'home');
    const isPlayer2 = this.twoPlayerMode && targetSide === 'away' && this.userSide !== 'away';
    if (!isPlayer2 && this.userSide === 'none') return;

    const ballInfo = {
      x: this.ball.x,
      y: this.ball.y,
      z: this.ball.z,
      vx: this.ball.vx,
      vy: this.ball.vy,
      vz: this.ball.vz,
      spin: this.ball.spin,
      ownerTeam: this.ball.lastTouchTeam,
      ownerId: this.ball.ownerId,
    };
    const candidates = this.players
      .filter(
        (p) => p.side === targetSide && !p.redCard && p.player.position !== 'GK'
      )
      .sort((a, b) => {
        const ptA = computeBallInterceptPoint(this.toAINode(a), ballInfo);
        const ptB = computeBallInterceptPoint(this.toAINode(b), ballInfo);
        return (
          Math.hypot(a.x - ptA.x, a.y - ptA.y) -
          Math.hypot(b.x - ptB.x, b.y - ptB.y)
        );
      });
    if (candidates.length === 0) return;

    if (isPlayer2) {
      this.autoSwitchCooldown2 = 0.55;
      if (candidates[0].id !== this.activeUser2PlayerId) {
        this.activeUser2PlayerId = candidates[0].id;
      } else if (candidates.length > 1) {
        this.activeUser2PlayerId = candidates[1].id;
      }
    } else {
      this.autoSwitchCooldown = 0.55;
      if (candidates[0].id !== this.activeUserPlayerId) {
        this.activeUserPlayerId = candidates[0].id;
      } else if (candidates.length > 1) {
        this.activeUserPlayerId = candidates[1].id;
      }
    }
  }

  private pushEvent(
    type: MatchEventRecord['type'],
    teamSide: 'home' | 'away',
    playerName: string,
    assistName?: string,
    detail?: string
  ): void {
    this.events.push({
      id: `ev_${this.events.length}_${Math.round(this.matchMinute)}`,
      minute: Math.max(1, Math.round(this.matchMinute)),
      type,
      teamSide,
      playerName,
      assistName,
      detail,
    });
  }

  private showBanner(text: string): void {
    this.bannerText = text;
    this.bannerTimer = 2.4;
  }

  /**
   * Buffer circular optimizado que graba muestras a ~30Hz (o en eventos de sonido)
   * de posición, rotación, estado de animación esquelética de todos los jugadores y del balón.
   */
  private recordReplayFrame(): void {
    this.replaySampleTick = (this.replaySampleTick + 1) % 3;
    if (this.replaySampleTick !== 0 && !this.frameSoundEvent && this.replayBuffer.length > 24) {
      return;
    }
    this.replayBuffer.push({
      ballX: this.ball.x,
      ballY: this.ball.y,
      ballZ: this.ball.z,
      ballVx: this.ball.vx,
      ballVy: this.ball.vy,
      ballVz: this.ball.vz,
      ballSpin: this.ball.spin,
      soundEvent: this.frameSoundEvent,
      players: this.players.map((p) => ({
        id: p.id,
        side: p.side,
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        facing: p.facing,
        lookTargetAngle: p.lookTargetAngle,
        animState: p.animState,
        stridePhase: p.stridePhase,
        leanForward: p.leanForward,
        leanBank: p.leanBank,
        kickAnimTimer: p.kickAnimTimer,
        slideTimer: p.slideTimer,
        diveTimer: p.diveTimer,
        diveDirY: p.diveDirY,
        fallTimer: p.fallTimer,
        footIkLeftY: p.footIkLeftY,
        footIkRightY: p.footIkRightY,
        number: p.player.number,
      })),
    });
    if (this.replayBuffer.length > 240) {
      this.replayBuffer.splice(0, 40);
    }
  }

  public buildResultSummary(): MatchResultSummary {
    return {
      id: `match_${Date.now()}`,
      dateIso: new Date().toISOString(),
      mode: this.mode,
      difficulty: this.difficulty,
      homeTeamId: this.homeTeam.id,
      homeTeamName: this.homeTeam.name,
      awayTeamId: this.awayTeam.id,
      awayTeamName: this.awayTeam.name,
      homeScore: this.homeScore,
      awayScore: this.awayScore,
      wentToExtraTime: this.half >= 3,
      penaltyScore: this.penaltyState
        ? { home: this.penaltyState.homeScored, away: this.penaltyState.awayScored }
        : undefined,
      homeStats: { ...this.homeStats },
      awayStats: { ...this.awayStats },
      events: [...this.events],
      userSide: this.userSide,
    };
  }
}
