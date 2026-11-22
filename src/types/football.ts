export type Confederation =
  | 'UEFA'
  | 'CONMEBOL'
  | 'CONCACAF'
  | 'CAF'
  | 'AFC'
  | 'OFC'
  | 'NON_FIFA';

export type PlayerPosition =
  | 'GK'
  | 'CB'
  | 'LB'
  | 'RB'
  | 'CDM'
  | 'CM'
  | 'CAM'
  | 'LW'
  | 'RW'
  | 'ST';

export type DominantFoot = 'Derecho' | 'Izquierdo' | 'Ambidiestro';

export interface PlayerAttributes {
  pace: number;         // Velocidad
  acceleration: number; // Aceleración
  stamina: number;      // Resistencia
  strength: number;     // Fuerza
  ballControl: number;  // Control del balón
  dribbling: number;    // Regate
  shortPassing: number; // Pase corto
  longPassing: number;  // Pase largo
  vision: number;       // Visión
  finishing: number;    // Definición
  shotPower: number;    // Potencia de tiro
  accuracy: number;     // Precisión
  heading: number;      // Cabeceo
  marking: number;      // Marcaje
  tackling: number;     // Entrada
  positioning: number;  // Posicionamiento
  reflexes: number;     // Reflejos
  reactions: number;    // Capacidad de reacción
}

export type BodyBuildType = 'delgado' | 'atletico' | 'robusto';

export interface Player {
  id: string;
  name: string;
  number: number;
  position: PlayerPosition;
  age: number;
  nationality: string;
  heightCm: number;
  bodyBuild?: BodyBuildType;
  preferredFoot: DominantFoot;
  overall: number;
  potential: number;
  fitness: number; // 0-100
  morale: number;  // 0-100
  form: number;    // 1-10
  injuredMatches: number;
  suspendedMatches: number;
  yellowAccumulated: number;
  seasonGoals: number;
  seasonAssists: number;
  attributes: PlayerAttributes;
  aspecto?: PlayerAppearance;
  isProcedural?: boolean;
}

export type HairstyleType =
  | 'corto'
  | 'rapado'
  | 'rulos'
  | 'trenzas'
  | 'largo'
  | 'vincha'
  | 'rodete'
  | 'degradado'
  | 'afro';

export type BeardType = 'ninguna' | 'candado' | 'corta' | 'completa';

export type PreferredFootCode = 'D' | 'I' | 'A';

export interface PlayerAppearance {
  tonoPiel: string;
  peinado: HairstyleType;
  colorPelo: string;
  barba: BeardType;
  alturaCm: number;
  colorBotines: string;
  piernaHabil: PreferredFootCode;
}

export type KitPattern = 'solid' | 'stripes' | 'hoops' | 'sash' | 'halves';
export type CrestStatus = 'authentic_heraldry' | 'official_imported' | 'pending_official';
export type KitSelection = 'home' | 'away' | 'third';

export interface CrestConfig {
  shape: 'shield' | 'circle' | 'diamond' | 'banner';
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  symbol: 'star' | 'ball' | 'crown' | 'eagle' | 'stripes' | 'flame';
}

export interface StadiumConfig {
  id: string;
  name: string;
  city: string;
  capacity: number;
  turfTone: 'emerald' | 'classic' | 'deep' | 'worn';
  standColor: string;
  hasRoof: boolean;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  type: 'club' | 'national';
  country: string;
  countryCode: string;
  confederation: Confederation;
  leagueId?: string;
  leagueName?: string;
  division?: number; // 1, 2, 3, or 0 for historic/international
  city?: string;
  flag?: string;
  primaryColor: string;
  secondaryColor: string;
  awayColor: string;
  awaySecondaryColor?: string;
  awayPattern?: KitPattern;
  thirdColor?: string;
  thirdSecondaryColor?: string;
  thirdPattern?: KitPattern;
  gkPrimaryColor?: string;
  gkSecondaryColor?: string;
  kitPattern: KitPattern;
  crest: CrestConfig;
  crestUrl?: string;
  logoUrl?: string;
  worldCupStars?: number;
  crestStatus?: CrestStatus;
  stadium: StadiumConfig;
  formationId: string;
  tacticalStyle: TacticalStyle;
  overall: number;
  attack: number;
  midfield: number;
  defense: number;
  budgetMillions: number;
  rosterSource: 'curated' | 'procedural' | 'custom';
  isHistoric?: boolean;
  isNonFifa?: boolean;
  players: Player[];
}

export type DifficultyLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  1: 'Muy fácil',
  2: 'Fácil',
  3: 'Normal',
  4: 'Difícil',
  5: 'Muy difícil',
  6: 'Experto',
  7: 'Leyenda',
  8: 'ULTRA DIFÍCIL',
};

export type TacticalStyle =
  | 'EQUILIBRADO'
  | 'PRESION_ALTA'
  | 'BLOQUE_BAJO'
  | 'CONTRAATAQUE'
  | 'POSESION'
  | 'JUEGO_BANDAS'
  | 'DEFENSA_ADELANTADA';

export const TACTICAL_LABELS: Record<TacticalStyle, string> = {
  EQUILIBRADO: 'Equilibrado',
  PRESION_ALTA: 'Presión alta',
  BLOQUE_BAJO: 'Bloque bajo',
  CONTRAATAQUE: 'Contraataque',
  POSESION: 'Posesión',
  JUEGO_BANDAS: 'Juego por bandas',
  DEFENSA_ADELANTADA: 'Defensa adelantada',
};

export type WeatherType = 'despejado' | 'lluvia' | 'tormenta' | 'neblina' | 'nieve' | 'viento';
export type TimeOfDay = 'dia' | 'atardecer' | 'noche';
export type PitchCondition = 'optimo' | 'humedo' | 'pesado' | 'barro';

export type GameMode =
  | 'quick_match'
  | 'player_career'
  | 'manager_career'
  | 'club_career'
  | 'world_cup'
  | 'continental_cup'
  | 'league'
  | 'club_cup'
  | 'penalties'
  | 'training'
  | 'challenges'
  | 'survival'
  | 'custom_tournament'
  | 'all_star';

export type ControlScheme = 'classic' | 'simplified' | 'auto_assist';

export interface GameSettings {
  match: {
    halfDurationMinutes: 2 | 3 | 4 | 5 | 8 | 10;
    difficulty: DifficultyLevel;
    gameSpeed: 'lento' | 'normal' | 'rapido';
    realismLevel: 'arcade' | 'equilibrado' | 'simulacion';
    extraTimeEnabled: boolean;
    penaltiesEnabled: boolean;
    offsideEnabled: boolean;
    maxSubstitutions: 3 | 5;
    weather: WeatherType;
    timeOfDay: TimeOfDay;
    pitchCondition: PitchCondition;
  };
  visual: {
    quality: 'baja' | 'media' | 'alta' | 'ultra';
    adaptiveResolution: boolean;
    shadows: boolean;
    effects: boolean;
    animations: boolean;
    cameraMode: 'broadcast' | 'panoramica' | 'tele' | 'dinamica' | 'vertical';
    cameraZoom: number; // 0.8 to 1.3
    fpsLimit?: 30 | 60 | 120 | 'auto';
    forceLandscape?: boolean;
    showRadar: boolean;
    showStaminaBars: boolean;
  };
  audio: {
    masterMuted: boolean;
    musicVolume: number;      // 0-1
    commentaryVolume: number; // 0-1
    crowdVolume: number;      // 0-1
    sfxVolume: number;        // 0-1
    commentaryEnabled?: boolean;
    commentaryStyle?: 'argentino_pro' | 'latino_dinamico' | 'english_tv';
    commentaryLanguage?: 'es-AR' | 'es-419' | 'en-US';
    stadiumAmbienceEnabled?: boolean;
    spicyCrowdMode?: boolean; // "Modo hinchada picante" (insultos y folclore de cancha)
  };
  controls: {
    scheme: ControlScheme;
    buttonSize: number; // 0.75 to 1.4
    joystickSize: number; // 0.75 to 1.4
    bottomOffset: number; // 0 to 48 px
    sideOffset: number;   // 0 to 48 px
    sensitivity: number;  // 0.6 to 1.5
    vibration: boolean;
    passAssist: boolean;
    shotAssist: boolean;
    alwaysShowTouchControls: boolean;
  };
  profile: {
    userName: string;
    avatarColor: string;
    favoriteTeamId: string;
    language: 'es' | 'en';
    theme: 'dark' | 'light';
  };
}

export interface MatchEventRecord {
  id: string;
  minute: number;
  type: 'goal' | 'yellow' | 'red' | 'sub' | 'injury' | 'offside' | 'save';
  teamSide: 'home' | 'away';
  playerName: string;
  assistName?: string;
  detail?: string;
}

export interface MatchTeamStats {
  goals: number;
  shots: number;
  shotsOnTarget: number;
  possessionTime: number;
  passesAttempted: number;
  passesCompleted: number;
  tackles: number;
  fouls: number;
  corners: number;
  offsides: number;
  saves: number;
  yellowCards: number;
  redCards: number;
}

export interface MatchResultSummary {
  id: string;
  dateIso: string;
  mode: GameMode;
  difficulty: DifficultyLevel;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  wentToExtraTime: boolean;
  penaltyScore?: { home: number; away: number };
  homeStats: MatchTeamStats;
  awayStats: MatchTeamStats;
  events: MatchEventRecord[];
  userSide: 'home' | 'away' | 'none';
}

export interface CareerProfile {
  playerCareer: {
    active: boolean;
    playerName: string;
    position: PlayerPosition;
    nationality: string;
    clubId: string;
    age: number;
    overall: number;
    potential: number;
    matchesPlayed: number;
    goals: number;
    assists: number;
    xp: number;
    trophies: number;
    season: number;
    fixtureIndex: number;
    matchRatings: number[];
  };
  managerCareer: {
    active: boolean;
    managerName: string;
    clubId: string;
    season: number;
    budgetMillions: number;
    boardConfidence: number; // 0-100
    tacticalStyle: TacticalStyle;
    wins: number;
    draws: number;
    losses: number;
    trophies: string[];
  };
  clubCareer: {
    active: boolean;
    clubId: string;
    season: number;
    budgetMillions: number;
    stadiumLevel: number;   // 1-5
    academyLevel: number;   // 1-5
    medicalLevel: number;   // 1-5
    trainingLevel: number;  // 1-5
    youthProspects: Player[];
    trophies: string[];
  };
}

export interface LeagueStandingRow {
  teamId: string;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

export interface FixtureItem {
  id: string;
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  homeGoals?: number;
  awayGoals?: number;
  played: boolean;
}

export interface CompetitionState {
  id: string;
  name: string;
  mode: GameMode;
  teamIds: string[];
  userTeamId: string;
  stage: 'groups' | 'knockout' | 'league' | 'completed';
  currentRound: number;
  fixtures: FixtureItem[];
  standings: LeagueStandingRow[];
  championTeamId?: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: 'partidos' | 'dificultad' | 'carrera' | 'editor' | 'habilidad';
  unlocked: boolean;
  unlockedAt?: string;
  progress: number;
  target: number;
}

export interface CareerStatsAggregate {
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsScored: number;
  goalsConceded: number;
  ultraDifficultWins: number;
  penaltiesWon: number;
  cleanSheets: number;
  hatTricks: number;
  survivalBestStreak: number;
  trophies: string[];
  history: MatchResultSummary[];
}

export interface ChallengeScenario {
  id: string;
  title: string;
  description: string;
  homeTeamId: string;
  awayTeamId: string;
  userSide: 'home' | 'away';
  startMinute: number;
  initialHomeGoals: number;
  initialAwayGoals: number;
  difficulty: DifficultyLevel;
  objectiveType: 'win' | 'comeback' | 'hold_lead' | 'score_two';
  objectiveLabel: string;
}

export type UnlockableCategory = 'ball' | 'retro_kit' | 'stadium_theme';

export interface UnlockableItem {
  id: string;
  name: string;
  description: string;
  category: UnlockableCategory;
  price: number;
  previewColor: string;
  secondaryColor: string;
  unlockedByDefault?: boolean;
  primaryColor?: string;
  accentColor?: string;
  previewPrimaryColor?: string;
  previewSecondaryColor?: string;
  previewAccentColor?: string;
  badgeText?: string;
}

export interface ProgressionStoreState {
  coins: number;
  unlockedItemIds: string[];
  equippedBallId: string;
  equippedRetroKitId: string;
  equippedStadiumThemeId: string;
  equippedKitStyleId?: string;
  lastCoinReward?: {
    amount: number;
    breakdown: string;
  };
}

