import { PITCH, type BallState, type MatchPlayerState } from './physics';

export type RestartType =
  | 'kickoff'
  | 'throw_in'
  | 'corner'
  | 'goal_kick'
  | 'free_kick'
  | 'penalty';

export interface BoundaryCheckResult {
  event: 'none' | 'goal_home' | 'goal_away' | 'throw_in' | 'corner' | 'goal_kick';
  restartTeam?: 'home' | 'away';
  restartX?: number;
  restartY?: number;
}

export function checkBallOutcome(ball: BallState): BoundaryCheckResult {
  const inGoalMouthY = Math.abs(ball.y - PITCH.HALF_Y) < PITCH.GOAL_HALF - ball.radius * 0.4;
  const underBar = ball.z <= PITCH.GOAL_HEIGHT;

  // Goal scored into left goal (away scores)
  if (ball.x < -ball.radius * 0.4 && inGoalMouthY && underBar) {
    return { event: 'goal_away' };
  }
  // Goal scored into right goal (home scores)
  if (ball.x > PITCH.LENGTH + ball.radius * 0.4 && inGoalMouthY && underBar) {
    return { event: 'goal_home' };
  }

  // Sideline out -> Throw-in
  if (ball.y < -ball.radius || ball.y > PITCH.WIDTH + ball.radius) {
    const restartTeam = ball.lastTouchTeam === 'home' ? 'away' : 'home';
    const restartY = ball.y < 0 ? 0.4 : PITCH.WIDTH - 0.4;
    const restartX = Math.max(1.5, Math.min(PITCH.LENGTH - 1.5, ball.x));
    return { event: 'throw_in', restartTeam, restartX, restartY };
  }

  // Left goal line out (not a goal)
  if (ball.x < -ball.radius) {
    if (ball.lastTouchTeam === 'home') {
      // Defender touched last -> Corner for away
      const topCorner = ball.y < PITCH.HALF_Y;
      return {
        event: 'corner',
        restartTeam: 'away',
        restartX: 0.6,
        restartY: topCorner ? 0.6 : PITCH.WIDTH - 0.6,
      };
    }
    // Attacker touched last -> Goal kick for home
    return {
      event: 'goal_kick',
      restartTeam: 'home',
      restartX: 5.5,
      restartY: PITCH.HALF_Y + (ball.y < PITCH.HALF_Y ? -4 : 4),
    };
  }

  // Right goal line out (not a goal)
  if (ball.x > PITCH.LENGTH + ball.radius) {
    if (ball.lastTouchTeam === 'away') {
      const topCorner = ball.y < PITCH.HALF_Y;
      return {
        event: 'corner',
        restartTeam: 'home',
        restartX: PITCH.LENGTH - 0.6,
        restartY: topCorner ? 0.6 : PITCH.WIDTH - 0.6,
      };
    }
    return {
      event: 'goal_kick',
      restartTeam: 'away',
      restartX: PITCH.LENGTH - 5.5,
      restartY: PITCH.HALF_Y + (ball.y < PITCH.HALF_Y ? -4 : 4),
    };
  }

  return { event: 'none' };
}

/**
 * FIFA Law 11 Offside evaluation at the moment a teammate passes the ball.
 * attackDir = +1 when attacking toward x=105 (home), -1 when attacking toward x=0 (away).
 */
export function isPlayerOffside(
  receiver: MatchPlayerState,
  passer: MatchPlayerState,
  ballX: number,
  allPlayers: MatchPlayerState[],
  attackDir: 1 | -1
): boolean {
  if (receiver.id === passer.id) return false;
  if (receiver.side !== passer.side) return false;

  // Must be in opponent's half
  const inOppHalf = attackDir === 1 ? receiver.x > PITCH.HALF_X : receiver.x < PITCH.HALF_X;
  if (!inOppHalf) return false;

  // Must be ahead of the ball
  const aheadOfBall = attackDir === 1 ? receiver.x > ballX + 0.15 : receiver.x < ballX - 0.15;
  if (!aheadOfBall) return false;

  const opponents = allPlayers
    .filter((p) => p.side !== receiver.side && !p.redCard)
    .map((p) => p.x);

  if (opponents.length < 2) return false;

  if (attackDir === 1) {
    opponents.sort((a, b) => b - a); // descending (closest to x=105 first)
    const secondLastDefX = opponents[1];
    return receiver.x > secondLastDefX + 0.15;
  } else {
    opponents.sort((a, b) => a - b); // ascending (closest to x=0 first)
    const secondLastDefX = opponents[1];
    return receiver.x < secondLastDefX - 0.15;
  }
}

export function isInsidePenaltyArea(x: number, y: number, defendingSide: 'home' | 'away'): boolean {
  const inY = Math.abs(y - PITCH.HALF_Y) <= PITCH.PENALTY_AREA_HALF_Y;
  if (!inY) return false;
  if (defendingSide === 'home') {
    return x >= 0 && x <= PITCH.PENALTY_AREA_X;
  }
  return x <= PITCH.LENGTH && x >= PITCH.LENGTH - PITCH.PENALTY_AREA_X;
}

export type FoulClassification =
  | 'clean'
  | 'roce_legal'
  | 'entrada_tardia'
  | 'por_detras'
  | 'plancha'
  | 'agarron'
  | 'falta_tactica'
  | 'empujon';

export interface AerialDuelOutcome {
  winnerId: string;
  loserId: string;
  winMargin: number;
  isFoulPush: boolean;
}

/**
 * Evalúa disputas aéreas (cabezazos y saltos por balones divididos en el aire)
 * según cabeceo (heading), fuerza física (strength), altura (heightCm) y fatiga.
 */
export function evaluateAerialDuel(
  playerA: MatchPlayerState,
  playerB: MatchPlayerState,
  ball: BallState,
  rng: () => number
): AerialDuelOutcome {
  const heightA = (playerA.player.heightCm ?? 180) - 165;
  const heightB = (playerB.player.heightCm ?? 180) - 165;

  const stamFactorA = 0.78 + 0.22 * (playerA.stamina / 100);
  const stamFactorB = 0.78 + 0.22 * (playerB.stamina / 100);

  const distA = Math.hypot(playerA.x - ball.x, playerA.y - ball.y);
  const distB = Math.hypot(playerB.x - ball.x, playerB.y - ball.y);

  const scoreA =
    (playerA.player.attributes.heading * 0.45 +
      playerA.player.attributes.strength * 0.35 +
      heightA * 1.15) *
      stamFactorA -
    distA * 12 +
    (rng() - 0.5) * 8;

  const scoreB =
    (playerB.player.attributes.heading * 0.45 +
      playerB.player.attributes.strength * 0.35 +
      heightB * 1.15) *
      stamFactorB -
    distB * 12 +
    (rng() - 0.5) * 8;

  const winner = scoreA >= scoreB ? playerA : playerB;
  const loser = scoreA >= scoreB ? playerB : playerA;
  const winMargin = Math.abs(scoreA - scoreB);
  const isFoulPush = winMargin > 19 && rng() < 0.08;

  return {
    winnerId: winner.id,
    loserId: loser.id,
    winMargin,
    isFoulPush,
  };
}

export interface TackleOutcome {
  wonBall: boolean;
  isFoul: boolean;
  isPenalty: boolean;
  card: 'none' | 'yellow' | 'red';
  foulType: FoulClassification;
  severity: number;
  knockdown: boolean;
  injuryTriggered: boolean;
}

/**
 * Realistic Foul Evaluation (FIFA Law 12):
 * - A simple light brush (roce legal) or clean ball-first contact is NEVER a foul.
 * - Foul probability & severity depend on:
 *   1. Closing speed of the contact (velocidad del contacto)
 *   2. Tackling angle (por detrás vs lateral vs frontal)
 *   3. Whether the defender reached the ball first (llegó al balón primero)
 *   4. Studs-up / reckless lunge (plancha)
 *   5. Tactical shirt-pull / hold / push when beaten for pace or stopping a counter-attack (agarrón / falta táctica / empujón)
 */
export function evaluateTackleOutcome(
  tackler: MatchPlayerState,
  carrier: MatchPlayerState,
  isSlide: boolean,
  rng: () => number,
  ball?: BallState
): TackleOutcome {
  const tackleSkill = tackler.player.attributes.tackling / 100;
  const dribbleSkill = carrier.player.attributes.dribbling / 100;
  const tacklerStrength = tackler.player.attributes.strength / 100;
  const carrierStrength = carrier.player.attributes.strength / 100;

  // 1. Velocity of contact
  const rvx = tackler.vx - carrier.vx;
  const rvy = tackler.vy - carrier.vy;
  const contactSpeed = Math.hypot(rvx, rvy);
  const tacklerSpeed = Math.hypot(tackler.vx, tackler.vy);
  const carrierSpeed = Math.hypot(carrier.vx, carrier.vy);

  // 2. Approach angle relative to carrier's facing direction
  const dx = carrier.x - tackler.x;
  const dy = carrier.y - tackler.y;
  const approachAngle = Math.atan2(dy, dx);
  const angleDiff = Math.abs(
    Math.atan2(Math.sin(approachAngle - carrier.facing), Math.cos(approachAngle - carrier.facing))
  );
  const fromBehind = angleDiff < 0.72;
  const fromFront = angleDiff > 2.15;

  // 3. Check if defender reached the ball geometry before carrier's torso
  const ballX = ball ? ball.x : carrier.x + Math.cos(carrier.facing) * 0.62;
  const ballY = ball ? ball.y : carrier.y + Math.sin(carrier.facing) * 0.62;
  const distToBall = Math.hypot(ballX - tackler.x, ballY - tackler.y);
  const distToBody = Math.hypot(carrier.x - tackler.x, carrier.y - tackler.y);
  const reachedBallFirst = !fromBehind && distToBall <= distToBody + 0.36;

  // 4. Standing single-foot poke (!isSlide): NEVER a foul just for touching, shoulder-to-shoulder,
  // or front/lateral foot poke. Only a deliberate shirt-pull/push/tactical foul from behind when beaten for pace
  // and far from the ball can be whistled.
  if (!isSlide) {
    const isBlatantHoldFromBehind =
      fromBehind &&
      !reachedBallFirst &&
      distToBall > 0.88 &&
      carrierSpeed > tacklerSpeed + 1.15 &&
      contactSpeed > 2.3;

    if (!isBlatantHoldFromBehind || rng() >= 0.14) {
      const winProb =
        0.64 +
        (tackleSkill + tacklerStrength * 0.25 - (dribbleSkill + carrierStrength * 0.22)) * 0.38 +
        (reachedBallFirst ? 0.14 : 0);
      return {
        wonBall: rng() < Math.max(0.32, Math.min(0.94, winProb)),
        isFoul: false,
        isPenalty: false,
        card: 'none',
        foulType: reachedBallFirst ? 'roce_legal' : 'clean',
        severity: 0.06,
        knockdown: false,
        injuryTriggered: false,
      };
    }
  }

  // 5. Slide tackle that cleanly reaches the ball first from the side/front at controlled speed is also legal
  if (isSlide && !fromBehind && reachedBallFirst && contactSpeed < 3.0) {
    const winProb = 0.72 + (tackleSkill - dribbleSkill) * 0.35;
    return {
      wonBall: rng() < Math.max(0.38, Math.min(0.95, winProb)),
      isFoul: false,
      isPenalty: false,
      card: 'none',
      foulType: 'roce_legal',
      severity: 0.12,
      knockdown: false,
      injuryTriggered: false,
    };
  }

  // 6. Check tactical foul (falta táctica en contragolpe), hold (agarrón), push (empujón), studs-up lunge (plancha) vs hard/reckless slide
  const isHold = !isSlide && fromBehind && carrierSpeed > tacklerSpeed + 1.15;
  const isCounterAttackZone = Math.abs(carrier.x - PITCH.HALF_X) < 28 && carrierSpeed > 5.8;
  const isTacticalFoul = (isHold || (isSlide && fromBehind)) && isCounterAttackZone;
  const isPush = !isSlide && contactSpeed > 4.2 && !reachedBallFirst;
  const isHardSlide = isSlide && (contactSpeed > 3.2 || tacklerSpeed > 6.2 || fromBehind || !reachedBallFirst);
  const isPlancha = isSlide && (contactSpeed > 3.8 || fromBehind) && (!reachedBallFirst || fromFront || fromBehind);

  let baseFoulChance = isSlide ? 0.52 : 0.04;
  if (isHardSlide) baseFoulChance += 0.28;
  if (fromBehind) baseFoulChance += 0.34;
  if (!reachedBallFirst) baseFoulChance += 0.24;
  else baseFoulChance -= 0.14;
  if (isPlancha) baseFoulChance += 0.26;
  if (isHold) baseFoulChance += 0.18;
  baseFoulChance += Math.min(0.18, contactSpeed * 0.028);
  baseFoulChance += (dribbleSkill - tackleSkill) * 0.18;

  const foulRoll = rng();
  if (foulRoll < Math.max(0.02, Math.min(0.92, baseFoulChance))) {
    const isPenalty = isInsidePenaltyArea(carrier.x, carrier.y, tackler.side);
    const foulType: FoulClassification = isPlancha
      ? 'plancha'
      : isTacticalFoul
        ? 'falta_tactica'
        : isHold
          ? 'agarron'
          : isPush
            ? 'empujon'
            : fromBehind
              ? 'por_detras'
              : 'entrada_tardia';

    const severity = Math.min(
      1,
      0.32 +
        (isSlide ? 0.28 : 0) +
        (fromBehind ? 0.24 : 0) +
        (isPlancha ? 0.28 : 0) +
        Math.min(0.25, contactSpeed * 0.04)
    );

    let card: 'none' | 'yellow' | 'red' = 'none';
    const cardRoll = rng();
    if ((isPlancha || (isSlide && fromBehind)) && severity > 0.68 && cardRoll < 0.34) {
      card = 'red';
    } else if (isTacticalFoul || ((isPlancha || fromBehind || isHold || isSlide) && cardRoll < 0.76)) {
      card = 'yellow';
    } else if (severity > 0.48 && cardRoll < 0.38) {
      card = 'yellow';
    }

    const knockdown = isSlide || contactSpeed > 2.6 || fromBehind;
    const injuryTriggered = knockdown && severity > 0.68 && rng() < 0.14;

    return {
      wonBall: false,
      isFoul: true,
      isPenalty,
      card,
      foulType,
      severity,
      knockdown,
      injuryTriggered,
    };
  }

  // Clean tackle!
  const winChance =
    0.62 +
    (tackleSkill - dribbleSkill) * 0.36 +
    (reachedBallFirst ? 0.15 : 0) +
    (isSlide ? 0.11 : 0);
  const wonBall = rng() < Math.max(0.28, Math.min(0.95, winChance));

  return {
    wonBall,
    isFoul: false,
    isPenalty: false,
    card: 'none',
    foulType: 'clean',
    severity: 0.12,
    knockdown: isSlide && wonBall && contactSpeed > 3.8,
    injuryTriggered: false,
  };
}
