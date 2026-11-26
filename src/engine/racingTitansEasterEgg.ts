import type { AIDifficultyProfile } from './ai';
import type { GameSettings, Player, PlayerAttributes, Team } from '../types/football';

/**
 * BANDERA CENTRALIZADA DEL HUEVO DE PASCUA "RACING TITANES"
 * Cambiar a `false` desactiva por completo el huevo de pascua en todo el juego
 * sin necesidad de modificar ningún otro archivo.
 */
export const EASTER_EGG_RACING_TITANS = true;

let runtimeMasterFlagOverride: boolean | null = null;

export function setRacingTitansMasterFlag(enabled: boolean | null): void {
  runtimeMasterFlagOverride = enabled;
}

export function isRacingTitansMasterFlagEnabled(): boolean {
  return runtimeMasterFlagOverride !== null
    ? runtimeMasterFlagOverride
    : EASTER_EGG_RACING_TITANS;
}

/**
 * Constantes configurables de escala, física, cámara, animación y desbloqueo para Racing Titanes.
 */
export const RACING_TITANS_CONFIG = {
  /** Escala de altura de los jugadores de Racing (entre 3 y 4 veces la altura normal) */
  TITAN_HEIGHT_SCALE: 3.5,
  /** Radio base del collider de un jugador normal (m) */
  NORMAL_COLLIDER_RADIUS_M: 0.44,
  /** Radio del collider escalado para un Titán de Racing (m) */
  TITAN_COLLIDER_RADIUS_M: 0.44 * 3.5,
  /** Escala de la sombra de contacto y anillos en el césped */
  TITAN_SHADOW_SCALE: 3.5,
  /** Escala de los puntos de contacto del pie con el balón (evita que el balón se trabe entre los pies) */
  TITAN_FOOT_CONTACT_SCALE: 2.35,
  /** Multiplicador de frecuencia de zancada para que la animación se vea pesada y poderosa (no en cámara rápida) */
  TITAN_ANIMATION_SPEED_SCALE: 0.48,
  /** Escala de altura y distancia de la cámara de seguimiento cuando hay Titanes en cancha */
  TITAN_CAMERA_HEIGHT_MULT: 1.24,
  TITAN_CAMERA_DIST_MULT: 1.20,
  TITAN_CAMERA_LOOK_Y: 2.15,
  /** Multiplicador de hitbox/alcance del arquero Titán (cubre casi todo el arco de 9.8m x 3.1m) */
  TITAN_GK_REACH_Y_M: 4.55,
  TITAN_GK_REACH_Z_M: 3.75,
  /** Cantidad de toques en el escudo de Racing en el menú para desbloquear el modo */
  UNLOCK_CREST_TAPS_REQUIRED: 7,
  /** Texto oficial del aviso al comenzar el partido */
  ACTIVATION_BANNER_TEXT: '¡Racing Titanes activado!',
  /** Vibración sutil de cámara por cada pisada fuerte de un Titán al correr */
  FOOTSTEP_CAMERA_SHAKE_CARRIER: 0.16,
  FOOTSTEP_CAMERA_SHAKE_OFFBALL: 0.09,
} as const;

/**
 * Perfil de IA Suprema para Racing Titanes cuando es controlado por la IA:
 * - Posicionamiento perfecto, presión coordinada, pases al hueco, desmarques, defensa en bloque y decisión de tiro óptima.
 * - Reacción mínima (0.015s), sin errores aleatorios (0.0m de error en pase y tiro).
 */
export const RACING_TITANS_AI_PROFILE: AIDifficultyProfile = {
  level: 8,
  name: 'Racing Titanes Supremo',
  aiSpeedMultiplier: 1.20,
  reactionDelaySec: 0.015,
  passErrorMeters: 0,
  shotErrorMeters: 0,
  pressingIntensity: 1.0,
  anticipation: 1.0,
  gkReflexes: 1.0,
  offensiveAggression: 1.0,
  tacticalDiscipline: 1.0,
  skillMoveFreq: 1.0,
};

/**
 * Determina si un equipo corresponde a Racing Club.
 */
export function isRacingTeam(
  team: Pick<Team, 'id' | 'name' | 'shortName'> | null | undefined
): boolean {
  if (!team) return false;
  const id = (team.id || '').toLowerCase();
  const name = (team.name || '').toLowerCase();
  if (id === 'club_rac' || id === 'rac') return true;
  if (name === 'racing club' || name === 'racing') return true;
  return false;
}

/**
 * Determina si el huevo de pascua "Racing Titanes" está activo para un equipo dado
 * según la bandera centralizada `EASTER_EGG_RACING_TITANS` y los ajustes del juego.
 */
export function isRacingTitansActiveForTeam(
  team: Pick<Team, 'id' | 'name' | 'shortName'> | null | undefined,
  settings?: GameSettings | null
): boolean {
  if (!isRacingTitansMasterFlagEnabled()) return false;
  if (!isRacingTeam(team)) return false;
  const matchSettings = settings?.match;
  if (!matchSettings) return false;
  return Boolean(matchSettings.racingTitansUnlocked && matchSettings.racingTitansEnabled);
}

/**
 * Devuelve un objeto PlayerAttributes con TODOS los atributos fijos en 100.
 */
export function createTitanMaxAttributes(): PlayerAttributes {
  return {
    pace: 100,
    acceleration: 100,
    stamina: 100,
    strength: 100,
    ballControl: 100,
    dribbling: 100,
    shortPassing: 100,
    longPassing: 100,
    vision: 100,
    finishing: 100,
    shotPower: 100,
    accuracy: 100,
    heading: 100,
    marking: 100,
    tackling: 100,
    positioning: 100,
    reflexes: 100,
    reactions: 100,
  };
}

/**
 * Clona un jugador de Racing fijando todos sus atributos y niveles en 100,
 * sin cansancio (fitness 100) y sin lesiones (injuredMatches 0).
 */
export function upgradePlayerToRacingTitan(player: Player): Player {
  return {
    ...player,
    overall: 100,
    potential: 100,
    fitness: 100,
    morale: 100,
    form: 10,
    injuredMatches: 0,
    bodyBuild: 'robusto',
    attributes: createTitanMaxAttributes(),
  };
}
