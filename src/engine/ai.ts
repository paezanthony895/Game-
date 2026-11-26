// ============================================================================
// REWRITTEN FOOTBALL AI ENGINE (Finite State Machine + Team Brain + Utility AI)
// ============================================================================
// Architecture:
// 1. DIFFICULTY_CONFIG_TABLE: Explicit numeric tuning object per difficulty level (1..8)
// 2. TeamBrainState: Evaluates team tactical phase, block line X, compactness,
//    pressing trigger, double-marking target, and dynamic score/minute aggression.
// 3. Per-Player Finite State Machine (AIPlayerState):
//    - 'WITH_BALL'        : Utility-scored decision between dribble, pass, through, shoot, cross, shield
//    - 'OFF_BALL_ATTACK'  : Unmarking, diagonal runs into space, give-and-go (paredes), box occupation
//    - 'DEFENDING_MARK'   : Tight man-marking & passing-lane denial
//    - 'PRESSING'         : Aggressive primary/secondary ball pressure (doble marca)
//    - 'COVERING_SPACE'   : Zonal block positioning & goal-side cover
//    - 'RECOVERING_POS'   : Sprinting back behind the ball after turnover

import { PITCH } from './physics';

const PITCH_W = PITCH.LENGTH;
const PITCH_H = PITCH.WIDTH;

export type AIPlayerState =
  | 'WITH_BALL'
  | 'OFF_BALL_ATTACK'
  | 'DEFENDING_MARK'
  | 'PRESSING'
  | 'COVERING_SPACE'
  | 'RECOVERING_POS';

export interface AIDifficultyConfigRow {
  level: number;
  name: string;
  /** Multiplicador de velocidad de jugadores IA (1.10 a 1.15 en Leyenda/Ultra) */
  aiSpeedMultiplier: number;
  /** Tiempo de reacción en segundos (< 0.10 s en Leyenda/Ultra) */
  reactionTimeSec: number;
  /** Precisión de pase (0..1) */
  passAccuracy: number;
  /** Precisión de tiro al arco (0..1) */
  shotAccuracy: number;
  /** Frecuencia e intensidad de presión alta (0..1) */
  pressFrequency: number;
  /** Nivel de anticipación e intercepción de líneas de pase (0..1) */
  anticipationLevel: number;
  /** Reflejos y velocidad de estirada del portero (0..1) */
  gkReflexes: number;
  /** Agresividad ofensiva, desmarques y contraataques (0..1) */
  offensiveAggression: number;
}

/**
 * TABLA DE CONFIGURACIÓN EXPLÍCITA DE DIFICULTAD
 * Muestra claramente cómo cambian velocidad, tiempo de reacción, precisión de pase/tiro,
 * frecuencia de presión, anticipación, reflejos del portero y agresividad ofensiva.
 */
export const DIFFICULTY_CONFIG_TABLE: Record<number, AIDifficultyConfigRow> = {
  1: {
    level: 1,
    name: 'Principiante',
    aiSpeedMultiplier: 0.84,
    reactionTimeSec: 0.42,
    passAccuracy: 0.62,
    shotAccuracy: 0.52,
    pressFrequency: 0.22,
    anticipationLevel: 0.20,
    gkReflexes: 0.42,
    offensiveAggression: 0.35,
  },
  2: {
    level: 2,
    name: 'Aficionado',
    aiSpeedMultiplier: 0.90,
    reactionTimeSec: 0.32,
    passAccuracy: 0.70,
    shotAccuracy: 0.62,
    pressFrequency: 0.35,
    anticipationLevel: 0.34,
    gkReflexes: 0.54,
    offensiveAggression: 0.46,
  },
  3: {
    level: 3,
    name: 'Semi-Profesional',
    aiSpeedMultiplier: 0.95,
    reactionTimeSec: 0.25,
    passAccuracy: 0.78,
    shotAccuracy: 0.72,
    pressFrequency: 0.50,
    anticipationLevel: 0.48,
    gkReflexes: 0.65,
    offensiveAggression: 0.58,
  },
  4: {
    level: 4,
    name: 'Profesional',
    aiSpeedMultiplier: 1.00,
    reactionTimeSec: 0.20,
    passAccuracy: 0.84,
    shotAccuracy: 0.80,
    pressFrequency: 0.64,
    anticipationLevel: 0.62,
    gkReflexes: 0.75,
    offensiveAggression: 0.70,
  },
  5: {
    level: 5,
    name: 'Clase Mundial',
    aiSpeedMultiplier: 1.04,
    reactionTimeSec: 0.15,
    passAccuracy: 0.90,
    shotAccuracy: 0.87,
    pressFrequency: 0.78,
    anticipationLevel: 0.76,
    gkReflexes: 0.85,
    offensiveAggression: 0.82,
  },
  6: {
    level: 6,
    name: 'Élite',
    aiSpeedMultiplier: 1.08,
    reactionTimeSec: 0.11,
    passAccuracy: 0.94,
    shotAccuracy: 0.92,
    pressFrequency: 0.88,
    anticipationLevel: 0.88,
    gkReflexes: 0.92,
    offensiveAggression: 0.90,
  },
  7: {
    level: 7,
    name: 'Leyenda',
    aiSpeedMultiplier: 1.13, // +13% más rápida que el jugador
    reactionTimeSec: 0.075,  // < 0.10 s
    passAccuracy: 0.985,
    shotAccuracy: 0.98,
    pressFrequency: 0.98,
    anticipationLevel: 0.98,
    gkReflexes: 0.98,
    offensiveAggression: 0.98,
  },
  8: {
    level: 8,
    name: 'Ultra Difícil',
    aiSpeedMultiplier: 1.15, // +15% más rápida que el jugador
    reactionTimeSec: 0.055,  // < 0.10 s
    passAccuracy: 0.995,     // 99.5% precisión en pases
    shotAccuracy: 0.99,      // 99% de no errarle al arco en dificultad máxima
    pressFrequency: 1.00,
    anticipationLevel: 0.995,
    gkReflexes: 0.995,
    offensiveAggression: 1.00,
  },
};

export interface AIDifficultyProfile {
  level: number;
  name: string;
  aiSpeedMultiplier: number;
  reactionDelaySec: number;
  passErrorMeters: number;
  shotErrorMeters: number;
  pressingIntensity: number;
  anticipation: number;
  gkReflexes: number;
  offensiveAggression: number;
  tacticalDiscipline: number;
  skillMoveFreq: number;
}

export function getDifficultyProfile(level: number): AIDifficultyProfile {
  const clamped = Math.max(1, Math.min(8, Math.round(level)));
  const row = DIFFICULTY_CONFIG_TABLE[clamped] || DIFFICULTY_CONFIG_TABLE[4];
  return {
    level: row.level,
    name: row.name,
    aiSpeedMultiplier: row.aiSpeedMultiplier,
    reactionDelaySec: row.reactionTimeSec,
    passErrorMeters: Math.max(0.05, (1 - row.passAccuracy) * 7.5),
    shotErrorMeters: Math.max(0.04, (1 - row.shotAccuracy) * 5.2),
    pressingIntensity: row.pressFrequency,
    anticipation: row.anticipationLevel,
    gkReflexes: row.gkReflexes,
    offensiveAggression: row.offensiveAggression,
    tacticalDiscipline: 0.55 + row.anticipationLevel * 0.45,
    skillMoveFreq: row.offensiveAggression * 0.95,
  };
}

export function chooseAdaptiveTactic<T extends string>(
  baseTactic: T,
  scoreDiff: number,
  matchMinute: number,
  profile: AIDifficultyProfile
): T {
  if (profile.level < 4) return baseTactic;
  if (scoreDiff < 0 && matchMinute >= 55) {
    return 'PRESION_ALTA' as T;
  }
  if (scoreDiff === 0 && matchMinute >= 75 && profile.offensiveAggression > 0.75) {
    return 'PRESION_ALTA' as T;
  }
  if (scoreDiff > 0 && matchMinute >= 80) {
    return 'CONTRAATAQUE' as T;
  }
  return baseTactic;
}

export interface AIPlayerNode {
  id: string;
  team: 'home' | 'away';
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseX: number;
  baseY: number;
  stamina: number;
  hasBall: boolean;
  overall: number;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  specificPosition?: string;
  aiState?: AIPlayerState;
}

export interface TeamBrainState {
  team: 'home' | 'away';
  phase: 'BUILDUP' | 'PROGRESSION' | 'FINAL_THIRD_ATTACK' | 'COUNTER_ATTACK' | 'HIGH_PRESS' | 'MID_BLOCK' | 'LOW_BLOCK_RECOVERY';
  defensiveLineX: number;
  compactnessY: number;
  urgencyBonus: number;
  primaryPresserId: string | null;
  secondaryPresserId: string | null;
  giveAndGoRunnerId: string | null;
  thirdManRunnerId?: string | null;
  overlapFullbackId?: string | null;
  offsideTrapActive?: boolean;
  designatedReceiverId?: string | null;
}

/**
 * Calcula el punto óptimo de intercepción de un balón en movimiento para un jugador dado.
 */
export function computeBallInterceptPoint(
  player: { x: number; y: number; pace?: number },
  ball: { x: number; y: number; vx: number; vy: number }
): { x: number; y: number; time: number } {
  const ballSpeed = Math.hypot(ball.vx, ball.vy);
  if (ballSpeed < 0.8) {
    return { x: ball.x, y: ball.y, time: Math.hypot(ball.x - player.x, ball.y - player.y) / 8.5 };
  }
  const pSpeed = 8.4 + ((player.pace ?? 80) / 100) * 1.4;
  let bx = ball.x;
  let by = ball.y;
  let bvx = ball.vx;
  let bvy = ball.vy;
  const step = 0.08;
  for (let t = step; t <= 1.45; t += step) {
    bx = Math.max(1.5, Math.min(PITCH_W - 1.5, bx + bvx * step));
    by = Math.max(1.5, Math.min(PITCH_H - 1.5, by + bvy * step));
    bvx *= 0.96;
    bvy *= 0.96;
    const dist = Math.hypot(bx - player.x, by - player.y);
    if (dist <= pSpeed * t + 0.65) {
      return { x: bx, y: by, time: t };
    }
  }
  return {
    x: Math.max(2, Math.min(PITCH_W - 2, ball.x + ball.vx * 0.45)),
    y: Math.max(2, Math.min(PITCH_H - 2, ball.y + ball.vy * 0.45)),
    time: 0.5,
  };
}

/**
 * CEREBRO TÁCTICO DE EQUIPO (Team Brain)
 * Coordina el bloque completo, altura de línea defensiva, trampa del offside,
 * receptor designado de pase, presión doble, tercer hombre, doblajes por banda
 * y adaptación según marcador y tiempo restante.
 */
export function evaluateTeamBrain(
  team: 'home' | 'away',
  teammates: AIPlayerNode[],
  opponents: AIPlayerNode[],
  ball: { x: number; y: number; vx: number; vy: number; ownerTeam: 'home' | 'away' | null; ownerId: string | null },
  scoreDiff: number, // positivo si este equipo gana, negativo si pierde
  matchMinute: number,
  profile: AIDifficultyProfile
): TeamBrainState {
  const dir = team === 'home' ? 1 : -1;
  const ownGoalX = team === 'home' ? 0 : PITCH_W;
  const ballProgress = team === 'home' ? ball.x / PITCH_W : (PITCH_W - ball.x) / PITCH_W;

  // Urgencia dinámica según resultado y minuto (Leyenda ajusta su táctica agresivamente si va perdiendo o empatando al final)
  let urgencyBonus = 0;
  if (scoreDiff < 0) {
    urgencyBonus = Math.min(0.45, 0.15 + (matchMinute / 90) * 0.30) * (0.6 + profile.offensiveAggression * 0.5);
  } else if (scoreDiff === 0 && matchMinute > 70) {
    urgencyBonus = 0.18 * profile.offensiveAggression;
  } else if (scoreDiff > 0 && matchMinute > 78) {
    urgencyBonus = -0.15; // Cierra líneas e intenta asegurar posesión/contraataque
  }

  let phase: TeamBrainState['phase'] = 'MID_BLOCK';
  if (ball.ownerTeam === team) {
    if (ballProgress > 0.66) {
      phase = 'FINAL_THIRD_ATTACK';
    } else if (Math.hypot(ball.vx, ball.vy) > 9 || urgencyBonus > 0.2) {
      phase = 'COUNTER_ATTACK';
    } else if (ballProgress > 0.36) {
      phase = 'PROGRESSION';
    } else {
      phase = 'BUILDUP';
    }
  } else {
    if ((ballProgress > 0.52 && profile.pressingIntensity + urgencyBonus > 0.68) || (profile.level >= 7 && ballProgress > 0.22)) {
      phase = 'HIGH_PRESS';
    } else if (ballProgress < 0.30) {
      phase = 'LOW_BLOCK_RECOVERY';
    } else {
      phase = 'MID_BLOCK';
    }
  }

  // Trampa del fuera de juego (Offside Trap) coordinada cuando el rival tiene el balón en mediocampo
  const offsideTrapActive =
    ball.ownerTeam !== team &&
    ballProgress >= 0.32 &&
    ballProgress <= 0.62 &&
    profile.tacticalDiscipline > 0.72;
  const trapStepUp = offsideTrapActive ? 4.2 : 0;

  // Altura de la línea defensiva en metros:
  // Cuando el equipo ATACA, la línea defensiva (centrales y lateral de cierre) MANTIENE su zona en campo propio
  // (máximo ~42m desde su propio arco) para evitar quedar desprotegido ante contraataques.
  const highPressPush =
    ball.ownerTeam === team ? 0 : profile.level >= 8 ? 16 : profile.level >= 7 ? 10 : 0;
  const rawLineAdvance =
    ball.ownerTeam === team
      ? Math.min(42, 18 + ballProgress * 20 + Math.max(0, urgencyBonus * 6))
      : 20 + highPressPush + ballProgress * 34 + urgencyBonus * 12 + trapStepUp;
  const defensiveLineX = Math.max(
    14,
    Math.min(PITCH_W - 14, ownGoalX + dir * rawLineAdvance)
  );

  // Receptor designado cuando el balón está en vuelo / suelto (pase en curso o rebote)
  let designatedReceiverId: string | null = null;
  if (!ball.ownerId) {
    const outfield = teammates.filter((t) => t.role !== 'GK');
    let bestInterceptDist = Infinity;
    for (const p of outfield) {
      const intercept = computeBallInterceptPoint(p, ball);
      const d = Math.hypot(p.x - intercept.x, p.y - intercept.y);
      if (d < bestInterceptDist) {
        bestInterceptDist = d;
        designatedReceiverId = p.id;
      }
    }
  }

  // Selección de presionador primario y secundario (doble marca coordinada)
  let primaryPresserId: string | null = null;
  let secondaryPresserId: string | null = null;

  if (ball.ownerTeam !== team) {
    const outfield = teammates.filter((t) => t.role !== 'GK');
    let bestD1 = Infinity;
    let bestD2 = Infinity;

    for (const p of outfield) {
      const intercept = computeBallInterceptPoint(p, ball);
      const d = Math.hypot(p.x - intercept.x, p.y - intercept.y);
      if (d < bestD1) {
        bestD2 = bestD1;
        secondaryPresserId = primaryPresserId;
        bestD1 = d;
        primaryPresserId = p.id;
      } else if (d < bestD2) {
        bestD2 = d;
        secondaryPresserId = p.id;
      }
    }

    // Activar doble marca agresiva en dificultades medias-altas
    if (profile.pressingIntensity + urgencyBonus < 0.52 || bestD2 > 22) {
      secondaryPresserId = null;
    }
  }

  // Identificar corredor de pared (give-and-go), tercer hombre (third-man runner) y lateral doblando por banda (overlap)
  let giveAndGoRunnerId: string | null = null;
  let thirdManRunnerId: string | null = null;
  let overlapFullbackId: string | null = null;

  if (ball.ownerTeam === team && ball.ownerId) {
    const carrier = teammates.find((t) => t.id === ball.ownerId);
    if (carrier) {
      let bestScore = -Infinity;
      let secondScore = -Infinity;
      for (const mate of teammates) {
        if (mate.id === carrier.id || mate.role === 'GK') continue;
        const d = Math.hypot(mate.x - carrier.x, mate.y - carrier.y);
        if (d > 6 && d < 28) {
          const forwardGain = (mate.x - carrier.x) * dir;
          const score = forwardGain * 1.45 - Math.abs(mate.y - carrier.y) * 0.32 + mate.pace * 0.18;
          if (score > bestScore) {
            secondScore = bestScore;
            thirdManRunnerId = giveAndGoRunnerId;
            bestScore = score;
            giveAndGoRunnerId = mate.id;
          } else if (score > secondScore && mate.role === 'MID') {
            secondScore = score;
            thirdManRunnerId = mate.id;
          }
        }
        // Doblaje de lateral por banda (Overlapping Fullback)
        const isFullback = mate.role === 'DEF' && (mate.baseY < 18 || mate.baseY > PITCH_H - 18);
        if (isFullback && Math.abs(mate.baseY - carrier.y) < 22 && ballProgress > 0.32) {
          overlapFullbackId = mate.id;
        }
      }
    }
  }

  return {
    team,
    phase,
    defensiveLineX,
    compactnessY: ball.ownerTeam === team ? 0.92 : 0.68,
    urgencyBonus,
    primaryPresserId,
    secondaryPresserId,
    giveAndGoRunnerId,
    thirdManRunnerId,
    overlapFullbackId,
    offsideTrapActive,
    designatedReceiverId,
  };
}

export interface OutfieldDecision {
  action: 'dribble' | 'pass' | 'through' | 'shoot' | 'cross' | 'clear' | 'shield';
  targetX: number;
  targetY: number;
  targetPlayerId?: string;
  power: number;
  spin: number;
  loft: number;
  sprint: boolean;
  /** Indica si el tiro o pase se ejecuta de primera intención (al primer toque) */
  firstTouch?: boolean;
  utilityScore?: number;
}

/**
 * Evalúa el riesgo de intercepción de una línea de pase entre (x1,y1) y (x2,y2).
 * Devuelve un valor entre 0 (totalmente libre) y 1 (bloqueado).
 */
function evaluatePassInterceptionRisk(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  opponents: AIPlayerNode[],
  passSpeedMps: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.5) return 1;

  const ux = dx / dist;
  const uy = dy / dist;
  let maxRisk = 0;

  for (const opp of opponents) {
    const ox = opp.x - x1;
    const oy = opp.y - y1;
    const proj = ox * ux + oy * uy;
    if (proj <= 0.4 || proj >= dist + 1.5) continue;

    const perpDist = Math.abs(ox * -uy + oy * ux);
    const ballArrivalTime = proj / Math.max(12, passSpeedMps);
    const oppReachRadius = Math.max(1.15, ballArrivalTime * 7.8);

    if (perpDist < oppReachRadius) {
      const risk = 1 - perpDist / oppReachRadius;
      if (risk > maxRisk) maxRisk = risk;
    }
  }
  return Math.min(1, maxRisk);
}

/**
 * Evalúa si un receptor que acaba de recibir o está por recibir un pase dentro de zona
 * de peligro (< 23m) debe rematar DE PRIMERA INTENCIÓN (first-time shot / volea / cabezazo).
 */
export function shouldExecuteFirstTouchShot(
  receiver: AIPlayerNode,
  opponents: AIPlayerNode[],
  profile: AIDifficultyProfile
): { shouldShoot: boolean; targetX: number; targetY: number; power: number; spin: number } {
  const attackDir = receiver.team === 'home' ? 1 : -1;
  const goalX = attackDir === 1 ? PITCH_W : 0;
  const goalCenterY = PITCH_H / 2;
  const distToGoal = Math.hypot(goalX - receiver.x, goalCenterY - receiver.y);

  // Rematar de primera dentro de los 22.5 metros (o hasta 26.5m en dificultad máxima)
  const maxFirstTouchDist = profile.level >= 7 ? 26.5 : 22.5;
  const dyFromCenter = Math.abs(receiver.y - goalCenterY);
  if (distToGoal > maxFirstTouchDist || dyFromCenter > 19.0) {
    return { shouldShoot: false, targetX: goalX, targetY: goalCenterY, power: 0, spin: 0 };
  }

  const rivalGK = opponents.find((o) => o.role === 'GK');
  const gkY = rivalGK ? rivalGK.y : goalCenterY;
  // Elegir el poste más lejano al portero dentro del arco amplio (PITCH.GOAL_HALF = 4.9m)
  const cornerMargin = Math.max(3.35, PITCH.GOAL_HALF - 0.52);
  const postOffset = gkY >= goalCenterY ? -cornerMargin : cornerMargin;
  const err = profile.level >= 8 ? 0 : (Math.random() - 0.5) * profile.shotErrorMeters * 0.45;
  const targetY = goalCenterY + postOffset + err;

  // En dificultad máxima (7 y 8), 99% de remate letal al primer toque
  const triggerChance =
    profile.level >= 7
      ? 0.99
      : (0.52 + profile.offensiveAggression * 0.45) * (distToGoal < 14 ? 1.0 : 0.78);
  const shouldShoot = Math.random() < triggerChance;
  const spin = postOffset > 0 ? -0.58 : 0.58;
  const power = Math.min(1.0, (profile.level >= 7 ? 0.88 : 0.78) + (distToGoal / 28) * 0.16);

  return {
    shouldShoot,
    targetX: goalX,
    targetY,
    power,
    spin,
  };
}

/**
 * TOMA DE DECISIONES DEL PORTADOR DEL BALÓN (Estado 'WITH_BALL')
 * Puntúa mediante función de utilidad:
 * 1) Tirar al arco (< 25m con ángulo razonable, apuntando a las esquinas lejos del GK)
 * 2) Filtrar pase / pared al hueco (through ball)
 * 3) Centrar al área (cross) desde banda en último tercio
 * 4) Pasar al compañero mejor ubicado o cambio de frente (pass / switch of play)
 * 5) Conducir hacia espacio libre y regatear 1v1 (dribble)
 * 6) Proteger el balón con el cuerpo bajo alta presión (shield)
 */
export function computeOutfieldCarrierDecision(
  carrier: AIPlayerNode,
  teammates: AIPlayerNode[],
  opponents: AIPlayerNode[],
  profile: AIDifficultyProfile,
  teamTactic: 'attacking' | 'balanced' | 'defensive' = 'balanced'
): OutfieldDecision {
  const attackDir = carrier.team === 'home' ? 1 : -1;
  const enemyGoalX = attackDir === 1 ? PITCH_W : 0;
  const ownGoalX = attackDir === 1 ? 0 : PITCH_W;
  const goalCenterY = PITCH_H / 2;

  const distToGoal = Math.hypot(enemyGoalX - carrier.x, goalCenterY - carrier.y);
  const angleOffset = Math.abs(carrier.y - goalCenterY);
  const hasReasonableShootingAngle = angleOffset < 20.5 || distToGoal < 14.0;

  // Presión rival inmediata sobre el portador
  let nearestOppDist = Infinity;
  let nearestOpp: AIPlayerNode | null = null;
  let opponentsIn3m = 0;

  for (const opp of opponents) {
    const d = Math.hypot(opp.x - carrier.x, opp.y - carrier.y);
    if (d < 3.2) opponentsIn3m++;
    if (d < nearestOppDist) {
      nearestOppDist = d;
      nearestOpp = opp;
    }
  }

  const pressureFactor = Math.max(0, Math.min(1, (4.2 - nearestOppDist) / 3.4));
  const candidates: OutfieldDecision[] = [];

  // --------------------------------------------------------------------------
  // OPCIÓN 1: TIRO AL ARCO (obligatorio evaluar < 25m o < 30m en dificultad máxima)
  // --------------------------------------------------------------------------
  const maxShootDist = profile.level >= 7 ? 29.5 : 25.0;
  if (distToGoal < maxShootDist && hasReasonableShootingAngle) {
    const rivalGK = opponents.find((o) => o.role === 'GK');
    const gkY = rivalGK ? rivalGK.y : goalCenterY;

    // Apuntar al ángulo más lejano respecto al arquero dentro del arco de 9.8m (99%+ precisión en dificultad máxima, 100% en Racing Titanes)
    const isSupremeTitanAI = profile.shotErrorMeters === 0 && profile.passErrorMeters === 0;
    const cornerOffset = Math.max(3.35, PITCH.GOAL_HALF - 0.55);
    const aimCornerY = gkY >= goalCenterY ? goalCenterY - cornerOffset : goalCenterY + cornerOffset;
    const errorY = isSupremeTitanAI
      ? 0
      : profile.level >= 8
      ? (Math.random() - 0.5) * 0.08
      : (Math.random() - 0.5) * profile.shotErrorMeters;
    const rawTargetY = aimCornerY + errorY;
    const safePostLimit = PITCH.GOAL_HALF - (profile.level >= 7 ? 0.36 : 0.12);
    const finalTargetY =
      profile.level >= 7
        ? Math.max(goalCenterY - safePostLimit, Math.min(goalCenterY + safePostLimit, rawTargetY))
        : rawTargetY;

    // Verificar si hay un defensor bloqueando frontalmente el disparo a menos de 2.5m
    const shotBlockRisk = evaluatePassInterceptionRisk(
      carrier.x,
      carrier.y,
      enemyGoalX,
      finalTargetY,
      opponents.filter((o) => o.role !== 'GK'),
      31
    );

    const distScore = (maxShootDist + 0.5 - distToGoal) * 4.4;
    const angleScore = Math.max(0, 18 - angleOffset * 0.65);
    const statBonus = (carrier.shooting - 70) * 0.48;
    const aggressionBonus =
      profile.offensiveAggression * 24 + (profile.level >= 7 ? 32 : 0) + (isSupremeTitanAI ? 18 : 0);
    const blockPenalty = shotBlockRisk * (profile.level >= 7 ? 20 : 34);

    const shootUtility = 52 + distScore + angleScore + statBonus + aggressionBonus - blockPenalty;

    // Efecto (curva Magnus) quirúrgico hacia adentro del palo
    const spin = aimCornerY < goalCenterY ? 0.55 : -0.55;
    const power = Math.min(1.0, Math.max(0.74, (profile.level >= 7 ? 0.84 : 0.72) + (distToGoal / 28) * 0.22));

    candidates.push({
      action: 'shoot',
      targetX: enemyGoalX,
      targetY: finalTargetY,
      power,
      spin,
      loft: distToGoal > 18 && Math.random() < 0.25 ? 0.16 : 0.04,
      sprint: true,
      utilityScore: shootUtility,
    });
  }

  // --------------------------------------------------------------------------
  // OPCIÓN 2: CENTRO AL ÁREA (CROSS) desde las bandas en último tercio
  // --------------------------------------------------------------------------
  const inFinalThird = Math.abs(enemyGoalX - carrier.x) < 28;
  const onWing = carrier.y < 14.5 || carrier.y > PITCH_H - 14.5;
  if (inFinalThird && onWing) {
    // Buscar delantero o mediocampista entrando al área
    let bestBoxTarget: AIPlayerNode | null = null;
    let bestBoxScore = -Infinity;
    for (const mate of teammates) {
      if (mate.id === carrier.id || mate.role === 'GK') continue;
      const distMateGoal = Math.abs(enemyGoalX - mate.x);
      if (distMateGoal < 20 && Math.abs(mate.y - goalCenterY) < 15) {
        const s = (20 - distMateGoal) * 2.5 + mate.physical * 0.2;
        if (s > bestBoxScore) {
          bestBoxScore = s;
          bestBoxTarget = mate;
        }
      }
    }

    if (bestBoxTarget) {
      const leadX = bestBoxTarget.x + attackDir * 2.4;
      const leadY = bestBoxTarget.y + bestBoxTarget.vy * 0.35;
      candidates.push({
        action: 'cross',
        targetX: Math.max(4, Math.min(PITCH_W - 4, leadX)),
        targetY: Math.max(10, Math.min(PITCH_H - 10, leadY)),
        targetPlayerId: bestBoxTarget.id,
        power: 0.76,
        spin: carrier.y < goalCenterY ? -0.45 : 0.45,
        loft: 0.56,
        sprint: true,
        utilityScore: 66 + profile.offensiveAggression * 14,
      });
    }
  }

  // --------------------------------------------------------------------------
  // OPCIÓN 3: PASE RASO, CAMBIO DE FRENTE Y PASE FILTRADO / PARED
  // --------------------------------------------------------------------------
  for (const mate of teammates) {
    if (mate.id === carrier.id) continue;
    if (mate.role === 'GK' && Math.abs(carrier.x - ownGoalX) > 36) continue;

    const passDist = Math.hypot(mate.x - carrier.x, mate.y - carrier.y);
    if (passDist < 3.5 || passDist > 52) continue;

    // A) Pase al pie o cambio de frente (Switch of Play) a la banda libre
    const errFoot = (Math.random() - 0.5) * profile.passErrorMeters;
    const footX = Math.max(2, Math.min(PITCH_W - 2, mate.x + mate.vx * 0.25));
    const footY = Math.max(2, Math.min(PITCH_H - 2, mate.y + mate.vy * 0.25 + errFoot));
    const riskFoot = evaluatePassInterceptionRisk(carrier.x, carrier.y, footX, footY, opponents, 20);

    // Espacio libre alrededor del receptor
    let mateNearestOpp = Infinity;
    for (const opp of opponents) {
      const d = Math.hypot(opp.x - mate.x, opp.y - mate.y);
      if (d < mateNearestOpp) mateNearestOpp = d;
    }

    const forwardGain = (footX - carrier.x) * attackDir;
    const spaceBonus = Math.min(22, mateNearestOpp * 2.25);
    const pressureReliefBonus = pressureFactor * 24;
    const isSwitchOfPlay = Math.abs(footY - carrier.y) > 25 && mateNearestOpp > 7.5 && forwardGain >= -4;
    const switchBonus = isSwitchOfPlay ? 14 + profile.tacticalDiscipline * 10 : 0;
    const riskPenalty = riskFoot * (72 + profile.anticipation * 25);

    const passUtility =
      36 +
      forwardGain * 1.15 +
      spaceBonus +
      pressureReliefBonus +
      switchBonus -
      riskPenalty -
      Math.max(0, passDist - 30) * 0.65;

    candidates.push({
      action: 'pass',
      targetX: footX,
      targetY: footY,
      targetPlayerId: mate.id,
      power: Math.min(0.95, Math.max(0.35, passDist / 38)),
      spin: 0,
      loft: isSwitchOfPlay || (passDist > 29 && riskFoot > 0.35) ? 0.38 : 0,
      sprint: false,
      utilityScore: passUtility,
    });

    // B) Pase filtrado al espacio (Through ball / Pared) para atacantes, volantes o laterales doblando
    if (mate.role === 'FWD' || mate.role === 'MID' || (mate.role === 'DEF' && (mate.baseY < 18 || mate.baseY > PITCH_H - 18))) {
      const leadDist = 6.2 + (mate.pace / 100) * 4.8;
      const throughX = Math.max(4, Math.min(PITCH_W - 4, mate.x + attackDir * leadDist));
      const throughY = Math.max(
        4,
        Math.min(PITCH_H - 4, mate.y + (goalCenterY - mate.y) * 0.18 + errFoot * 0.7)
      );
      const throughDist = Math.hypot(throughX - carrier.x, throughY - carrier.y);

      if (throughDist >= 7 && throughDist <= 44) {
        const riskThrough = evaluatePassInterceptionRisk(
          carrier.x,
          carrier.y,
          throughX,
          throughY,
          opponents,
          22
        );
        const goalProximityBonus = Math.max(0, 32 - Math.abs(enemyGoalX - throughX)) * 1.15;
        const throughUtility =
          38 +
          ((throughX - carrier.x) * attackDir) * 1.38 +
          goalProximityBonus +
          profile.offensiveAggression * 16 -
          riskThrough * 82;

        candidates.push({
          action: 'through',
          targetX: throughX,
          targetY: throughY,
          targetPlayerId: mate.id,
          power: Math.min(0.96, Math.max(0.45, throughDist / 34)),
          spin: 0,
          loft: throughDist > 28 && riskThrough > 0.28 ? 0.32 : 0,
          sprint: true,
          utilityScore: throughUtility,
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // OPCIÓN 4: CONDUCIR EL BALÓN Y REGATEAR 1v1 (DRIBBLE + AMAGUES HABILIDOSOS)
  // --------------------------------------------------------------------------
  const baseAngle = Math.atan2(goalCenterY - carrier.y, enemyGoalX - carrier.x);
  const angleOffsets = [0, -0.32, 0.32, -0.62, 0.62, -0.95, 0.95];

  for (const offset of angleOffsets) {
    const ang = baseAngle + offset;
    const lookAhead = 8.2;
    const tx = carrier.x + Math.cos(ang) * lookAhead;
    const ty = carrier.y + Math.sin(ang) * lookAhead;

    // Penalizar salir de los límites de la cancha
    if (tx < 3 || tx > PITCH_W - 3 || ty < 3 || ty > PITCH_H - 3) continue;

    let corridorClearance = Infinity;
    for (const opp of opponents) {
      // Proyectar posición futura del defensor para buscar el hueco de regate 1v1
      const ox = opp.x + opp.vx * 0.22;
      const oy = opp.y + opp.vy * 0.22;
      const d = Math.hypot(ox - tx, oy - ty);
      if (d < corridorClearance) corridorClearance = d;
    }

    const forwardProgress = (tx - carrier.x) * attackDir;
    const spaceScore = Math.min(32, corridorClearance * 3.8);
    const isSkillCut = Math.abs(offset) >= 0.3 && Math.abs(offset) <= 0.96 && nearestOppDist < 4.8;
    const skillMoveBonus = isSkillCut
      ? (carrier.dribbling - 65) * 0.55 + profile.skillMoveFreq * 22
      : 0;
    const sprintSafe = corridorClearance > 3.6 && distToGoal > 10;

    // En dificultad alta, penalizar severamente chocar de frente contra un defensor cercano (esquivar siempre)
    const headOnCollisionPenalty =
      nearestOpp && corridorClearance < 2.4 ? (3.0 - corridorClearance) * (24 + profile.anticipation * 28) : 0;

    const dribbleUtility =
      38 +
      forwardProgress * 2.25 +
      spaceScore +
      (carrier.dribbling - 70) * 0.35 +
      skillMoveBonus +
      profile.offensiveAggression * 10 -
      pressureFactor * (isSkillCut ? 8 : 26) -
      headOnCollisionPenalty -
      Math.abs(offset) * 4.0;

    candidates.push({
      action: 'dribble',
      targetX: tx,
      targetY: ty,
      power: 0,
      spin: 0,
      loft: 0,
      sprint: sprintSafe,
      utilityScore: dribbleUtility,
    });
  }

  // Esquive explosivo 1v1 (evasión perpendicular cuando un defensor se acerca a quitarla)
  if (nearestOpp && nearestOppDist < 3.9) {
    const oppVecX = nearestOpp.x + nearestOpp.vx * 0.18 - carrier.x;
    const oppVecY = nearestOpp.y + nearestOpp.vy * 0.18 - carrier.y;
    const oppAngle = Math.atan2(oppVecY, oppVecX);
    for (const side of [-1, 1]) {
      const evadeAngle = oppAngle + side * (Math.PI * 0.58);
      const ex = Math.max(3.5, Math.min(PITCH_W - 3.5, carrier.x + Math.cos(evadeAngle) * 7.5 + attackDir * 2.2));
      const ey = Math.max(3.5, Math.min(PITCH_H - 3.5, carrier.y + Math.sin(evadeAngle) * 7.5));
      let evadeClearance = Infinity;
      for (const opp of opponents) {
        const d = Math.hypot(opp.x - ex, opp.y - ey);
        if (d < evadeClearance) evadeClearance = d;
      }
      if (evadeClearance > 2.6) {
        candidates.push({
          action: 'dribble',
          targetX: ex,
          targetY: ey,
          power: 0,
          spin: 0,
          loft: 0,
          sprint: true,
          utilityScore: 54 + evadeClearance * 4.2 + profile.skillMoveFreq * 24,
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // OPCIÓN 5: PROTEGER EL BALÓN (SHIELD) si hay mucha presión y poco pase claro
  // --------------------------------------------------------------------------
  if (nearestOpp && nearestOppDist < 2.6 && opponentsIn3m >= 1) {
    // Girar de espaldas al rival para cubrir el balón con el cuerpo
    const awayFromOppX = carrier.x + (carrier.x - nearestOpp.x) * 2.2;
    const awayFromOppY = carrier.y + (carrier.y - nearestOpp.y) * 2.2;
    candidates.push({
      action: 'shield',
      targetX: Math.max(3, Math.min(PITCH_W - 3, awayFromOppX)),
      targetY: Math.max(3, Math.min(PITCH_H - 3, awayFromOppY)),
      power: 0,
      spin: 0,
      loft: 0,
      sprint: false,
      utilityScore: 42 + (carrier.physical - 70) * 0.4 + pressureFactor * 14,
    });
  }

  // Seleccionar la acción con mayor puntaje de utilidad
  candidates.sort((a, b) => (b.utilityScore ?? 0) - (a.utilityScore ?? 0));

  // Pequeño error humano coherente en dificultades bajas/medias
  if (candidates.length > 1 && profile.level <= 4 && Math.random() < (5 - profile.level) * 0.06) {
    return candidates[1];
  }

  return (
    candidates[0] || {
      action: 'dribble',
      targetX: enemyGoalX,
      targetY: goalCenterY,
      power: 0,
      spin: 0,
      loft: 0,
      sprint: true,
      utilityScore: 10,
    }
  );
}

/**
 * MÁQUINA DE ESTADOS FINITOS PARA JUGADORES SIN BALÓN
 * Asigna el estado explícito ('OFF_BALL_ATTACK', 'DEFENDING_MARK', 'PRESSING',
 * 'COVERING_SPACE', 'RECOVERING_POS') y calcula el vector de movimiento en bloque.
 */
export function computeOffBallMovement(
  player: AIPlayerNode,
  teammates: AIPlayerNode[],
  opponents: AIPlayerNode[],
  ball: { x: number; y: number; vx: number; vy: number; ownerTeam: 'home' | 'away' | null; ownerId?: string | null },
  profile: AIDifficultyProfile,
  teamTactic: 'attacking' | 'balanced' | 'defensive' = 'balanced',
  brain?: TeamBrainState
): { targetX: number; targetY: number; sprint: boolean; desiredState: AIPlayerState } {
  const dir = player.team === 'home' ? 1 : -1;
  const ownGoalX = dir === 1 ? 0 : PITCH_W;
  const enemyGoalX = dir === 1 ? PITCH_W : 0;
  const goalCenterY = PITCH_H / 2;

  const activeBrain =
    brain ||
    evaluateTeamBrain(
      player.team,
      teammates,
      opponents,
      { ...ball, ownerId: ball.ownerId ?? null },
      0,
      45,
      profile
    );

  // Portero manejado por computeGoalkeeperAI
  if (player.role === 'GK') {
    return {
      targetX: player.baseX,
      targetY: player.baseY,
      sprint: false,
      desiredState: 'COVERING_SPACE',
    };
  }

  const teamHasBall = ball.ownerTeam === player.team;
  const tacticShiftX =
    teamTactic === 'attacking' ? dir * 7.5 : teamTactic === 'defensive' ? -dir * 7.5 : 0;

  // Si el balón está en vuelo/suelto y este jugador es el receptor designado del equipo,
  // corre a máxima velocidad al punto exacto de intercepción para controlar o rematar.
  if (!ball.ownerId && activeBrain.designatedReceiverId === player.id) {
    const intercept = computeBallInterceptPoint(player, ball);
    return {
      targetX: intercept.x,
      targetY: intercept.y,
      sprint: true,
      desiredState: teamHasBall ? 'OFF_BALL_ATTACK' : 'PRESSING',
    };
  }

  // ==========================================================================
  // FASE OFENSIVA SIN BALÓN ('OFF_BALL_ATTACK')
  // ==========================================================================
  if (teamHasBall) {
    const ballProgress = dir === 1 ? ball.x / PITCH_W : (PITCH_W - ball.x) / PITCH_W;
    const dynamicShiftX = (ball.x - PITCH_W / 2) * 0.48 + tacticShiftX + dir * activeBrain.urgencyBonus * 10;
    const lateralShiftY = (ball.y - goalCenterY) * 0.22;

    let targetX = player.baseX + dynamicShiftX;
    let targetY = player.baseY + lateralShiftY;
    let sprint = false;

    const specPos = player.specificPosition || player.role;
    const isCentralDefender =
      specPos === 'CB' || (player.role === 'DEF' && player.baseY >= 17.5 && player.baseY <= PITCH_H - 17.5);
    const isFullback =
      specPos === 'LB' ||
      specPos === 'RB' ||
      (player.role === 'DEF' && (player.baseY < 17.5 || player.baseY > PITCH_H - 17.5));
    const isHoldingMid = specPos === 'CDM';

    // 1) Defensores centrales (CB): NUNCA suben todos al ataque; mantienen línea de resguardo (rest-defense) en campo propio
    if (isCentralDefender) {
      const maxCbAdvanceX = ownGoalX + dir * Math.min(43, 18 + ballProgress * 21);
      targetX =
        dir === 1
          ? Math.min(activeBrain.defensiveLineX, maxCbAdvanceX)
          : Math.max(activeBrain.defensiveLineX, maxCbAdvanceX);
      // Basculación lateral suave para cubrir la zona central frente a posibles contraataques
      targetY = goalCenterY + (player.baseY - goalCenterY) * 0.84 + (ball.y - goalCenterY) * 0.16;
      sprint = Math.hypot(targetX - player.x, targetY - player.y) > 9.5;
    }
    // 1b) Laterales (LB / RB): solo UNO (el del costado del balón) puede proyectarse al ataque; el otro cierra atrás
    else if (isFullback) {
      if (activeBrain.overlapFullbackId === player.id && ballProgress > 0.30) {
        targetX = Math.max(10, Math.min(PITCH_W - 10, ball.x + dir * 13.5));
        targetY = player.baseY < goalCenterY ? 5.2 : PITCH_H - 5.2;
        sprint = true;
      } else {
        // Lateral del lado opuesto se queda en equilibrio defensivo cerrando hacia adentro
        const restDefX = ownGoalX + dir * Math.min(45, 21 + ballProgress * 20);
        targetX = restDefX;
        targetY = goalCenterY + (player.baseY - goalCenterY) * 0.72 + (ball.y - goalCenterY) * 0.14;
        sprint = Math.hypot(targetX - player.x, targetY - player.y) > 10;
      }
    }
    // 1c) Mediocampista de contención (CDM): equilibrio táctico por delante de los centrales y opción de pase seguro atrás
    else if (isHoldingMid) {
      const cdmAnchorX = activeBrain.defensiveLineX + dir * 10.5;
      const maxCdmX = ownGoalX + dir * 56;
      targetX = dir === 1 ? Math.min(cdmAnchorX, maxCdmX) : Math.max(cdmAnchorX, maxCdmX);
      targetY = goalCenterY + (player.baseY - goalCenterY) * 0.75 + (ball.y - goalCenterY) * 0.25;
      sprint = Math.hypot(targetX - player.x, targetY - player.y) > 11;
    }
    // 2) Corredor de pared / desmarque diagonal (Give-and-Go) para mediocampistas ofensivos o delanteros
    else if (activeBrain.giveAndGoRunnerId === player.id) {
      targetX = Math.max(8, Math.min(PITCH_W - 8, ball.x + dir * 15.5));
      const pullToCenter = (goalCenterY - player.y) * 0.38;
      targetY = Math.max(8, Math.min(PITCH_H - 8, player.y + pullToCenter));
      sprint = true;
    }
    // 2b) Tercer hombre (Third-man vertical run) rompiendo desde segunda línea por el carril interior
    else if (activeBrain.thirdManRunnerId === player.id) {
      targetX = Math.max(8, Math.min(PITCH_W - 8, ball.x + dir * 13.5));
      const halfSpaceY = player.baseY < goalCenterY ? goalCenterY - 11.5 : goalCenterY + 11.5;
      targetY = halfSpaceY;
      sprint = true;
    }
    // 3) Delanteros y extremos (ST / LW / RW / FWD) atacan espacios libres y buscan posición de remate sin quedar en offside
    else if (player.role === 'FWD' || specPos === 'LW' || specPos === 'RW' || specPos === 'ST') {
      const enemyDefs = opponents.filter((o) => o.role !== 'GK');
      let lastDefX = enemyGoalX - dir * 18;
      if (enemyDefs.length > 0) {
        lastDefX =
          dir === 1
            ? Math.max(...enemyDefs.map((o) => o.x))
            : Math.min(...enemyDefs.map((o) => o.x));
      }

      const offsideSafeLineX = dir === 1 ? Math.max(ball.x + 2, lastDefX - 1.1) : Math.min(ball.x - 2, lastDefX + 1.1);
      targetX = dir === 1 ? Math.min(PITCH_W - 6, offsideSafeLineX) : Math.max(6, offsideSafeLineX);

      if (specPos === 'LW' || specPos === 'RW') {
        // Extremos abren la cancha en construcción y trazan diagonal al área en último tercio
        const wideY = player.baseY < goalCenterY ? 7.5 : PITCH_H - 7.5;
        const cutInY = player.baseY < goalCenterY ? goalCenterY - 8.5 : goalCenterY + 8.5;
        targetY = ballProgress > 0.64 ? cutInY : wideY;
      } else if (ballProgress > 0.62 && (ball.y < 18 || ball.y > PITCH_H - 18)) {
        // Centrodelantero ataca zona de penal / primer y segundo palo en centros
        targetX = enemyGoalX - dir * 10.2;
        targetY = player.baseY < goalCenterY ? goalCenterY - 4.2 : goalCenterY + 4.2;
      } else {
        // Desmarque lateral lejos del central más cercano
        let nearestDef: AIPlayerNode | null = null;
        let minDefD = Infinity;
        for (const opp of enemyDefs) {
          const d = Math.hypot(opp.x - targetX, opp.y - targetY);
          if (d < minDefD) {
            minDefD = d;
            nearestDef = opp;
          }
        }
        if (nearestDef && minDefD < 5.5) {
          targetY += targetY <= nearestDef.y ? -3.8 : 3.8;
        }
      }
      sprint = ballProgress > 0.36;
    }
    // 4) Mediocampistas interiores y enganches (CM / CAM / MID) ofrecen líneas de pase claras en triángulos de apoyo
    else {
      const supportAdvance = specPos === 'CAM' ? 11.5 : ballProgress > 0.52 ? 8.5 : 3.5;
      targetX = player.baseX + dynamicShiftX + dir * supportAdvance;
      let nearestOpp: AIPlayerNode | null = null;
      let minD = Infinity;
      for (const opp of opponents) {
        const d = Math.hypot(opp.x - targetX, opp.y - targetY);
        if (d < minD) {
          minD = d;
          nearestOpp = opp;
        }
      }
      if (nearestOpp && minD < 7.2) {
        const pushX = targetX - nearestOpp.x;
        const pushY = targetY - nearestOpp.y;
        const len = Math.hypot(pushX, pushY) || 1;
        targetX += (pushX / len) * 4.8;
        targetY += (pushY / len) * 4.8;
      }
      sprint = activeBrain.phase === 'COUNTER_ATTACK' || ballProgress > 0.62;
    }

    // 5) Separación anti-amontonamiento (evitar que varios compañeros corran al mismo punto o encimen al portador)
    const minTeammateSpacing = 6.8;
    for (const mate of teammates) {
      if (mate.id === player.id || mate.role === 'GK') continue;
      const refX = mate.hasBall ? mate.x : (mate.x + mate.baseX) * 0.5;
      const refY = mate.hasBall ? mate.y : (mate.y + mate.baseY) * 0.5;
      const dx = targetX - refX;
      const dy = targetY - refY;
      const dist = Math.hypot(dx, dy);
      if (dist < minTeammateSpacing && dist > 0.01) {
        const push = (minTeammateSpacing - dist) * 0.72;
        targetX += (dx / dist) * push;
        targetY += (dy / dist) * push;
      }
    }

    return {
      targetX: Math.max(4, Math.min(PITCH_W - 4, targetX)),
      targetY: Math.max(4, Math.min(PITCH_H - 4, targetY)),
      sprint,
      desiredState: 'OFF_BALL_ATTACK',
    };
  }

  // ==========================================================================
  // FASE DEFENSIVA SIN BALÓN
  // ==========================================================================

  // 1) ESTADO 'PRESSING': Presionador primario, secundario o asfixia en área rival en dificultad máxima
  const distToBall = Math.hypot(player.x - ball.x, player.y - ball.y);
  const opponentInOwnBoxZone = dir === 1 ? ball.x > PITCH_W - 36 : ball.x < 36;
  const extraSuffocatePress =
    profile.level >= 7 &&
    opponentInOwnBoxZone &&
    (player.role === 'FWD' || player.role === 'MID') &&
    distToBall < 15.5;

  if (
    player.id === activeBrain.primaryPresserId ||
    player.id === activeBrain.secondaryPresserId ||
    extraSuffocatePress
  ) {
    const isPrimary = player.id === activeBrain.primaryPresserId;
    // Anticipar trayectoria del balón y cerrar ángulo hacia el arco propio
    const leadTime = 0.10 + profile.anticipation * 0.16;
    const interceptX = ball.x + ball.vx * leadTime;
    const interceptY = ball.y + ball.vy * leadTime;

    const toOwnGoalX = ownGoalX - interceptX;
    const toOwnGoalY = goalCenterY - interceptY;
    const toGoalLen = Math.hypot(toOwnGoalX, toOwnGoalY) || 1;

    // El primario encimando directamente al portador; los secundarios asfixian salida
    const offsetDist = isPrimary ? 0.22 : extraSuffocatePress ? 0.85 : 1.75;
    const sideOffset = isPrimary ? 0 : interceptY < goalCenterY ? 1.4 : -1.4;

    const targetX = interceptX + (toOwnGoalX / toGoalLen) * offsetDist;
    const targetY = interceptY + (toOwnGoalY / toGoalLen) * offsetDist + sideOffset;

    return {
      targetX: Math.max(2, Math.min(PITCH_W - 2, targetX)),
      targetY: Math.max(2, Math.min(PITCH_H - 2, targetY)),
      sprint: true,
      desiredState: 'PRESSING',
    };
  }

  // 2) ESTADO 'RECOVERING_POS': Si el jugador quedó por delante de la línea del balón tras pérdida
  const playerAheadOfBall = dir === 1 ? player.x > ball.x + 8 : player.x < ball.x - 8;
  if (playerAheadOfBall && player.role !== 'FWD') {
    const recoveryX = player.role === 'DEF' ? activeBrain.defensiveLineX : (activeBrain.defensiveLineX + ball.x) * 0.5;
    const recoveryY = goalCenterY + (player.baseY - goalCenterY) * activeBrain.compactnessY;
    return {
      targetX: Math.max(5, Math.min(PITCH_W - 5, recoveryX)),
      targetY: Math.max(5, Math.min(PITCH_H - 5, recoveryY)),
      sprint: true,
      desiredState: 'RECOVERING_POS',
    };
  }

  // 3) ESTADO 'DEFENDING_MARK': Marcar rival peligroso cercano y cortar línea de pase (cover shadow)
  let dangerousOpp: AIPlayerNode | null = null;
  let bestThreatScore = -Infinity;
  const maxMarkSearchRadius = profile.level >= 7 ? 32 : 24;

  for (const opp of opponents) {
    if (opp.role === 'GK' || opp.hasBall) continue;
    const distFromBase = Math.hypot(opp.x - player.baseX, opp.y - player.baseY);
    if (distFromBase > maxMarkSearchRadius) continue;

    const distOppToBall = Math.hypot(opp.x - ball.x, opp.y - ball.y);
    const distOppToOwnGoal = Math.hypot(opp.x - ownGoalX, opp.y - goalCenterY);
    // En dificultad máxima prioriza bloquear a todos los receptores cercanos al portador para que no pueda salir del área
    const outletBlockBonus = profile.level >= 7 ? Math.max(0, 28 - distOppToBall) * 1.65 : 0;
    const threatScore = (68 - distOppToOwnGoal) * 1.45 - distFromBase * 0.95 + outletBlockBonus;
    if (threatScore > bestThreatScore) {
      bestThreatScore = threatScore;
      dangerousOpp = opp;
    }
  }

  if (dangerousOpp && bestThreatScore > 9 && profile.anticipation > 0.32) {
    // Ubicarse entre el rival marcado y el balón para interceptar cualquier intento de pase de salida
    const oppProjectedX = dangerousOpp.x + dangerousOpp.vx * 0.22;
    const oppProjectedY = dangerousOpp.y + dangerousOpp.vy * 0.22;

    const toBallX = ball.x - oppProjectedX;
    const toBallY = ball.y - oppProjectedY;
    const toBallLen = Math.hypot(toBallX, toBallY) || 1;

    const toGoalX = ownGoalX - oppProjectedX;
    const toGoalY = goalCenterY - oppProjectedY;
    const toGoalLen = Math.hypot(toGoalX, toGoalY) || 1;

    // En dificultad máxima se pega por delante de la línea de pase (78% hacia el balón) para robar todo
    const ballLaneWeight = profile.level >= 7 ? 0.78 : 0.58;
    const goalSideWeight = 1 - ballLaneWeight;
    const tightDist = profile.level >= 7 ? 1.15 : 1.5 + profile.anticipation * 0.8;
    const markX =
      oppProjectedX +
      ((toBallX / toBallLen) * ballLaneWeight + (toGoalX / toGoalLen) * goalSideWeight) * tightDist;
    const markY =
      oppProjectedY +
      ((toBallY / toBallLen) * ballLaneWeight + (toGoalY / toGoalLen) * goalSideWeight) * tightDist;

    const distToMark = Math.hypot(markX - player.x, markY - player.y);

    return {
      targetX: Math.max(4, Math.min(PITCH_W - 4, markX)),
      targetY: Math.max(4, Math.min(PITCH_H - 4, markY)),
      sprint: profile.level >= 7 ? distToMark > 1.8 : distToMark > 5.0,
      desiredState: 'DEFENDING_MARK',
    };
  }

  // 4) ESTADO 'COVERING_SPACE': Basculación zonal en bloque compacto y cobertura si otro defensor salió a presionar
  const blockX =
    player.role === 'DEF'
      ? activeBrain.defensiveLineX
      : player.role === 'MID'
      ? activeBrain.defensiveLineX + dir * 13.5
      : activeBrain.defensiveLineX + dir * 27;

  let compressedY =
    goalCenterY +
    (player.baseY - goalCenterY) * activeBrain.compactnessY +
    (ball.y - goalCenterY) * 0.28;

  // Si un compañero defensor salió a presionar al portador, los defensores adyacentes cierran su hueco (cobertura defensiva)
  if (player.role === 'DEF' && activeBrain.primaryPresserId) {
    const presser = teammates.find((t) => t.id === activeBrain.primaryPresserId);
    if (presser && presser.role === 'DEF' && presser.id !== player.id) {
      const gapY = presser.baseY - player.baseY;
      if (Math.abs(gapY) < 26) {
        compressedY += gapY * 0.32;
      }
    }
  }

  const distToCover = Math.hypot(blockX - player.x, compressedY - player.y);

  return {
    targetX: Math.max(5, Math.min(PITCH_W - 5, blockX)),
    targetY: Math.max(5, Math.min(PITCH_H - 5, compressedY)),
    sprint: distToCover > 9,
    desiredState: 'COVERING_SPACE',
  };
}

/**
 * IA AVANZADA DEL PORTERO (Arco amplio de 9.8m x 3.1m, posicionamiento en bisectriz,
 * estiradas explosivas con predicción Magnus, salida de líbero en pases filtrados y corte de centros)
 */
export function computeGoalkeeperAI(
  gk: AIPlayerNode,
  ball: { x: number; y: number; z: number; vx: number; vy: number; vz: number; spin?: number; ownerTeam: 'home' | 'away' | null; ownerId?: string | null },
  opponents: AIPlayerNode[],
  profile: AIDifficultyProfile
): {
  targetX: number;
  targetY: number;
  sprint: boolean;
  diveDirection: 'left' | 'right' | 'center' | 'none';
  diveSpeedY?: number;
  claimBall: boolean;
} {
  const isHome = gk.team === 'home';
  const goalX = isHome ? 1.1 : PITCH_W - 1.1;
  const goalCenterY = PITCH_H / 2;
  const dir = isHome ? 1 : -1;
  const halfGoal = PITCH.GOAL_HALF; // 4.9m

  const distBallToGoal = Math.hypot(ball.x - goalX, ball.y - goalCenterY);
  const ballHeadingToGoal =
    isHome
      ? ball.vx < -13.0 || (ball.vx < -6.8 && distBallToGoal < 11.5)
      : ball.vx > 13.0 || (ball.vx > 6.8 && distBallToGoal < 11.5);

  // 1) Reacción predictiva a disparo franco hacia el arco amplio (incluyendo efecto curva Magnus)
  if (ballHeadingToGoal && distBallToGoal < 34) {
    const timeToGoalLine = Math.abs((goalX - ball.x) / (ball.vx || 1));
    if (timeToGoalLine > 0 && timeToGoalLine < 1.6) {
      const spinCurveOffset = (ball.spin ?? 0) * 0.42 * timeToGoalLine * timeToGoalLine;
      const predictedY = ball.y + ball.vy * timeToGoalLine + spinCurveOffset;
      if (Math.abs(predictedY - goalCenterY) < halfGoal + 1.5) {
        const reflexError = (1 - profile.gkReflexes) * (Math.random() - 0.5) * 1.45;
        const diveY = Math.max(
          goalCenterY - (halfGoal - 0.12),
          Math.min(goalCenterY + (halfGoal - 0.12), predictedY + reflexError)
        );
        const deltaY = diveY - gk.y;
        const diveDirection =
          Math.abs(deltaY) < 0.48 ? 'center' : deltaY < 0 ? 'left' : 'right';
        // Velocidad lateral explosiva de estirada para cubrir todo el ancho del arco de 9.8m
        const requiredDiveSpeed = Math.min(
          11.6,
          Math.max(7.2, Math.abs(deltaY) / Math.max(0.20, timeToGoalLine * 0.82))
        ) * (0.85 + profile.gkReflexes * 0.22);

        return {
          targetX: goalX + dir * 0.55,
          targetY: diveY,
          sprint: true,
          diveDirection,
          diveSpeedY: deltaY < 0 ? -requiredDiveSpeed : requiredDiveSpeed,
          claimBall: false,
        };
      }
    }
  }

  // 2) Portero Líbero (Sweeper-Keeper): salir a cortar balones filtrados o sueltos dentro o al borde del área
  if (!ball.ownerId && distBallToGoal < 22.0) {
    const ballMovingTowardBox = isHome ? ball.vx <= 2.8 : ball.vx >= -2.8;
    if (ballMovingTowardBox) {
      const gkIntercept = computeBallInterceptPoint({ x: gk.x, y: gk.y, pace: 88 }, ball);
      const gkDist = Math.hypot(gkIntercept.x - gk.x, gkIntercept.y - gk.y);
      let nearestAttackerDist = Infinity;
      for (const opp of opponents) {
        const d = Math.hypot(gkIntercept.x - opp.x, gkIntercept.y - opp.y);
        if (d < nearestAttackerDist) nearestAttackerDist = d;
      }
      // Si el arquero llega antes o al mismo tiempo que el delantero, o es un centro aéreo al área chica
      const isAerialCrossInBox = ball.z > 0.9 && distBallToGoal < 12.5;
      if (gkDist <= nearestAttackerDist * (0.98 + profile.gkReflexes * 0.18) || isAerialCrossInBox) {
        return {
          targetX: gkIntercept.x,
          targetY: gkIntercept.y,
          sprint: true,
          diveDirection: 'none',
          claimBall: true,
        };
      }
    }
  }

  // 3) Salida agresiva a achicar el ángulo en mano a mano (1v1) cuando el delantero entra al área con balón
  if (distBallToGoal < 17.5 && ball.ownerTeam !== gk.team) {
    const rushFactor = 0.48 + profile.gkReflexes * 0.44;
    const rushX = goalX + (ball.x - goalX) * rushFactor;
    const rushY = goalCenterY + (ball.y - goalCenterY) * 0.68;
    const maxCoverY = halfGoal + 1.2;
    return {
      targetX: rushX,
      targetY: Math.max(goalCenterY - maxCoverY, Math.min(goalCenterY + maxCoverY, rushY)),
      sprint: true,
      diveDirection: 'none',
      claimBall: distBallToGoal < 6.5,
    };
  }

  // 4) Posicionamiento activo sobre la bisectriz del ángulo balón-arco cubriendo los 9.8m de ancho
  const advanceMeters = Math.min(6.4, Math.max(1.2, (distBallToGoal / PITCH_W) * 6.8));
  const targetX = goalX + dir * advanceMeters;
  const maxStandY = halfGoal - 0.55; // Cubre de palo a palo con gran movilidad lateral
  const angleY = ((ball.y - goalCenterY) / (PITCH_H / 2)) * maxStandY;
  const targetY = Math.max(goalCenterY - maxStandY, Math.min(goalCenterY + maxStandY, goalCenterY + angleY));

  return {
    targetX,
    targetY,
    sprint: Math.hypot(targetX - gk.x, targetY - gk.y) > 1.25,
    diveDirection: 'none',
    claimBall: false,
  };
}
