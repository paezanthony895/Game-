import * as CANNON from 'cannon-es';
import type { PitchCondition, Player, WeatherType } from '../types/football';
import {
  EASTER_EGG_RACING_TITANS,
  RACING_TITANS_AI_PROFILE,
  RACING_TITANS_CONFIG,
  isRacingTeam,
  isRacingTitansActiveForTeam,
  isRacingTitansMasterFlagEnabled,
  setRacingTitansMasterFlag,
  upgradePlayerToRacingTitan,
} from './racingTitansEasterEgg';

export {
  EASTER_EGG_RACING_TITANS,
  RACING_TITANS_AI_PROFILE,
  RACING_TITANS_CONFIG,
  isRacingTeam,
  isRacingTitansActiveForTeam,
  isRacingTitansMasterFlagEnabled,
  setRacingTitansMasterFlag,
  upgradePlayerToRacingTitan,
};

export const PITCH = {
  LENGTH: 105,
  WIDTH: 68,
  HALF_X: 52.5,
  HALF_Y: 34,
  GOAL_WIDTH: 9.8,
  GOAL_HALF: 4.9,
  GOAL_HEIGHT: 3.1,
  GOAL_DEPTH: 2.8,
  PENALTY_AREA_X: 16.5,
  PENALTY_AREA_HALF_Y: 20.16,
  SIX_YARD_X: 5.5,
  SIX_YARD_HALF_Y: 9.16,
  PENALTY_SPOT_X: 11,
  CENTER_CIRCLE_R: 9.15,
} as const;

/**
 * Key Tunable Physics Constants (m and m/s)
 */
export const PHYSICS_TUNING = {
  JOG_SPEED_MIN_MPS: 4.0,
  JOG_SPEED_MAX_MPS: 5.0,
  SPRINT_SPEED_MIN_MPS: 8.0,
  SPRINT_SPEED_MAX_MPS: 9.5,
  ACCEL_TIME_TO_MAX_SEC: 2.35, // 2.0 to 3.0 seconds from 0 to top speed
  PASS_SPEED_MIN_MPS: 15.0,
  PASS_SPEED_MAX_MPS: 25.0,
  SHOT_SPEED_MIN_MPS: 25.0,
  SHOT_SPEED_MAX_MPS: 33.0,
  GRAVITY_MPS2: 14.8,
} as const;

/**
 * Configurable Expanded Stadium & Pitch Scale (140 x 90 m playable surface)
 * Scales pitch geometry, markings, player speeds, ball velocities, and camera distances proportionally
 * so match pacing feels fast and natural across the larger 140x90m arena.
 */
export const EXPANDED_PITCH_SCALE = {
  TARGET_LENGTH_M: 140,
  TARGET_WIDTH_M: 90,
  FACTOR: 140 / 105, // 1.3333333333333333 configurable master scale factor
  FACTOR_X: 140 / 105, // 105m -> 140m (1.3333x)
  FACTOR_Y: 90 / 68, // 68m -> 90m (1.3235x)
  PLAYER_SPEED_SCALE: 140 / 105,
  BALL_SPEED_SCALE: 140 / 105,
  CAMERA_SCALE: 140 / 105,
  STADIUM_CAPACITY: 80000,
  LIGHT_TOWER_COUNT: 6,
} as const;

export interface ScaledPitchDimensions {
  scaleFactor: number;
  lengthM: number;
  widthM: number;
  penaltyAreaLengthM: number;
  penaltyAreaWidthM: number;
  sixYardLengthM: number;
  sixYardWidthM: number;
  centerCircleRadiusM: number;
  penaltySpotDistanceM: number;
  goalWidthM: number;
  goalHeightM: number;
  scaledSprintMinMps: number;
  scaledSprintMaxMps: number;
  scaledPassMaxMps: number;
  scaledShotMaxMps: number;
}

export function getScaledPitchDimensions(
  scaleFactor: number = EXPANDED_PITCH_SCALE.FACTOR
): ScaledPitchDimensions {
  const widthRatio = 90 / 140;
  const lengthM = Number((PITCH.LENGTH * scaleFactor).toFixed(2));
  const widthM = Number((lengthM * widthRatio).toFixed(2));
  const factorY = widthM / PITCH.WIDTH;
  return {
    scaleFactor,
    lengthM,
    widthM,
    penaltyAreaLengthM: Number((PITCH.PENALTY_AREA_X * scaleFactor).toFixed(2)),
    penaltyAreaWidthM: Number((PITCH.PENALTY_AREA_HALF_Y * 2 * factorY).toFixed(2)),
    sixYardLengthM: Number((PITCH.SIX_YARD_X * scaleFactor).toFixed(2)),
    sixYardWidthM: Number((PITCH.SIX_YARD_HALF_Y * 2 * factorY).toFixed(2)),
    centerCircleRadiusM: Number((PITCH.CENTER_CIRCLE_R * scaleFactor).toFixed(2)),
    penaltySpotDistanceM: Number((PITCH.PENALTY_SPOT_X * scaleFactor).toFixed(2)),
    goalWidthM: Number((PITCH.GOAL_WIDTH * scaleFactor).toFixed(2)),
    goalHeightM: Number(PITCH.GOAL_HEIGHT.toFixed(2)),
    scaledSprintMinMps: Number((PHYSICS_TUNING.SPRINT_SPEED_MIN_MPS * scaleFactor).toFixed(2)),
    scaledSprintMaxMps: Number((PHYSICS_TUNING.SPRINT_SPEED_MAX_MPS * scaleFactor).toFixed(2)),
    scaledPassMaxMps: Number((PHYSICS_TUNING.PASS_SPEED_MAX_MPS * scaleFactor).toFixed(2)),
    scaledShotMaxMps: Number((PHYSICS_TUNING.SHOT_SPEED_MAX_MPS * scaleFactor).toFixed(2)),
  };
}

export type StrikeType =
  | 'raso'
  | 'globo'
  | 'volea'
  | 'rabona'
  | 'chilena'
  | 'cabezazo'
  | 'curva'
  | 'colocado';

export type GoalkeeperAnimAction =
  | 'idle'
  | 'dive_save'
  | 'block'
  | 'punch_clear'
  | 'rush_out'
  | 'distribute';

export type PlayerAnimState =
  | 'idle'
  | 'walk'
  | 'jog'
  | 'sprint'
  | 'turn'
  | 'brake'
  | 'dribble'
  | 'feint'
  | 'oriented_control'
  | 'pass'
  | 'cross'
  | 'shoot'
  | 'volley'
  | 'header'
  | 'standing_tackle'
  | 'slide'
  | 'fall'
  | 'jostle'
  | 'jump'
  | 'celebrate'
  | 'lament'
  | 'throw_in'
  | 'gk_action';

export interface BallState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  spin: number; // lateral Magnus curve rad/s
  topSpin?: number; // vertical dip (+) or backspin float (-)
  strikeType?: StrikeType;
  radius: number;
  ownerId: string | null;
  lastTouchTeam: 'home' | 'away' | null;
  lastTouchPlayerId: string | null;
  lastTouchPlayerName: string | null;
  assistCandidateId: string | null;
  assistCandidateName: string | null;
  isDeadBall: boolean;
  // Physical 3D Goal Net elastic deformation (meters)
  netStretchLeft?: number;
  netStretchRight?: number;
}

export interface MatchPlayerState {
  id: string;
  player: Player;
  side: 'home' | 'away';
  slotIndex: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number; // radians
  stamina: number; // 0-100
  yellowCards: number;
  redCard: boolean;
  injured: boolean;
  tackleCooldown: number;
  stunTimer: number;
  slideTimer: number;
  kickAnimTimer: number;
  diveTimer: number;
  diveDirY: number;
  stridePhase: number;
  // Kinematic & motion-capture animation state machine fields
  angularVel?: number;
  leanForward?: number;
  leanBank?: number;
  fallTimer?: number;
  jostleTimer?: number;
  brakeTimer?: number;
  headerTimer?: number;
  passAnimTimer?: number;
  feintTimer?: number;
  orientedControlTimer?: number;
  volleyTimer?: number;
  jumpTimer?: number;
  lamentTimer?: number;
  standingTackleTimer?: number;
  gkAction?: GoalkeeperAnimAction;
  // Foot IK ground adaptation (vertical foot placement above turf in meters)
  footIkLeftY?: number;
  footIkRightY?: number;
  slideHitResolved?: boolean;
  aiHoldTimer?: number;
  callingForBall?: boolean;
  inWall?: boolean;
  animState?: PlayerAnimState;
  lookTargetAngle?: number;
  aiRoleState?: string;
  dribbleLooseTimer?: number;
  // Racing Titanes Easter Egg properties
  isRacingTitan?: boolean;
  titanScale?: number;
}

export function getPlayerColliderRadius(p: MatchPlayerState): number {
  if (p.isRacingTitan && isRacingTitansMasterFlagEnabled()) {
    return (
      RACING_TITANS_CONFIG.NORMAL_COLLIDER_RADIUS_M *
      (p.titanScale ?? RACING_TITANS_CONFIG.TITAN_HEIGHT_SCALE)
    );
  }
  return RACING_TITANS_CONFIG.NORMAL_COLLIDER_RADIUS_M;
}

/**
 * Cannon-es 3D Rigid-Body Physics World Singleton
 * Handles 3D rigid body ball simulation, turf plane restitution, and goalposts/crossbar 3D cylinder bodies.
 */
interface CannonFootballArena {
  world: CANNON.World;
  ballBody: CANNON.Body;
  groundBody: CANNON.Body;
  ballGroundContact: CANNON.ContactMaterial;
  ballPostContact: CANNON.ContactMaterial;
  postBodies: CANNON.Body[];
}

let cannonArena: CannonFootballArena | null = null;

export function getCannonPhysicsWorld(): CannonFootballArena {
  if (cannonArena) return cannonArena;

  const world = new CANNON.World();
  world.gravity.set(0, 0, -PHYSICS_TUNING.GRAVITY_MPS2);
  world.broadphase = new CANNON.SAPBroadphase(world);

  const ballMat = new CANNON.Material('ballMaterial');
  const groundMat = new CANNON.Material('groundMaterial');
  const postMat = new CANNON.Material('postMaterial');

  const ballGroundContact = new CANNON.ContactMaterial(ballMat, groundMat, {
    friction: 0.22,
    restitution: 0.62,
  });
  const ballPostContact = new CANNON.ContactMaterial(ballMat, postMat, {
    friction: 0.08,
    restitution: 0.72,
  });
  world.addContactMaterial(ballGroundContact);
  world.addContactMaterial(ballPostContact);

  // Ground plane at z = 0 (normal pointing +Z)
  const groundBody = new CANNON.Body({
    mass: 0,
    material: groundMat,
    shape: new CANNON.Plane(),
  });
  world.addBody(groundBody);

  // Soccer ball rigid body (mass = 0.43 kg official FIFA match ball, radius = 0.22 m)
  const ballBody = new CANNON.Body({
    mass: 0.43,
    material: ballMat,
    shape: new CANNON.Sphere(0.22),
    linearDamping: 0.05,
    angularDamping: 0.08,
  });
  ballBody.position.set(PITCH.HALF_X, PITCH.HALF_Y, 0.22);
  world.addBody(ballBody);

  // 4 Vertical Goalposts + 2 Horizontal Crossbars as static 3D cylinders in Cannon-es
  const postBodies: CANNON.Body[] = [];
  const postRadius = 0.12;
  const postCoords = [
    { x: 0, y: PITCH.HALF_Y - PITCH.GOAL_HALF },
    { x: 0, y: PITCH.HALF_Y + PITCH.GOAL_HALF },
    { x: PITCH.LENGTH, y: PITCH.HALF_Y - PITCH.GOAL_HALF },
    { x: PITCH.LENGTH, y: PITCH.HALF_Y + PITCH.GOAL_HALF },
  ];

  const postQuat = new CANNON.Quaternion();
  postQuat.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);

  for (const pc of postCoords) {
    const body = new CANNON.Body({
      mass: 0,
      material: postMat,
    });
    body.addShape(
      new CANNON.Cylinder(postRadius, postRadius, PITCH.GOAL_HEIGHT, 12),
      new CANNON.Vec3(0, 0, 0),
      postQuat
    );
    body.position.set(pc.x, pc.y, PITCH.GOAL_HEIGHT / 2);
    world.addBody(body);
    postBodies.push(body);
  }

  // Left & Right Crossbars
  for (const gx of [0, PITCH.LENGTH]) {
    const barBody = new CANNON.Body({
      mass: 0,
      material: postMat,
      shape: new CANNON.Cylinder(postRadius, postRadius, PITCH.GOAL_WIDTH, 12),
    });
    barBody.position.set(gx, PITCH.HALF_Y, PITCH.GOAL_HEIGHT);
    world.addBody(barBody);
    postBodies.push(barBody);
  }

  cannonArena = {
    world,
    ballBody,
    groundBody,
    ballGroundContact,
    ballPostContact,
    postBodies,
  };
  return cannonArena;
}

export function createInitialBall(): BallState {
  return {
    x: PITCH.HALF_X,
    y: PITCH.HALF_Y,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    spin: 0,
    topSpin: 0,
    strikeType: 'raso',
    radius: 0.22,
    ownerId: null,
    lastTouchTeam: null,
    lastTouchPlayerId: null,
    lastTouchPlayerName: null,
    assistCandidateId: null,
    assistCandidateName: null,
    isDeadBall: false,
    netStretchLeft: 0,
    netStretchRight: 0,
  };
}

export function getTurfFriction(condition: PitchCondition): number {
  switch (condition) {
    case 'optimo':
      return 0.982;
    case 'humedo':
      return 0.987; // ball skids faster on wet grass
    case 'pesado':
      return 0.972;
    case 'barro':
      return 0.958;
  }
}

export function getBounceRestitution(condition: PitchCondition): number {
  switch (condition) {
    case 'optimo':
      return 0.62;
    case 'humedo':
      return 0.56;
    case 'pesado':
      return 0.48;
    case 'barro':
      return 0.35;
  }
}

export function stepBallPhysics(
  ball: BallState,
  dt: number,
  pitchCondition: PitchCondition,
  weather: WeatherType
): { hitPost: boolean; bouncedOnGrass: boolean; hitNet: boolean } {
  let hitPost = false;
  let bouncedOnGrass = false;
  let hitNet = false;

  // Decay elastic goal net stretch
  const netDecay = Math.pow(0.84, dt * 60);
  ball.netStretchLeft = (ball.netStretchLeft ?? 0) * netDecay;
  ball.netStretchRight = (ball.netStretchRight ?? 0) * netDecay;
  if ((ball.netStretchLeft ?? 0) < 0.005) ball.netStretchLeft = 0;
  if ((ball.netStretchRight ?? 0) < 0.005) ball.netStretchRight = 0;

  const arena = getCannonPhysicsWorld();
  arena.ballGroundContact.restitution = getBounceRestitution(pitchCondition);

  if (ball.ownerId !== null) {
    ball.z = 0;
    ball.vz = 0;
    arena.ballBody.position.set(ball.x, ball.y, ball.radius);
    arena.ballBody.velocity.set(ball.vx, ball.vy, 0);
    return { hitPost, bouncedOnGrass, hitNet };
  }

  const gravity = PHYSICS_TUNING.GRAVITY_MPS2;
  const speed2d = Math.hypot(ball.vx, ball.vy);
  const airDrag = Math.pow(0.992 - Math.min(0.004, speed2d * 0.00012), dt * 60);
  const groundFriction = Math.pow(getTurfFriction(pitchCondition), dt * 60);

  // Lateral Magnus effect (curve / efecto on curva, rabona, tiro libre)
  if (Math.abs(ball.spin) > 0.04) {
    if (speed2d > 1.5) {
      const nx = -ball.vy / speed2d;
      const ny = ball.vx / speed2d;
      const curveMultiplier = ball.strikeType === 'rabona' ? 0.27 : 0.22;
      const curveAccel = ball.spin * speed2d * curveMultiplier;
      ball.vx += nx * curveAccel * dt;
      ball.vy += ny * curveAccel * dt;
    }
    ball.spin *= Math.pow(0.986, dt * 60);
  }

  // Vertical Magnus effect (topspin dip on volleys/chilenas/free kicks, backspin float on lobs/passes)
  const topSpin = ball.topSpin ?? 0;
  if (Math.abs(topSpin) > 0.04 && ball.z > 0.1) {
    ball.vz -= topSpin * Math.min(20, speed2d) * 0.14 * dt;
    ball.topSpin = topSpin * Math.pow(0.985, dt * 60);
  }

  // Wind drift when airborne
  if (weather === 'viento' && ball.z > 0.25) {
    ball.vy += 1.45 * dt;
  }

  // Sync state into Cannon-es 3D rigid body & step the physics world
  arena.ballBody.position.set(ball.x, ball.y, ball.z + ball.radius);
  arena.ballBody.velocity.set(ball.vx, ball.vy, ball.vz);
  arena.world.step(Math.min(0.033, dt));

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.z > 0 || ball.vz > 0) {
    ball.vz -= gravity * dt;
    ball.z += ball.vz * dt;
    if (ball.z <= 0) {
      ball.z = 0;
      if (Math.abs(ball.vz) > 1.05) {
        bouncedOnGrass = true;
        const rest = getBounceRestitution(pitchCondition);
        ball.vz = -ball.vz * rest;
        const spinBoost = 1 + Math.max(-0.12, Math.min(0.12, (ball.topSpin ?? 0) * 0.04));
        ball.vx *= 0.91 * spinBoost;
        ball.vy *= 0.91 * spinBoost;
      } else {
        ball.vz = 0;
      }
    } else {
      ball.vx *= airDrag;
      ball.vy *= airDrag;
    }
  } else {
    ball.vx *= groundFriction;
    ball.vy *= groundFriction;
  }

  if (Math.hypot(ball.vx, ball.vy) < 0.08 && ball.z === 0) {
    ball.vx = 0;
    ball.vy = 0;
    ball.spin = 0;
    ball.topSpin = 0;
  }

  // Goalpost & Crossbar collisions (left x=0, right x=105)
  const postRadius = 0.12;
  const posts = [
    { x: 0, y: PITCH.HALF_Y - PITCH.GOAL_HALF },
    { x: 0, y: PITCH.HALF_Y + PITCH.GOAL_HALF },
    { x: PITCH.LENGTH, y: PITCH.HALF_Y - PITCH.GOAL_HALF },
    { x: PITCH.LENGTH, y: PITCH.HALF_Y + PITCH.GOAL_HALF },
  ];

  for (const post of posts) {
    const dx = ball.x - post.x;
    const dy = ball.y - post.y;
    const dist = Math.hypot(dx, dy);
    const minDist = ball.radius + postRadius;
    if (dist < minDist && dist > 0.0001 && ball.z < PITCH.GOAL_HEIGHT + ball.radius) {
      const nx = dx / dist;
      const ny = dy / dist;
      ball.x = post.x + nx * minDist;
      ball.y = post.y + ny * minDist;
      const dot = ball.vx * nx + ball.vy * ny;
      if (dot < 0) {
        ball.vx = (ball.vx - 2 * dot * nx) * 0.72;
        ball.vy = (ball.vy - 2 * dot * ny) * 0.72;
        hitPost = true;
      }
    }
  }

  // Crossbar collision
  if (
    Math.abs(ball.y - PITCH.HALF_Y) < PITCH.GOAL_HALF &&
    Math.abs(ball.z - PITCH.GOAL_HEIGHT) < ball.radius + 0.11 &&
    (Math.abs(ball.x) < ball.radius + 0.11 || Math.abs(ball.x - PITCH.LENGTH) < ball.radius + 0.11)
  ) {
    ball.vx = -ball.vx * 0.65;
    ball.vz = -Math.abs(ball.vz) * 0.52;
    hitPost = true;
  }

  // Net containment & elastic mesh stretch when inside goal frame
  const inLeftNet =
    ball.x < 0 &&
    ball.x > -PITCH.GOAL_DEPTH &&
    Math.abs(ball.y - PITCH.HALF_Y) < PITCH.GOAL_HALF;
  const inRightNet =
    ball.x > PITCH.LENGTH &&
    ball.x < PITCH.LENGTH + PITCH.GOAL_DEPTH &&
    Math.abs(ball.y - PITCH.HALF_Y) < PITCH.GOAL_HALF;
  if (inLeftNet || inRightNet) {
    const impactSpeed = Math.hypot(ball.vx, ball.vy);
    if (impactSpeed > 4.5) {
      hitNet = true;
      const stretchAmount = Math.min(0.68, impactSpeed * 0.025);
      if (inLeftNet) {
        ball.netStretchLeft = Math.max(ball.netStretchLeft ?? 0, stretchAmount);
      } else {
        ball.netStretchRight = Math.max(ball.netStretchRight ?? 0, stretchAmount);
      }
    }
    ball.vx *= Math.pow(0.82, dt * 60);
    ball.vy *= Math.pow(0.82, dt * 60);
    if (ball.x < -PITCH.GOAL_DEPTH + 0.25) {
      ball.x = -PITCH.GOAL_DEPTH + 0.25;
      ball.vx = Math.abs(ball.vx) * 0.18;
      ball.netStretchLeft = Math.max(ball.netStretchLeft ?? 0, 0.42);
    }
    if (ball.x > PITCH.LENGTH + PITCH.GOAL_DEPTH - 0.25) {
      ball.x = PITCH.LENGTH + PITCH.GOAL_DEPTH - 0.25;
      ball.vx = -Math.abs(ball.vx) * 0.18;
      ball.netStretchRight = Math.max(ball.netStretchRight ?? 0, 0.42);
    }
  }

  arena.ballBody.position.set(ball.x, ball.y, ball.z + ball.radius);
  arena.ballBody.velocity.set(ball.vx, ball.vy, ball.vz);

  return { hitPost, bouncedOnGrass, hitNet };
}

/**
 * Real-World Player Kinematics (m and m/s, delta-time driven):
 * - Pitch: 105 x 68 meters.
 * - Jog speed: 4.0 to 5.0 m/s depending on player attributes.
 * - Sprint speed: 8.0 to 9.5 m/s depending on player attributes (and speedMultiplier from AI difficulty).
 * - Acceleration: 0 to top speed in 2.0 to 3.0 seconds (linear + inertial ramp).
 * - Full-pitch 105m sprint takes between 12.0 and 15.0 seconds.
 * - Realistic inertia: turns body before velocity vector aligns, leans into curves, and skids when braking from high speed.
 * - 20 Motion-Capture States + Foot IK ground placement.
 */
export function stepPlayerMovement(
  p: MatchPlayerState,
  moveX: number,
  moveY: number,
  sprint: boolean,
  hasBall: boolean,
  dt: number,
  pitchCondition: PitchCondition,
  speedMultiplier = 1.0,
  lookAtPoint?: { x: number; y: number }
): void {
  if (p.redCard) return;

  p.tackleCooldown = Math.max(0, p.tackleCooldown - dt);
  p.stunTimer = Math.max(0, p.stunTimer - dt);
  p.kickAnimTimer = Math.max(0, p.kickAnimTimer - dt);
  p.diveTimer = Math.max(0, p.diveTimer - dt);
  if (p.fallTimer && p.fallTimer > 0) p.fallTimer = Math.max(0, p.fallTimer - dt);
  if (p.jostleTimer && p.jostleTimer > 0) p.jostleTimer = Math.max(0, p.jostleTimer - dt);
  if (p.brakeTimer && p.brakeTimer > 0) p.brakeTimer = Math.max(0, p.brakeTimer - dt);
  if (p.headerTimer && p.headerTimer > 0) p.headerTimer = Math.max(0, p.headerTimer - dt);
  if (p.passAnimTimer && p.passAnimTimer > 0) p.passAnimTimer = Math.max(0, p.passAnimTimer - dt);
  if (p.feintTimer && p.feintTimer > 0) p.feintTimer = Math.max(0, p.feintTimer - dt);
  if (p.orientedControlTimer && p.orientedControlTimer > 0) {
    p.orientedControlTimer = Math.max(0, p.orientedControlTimer - dt);
  }
  if (p.volleyTimer && p.volleyTimer > 0) p.volleyTimer = Math.max(0, p.volleyTimer - dt);
  if (p.jumpTimer && p.jumpTimer > 0) p.jumpTimer = Math.max(0, p.jumpTimer - dt);
  if (p.lamentTimer && p.lamentTimer > 0) p.lamentTimer = Math.max(0, p.lamentTimer - dt);
  if (p.standingTackleTimer && p.standingTackleTimer > 0) {
    p.standingTackleTimer = Math.max(0, p.standingTackleTimer - dt);
  }
  if (p.dribbleLooseTimer && p.dribbleLooseTimer > 0) {
    p.dribbleLooseTimer = Math.max(0, p.dribbleLooseTimer - dt);
  }

  const isTitan = Boolean(p.isRacingTitan && isRacingTitansMasterFlagEnabled());
  if (isTitan) {
    p.stamina = 100;
    p.injured = false;
    p.stunTimer = 0;
    p.fallTimer = 0;
    p.dribbleLooseTimer = 0;
  }

  if (p.slideTimer > 0) {
    p.slideTimer = Math.max(0, p.slideTimer - dt);
    // Sustained forward lunge displacement across the grass (5.5m - 7.0m total slide)
    const slideFriction = pitchCondition === 'humedo' ? 0.972 : 0.958;
    p.vx *= Math.pow(slideFriction, dt * 60);
    p.vy *= Math.pow(slideFriction, dt * 60);
    const curSlideSpd = Math.hypot(p.vx, p.vy);
    if (p.slideTimer > 0.22 && curSlideSpd < 8.2) {
      p.vx = Math.cos(p.facing) * 8.2;
      p.vy = Math.sin(p.facing) * 8.2;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.leanForward = -0.96;
    p.leanBank = 0;
    p.animState = 'slide';
    p.footIkLeftY = 0.02;
    p.footIkRightY = 0.0;
    if (p.slideTimer === 0) {
      p.slideHitResolved = false;
    }
    clampPlayerToBounds(p);
    return;
  }

  if ((p.fallTimer && p.fallTimer > 0) || p.stunTimer > 0 || p.diveTimer > 0) {
    // Goalkeepers diving across the wider 9.8m goal preserve lateral momentum longer
    const isGkDive = p.diveTimer > 0 && p.player.position === 'GK';
    const damping = isGkDive ? 0.935 : 0.86;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.pow(damping, dt * 60);
    p.vy *= Math.pow(damping, dt * 60);
    if (isGkDive) {
      p.animState = 'gk_action';
      if (!p.gkAction || p.gkAction === 'idle') p.gkAction = 'dive_save';
    } else {
      p.animState = p.fallTimer && p.fallTimer > 0 ? 'fall' : 'idle';
    }
    p.footIkLeftY = 0;
    p.footIkRightY = 0;
    clampPlayerToBounds(p);
    return;
  }

  const inputMag = Math.hypot(moveX, moveY);
  const dirX = inputMag > 0.05 ? moveX / Math.max(1, inputMag) : 0;
  const dirY = inputMag > 0.05 ? moveY / Math.max(1, inputMag) : 0;

  const paceNorm = p.player.attributes.pace / 100;
  const accelNorm = p.player.attributes.acceleration / 100;
  const dribbleNorm = p.player.attributes.dribbling / 100;
  const staminaNorm = p.player.attributes.stamina / 100;
  const injuryPenalty = p.injured ? 0.88 : 1.0;

  // Gentle fatigue curve: players stay fast and only lose a small percentage below 25% stamina
  const fatigueFactor =
    p.stamina < 25 ? Math.max(0.88, 0.88 + (p.stamina / 25) * 0.12) : 1.0;
  const turfSpeedFactor =
    pitchCondition === 'barro' ? 0.93 : pitchCondition === 'pesado' ? 0.96 : 1.0;

  // Goalkeepers in live match (slotIndex === 0) get a lateral agility boost to cover the wider 9.8m goal frame
  const gkAgilityBoost =
    p.slotIndex === 0 && p.player.position === 'GK' && speedMultiplier > 1.0 ? 1.16 : 1.0;

  // Jog: 4.0 to 5.0 m/s | Sprint: 8.0 to 9.5 m/s (scaled by speedMultiplier in live match)
  const jogSpeed =
    PHYSICS_TUNING.JOG_SPEED_MIN_MPS +
    paceNorm * (PHYSICS_TUNING.JOG_SPEED_MAX_MPS - PHYSICS_TUNING.JOG_SPEED_MIN_MPS);
  const sprintSpeed =
    PHYSICS_TUNING.SPRINT_SPEED_MIN_MPS +
    paceNorm * (PHYSICS_TUNING.SPRINT_SPEED_MAX_MPS - PHYSICS_TUNING.SPRINT_SPEED_MIN_MPS);

  const canSprint = sprint && p.stamina > 2 && inputMag > 0.15;
  const rawMaxSpeed =
    (canSprint ? sprintSpeed : jogSpeed) *
    speedMultiplier *
    gkAgilityBoost *
    fatigueFactor *
    turfSpeedFactor *
    injuryPenalty;
  const carryPenalty = hasBall ? 0.97 + dribbleNorm * 0.03 : 1.0;

  const targetSpeed = rawMaxSpeed * carryPenalty * Math.min(1, inputMag);
  const currentSpeed = Math.hypot(p.vx, p.vy);

  // Turning with responsive rotational inertia
  let angleDiff = 0;
  if (inputMag > 0.08) {
    const desiredFacing = Math.atan2(dirY, dirX);
    angleDiff = Math.atan2(
      Math.sin(desiredFacing - p.facing),
      Math.cos(desiredFacing - p.facing)
    );
    const speedRatio = Math.min(1, currentSpeed / 9.5);
    const maxTurnRate =
      (9.2 + dribbleNorm * 5.2) * (1 - speedRatio * 0.25) * fatigueFactor;
    const stepAngle = Math.max(
      -maxTurnRate * dt,
      Math.min(maxTurnRate * dt, angleDiff)
    );
    p.facing = Math.atan2(
      Math.sin(p.facing + stepAngle),
      Math.cos(p.facing + stepAngle)
    );
    p.angularVel = stepAngle / Math.max(0.001, dt);

    // Quick body feint (amague) when cutting sharply with the ball at dribbling speed
    if (hasBall && Math.abs(angleDiff) > 0.58 && currentSpeed > 2.2 && (!p.feintTimer || p.feintTimer <= 0)) {
      p.feintTimer = 0.24;
    }
  } else {
    p.angularVel = (p.angularVel ?? 0) * Math.pow(0.8, dt * 60);
  }

  // Head & upper body look target angle (oriented toward ball or look direction)
  if (lookAtPoint) {
    const lookAngle = Math.atan2(lookAtPoint.y - p.y, lookAtPoint.x - p.x);
    const relLook = Math.atan2(
      Math.sin(lookAngle - p.facing),
      Math.cos(lookAngle - p.facing)
    );
    const clampedLook = Math.max(-1.05, Math.min(1.05, relLook));
    p.lookTargetAngle =
      (p.lookTargetAngle ?? 0) +
      (clampedLook - (p.lookTargetAngle ?? 0)) * Math.min(1, dt * 11);
  } else {
    p.lookTargetAngle = (p.lookTargetAngle ?? 0) * Math.pow(0.85, dt * 60);
  }

  // Sharp >75° direction change at high speed triggers braking skid / turn inertia
  const sharpCut = inputMag > 0.15 && Math.abs(angleDiff) > 1.35 && currentSpeed > 5.2;
  const hardStop = inputMag <= 0.12 && currentSpeed > 5.5;
  if (sharpCut || hardStop) {
    p.brakeTimer = 0.24;
  }
  if (!isTitan && hasBall && inputMag > 0.15 && Math.abs(angleDiff) > 1.15 && currentSpeed > 4.6) {
    p.dribbleLooseTimer = Math.max(p.dribbleLooseTimer ?? 0, 0.34);
  }

  // Velocity vector follows body facing with natural turn inertia
  const baseTurnPenalty = hasBall && Math.abs(angleDiff) > 1.05 ? 0.14 : 0.10;
  const turnDrag = inputMag > 0.08 ? Math.max(0.78, 1 - Math.abs(angleDiff) * baseTurnPenalty) : 1.0;
  const moveDirX = Math.cos(p.facing) * 0.52 + dirX * 0.48;
  const moveDirY = Math.sin(p.facing) * 0.52 + dirY * 0.48;
  const moveNorm = Math.max(0.001, Math.hypot(moveDirX, moveDirY));
  const targetVx = (moveDirX / moveNorm) * targetSpeed * turnDrag;
  const targetVy = (moveDirY / moveNorm) * targetSpeed * turnDrag;

  // Responsive acceleration in m/s²
  const dvx = targetVx - p.vx;
  const dvy = targetVy - p.vy;
  const dvMag = Math.hypot(dvx, dvy);
  const isAccelerating = targetSpeed >= currentSpeed - 0.2 && !sharpCut;

  const maxAccelMps2 = isAccelerating
    ? (4.65 + accelNorm * 1.75) * fatigueFactor * speedMultiplier * gkAgilityBoost
    : 10.4 + accelNorm * 3.8;

  if (dvMag > 0.0001) {
    const maxStep = maxAccelMps2 * dt;
    if (dvMag <= maxStep) {
      p.vx = targetVx;
      p.vy = targetVy;
    } else {
      p.vx += (dvx / dvMag) * maxStep;
      p.vy += (dvy / dvMag) * maxStep;
    }
  }

  p.x += p.vx * dt;
  p.y += p.vy * dt;
  clampPlayerToBounds(p);

  const newSpeed = Math.hypot(p.vx, p.vy);
  if (newSpeed > 0.15) {
    const strideAnimSpeedScale = isTitan
      ? RACING_TITANS_CONFIG.TITAN_ANIMATION_SPEED_SCALE
      : 1.0;
    p.stridePhase += (1.35 + newSpeed * 1.45) * strideAnimSpeedScale * dt;
  }

  // Foot Inverse Kinematics (Cinemática Inversa en los pies para apoyar firmemente en el césped)
  // Stance foot locks to turf height (0.0m) while swing foot arcs to clear the grass.
  if (p.standingTackleTimer && p.standingTackleTimer > 0) {
    p.footIkLeftY = 0;
    p.footIkRightY = 0.14;
  } else if ((p.jumpTimer && p.jumpTimer > 0) || (p.headerTimer && p.headerTimer > 0)) {
    p.footIkLeftY = 0.38;
    p.footIkRightY = 0.34;
  } else if (newSpeed > 0.22) {
    const liftScale = Math.min(0.24, 0.05 + (newSpeed / 9.5) * 0.19);
    p.footIkLeftY = Math.max(0, Math.sin(p.stridePhase)) * liftScale;
    p.footIkRightY = Math.max(0, -Math.sin(p.stridePhase)) * liftScale;
  } else {
    p.footIkLeftY = 0;
    p.footIkRightY = 0;
  }

  // Body lean: forward pitch when accelerating/sprinting, backward pitch when braking, lateral bank when cornering
  const isBraking = (p.brakeTimer ?? 0) > 0;
  const desiredLeanForward = isBraking
    ? -0.18
    : Math.min(0.28, (newSpeed / 9.0) * (canSprint ? 0.25 : 0.14));
  const desiredLeanBank = Math.max(
    -0.28,
    Math.min(0.28, -(p.angularVel ?? 0) * (newSpeed / 8.5) * 0.055)
  );
  p.leanForward =
    (p.leanForward ?? 0) + (desiredLeanForward - (p.leanForward ?? 0)) * Math.min(1, dt * 11);
  p.leanBank =
    (p.leanBank ?? 0) + (desiredLeanBank - (p.leanBank ?? 0)) * Math.min(1, dt * 11);

  // Determine explicit Animation State across all Mocap States for 3D skeletal blending
  if (p.lamentTimer && p.lamentTimer > 0) {
    p.animState = 'lament';
  } else if (p.player.position === 'GK' && p.gkAction && p.gkAction !== 'idle' && (p.diveTimer > 0 || p.kickAnimTimer > 0)) {
    p.animState = 'gk_action';
  } else if (p.standingTackleTimer && p.standingTackleTimer > 0) {
    p.animState = 'standing_tackle';
  } else if (p.headerTimer && p.headerTimer > 0) {
    p.animState = 'header';
  } else if (p.volleyTimer && p.volleyTimer > 0) {
    p.animState = 'volley';
  } else if (p.jumpTimer && p.jumpTimer > 0) {
    p.animState = 'jump';
  } else if (p.kickAnimTimer > 0) {
    p.animState = p.passAnimTimer && p.passAnimTimer > 0 ? 'pass' : 'shoot';
  } else if (p.orientedControlTimer && p.orientedControlTimer > 0) {
    p.animState = 'oriented_control';
  } else if (p.feintTimer && p.feintTimer > 0 && hasBall) {
    p.animState = 'feint';
  } else if (p.jostleTimer && p.jostleTimer > 0) {
    p.animState = 'jostle';
  } else if (isBraking) {
    p.animState = 'brake';
  } else if (Math.abs(angleDiff) > 0.85 && newSpeed > 2.0) {
    p.animState = 'turn';
  } else if (hasBall && newSpeed > 1.8 && newSpeed <= 6.5) {
    p.animState = 'dribble';
  } else if (newSpeed > 6.2) {
    p.animState = 'sprint';
  } else if (newSpeed > 2.4) {
    p.animState = 'jog';
  } else if (newSpeed > 0.25) {
    p.animState = 'walk';
  } else {
    p.animState = 'idle';
    if (p.player.position === 'GK') p.gkAction = 'idle';
  }

  // High-endurance stamina system: players drain slowly only when sprinting and recover while jogging/walking
  if (isTitan) {
    p.stamina = 100;
    p.injured = false;
  } else if (canSprint) {
    const drain = Math.max(0.16, 0.48 - staminaNorm * 0.26) * dt;
    p.stamina = Math.max(0, p.stamina - drain);
  } else if (newSpeed > 1.5) {
    const recovery = (0.75 + staminaNorm * 0.65) * dt;
    p.stamina = Math.min(100, p.stamina + recovery);
  } else {
    const recovery = (2.6 + staminaNorm * 1.8) * dt;
    p.stamina = Math.min(100, p.stamina + recovery);
  }
}

export function clampPlayerToBounds(p: MatchPlayerState): void {
  p.x = Math.max(-2.5, Math.min(PITCH.LENGTH + 2.5, p.x));
  p.y = Math.max(-2.5, Math.min(PITCH.WIDTH + 2.5, p.y));
}

export interface CollisionResolutionSummary {
  hadHardBodyClash: boolean;
  dispossessedCarrierId: string | null;
  newOwnerId: string | null;
}

/**
 * Physical player collisions with mass, inertia, shoving & shoulder-to-shoulder jostling (forcejeo).
 * Scales collider radius for Racing Titans and enforces unstoppable shoving against normal opponents.
 */
export function resolvePlayerCollisions(
  players: MatchPlayerState[],
  currentBallOwnerId: string | null = null,
  rng: () => number = Math.random
): CollisionResolutionSummary {
  let hadHardBodyClash = false;
  let dispossessedCarrierId: string | null = null;
  let newOwnerId: string | null = null;
  const masterTitanFlag = isRacingTitansMasterFlagEnabled();

  for (let i = 0; i < players.length; i++) {
    const a = players[i];
    if (a.redCard) continue;
    const aIsTitan = Boolean(masterTitanFlag && a.isRacingTitan);
    const radiusA = getPlayerColliderRadius(a);
    const buildMassBonusA =
      a.player.bodyBuild === 'robusto' ? 7 : a.player.bodyBuild === 'delgado' ? -5 : 0;
    const massA = aIsTitan
      ? 2400
      : 65 +
        ((a.player.heightCm ?? 178) - 165) * 0.55 +
        a.player.attributes.strength * 0.22 +
        buildMassBonusA;

    for (let j = i + 1; j < players.length; j++) {
      const b = players[j];
      if (b.redCard) continue;
      const bIsTitan = Boolean(masterTitanFlag && b.isRacingTitan);
      const radiusB = getPlayerColliderRadius(b);
      const pairMinDist = radiusA + radiusB;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < pairMinDist * pairMinDist && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const ny = dy / dist;

        const buildMassBonusB =
          b.player.bodyBuild === 'robusto' ? 7 : b.player.bodyBuild === 'delgado' ? -5 : 0;
        const massB = bIsTitan
          ? 2400
          : 65 +
            ((b.player.heightCm ?? 178) - 165) * 0.55 +
            b.player.attributes.strength * 0.22 +
            buildMassBonusB;
        const totalMass = massA + massB;
        const shareA = aIsTitan && !bIsTitan ? 0.01 : bIsTitan && !aIsTitan ? 0.99 : massB / totalMass;
        const shareB = 1 - shareA;

        const overlap = (pairMinDist - dist) * 0.85;
        a.x -= nx * overlap * shareA;
        a.y -= ny * overlap * shareA;
        b.x += nx * overlap * shareB;
        b.y += ny * overlap * shareB;

        if (a.side !== b.side) {
          a.jostleTimer = aIsTitan && !bIsTitan ? 0 : 0.25;
          b.jostleTimer = bIsTitan && !aIsTitan ? 0 : 0.25;

          // Unstoppable Titan shoves normal rivals away on contact
          if (aIsTitan && !bIsTitan) {
            const shoveSpeed = 5.6;
            b.vx += nx * shoveSpeed;
            b.vy += ny * shoveSpeed;
            b.x += nx * 0.35;
            b.y += ny * 0.35;
            b.jostleTimer = 0.42;
            b.stunTimer = Math.max(b.stunTimer, 0.28);
            hadHardBodyClash = true;
          } else if (bIsTitan && !aIsTitan) {
            const shoveSpeed = 5.6;
            a.vx -= nx * shoveSpeed;
            a.vy -= ny * shoveSpeed;
            a.x -= nx * 0.35;
            a.y -= ny * 0.35;
            a.jostleTimer = 0.42;
            a.stunTimer = Math.max(a.stunTimer, 0.28);
            hadHardBodyClash = true;
          }
        }

        // Relative velocity along collision normal (physical impulse & shove)
        const rvx = b.vx - a.vx;
        const rvy = b.vy - a.vy;
        const normalVel = rvx * nx + rvy * ny;
        if (normalVel < 0) {
          const restitution = 0.24;
          const impulse = -(1 + restitution) * normalVel;
          a.vx -= nx * impulse * shareA * 0.58;
          a.vy -= ny * impulse * shareA * 0.58;
          b.vx += nx * impulse * shareB * 0.58;
          b.vy += ny * impulse * shareB * 0.58;

          if (Math.abs(normalVel) > 2.4) {
            hadHardBodyClash = true;
          }
        }

        // Shoulder-to-shoulder physical challenge for the ball (forcejeo)
        if (currentBallOwnerId && a.side !== b.side && dispossessedCarrierId === null) {
          const carrier =
            a.id === currentBallOwnerId ? a : b.id === currentBallOwnerId ? b : null;
          const defender = carrier === a ? b : carrier === b ? a : null;

          if (carrier && defender) {
            const carrierIsTitan = Boolean(masterTitanFlag && carrier.isRacingTitan);
            const defenderIsTitan = Boolean(masterTitanFlag && defender.isRacingTitan);

            // Racing Titans NEVER lose the ball in body clashes against normal players
            if (carrierIsTitan && !defenderIsTitan) {
              continue;
            }

            // Racing Titan colliding with a normal ball carrier strips the ball immediately
            if (defenderIsTitan && !carrierIsTitan && defender.tackleCooldown <= 0) {
              dispossessedCarrierId = carrier.id;
              newOwnerId = defender.id;
              carrier.stunTimer = 0.48;
              defender.tackleCooldown = 0.25;
              hadHardBodyClash = true;
              continue;
            }

            if (defender.tackleCooldown <= 0 && defender.stunTimer <= 0) {
              const defPower =
                defender.player.attributes.strength * 0.48 +
                defender.player.attributes.tackling * 0.52 +
                (defender.stamina / 100) * 12;
              const carBalance =
                carrier.player.attributes.strength * 0.42 +
                carrier.player.attributes.dribbling * 0.58 +
                (carrier.stamina / 100) * 14;

              const toCarrierX = carrier.x - defender.x;
              const toCarrierY = carrier.y - defender.y;
              const contactAngle = Math.atan2(toCarrierY, toCarrierX);
              const angleDiff = Math.abs(
                Math.atan2(
                  Math.sin(contactAngle - carrier.facing),
                  Math.cos(contactAngle - carrier.facing)
                )
              );
              const isLooseTurn = (carrier.dribbleLooseTimer ?? 0) > 0;
              const isSideOrFront = angleDiff > 0.72 || isLooseTurn;

              if (isSideOrFront) {
                const looseBonus = isLooseTurn ? 0.24 : 0;
                const winProb =
                  0.18 +
                  looseBonus +
                  Math.max(-0.1, Math.min(0.35, (defPower - carBalance) / 125));
                if (rng() < winProb) {
                  dispossessedCarrierId = carrier.id;
                  newOwnerId = defender.id;
                  carrier.stunTimer = 0.38;
                  defender.tackleCooldown = 0.55;
                  hadHardBodyClash = true;
                }
              }
            }
          }
        }
      }
    }
  }

  return { hadHardBodyClash, dispossessedCarrierId, newOwnerId };
}
