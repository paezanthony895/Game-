import { resolveActiveKitColors } from '../data/authenticAssets';
import type { GameMode, KitSelection, Team } from '../types/football';
import { PITCH } from './physics';

export type ClockRuleMode =
  | 'standard_90'
  | 'no_limit'
  | 'shootout_only'
  | 'golden_goal_extra';

export interface GameModeRuleConfig {
  modeId: GameMode;
  title: string;
  broadcastLabel: string;
  subtitle: string;
  rulesSummary: string;
  winConditionLabel: string;
  clockMode: ClockRuleMode;
  extraTimeOnDraw: boolean;
  penaltiesOnDraw: boolean;
  goldenGoalInExtraTime: boolean;
  isolatedPenaltyArena: boolean;
  passiveRivalAI: boolean;
  autoRepeatFreeKicks: boolean;
  nationalTeamsOnly: boolean;
  clubsOnly: boolean;
  allStarBoost: boolean;
  allowsPreMatchTeamSelect: boolean;
}

export const GAME_MODE_CONFIGS: Record<GameMode, GameModeRuleConfig> = {
  quick_match: {
    modeId: 'quick_match',
    title: 'Partido Rápido 11v11',
    broadcastLabel: 'FRIENDLY',
    subtitle: 'Enfrentamiento directo libre entre cualquier club, selección o leyenda',
    rulesSummary:
      'Partido reglamentario 11 contra 11 con selección libre de Local y Visitante, tácticas completas, modo 1P o 2P y resolución opcional por prórroga/penales.',
    winConditionLabel: 'Mayor marcador al minuto 90 (o prórroga/penales según ajustes)',
    clockMode: 'standard_90',
    extraTimeOnDraw: true,
    penaltiesOnDraw: true,
    goldenGoalInExtraTime: false,
    isolatedPenaltyArena: false,
    passiveRivalAI: false,
    autoRepeatFreeKicks: false,
    nationalTeamsOnly: false,
    clubsOnly: false,
    allStarBoost: false,
    allowsPreMatchTeamSelect: true,
  },
  penalties: {
    modeId: 'penalties',
    title: 'Tanda de Penales',
    broadcastLabel: 'PENALTY SHOOTOUT',
    subtitle: 'Duelo 1v1 en el área penal: 5 disparos alternados + muerte súbita',
    rulesSummary:
      'Escenario exclusivo en el área penal con únicamente el pateador y el arquero en cancha, cámara trasera enfocada al arco, barra de dirección/potencia y marcador de penales convertidos y errados.',
    winConditionLabel: 'Mejor de 5 penales alternados por equipo (+ muerte súbita si hay empate)',
    clockMode: 'shootout_only',
    extraTimeOnDraw: false,
    penaltiesOnDraw: true,
    goldenGoalInExtraTime: false,
    isolatedPenaltyArena: true,
    passiveRivalAI: false,
    autoRepeatFreeKicks: false,
    nationalTeamsOnly: false,
    clubsOnly: false,
    allStarBoost: false,
    allowsPreMatchTeamSelect: true,
  },
  training: {
    modeId: 'training',
    title: 'Entrenamiento y Tiros Libres',
    broadcastLabel: 'TRAINING ARENA',
    subtitle: 'Cancha abierta sin límite de tiempo y laboratorio de tiros libres con barrera',
    rulesSummary:
      'Práctica libre sin reloj límite ni rival agresivo. Incluye modo especial de Tiros Libres / Faltas con barrera, arquero, efecto (rosca) y potencia desde múltiples distancias y ángulos.',
    winConditionLabel: 'Sin límite de tiempo · Repetición instantánea de jugadas y tiros libres',
    clockMode: 'no_limit',
    extraTimeOnDraw: false,
    penaltiesOnDraw: false,
    goldenGoalInExtraTime: false,
    isolatedPenaltyArena: false,
    passiveRivalAI: true,
    autoRepeatFreeKicks: true,
    nationalTeamsOnly: false,
    clubsOnly: false,
    allStarBoost: false,
    allowsPreMatchTeamSelect: true,
  },
  world_cup: {
    modeId: 'world_cup',
    title: 'Copa del Mundo',
    broadcastLabel: 'WORLD CUP',
    subtitle: 'Torneo oficial de selecciones nacionales con fase final eliminatoria',
    rulesSummary:
      'Exclusivo para Selecciones Nacionales. En cruces directos el empate en los 90 minutos activa prórroga y tanda de penales reglamentaria.',
    winConditionLabel: 'Clasificar en el cuadro mundialista y levantar la Copa del Mundo',
    clockMode: 'standard_90',
    extraTimeOnDraw: true,
    penaltiesOnDraw: true,
    goldenGoalInExtraTime: false,
    isolatedPenaltyArena: false,
    passiveRivalAI: false,
    autoRepeatFreeKicks: false,
    nationalTeamsOnly: true,
    clubsOnly: false,
    allStarBoost: false,
    allowsPreMatchTeamSelect: false,
  },
  continental_cup: {
    modeId: 'continental_cup',
    title: 'Copa Continental',
    broadcastLabel: 'COPA CONTINENTAL',
    subtitle: 'Campeonato oficial de confederaciones (CONMEBOL, UEFA, CONCACAF, CAF, AFC)',
    rulesSummary:
      'Selecciones de una misma confederación en formato eliminatorio con tiempo extra y definición por penales en caso de igualdad.',
    winConditionLabel: 'Vencer en las rondas eliminatorias continentales',
    clockMode: 'standard_90',
    extraTimeOnDraw: true,
    penaltiesOnDraw: true,
    goldenGoalInExtraTime: false,
    isolatedPenaltyArena: false,
    passiveRivalAI: false,
    autoRepeatFreeKicks: false,
    nationalTeamsOnly: true,
    clubsOnly: false,
    allStarBoost: false,
    allowsPreMatchTeamSelect: false,
  },
  league: {
    modeId: 'league',
    title: 'Ligas Nacionales',
    broadcastLabel: 'LIGA PRIMERA',
    subtitle: 'Temporada regular por puntos (3 pts victoria, 1 pt empate, 0 pts derrota)',
    rulesSummary:
      'Partidos de 90 minutos reglamentarios sin prórroga ni penales. El resultado suma directamente en la tabla de posiciones oficial de la liga.',
    winConditionLabel: 'Sumar 3 puntos (el empate a los 90 minutos reparte 1 punto por equipo)',
    clockMode: 'standard_90',
    extraTimeOnDraw: false,
    penaltiesOnDraw: false,
    goldenGoalInExtraTime: false,
    isolatedPenaltyArena: false,
    passiveRivalAI: false,
    autoRepeatFreeKicks: false,
    nationalTeamsOnly: false,
    clubsOnly: true,
    allStarBoost: false,
    allowsPreMatchTeamSelect: false,
  },
  club_cup: {
    modeId: 'club_cup',
    title: 'Copas de Clubes',
    broadcastLabel: 'CHAMPIONS CUP',
    subtitle: 'Eliminatorias internacionales entre los mejores clubes del mundo',
    rulesSummary:
      'Duelos de eliminación directa entre clubes élite con prórroga de 30 minutos y tanda de penales obligatoria si persiste el empate.',
    winConditionLabel: 'Ganar la eliminatoria en 90 mins, prórroga o tanda de penales',
    clockMode: 'standard_90',
    extraTimeOnDraw: true,
    penaltiesOnDraw: true,
    goldenGoalInExtraTime: false,
    isolatedPenaltyArena: false,
    passiveRivalAI: false,
    autoRepeatFreeKicks: false,
    nationalTeamsOnly: false,
    clubsOnly: true,
    allStarBoost: false,
    allowsPreMatchTeamSelect: false,
  },
  player_career: {
    modeId: 'player_career',
    title: 'Carrera de Jugador',
    broadcastLabel: 'CARRERA PRO',
    subtitle: 'Protagoniza el partido con tu futbolista creado y sube tu media OVR',
    rulesSummary:
      'Tu estrella creada se integra como titular en la posición elegida. Cada gol, asistencia y victoria incrementa tu experiencia, nivel y valoración OVR.',
    winConditionLabel: 'Destacar en cancha con goles/asistencias y llevar a tu club al triunfo',
    clockMode: 'standard_90',
    extraTimeOnDraw: false,
    penaltiesOnDraw: false,
    goldenGoalInExtraTime: false,
    isolatedPenaltyArena: false,
    passiveRivalAI: false,
    autoRepeatFreeKicks: false,
    nationalTeamsOnly: false,
    clubsOnly: false,
    allStarBoost: false,
    allowsPreMatchTeamSelect: true,
  },
  manager_career: {
    modeId: 'manager_career',
    title: 'Carrera de Entrenador',
    broadcastLabel: 'CARRERA DT',
    subtitle: 'Dirige tácticamente a tu plantilla, cumple objetivos y gana presupuesto',
    rulesSummary:
      'Gestión técnica con impacto en confianza de la directiva y presupuesto de fichajes (+$3.5M por victoria, +$1M por empate).',
    winConditionLabel: 'Ganar el encuentro para aumentar la confianza de la directiva y presupuesto',
    clockMode: 'standard_90',
    extraTimeOnDraw: false,
    penaltiesOnDraw: false,
    goldenGoalInExtraTime: false,
    isolatedPenaltyArena: false,
    passiveRivalAI: false,
    autoRepeatFreeKicks: false,
    nationalTeamsOnly: false,
    clubsOnly: false,
    allStarBoost: false,
    allowsPreMatchTeamSelect: true,
  },
  club_career: {
    modeId: 'club_career',
    title: 'Carrera de Club',
    broadcastLabel: 'DINASTÍA CLUB',
    subtitle: 'Haz crecer tu institución, estadio, cantera y centro médico',
    rulesSummary:
      'Cada partido jugado genera ingresos de taquilla según el nivel de tu estadio y prestigio institucional (+$4M por victoria).',
    winConditionLabel: 'Sumar victorias para financiar mejoras de estadio, cantera y gimnasio',
    clockMode: 'standard_90',
    extraTimeOnDraw: false,
    penaltiesOnDraw: false,
    goldenGoalInExtraTime: false,
    isolatedPenaltyArena: false,
    passiveRivalAI: false,
    autoRepeatFreeKicks: false,
    nationalTeamsOnly: false,
    clubsOnly: false,
    allStarBoost: false,
    allowsPreMatchTeamSelect: true,
  },
  challenges: {
    modeId: 'challenges',
    title: 'Desafíos Históricos',
    broadcastLabel: 'DESAFÍO OFICIAL',
    subtitle: 'Escenarios con minuto inicial, marcador adverso y objetivo obligatorio',
    rulesSummary:
      'Inicia en el minuto y marcador exacto del escenario (ej. 0-2 en el 65’). Debes cumplir la condición de victoria antes del pitazo final.',
    winConditionLabel: 'Superar el objetivo específico del escenario antes del minuto 90',
    clockMode: 'standard_90',
    extraTimeOnDraw: false,
    penaltiesOnDraw: false,
    goldenGoalInExtraTime: false,
    isolatedPenaltyArena: false,
    passiveRivalAI: false,
    autoRepeatFreeKicks: false,
    nationalTeamsOnly: false,
    clubsOnly: false,
    allStarBoost: false,
    allowsPreMatchTeamSelect: false,
  },
  survival: {
    modeId: 'survival',
    title: 'Supervivencia (Gol de Oro)',
    broadcastLabel: 'SUPERVIVENCIA',
    subtitle: 'Racha de victorias consecutivas con dificultad creciente y Gol de Oro en empate',
    rulesSummary:
      'No se permiten empates: si el partido termina igualado al 90’, se activa prórroga con regla de GOL DE ORO (el primero que anota gana al instante) y penales.',
    winConditionLabel: 'Ganar sí o sí para mantener viva tu racha de supervivencia',
    clockMode: 'golden_goal_extra',
    extraTimeOnDraw: true,
    penaltiesOnDraw: true,
    goldenGoalInExtraTime: true,
    isolatedPenaltyArena: false,
    passiveRivalAI: false,
    autoRepeatFreeKicks: false,
    nationalTeamsOnly: false,
    clubsOnly: false,
    allStarBoost: false,
    allowsPreMatchTeamSelect: true,
  },
  custom_tournament: {
    modeId: 'custom_tournament',
    title: 'Torneo Personalizado',
    broadcastLabel: 'COPA CUSTOM',
    subtitle: 'Competición a medida con formato de grupos o eliminatoria directa',
    rulesSummary:
      'Reglas dinámicas según la fase del torneo personalizado (puntos en fase de grupos y prórroga + penales en cruces eliminatorios).',
    winConditionLabel: 'Avanzar de ronda hasta consagrarse campeón del torneo',
    clockMode: 'standard_90',
    extraTimeOnDraw: true,
    penaltiesOnDraw: true,
    goldenGoalInExtraTime: false,
    isolatedPenaltyArena: false,
    passiveRivalAI: false,
    autoRepeatFreeKicks: false,
    nationalTeamsOnly: false,
    clubsOnly: false,
    allStarBoost: false,
    allowsPreMatchTeamSelect: false,
  },
  all_star: {
    modeId: 'all_star',
    title: 'All-Star y Leyendas',
    broadcastLabel: 'ALL-STAR SHOWCASE',
    subtitle: 'Duelo de exhibición entre combinados de estrellas mundiales e históricos',
    rulesSummary:
      'Partido de alto espectáculo con frecuencia de regates especiales potenciada, definición por Gol de Oro en prórroga y tanda de penales.',
    winConditionLabel: 'Triunfar en el duelo de exhibición All-Star',
    clockMode: 'golden_goal_extra',
    extraTimeOnDraw: true,
    penaltiesOnDraw: true,
    goldenGoalInExtraTime: true,
    isolatedPenaltyArena: false,
    passiveRivalAI: false,
    autoRepeatFreeKicks: false,
    nationalTeamsOnly: false,
    clubsOnly: false,
    allStarBoost: true,
    allowsPreMatchTeamSelect: true,
  },
};

export function getGameModeConfig(mode: GameMode): GameModeRuleConfig {
  return GAME_MODE_CONFIGS[mode] ?? GAME_MODE_CONFIGS.quick_match;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '').trim();
  const num = parseInt(
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6),
    16
  );
  if (Number.isNaN(num)) return { r: 128, g: 128, b: 128 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function computeColorDistance(hexA: string, hexB: string): number {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11);
}

/**
 * Prevents visual kit clashes when the user selects the same team for Home and Away
 * or when both teams share closely matching primary jersey colors.
 */
export function resolveKitClash(
  homeTeam: Team,
  awayTeam: Team,
  requestedHomeKit: KitSelection = 'home',
  requestedAwayKit: KitSelection = 'home'
): {
  homeKit: KitSelection;
  awayKit: KitSelection;
  autoResolved: boolean;
  reason: string | null;
} {
  const homeColors = resolveActiveKitColors(homeTeam, requestedHomeKit);
  const awayColors = resolveActiveKitColors(awayTeam, requestedAwayKit);
  const sameTeam = homeTeam.id === awayTeam.id;
  const initialDist = computeColorDistance(homeColors.primary, awayColors.primary);

  if (sameTeam && requestedHomeKit === requestedAwayKit) {
    const candidates: KitSelection[] = ['away', 'third', 'home'].filter(
      (k): k is KitSelection => k !== requestedHomeKit
    );
    let bestKit: KitSelection = candidates[0] ?? 'away';
    let bestDist = -1;
    for (const cand of candidates) {
      const c = resolveActiveKitColors(awayTeam, cand);
      const d = computeColorDistance(homeColors.primary, c.primary);
      if (d > bestDist) {
        bestDist = d;
        bestKit = cand;
      }
    }
    return {
      homeKit: requestedHomeKit,
      awayKit: bestKit,
      autoResolved: true,
      reason: 'Mismo equipo seleccionado: equipación alternativa asignada al visitante.',
    };
  }

  if (initialDist < 52) {
    const candidates: KitSelection[] = ['away', 'third', 'home'];
    let bestKit: KitSelection = requestedAwayKit;
    let bestDist = initialDist;
    for (const cand of candidates) {
      if (sameTeam && cand === requestedHomeKit) continue;
      const c = resolveActiveKitColors(awayTeam, cand);
      const d = computeColorDistance(homeColors.primary, c.primary);
      if (d > bestDist + 15) {
        bestDist = d;
        bestKit = cand;
      }
    }
    if (bestKit !== requestedAwayKit) {
      return {
        homeKit: requestedHomeKit,
        awayKit: bestKit,
        autoResolved: true,
        reason: 'Colores similares detectados: equipación alternativa aplicada al visitante.',
      };
    }
  }

  return {
    homeKit: requestedHomeKit,
    awayKit: requestedAwayKit,
    autoResolved: false,
    reason: null,
  };
}

export interface FreeKickPracticeSpot {
  x: number;
  y: number;
  distanceMeters: number;
  angleLabel: string;
}

const FREE_KICK_PRACTICE_PRESETS: { distFromGoal: number; offsetY: number; label: string }[] = [
  { distFromGoal: 21.5, offsetY: -3.5, label: 'Frontal Izquierdo · 21.5m' },
  { distFromGoal: 23.0, offsetY: 4.8, label: 'Frontal Derecho · 23.0m' },
  { distFromGoal: 19.2, offsetY: 0.0, label: 'Media Luna Central · 19.2m' },
  { distFromGoal: 26.5, offsetY: -9.5, label: 'Perfil Zurdo con Rosca · 26.5m' },
  { distFromGoal: 25.8, offsetY: 9.8, label: 'Perfil Diestro con Rosca · 25.8m' },
  { distFromGoal: 29.5, offsetY: -1.8, label: 'Larga Distancia Potencia · 29.5m' },
  { distFromGoal: 20.4, offsetY: 7.2, label: 'Borde del Área Derecho · 20.4m' },
  { distFromGoal: 20.4, offsetY: -7.2, label: 'Borde del Área Izquierdo · 20.4m' },
];

export function generateFreeKickPracticeSpot(
  attackingSide: 'home' | 'away',
  index: number
): FreeKickPracticeSpot {
  const preset =
    FREE_KICK_PRACTICE_PRESETS[
      ((index % FREE_KICK_PRACTICE_PRESETS.length) + FREE_KICK_PRACTICE_PRESETS.length) %
        FREE_KICK_PRACTICE_PRESETS.length
    ];
  const x =
    attackingSide === 'home'
      ? PITCH.LENGTH - preset.distFromGoal
      : preset.distFromGoal;
  const y = Math.max(8, Math.min(PITCH.WIDTH - 8, PITCH.HALF_Y + preset.offsetY));
  const oppGoalX = attackingSide === 'home' ? PITCH.LENGTH : 0;
  const distanceMeters = Math.round(Math.hypot(oppGoalX - x, PITCH.HALF_Y - y) * 10) / 10;

  return {
    x,
    y,
    distanceMeters,
    angleLabel: preset.label,
  };
}
