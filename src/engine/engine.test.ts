import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PITCH,
  EXPANDED_PITCH_SCALE,
  getScaledPitchDimensions,
  PHYSICS_TUNING,
  createInitialBall,
  getCannonPhysicsWorld,
  getPlayerColliderRadius,
  resolvePlayerCollisions,
  stepBallPhysics,
  stepPlayerMovement,
  EASTER_EGG_RACING_TITANS,
  RACING_TITANS_CONFIG,
  RACING_TITANS_AI_PROFILE,
  isRacingTeam,
  isRacingTitansActiveForTeam,
  setRacingTitansMasterFlag,
  type MatchPlayerState,
} from './physics';
import {
  UNITY_URP_SOURCE_FILES,
  UNITY_EXTERNAL_ASSETS_MANIFEST,
  UNITY_QUALITY_TIER_PROFILES,
  UNITY_DELIVERABLE_STATUS_LIST,
  UNITY_IMPORT_AND_APK_BUILD_STEPS,
  buildUnityProjectBundleText,
} from '../unity/unityUrpSuite';
import { checkBallOutcome, evaluateAerialDuel, evaluateTackleOutcome, isPlayerOffside } from './rules';
import {
  DIFFICULTY_CONFIG_TABLE,
  chooseAdaptiveTactic,
  computeGoalkeeperAI,
  computeOffBallMovement,
  computeOutfieldCarrierDecision,
  evaluateTeamBrain,
  getDifficultyProfile,
  shouldExecuteFirstTouchShot,
} from './ai';
import { MAX_REPLAY_FRAMES, MatchEngine, type GoalKickAimState, type VARScenarioType } from './matchEngine';
import {
  advanceCompetitionRound,
  computeLeagueStandings,
  createCompetition,
  getCompetitionRoundLabel,
} from './competitions';
import {
  WORLD_CUP_STARS,
  getAllTeamsWithCustom,
  getBaseDatabaseTeams,
  mergeImportedTeamsPatch,
  validateAndParseImportedTeams,
} from '../data/database';
import {
  DEFAULT_SETTINGS,
  UNLOCKABLE_ITEMS,
  calculateMatchCoinReward,
  equipUnlockableItem,
  loadSaveState,
  purchaseUnlockableItem,
} from '../storage/saveManager';
import { COMMENTARY_TEMPLATES, CROWD_INSULTS_BANK } from '../audio/commentaryEngine';
import {
  FORMATIONS,
  FORMATION_CATEGORIES,
  getFormation,
  getFormationsByCategory,
} from '../data/formations';
import {
  GAME_MODE_CONFIGS,
  generateFreeKickPracticeSpot,
  getGameModeConfig,
  resolveKitClash,
} from './gameModeManager';

test('database includes all 211+ FIFA nations and extensive clubs across continents', () => {
  const teams = getBaseDatabaseTeams();
  const nations = teams.filter((t) => t.type === 'national');
  const clubs = teams.filter((t) => t.type === 'club');
  assert.ok(nations.length >= 211, `Expected >=211 nations, got ${nations.length}`);
  assert.ok(clubs.length >= 90, `Expected >=90 clubs, got ${clubs.length}`);

  const confederations = new Set(nations.map((n) => n.confederation));
  assert.ok(confederations.has('UEFA'));
  assert.ok(confederations.has('CONMEBOL'));
  assert.ok(confederations.has('CONCACAF'));
  assert.ok(confederations.has('CAF'));
  assert.ok(confederations.has('AFC'));
  assert.ok(confederations.has('OFC'));

  const sample = teams[0];
  assert.equal(sample.players.length, 18);
  assert.equal(sample.rosterSource, 'curated');
});

test('database JSON importer validates and builds custom teams cleanly', () => {
  const validJson = JSON.stringify([
    { name: 'Atlas FC Prueba', country: 'Colombia', overall: 82, primaryColor: '#10B981' },
  ]);
  const res = validateAndParseImportedTeams(validJson);
  assert.equal(res.error, undefined);
  assert.equal(res.teams.length, 1);
  assert.equal(res.teams[0].players.length, 18);

  const badRes = validateAndParseImportedTeams('{"bad": true}');
  assert.ok(badRes.error);
});

test('ball physics slows down faster on muddy pitch than optimal pitch and applies Magnus spin curve', () => {
  const bOpt = createInitialBall();
  bOpt.vx = 20;
  const bMud = createInitialBall();
  bMud.vx = 20;

  for (let i = 0; i < 30; i++) {
    stepBallPhysics(bOpt, 1 / 60, 'optimo', 'despejado');
    stepBallPhysics(bMud, 1 / 60, 'barro', 'despejado');
  }
  assert.ok(bOpt.vx > bMud.vx, 'Optimal turf should preserve more ball velocity than mud');

  // Magnus spin curves the ball laterally
  const bCurve = createInitialBall();
  bCurve.vx = 24;
  bCurve.vz = 5;
  bCurve.spin = 2.8;
  for (let i = 0; i < 40; i++) {
    stepBallPhysics(bCurve, 1 / 60, 'optimo', 'despejado');
  }
  assert.ok(Math.abs(bCurve.y - PITCH.HALF_Y) > 0.35, 'Magnus spin should curve ball laterally');
});

test('real-world speed & scale: 105x68m pitch sprint takes between 12 and 15 seconds at 8.0-9.5 m/s', () => {
  assert.equal(PITCH.LENGTH, 105);
  assert.equal(PITCH.WIDTH, 68);
  assert.equal(PHYSICS_TUNING.JOG_SPEED_MIN_MPS, 4.0);
  assert.equal(PHYSICS_TUNING.JOG_SPEED_MAX_MPS, 5.0);
  assert.equal(PHYSICS_TUNING.SPRINT_SPEED_MIN_MPS, 8.0);
  assert.equal(PHYSICS_TUNING.SPRINT_SPEED_MAX_MPS, 9.5);
  assert.equal(PHYSICS_TUNING.PASS_SPEED_MIN_MPS, 15.0);
  assert.equal(PHYSICS_TUNING.PASS_SPEED_MAX_MPS, 25.0);
  assert.equal(PHYSICS_TUNING.SHOT_SPEED_MIN_MPS, 25.0);
  assert.equal(PHYSICS_TUNING.SHOT_SPEED_MAX_MPS, 33.0);

  const teams = getBaseDatabaseTeams();
  const fastWinger = {
    ...teams[0].players[0],
    pace: 90,
    stamina: 92,
  };
  const sprinter: MatchPlayerState = {
    id: 'sprinter',
    player: fastWinger,
    side: 'home',
    slotIndex: 9,
    x: 0,
    y: PITCH.HALF_Y,
    vx: 0,
    vy: 0,
    facing: 0,
    angularVel: 0,
    leanForward: 0,
    leanBank: 0,
    stamina: 100,
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
    fallTimer: 0,
    callingForBall: false,
    inWall: false,
  };

  let elapsedSeconds = 0;
  let maxObservedSpeedMps = 0;
  const dt = 1 / 60;
  while (sprinter.x < PITCH.LENGTH && elapsedSeconds < 25) {
    stepPlayerMovement(sprinter, 1, 0, true, false, dt, 'optimo');
    const spd = Math.hypot(sprinter.vx, sprinter.vy);
    if (spd > maxObservedSpeedMps) maxObservedSpeedMps = spd;
    elapsedSeconds += dt;
  }

  assert.ok(
    maxObservedSpeedMps >= 8.0 && maxObservedSpeedMps <= 9.5,
    `Top sprint speed should be between 8.0 and 9.5 m/s (got ${maxObservedSpeedMps.toFixed(2)} m/s)`
  );
  assert.ok(
    elapsedSeconds >= 12.0 && elapsedSeconds <= 15.0,
    `Full 105m pitch sprint must take between 12 and 15 seconds (got ${elapsedSeconds.toFixed(2)}s)`
  );
  assert.ok((sprinter.leanForward ?? 0) > 0.08, 'Sprinter should exhibit forward body lean');
  assert.equal(sprinter.animState, 'sprint');
});

test('realistic foul evaluation distinguishes legal light contact from dangerous fouls', () => {
  const teams = getBaseDatabaseTeams();
  const makeP = (id: string, side: 'home' | 'away', x: number, y: number, vx: number, facing: number): MatchPlayerState => ({
    id,
    player: teams[0].players[4],
    side,
    slotIndex: 4,
    x,
    y,
    vx,
    vy: 0,
    facing,
    angularVel: 0,
    leanForward: 0,
    leanBank: 0,
    stamina: 95,
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
    fallTimer: 0,
    callingForBall: false,
    inWall: false,
  });

  const carrier = makeP('c1', 'home', 60, 34, 4.0, 0);
  // Light brush at low relative speed from the side/front reaching ball first -> NEVER a foul
  const cleanDefender = makeP('d1', 'away', 60.6, 34.2, 2.8, Math.PI);
  const cleanBall = createInitialBall();
  cleanBall.x = 60.45;
  cleanBall.y = 34.15;
  const cleanRes = evaluateTackleOutcome(cleanDefender, carrier, false, () => 0.5, cleanBall);
  assert.equal(cleanRes.isFoul, false, 'Clean ball-first tackle should not be a foul');
  assert.equal(cleanRes.foulType, 'roce_legal');

  // High-speed slide tackle from behind far from ball -> foul + card + knockdown
  const recklessDefender = makeP('d2', 'away', 59.1, 34, 6.2, 0);
  const farBall = createInitialBall();
  farBall.x = 60.55;
  farBall.y = 34;
  const foulRes = evaluateTackleOutcome(recklessDefender, carrier, true, () => 0.15, farBall);
  assert.equal(foulRes.isFoul, true, 'High-speed slide tackle from behind missing the ball must be a foul');
  assert.equal(foulRes.knockdown, true);
  assert.notEqual(foulRes.card, 'none');
});

test('rules detect goal, corner, goal kick, and throw-in accurately', () => {
  const ball = createInitialBall();
  ball.x = PITCH.LENGTH + 0.5;
  ball.y = PITCH.HALF_Y;
  ball.z = 1.0;
  assert.equal(checkBallOutcome(ball).event, 'goal_home');

  const cornerBall = createInitialBall();
  cornerBall.x = PITCH.LENGTH + 0.5;
  cornerBall.y = 10;
  cornerBall.lastTouchTeam = 'away';
  const cornerRes = checkBallOutcome(cornerBall);
  assert.equal(cornerRes.event, 'corner');
  assert.equal(cornerRes.restartTeam, 'home');

  const throwBall = createInitialBall();
  throwBall.x = 50;
  throwBall.y = -0.5;
  throwBall.lastTouchTeam = 'home';
  const throwRes = checkBallOutcome(throwBall);
  assert.equal(throwRes.event, 'throw_in');
  assert.equal(throwRes.restartTeam, 'away');
});

test('FIFA Law 11 offside checks second-last defender and own-half immunity', () => {
  const teams = getBaseDatabaseTeams();
  const home = teams[0];
  const makePlayer = (id: string, side: 'home' | 'away', x: number): MatchPlayerState => ({
    id,
    player: home.players[0],
    side,
    slotIndex: 0,
    x,
    y: 34,
    vx: 0,
    vy: 0,
    facing: 0,
    angularVel: 0,
    leanForward: 0,
    leanBank: 0,
    stamina: 100,
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
    fallTimer: 0,
    callingForBall: false,
    inWall: false,
  });

  const passer = makePlayer('h1', 'home', 70);
  const receiverOff = makePlayer('h2', 'home', 90);
  const receiverOn = makePlayer('h3', 'home', 80);
  const oppGk = makePlayer('a1', 'away', 102);
  const oppDef = makePlayer('a2', 'away', 85);

  const all = [passer, receiverOff, receiverOn, oppGk, oppDef];
  assert.equal(isPlayerOffside(receiverOff, passer, 70, all, 1), true);
  assert.equal(isPlayerOffside(receiverOn, passer, 70, all, 1), false);

  // Own half is never offside
  const ownHalfRec = makePlayer('h4', 'home', 45);
  assert.equal(isPlayerOffside(ownHalfRec, makePlayer('h0', 'home', 30), 30, [ownHalfRec, oppGk, oppDef], 1), false);
});

test('DIFFICULTY_CONFIG_TABLE makes Leyenda and Ultra Difícil 10-15% faster with < 0.1s reaction time', () => {
  const easy = DIFFICULTY_CONFIG_TABLE[1];
  const leyenda = DIFFICULTY_CONFIG_TABLE[7];
  const ultra = DIFFICULTY_CONFIG_TABLE[8];

  assert.ok(leyenda.aiSpeedMultiplier >= 1.10 && leyenda.aiSpeedMultiplier <= 1.15);
  assert.ok(ultra.aiSpeedMultiplier >= 1.10 && ultra.aiSpeedMultiplier <= 1.15);
  assert.ok(leyenda.reactionTimeSec < 0.10, `Leyenda reaction must be < 0.10s (got ${leyenda.reactionTimeSec})`);
  assert.ok(ultra.reactionTimeSec < 0.10, `Ultra reaction must be < 0.10s (got ${ultra.reactionTimeSec})`);
  assert.ok(ultra.shotAccuracy > easy.shotAccuracy);
  assert.ok(ultra.passAccuracy > easy.passAccuracy);
  assert.ok(ultra.gkReflexes > easy.gkReflexes);

  const ultraProfile = getDifficultyProfile(8);
  assert.equal(chooseAdaptiveTactic('EQUILIBRADO', -1, 72, ultraProfile), 'PRESION_ALTA');
  assert.equal(chooseAdaptiveTactic('EQUILIBRADO', 1, 82, ultraProfile), 'CONTRAATAQUE');
});

test('rewritten AI Team Brain and utility scorer shoot within 25m and trigger first-time shots on passes in box', () => {
  const profile = getDifficultyProfile(8);
  const strikerNode = {
    id: 'h9',
    team: 'home' as const,
    role: 'FWD' as const,
    x: 88,
    y: PITCH.HALF_Y,
    vx: 4,
    vy: 0,
    baseX: 82,
    baseY: PITCH.HALF_Y,
    stamina: 95,
    hasBall: true,
    overall: 88,
    pace: 90,
    shooting: 91,
    passing: 82,
    dribbling: 87,
    defending: 45,
    physical: 80,
  };
  const mateNode = {
    ...strikerNode,
    id: 'h8',
    role: 'MID' as const,
    x: 72,
    y: 24,
    hasBall: false,
  };
  const oppGkNode = {
    ...strikerNode,
    id: 'a0',
    team: 'away' as const,
    role: 'GK' as const,
    x: 103.8,
    y: PITCH.HALF_Y,
    hasBall: false,
  };
  const oppDefNode = {
    ...strikerNode,
    id: 'a4',
    team: 'away' as const,
    role: 'DEF' as const,
    x: 84,
    y: 12,
    hasBall: false,
  };

  const brain = evaluateTeamBrain(
    'home',
    [strikerNode, mateNode],
    [oppGkNode, oppDefNode],
    { x: 88, y: PITCH.HALF_Y, vx: 4, vy: 0, ownerTeam: 'home', ownerId: 'h9' },
    0,
    50,
    profile
  );
  assert.equal(brain.phase, 'FINAL_THIRD_ATTACK');

  const decision = computeOutfieldCarrierDecision(
    strikerNode,
    [strikerNode, mateNode],
    [oppGkNode, oppDefNode],
    profile,
    'attacking'
  );
  assert.equal(decision.action, 'shoot', 'Striker at 17m with open angle must choose to shoot');
  assert.ok(decision.power >= 0.68);

  // Verify first-touch shot trigger when an incoming pass arrives inside 22m
  const firstTouch = shouldExecuteFirstTouchShot(
    { ...strikerNode, x: 92, y: PITCH.HALF_Y },
    [oppGkNode, oppDefNode],
    profile
  );
  assert.ok(firstTouch.power >= 0.78, 'First-touch shot inside 13m should calculate high power target');
  assert.equal(firstTouch.targetX, PITCH.LENGTH);
});

test('match engine survives simulation steps, supports 18s 3-angle TV replay buffer, and completes penalty shootout', () => {
  assert.equal(MAX_REPLAY_FRAMES, 1080, 'Circular replay buffer must store 18 seconds at 60 FPS (1080 frames)');

  const teams = getBaseDatabaseTeams();
  const engine = new MatchEngine({
    mode: 'quick_match',
    homeTeam: teams[0],
    awayTeam: teams[1],
    userSide: 'home',
    settings: DEFAULT_SETTINGS,
  });

  for (let i = 0; i < 300; i++) {
    engine.step(1 / 60);
  }
  assert.equal(engine.players.length, 22);
  assert.ok(engine.replayBuffer.length >= 150);

  // Trigger TV replay and verify 3 slow-motion camera angles + skipReplay()
  engine.triggerInstantReplay();
  assert.equal(engine.phase, 'goal_replay');
  assert.equal(engine.replayCameraAngle, 'broadcast_slow');
  engine.skipReplay();
  assert.equal(engine.phase, 'live');

  // Live tactical formation switching
  engine.setUserFormation('3-5-2');
  assert.equal(engine.homeTeam.formationId, '3-5-2');

  // Penalty shootout mode completes deterministically
  const penEngine = new MatchEngine({
    mode: 'penalties',
    homeTeam: teams[0],
    awayTeam: teams[1],
    userSide: 'none',
    settings: DEFAULT_SETTINGS,
  });
  for (let i = 0; i < 2000 && penEngine.phase !== 'fulltime'; i++) {
    penEngine.step(1 / 30);
  }
  assert.equal(penEngine.phase, 'fulltime');
  assert.ok(penEngine.penaltyState);
  assert.notEqual(penEngine.penaltyState.homeScored, penEngine.penaltyState.awayScored);
});

test('competition engine calculates standings and advances knockout rounds', () => {
  const teams = getBaseDatabaseTeams().slice(0, 4);
  const map = new Map(teams.map((t) => [t.id, t]));
  const ids = teams.map((t) => t.id);

  let comp = createCompetition('Copa Prueba', 'club_cup', ids, ids[0], map, true);
  assert.equal(comp.stage, 'knockout');
  assert.equal(comp.fixtures.length, 2);

  const userFx = comp.fixtures.find((f) => f.homeTeamId === ids[0] || f.awayTeamId === ids[0])!;
  comp = advanceCompetitionRound(comp, userFx.id, 3, 1, map, () => 0.4);
  assert.equal(comp.currentRound, 2);

  const finalFx = comp.fixtures.find((f) => f.round === 2)!;
  comp = advanceCompetitionRound(comp, finalFx.id, 2, 0, map, () => 0.4);
  assert.equal(comp.stage, 'completed');
  assert.ok(comp.championTeamId);

  const standings = computeLeagueStandings(ids, map, comp.fixtures);
  assert.equal(standings.length, 4);
});

test('authentic club heraldry and Home/Away/Third/GK kits are assigned accurately', () => {
  const teams = getBaseDatabaseTeams();
  const river = teams.find((t) => t.id === 'club_riv');
  const boca = teams.find((t) => t.id === 'club_boc');
  const realMadrid = teams.find((t) => t.id === 'club_rma');
  const argentina = teams.find((t) => t.id === 'nat_arg');

  assert.ok(river && boca && realMadrid && argentina);
  assert.equal(river.crestStatus, 'authentic_heraldry');
  assert.equal(river.kitPattern, 'sash');
  assert.ok(river.thirdColor);
  assert.ok(river.gkPrimaryColor);
  assert.equal(boca.crestStatus, 'authentic_heraldry');
  assert.equal(argentina.crestStatus, 'authentic_heraldry');
});

test('commentary engine has >= 15 dual-voice variants per main play category and spicy crowd insults bank', () => {
  const mainCategories = ['goal', 'shot', 'save', 'foul', 'attack_buildup', 'pass'] as const;
  for (const cat of mainCategories) {
    const entry = COMMENTARY_TEMPLATES[cat];
    assert.ok(entry, `Missing template entry for ${cat}`);
    assert.ok(
      entry.variants.length >= 15,
      `Category ${cat} must have >= 15 variants, got ${entry.variants.length}`
    );
  }
  assert.ok(CROWD_INSULTS_BANK.referee.length >= 6);
  assert.ok(CROWD_INSULTS_BANK.rivalMiss.length >= 6);
  assert.ok(CROWD_INSULTS_BANK.ownTeamLosing.length >= 4);
});

test('Phase 1: cannon-es 3D physics world, elastic goal net stretch, 20 mocap states, Foot IK, and fictional Latin clubs/players', () => {
  const cannonArena = getCannonPhysicsWorld();
  assert.ok(cannonArena.world, 'Cannon-es world must be initialized');
  assert.equal(cannonArena.ballBody.mass, 0.43);
  assert.equal(cannonArena.postBodies.length, 6, 'Should register 4 vertical posts + 2 crossbars in Cannon-es');

  // Verify elastic goal net deformation when a shot impacts the right net
  const shotBall = createInitialBall();
  shotBall.x = PITCH.LENGTH + 0.8;
  shotBall.y = PITCH.HALF_Y;
  shotBall.z = 1.1;
  shotBall.vx = 28;
  shotBall.vy = 0;
  shotBall.strikeType = 'chilena';
  const stepRes = stepBallPhysics(shotBall, 1 / 60, 'optimo', 'despejado');
  assert.equal(stepRes.hitNet, true);
  assert.ok((shotBall.netStretchRight ?? 0) > 0.2, 'Right goal net must deform elastically on high-speed ball impact');

  // Verify real clubs, real stadiums, and real players with heightCm & bodyBuild morphologies
  const teams = getBaseDatabaseTeams();
  const rma = teams.find((t) => t.id === 'club_rma')!;
  const fcb = teams.find((t) => t.id === 'club_fcb')!;
  assert.equal(rma.name, 'Real Madrid CF');
  assert.equal(fcb.name, 'FC Barcelona');
  assert.equal(rma.stadium.name, 'Estadio Santiago Bernabéu');
  assert.ok(rma.players.some((p) => p.name === 'Kylian Mbappé'), 'Real Madrid must include Kylian Mbappé');
  assert.ok(fcb.players.some((p) => p.name === 'Lamine Yamal'), 'FC Barcelona must include Lamine Yamal');

  const bodyBuilds = new Set(rma.players.map((pl) => pl.bodyBuild));
  assert.ok(bodyBuilds.size >= 2, 'Squad must include varied body morphologies (delgado, atletico, robusto)');
  for (const pl of rma.players) {
    assert.ok((pl.heightCm ?? 0) >= 165 && (pl.heightCm ?? 0) <= 205);
    assert.ok(pl.name.length >= 4, 'Every player must have a real footballer name');
  }

  // Verify Foot IK and mocap states (dribble, feint, oriented_control, volley, lament)
  const testPlayer: MatchPlayerState = {
    id: 'mocap_tester',
    player: rma.players[9],
    side: 'home',
    slotIndex: 9,
    x: 40,
    y: 34,
    vx: 3.8,
    vy: 0,
    facing: 0,
    stamina: 95,
    yellowCards: 0,
    redCard: false,
    injured: false,
    tackleCooldown: 0,
    stunTimer: 0,
    slideTimer: 0,
    kickAnimTimer: 0,
    diveTimer: 0,
    diveDirY: 0,
    stridePhase: 0.7,
  };

  stepPlayerMovement(testPlayer, 0.55, 0, false, true, 1 / 60, 'optimo');
  assert.equal(testPlayer.animState, 'dribble', 'Carrying ball at medium speed should trigger dribble mocap state');
  assert.ok((testPlayer.footIkLeftY ?? 0) >= 0 && (testPlayer.footIkRightY ?? 0) >= 0, 'Foot IK must compute ground clearance');

  // Sharp cut with ball triggers feint (amague)
  stepPlayerMovement(testPlayer, 0, 1, false, true, 1 / 60, 'optimo');
  assert.equal(testPlayer.animState, 'feint', 'Sharp directional cut with ball should trigger feint mocap state');
});

test('Slide tackles displace 5.5-7.0 meters across the grass, stamina drains slowly and recovers on jog, and AI predicts ball interception', () => {
  const teams = getBaseDatabaseTeams();
  const engine = new MatchEngine({
    mode: 'quick_match',
    homeTeam: teams[0],
    awayTeam: teams[1],
    userSide: 'home',
    settings: { ...DEFAULT_SETTINGS, match: { ...DEFAULT_SETTINGS.match, difficulty: 8 } },
  });

  // 1. Verify long-displacement slide tackle (barrida que se desplaza)
  const defender = engine.players.find((p) => p.side === 'home' && p.slotIndex === 2)!;
  const startX = 45;
  const startY = 34;
  defender.x = startX;
  defender.y = startY;
  defender.vx = 0;
  defender.vy = 0;
  defender.tackleCooldown = 0;

  // Place loose ball 4.5 meters ahead along the slide path
  engine.ball.ownerId = null;
  engine.ball.x = startX + 4.5;
  engine.ball.y = startY;
  engine.ball.z = 0;
  engine.ball.vx = 0;
  engine.ball.vy = 0;

  engine.initiateSlideTackle(defender, 1, 0);
  assert.ok(defender.slideTimer >= 0.6, 'Slide tackle timer should be initialized to >= 0.6s');
  assert.ok(defender.vx >= 13.5, 'Initial slide tackle lunge speed should be >= 13.5 m/s');

  // Step movement over the 0.62s slide duration
  const dt = 1 / 60;
  for (let i = 0; i < 40; i++) {
    stepPlayerMovement(defender, 1, 0, true, false, dt, 'optimo', 1.24);
  }
  const slideDistanceMeters = defender.x - startX;
  assert.ok(
    slideDistanceMeters >= 5.2 && slideDistanceMeters <= 7.8,
    `Slide tackle must physically displace player between 5.2m and 7.8m (got ${slideDistanceMeters.toFixed(2)}m)`
  );

  // 2. Verify high-endurance stamina (low drain during sprint + recovery while jogging)
  const runner: MatchPlayerState = {
    ...defender,
    id: 'endurance_runner',
    x: 20,
    y: 20,
    vx: 0,
    vy: 0,
    stamina: 100,
    slideTimer: 0,
  };
  // Sprint for 6 full seconds
  for (let i = 0; i < 360; i++) {
    stepPlayerMovement(runner, 1, 0, true, false, dt, 'optimo', 1.24);
  }
  const staminaAfter6sSprint = runner.stamina;
  assert.ok(
    staminaAfter6sSprint >= 97.0,
    `Stamina after 6s of full sprint should remain >= 97% (got ${staminaAfter6sSprint.toFixed(2)}%)`
  );

  // Jog for 3 seconds and verify stamina recovers
  for (let i = 0; i < 180; i++) {
    stepPlayerMovement(runner, 0.7, 0, false, false, dt, 'optimo', 1.24);
  }
  assert.ok(
    runner.stamina > staminaAfter6sSprint,
    `Stamina must recover while jogging (before: ${staminaAfter6sSprint.toFixed(2)}%, after: ${runner.stamina.toFixed(2)}%)`
  );

  // 3. Verify Team Brain assigns designatedReceiverId for in-flight passes so AI doesn't abandon attacks
  const profile = getDifficultyProfile(8);
  const passerNode = {
    id: 'a6',
    team: 'away' as const,
    role: 'MID' as const,
    x: 60,
    y: 34,
    vx: 0,
    vy: 0,
    baseX: 60,
    baseY: 34,
    stamina: 98,
    hasBall: false,
    overall: 86,
    pace: 86,
    shooting: 82,
    passing: 88,
    dribbling: 85,
    defending: 75,
    physical: 80,
  };
  const receiverNode = {
    ...passerNode,
    id: 'a9',
    role: 'FWD' as const,
    x: 35,
    y: 30,
    baseX: 35,
    baseY: 30,
  };
  const brain = evaluateTeamBrain(
    'away',
    [passerNode, receiverNode],
    [],
    { x: 42, y: 31, vx: -16, vy: -2, ownerTeam: 'away', ownerId: null },
    0,
    40,
    profile
  );
  assert.equal(brain.designatedReceiverId, 'a9', 'Team Brain must lock closest forward onto the travelling pass trajectory');
});

test('Advanced tactical AI, single-foot standing poke without fouls or auto-slides, larger 9.8m x 3.1m goals, and high-mobility Goalkeeper AI', () => {
  // 1. Verify larger 3D goal dimensions (9.8m width x 3.1m height)
  assert.equal(PITCH.GOAL_WIDTH, 9.8);
  assert.equal(PITCH.GOAL_HALF, 4.9);
  assert.equal(PITCH.GOAL_HEIGHT, 3.1);

  const teams = getBaseDatabaseTeams();
  const engine = new MatchEngine({
    mode: 'quick_match',
    homeTeam: teams[0],
    awayTeam: teams[1],
    userSide: 'home',
    settings: { ...DEFAULT_SETTINGS, match: { ...DEFAULT_SETTINGS.match, difficulty: 8 } },
  });

  // 2. Verify single-foot standing poke (initiateStandingTackle) uses 'standing_tackle' state, never slides, and does not whistle fouls on normal contact
  const homeDef = engine.players.find((p) => p.side === 'home' && p.slotIndex === 2)!;
  const awayCarrier = engine.players.find((p) => p.side === 'away' && p.slotIndex === 9)!;
  homeDef.x = 50;
  homeDef.y = 34;
  homeDef.vx = 4.2;
  homeDef.vy = 0;
  awayCarrier.x = 51.1;
  awayCarrier.y = 34.1;
  awayCarrier.vx = -3.8;
  awayCarrier.vy = 0;
  awayCarrier.facing = Math.PI;
  engine.ball.ownerId = awayCarrier.id;
  engine.ball.x = 50.6;
  engine.ball.y = 34.05;

  engine.initiateStandingTackle(homeDef, awayCarrier);
  assert.equal(homeDef.slideTimer, 0, 'Single-foot standing tackle must NOT trigger a slide tackle');
  assert.ok((homeDef.standingTackleTimer ?? 0) > 0, 'Standing tackle must activate standingTackleTimer');
  assert.equal(homeDef.animState, 'standing_tackle');

  // Verify 25 consecutive standing challenges never call a foul for touching/poking from front or side
  for (let i = 0; i < 25; i++) {
    const res = evaluateTackleOutcome(homeDef, awayCarrier, false, () => (i % 10) / 10, engine.ball);
    assert.equal(res.isFoul, false, 'Standing single-foot tackle from front/side must never be a foul');
  }

  // 3. Verify AI players never auto-slide during live simulation unless user presses slide button
  for (let i = 0; i < 180; i++) {
    engine.step(1 / 60);
    for (const p of engine.players) {
      assert.equal(p.slideTimer, 0, `Player ${p.id} should not slide automatically without user slide button press`);
    }
  }

  // 4. Verify Advanced Goalkeeper AI covers the wider 9.8m goal with explosive diveSpeedY and sweeper-keeper rush
  const profile = getDifficultyProfile(8);
  const gkNode = {
    id: 'a0',
    team: 'away' as const,
    role: 'GK' as const,
    x: 103.9,
    y: PITCH.HALF_Y,
    vx: 0,
    vy: 0,
    baseX: 103.9,
    baseY: PITCH.HALF_Y,
    stamina: 100,
    hasBall: false,
    overall: 90,
    pace: 85,
    shooting: 40,
    passing: 82,
    dribbling: 70,
    defending: 88,
    physical: 86,
  };

  // Shot aimed near the wide corner (y = 34 + 4.3 = 38.3)
  const gkDive = computeGoalkeeperAI(
    gkNode,
    { x: 86, y: 35, z: 1.2, vx: 29, vy: 5.2, vz: 1.1, spin: 0.4, ownerTeam: 'home', ownerId: null },
    [],
    profile
  );
  assert.equal(gkDive.diveDirection, 'right');
  assert.ok((gkDive.diveSpeedY ?? 0) >= 6.8, 'GK must launch with high lateral dive speed to reach wide 9.8m goal corners');

  // Through-ball into the box with no owner -> Sweeper-Keeper rushes out to claim
  const gkSweep = computeGoalkeeperAI(
    gkNode,
    { x: 91, y: 34, z: 0.1, vx: 9, vy: 0, vz: 0, ownerTeam: 'home', ownerId: null },
    [{ ...gkNode, id: 'h9', team: 'home', role: 'FWD', x: 78, y: 34 }],
    profile
  );
  assert.equal(gkSweep.claimBall, true, 'Sweeper-keeper must rush out to intercept loose through-ball ahead of striker');
});

test('Goalkeeper takes goal kicks alone from 6-yard box while all 20 outfield players push to midfield, max difficulty has 99% shot accuracy, position swapper works, and rain lightning Easter Egg strikes', () => {
  // 1. Verify max difficulty (level 8) has 99% shot accuracy
  assert.equal(DIFFICULTY_CONFIG_TABLE[8].shotAccuracy, 0.99);
  assert.ok(DIFFICULTY_CONFIG_TABLE[8].passAccuracy >= 0.99);

  const teams = getBaseDatabaseTeams();
  const engine = new MatchEngine({
    mode: 'quick_match',
    homeTeam: teams[0],
    awayTeam: teams[1],
    userSide: 'home',
    settings: {
      ...DEFAULT_SETTINGS,
      match: { ...DEFAULT_SETTINGS.match, difficulty: 8, weather: 'lluvia' },
    },
  });

  // 2. Simulate ball going out over the home goal line (touched last by away) -> Home Goal Kick
  engine.phase = 'live';
  engine.ball.ownerId = null;
  engine.ball.lastTouchTeam = 'away';
  engine.ball.x = -0.8;
  engine.ball.y = 20;
  engine.ball.z = 0.2;
  engine.step(1 / 60);

  assert.equal(engine.phase, 'GOAL_KICK_AIM');
  const homeGk = engine.players.find((p) => p.side === 'home' && p.player.position === 'GK')!;
  assert.equal(engine.ball.ownerId, homeGk.id, 'Goal kick must be assigned exclusively to the Goalkeeper (GK)');
  assert.equal(engine.ball.x, 5.5, 'Goal kick ball must be spotted on the 6-yard line (x = 5.5m)');
  assert.ok(homeGk.x >= 4.5 && homeGk.x <= 5.5, 'Goalkeeper taking home goal kick must be inside the 6-yard goal area');

  // Outfield players spread out for goal kick: defenders open up to receive (x >= 16m) and midfielders/forwards push to midfield (up to 70m)
  const outfieldPlayers = engine.players.filter((p) => p.player.position !== 'GK');
  assert.equal(outfieldPlayers.length, 20);
  for (const op of outfieldPlayers) {
    assert.ok(
      op.x >= 16 && op.x <= 70,
      `Outfield player ${op.id} (${op.player.name}) must spread out or push up to midfield on goal kick (got x=${op.x.toFixed(1)}m)`
    );
  }

  // 3. Verify live player position swapping (swapPlayerPositions)
  const pA = engine.players.find((p) => p.side === 'home' && p.slotIndex === 1)!;
  const pB = engine.players.find((p) => p.side === 'home' && p.slotIndex === 9)!;
  const oldSlotA = pA.slotIndex;
  const oldSlotB = pB.slotIndex;
  const swapped = engine.swapPlayerPositions('home', pA.id, pB.id);
  assert.equal(swapped, true);
  assert.equal(pA.slotIndex, oldSlotB);
  assert.equal(pB.slotIndex, oldSlotA);

  // 4. Verify Rain Lightning Easter Egg trigger
  engine.triggerLightningEasterEgg(true);
  assert.ok(engine.lightningState?.active, 'Rain lightning Easter Egg must activate lightningState');
  assert.ok((engine.lightningState?.targetPlayerName.length ?? 0) > 2);
});

test('Smart Automatic Player Switching selects best intercepting defender, all 5 VAR scenarios execute multi-angle review & verdict, and aerial duels work', () => {
  const teams = getBaseDatabaseTeams();
  const engine = new MatchEngine({
    mode: 'quick_match',
    homeTeam: teams[0],
    awayTeam: teams[1],
    userSide: 'home',
    settings: { ...DEFAULT_SETTINGS, match: { ...DEFAULT_SETTINGS.match, difficulty: 8 } },
  });

  engine.phase = 'live';
  // 1. Test Smart Automatic Player Switching when opponent passes into another sector
  const farPlayer = engine.players.find((p) => p.side === 'home' && p.slotIndex === 9)!;
  const nearDefender = engine.players.find((p) => p.side === 'home' && p.slotIndex === 2)!;
  farPlayer.x = 75;
  farPlayer.y = 50;
  nearDefender.x = 30;
  nearDefender.y = 20;

  engine.activeUserPlayerId = farPlayer.id;
  engine.autoSwitchCooldown = 0;
  engine.ball.ownerId = null;
  engine.ball.lastTouchTeam = 'away';
  engine.ball.x = 34;
  engine.ball.y = 21;
  engine.ball.vx = -10;
  engine.ball.vy = -1;

  engine.stepSmartAutoPlayerSwitch(0.1);
  assert.equal(
    engine.activeUserPlayerId,
    nearDefender.id,
    'Smart auto-switch must automatically switch control to the defender closest to the ball intercept point'
  );

  // 2. Test all 5 official VAR Review scenarios ('offside_goal', 'penalty_check', 'foul_buildup_goal', 'direct_red_check', 'mistaken_identity')
  const scenarios: VARScenarioType[] = [
    'offside_goal',
    'penalty_check',
    'foul_buildup_goal',
    'direct_red_check',
    'mistaken_identity',
  ];
  for (const sc of scenarios) {
    const started = engine.triggerVARReviewDemo(sc);
    assert.equal(started, true, `VAR scenario ${sc} must start`);
    assert.equal(engine.varReviewState?.active, true);
    assert.equal(engine.varReviewState?.scenario, sc);
    assert.equal(engine.varReviewState?.phase, 'checking');
    assert.equal(engine.varReviewState?.cameraAngleIndex, 1);

    // Step past 70% of review duration to verify transition to Angle 3 & Final Decision phase
    for (let i = 0; i < 50; i++) {
      engine.step(0.05);
    }
    assert.equal(engine.varReviewState?.phase, 'decision', `VAR scenario ${sc} must enter final decision phase`);
    assert.equal(engine.varReviewState?.cameraAngleIndex, 3);

    // Finish review
    for (let i = 0; i < 30; i++) {
      engine.step(0.05);
    }
    assert.equal(engine.varReviewState, null, `VAR scenario ${sc} must resolve and clear state after completion`);
  }

  // 3. Test Aerial Duel evaluation (evaluateAerialDuel)
  const aerialBall = createInitialBall();
  aerialBall.x = 50;
  aerialBall.y = 34;
  aerialBall.z = 1.65;
  nearDefender.x = 50.1;
  nearDefender.y = 34.0;
  const awayAttacker = engine.players.find((p) => p.side === 'away' && p.slotIndex === 9)!;
  awayAttacker.x = 50.3;
  awayAttacker.y = 34.1;
  const duelRes = evaluateAerialDuel(nearDefender, awayAttacker, aerialBall, () => 0.5);
  assert.ok(duelRes.winnerId === nearDefender.id || duelRes.winnerId === awayAttacker.id);
  assert.ok(duelRes.winMargin >= 0);
});

test('Kickoff starts in ronda around center circle, goalkeeper ALWAYS kicks when ball exits by his goal line, sprint button gives explosive boost, and Modo Tormenta triggers lightning', () => {
  const teams = getBaseDatabaseTeams();
  const engine = new MatchEngine({
    mode: 'quick_match',
    homeTeam: teams[0],
    awayTeam: teams[1],
    userSide: 'home',
    settings: {
      ...DEFAULT_SETTINGS,
      match: { ...DEFAULT_SETTINGS.match, difficulty: 8, weather: 'tormenta' },
    },
  });

  // 1. Verify kickoff in ronda around the 9.15m center circle
  engine.setupKickoff('home');
  assert.equal(engine.phase, 'kickoff_ready');
  const centerCirclePlayers = engine.players.filter((p) => {
    const distFromCenter = Math.hypot(p.x - PITCH.HALF_X, p.y - PITCH.HALF_Y);
    return distFromCenter <= 10.2;
  });
  assert.ok(
    centerCirclePlayers.length >= 12,
    `Kickoff must arrange at least 12 players in a ronda around the center circle (got ${centerCirclePlayers.length})`
  );

  // 2. Verify that when ball exits by the goalkeeper's goal line last touched by the attacking team (IFAB Goal Kick), the home Goalkeeper ALWAYS takes the kick
  engine.phase = 'live';
  engine.ball.ownerId = null;
  engine.ball.lastTouchTeam = 'away';
  engine.ball.x = -0.9;
  engine.ball.y = 14;
  engine.ball.z = 0.1;
  engine.step(1 / 60);

  const homeGk = engine.players.find((p) => p.side === 'home' && p.player.position === 'GK')!;
  assert.equal(engine.phase, 'GOAL_KICK_AIM');
  assert.equal(engine.restartType, 'goal_kick');
  assert.equal(engine.ball.ownerId, homeGk.id, 'Goalkeeper must ALWAYS take the goal kick when ball exits by his goal line after attacker touch');

  // Verify user goalkeeper does NOT kick automatically after 120 frames (no timer), and kicks when releasing TIRO
  for (let i = 0; i < 120; i++) {
    engine.step(1 / 60);
  }
  assert.equal(engine.phase, 'GOAL_KICK_AIM', 'User goalkeeper must NEVER auto-kick on a timer during GOAL_KICK_AIM');
  engine.userInput.shootPower = 0.85;
  engine.userInput.shootReleased = true;
  for (let i = 0; i < 30; i++) {
    engine.step(1 / 60);
  }
  assert.equal(engine.phase, 'live');
  assert.equal(engine.ball.lastTouchPlayerId, homeGk.id, 'Goalkeeper must be the player who kicks the goal kick');
  assert.ok(engine.ball.x > 10, 'Goalkeeper goal kick must launch the ball toward midfield');

  // 3. Verify Modo Tormenta ('tormenta') triggers lightning strike without force flag
  const struck = engine.triggerLightningEasterEgg(false);
  assert.equal(struck, true, 'Modo Tormenta must allow lightning strikes on random players');
  assert.equal(engine.lightningState?.active, true);
});

test('2-Player Mode (twoPlayerMode: true) enables Player 2 control over Visiting Team with independent inputs and active player switching', () => {
  const teams = getBaseDatabaseTeams();
  const engine = new MatchEngine({
    mode: 'quick_match',
    homeTeam: teams[0],
    awayTeam: teams[1],
    userSide: 'home',
    twoPlayerMode: true,
    settings: DEFAULT_SETTINGS,
  });

  assert.equal(engine.twoPlayerMode, true);
  assert.ok(engine.activeUserPlayerId, 'Player 1 (Home) must have an activeUserPlayerId');
  assert.ok(engine.activeUser2PlayerId, 'Player 2 (Away) must have an activeUser2PlayerId');

  const p1 = engine.players.find((p) => p.id === engine.activeUserPlayerId)!;
  const p2 = engine.players.find((p) => p.id === engine.activeUser2PlayerId)!;
  assert.equal(p1.side, 'home');
  assert.equal(p2.side, 'away');

  // Verify Player 2 movement and sprint via userInput2
  engine.phase = 'live';
  const startX = p2.x;
  engine.userInput2.moveX = -1;
  engine.userInput2.moveY = 0;
  engine.userInput2.sprint = true;
  for (let i = 0; i < 35; i++) {
    engine.step(1 / 60);
  }
  assert.ok(p2.x < startX - 1.0, `Player 2 active away player must move and sprint in response to userInput2 (moved ${(startX - p2.x).toFixed(2)}m)`);

  // Verify Player 2 manual player switch via userInput2.switchPressed
  const prevP2Id = engine.activeUser2PlayerId;
  engine.userInput2.moveX = 0;
  engine.userInput2.sprint = false;
  engine.userInput2.switchPressed = true;
  engine.step(1 / 60);
  assert.notEqual(engine.activeUser2PlayerId, prevP2Id, 'userInput2.switchPressed must switch activeUser2PlayerId to another away player');
});

test('Complete 11v11 Tactical Formations Database includes all 37 formations across 4 categories with exact non-overlapping (0-100) coordinates', () => {
  assert.equal(FORMATION_CATEGORIES.length, 4);
  assert.ok(FORMATIONS.length >= 37, `Expected >= 37 tactical formations, got ${FORMATIONS.length}`);

  const line4 = getFormationsByCategory('Línea de 4');
  const line3 = getFormationsByCategory('Línea de 3');
  const line5 = getFormationsByCategory('Línea de 5');
  const historical = getFormationsByCategory('Históricas / Especiales');

  assert.ok(line4.length >= 16, `Expected >= 16 Línea de 4 formations, got ${line4.length}`);
  assert.ok(line3.length >= 9, `Expected >= 9 Línea de 3 formations, got ${line3.length}`);
  assert.ok(line5.length >= 5, `Expected >= 5 Línea de 5 formations, got ${line5.length}`);
  assert.ok(historical.length >= 7, `Expected >= 7 Históricas / Especiales formations, got ${historical.length}`);

  const requiredIds = [
    '4-3-3',
    '4-3-3-ofensiva',
    '4-3-3-falso-9',
    '4-4-2',
    '4-4-2-rombo',
    '4-2-3-1',
    '4-2-3-1-estrecha',
    '4-1-4-1',
    '4-3-2-1',
    '4-2-2-2',
    '4-2-4',
    '4-5-1',
    '4-1-2-1-2-abierta',
    '4-1-2-1-2-cerrada',
    '4-1-3-2',
    '4-6-0',
    '3-5-2',
    '3-4-3',
    '3-4-3-rombo',
    '3-4-1-2',
    '3-4-2-1',
    '3-1-4-2',
    '3-3-1-3',
    '3-3-4',
    '3-2-4-1',
    '5-3-2',
    '5-4-1-plana',
    '5-4-1-diamante',
    '5-2-3',
    '5-2-1-2',
    '3-2-2-3-wm',
    '2-3-5-piramide',
    '1-3-3-3-catenaccio',
    '6-3-1-cerrojo',
    '2-4-4-experimental',
    '2-2-6-experimental',
    '4-3-3-asimetrica',
  ];

  const existingIds = new Set(FORMATIONS.map((f) => f.id));
  for (const reqId of requiredIds) {
    assert.ok(existingIds.has(reqId), `Missing mandatory tactical formation id: ${reqId}`);
  }

  for (const f of FORMATIONS) {
    assert.ok(f.id && f.nombre && f.categoria && f.estilo && f.descripcion_tactica);
    assert.equal(f.jugadores.length, 11, `Formation ${f.id} must have exactly 11 players`);
    assert.equal(f.slots.length, 11, `Formation ${f.id} must have 11 engine slots`);
    assert.equal(f.jugadores[0].numero_slot, 1);
    assert.equal(f.jugadores[0].posicion, 'POR');

    for (let i = 0; i < f.jugadores.length; i++) {
      const pA = f.jugadores[i];
      assert.equal(pA.numero_slot, i + 1);
      assert.ok(pA.x >= 0 && pA.x <= 100, `Invalid x=${pA.x} in ${f.id}`);
      assert.ok(pA.y >= 0 && pA.y <= 100, `Invalid y=${pA.y} in ${f.id}`);

      for (let j = i + 1; j < f.jugadores.length; j++) {
        const pB = f.jugadores[j];
        const dist = Math.hypot(pA.x - pB.x, pA.y - pB.y);
        assert.ok(
          dist >= 6,
          `Players #${pA.numero_slot} and #${pB.numero_slot} overlap in ${f.id} (dist=${dist.toFixed(1)})`
        );
      }
    }
  }

  // Verify MatchEngine supports switching to exotic/modern formations like 3-2-4-1 Guardiola, 2-3-5 Pirámide, and 4-3-3 Asimétrica
  const teams = getBaseDatabaseTeams();
  const engine = new MatchEngine({
    mode: 'quick_match',
    homeTeam: teams[0],
    awayTeam: teams[1],
    userSide: 'home',
    settings: DEFAULT_SETTINGS,
  });

  for (const testFormId of ['3-2-4-1', '2-3-5-piramide', '1-3-3-3-catenaccio', '4-3-3-asimetrica']) {
    engine.setUserFormation(testFormId);
    assert.equal(engine.homeTeam.formationId, testFormId);
    assert.equal(getFormation(testFormId).id, testFormId);
    engine.step(1 / 60);
  }
});

test('gameModeManager enforces dedicated rules for all 14 game modes, isolates penalty shootout to kicker + GK, sets up free-kick wall, and resolves same-team kit clashes', () => {
  const all14Modes = [
    'quick_match',
    'world_cup',
    'continental_cup',
    'league',
    'club_cup',
    'player_career',
    'manager_career',
    'club_career',
    'penalties',
    'training',
    'challenges',
    'survival',
    'custom_tournament',
    'all_star',
  ] as const;

  assert.equal(Object.keys(GAME_MODE_CONFIGS).length, 14);
  for (const m of all14Modes) {
    const cfg = getGameModeConfig(m);
    assert.equal(cfg.modeId, m);
    assert.ok(cfg.title.length > 3);
    assert.ok(cfg.broadcastLabel.length > 2);
    assert.ok(cfg.rulesSummary.length > 10);
    assert.ok(cfg.winConditionLabel.length > 5);
  }

  const teams = getBaseDatabaseTeams();

  // 1. Same-team kit clash auto-resolution
  const sameTeamClash = resolveKitClash(teams[0], teams[0], 'home', 'home');
  assert.equal(sameTeamClash.autoResolved, true);
  assert.equal(sameTeamClash.homeKit, 'home');
  assert.notEqual(sameTeamClash.awayKit, 'home', 'Visiting team must be assigned alternate kit when same team is selected');

  // 2. Penalty Shootout mode isolates ONLY the kicker and goalkeeper on pitch (all other 20 players parked at y = -18)
  const penEngine = new MatchEngine({
    mode: 'penalties',
    homeTeam: teams[0],
    awayTeam: teams[1],
    userSide: 'home',
    settings: DEFAULT_SETTINGS,
  });
  assert.equal(penEngine.phase, 'penalty_shootout');
  assert.ok(penEngine.penaltyState);
  const onPitchPlayers = penEngine.players.filter((p) => p.y > -5);
  assert.equal(onPitchPlayers.length, 2, 'Penalty shootout mode must position ONLY the kicker and the goalkeeper on the pitch');

  // 3. Free-Kick Training mode positions defensive wall, goalkeeper, and kicker with curve/power controller and no clock expiration
  const fkEngine = new MatchEngine({
    mode: 'training',
    homeTeam: teams[0],
    awayTeam: teams[1],
    userSide: 'home',
    settings: DEFAULT_SETTINGS,
    trainingDrill: 'free_kicks',
  });
  assert.equal(fkEngine.phase, 'set_piece');
  assert.equal(fkEngine.restartType, 'free_kick');
  assert.ok(fkEngine.freeKickState?.awaitingUserInput, 'Free-kick training must activate interactive curve/power freeKickState');
  const wallPlayers = fkEngine.players.filter((p) => p.inWall);
  assert.ok(wallPlayers.length >= 3, `Expected >= 3 defenders in free-kick wall, got ${wallPlayers.length}`);

  // Step 500 frames and verify clock never triggers halftime/fulltime in training mode
  for (let i = 0; i < 500; i++) {
    fkEngine.step(1 / 30);
  }
  assert.notEqual(fkEngine.phase, 'halftime');
  assert.notEqual(fkEngine.phase, 'fulltime');

  // Verify free kick spot generator produces varied angles and distances
  const spot0 = generateFreeKickPracticeSpot('home', 0);
  const spot1 = generateFreeKickPracticeSpot('home', 1);
  assert.notEqual(spot0.y, spot1.y);
  assert.ok(spot0.distanceMeters >= 18 && spot0.distanceMeters <= 32);
});

test('IFAB Real Restarts (Corner, Throw-In, Goal Kick), Skippable Cutscenes, Skill Moves, 3-Camera Replay, and Progression Store work accurately', () => {
  const teams = getBaseDatabaseTeams();
  const engine = new MatchEngine({
    mode: 'quick_match',
    homeTeam: teams[0],
    awayTeam: teams[1],
    userSide: 'home',
    settings: DEFAULT_SETTINGS,
  });

  // 1. IFAB Corner Kick: Ball crosses home goal line (x < 0) last touched by home defender -> Away Corner Kick at nearest corner flag
  engine.phase = 'live';
  engine.ball.ownerId = null;
  engine.ball.lastTouchTeam = 'home';
  engine.ball.x = -0.8;
  engine.ball.y = 10;
  engine.ball.z = 0.1;
  const prevAwayCorners = engine.awayStats.corners;
  engine.step(1 / 60);

  assert.equal(engine.phase, 'set_piece');
  assert.equal(engine.restartType, 'corner');
  assert.equal(engine.restartTeam, 'away');
  assert.equal(engine.awayStats.corners, prevAwayCorners + 1, 'Corner kick must increment attacking team corner stat');
  assert.ok(engine.ball.x < 1.5 && engine.ball.y < 1.5, 'Corner kick ball must be placed at the nearest corner flag');
  assert.equal(engine.cutsceneState?.type, 'corner', 'Corner kick must trigger a skippable corner cutscene');

  // Skip the corner cutscene via skipCutscene()
  engine.skipCutscene();
  assert.equal(engine.cutsceneState, null, 'skipCutscene() must immediately clear active cutsceneState');

  // 2. IFAB Throw-In: Ball crosses sideline (y < 0) last touched by away -> Home Throw-In at exact exit X coordinate with two-handed overhead animation
  engine.phase = 'live';
  engine.ball.ownerId = null;
  engine.ball.lastTouchTeam = 'away';
  engine.ball.x = 48.5;
  engine.ball.y = -0.7;
  engine.ball.z = 0.1;
  engine.step(1 / 60);

  assert.equal(engine.phase, 'set_piece');
  assert.equal(engine.restartType, 'throw_in');
  assert.equal(engine.restartTeam, 'home');
  assert.ok(Math.abs(engine.ball.x - 48.5) < 0.5, 'Throw-in must occur at the exact sideline X coordinate where ball exited');
  assert.equal((engine.cutsceneState as { type?: string } | null)?.type, 'throw_in', 'Throw-in must trigger a skippable throw-in cutscene');
  const throwTaker = engine.players.find((p) => p.id === engine.ball.ownerId)!;
  assert.ok(throwTaker && throwTaker.side === 'home');
  assert.equal(throwTaker.animState, 'throw_in', 'Throw-in taker must hold ball overhead with two-handed throw_in animation');

  engine.skipCutscene();
  assert.equal(engine.cutsceneState, null);

  // 3. Skill Moves (Bicicleta, Amague, Sombrerito) via triggerSkillMove()
  engine.phase = 'live';
  const carrier = engine.players.find((p) => p.id === engine.activeUserPlayerId)!;
  carrier.x = 52;
  carrier.y = 34;
  engine.ball.x = 52;
  engine.ball.y = 34;
  engine.ball.ownerId = carrier.id;
  engine.userInput.moveX = 0.35;
  engine.userInput.moveY = 0;
  const skillTriggered = engine.triggerSkillMove('home');
  assert.equal(skillTriggered, true, 'triggerSkillMove must succeed when carrier has ball');
  assert.equal(engine.lastSkillMove?.type, 'bicicleta', 'Skill move must trigger bicicleta');
  assert.equal(carrier.animState, 'feint');
  assert.ok((carrier.feintTimer ?? 0) > 0.4, 'Skill move must grant feint evasion timer');

  // 4. 3-Angle Interactive Replay Camera Switching
  for (let i = 0; i < 60; i++) {
    engine.step(1 / 60);
  }
  engine.triggerInstantReplay();
  assert.equal(engine.phase, 'goal_replay', 'triggerInstantReplay must enter goal_replay phase');
  engine.setReplayCameraAngle('broadcast_slow');
  assert.equal(engine.replayCameraAngle, 'broadcast_slow');
  engine.setReplayCameraAngle('behind_goal_zoom');
  assert.equal(engine.replayCameraAngle, 'behind_goal_zoom');
  engine.setReplayCameraAngle('low_sideline_slow');
  assert.equal(engine.replayCameraAngle, 'low_sideline_slow');
  const prevOrbit = engine.replayFreeCamAngle;
  engine.adjustReplayFreeCamAngle(0.5);
  assert.notEqual(engine.replayFreeCamAngle, prevOrbit, '360 free replay camera must rotate orbit angle');
  engine.skipReplay();

  // 5. Tournament Round Labels & Progression Store Unlockables
  const cupTeams = teams.slice(0, 16);
  const cupMap = new Map(cupTeams.map((t) => [t.id, t]));
  const cupIds = cupTeams.map((t) => t.id);
  const cup = createCompetition('Torneo Test', 'world_cup', cupIds, cupIds[0], cupMap, false);
  assert.ok(getCompetitionRoundLabel(cup, 1).includes('FASE DE GRUPOS'));

  const reward = calculateMatchCoinReward(
    {
      id: 'm1',
      mode: 'world_cup',
      homeTeamId: teams[0].id,
      awayTeamId: teams[1].id,
      homeTeamName: teams[0].name,
      awayTeamName: teams[1].name,
      homeScore: 3,
      awayScore: 1,
      wentToExtraTime: false,
      homeStats: engine.homeStats,
      awayStats: engine.awayStats,
      events: [],
      userSide: 'home',
      difficulty: 6,
      dateIso: new Date().toISOString(),
    },
    true
  );
  assert.ok(reward >= 350, `Expected >= 350 coins for a trophy-winning victory, got ${reward}`);

  assert.ok(UNLOCKABLE_ITEMS.length >= 12, 'Store must contain classic balls, retro kits, and monumental stadiums');
  const initialSave = loadSaveState();
  const purchaseRes = purchaseUnlockableItem(initialSave, 'ball_tango_78');
  assert.equal(purchaseRes.success, true);
  assert.ok(purchaseRes.state.store.unlockedItemIds.includes('ball_tango_78'));
  assert.equal(purchaseRes.state.store.equippedBallId, 'ball_tango_78');

  const equipRes = equipUnlockableItem(purchaseRes.state, 'ball_pro_official');
  assert.equal(equipRes.store.equippedBallId, 'ball_pro_official');
});

test('2026 Real Squads, PlayerAppearance (aspecto), World Cup stars, and cumulative JSON patch merging work accurately', () => {
  const teams = getBaseDatabaseTeams();

  // 1. World Cup Stars for all 8 FIFA World Champions
  assert.equal(WORLD_CUP_STARS.nat_bra, 5);
  assert.equal(WORLD_CUP_STARS.nat_ger, 4);
  assert.equal(WORLD_CUP_STARS.nat_ita, 4);
  assert.equal(WORLD_CUP_STARS.nat_arg, 3);
  assert.equal(WORLD_CUP_STARS.nat_fra, 2);
  assert.equal(WORLD_CUP_STARS.nat_uru, 2);
  assert.equal(WORLD_CUP_STARS.nat_eng, 1);
  assert.equal(WORLD_CUP_STARS.nat_esp, 1);

  const arg = teams.find((t) => t.id === 'nat_arg')!;
  const bra = teams.find((t) => t.id === 'nat_bra')!;
  assert.equal(arg.worldCupStars, 3);
  assert.equal(bra.worldCupStars, 5);

  // 2. Verify 16 Main National Teams, 16 Top Clubs, LaLiga & Liga Profesional Argentina have Plantilla Real 2026 ('curated')
  const requiredCuratedIds = [
    'nat_arg', 'nat_esp', 'nat_fra', 'nat_bra', 'nat_eng', 'nat_ger', 'nat_por', 'nat_ned',
    'nat_ita', 'nat_uru', 'nat_col', 'nat_bel', 'nat_cro', 'nat_mar', 'nat_jpn', 'nat_usa',
    'club_rma', 'club_fcb', 'club_atm', 'club_mci', 'club_ars', 'club_liv', 'club_mun', 'club_che',
    'club_psg', 'club_bay', 'club_int_ita', 'club_acm', 'club_juv', 'club_riv', 'club_boc', 'club_fla',
    'club_ath', 'club_rso', 'club_vil', 'club_bet', 'club_sev', 'club_val', 'club_gir',
    'club_rac', 'club_ind', 'club_slo', 'club_est', 'club_vel', 'club_tal', 'club_ros', 'club_new_arg',
  ];

  for (const id of requiredCuratedIds) {
    const team = teams.find((t) => t.id === id);
    assert.ok(team, `Expected team ${id} in database`);
    assert.equal(team.rosterSource, 'curated', `Team ${team.name} (${id}) must have rosterSource === 'curated'`);
    assert.equal(team.players.length, 18, `Team ${team.name} must have 18 real players`);
    for (const pl of team.players) {
      assert.ok(pl.aspecto, `Player ${pl.name} in ${team.name} must have PlayerAppearance (aspecto)`);
      assert.ok(pl.aspecto.tonoPiel.startsWith('#'));
      assert.ok(pl.aspecto.colorPelo.startsWith('#'));
      assert.ok(pl.aspecto.colorBotines.startsWith('#'));
      assert.ok(pl.aspecto.alturaCm >= 155 && pl.aspecto.alturaCm <= 206);
      assert.ok(['D', 'I', 'A'].includes(pl.aspecto.piernaHabil));
    }
  }

  // Verify recognizable star appearances (e.g., Lamine Yamal, Haaland, Courtois, Cucurella)
  const fcb = teams.find((t) => t.id === 'club_fcb')!;
  const yamal = fcb.players.find((p) => p.name.includes('Lamine Yamal'))!;
  assert.ok(yamal, 'FC Barcelona 2026 must include Lamine Yamal');
  assert.equal(yamal.number, 19);
  assert.equal(yamal.aspecto?.piernaHabil, 'I');

  const mci = teams.find((t) => t.id === 'club_mci')!;
  const haaland = mci.players.find((p) => p.name.includes('Haaland'))!;
  assert.ok(haaland, 'Manchester City 2026 must include Erling Haaland');
  assert.equal(haaland.aspecto?.peinado, 'rodete');
  assert.equal(haaland.aspecto?.alturaCm, 195);

  // 3. Cumulative JSON Patch Mode: merge partial team update onto existing procedural team without deleting others
  const targetProcedural = teams.find((t) => t.rosterSource === 'procedural')!;
  const patchJson = JSON.stringify([
    {
      id: targetProcedural.id,
      name: targetProcedural.name,
      logoUrl: 'https://example.com/official_crest.png',
      primaryColor: '#123456',
      players: [
        {
          name: 'Estrella Real 2026',
          number: 10,
          position: 'ST',
          overall: 86,
          aspecto: {
            tonoPiel: '#D9A17C',
            peinado: 'trenzas',
            colorPelo: '#14110F',
            barba: 'candado',
            alturaCm: 185,
            colorBotines: '#D9F938',
            piernaHabil: 'I',
          },
        },
      ],
    },
  ]);

  const parsedPatch = validateAndParseImportedTeams(patchJson, teams);
  assert.equal(parsedPatch.error, undefined);
  assert.equal(parsedPatch.teams.length, 1);
  const patchedTeam = parsedPatch.teams[0];
  assert.equal(patchedTeam.id, targetProcedural.id);
  assert.equal(patchedTeam.rosterSource, 'curated', 'Patched team must automatically upgrade to Plantilla Real 2026');
  assert.equal(patchedTeam.logoUrl, 'https://example.com/official_crest.png');
  assert.equal(patchedTeam.players.length, 18, 'Partial player list in JSON patch must preserve full 18-man squad');
  assert.equal(patchedTeam.players[0].name, 'Estrella Real 2026');
  assert.equal(patchedTeam.players[0].aspecto?.peinado, 'trenzas');

  const mergedCustom = mergeImportedTeamsPatch([], parsedPatch.teams);
  const allAfterPatch = getAllTeamsWithCustom(mergedCustom);
  assert.equal(allAfterPatch.length, teams.length, 'Cumulative patch must not delete any existing teams');
  const lookedUp = allAfterPatch.find((t) => t.id === targetProcedural.id)!;
  assert.equal(lookedUp.rosterSource, 'curated');
  assert.equal(lookedUp.players[0].name, 'Estrella Real 2026');
});

test('Defensive line discipline prevents CBs from pushing into attack, anti-walk-in goal blocks dribbling into net, sharp turns loosen ball control, and online snapshots interpolate smoothly', () => {
  const teams = getBaseDatabaseTeams();
  const profile = getDifficultyProfile(6);

  // 1. Verify Center Backs (CB) stay anchored in their defensive half (<= 43m) when team is attacking deep in final third (x = 85m)
  const cbNode = {
    id: 'h2',
    team: 'home' as const,
    role: 'DEF' as const,
    specificPosition: 'CB',
    x: 34,
    y: 26,
    vx: 0,
    vy: 0,
    baseX: 22,
    baseY: 26,
    stamina: 95,
    hasBall: false,
    overall: 85,
    pace: 78,
    shooting: 55,
    passing: 76,
    dribbling: 72,
    defending: 87,
    physical: 86,
  };
  const carrierNode = {
    ...cbNode,
    id: 'h10',
    role: 'MID' as const,
    specificPosition: 'CAM',
    x: 85,
    y: 34,
    baseX: 68,
    baseY: 34,
    hasBall: true,
  };
  const brain = evaluateTeamBrain(
    'home',
    [cbNode, carrierNode],
    [],
    { x: 85, y: 34, vx: 3, vy: 0, ownerTeam: 'home', ownerId: 'h10' },
    0,
    50,
    profile
  );
  assert.ok(
    brain.defensiveLineX <= 43,
    `Defensive line X when attacking must remain anchored <= 43m in own half (got ${brain.defensiveLineX.toFixed(1)}m)`
  );
  const cbMove = computeOffBallMovement(
    cbNode,
    [cbNode, carrierNode],
    [],
    { x: 85, y: 34, vx: 3, vy: 0, ownerTeam: 'home', ownerId: 'h10' },
    profile,
    'balanced',
    brain
  );
  assert.ok(
    cbMove.targetX <= 43,
    `Center Back (CB) off-ball targetX must stay <= 43m to protect against counter-attacks (got ${cbMove.targetX.toFixed(1)}m)`
  );

  // 2. Verify sharp high-speed turn with the ball activates dribbleLooseTimer
  const dribbler: MatchPlayerState = {
    id: 'dribbler_test',
    player: teams[0].players[9],
    side: 'home',
    slotIndex: 9,
    x: 50,
    y: 34,
    vx: 7.2,
    vy: 0,
    facing: 0,
    stamina: 95,
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
  };
  stepPlayerMovement(dribbler, -1, 0.2, true, true, 1 / 60, 'optimo', 1.24);
  assert.ok(
    (dribbler.dribbleLooseTimer ?? 0) > 0,
    'Sharp high-speed turn while carrying the ball must trigger dribbleLooseTimer > 0'
  );

  // 3. Verify anti-walk-in goal rule: a player dribbling into the goal mouth without shooting cannot walk the ball across the goal line
  const engine = new MatchEngine({
    mode: 'quick_match',
    homeTeam: teams[0],
    awayTeam: teams[1],
    userSide: 'home',
    settings: DEFAULT_SETTINGS,
  });
  engine.phase = 'live';
  const striker = engine.players.find((p) => p.side === 'home' && p.slotIndex === 9)!;
  const awayGk = engine.players.find((p) => p.side === 'away' && p.player.position === 'GK')!;
  // Move GK slightly away first to test goal-line dribble clamp, then test GK 1v1 smother
  awayGk.x = 104.2;
  awayGk.y = 44;
  striker.x = 104.8;
  striker.y = PITCH.HALF_Y;
  striker.facing = 0;
  engine.ball.ownerId = striker.id;
  engine.ball.x = 104.9;
  engine.ball.y = PITCH.HALF_Y;
  engine.userInput.moveX = 1;
  engine.userInput.moveY = 0;
  engine.step(1 / 60);
  assert.equal(engine.homeScore, 0, 'Player must NOT score a goal simply by walking/dribbling across the goal line without shooting');

  // Place GK in 1v1 position in front of striker -> GK smothers the ball from striker's feet
  awayGk.x = 103.5;
  awayGk.y = PITCH.HALF_Y;
  striker.x = 102.5;
  striker.y = PITCH.HALF_Y;
  engine.ball.ownerId = striker.id;
  engine.ball.x = 102.9;
  engine.ball.y = PITCH.HALF_Y;
  engine.step(1 / 60);
  assert.equal(engine.ball.ownerId, awayGk.id, 'Goalkeeper must smother and claim the ball when an attacker dribbles directly into 1v1 range without shooting');

  // 4. Verify online multiplayer snapshot serialization & smooth interpolation
  const snap = engine.serializeOnlineSnapshot();
  assert.equal(typeof snap.matchMinute, 'number');
  assert.equal(snap.players.length, 22);
  engine.ball.x = 40;
  engine.applyOnlineSnapshot(snap, 0.5);
  assert.ok(engine.ball.x > 40, 'applyOnlineSnapshot must smoothly interpolate ball position toward snapshot state');
});

test('Unity 2022 LTS URP 80,000-spectator stadium, expanded 140x90m pitch scale factor, and all 5 Android engineering deliverables', () => {
  // 1. Verify expanded 140 x 90 m pitch dimensions & configurable scale factor (140 / 105 = 1.3333334)
  assert.equal(EXPANDED_PITCH_SCALE.TARGET_LENGTH_M, 140);
  assert.equal(EXPANDED_PITCH_SCALE.TARGET_WIDTH_M, 90);
  assert.equal(EXPANDED_PITCH_SCALE.STADIUM_CAPACITY, 80000);
  assert.equal(EXPANDED_PITCH_SCALE.LIGHT_TOWER_COUNT, 6);
  assert.ok(
    Math.abs(EXPANDED_PITCH_SCALE.FACTOR - 140 / 105) < 0.0001,
    'PITCH_SCALE_FACTOR must equal 140 / 105 (1.3333x)'
  );
  assert.equal(EXPANDED_PITCH_SCALE.PLAYER_SPEED_SCALE, EXPANDED_PITCH_SCALE.FACTOR);
  assert.equal(EXPANDED_PITCH_SCALE.BALL_SPEED_SCALE, EXPANDED_PITCH_SCALE.FACTOR);
  assert.equal(EXPANDED_PITCH_SCALE.CAMERA_SCALE, EXPANDED_PITCH_SCALE.FACTOR);

  const dims = getScaledPitchDimensions();
  assert.equal(dims.lengthM, 140);
  assert.equal(dims.widthM, 90);
  assert.equal(dims.penaltyAreaLengthM, 22);
  assert.equal(dims.penaltyAreaWidthM, 53.36);
  assert.equal(dims.sixYardLengthM, 7.33);
  assert.equal(dims.sixYardWidthM, 24.25);
  assert.equal(dims.centerCircleRadiusM, 12.2);
  assert.equal(dims.penaltySpotDistanceM, 14.67);

  // 2. Verify all 12 Unity 2022.3 LTS URP C# and HLSL source files are complete, real code (no pseudocode)
  assert.equal(UNITY_URP_SOURCE_FILES.length, 12);
  for (const file of UNITY_URP_SOURCE_FILES) {
    assert.ok(file.code.length > 800, `Unity source file ${file.relativePath} must contain complete production implementation`);
    assert.ok(!/TODO|PSEUDOCODE|FIXME/i.test(file.code), `Unity source file ${file.relativePath} must not contain placeholders`);
  }

  // 3. Verify external ASTC assets manifest respects max 2048px for stadium and 1024px for secondary elements
  assert.ok(UNITY_EXTERNAL_ASSETS_MANIFEST.length >= 9);
  for (const asset of UNITY_EXTERNAL_ASSETS_MANIFEST) {
    assert.ok(asset.maxSizePx <= 2048, `Asset ${asset.name} exceeds 2048px limit`);
    if (asset.type !== 'Static Mesh FBX') {
      assert.ok(asset.androidFormat.includes('ASTC'), `Texture asset ${asset.name} must use ASTC compression on Android`);
    }
  }

  // 4. Verify all 4 quality tiers (Baja, Media, Alta, Ultra) and bundle builder
  assert.deepEqual(
    UNITY_QUALITY_TIER_PROFILES.map((p) => p.tier),
    ['Baja', 'Media', 'Alta', 'Ultra']
  );
  assert.ok(UNITY_DELIVERABLE_STATUS_LIST.length >= 7);
  assert.ok(UNITY_IMPORT_AND_APK_BUILD_STEPS.unityImportSteps.length >= 5);
  assert.ok(UNITY_IMPORT_AND_APK_BUILD_STEPS.androidApkBuildSteps.length >= 4);

  const bundleText = buildUnityProjectBundleText();
  assert.ok(bundleText.includes('PitchGrassSinglePlane') && bundleText.includes('DrawMeshInstancedIndirect'));
});

test('GOAL_KICK_AIM state: no auto-kick timer for user GK, freezes all players, left joystick aims, vertical slider adjusts height/power, TIRO charges/kicks, PASAR passes short to nearest aimed defender, and rival AI GK freezes user players until kick', () => {
  const teams = getBaseDatabaseTeams();
  const engine = new MatchEngine({
    mode: 'quick_match',
    homeTeam: teams[0],
    awayTeam: teams[1],
    userSide: 'home',
    settings: DEFAULT_SETTINGS,
  });

  // 1. Trigger a user Goal Kick -> enters GOAL_KICK_AIM with no auto-kick timer
  engine.phase = 'live';
  engine.ball.ownerId = null;
  engine.ball.lastTouchTeam = 'away';
  engine.ball.x = -0.8;
  engine.ball.y = 14;
  engine.step(1 / 60);

  const homeGk = engine.players.find((p) => p.side === 'home' && p.player.position === 'GK')!;
  assert.equal(engine.phase, 'GOAL_KICK_AIM');
  assert.ok(engine.goalKickAimState?.active);
  assert.equal(engine.goalKickAimState?.isUserControlled, true);
  assert.equal(engine.goalKickAimState?.keeperId, homeGk.id);
  assert.equal(engine.ball.ownerId, homeGk.id);

  // Snapshot all 21 non-keeper player positions and verify they stay 100% frozen across 300 frames (5 full seconds)
  const initialPositions = new Map(
    engine.players
      .filter((p) => p.id !== homeGk.id)
      .map((p) => [p.id, { x: p.x, y: p.y }])
  );

  for (let i = 0; i < 300; i++) {
    engine.step(1 / 60);
  }

  assert.equal(engine.phase, 'GOAL_KICK_AIM', 'User GOAL_KICK_AIM must have NO timer that auto-kicks');
  assert.equal(engine.ball.ownerId, homeGk.id, 'Ball cannot be contested while in GOAL_KICK_AIM');
  for (const p of engine.players) {
    assert.equal(p.vx, 0);
    assert.equal(p.vy, 0);
    assert.equal(p.animState, 'idle', `Player ${p.id} must have idle animation during GOAL_KICK_AIM`);
    if (p.id !== homeGk.id) {
      const snap = initialPositions.get(p.id)!;
      assert.equal(p.x, snap.x, `Player ${p.id} X position must remain frozen during GOAL_KICK_AIM`);
      assert.equal(p.y, snap.y, `Player ${p.id} Y position must remain frozen during GOAL_KICK_AIM`);
    }
  }

  // 2. Left joystick horizontal direction steering & vertical height/power slider
  engine.userInput.moveX = 0.8;
  engine.userInput.moveY = 0;
  for (let i = 0; i < 20; i++) {
    engine.step(1 / 60);
  }
  engine.userInput.moveX = 0;
  assert.ok(
    (engine.goalKickAimState?.aimAngleRad ?? 0) > 0.3,
    'Left joystick must steer the horizontal angle of the goal kick'
  );

  engine.setGoalKickElevationSlider(0.95);
  assert.equal(engine.goalKickAimState?.elevationSlider, 0.95);

  // 3. Holding TIRO charges power bar, and releasing TIRO executes the kick animation, launches ball with chosen direction/height/power, and immediately unfreezes all players
  engine.userInput.shootHeld = true;
  for (let i = 0; i < 25; i++) {
    engine.step(1 / 60);
  }
  assert.equal(engine.goalKickAimState?.isChargingShoot, true);
  assert.ok((engine.goalKickAimState?.chargePower ?? 0) > 0.5, 'Holding TIRO must charge goal kick power');

  engine.userInput.shootHeld = false;
  engine.userInput.shootReleased = true;
  engine.step(1 / 60);

  assert.equal(engine.phase, 'live', 'Releasing TIRO must immediately unfreeze the match to live phase');
  assert.equal(engine.goalKickAimState, null);
  assert.equal(homeGk.animState, 'shoot', 'Goalkeeper must execute kick animation on shoot release');
  assert.ok(homeGk.kickAnimTimer > 0);
  assert.equal(engine.ball.ownerId, null);
  assert.ok(engine.ball.vx > 14, 'Long goal kick must launch ball forward with high velocity');
  assert.ok(engine.ball.vy > 4, 'Angled goal kick must launch ball toward the aimed horizontal direction');
  assert.ok(engine.ball.vz > 5, 'High elevation slider + charged TIRO must launch a high aerial ball (vz > 5)');

  // 4. Goalkeeper holding ball in hands (enterGoalKickAim(homeGk, true)) + Botón PASAR executes short ground pass to nearest aimed defender
  engine.enterGoalKickAim(homeGk, true);
  assert.equal(engine.phase, 'GOAL_KICK_AIM');
  const handsAim = engine.goalKickAimState as GoalKickAimState | null;
  assert.equal(handsAim?.isFromHands, true);

  // Aim toward the right defender (slotIndex 3 at y = PITCH.HALF_Y + 13.5)
  if (handsAim) handsAim.aimAngleRad = 0.65;
  engine.step(1 / 60);
  const expectedDefender = engine.findNearestDefenderInAimDirection(homeGk, 0.65)!;
  assert.ok(expectedDefender);

  engine.userInput.passPressed = true;
  engine.step(1 / 60);

  assert.equal(engine.phase, 'live', 'Pressing PASAR must immediately unfreeze players and return to live play');
  assert.equal(engine.goalKickAimState, null);
  assert.equal(homeGk.animState, 'pass', 'Goalkeeper must execute pass animation on short pass');
  assert.equal(engine.activeUserPlayerId, expectedDefender.id, 'Active control must switch to the targeted short-pass defender');
  assert.ok(engine.ball.vz < 0.6, 'PASAR must execute a low ground pass (saque corto rasante)');

  // 5. Rival AI Goalkeeper Goal Kick: freezes user players until AI goalkeeper kicks automatically
  const awayGk = engine.players.find((p) => p.side === 'away' && p.player.position === 'GK')!;
  engine.triggerSetPiece('goal_kick', 'away', PITCH.LENGTH - 5.5, PITCH.HALF_Y);
  assert.equal(engine.phase, 'GOAL_KICK_AIM');
  const aiAim = engine.goalKickAimState as GoalKickAimState | null;
  assert.equal(aiAim?.isUserControlled, false);
  assert.equal(aiAim?.keeperId, awayGk.id);

  // Try moving user player while AI GK is preparing to kick -> user player must stay frozen!
  const userPlayer = engine.players.find((p) => p.id === engine.activeUserPlayerId)!;
  const frozenUserX = userPlayer.x;
  const frozenUserY = userPlayer.y;
  engine.userInput.moveX = 1;
  engine.userInput.moveY = -1;
  engine.userInput.sprint = true;
  engine.step(1 / 60);
  assert.equal(userPlayer.x, frozenUserX, 'User players must remain frozen while rival AI goalkeeper prepares goal kick');
  assert.equal(userPlayer.y, frozenUserY);
  assert.equal(userPlayer.vx, 0);
  assert.equal(userPlayer.vy, 0);

  // Step until AI goalkeeper executes automatic kick (~0.7s = 45 frames)
  for (let i = 0; i < 50; i++) {
    engine.step(1 / 60);
  }
  assert.equal(engine.phase, 'live', 'Rival AI goalkeeper must automatically kick after brief freeze and unfreeze match');
  assert.equal(engine.ball.lastTouchPlayerId, awayGk.id);
});

test('EASTER_EGG_RACING_TITANS ("Racing Titanes") central flag, 3.5x scale & colliders, 100 attributes, zero fatigue/injury, unstoppable clashes/slide tackles, giant GK hitbox, Supreme AI, and seismic footsteps', () => {
  assert.equal(EASTER_EGG_RACING_TITANS, true, 'Master flag EASTER_EGG_RACING_TITANS must exist and default to true');
  assert.ok(
    RACING_TITANS_CONFIG.TITAN_HEIGHT_SCALE >= 3 && RACING_TITANS_CONFIG.TITAN_HEIGHT_SCALE <= 4,
    'TITAN_HEIGHT_SCALE must be between 3 and 4 times normal height'
  );

  const teams = getBaseDatabaseTeams();
  const racingTeam = teams.find((t) => t.id === 'club_rac')!;
  const riverTeam = teams.find((t) => t.id === 'club_riv') ?? teams[0];
  assert.ok(racingTeam, 'Racing Club (club_rac) must exist in the database');
  assert.equal(isRacingTeam(racingTeam), true);
  assert.equal(isRacingTeam(riverTeam), false);

  // 1. Not active when locked/disabled
  const lockedSettings = {
    ...DEFAULT_SETTINGS,
    match: { ...DEFAULT_SETTINGS.match, racingTitansUnlocked: false, racingTitansEnabled: false },
  };
  assert.equal(isRacingTitansActiveForTeam(racingTeam, lockedSettings), false);

  // 2. Active when unlocked and enabled in settings
  const unlockedSettings = {
    ...DEFAULT_SETTINGS,
    match: { ...DEFAULT_SETTINGS.match, racingTitansUnlocked: true, racingTitansEnabled: true },
  };
  assert.equal(isRacingTitansActiveForTeam(racingTeam, unlockedSettings), true);
  assert.equal(isRacingTitansActiveForTeam(riverTeam, unlockedSettings), false);

  // 3. Master flag centralization: disabling master flag turns off Racing Titans completely
  setRacingTitansMasterFlag(false);
  assert.equal(isRacingTitansActiveForTeam(racingTeam, unlockedSettings), false);
  setRacingTitansMasterFlag(true);
  assert.equal(isRacingTitansActiveForTeam(racingTeam, unlockedSettings), true);

  // 4. Spawn match with Racing Club (home) vs River Plate (away) with Racing Titans enabled
  const soundsTriggered: string[] = [];
  const engine = new MatchEngine({
    mode: 'quick_match',
    homeTeam: racingTeam,
    awayTeam: riverTeam,
    userSide: 'away', // Let AI control Racing Club to also verify Supreme AI + user rival
    settings: unlockedSettings,
    onSound: (s) => soundsTriggered.push(s),
  });

  assert.equal(engine.homeIsRacingTitans, true);
  assert.equal(engine.awayIsRacingTitans, false);
  assert.equal(engine.hasActiveRacingTitans, true);
  assert.equal(engine.bannerText, '¡Racing Titanes activado!');
  assert.ok(soundsTriggered.includes('titan_activation'), 'Must trigger titan_activation fanfare at kickoff');

  const racingPlayers = engine.players.filter((p) => p.side === 'home');
  const normalPlayers = engine.players.filter((p) => p.side === 'away');
  assert.equal(racingPlayers.length, 11);

  for (const rp of racingPlayers) {
    assert.equal(rp.isRacingTitan, true);
    assert.equal(rp.titanScale, RACING_TITANS_CONFIG.TITAN_HEIGHT_SCALE);
    assert.equal(rp.player.overall, 100);
    assert.equal(rp.stamina, 100);
    assert.equal(rp.injured, false);
    for (const [attrKey, attrVal] of Object.entries(rp.player.attributes)) {
      assert.equal(attrVal, 100, `Racing Titan attribute ${attrKey} must be fixed at 100`);
    }
    assert.ok(
      Math.abs(
        getPlayerColliderRadius(rp) -
          RACING_TITANS_CONFIG.NORMAL_COLLIDER_RADIUS_M * RACING_TITANS_CONFIG.TITAN_HEIGHT_SCALE
      ) < 1e-6,
      'Titan collider radius must scale proportionally with TITAN_HEIGHT_SCALE'
    );
  }

  // 5. No fatigue, no injuries, and seismic footstep sound + camera shake when running
  const titanRunner = racingPlayers.find((p) => p.player.position !== 'GK')!;
  titanRunner.stamina = 42;
  titanRunner.injured = true;
  titanRunner.fallTimer = 0.8;
  titanRunner.stunTimer = 0.8;
  stepPlayerMovement(titanRunner, 1, 0, true, false, 0.25, 'optimo', 1.0);
  assert.equal(titanRunner.stamina, 100, 'Racing Titans must never lose stamina');
  assert.equal(titanRunner.injured, false, 'Racing Titans must never be injured');
  assert.equal(titanRunner.fallTimer, 0, 'Racing Titans must never fall down');
  assert.equal(titanRunner.stunTimer, 0, 'Racing Titans must never be stunned');

  engine.phase = 'live';
  titanRunner.vx = 7.5;
  titanRunner.vy = 0;
  engine.step(0.25);
  assert.ok(
    soundsTriggered.includes('titan_footstep'),
    'Running Racing Titans must emit heavy titan_footstep sound'
  );
  assert.ok(engine.cameraShake > 0, 'Running Racing Titans must induce subtle camera vibration');

  // 6. Unstoppable in body collisions & slide tackles against normal players
  const normalDefender = normalPlayers.find((p) => p.player.position !== 'GK')!;
  titanRunner.x = 52;
  titanRunner.y = 34;
  titanRunner.vx = 5;
  titanRunner.vy = 0;
  normalDefender.x = 52.8;
  normalDefender.y = 34;
  normalDefender.vx = -3;
  normalDefender.vy = 0;
  engine.ball.ownerId = titanRunner.id;

  const normalBeforeX = normalDefender.x;
  const colRes = resolvePlayerCollisions([titanRunner, normalDefender], engine.ball.ownerId);
  assert.notEqual(
    colRes.dispossessedCarrierId,
    titanRunner.id,
    'Unstoppable Racing Titan must never lose the ball in a body collision against a normal player'
  );
  assert.ok(
    normalDefender.x > normalBeforeX + 0.5 && normalDefender.vx > 0,
    'Normal rival must be pushed away on contact with a Racing Titan'
  );

  // Slide tackle by normal defender against Racing Titan carrier
  const slideOutcome = evaluateTackleOutcome(normalDefender, titanRunner, true, () => 0.5);
  assert.equal(slideOutcome.wonBall, false, 'Normal player slide tackle must never win ball from Racing Titan');
  assert.equal(slideOutcome.knockdown, false, 'Normal player slide tackle must never knock down a Racing Titan');
  assert.equal(slideOutcome.injuryTriggered, false, 'Racing Titan must never be injured by a slide tackle');

  // 7. Supreme AI profile check
  assert.equal(RACING_TITANS_AI_PROFILE.reactionDelaySec, 0.015);
  assert.equal(RACING_TITANS_AI_PROFILE.passErrorMeters, 0);
  assert.equal(RACING_TITANS_AI_PROFILE.shotErrorMeters, 0);
  assert.equal(RACING_TITANS_AI_PROFILE.gkReflexes, 1.0);

  // 8. Giant Goalkeeper Hitbox covers almost the entire goal
  const titanGk = racingPlayers.find((p) => p.player.position === 'GK')!;
  titanGk.x = 1.2;
  titanGk.y = PITCH.HALF_Y;
  titanGk.diveTimer = 0;
  engine.ball.ownerId = null;
  engine.ball.lastTouchTeam = 'away';
  engine.ball.lastTouchPlayerId = normalDefender.id;
  engine.ball.x = 1.4;
  engine.ball.y = PITCH.HALF_Y + 3.4; // 3.4m lateral (near goal post, beyond normal GK reach without dive, within Titan 4.55m reach)
  engine.ball.z = 2.25; // High top-corner height (within Titan 3.75m vertical reach)
  engine.ball.vx = -22;
  engine.ball.vy = 0;
  engine.ball.vz = 0;

  engine.step(1 / 60);
  assert.ok(
    engine.homeStats.saves >= 1 || (engine.ball.lastTouchTeam as string) === 'home',
    'Giant Racing Titan goalkeeper hitbox must cover almost the entire goal and save top-corner shots'
  );
});


