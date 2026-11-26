import type {
  Achievement,
  CareerProfile,
  CareerStatsAggregate,
  CompetitionState,
  GameSettings,
  MatchResultSummary,
  ProgressionStoreState,
  Team,
  UnlockableItem,
} from '../types/football';

const STORAGE_KEY = 'atlas_futbol_pro_save_v3';

export const UNLOCKABLE_ITEMS: UnlockableItem[] = [
  // Balls
  {
    id: 'ball_pro_official',
    name: 'Atlas Pro Match Ball',
    description: 'Balón oficial de alta visibilidad con paneles termosellados.',
    category: 'ball',
    price: 0,
    unlockedByDefault: true,
    previewColor: '#F8FAFC',
    secondaryColor: '#2563EB',
    accentColor: '#F59E0B',
  },
  {
    id: 'ball_tango_78',
    name: 'Clásico Tango 78',
    description: 'Diseño histórico de tríadas negras inspirado en los mundiales clásicos.',
    category: 'ball',
    price: 250,
    previewColor: '#F1F5F9',
    secondaryColor: '#0F172A',
    accentColor: '#38BDF8',
  },
  {
    id: 'ball_fevernova_gold',
    name: 'Fever Dorado 2002',
    description: 'Edición dorada de precisión asiática con trigonometría dinámica.',
    category: 'ball',
    price: 400,
    previewColor: '#FEF3C7',
    secondaryColor: '#D97706',
    accentColor: '#DC2626',
  },
  {
    id: 'ball_total90_yellow',
    name: 'Hi-Vis Total 90 Amarillo',
    description: 'Balón amarillo flúor de invierno con anillos aerodinámicos.',
    category: 'ball',
    price: 450,
    previewColor: '#FACC15',
    secondaryColor: '#1E293B',
    accentColor: '#EA580C',
  },
  {
    id: 'ball_star_champions',
    name: 'Estrella Champions Finale',
    description: 'Paneles estelares metalizados para noches mágicas de copa.',
    category: 'ball',
    price: 650,
    previewColor: '#FFFFFF',
    secondaryColor: '#1D4ED8',
    accentColor: '#38BDF8',
  },

  // Retro / Special Kits
  {
    id: 'kit_modern_pro',
    name: 'Equipación Oficial Actual',
    description: 'Tejido técnico moderno con los colores oficiales de cada club.',
    category: 'retro_kit',
    price: 0,
    unlockedByDefault: true,
    previewColor: '#10B981',
    secondaryColor: '#0F172A',
    accentColor: '#FFFFFF',
  },
  {
    id: 'kit_retro_90s',
    name: 'Camiseta Retro Años 90',
    description: 'Cuello polo clásico, franjas noventeras y dorsales vintage.',
    category: 'retro_kit',
    price: 350,
    previewColor: '#DC2626',
    secondaryColor: '#F8FAFC',
    accentColor: '#FACC15',
  },
  {
    id: 'kit_gold_legend',
    name: 'Edición Leyenda Oro & Negro',
    description: 'Detalles y ribetes dorados de campeón en las camisetas titulares.',
    category: 'retro_kit',
    price: 550,
    previewColor: '#111827',
    secondaryColor: '#F59E0B',
    accentColor: '#FEF08A',
  },
  {
    id: 'kit_neon_night',
    name: 'Edición Nocturna Cyber Flúor',
    description: 'Acentos neón de alto contraste para partidos bajo reflectores.',
    category: 'retro_kit',
    price: 600,
    previewColor: '#06B6D4',
    secondaryColor: '#090D16',
    accentColor: '#EC4899',
  },

  // Monumental Stadium Themes
  {
    id: 'stadium_imperial_red',
    name: 'Coliseo Imperial Rojo',
    description: 'Gradas monumentales de 3 bandejas con arquitectura roja clásica.',
    category: 'stadium_theme',
    price: 0,
    unlockedByDefault: true,
    previewColor: '#991B1B',
    secondaryColor: '#1E293B',
    accentColor: '#F8FAFC',
  },
  {
    id: 'stadium_royal_blue',
    name: 'Arena Metropolitana Azul',
    description: 'Anillos azules olímpicos con pantallas gigantes LED cian.',
    category: 'stadium_theme',
    price: 400,
    previewColor: '#1D4ED8',
    secondaryColor: '#0F172A',
    accentColor: '#38BDF8',
  },
  {
    id: 'stadium_champions_gold',
    name: 'Templo Dorado de Finales',
    description: 'Cúpula iluminada en oro imperial y atmósfera de Gran Final.',
    category: 'stadium_theme',
    price: 700,
    previewColor: '#B45309',
    secondaryColor: '#111827',
    accentColor: '#FDE047',
  },
  {
    id: 'stadium_south_america_ultras',
    name: 'Caldera Sudamericana Monumental',
    description: 'Tribunas vibrantes con máxima densidad de banderas y bengalas.',
    category: 'stadium_theme',
    price: 500,
    previewColor: '#047857',
    secondaryColor: '#064E3B',
    accentColor: '#FACC15',
  },
];

export const INITIAL_STORE_STATE: ProgressionStoreState = {
  coins: 450,
  unlockedItemIds: ['ball_pro_official', 'kit_modern_pro', 'stadium_imperial_red'],
  equippedBallId: 'ball_pro_official',
  equippedRetroKitId: 'kit_modern_pro',
  equippedStadiumThemeId: 'stadium_imperial_red',
};

export const DEFAULT_SETTINGS: GameSettings = {
  match: {
    halfDurationMinutes: 3,
    difficulty: 3,
    gameSpeed: 'normal',
    realismLevel: 'equilibrado',
    extraTimeEnabled: true,
    penaltiesEnabled: true,
    offsideEnabled: true,
    maxSubstitutions: 5,
    weather: 'despejado',
    timeOfDay: 'noche',
    pitchCondition: 'optimo',
    racingTitansUnlocked: false,
    racingTitansEnabled: false,
  },
  visual: {
    quality: 'alta',
    adaptiveResolution: true,
    shadows: true,
    effects: true,
    animations: true,
    cameraMode: 'broadcast',
    cameraZoom: 1.0,
    fpsLimit: 60,
    forceLandscape: true,
    showRadar: true,
    showStaminaBars: true,
  },
  audio: {
    masterMuted: false,
    musicVolume: 0.45,
    commentaryVolume: 0.92,
    crowdVolume: 0.78,
    sfxVolume: 0.85,
    commentaryEnabled: true,
    commentaryStyle: 'argentino_pro',
    commentaryLanguage: 'es-AR',
    stadiumAmbienceEnabled: true,
    spicyCrowdMode: true,
  },
  controls: {
    scheme: 'classic',
    buttonSize: 1.0,
    joystickSize: 1.0,
    bottomOffset: 16,
    sideOffset: 16,
    sensitivity: 1.0,
    vibration: true,
    passAssist: true,
    shotAssist: true,
    alwaysShowTouchControls: false,
  },
  profile: {
    userName: 'Míster Atlas',
    avatarColor: '#10B981',
    favoriteTeamId: 'club_rma',
    language: 'es',
    theme: 'dark',
  },
};

export const INITIAL_ACHIEVEMENTS: Achievement[] = [
  { id: 'ach_first_match', title: 'Debut en el Césped', description: 'Completa tu primer partido oficial.', category: 'partidos', unlocked: false, progress: 0, target: 1 },
  { id: 'ach_first_win', title: 'Primera Victoria', description: 'Gana un partido en cualquier modo.', category: 'partidos', unlocked: false, progress: 0, target: 1 },
  { id: 'ach_clean_sheet', title: 'Muralla Invicta', description: 'Termina un partido sin recibir goles.', category: 'habilidad', unlocked: false, progress: 0, target: 1 },
  { id: 'ach_penalty_king', title: 'Nervios de Acero', description: 'Gana una tanda de penales.', category: 'habilidad', unlocked: false, progress: 0, target: 1 },
  { id: 'ach_ultra_slayer', title: 'Leyenda ULTRA DIFÍCIL', description: 'Derrota a la IA en nivel 8: ULTRA DIFÍCIL.', category: 'dificultad', unlocked: false, progress: 0, target: 1 },
  { id: 'ach_survival_5', title: 'Superviviente de Élite', description: 'Alcanza una racha de 5 victorias en Modo Supervivencia.', category: 'partidos', unlocked: false, progress: 0, target: 5 },
  { id: 'ach_trophy', title: 'Vitrina Inaugurada', description: 'Conquista tu primer trofeo de Liga o Copa.', category: 'carrera', unlocked: false, progress: 0, target: 1 },
  { id: 'ach_creator', title: 'Arquitecto del Fútbol', description: 'Crea o edita un club personalizado en el Editor.', category: 'editor', unlocked: false, progress: 0, target: 1 },
];

export const INITIAL_CAREER: CareerProfile = {
  playerCareer: {
    active: false,
    playerName: 'Leo Navarro',
    position: 'ST',
    nationality: 'España',
    clubId: 'club_bet',
    age: 19,
    overall: 71,
    potential: 91,
    matchesPlayed: 0,
    goals: 0,
    assists: 0,
    xp: 0,
    trophies: 0,
    season: 1,
    fixtureIndex: 0,
    matchRatings: [],
  },
  managerCareer: {
    active: false,
    managerName: 'Míster Atlas',
    clubId: 'club_sev',
    season: 1,
    budgetMillions: 52,
    boardConfidence: 75,
    tacticalStyle: 'EQUILIBRADO',
    wins: 0,
    draws: 0,
    losses: 0,
    trophies: [],
  },
  clubCareer: {
    active: false,
    clubId: 'club_dep',
    season: 1,
    budgetMillions: 16,
    stadiumLevel: 2,
    academyLevel: 2,
    medicalLevel: 1,
    trainingLevel: 2,
    youthProspects: [],
    trophies: [],
  },
};

export const INITIAL_STATS: CareerStatsAggregate = {
  matchesPlayed: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  goalsScored: 0,
  goalsConceded: 0,
  ultraDifficultWins: 0,
  penaltiesWon: 0,
  cleanSheets: 0,
  hatTricks: 0,
  survivalBestStreak: 0,
  trophies: [],
  history: [],
};

export interface SaveState {
  settings: GameSettings;
  customTeams: Team[];
  career: CareerProfile;
  stats: CareerStatsAggregate;
  achievements: Achievement[];
  activeCompetition: CompetitionState | null;
  survivalStreak: number;
  store: ProgressionStoreState;
}

export function getDefaultSaveState(): SaveState {
  return {
    settings: structuredClone(DEFAULT_SETTINGS),
    customTeams: [],
    career: structuredClone(INITIAL_CAREER),
    stats: structuredClone(INITIAL_STATS),
    achievements: structuredClone(INITIAL_ACHIEVEMENTS),
    activeCompetition: null,
    survivalStreak: 0,
    store: structuredClone(INITIAL_STORE_STATE),
  };
}

export function loadSaveState(): SaveState {
  if (typeof window === 'undefined' || !window.localStorage) {
    return getDefaultSaveState();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultSaveState();
    const parsed = JSON.parse(raw) as Partial<SaveState>;
    const def = getDefaultSaveState();
    return {
      settings: {
        match: { ...def.settings.match, ...parsed.settings?.match },
        visual: { ...def.settings.visual, ...parsed.settings?.visual },
        audio: { ...def.settings.audio, ...parsed.settings?.audio },
        controls: { ...def.settings.controls, ...parsed.settings?.controls },
        profile: { ...def.settings.profile, ...parsed.settings?.profile },
      },
      customTeams: Array.isArray(parsed.customTeams) ? parsed.customTeams : [],
      career: {
        playerCareer: { ...def.career.playerCareer, ...parsed.career?.playerCareer },
        managerCareer: { ...def.career.managerCareer, ...parsed.career?.managerCareer },
        clubCareer: { ...def.career.clubCareer, ...parsed.career?.clubCareer },
      },
      stats: { ...def.stats, ...parsed.stats },
      achievements: Array.isArray(parsed.achievements) && parsed.achievements.length >= def.achievements.length
        ? parsed.achievements
        : def.achievements,
      activeCompetition: parsed.activeCompetition ?? null,
      survivalStreak: parsed.survivalStreak ?? 0,
      store: {
        ...def.store,
        ...parsed.store,
        unlockedItemIds: Array.isArray(parsed.store?.unlockedItemIds)
          ? Array.from(new Set([...def.store.unlockedItemIds, ...parsed.store!.unlockedItemIds]))
          : def.store.unlockedItemIds,
      },
    };
  } catch {
    return getDefaultSaveState();
  }
}

export function persistSaveState(state: SaveState): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage quota full fallback: trim history
    try {
      const trimmed = { ...state, stats: { ...state.stats, history: state.stats.history.slice(0, 15) } };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Ignore storage error gracefully
    }
  }
}

export function calculateMatchCoinReward(summary: MatchResultSummary, wonTrophy = false): number {
  const userGoals = summary.userSide === 'home' ? summary.homeScore : summary.awayScore;
  const oppGoals = summary.userSide === 'home' ? summary.awayScore : summary.homeScore;
  const wonPenalty =
    summary.penaltyScore &&
    ((summary.userSide === 'home' && summary.penaltyScore.home > summary.penaltyScore.away) ||
      (summary.userSide === 'away' && summary.penaltyScore.away > summary.penaltyScore.home));
  const userWon = userGoals > oppGoals || Boolean(wonPenalty);
  const userDrew = userGoals === oppGoals && !wonPenalty;

  const baseReward = 100;
  const goalBonus = Math.min(8, userGoals) * 45;
  const resultBonus = userWon ? 140 : userDrew ? 50 : 0;
  const difficultyBonus = summary.difficulty * 15;
  const trophyBonus = wonTrophy ? 500 : 0;
  return baseReward + goalBonus + resultBonus + difficultyBonus + trophyBonus;
}

export function purchaseUnlockableItem(
  state: SaveState,
  itemId: string
): { state: SaveState; success: boolean; reason?: string } {
  const item = UNLOCKABLE_ITEMS.find((i) => i.id === itemId);
  if (!item) return { state, success: false, reason: 'Artículo no encontrado' };
  if (state.store.unlockedItemIds.includes(itemId)) {
    return { state: equipUnlockableItem(state, itemId), success: true };
  }
  if (state.store.coins < item.price) {
    return { state, success: false, reason: 'Monedas insuficientes' };
  }
  const updatedStore: ProgressionStoreState = {
    ...state.store,
    coins: state.store.coins - item.price,
    unlockedItemIds: [...state.store.unlockedItemIds, itemId],
    equippedBallId: item.category === 'ball' ? item.id : state.store.equippedBallId,
    equippedRetroKitId: item.category === 'retro_kit' ? item.id : state.store.equippedRetroKitId,
    equippedStadiumThemeId: item.category === 'stadium_theme' ? item.id : state.store.equippedStadiumThemeId,
  };
  return {
    state: { ...state, store: updatedStore },
    success: true,
  };
}

export function equipUnlockableItem(state: SaveState, itemId: string): SaveState {
  const item = UNLOCKABLE_ITEMS.find((i) => i.id === itemId);
  if (!item || !state.store.unlockedItemIds.includes(itemId)) return state;
  return {
    ...state,
    store: {
      ...state.store,
      equippedBallId: item.category === 'ball' ? item.id : state.store.equippedBallId,
      equippedRetroKitId: item.category === 'retro_kit' ? item.id : state.store.equippedRetroKitId,
      equippedStadiumThemeId: item.category === 'stadium_theme' ? item.id : state.store.equippedStadiumThemeId,
    },
  };
}

export function recordMatchIntoSave(state: SaveState, summary: MatchResultSummary, wonTrophy = false): SaveState {
  const userGoals = summary.userSide === 'home' ? summary.homeScore : summary.awayScore;
  const oppGoals = summary.userSide === 'home' ? summary.awayScore : summary.homeScore;
  const wonPenalty =
    summary.penaltyScore &&
    ((summary.userSide === 'home' && summary.penaltyScore.home > summary.penaltyScore.away) ||
      (summary.userSide === 'away' && summary.penaltyScore.away > summary.penaltyScore.home));
  const lostPenalty =
    summary.penaltyScore &&
    ((summary.userSide === 'home' && summary.penaltyScore.home < summary.penaltyScore.away) ||
      (summary.userSide === 'away' && summary.penaltyScore.away < summary.penaltyScore.home));

  const userWon = userGoals > oppGoals || Boolean(wonPenalty);
  const userDrew = userGoals === oppGoals && !wonPenalty && !lostPenalty;

  const earnedCoins = calculateMatchCoinReward(summary, wonTrophy);

  const stats: CareerStatsAggregate = {
    ...state.stats,
    matchesPlayed: state.stats.matchesPlayed + 1,
    wins: state.stats.wins + (userWon ? 1 : 0),
    draws: state.stats.draws + (userDrew ? 1 : 0),
    losses: state.stats.losses + (!userWon && !userDrew ? 1 : 0),
    goalsScored: state.stats.goalsScored + userGoals,
    goalsConceded: state.stats.goalsConceded + oppGoals,
    ultraDifficultWins: state.stats.ultraDifficultWins + (userWon && summary.difficulty === 8 ? 1 : 0),
    penaltiesWon: state.stats.penaltiesWon + (wonPenalty ? 1 : 0),
    cleanSheets: state.stats.cleanSheets + (oppGoals === 0 ? 1 : 0),
    history: [summary, ...state.stats.history].slice(0, 40),
  };

  let survivalStreak = state.survivalStreak;
  if (summary.mode === 'survival') {
    survivalStreak = userWon ? survivalStreak + 1 : 0;
    if (survivalStreak > stats.survivalBestStreak) {
      stats.survivalBestStreak = survivalStreak;
    }
  }

  const nowIso = new Date().toISOString();
  const achievements = state.achievements.map((ach) => {
    let progress = ach.progress;
    if (ach.id === 'ach_first_match') progress = Math.max(progress, stats.matchesPlayed);
    if (ach.id === 'ach_first_win') progress = Math.max(progress, stats.wins);
    if (ach.id === 'ach_clean_sheet') progress = Math.max(progress, stats.cleanSheets);
    if (ach.id === 'ach_penalty_king') progress = Math.max(progress, stats.penaltiesWon);
    if (ach.id === 'ach_ultra_slayer') progress = Math.max(progress, stats.ultraDifficultWins);
    if (ach.id === 'ach_survival_5') progress = Math.max(progress, stats.survivalBestStreak);
    if (ach.id === 'ach_trophy') progress = Math.max(progress, stats.trophies.length);
    const unlocked = ach.unlocked || progress >= ach.target;
    return {
      ...ach,
      progress: Math.min(ach.target, progress),
      unlocked,
      unlockedAt: unlocked && !ach.unlocked ? nowIso : ach.unlockedAt,
    };
  });

  const userTeamId = summary.userSide === 'home' ? summary.homeTeamId : summary.awayTeamId;
  const userTeamName = (summary.userSide === 'home' ? summary.homeTeamName : summary.awayTeamName).toLowerCase();
  const wonWithRacing =
    userWon &&
    (userTeamId === 'club_rac' ||
      userTeamId === 'rac' ||
      userTeamName.includes('racing club') ||
      userTeamName === 'racing');

  return {
    ...state,
    settings: wonWithRacing
      ? {
          ...state.settings,
          match: {
            ...state.settings.match,
            racingTitansUnlocked: true,
            racingTitansEnabled: true,
          },
        }
      : state.settings,
    stats,
    achievements,
    survivalStreak,
    store: {
      ...state.store,
      coins: state.store.coins + earnedCoins,
    },
  };
}

