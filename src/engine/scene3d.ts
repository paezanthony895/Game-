import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { CoachMood, MatchEngine } from './matchEngine';
import {
  EXPANDED_PITCH_SCALE,
  PITCH,
  RACING_TITANS_CONFIG,
  isRacingTitansMasterFlagEnabled,
} from './physics';
import type {
  BeardType,
  GameSettings,
  HairstyleType,
  KitPattern,
  KitSelection,
  PlayerAppearance,
  Team,
} from '../types/football';

export interface StadiumPerformanceTelemetry {
  fps: number;
  frameTimeMs: number;
  targetFps: number;
  renderScalePct: number;
  drawCalls: number;
  triangles: number;
  pitchDimensionsM: string;
  pitchScaleFactor: number;
  stadiumCapacity: number;
  gpuInstancedCrowdCount: number;
  billboardCrowdCount: number;
  lightTowerCount: number;
  activeSectors: number;
  culledSectors: number;
  timeOfDay: GameSettings['match']['timeOfDay'];
  qualityTier: GameSettings['visual']['quality'];
  isSoftwareGl: boolean;
}

export interface MatchScene3DController {
  renderer: THREE.WebGLRenderer;
  isSoftwareGl: boolean;
  updateTeamKits: (homeTeam: Team, awayTeam: Team, homeKit: KitSelection, awayKit: KitSelection) => void;
  setTimeOfDay: (timeOfDay: GameSettings['match']['timeOfDay']) => void;
  getPerformanceTelemetry: () => StadiumPerformanceTelemetry;
  updateAndRender: (
    eng: MatchEngine,
    dt: number,
    nowMs: number,
    cameraMode: GameSettings['visual']['cameraMode'],
    cameraZoom: number,
    shootChargePct: number
  ) => void;
  resize: (width: number, height: number) => void;
  dispose: () => void;
}

/**
 * 140 x 90 m Expanded World-Space Pitch Constants (Proportional to configurable EXPANDED_PITCH_SCALE)
 */
export const WORLD_PITCH = {
  LENGTH: EXPANDED_PITCH_SCALE.TARGET_LENGTH_M, // 140 m
  WIDTH: EXPANDED_PITCH_SCALE.TARGET_WIDTH_M, // 90 m
  HALF_X: EXPANDED_PITCH_SCALE.TARGET_LENGTH_M / 2, // 70 m
  HALF_Z: EXPANDED_PITCH_SCALE.TARGET_WIDTH_M / 2, // 45 m
  SCALE_X: EXPANDED_PITCH_SCALE.FACTOR_X, // 140 / 105 = 1.333333
  SCALE_Z: EXPANDED_PITCH_SCALE.FACTOR_Y, // 90 / 68 = 1.323529
  GOAL_HALF: PITCH.GOAL_HALF * EXPANDED_PITCH_SCALE.FACTOR_Y,
  GOAL_HEIGHT: PITCH.GOAL_HEIGHT,
  GOAL_DEPTH: PITCH.GOAL_DEPTH * EXPANDED_PITCH_SCALE.FACTOR_X,
  PENALTY_AREA_X: PITCH.PENALTY_AREA_X * EXPANDED_PITCH_SCALE.FACTOR_X, // 22.0 m
  PENALTY_AREA_HALF_Z: PITCH.PENALTY_AREA_HALF_Y * EXPANDED_PITCH_SCALE.FACTOR_Y, // 26.68 m
  SIX_YARD_X: PITCH.SIX_YARD_X * EXPANDED_PITCH_SCALE.FACTOR_X, // 7.33 m
  SIX_YARD_HALF_Z: PITCH.SIX_YARD_HALF_Y * EXPANDED_PITCH_SCALE.FACTOR_Y, // 12.12 m
  PENALTY_SPOT_X: PITCH.PENALTY_SPOT_X * EXPANDED_PITCH_SCALE.FACTOR_X, // 14.67 m
  CENTER_CIRCLE_R: PITCH.CENTER_CIRCLE_R * EXPANDED_PITCH_SCALE.FACTOR_X, // 12.20 m
} as const;

interface PlayerRig3D {
  id: string;
  side: 'home' | 'away';
  isGk: boolean;
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  contactShadow: THREE.Mesh;
  activeRing: THREE.Mesh;
  overheadCursor: THREE.Mesh;
  directionArrow: THREE.Mesh;
  cardMesh?: THREE.Mesh;
  baseScaleY: number;
  baseScaleXZ: number;
}

const SKIN_TONES = [0xf5d0b5, 0xe8b896, 0xd49b72, 0xb87b52, 0x8d5524, 0x5c3818];
const HAIR_TONES = [0x111827, 0x291d12, 0x452c1e, 0x713f12, 0x9ca3af, 0xd97706];
const BOOT_COLORS = [0xd9f938, 0xf97316, 0x38bdf8, 0xf43f5e, 0xffffff, 0x10b981];

const sharedLambertMatCache = new Map<string, THREE.MeshLambertMaterial>();
function getSharedLambertMaterial(colorVal: number | string): THREE.MeshLambertMaterial {
  const key = typeof colorVal === 'number' ? `#${colorVal.toString(16).padStart(6, '0')}` : colorVal.toUpperCase();
  let mat = sharedLambertMatCache.get(key);
  if (!mat) {
    mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(colorVal) });
    sharedLambertMatCache.set(key, mat);
  }
  return mat;
}

function parseHexToInt(hexStr: string | undefined, fallback: number): number {
  if (!hexStr) return fallback;
  const cleaned = hexStr.replace('#', '').trim();
  const parsed = parseInt(cleaned, 16);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function extractPlayerSurname(fullName: string): string {
  const cleaned = (fullName || '').trim();
  if (!cleaned) return '';
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return parts[0].toUpperCase().slice(0, 11);
  const last = parts[parts.length - 1];
  if ((last === 'Jr.' || last === 'Jr') && parts.length >= 2) {
    return `${parts[parts.length - 2]} JR`.toUpperCase().slice(0, 11);
  }
  return last.toUpperCase().slice(0, 11);
}

function freezeStaticMesh(mesh: THREE.Object3D): void {
  mesh.updateMatrix();
  mesh.matrixAutoUpdate = false;
}

function freezeStaticHierarchy(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  root.traverse((child) => {
    if (child !== root) {
      child.updateMatrix();
      child.matrixAutoUpdate = false;
    }
  });
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function physToWorldX(x: number): number {
  return (x - PITCH.HALF_X) * WORLD_PITCH.SCALE_X;
}

function physToWorldZ(y: number): number {
  return (y - PITCH.HALF_Y) * WORLD_PITCH.SCALE_Z;
}

const turfTextureCache = new Map<
  string,
  { colorMap: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture }
>();
let cachedRadialShadowTex: THREE.CanvasTexture | null = null;
let cachedSoccerBallTex: THREE.CanvasTexture | null = null;
let cachedGoalNetTex: THREE.CanvasTexture | null = null;

/**
 * Generates natural broadcast stadium grass texture + micro-blade bump map
 * color-graded to match EA SPORTS FC broadcast turf (#357A2C / #2B6723), cached in memory.
 */
function createTurfTextures(
  tone: Team['stadium']['turfTone'],
  isSoftwareGl: boolean,
  maxAnisotropy = 4
): {
  colorMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const cacheKey = `${tone}|${isSoftwareGl ? 'sw' : 'hw'}`;
  const cached = turfTextureCache.get(cacheKey);
  if (cached) return cached;

  const size = isSoftwareGl ? 512 : 1024;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;

  // Natural broadcast stadium grass palette inspired by EA SPORTS FC
  const palette =
    tone === 'deep'
      ? { a: '#2A6322', b: '#327229', wear: 'rgba(110, 88, 48, 0.14)' }
      : tone === 'emerald'
        ? { a: '#2E6E25', b: '#398130', wear: 'rgba(115, 92, 50, 0.12)' }
        : tone === 'worn'
          ? { a: '#2A6021', b: '#337128', wear: 'rgba(120, 95, 52, 0.18)' }
          : { a: '#2C6A24', b: '#367B2D', wear: 'rgba(112, 90, 50, 0.13)' };

  const stripes = 18;
  const stripeW = size / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? palette.a : palette.b;
    ctx.fillRect(i * stripeW, 0, stripeW + 1, size);
  }

  // Cross-mowed horizontal sheen bands
  const hStripes = 10;
  const hStripeH = size / hStripes;
  for (let j = 0; j < hStripes; j++) {
    ctx.fillStyle = j % 2 === 0 ? 'rgba(255,255,255,0.024)' : 'rgba(0,0,0,0.024)';
    ctx.fillRect(0, j * hStripeH, size, hStripeH);
  }

  // Subtle natural turf wear in goal mouths & center circle
  const drawWearZone = (wx: number, wy: number, rx: number, ry: number) => {
    const g = ctx.createRadialGradient(wx, wy, rx * 0.1, wx, wy, Math.max(rx, ry));
    g.addColorStop(0, palette.wear);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(wx, wy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  drawWearZone(size * 0.04, size * 0.5, size * 0.045, size * 0.12);
  drawWearZone(size * 0.96, size * 0.5, size * 0.045, size * 0.12);
  drawWearZone(size * 0.5, size * 0.5, size * 0.08, size * 0.08);

  // Diagonal diamond mower watermark + micro grass blades for richer broadcast grass
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.018)';
  ctx.lineWidth = stripeW * 0.42;
  for (let d = -size; d < size * 2; d += stripeW * 1.5) {
    ctx.beginPath();
    ctx.moveTo(d, 0);
    ctx.lineTo(d + size, size);
    ctx.stroke();
  }
  ctx.restore();

  // Fine organic grass-blade grain
  const bladeCount = isSoftwareGl ? 3200 : 7500;
  for (let i = 0; i < bladeCount; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle =
      i % 4 === 0
        ? 'rgba(220,252,195,0.038)'
        : i % 2 === 0
        ? 'rgba(255,255,255,0.028)'
        : 'rgba(8,28,10,0.045)';
    ctx.fillRect(x, y, 2, 3.5);
  }

  const colorMap = new THREE.CanvasTexture(c);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.anisotropy = Math.min(4, maxAnisotropy);

  // High-frequency grass blade bump map
  const bc = document.createElement('canvas');
  bc.width = 128;
  bc.height = 128;
  const bctx = bc.getContext('2d')!;
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    bctx.fillStyle = i % 2 === 0 ? '#A8A8A8' : '#585858';
    bctx.fillRect(x, y, 1.5, 2.5);
  }
  const bumpMap = new THREE.CanvasTexture(bc);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(36, 24);

  const pair = { colorMap, bumpMap };
  turfTextureCache.set(cacheKey, pair);
  return pair;
}

function createRadialShadowTexture(): THREE.CanvasTexture {
  if (cachedRadialShadowTex) return cachedRadialShadowTex;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  g.addColorStop(0, 'rgba(0, 0, 0, 0.58)');
  g.addColorStop(0.65, 'rgba(0, 0, 0, 0.24)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  cachedRadialShadowTex = new THREE.CanvasTexture(c);
  return cachedRadialShadowTex;
}

const ballTextureCache = new Map<string, THREE.CanvasTexture>();

function createSoccerBallTexture(ballId = 'ball_pro_atlas'): THREE.CanvasTexture {
  const existing = ballTextureCache.get(ballId);
  if (existing) return existing;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;

  if (ballId === 'ball_retro_tango') {
    // Clásico Tango 78 (Blanco cuero con tríadas geométricas negras)
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 4.5;
    for (let i = 0; i < 6; i++) {
      const cx = 24 + i * 42;
      const cy = 64 + (i % 2 === 0 ? -18 : 18);
      ctx.beginPath();
      ctx.arc(cx, cy, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 24, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (ballId === 'ball_gold_finale') {
    // Balón Dorado de Gran Final
    ctx.fillStyle = '#FEF3C7';
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 6;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(24 + i * 42, 64 + (i % 2 === 0 ? -16 : 16), 22, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#1E293B';
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.arc(20 + i * 36, i % 2 === 0 ? 34 : 92, 13, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (ballId === 'ball_neon_winter') {
    // Alta Visibilidad Neón Invierno / Niebla
    ctx.fillStyle = '#D9F938';
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = '#EA580C';
    ctx.lineWidth = 6;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(24 + i * 42, 64 + (i % 2 === 0 ? -16 : 16), 22, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#0F172A';
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.arc(20 + i * 36, i % 2 === 0 ? 34 : 92, 12, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (ballId === 'ball_cyber_plasma') {
    // Cyber Plasma Futuro
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 6;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(24 + i * 42, 64 + (i % 2 === 0 ? -16 : 16), 22, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#A855F7';
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.arc(20 + i * 36, i % 2 === 0 ? 34 : 92, 12, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, 256, 128);

    // Modern pro match ball graphics (crimson/navy/gold dynamic ribbons + pentagons)
    ctx.strokeStyle = '#DC2626';
    ctx.lineWidth = 5;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(24 + i * 42, 64 + (i % 2 === 0 ? -16 : 16), 22, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = '#0F172A';
    const spots = [
      [32, 32],
      [96, 36],
      [160, 32],
      [224, 36],
      [64, 92],
      [128, 90],
      [192, 92],
    ];
    for (const [x, y] of spots) {
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  ballTextureCache.set(ballId, tex);
  cachedSoccerBallTex = tex;
  return tex;
}

const faceTextureCache = new Map<string, THREE.CanvasTexture>();

/**
 * Generates a realistic 3D facial texture wrapped around the player's sculpted head mesh
 * (eyes, irises, eyebrows, nose bridge, mouth, cheekbones, and authentic beard style).
 */
function createPlayerFaceTexture(
  skinHex: number,
  hairHex: number,
  variantHash: number,
  beardType?: BeardType
): THREE.CanvasTexture {
  const beardKey = beardType ?? String(variantHash % 4);
  const cacheKey = `${skinHex}|${hairHex}|${beardKey}`;
  const existing = faceTextureCache.get(cacheKey);
  if (existing) return existing;

  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  const skinColor = `#${skinHex.toString(16).padStart(6, '0')}`;
  const hairColor = `#${hairHex.toString(16).padStart(6, '0')}`;

  ctx.fillStyle = skinColor;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle cheekbone & jawline shading
  const shadeGrad = ctx.createLinearGradient(0, 110, 0, 256);
  shadeGrad.addColorStop(0, 'rgba(0,0,0,0)');
  shadeGrad.addColorStop(1, 'rgba(0,0,0,0.16)');
  ctx.fillStyle = shadeGrad;
  ctx.fillRect(0, 110, 256, 146);

  const cx = 128;
  const eyeY = 118;

  // Beard / Stubble variations based on PlayerAppearance.barba
  const resolvedBeard: BeardType =
    beardType ??
    ((['ninguna', 'corta', 'completa', 'candado'] as BeardType[])[variantHash % 4]);

  if (resolvedBeard === 'completa') {
    ctx.fillStyle = hairColor;
    ctx.globalAlpha = 0.72;
    ctx.beginPath();
    ctx.ellipse(cx, 174, 38, 36, 0, 0.05, Math.PI - 0.05);
    ctx.fill();
    ctx.fillRect(cx - 16, eyeY + 31, 32, 6);
    ctx.globalAlpha = 1;
  } else if (resolvedBeard === 'corta') {
    ctx.fillStyle = hairColor;
    ctx.globalAlpha = 0.36;
    ctx.beginPath();
    ctx.ellipse(cx, 173, 35, 32, 0, 0.1, Math.PI - 0.1);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (resolvedBeard === 'candado') {
    ctx.fillStyle = hairColor;
    ctx.globalAlpha = 0.65;
    ctx.strokeStyle = hairColor;
    ctx.lineWidth = 6;
    ctx.strokeRect(cx - 14, eyeY + 33, 28, 22);
    ctx.globalAlpha = 1;
  }

  // Eyebrows
  ctx.fillStyle = hairColor;
  ctx.fillRect(cx - 26, eyeY - 14, 16, 4.5);
  ctx.fillRect(cx + 10, eyeY - 14, 16, 4.5);

  // Eyes (sclera + dark iris)
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.ellipse(cx - 18, eyeY, 6.5, 4.2, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 18, eyeY, 6.5, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.arc(cx - 18, eyeY, 3.2, 0, Math.PI * 2);
  ctx.arc(cx + 18, eyeY, 3.2, 0, Math.PI * 2);
  ctx.fill();

  // Nose bridge & tip shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.moveTo(cx, eyeY + 2);
  ctx.lineTo(cx - 5, eyeY + 24);
  ctx.lineTo(cx + 5, eyeY + 24);
  ctx.closePath();
  ctx.fill();

  // Mouth / Lips
  ctx.fillStyle = 'rgba(130, 48, 48, 0.65)';
  ctx.fillRect(cx - 11, eyeY + 38, 22, 4.5);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  faceTextureCache.set(cacheKey, tex);
  return tex;
}

const jerseyTextureCache = new Map<string, THREE.CanvasTexture>();

export function resolveTeamKitColors(
  team: Team,
  kitSelection: KitSelection,
  retroKitId = 'kit_default',
  isHomeTeam = false
): { primary: string; secondary: string; shorts: string; pattern: KitPattern } {
  if (isHomeTeam && retroKitId && retroKitId !== 'kit_default') {
    if (retroKitId === 'kit_retro_86') {
      return {
        primary: '#38BDF8',
        secondary: '#FFFFFF',
        shorts: '#0F172A',
        pattern: 'stripes',
      };
    }
    if (retroKitId === 'kit_retro_98') {
      return {
        primary: '#FACC15',
        secondary: '#15803D',
        shorts: '#1D4ED8',
        pattern: 'solid',
      };
    }
    if (retroKitId === 'kit_retro_blackout') {
      return {
        primary: '#0F172A',
        secondary: '#F59E0B',
        shorts: '#0F172A',
        pattern: 'sash',
      };
    }
  }
  if (kitSelection === 'away') {
    return {
      primary: team.awayColor || '#F8FAFC',
      secondary: team.primaryColor,
      shorts: team.primaryColor,
      pattern: team.awayPattern || 'solid',
    };
  }
  if (kitSelection === 'third') {
    return {
      primary: team.thirdColor || '#F59E0B',
      secondary: '#0F172A',
      shorts: '#0F172A',
      pattern: 'sash',
    };
  }
  return {
    primary: team.primaryColor,
    secondary: team.secondaryColor,
    shorts: team.secondaryColor === '#FFFFFF' ? '#FFFFFF' : '#111827',
    pattern: team.kitPattern,
  };
}

function createJerseyTexture(
  primaryColor: string,
  secondaryColor: string,
  pattern: KitPattern,
  squadNumber: number,
  isGk: boolean,
  playerSurname = ''
): THREE.CanvasTexture {
  const surnameClean = extractPlayerSurname(playerSurname);
  const key = `${primaryColor}|${secondaryColor}|${pattern}|${squadNumber}|${isGk}|${surnameClean}`;
  const cached = jerseyTextureCache.get(key);
  if (cached) return cached;

  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  const baseBg = isGk ? '#F59E0B' : primaryColor;
  const accent = isGk ? '#111827' : secondaryColor;

  ctx.fillStyle = baseBg;
  ctx.fillRect(0, 0, 256, 256);

  if (!isGk) {
    ctx.fillStyle = accent;
    if (pattern === 'stripes') {
      for (let x = 14; x < 256; x += 32) {
        ctx.fillRect(x, 0, 15, 256);
      }
    } else if (pattern === 'hoops') {
      for (let y = 20; y < 256; y += 36) {
        ctx.fillRect(0, y, 256, 16);
      }
    } else if (pattern === 'halves') {
      ctx.fillRect(128, 0, 128, 256);
    } else if (pattern === 'sash') {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(56, 0);
      ctx.lineTo(256, 200);
      ctx.lineTo(256, 256);
      ctx.lineTo(200, 256);
      ctx.lineTo(0, 56);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Woven breathable sports fabric micro-texture
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  for (let y = 0; y < 256; y += 4) {
    ctx.fillRect(0, y, 256, 1);
  }

  // Shoulder & hem accent trim
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 256, 14);
  ctx.fillRect(0, 244, 256, 12);

  // CylinderGeometry wraps around: u=0.5 (x=128) is Front (+Z), u=0.0/1.0 (x=0/256) is Back (-Z).
  if (squadNumber > 0) {
    const drawTextWithOutline = (
      text: string,
      centerX: number,
      centerY: number,
      fontSize: number,
      lineW = 6
    ) => {
      ctx.save();
      ctx.font = `900 ${fontSize}px "Barlow Condensed", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = lineW;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.strokeText(text, centerX, centerY);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(text, centerX, centerY);
      ctx.restore();
    };

    // Front chest small number
    drawTextWithOutline(String(squadNumber), 128, 134, 56, 5);

    // Back player surname & large dorsal number (wrapped across x=0 and x=256 seam)
    if (surnameClean) {
      const nameFontSize = surnameClean.length > 8 ? 22 : 26;
      drawTextWithOutline(surnameClean, 0, 56, nameFontSize, 5);
      drawTextWithOutline(surnameClean, 256, 56, nameFontSize, 5);
    }
    drawTextWithOutline(String(squadNumber), 0, 124, 86, 7);
    drawTextWithOutline(String(squadNumber), 256, 124, 86, 7);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  jerseyTextureCache.set(key, tex);
  return tex;
}

function createPitchMarkingsGroup(): THREE.Group {
  const group = new THREE.Group();
  const lineMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.94,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const Y = 0.02;
  const LW = 0.16;

  const addLineRect = (cx: number, cz: number, w: number, h: number) => {
    const hGeo = new THREE.PlaneGeometry(w, LW);
    hGeo.rotateX(-Math.PI / 2);
    const top = new THREE.Mesh(hGeo, lineMat);
    top.position.set(cx, Y, cz - h / 2);
    const bot = new THREE.Mesh(hGeo, lineMat);
    bot.position.set(cx, Y, cz + h / 2);
    const vGeo = new THREE.PlaneGeometry(LW, h);
    vGeo.rotateX(-Math.PI / 2);
    const left = new THREE.Mesh(vGeo, lineMat);
    left.position.set(cx - w / 2, Y, cz);
    const right = new THREE.Mesh(vGeo, lineMat);
    right.position.set(cx + w / 2, Y, cz);
    group.add(top, bot, left, right);
  };

  // Outer pitch boundary (140 x 90 m expanded surface)
  addLineRect(0, 0, WORLD_PITCH.LENGTH, WORLD_PITCH.WIDTH);

  // Technical Areas (Áreas Técnicas) along North touchline for Home & Away Coaches
  addLineRect(-14.6, -WORLD_PITCH.HALF_Z - 1.5, 11.2, 2.2);
  addLineRect(14.6, -WORLD_PITCH.HALF_Z - 1.5, 11.2, 2.2);

  // Halfway line
  const halfGeo = new THREE.PlaneGeometry(LW, WORLD_PITCH.WIDTH);
  halfGeo.rotateX(-Math.PI / 2);
  const halfLine = new THREE.Mesh(halfGeo, lineMat);
  halfLine.position.set(0, Y, 0);
  group.add(halfLine);

  // Proportional Center Circle (R = 12.20 m) & Spot
  const circleGeo = new THREE.RingGeometry(
    WORLD_PITCH.CENTER_CIRCLE_R - LW / 2,
    WORLD_PITCH.CENTER_CIRCLE_R + LW / 2,
    64
  );
  circleGeo.rotateX(-Math.PI / 2);
  const centerCircle = new THREE.Mesh(circleGeo, lineMat);
  centerCircle.position.set(0, Y, 0);
  group.add(centerCircle);

  const spotGeo = new THREE.CircleGeometry(0.32, 20);
  spotGeo.rotateX(-Math.PI / 2);
  const centerSpot = new THREE.Mesh(spotGeo, lineMat);
  centerSpot.position.set(0, Y, 0);
  group.add(centerSpot);

  // Proportional Left & Right Penalty Boxes (22.0m x 53.36m) & 6-Yard Goal Areas (7.33m x 24.25m)
  const penW = WORLD_PITCH.PENALTY_AREA_X;
  const penH = WORLD_PITCH.PENALTY_AREA_HALF_Z * 2;
  addLineRect(-WORLD_PITCH.HALF_X + penW / 2, 0, penW, penH);
  addLineRect(WORLD_PITCH.HALF_X - penW / 2, 0, penW, penH);

  const goalAreaW = WORLD_PITCH.SIX_YARD_X;
  const goalAreaH = WORLD_PITCH.SIX_YARD_HALF_Z * 2;
  addLineRect(-WORLD_PITCH.HALF_X + goalAreaW / 2, 0, goalAreaW, goalAreaH);
  addLineRect(WORLD_PITCH.HALF_X - goalAreaW / 2, 0, goalAreaW, goalAreaH);

  // Penalty Spots (14.67m from goal line)
  const leftPenSpot = new THREE.Mesh(spotGeo, lineMat);
  leftPenSpot.position.set(-WORLD_PITCH.HALF_X + WORLD_PITCH.PENALTY_SPOT_X, Y, 0);
  const rightPenSpot = new THREE.Mesh(spotGeo, lineMat);
  rightPenSpot.position.set(WORLD_PITCH.HALF_X - WORLD_PITCH.PENALTY_SPOT_X, Y, 0);
  group.add(leftPenSpot, rightPenSpot);

  // Proportional Penalty Arcs (R = 12.20 m)
  const arcR = WORLD_PITCH.CENTER_CIRCLE_R;
  const leftArcGeo = new THREE.RingGeometry(arcR - LW / 2, arcR + LW / 2, 40, 1, -0.92, 1.84);
  leftArcGeo.rotateX(-Math.PI / 2);
  const leftArc = new THREE.Mesh(leftArcGeo, lineMat);
  leftArc.position.set(-WORLD_PITCH.HALF_X + WORLD_PITCH.PENALTY_SPOT_X, Y, 0);

  const rightArcGeo = new THREE.RingGeometry(arcR - LW / 2, arcR + LW / 2, 40, 1, Math.PI - 0.92, 1.84);
  rightArcGeo.rotateX(-Math.PI / 2);
  const rightArc = new THREE.Mesh(rightArcGeo, lineMat);
  rightArc.position.set(WORLD_PITCH.HALF_X - WORLD_PITCH.PENALTY_SPOT_X, Y, 0);
  group.add(leftArc, rightArc);

  // Corner Arcs & 4 Corner Flags in 3D
  const poleGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.5, 8);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
  const flagGeo = new THREE.PlaneGeometry(0.45, 0.3);
  const flagMat = new THREE.MeshStandardMaterial({ color: 0xef4444, side: THREE.DoubleSide, roughness: 0.5 });

  const corners = [
    [-WORLD_PITCH.HALF_X, -WORLD_PITCH.HALF_Z],
    [WORLD_PITCH.HALF_X, -WORLD_PITCH.HALF_Z],
    [-WORLD_PITCH.HALF_X, WORLD_PITCH.HALF_Z],
    [WORLD_PITCH.HALF_X, WORLD_PITCH.HALF_Z],
  ];
  for (const [cx, cz] of corners) {
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(cx, 0.75, cz);
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(cx + 0.22, 1.32, cz);
    group.add(pole, flag);
  }

  return group;
}

function createGoalNetTexture(): THREE.CanvasTexture {
  if (cachedGoalNetTex) return cachedGoalNetTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.85)';
  ctx.lineWidth = 2.2;

  const step = 16;
  for (let i = -128; i <= 256; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 128, 128);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(i + 128, 0);
    ctx.lineTo(i, 128);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(9, 4);
  cachedGoalNetTex = tex;
  return tex;
}

function create3DGoal(side: 'left' | 'right'): { group: THREE.Group; netMeshes: THREE.Mesh[] } {
  const group = new THREE.Group();
  const dir = side === 'left' ? -1 : 1;
  const goalX = dir * WORLD_PITCH.HALF_X;
  const H = WORLD_PITCH.GOAL_HEIGHT;
  const halfW = WORLD_PITCH.GOAL_HALF;
  const depth = WORLD_PITCH.GOAL_DEPTH;

  const postMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.2,
    roughness: 0.18,
  });
  const backSupportMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.35,
    roughness: 0.3,
  });

  // Left & Right Vertical Goalposts
  const postGeo = new THREE.CylinderGeometry(0.088, 0.088, H, 16);
  const post1 = new THREE.Mesh(postGeo, postMat);
  post1.position.set(goalX, H / 2, -halfW);
  post1.castShadow = true;

  const post2 = new THREE.Mesh(postGeo, postMat);
  post2.position.set(goalX, H / 2, halfW);
  post2.castShadow = true;

  // Horizontal Crossbar
  const barGeo = new THREE.CylinderGeometry(0.088, 0.088, halfW * 2 + 0.17, 16);
  barGeo.rotateX(Math.PI / 2);
  const crossbar = new THREE.Mesh(barGeo, postMat);
  crossbar.position.set(goalX, H, 0);
  crossbar.castShadow = true;

  // Back frame stanchions & bottom net bar (white/silver like EA SPORTS FC reference)
  const backBar = new THREE.Mesh(barGeo, backSupportMat);
  backBar.position.set(goalX + dir * depth, 0.05, 0);
  const topBackBar = new THREE.Mesh(barGeo, backSupportMat);
  topBackBar.position.set(goalX + dir * depth, H * 0.96, 0);

  const stanchionGeo = new THREE.CylinderGeometry(0.045, 0.045, H * 0.96, 10);
  const st1 = new THREE.Mesh(stanchionGeo, backSupportMat);
  st1.position.set(goalX + dir * depth, (H * 0.96) / 2, -halfW);
  const st2 = new THREE.Mesh(stanchionGeo, backSupportMat);
  st2.position.set(goalX + dir * depth, (H * 0.96) / 2, halfW);

  const sideBottomBarGeo = new THREE.CylinderGeometry(0.045, 0.045, depth, 10);
  sideBottomBarGeo.rotateZ(Math.PI / 2);
  const sb1 = new THREE.Mesh(sideBottomBarGeo, backSupportMat);
  sb1.position.set(goalX + (dir * depth) / 2, 0.05, -halfW);
  const sb2 = new THREE.Mesh(sideBottomBarGeo, backSupportMat);
  sb2.position.set(goalX + (dir * depth) / 2, 0.05, halfW);

  group.add(post1, post2, crossbar, backBar, topBackBar, st1, st2, sb1, sb2);

  // High-visibility crisp white hexagonal/diamond 3D Goal Net Panels
  const netTex = createGoalNetTexture();
  const netMat = new THREE.MeshBasicMaterial({
    map: netTex,
    color: 0xffffff,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const backNetGeo = new THREE.PlaneGeometry(halfW * 2, H * 0.96, 18, 10);
  const backNet = new THREE.Mesh(backNetGeo, netMat);
  backNet.rotation.y = side === 'left' ? Math.PI / 2 : -Math.PI / 2;
  backNet.position.set(goalX + dir * depth, (H * 0.96) / 2, 0);

  const topNetGeo = new THREE.PlaneGeometry(depth, halfW * 2, 6, 18);
  topNetGeo.rotateX(-Math.PI / 2);
  const topNet = new THREE.Mesh(topNetGeo, netMat);
  topNet.position.set(goalX + (dir * depth) / 2, H * 0.96, 0);

  const sideNetGeo = new THREE.PlaneGeometry(depth, H * 0.96, 6, 10);
  const sideNet1 = new THREE.Mesh(sideNetGeo, netMat);
  sideNet1.position.set(goalX + (dir * depth) / 2, (H * 0.96) / 2, -halfW);
  const sideNet2 = new THREE.Mesh(sideNetGeo, netMat);
  sideNet2.position.set(goalX + (dir * depth) / 2, (H * 0.96) / 2, halfW);

  group.add(backNet, topNet, sideNet1, sideNet2);

  return { group, netMeshes: [backNet, topNet, sideNet1, sideNet2] };
}

/**
 * Generates the EA SPORTS FC style glowing perimeter LED advertising boards:
 * vibrant crimson/red & white angled segments with "MATCHDAY BUILD UP & STATS",
 * "<TEAM> OFFICIAL APP", "NEWS & TRAINING".
 */
function createAdvertisingBoardTexture(homeTeam: Team, awayTeam: Team): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 128;
  const ctx = c.getContext('2d')!;

  // Rich crimson red base (#E11D48 / #DC2626) like the reference screenshot
  ctx.fillStyle = '#DC2626';
  ctx.fillRect(0, 0, 2048, 128);

  // Diagonal white chevron blocks for the club app segments
  const drawWhitePanel = (startX: number, width: number) => {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(startX + 36, 0);
    ctx.lineTo(startX + width, 0);
    ctx.lineTo(startX + width - 36, 128);
    ctx.lineTo(startX, 128);
    ctx.closePath();
    ctx.fill();
  };

  drawWhitePanel(510, 460);
  drawWhitePanel(1534, 460);

  // Top & bottom dark LED bezel frame
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 0, 2048, 6);
  ctx.fillRect(0, 122, 2048, 6);

  ctx.textBaseline = 'middle';
  ctx.font = '900 58px "Barlow Condensed", sans-serif';

  // Segment 1: MATCHDAY BUILD UP & STATS (White on Red)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('MATCHDAY BUILD UP & STATS', 34, 66);

  // Segment 2: <HOME TEAM> APP (Dark Slate + Red Crest Icon on White)
  ctx.fillStyle = '#DC2626';
  ctx.fillRect(575, 32, 62, 64);
  ctx.fillStyle = '#FACC15';
  ctx.font = '900 36px "Barlow Condensed", sans-serif';
  ctx.fillText(homeTeam.shortName, 582, 66);

  ctx.fillStyle = '#0F172A';
  ctx.font = '900 58px "Barlow Condensed", sans-serif';
  ctx.fillText(`${homeTeam.shortName} OFFICIAL APP`, 654, 66);

  // Segment 3: NEWS & TRAINING (White on Red)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('NEWS & TRAINING', 1055, 66);

  // Segment 4: <HOME> VS <AWAY> LIVE (Dark Slate on White)
  ctx.fillStyle = '#DC2626';
  ctx.fillRect(1595, 32, 62, 64);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 34px "Barlow Condensed", sans-serif';
  ctx.fillText('LIVE', 1600, 66);

  ctx.fillStyle = '#0F172A';
  ctx.font = '900 56px "Barlow Condensed", sans-serif';
  ctx.fillText(`${homeTeam.shortName} VS ${awayTeam.shortName} · TV`, 1672, 66);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  return tex;
}

function createDynamicJumbotron(homeTeam: Team, awayTeam: Team): {
  texture: THREE.CanvasTexture;
  updateScoreboard: (homeScore: number, awayScore: number, minute: number) => void;
} {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 192;
  const ctx = c.getContext('2d')!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  let lastKey = '';
  const updateScoreboard = (homeScore: number, awayScore: number, minute: number) => {
    const key = `${homeScore}|${awayScore}|${minute}`;
    if (key === lastKey) return;
    lastKey = key;

    ctx.fillStyle = '#050B11';
    ctx.fillRect(0, 0, 512, 192);
    ctx.strokeStyle = '#D9F938';
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, 504, 184);

    // Header bar
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(10, 10, 492, 34);
    ctx.fillStyle = '#D9F938';
    ctx.font = '800 20px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${homeTeam.stadium.name.toUpperCase()} · ${String(minute).padStart(2, '0')}'`,
      256,
      33
    );

    // Home & Away color blocks + live score
    ctx.fillStyle = homeTeam.primaryColor;
    ctx.fillRect(28, 60, 14, 58);
    ctx.fillStyle = awayTeam.primaryColor;
    ctx.fillRect(470, 60, 14, 58);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 58px "Barlow Condensed", sans-serif';
    ctx.fillText(
      `${homeTeam.shortName}   ${homeScore} - ${awayScore}   ${awayTeam.shortName}`,
      256,
      108
    );

    ctx.fillStyle = '#38BDF8';
    ctx.font = '700 20px "Barlow Condensed", sans-serif';
    ctx.fillText('ATLAS SPORTS LIVE · TRANSMISIÓN OFICIAL EN VIVO', 256, 160);
    tex.needsUpdate = true;
  };

  updateScoreboard(0, 0, 0);
  return { texture: tex, updateScoreboard };
}

/**
 * Builds a single merged BufferGeometry for an instanced 3D human spectator
 * (head + shoulders/torso) so the crowd looks like real packed people in the stands.
 */
function createSpectatorGeometry(): THREE.BufferGeometry {
  const torso = new THREE.BoxGeometry(0.56, 0.72, 0.36);
  torso.translate(0, 0.36, 0);
  const head = new THREE.BoxGeometry(0.28, 0.28, 0.28);
  head.translate(0, 0.88, 0);

  const pos1 = torso.attributes.position;
  const pos2 = head.attributes.position;
  const norm1 = torso.attributes.normal;
  const norm2 = head.attributes.normal;
  const idx1 = torso.index!;
  const idx2 = head.index!;

  const totalVerts = pos1.count + pos2.count;
  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);

  positions.set(pos1.array as Float32Array, 0);
  positions.set(pos2.array as Float32Array, pos1.count * 3);
  normals.set(norm1.array as Float32Array, 0);
  normals.set(norm2.array as Float32Array, norm1.count * 3);

  const indices = new Uint16Array(idx1.count + idx2.count);
  indices.set(idx1.array as Uint16Array, 0);
  for (let i = 0; i < idx2.count; i++) {
    indices[idx1.count + i] = idx2.array[i] + pos1.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  return merged;
}

/**
 * Generates a rich packed-crowd mosaic texture applied to the stadium step risers
 * underneath the 3D instanced spectators so the stands look 100% packed shoulder-to-shoulder.
 */
function createCrowdBackdropTexture(homeTeam: Team): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#181E26';
  ctx.fillRect(0, 0, 512, 256);

  const shirtColors = [
    '#DC2626',
    '#E11D48',
    homeTeam.primaryColor,
    '#F8FAFC',
    '#1E293B',
    '#FACC15',
    '#B91C1C',
    homeTeam.secondaryColor,
  ];
  const skinColors = ['#F5D0B5', '#D49B72', '#8D5524', '#E8B896'];

  const rows = 14;
  const cols = 64;
  const cellW = 512 / cols;
  const cellH = 256 / rows;

  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const cx = col * cellW + (r % 2 === 0 ? 0 : cellW * 0.5);
      const cy = r * cellH;
      // Spectator torso
      ctx.fillStyle = shirtColors[(r * 17 + col * 31) % shirtColors.length];
      ctx.fillRect(cx + 0.5, cy + cellH * 0.32, cellW - 1, cellH * 0.66);
      // Spectator head
      ctx.fillStyle = skinColors[(r * 7 + col * 13) % skinColors.length];
      ctx.beginPath();
      ctx.arc(cx + cellW * 0.5, cy + cellH * 0.24, cellW * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 1);
  return tex;
}

export interface CullableStadiumSector {
  name: string;
  group: THREE.Object3D;
  bounds: THREE.Sphere;
}

export interface CrowdGpuShaderController {
  uTime: { value: number };
  uWaveAmp: { value: number };
  uWaveSpeed: { value: number };
}

/**
 * Merges an array of positioned BoxGeometries into a single BufferGeometry (1 draw call)
 * for ultra-low draw call modular stadium and exterior city construction.
 */
function mergeBoxBoxesToSingleGeometry(
  boxes: { w: number; h: number; d: number; x: number; y: number; z: number }[]
): THREE.BufferGeometry {
  const templates = boxes.map((b) => {
    const g = new THREE.BoxGeometry(b.w, b.h, b.d);
    g.translate(b.x, b.y, b.z);
    return g;
  });
  let totalVerts = 0;
  let totalIndices = 0;
  for (const g of templates) {
    totalVerts += g.attributes.position.count;
    totalIndices += g.index!.count;
  }
  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const indices = new Uint32Array(totalIndices);

  let vOffset = 0;
  let iOffset = 0;
  for (const g of templates) {
    const pos = g.attributes.position.array as Float32Array;
    const norm = g.attributes.normal.array as Float32Array;
    const uv = g.attributes.uv.array as Float32Array;
    const idx = g.index!.array;

    positions.set(pos, vOffset * 3);
    normals.set(norm, vOffset * 3);
    uvs.set(uv, vOffset * 2);
    for (let k = 0; k < idx.length; k++) {
      indices[iOffset + k] = idx[k] + vOffset;
    }
    vOffset += g.attributes.position.count;
    iOffset += idx.length;
    g.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  merged.computeBoundingSphere();
  return merged;
}

function create3DStadiumAndCrowd(
  homeTeam: Team,
  awayTeam: Team,
  quality: GameSettings['visual']['quality'],
  isSoftwareGl: boolean,
  stadiumThemeId = 'stadium_colosseum'
): {
  stadiumGroup: THREE.Group;
  crowdMesh: THREE.InstancedMesh;
  crowdBillboardMesh: THREE.InstancedMesh;
  flagsMesh: THREE.InstancedMesh;
  flaresGroup: THREE.Group;
  cameraFlashes: THREE.Points;
  updateJumbotron: (homeScore: number, awayScore: number, minute: number) => void;
  crowdBasePositions: { x: number; y: number; z: number; phase: number }[];
  flagBasePositions: { x: number; y: number; z: number; phase: number }[];
  cullableSectors: CullableStadiumSector[];
  towerLodObjects: THREE.LOD[];
  lampHeadMat: THREE.MeshBasicMaterial;
  crowdShaderCtrl: CrowdGpuShaderController;
  nearCrowdCount: number;
  billboardCrowdCount: number;
} {
  const stadiumGroup = new THREE.Group();

  // 5 Frustum-Cullable Sectors (North, South, East, West, Exterior City)
  const northSector = new THREE.Group();
  const southSector = new THREE.Group();
  const eastSector = new THREE.Group();
  const westSector = new THREE.Group();
  const citySector = new THREE.Group();
  stadiumGroup.add(northSector, southSector, eastSector, westSector, citySector);

  const themeAccentHex =
    stadiumThemeId === 'stadium_royal_gold'
      ? 0xf59e0b
      : stadiumThemeId === 'stadium_neon_arena'
      ? 0x06b6d4
      : stadiumThemeId === 'stadium_fortress_red'
      ? 0xb91c1c
      : 0xdc2626;
  const themeRoofHex =
    stadiumThemeId === 'stadium_royal_gold'
      ? 0x1e293b
      : stadiumThemeId === 'stadium_neon_arena'
      ? 0x082f49
      : 0x0f172a;

  const crowdBackdropTex = createCrowdBackdropTexture(homeTeam);
  const standMat = new THREE.MeshLambertMaterial({
    map: crowdBackdropTex,
  });
  const aisleMat = getSharedLambertMaterial(0x94a3b8);
  const tierRedWallMat = getSharedLambertMaterial(themeAccentHex);
  const vipGlassMat = getSharedLambertMaterial(0x38bdf8);
  const darkTunnelMat = new THREE.MeshBasicMaterial({
    color: 0x070a0e,
  });
  const roofMat = getSharedLambertMaterial(themeRoofHex);

  const HX = WORLD_PITCH.HALF_X; // 70 m
  const HZ = WORLD_PITCH.HALF_Z; // 45 m

  // 1. Continuous Glowing LED Perimeter Ad Boards around the 140 x 90 m pitch
  const adTex = createAdvertisingBoardTexture(homeTeam, awayTeam);
  const adMat = new THREE.MeshBasicMaterial({ map: adTex });
  const adBackingMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 });

  const northAd = new THREE.Mesh(new THREE.BoxGeometry(146.4, 1.25, 0.34), adMat);
  northAd.position.set(0, 0.62, -HZ - 2.2);
  northAd.rotation.x = 0.08;
  northSector.add(northAd);

  const eastAd = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.25, 94.8), adMat);
  eastAd.position.set(HX + 3.2, 0.62, 0);
  eastAd.rotation.z = 0.08;
  eastSector.add(eastAd);

  const westAd = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.25, 94.8), adMat);
  westAd.position.set(-HX - 3.2, 0.62, 0);
  westAd.rotation.z = -0.08;
  westSector.add(westAd);

  const southAd = new THREE.Mesh(new THREE.BoxGeometry(146.4, 0.98, 0.34), adBackingMat);
  southAd.position.set(0, 0.49, HZ + 3.0);
  southSector.add(southAd);

  // 2. Pitchside Details: Stewards, Photographers, Broadcast Mics, Dugouts & 3 Player Tunnels
  const stewardTorsoGeo = new THREE.CylinderGeometry(0.18, 0.2, 0.62, 8);
  const stewardHeadGeo = new THREE.SphereGeometry(0.14, 8, 8);
  const orangeVestMat = new THREE.MeshLambertMaterial({ color: 0xf97316 });
  const limeVestMat = new THREE.MeshLambertMaterial({ color: 0x84cc16 });
  const darkPantsMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
  const skinStewardMat = new THREE.MeshLambertMaterial({ color: 0xe8b896 });

  const addPitchsidePerson = (targetGroup: THREE.Group, px: number, pz: number, rotY: number, isOrange: boolean) => {
    const g = new THREE.Group();
    g.position.set(px, 0, pz);
    g.rotation.y = rotY;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.55, 8), darkPantsMat);
    base.position.y = 0.28;
    const vest = new THREE.Mesh(stewardTorsoGeo, isOrange ? orangeVestMat : limeVestMat);
    vest.position.y = 0.82;
    const head = new THREE.Mesh(stewardHeadGeo, skinStewardMat);
    head.position.y = 1.24;
    g.add(base, vest, head);
    targetGroup.add(g);
  };

  for (let x = -62; x <= 62; x += 12.4) {
    addPitchsidePerson(northSector, x, -HZ - 1.5, 0, Math.abs(x) % 24 < 12);
  }
  for (const z of [-36, -24, -12, 10, 22, 34]) {
    addPitchsidePerson(eastSector, HX + 2.3, z, -Math.PI / 2, z > 0);
    addPitchsidePerson(westSector, -HX - 2.3, z, Math.PI / 2, z < 0);
  }

  const dugoutMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.3 });
  const benchSeatMat = new THREE.MeshStandardMaterial({ color: themeAccentHex, roughness: 0.6 });
  for (const bx of [-18, 18]) {
    const shelter = new THREE.Mesh(new THREE.BoxGeometry(7.6, 1.9, 1.6), dugoutMat);
    shelter.position.set(bx, 1.38, -HZ - 3.6);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.55, 0.8), benchSeatMat);
    bench.position.set(bx, 0.82, -HZ - 3.3);
    northSector.add(shelter, bench);
  }

  // Central Player Tunnel + 2 Corner Vomitory Tunnels
  const centralTunnelFrame = new THREE.Mesh(new THREE.BoxGeometry(6.2, 3.5, 2.8), tierRedWallMat);
  centralTunnelFrame.position.set(0, 1.75, -HZ - 4.4);
  const centralTunnelVoid = new THREE.Mesh(new THREE.BoxGeometry(5.0, 2.8, 3.0), darkTunnelMat);
  centralTunnelVoid.position.set(0, 1.4, -HZ - 4.3);
  northSector.add(centralTunnelFrame, centralTunnelVoid);

  // 3. MONUMENTAL 80,000-SPECTATOR 3-TIER MODULAR STADIUM (Merged per sector for < 15 draw calls!)
  const stepsTier1 = 8; // Bandeja Baja (1.2m -> 11.2m)
  const stepsTier2 = 6; // Bandeja Media VIP (13.6m -> 22.8m)
  const stepsTier3 = 7; // Bandeja Alta Monumental (25.2m -> 37.8m)

  const northBoxes: { w: number; h: number; d: number; x: number; y: number; z: number }[] = [];
  const southBoxes: { w: number; h: number; d: number; x: number; y: number; z: number }[] = [];
  const eastBoxes: { w: number; h: number; d: number; x: number; y: number; z: number }[] = [];
  const westBoxes: { w: number; h: number; d: number; x: number; y: number; z: number }[] = [];

  for (let s = 0; s < stepsTier1; s++) {
    const stepH = 1.2 + s * 1.24;
    const stepY = stepH / 2;
    const distOffset = s * 1.55;
    northBoxes.push({ w: 150 + distOffset * 2, h: stepH, d: 1.75, x: 0, y: stepY, z: -HZ - 3.8 - distOffset });
    southBoxes.push({ w: 150 + distOffset * 2, h: stepH, d: 1.75, x: 0, y: stepY, z: HZ + 5.2 + distOffset });
    eastBoxes.push({ w: 1.75, h: stepH, d: 98 + distOffset * 2, x: HX + 4.8 + distOffset, y: stepY, z: 0 });
    westBoxes.push({ w: 1.75, h: stepH, d: 98 + distOffset * 2, x: -HX - 4.8 - distOffset, y: stepY, z: 0 });
  }

  for (let s = 0; s < stepsTier2; s++) {
    const stepY = 13.8 + s * 1.5;
    const distOffset = 13.5 + s * 1.72;
    northBoxes.push({ w: 176 + s * 3.8, h: 1.62, d: 1.9, x: 0, y: stepY, z: -HZ - 3.8 - distOffset });
    southBoxes.push({ w: 176 + s * 3.8, h: 1.62, d: 1.9, x: 0, y: stepY, z: HZ + 5.2 + distOffset });
    eastBoxes.push({ w: 1.9, h: 1.62, d: 124 + s * 3.8, x: HX + 4.8 + distOffset, y: stepY, z: 0 });
    westBoxes.push({ w: 1.9, h: 1.62, d: 124 + s * 3.8, x: -HX - 4.8 - distOffset, y: stepY, z: 0 });
  }

  for (let s = 0; s < stepsTier3; s++) {
    const stepY = 25.2 + s * 1.75;
    const distOffset = 25.0 + s * 1.95;
    northBoxes.push({ w: 204 + s * 4.2, h: 1.85, d: 2.1, x: 0, y: stepY, z: -HZ - 3.8 - distOffset });
    southBoxes.push({ w: 204 + s * 4.2, h: 1.85, d: 2.1, x: 0, y: stepY, z: HZ + 5.2 + distOffset });
    eastBoxes.push({ w: 2.1, h: 1.85, d: 152 + s * 4.2, x: HX + 4.8 + distOffset, y: stepY, z: 0 });
    westBoxes.push({ w: 2.1, h: 1.85, d: 152 + s * 4.2, x: -HX - 4.8 - distOffset, y: stepY, z: 0 });
  }

  // Merge each quadrant's 21 tier steps into 1 single draw call per sector (4 draw calls total for all 3 tiers!)
  northSector.add(new THREE.Mesh(mergeBoxBoxesToSingleGeometry(northBoxes), standMat));
  southSector.add(new THREE.Mesh(mergeBoxBoxesToSingleGeometry(southBoxes), standMat));
  eastSector.add(new THREE.Mesh(mergeBoxBoxesToSingleGeometry(eastBoxes), standMat));
  westSector.add(new THREE.Mesh(mergeBoxBoxesToSingleGeometry(westBoxes), standMat));

  // VIP Glass Ring & Fascia LED Ribbons
  const vipNorthWall = new THREE.Mesh(new THREE.BoxGeometry(176, 2.5, 2.2), vipGlassMat);
  vipNorthWall.position.set(0, 12.0, -HZ - 16.5);
  const vipNorthFascia = new THREE.Mesh(new THREE.BoxGeometry(177, 0.95, 0.5), adMat);
  vipNorthFascia.position.set(0, 13.2, -HZ - 15.3);
  const upperFasciaN = new THREE.Mesh(new THREE.BoxGeometry(204, 1.3, 0.6), tierRedWallMat);
  upperFasciaN.position.set(0, 24.0, -HZ - 28.0);
  northSector.add(vipNorthWall, vipNorthFascia, upperFasciaN);

  const vipEastWall = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.5, 124), vipGlassMat);
  vipEastWall.position.set(HX + 17.5, 12.0, 0);
  const vipEastFascia = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.95, 125), adMat);
  vipEastFascia.position.set(HX + 16.3, 13.2, 0);
  const upperFasciaE = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.3, 152), tierRedWallMat);
  upperFasciaE.position.set(HX + 29.0, 24.0, 0);
  eastSector.add(vipEastWall, vipEastFascia, upperFasciaE);

  const vipWestWall = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.5, 124), vipGlassMat);
  vipWestWall.position.set(-HX - 17.5, 12.0, 0);
  const vipWestFascia = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.95, 125), adMat);
  vipWestFascia.position.set(-HX - 16.3, 13.2, 0);
  const upperFasciaW = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.3, 152), tierRedWallMat);
  upperFasciaW.position.set(-HX - 29.0, 24.0, 0);
  westSector.add(vipWestWall, vipWestFascia, upperFasciaW);

  // Flush Stairway Aisles & Vomitory Tunnels on North Stand
  for (const ax of [-44, -12, 20, 52]) {
    const tunnel = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.4, 1.8), darkTunnelMat);
    tunnel.position.set(ax, 4.2, -HZ - 7.0);
    const stair = new THREE.Mesh(new THREE.BoxGeometry(2.2, 9.5, 11.5), aisleMat);
    stair.position.set(ax, 5.2, -HZ - 9.2);
    northSector.add(tunnel, stair);
  }

  // Giant 3D Stadium Jumbotron Scoreboards (North Center + East & West Goal Ends)
  const { texture: jumboTex, updateScoreboard: updateJumbotron } = createDynamicJumbotron(
    homeTeam,
    awayTeam
  );
  const jumboMat = new THREE.MeshBasicMaterial({ map: jumboTex });
  const northJumbo = new THREE.Mesh(new THREE.BoxGeometry(26, 8.8, 1.2), jumboMat);
  northJumbo.position.set(0, 38.5, -HZ - 41.5);
  northSector.add(northJumbo);

  const eastJumbo = new THREE.Mesh(new THREE.BoxGeometry(1.2, 8.2, 24), jumboMat);
  eastJumbo.position.set(HX + 41.5, 37.5, 0);
  eastSector.add(eastJumbo);

  const westJumbo = new THREE.Mesh(new THREE.BoxGeometry(1.2, 8.2, 24), jumboMat);
  westJumbo.position.set(-HX - 41.5, 37.5, 0);
  westSector.add(westJumbo);

  // Monumental Perimeter Roof Overhangs (41.2m elevation)
  const nRoof = new THREE.Mesh(new THREE.BoxGeometry(246, 1.2, 28), roofMat);
  nRoof.position.set(0, 41.2, -HZ - 35.5);
  nRoof.rotation.x = 0.08;
  northSector.add(nRoof);

  const sRoof = new THREE.Mesh(new THREE.BoxGeometry(246, 1.2, 26), roofMat);
  sRoof.position.set(0, 41.2, HZ + 39.5);
  sRoof.rotation.x = -0.08;
  southSector.add(sRoof);

  const wRoof = new THREE.Mesh(new THREE.BoxGeometry(28, 1.2, 192), roofMat);
  wRoof.position.set(-HX - 35.5, 41.2, 0);
  wRoof.rotation.z = -0.08;
  westSector.add(wRoof);

  const eRoof = new THREE.Mesh(new THREE.BoxGeometry(28, 1.2, 192), roofMat);
  eRoof.position.set(HX + 35.5, 41.2, 0);
  eRoof.rotation.z = 0.08;
  eastSector.add(eRoof);

  const trussMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.55,
    roughness: 0.35,
  });
  const ledFasciaMat = new THREE.MeshBasicMaterial({
    color: stadiumThemeId === 'stadium_neon_arena' ? 0x38bdf8 : 0xfef08a,
  });
  const frontBeam = new THREE.Mesh(new THREE.BoxGeometry(236, 0.75, 0.75), trussMat);
  frontBeam.position.set(0, 40.0, -HZ - 21.8);
  const ledRibbon = new THREE.Mesh(new THREE.BoxGeometry(234, 0.36, 0.34), ledFasciaMat);
  ledRibbon.position.set(0, 39.5, -HZ - 21.4);
  northSector.add(frontBeam, ledRibbon);

  // 4. 6 MONUMENTAL FLOODLIGHT TOWERS WITH 3-LEVEL LOD (LOD0, LOD1, LOD2 by distance)
  const towerMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.4 });
  const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xfef9c3 });

  // Shared LOD geometries for the 6 Floodlight Towers (58m tall)
  const towerMastLod0 = new THREE.CylinderGeometry(0.75, 1.35, 58, 12);
  const towerRingLod0 = new THREE.CylinderGeometry(1.65, 1.65, 1.2, 10);
  const lampHeadLod0 = new THREE.BoxGeometry(10.4, 5.2, 1.6);
  const lampVisorLod0 = new THREE.BoxGeometry(10.8, 0.45, 2.2);

  const towerMastLod1 = new THREE.CylinderGeometry(0.8, 1.35, 58, 6);
  const lampHeadLod1 = new THREE.BoxGeometry(10.2, 5.0, 1.4);

  const towerMastLod2 = new THREE.BoxGeometry(1.4, 58, 1.4);
  const lampHeadLod2 = new THREE.BoxGeometry(9.8, 4.8, 1.0);

  // 6 Towers: 4 Corners + 2 Midfield North/South Towers
  const towerCoords: [number, number, THREE.Group][] = [
    [-112, -82, northSector],
    [0, -90, northSector],
    [112, -82, northSector],
    [-112, 84, southSector],
    [0, 92, southSector],
    [112, 84, southSector],
  ];
  const towerLodObjects: THREE.LOD[] = [];

  for (const [tx, tz, sectorGrp] of towerCoords) {
    const lod = new THREE.LOD();
    lod.position.set(tx, 0, tz);

    // LOD 0 (0 - 155m): Detailed steel column + structural support rings + multi-panel LED head & visor
    const g0 = new THREE.Group();
    const mast0 = new THREE.Mesh(towerMastLod0, towerMat);
    mast0.position.y = 29;
    const ringA = new THREE.Mesh(towerRingLod0, trussMat);
    ringA.position.y = 22;
    const ringB = new THREE.Mesh(towerRingLod0, trussMat);
    ringB.position.y = 42;
    const head0 = new THREE.Mesh(lampHeadLod0, lampHeadMat);
    head0.position.y = 58;
    head0.lookAt(0 - tx, 0, 0 - tz);
    const visor0 = new THREE.Mesh(lampVisorLod0, trussMat);
    visor0.position.y = 60.7;
    visor0.lookAt(0 - tx, 0, 0 - tz);
    g0.add(mast0, ringA, ringB, head0, visor0);

    // LOD 1 (155 - 260m): Medium detail
    const g1 = new THREE.Group();
    const mast1 = new THREE.Mesh(towerMastLod1, towerMat);
    mast1.position.y = 29;
    const head1 = new THREE.Mesh(lampHeadLod1, lampHeadMat);
    head1.position.y = 58;
    head1.lookAt(0 - tx, 0, 0 - tz);
    g1.add(mast1, head1);

    // LOD 2 (> 260m): Ultra-low-poly silhouette
    const g2 = new THREE.Group();
    const mast2 = new THREE.Mesh(towerMastLod2, towerMat);
    mast2.position.y = 29;
    const head2 = new THREE.Mesh(lampHeadLod2, lampHeadMat);
    head2.position.y = 58;
    g2.add(mast2, head2);

    lod.addLevel(g0, 0);
    lod.addLevel(g1, 155);
    lod.addLevel(g2, 260);
    sectorGrp.add(lod);
    towerLodObjects.push(lod);
  }

  // 5. EXTERIOR CITY SKYLINE & ESPLANADE (Visible from high/panoramic views, 1 single merged draw call!)
  const cityBoxes: { w: number; h: number; d: number; x: number; y: number; z: number }[] = [
    // Outer Stadium Esplanade Plinths
    { w: 340, h: 0.6, d: 60, x: 0, y: -0.28, z: -135 },
    { w: 340, h: 0.6, d: 60, x: 0, y: -0.28, z: 138 },
    { w: 60, h: 0.6, d: 220, x: -155, y: -0.28, z: 0 },
    { w: 60, h: 0.6, d: 220, x: 155, y: -0.28, z: 0 },
  ];
  const cityRingCount = 32;
  for (let i = 0; i < cityRingCount; i++) {
    const angle = (i / cityRingCount) * Math.PI * 2;
    const radX = 215 + ((i * 37) % 55);
    const radZ = 175 + ((i * 29) % 50);
    const bx = Math.cos(angle) * radX;
    const bz = Math.sin(angle) * radZ;
    const bw = 18 + ((i * 13) % 18);
    const bd = 18 + ((i * 17) % 18);
    const bh = 22 + ((i * 41) % 54);
    cityBoxes.push({ w: bw, h: bh, d: bd, x: bx, y: bh / 2, z: bz });
  }
  const cityMat = getSharedLambertMaterial(0x1e293b);
  const cityMesh = new THREE.Mesh(mergeBoxBoxesToSingleGeometry(cityBoxes), cityMat);
  citySector.add(cityMesh);

  // 6. GPU-INSTANCED CROWD WITH VERTEX-SHADER ANIMATION + DISTANT BILLBOARDS (80,000 Virtual Capacity)
  const nearSeats: { x: number; y: number; z: number }[] = [];
  const billboardSeats: { x: number; y: number; z: number }[] = [];
  const colStep = isSoftwareGl || quality === 'baja' ? 2.1 : quality === 'media' ? 1.65 : 1.32;

  // Tier 1 & Tier 2 -> Near 3D GPU-Instanced Spectators
  for (let row = 0; row < stepsTier1; row++) {
    const y = 1.22 + row * 1.24;
    const zBase = -HZ - 3.7 - row * 1.55;
    for (let x = -72; x <= 72; x += colStep) {
      if (
        row < 5 &&
        (Math.abs(x) < 3.4 ||
          Math.abs(x - -44) < 1.3 ||
          Math.abs(x - -12) < 1.3 ||
          Math.abs(x - 20) < 1.3 ||
          Math.abs(x - 52) < 1.3)
      ) {
        continue;
      }
      nearSeats.push({
        x: x + ((row * 17) % 5) * 0.08,
        y,
        z: zBase + ((row * 13) % 3) * 0.08,
      });
    }
  }
  for (let row = 0; row < stepsTier1; row++) {
    const y = 1.22 + row * 1.24;
    const xBase = HX + 4.7 + row * 1.55;
    for (let z = -46; z <= 46; z += colStep) {
      nearSeats.push({ x: xBase, y, z });
      nearSeats.push({ x: -xBase, y, z });
    }
  }
  const upperColStep = colStep * 1.45;
  for (let row = 0; row < stepsTier2; row += 2) {
    const y = 14.4 + row * 1.5;
    const dist = 13.5 + row * 1.72;
    for (let x = -84; x <= 84; x += upperColStep) {
      nearSeats.push({ x, y, z: -HZ - 3.7 - dist });
    }
    for (let z = -58; z <= 58; z += upperColStep) {
      nearSeats.push({ x: HX + 4.7 + dist, y, z });
      nearSeats.push({ x: -HX - 4.7 - dist, y, z });
    }
  }

  // Tier 3 (Bandeja Alta Monumental & South Upper) -> Distant GPU Billboard Spectators (2 triangles per spectator)
  const bbStep = upperColStep * 1.15;
  for (let row = 0; row < stepsTier3; row += 2) {
    const y = 25.9 + row * 1.75;
    const dist = 25.0 + row * 1.95;
    for (let x = -98; x <= 98; x += bbStep) {
      billboardSeats.push({ x, y, z: -HZ - 3.7 - dist });
      billboardSeats.push({ x, y, z: HZ + 5.2 + dist });
    }
    for (let z = -70; z <= 70; z += bbStep) {
      billboardSeats.push({ x: HX + 4.7 + dist, y, z });
      billboardSeats.push({ x: -HX - 4.7 - dist, y, z });
    }
  }

  const crowdShaderCtrl: CrowdGpuShaderController = {
    uTime: { value: 0 },
    uWaveAmp: { value: 0.14 },
    uWaveSpeed: { value: 4.5 },
  };

  const attachCrowdVertexAnimation = (mat: THREE.MeshLambertMaterial) => {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uCrowdTime = crowdShaderCtrl.uTime;
      shader.uniforms.uCrowdWaveAmp = crowdShaderCtrl.uWaveAmp;
      shader.uniforms.uCrowdWaveSpeed = crowdShaderCtrl.uWaveSpeed;
      shader.vertexShader =
        `
        attribute float aInstancePhase;
        uniform float uCrowdTime;
        uniform float uCrowdWaveAmp;
        uniform float uCrowdWaveSpeed;
        ` +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `
          #include <begin_vertex>
          float jumpWave = max(0.0, sin(uCrowdTime * uCrowdWaveSpeed + aInstancePhase));
          transformed.y += jumpWave * uCrowdWaveAmp;
          `
        );
    };
  };

  // Near 3D Spectators InstancedMesh
  const nearCrowdCount = nearSeats.length;
  const specGeo = createSpectatorGeometry();
  const nearPhaseArr = new Float32Array(nearCrowdCount);
  for (let i = 0; i < nearCrowdCount; i++) {
    nearPhaseArr[i] = ((i * 37) % 100) * 0.0628;
  }
  specGeo.setAttribute('aInstancePhase', new THREE.InstancedBufferAttribute(nearPhaseArr, 1));

  const specMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  attachCrowdVertexAnimation(specMat);
  const crowdMesh = new THREE.InstancedMesh(specGeo, specMat, nearCrowdCount);
  crowdMesh.frustumCulled = false;

  // Distant Tier-3 Billboard Spectators InstancedMesh
  const billboardCrowdCount = billboardSeats.length;
  const bbGeo = new THREE.PlaneGeometry(0.68, 0.98);
  bbGeo.translate(0, 0.49, 0);
  const bbPhaseArr = new Float32Array(billboardCrowdCount);
  for (let i = 0; i < billboardCrowdCount; i++) {
    bbPhaseArr[i] = ((i * 53) % 100) * 0.0628;
  }
  bbGeo.setAttribute('aInstancePhase', new THREE.InstancedBufferAttribute(bbPhaseArr, 1));
  const bbMat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  attachCrowdVertexAnimation(bbMat);
  const crowdBillboardMesh = new THREE.InstancedMesh(bbGeo, bbMat, billboardCrowdCount);
  crowdBillboardMesh.frustumCulled = false;

  // Waving 3D Team Flags & Scarves with GPU Vertex-Shader Wave
  const flagCount = isSoftwareGl ? 42 : 84;
  const flagBannerGeo = new THREE.BoxGeometry(1.65, 0.96, 0.08, 4, 1, 1);
  const flagPhaseArr = new Float32Array(flagCount);
  for (let i = 0; i < flagCount; i++) {
    flagPhaseArr[i] = i * 0.85;
  }
  flagBannerGeo.setAttribute('aInstancePhase', new THREE.InstancedBufferAttribute(flagPhaseArr, 1));

  const flagBannerMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  flagBannerMat.onBeforeCompile = (shader) => {
    shader.uniforms.uCrowdTime = crowdShaderCtrl.uTime;
    shader.uniforms.uCrowdWaveAmp = crowdShaderCtrl.uWaveAmp;
    shader.uniforms.uCrowdWaveSpeed = crowdShaderCtrl.uWaveSpeed;
    shader.vertexShader =
      `
      attribute float aInstancePhase;
      uniform float uCrowdTime;
      uniform float uCrowdWaveAmp;
      uniform float uCrowdWaveSpeed;
      ` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        float clothWave = sin(uCrowdTime * (uCrowdWaveSpeed * 1.45) + aInstancePhase + position.x * 2.6);
        transformed.z += clothWave * (0.18 + uCrowdWaveAmp * 0.45);
        transformed.y += max(0.0, sin(uCrowdTime * uCrowdWaveSpeed + aInstancePhase)) * uCrowdWaveAmp;
        `
      );
  };
  const flagsMesh = new THREE.InstancedMesh(flagBannerGeo, flagBannerMat, flagCount);
  flagsMesh.frustumCulled = false;

  const dummy = new THREE.Object3D();
  const colorPalette = [
    new THREE.Color('#DC2626'),
    new THREE.Color('#E11D48'),
    new THREE.Color(homeTeam.primaryColor),
    new THREE.Color('#F8FAFC'),
    new THREE.Color('#1E293B'),
    new THREE.Color(homeTeam.secondaryColor),
    new THREE.Color('#FACC15'),
    new THREE.Color(awayTeam.primaryColor),
  ];

  const crowdBasePositions: { x: number; y: number; z: number; phase: number }[] = [];
  const flagBasePositions: { x: number; y: number; z: number; phase: number }[] = [];

  for (let i = 0; i < nearCrowdCount; i++) {
    const seat = nearSeats[i];
    const phase = nearPhaseArr[i];
    crowdBasePositions.push({ x: seat.x, y: seat.y, z: seat.z, phase });

    dummy.position.set(seat.x, seat.y, seat.z);
    dummy.lookAt(0, 1, 0);
    dummy.updateMatrix();
    crowdMesh.setMatrixAt(i, dummy.matrix);
    crowdMesh.setColorAt(i, colorPalette[(i * 7 + Math.floor(seat.y * 3)) % colorPalette.length]);
  }

  for (let i = 0; i < billboardCrowdCount; i++) {
    const seat = billboardSeats[i];
    dummy.position.set(seat.x, seat.y, seat.z);
    dummy.lookAt(0, 1.5, 0);
    dummy.updateMatrix();
    crowdBillboardMesh.setMatrixAt(i, dummy.matrix);
    crowdBillboardMesh.setColorAt(i, colorPalette[(i * 11 + Math.floor(seat.y * 2)) % colorPalette.length]);
  }

  for (let f = 0; f < flagCount; f++) {
    const baseSpec = crowdBasePositions[(f * 29) % crowdBasePositions.length];
    const fx = baseSpec.x;
    const fy = baseSpec.y + 1.18;
    const fz = baseSpec.z;
    const phase = flagPhaseArr[f];
    flagBasePositions.push({ x: fx, y: fy, z: fz, phase });

    dummy.position.set(fx, fy, fz);
    dummy.lookAt(0, 2, 0);
    dummy.updateMatrix();
    flagsMesh.setMatrixAt(f, dummy.matrix);
    flagsMesh.setColorAt(
      f,
      new THREE.Color(f % 3 === 0 ? homeTeam.primaryColor : f % 3 === 1 ? '#DC2626' : '#FFFFFF')
    );
  }

  crowdMesh.instanceMatrix.needsUpdate = true;
  if (crowdMesh.instanceColor) crowdMesh.instanceColor.needsUpdate = true;
  crowdBillboardMesh.instanceMatrix.needsUpdate = true;
  if (crowdBillboardMesh.instanceColor) crowdBillboardMesh.instanceColor.needsUpdate = true;
  flagsMesh.instanceMatrix.needsUpdate = true;
  if (flagsMesh.instanceColor) flagsMesh.instanceColor.needsUpdate = true;
  stadiumGroup.add(crowdMesh, crowdBillboardMesh, flagsMesh);

  // 7. Camera Flashes in the Stands
  const flashCount = isSoftwareGl ? 60 : 140;
  const flashPositions = new Float32Array(flashCount * 3);
  for (let i = 0; i < flashCount; i++) {
    const seat = crowdBasePositions[(i * 23) % crowdBasePositions.length];
    flashPositions[i * 3] = seat.x;
    flashPositions[i * 3 + 1] = seat.y + 1.05;
    flashPositions[i * 3 + 2] = seat.z;
  }
  const flashGeo = new THREE.BufferGeometry();
  flashGeo.setAttribute('position', new THREE.BufferAttribute(flashPositions, 3));
  const flashMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 1.65,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const cameraFlashes = new THREE.Points(flashGeo, flashMat);
  stadiumGroup.add(cameraFlashes);

  // Ultras Flares / Bengalas
  const flaresGroup = new THREE.Group();
  const flareSmokeGeo = new THREE.SphereGeometry(1.6, 8, 8);
  const flareSmokeMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
  });
  const flareCoreGeo = new THREE.SphereGeometry(0.32, 6, 6);
  const flareCoreMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

  const flareCoords = [
    [-52, 4.0, -HZ - 7.5],
    [52, 4.0, -HZ - 7.5],
    [-HX - 6.5, 4.2, -16],
    [HX + 6.5, 4.2, 16],
  ];
  for (const [fx, fy, fz] of flareCoords) {
    const smoke = new THREE.Mesh(flareSmokeGeo, flareSmokeMat);
    smoke.position.set(fx, fy, fz);
    const core = new THREE.Mesh(flareCoreGeo, flareCoreMat);
    core.position.set(fx, fy - 0.3, fz);
    flaresGroup.add(smoke, core);
  }
  stadiumGroup.add(flaresGroup);

  // Freeze all static stadium meshes so Three.js skips matrix multiplications per frame
  freezeStaticHierarchy(stadiumGroup);

  const cullableSectors: CullableStadiumSector[] = [
    { name: 'NorthStand', group: northSector, bounds: new THREE.Sphere(new THREE.Vector3(0, 22, -78), 145) },
    { name: 'SouthStand', group: southSector, bounds: new THREE.Sphere(new THREE.Vector3(0, 22, 82), 145) },
    { name: 'EastStand', group: eastSector, bounds: new THREE.Sphere(new THREE.Vector3(102, 22, 0), 115) },
    { name: 'WestStand', group: westSector, bounds: new THREE.Sphere(new THREE.Vector3(-102, 22, 0), 115) },
    { name: 'ExteriorCity', group: citySector, bounds: new THREE.Sphere(new THREE.Vector3(0, 25, 0), 360) },
  ];

  return {
    stadiumGroup,
    crowdMesh,
    crowdBillboardMesh,
    flagsMesh,
    flaresGroup,
    cameraFlashes,
    updateJumbotron,
    crowdBasePositions,
    flagBasePositions,
    cullableSectors,
    towerLodObjects,
    lampHeadMat,
    crowdShaderCtrl,
    nearCrowdCount,
    billboardCrowdCount,
  };
}

/**
 * Shared Pre-Allocated Player Rig Geometries (Zero duplicate BufferGeometry allocations across 25 players)
 */
const SHARED_PLAYER_GEOS = (() => {
  const shadowGeo = new THREE.PlaneGeometry(1.38, 1.38);
  shadowGeo.rotateX(-Math.PI / 2);

  const ringGeo = new THREE.RingGeometry(0.68, 0.84, 24);
  ringGeo.rotateX(-Math.PI / 2);

  const arrowGeo = new THREE.ConeGeometry(0.18, 0.36, 4);
  arrowGeo.rotateX(Math.PI / 2);

  const cursorGeo = new THREE.ConeGeometry(0.24, 0.48, 4);
  cursorGeo.rotateX(Math.PI);

  const chestGeo = new THREE.CylinderGeometry(0.245, 0.195, 0.54, 12);
  chestGeo.scale(1.04, 1, 0.72);

  const shoulderCapGeo = new THREE.SphereGeometry(0.105, 8, 8);

  const collarGeo = new THREE.TorusGeometry(0.095, 0.022, 6, 12);
  collarGeo.rotateX(Math.PI / 2);

  const pelvisGeo = new THREE.CylinderGeometry(0.195, 0.21, 0.24, 10);
  pelvisGeo.scale(1.02, 1, 0.76);

  const neckGeo = new THREE.CylinderGeometry(0.068, 0.078, 0.12, 8);

  const headGeo = new THREE.SphereGeometry(0.165, 12, 12);
  headGeo.scale(0.93, 1.07, 0.98);
  headGeo.rotateY(-Math.PI / 2);

  const noseGeo = new THREE.ConeGeometry(0.024, 0.055, 5);
  const earGeo = new THREE.SphereGeometry(0.032, 5, 5);
  earGeo.scale(0.5, 1.1, 0.8);

  const hairCapGeo = new THREE.SphereGeometry(0.172, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.58);
  hairCapGeo.scale(0.94, 1.06, 1.0);

  const quiffGeo = new THREE.BoxGeometry(0.16, 0.065, 0.12);
  const afroGeo = new THREE.SphereGeometry(0.195, 10, 8);
  const bunGeo = new THREE.SphereGeometry(0.06, 6, 6);
  const bandGeo = new THREE.CylinderGeometry(0.166, 0.166, 0.036, 10, 1, true);

  const sleeveGeo = new THREE.CylinderGeometry(0.076, 0.068, 0.22, 8);
  const cuffGeo = new THREE.CylinderGeometry(0.07, 0.069, 0.03, 8);
  const elbowGeo = new THREE.SphereGeometry(0.058, 6, 6);
  const forearmGeo = new THREE.CylinderGeometry(0.058, 0.044, 0.25, 8);
  const wristTapeGeo = new THREE.CylinderGeometry(0.046, 0.045, 0.04, 6);
  const handFieldGeo = new THREE.SphereGeometry(0.052, 6, 6);
  const handGkGeo = new THREE.SphereGeometry(0.078, 6, 6);
  const cardGeo = new THREE.BoxGeometry(0.12, 0.18, 0.02);

  const shortLegGeo = new THREE.CylinderGeometry(0.102, 0.096, 0.18, 8);
  const thighGeo = new THREE.CylinderGeometry(0.086, 0.072, 0.18, 8);
  const kneeGeo = new THREE.SphereGeometry(0.068, 6, 6);
  const sockBandGeo = new THREE.CylinderGeometry(0.072, 0.071, 0.04, 8);
  const sockGeo = new THREE.CylinderGeometry(0.071, 0.052, 0.27, 8);
  const ankleTapeGeo = new THREE.CylinderGeometry(0.054, 0.054, 0.04, 6);

  const bootVampGeo = new THREE.CapsuleGeometry(0.055, 0.15, 4, 8);
  bootVampGeo.rotateX(Math.PI / 2);
  bootVampGeo.scale(1.05, 0.78, 1.0);
  const soleGeo = new THREE.BoxGeometry(0.105, 0.022, 0.25);

  return {
    shadowGeo,
    ringGeo,
    arrowGeo,
    cursorGeo,
    chestGeo,
    shoulderCapGeo,
    collarGeo,
    pelvisGeo,
    neckGeo,
    headGeo,
    noseGeo,
    earGeo,
    hairCapGeo,
    quiffGeo,
    afroGeo,
    bunGeo,
    bandGeo,
    sleeveGeo,
    cuffGeo,
    elbowGeo,
    forearmGeo,
    wristTapeGeo,
    handFieldGeo,
    handGkGeo,
    cardGeo,
    shortLegGeo,
    thighGeo,
    kneeGeo,
    sockBandGeo,
    sockGeo,
    ankleTapeGeo,
    bootVampGeo,
    soleGeo,
  };
})();

const SHARED_TAPE_MAT = new THREE.MeshBasicMaterial({ color: 0xffffff });
const SHARED_SOLE_MAT = new THREE.MeshBasicMaterial({ color: 0x0f172a });
const SHARED_GLOVE_MAT = new THREE.MeshLambertMaterial({ color: 0xf8fafc });

/**
 * Builds an anatomical, sculpted 3D human football player model using shared geometries
 * for maximum WebGL rendering throughput.
 */
function createPlayerRig3D(
  id: string,
  side: 'home' | 'away',
  isGk: boolean,
  squadNumber: number,
  team: Team,
  kitSelection: KitSelection,
  shadowTex: THREE.Texture,
  castShadows: boolean,
  customRole?: 'referee' | 'coach',
  heightCm = 180,
  bodyBuild: 'delgado' | 'atletico' | 'robusto' = 'atletico',
  retroKitId = 'kit_default',
  playerName = '',
  aspecto?: PlayerAppearance
): PlayerRig3D {
  const root = new THREE.Group();
  const h = hashString(id);
  const skinColor = parseHexToInt(aspecto?.tonoPiel, SKIN_TONES[h % SKIN_TONES.length]);
  const hairColor = parseHexToInt(aspecto?.colorPelo, HAIR_TONES[(h >> 3) % HAIR_TONES.length]);
  const bootColor = customRole
    ? 0x111827
    : parseHexToInt(aspecto?.colorBotines, BOOT_COLORS[(h >> 5) % BOOT_COLORS.length]);
  const effectiveHeightCm = aspecto?.alturaCm ?? heightCm;

  // 1. Contact Ground Shadow + Subtle Active Ring + EA SPORTS FC Overhead 3D Red Triangle Cursor (▼)
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  const contactShadow = new THREE.Mesh(SHARED_PLAYER_GEOS.shadowGeo, shadowMat);
  contactShadow.position.y = 0.015;
  freezeStaticMesh(contactShadow);
  root.add(contactShadow);

  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const activeRing = new THREE.Mesh(SHARED_PLAYER_GEOS.ringGeo, ringMat);
  activeRing.position.y = 0.024;
  activeRing.visible = false;
  root.add(activeRing);

  const arrowMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.75 });
  const directionArrow = new THREE.Mesh(SHARED_PLAYER_GEOS.arrowGeo, arrowMat);
  directionArrow.position.set(0, 0.04, 1.02);
  directionArrow.visible = false;
  freezeStaticMesh(directionArrow);
  root.add(directionArrow);

  // EA SPORTS FC Overhead 3D Inverted Red Triangle Indicator (▼)
  const cursorMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
  });
  const overheadCursor = new THREE.Mesh(SHARED_PLAYER_GEOS.cursorGeo, cursorMat);
  overheadCursor.position.set(0, 2.35, 0);
  overheadCursor.visible = false;
  root.add(overheadCursor);

  // 2. Anatomical Body Group with Realistic Proportioned Scale (0.95x) so the 105x68m pitch feels vast and open
  const bodyGroup = new THREE.Group();
  const broadcastAthleteScale = 0.95;
  const scaleY =
    Math.max(0.86, Math.min(1.16, Math.pow(effectiveHeightCm / 180, 1.35))) * broadcastAthleteScale;
  const scaleXZ =
    (bodyBuild === 'robusto' ? 1.09 : bodyBuild === 'delgado' ? 0.94 : 1.0) * broadcastAthleteScale;
  bodyGroup.scale.set(scaleXZ, scaleY, scaleXZ);
  root.add(bodyGroup);

  const kitColors = resolveTeamKitColors(team, kitSelection, retroKitId, side === 'home');
  const skinMat = getSharedLambertMaterial(skinColor);
  const hairMat = getSharedLambertMaterial(hairColor);

  let torsoMat: THREE.Material;
  let shortsMat: THREE.Material;
  let sockMat: THREE.Material;
  let collarColorHex = kitColors.secondary;

  if (customRole === 'referee') {
    torsoMat = getSharedLambertMaterial(0xd9f938);
    shortsMat = getSharedLambertMaterial(0x0f172a);
    sockMat = getSharedLambertMaterial(0x0f172a);
    collarColorHex = '#0F172A';
  } else if (customRole === 'coach') {
    torsoMat = getSharedLambertMaterial(0x1e293b);
    shortsMat = getSharedLambertMaterial(0x0f172a);
    sockMat = getSharedLambertMaterial(0x0f172a);
    collarColorHex = '#F8FAFC';
  } else {
    const jerseyTex = createJerseyTexture(
      kitColors.primary,
      kitColors.secondary,
      kitColors.pattern,
      squadNumber,
      isGk,
      playerName
    );
    torsoMat = new THREE.MeshLambertMaterial({ map: jerseyTex });
    shortsMat = getSharedLambertMaterial(isGk ? '#F59E0B' : kitColors.shorts);
    sockMat = getSharedLambertMaterial(
      isGk ? '#F59E0B' : kitColors.shorts === '#FFFFFF' ? '#FFFFFF' : kitColors.primary
    );
  }

  const collarMat = getSharedLambertMaterial(collarColorHex);
  const bootMat = getSharedLambertMaterial(bootColor);

  // Sculpted Athletic Upper Torso
  const chestMesh = new THREE.Mesh(SHARED_PLAYER_GEOS.chestGeo, torsoMat);
  chestMesh.position.set(0, 1.15, 0);
  chestMesh.castShadow = castShadows;
  freezeStaticMesh(chestMesh);
  bodyGroup.add(chestMesh);

  // Sculpted Shoulder Deltoid Caps & Jersey Collar Ring
  const leftShoulder = new THREE.Mesh(SHARED_PLAYER_GEOS.shoulderCapGeo, torsoMat);
  leftShoulder.position.set(-0.23, 1.37, 0);
  freezeStaticMesh(leftShoulder);
  const rightShoulder = new THREE.Mesh(SHARED_PLAYER_GEOS.shoulderCapGeo, torsoMat);
  rightShoulder.position.set(0.23, 1.37, 0);
  freezeStaticMesh(rightShoulder);

  const collarMesh = new THREE.Mesh(SHARED_PLAYER_GEOS.collarGeo, collarMat);
  collarMesh.position.set(0, 1.43, 0.01);
  freezeStaticMesh(collarMesh);
  bodyGroup.add(leftShoulder, rightShoulder, collarMesh);

  // Sculpted Pelvis & Tailored Shorts
  const pelvisMesh = new THREE.Mesh(SHARED_PLAYER_GEOS.pelvisGeo, shortsMat);
  pelvisMesh.position.set(0, 0.78, 0);
  pelvisMesh.castShadow = castShadows;
  freezeStaticMesh(pelvisMesh);
  bodyGroup.add(pelvisMesh);

  // 3. Defined Neck, Sculpted Head with Facial Texture & 9 3D Hairstyles (PlayerAppearance.peinado)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.56, 0);

  const neckMesh = new THREE.Mesh(SHARED_PLAYER_GEOS.neckGeo, skinMat);
  neckMesh.position.set(0, -0.1, 0);
  freezeStaticMesh(neckMesh);
  headGroup.add(neckMesh);

  const faceTex = createPlayerFaceTexture(skinColor, hairColor, h, aspecto?.barba);
  const faceMat = new THREE.MeshLambertMaterial({
    map: faceTex,
  });

  const headMesh = new THREE.Mesh(SHARED_PLAYER_GEOS.headGeo, faceMat);
  freezeStaticMesh(headMesh);
  headGroup.add(headMesh);

  // Sculpted 3D Nose Tip & Ears
  const noseMesh = new THREE.Mesh(SHARED_PLAYER_GEOS.noseGeo, skinMat);
  noseMesh.rotation.x = Math.PI / 2;
  noseMesh.position.set(0, -0.01, 0.165);
  freezeStaticMesh(noseMesh);
  const leftEar = new THREE.Mesh(SHARED_PLAYER_GEOS.earGeo, skinMat);
  leftEar.position.set(-0.155, 0, 0);
  freezeStaticMesh(leftEar);
  const rightEar = new THREE.Mesh(SHARED_PLAYER_GEOS.earGeo, skinMat);
  rightEar.position.set(0.155, 0, 0);
  freezeStaticMesh(rightEar);
  headGroup.add(noseMesh, leftEar, rightEar);

  // 9 Distinct 3D Hairstyles based on PlayerAppearance.peinado
  const peinado: HairstyleType =
    aspecto?.peinado ??
    ((['corto', 'degradado', 'rulos', 'rodete', 'vincha'] as HairstyleType[])[(h >> 4) % 5]);

  if (peinado !== 'rapado') {
    const hairCap = new THREE.Mesh(SHARED_PLAYER_GEOS.hairCapGeo, hairMat);
    hairCap.position.y = 0.02;
    hairCap.rotation.x = -0.18;
    freezeStaticMesh(hairCap);
    headGroup.add(hairCap);
  }

  if (peinado === 'degradado' || peinado === 'corto') {
    const quiff = new THREE.Mesh(SHARED_PLAYER_GEOS.quiffGeo, hairMat);
    quiff.position.set(0, 0.155, 0.075);
    quiff.rotation.x = -0.22;
    if (peinado === 'corto') quiff.scale.set(0.85, 0.65, 0.85);
    freezeStaticMesh(quiff);
    headGroup.add(quiff);
  } else if (peinado === 'afro' || peinado === 'rulos') {
    const afro = new THREE.Mesh(SHARED_PLAYER_GEOS.afroGeo, hairMat);
    afro.position.set(0, 0.055, -0.02);
    if (peinado === 'rulos') afro.scale.set(0.92, 0.88, 0.92);
    freezeStaticMesh(afro);
    headGroup.add(afro);
  } else if (peinado === 'rodete') {
    const bun = new THREE.Mesh(SHARED_PLAYER_GEOS.bunGeo, hairMat);
    bun.position.set(0, 0.17, -0.13);
    freezeStaticMesh(bun);
    headGroup.add(bun);
  } else if (peinado === 'vincha' || peinado === 'largo') {
    const bandMesh = new THREE.Mesh(SHARED_PLAYER_GEOS.bandGeo, collarMat);
    bandMesh.position.y = 0.065;
    freezeStaticMesh(bandMesh);
    headGroup.add(bandMesh);
    if (peinado === 'largo') {
      const backHair = new THREE.Mesh(SHARED_PLAYER_GEOS.afroGeo, hairMat);
      backHair.scale.set(0.84, 0.95, 0.85);
      backHair.position.set(0, -0.02, -0.07);
      freezeStaticMesh(backHair);
      headGroup.add(backHair);
    }
  } else if (peinado === 'trenzas') {
    const braids = new THREE.Mesh(SHARED_PLAYER_GEOS.afroGeo, hairMat);
    braids.scale.set(0.88, 0.82, 0.98);
    braids.position.set(0, 0.02, -0.05);
    freezeStaticMesh(braids);
    headGroup.add(braids);
  }

  bodyGroup.add(headGroup);

  // 4. Left & Right Articulated Arms
  let cardMesh: THREE.Mesh | undefined;
  const buildArm = (xOffset: number, isRight: boolean): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(xOffset, 1.36, 0);

    const sleeve = new THREE.Mesh(SHARED_PLAYER_GEOS.sleeveGeo, torsoMat);
    sleeve.position.y = -0.11;
    freezeStaticMesh(sleeve);

    const cuff = new THREE.Mesh(SHARED_PLAYER_GEOS.cuffGeo, collarMat);
    cuff.position.y = -0.21;
    freezeStaticMesh(cuff);

    const elbow = new THREE.Mesh(
      SHARED_PLAYER_GEOS.elbowGeo,
      customRole === 'coach' || isGk ? torsoMat : skinMat
    );
    elbow.position.y = -0.23;
    freezeStaticMesh(elbow);

    const forearm = new THREE.Mesh(
      SHARED_PLAYER_GEOS.forearmGeo,
      customRole === 'coach' ? torsoMat : skinMat
    );
    forearm.position.y = -0.35;
    freezeStaticMesh(forearm);

    const wristTape = new THREE.Mesh(SHARED_PLAYER_GEOS.wristTapeGeo, SHARED_TAPE_MAT);
    wristTape.position.y = -0.46;
    freezeStaticMesh(wristTape);

    const hand = new THREE.Mesh(
      isGk ? SHARED_PLAYER_GEOS.handGkGeo : SHARED_PLAYER_GEOS.handFieldGeo,
      isGk ? SHARED_GLOVE_MAT : skinMat
    );
    hand.scale.set(0.85, 1.15, 0.65);
    hand.position.y = -0.51;
    freezeStaticMesh(hand);

    pivot.add(sleeve, cuff, elbow, forearm, wristTape, hand);

    if (customRole === 'referee' && isRight) {
      const cMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
      cardMesh = new THREE.Mesh(SHARED_PLAYER_GEOS.cardGeo, cMat);
      cardMesh.position.set(0, -0.62, 0.04);
      cardMesh.visible = false;
      freezeStaticMesh(cardMesh);
      pivot.add(cardMesh);
    }

    return pivot;
  };
  const leftArmPivot = buildArm(-0.29, false);
  const rightArmPivot = buildArm(0.29, true);
  bodyGroup.add(leftArmPivot, rightArmPivot);

  // 5. Left & Right Articulated Legs
  const buildLeg = (xOffset: number): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(xOffset, 0.68, 0);

    const shortLeg = new THREE.Mesh(SHARED_PLAYER_GEOS.shortLegGeo, shortsMat);
    shortLeg.position.y = -0.08;
    freezeStaticMesh(shortLeg);

    const thigh = new THREE.Mesh(
      SHARED_PLAYER_GEOS.thighGeo,
      customRole === 'coach' ? shortsMat : skinMat
    );
    thigh.position.y = -0.22;
    freezeStaticMesh(thigh);

    const knee = new THREE.Mesh(
      SHARED_PLAYER_GEOS.kneeGeo,
      customRole === 'coach' ? shortsMat : skinMat
    );
    knee.position.y = -0.31;
    freezeStaticMesh(knee);

    const sockBand = new THREE.Mesh(SHARED_PLAYER_GEOS.sockBandGeo, collarMat);
    sockBand.position.y = -0.35;
    freezeStaticMesh(sockBand);

    const sock = new THREE.Mesh(SHARED_PLAYER_GEOS.sockGeo, sockMat);
    sock.position.y = -0.48;
    freezeStaticMesh(sock);

    const ankleTape = new THREE.Mesh(SHARED_PLAYER_GEOS.ankleTapeGeo, SHARED_TAPE_MAT);
    ankleTape.position.y = -0.59;
    freezeStaticMesh(ankleTape);

    const bootGroup = new THREE.Group();
    bootGroup.position.set(0, -0.63, 0.045);

    const bootVamp = new THREE.Mesh(SHARED_PLAYER_GEOS.bootVampGeo, bootMat);
    freezeStaticMesh(bootVamp);
    const soleMesh = new THREE.Mesh(SHARED_PLAYER_GEOS.soleGeo, SHARED_SOLE_MAT);
    soleMesh.position.y = -0.038;
    freezeStaticMesh(soleMesh);

    bootGroup.add(bootVamp, soleMesh);
    freezeStaticMesh(bootGroup);

    pivot.add(shortLeg, thigh, knee, sockBand, sock, ankleTape, bootGroup);
    return pivot;
  };
  const leftLegPivot = buildLeg(-0.125);
  const rightLegPivot = buildLeg(0.125);
  bodyGroup.add(leftLegPivot, rightLegPivot);

  return {
    id,
    side,
    isGk,
    root,
    bodyGroup,
    headGroup,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    contactShadow,
    activeRing,
    overheadCursor,
    directionArrow,
    cardMesh,
    baseScaleY: scaleY,
    baseScaleXZ: scaleXZ,
  };
}

function animateCoachRig(rig: PlayerRig3D, mood: CoachMood, nowMs: number, dt: number, baseX: number): void {
  const paceOffset = mood === 'protest' ? Math.sin(nowMs * 0.004) * 1.4 : Math.sin(nowMs * 0.0015) * 0.6;
  rig.root.position.set(baseX + paceOffset, 0, -WORLD_PITCH.HALF_Z - 1.4);
  rig.root.rotation.y = 0; // face the pitch (+Z)

  let targetY = 0;
  let targetPitch = 0;
  let targetLArmX = 0;
  let targetRArmX = 0;
  let targetLArmZ = 0;
  let targetRArmZ = 0;

  if (mood === 'celebrate') {
    targetY = Math.abs(Math.sin(nowMs * 0.011)) * 0.42;
    targetLArmX = -Math.PI * 0.85;
    targetRArmX = -Math.PI * 0.85;
  } else if (mood === 'protest') {
    targetPitch = 0.15;
    targetLArmX = -0.75 + Math.sin(nowMs * 0.015) * 0.35;
    targetRArmX = -0.75 - Math.sin(nowMs * 0.015) * 0.35;
    targetLArmZ = -0.45;
    targetRArmZ = 0.45;
  } else if (mood === 'despair') {
    targetY = -0.18;
    targetPitch = 0.32;
    targetLArmX = -Math.PI * 0.72;
    targetRArmX = -Math.PI * 0.72;
  } else {
    targetRArmX = -0.85 + Math.sin(nowMs * 0.006) * 0.25;
    targetLArmX = 0.15;
  }

  const k = 10;
  rig.bodyGroup.position.y = THREE.MathUtils.damp(rig.bodyGroup.position.y, targetY, k, dt);
  rig.bodyGroup.rotation.x = THREE.MathUtils.damp(rig.bodyGroup.rotation.x, targetPitch, k, dt);
  rig.leftArmPivot.rotation.x = THREE.MathUtils.damp(rig.leftArmPivot.rotation.x, targetLArmX, k, dt);
  rig.rightArmPivot.rotation.x = THREE.MathUtils.damp(rig.rightArmPivot.rotation.x, targetRArmX, k, dt);
  rig.leftArmPivot.rotation.z = THREE.MathUtils.damp(rig.leftArmPivot.rotation.z, targetLArmZ, k, dt);
  rig.rightArmPivot.rotation.z = THREE.MathUtils.damp(rig.rightArmPivot.rotation.z, targetRArmZ, k, dt);
}

export const STADIUM_PITCH_3D_SIZE = {
  width: 1200,
  depth: 800,
} as const;

export function createMatchScene3D(
  mountEl: HTMLElement,
  homeTeam: Team,
  awayTeam: Team,
  homeKit: KitSelection,
  awayKit: KitSelection,
  settings: GameSettings,
  equippedOptions?: {
    ballId?: string;
    retroKitId?: string;
    stadiumThemeId?: string;
  }
): MatchScene3DController {
  // 1. WebGLRenderer setup + Software WebGL detection
  const probeCanvas = document.createElement('canvas');
  const probeGl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
  const dbg = probeGl?.getExtension('WEBGL_debug_renderer_info');
  const unmaskedRenderer = dbg && probeGl ? String(probeGl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
  probeGl?.getExtension('WEBGL_lose_context')?.loseContext();
  const isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(unmaskedRenderer);

  const quality = settings.visual.quality;
  // Single directional light shadow map for players and ball (enabled on Alta/Ultra when hardware GPU is active)
  const enableShadows = !isSoftwareGl && settings.visual.shadows && (quality === 'alta' || quality === 'ultra');

  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl && (quality === 'alta' || quality === 'ultra'),
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const maxDpr =
    isSoftwareGl || quality === 'baja' ? 1.0 : quality === 'media' ? 1.15 : quality === 'alta' ? 1.25 : 1.5;
  const baseDevicePixelRatio = Math.min(window.devicePixelRatio || 1, maxDpr);
  renderer.setPixelRatio(baseDevicePixelRatio);
  renderer.setSize(mountEl.clientWidth || 1280, mountEl.clientHeight || 720);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure =
    settings.match.timeOfDay === 'dia' ? 1.08 : settings.match.timeOfDay === 'atardecer' ? 1.04 : 1.06;
  renderer.shadowMap.enabled = enableShadows;
  if (enableShadows) {
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  mountEl.innerHTML = '';
  renderer.domElement.setAttribute('data-testid', 'match-canvas');
  renderer.domElement.className = 'block w-full h-full';
  mountEl.appendChild(renderer.domElement);

  // 2. Scene, Sky, Baked Lightmap/LightProbe Simulation & Single Dynamic Directional Light
  const scene = new THREE.Scene();
  const isFoggy = settings.match.weather === 'neblina';
  let activeTimeOfDay: GameSettings['match']['timeOfDay'] = settings.match.timeOfDay;
  const skyColor = isFoggy
    ? 0x334155
    : activeTimeOfDay === 'dia'
    ? 0x1a2636
    : activeTimeOfDay === 'atardecer'
    ? 0x2a1810
    : 0x090e17;
  scene.background = new THREE.Color(skyColor);
  const sceneFog = new THREE.FogExp2(skyColor, isFoggy ? 0.0052 : 0.0011);
  scene.fog = sceneFog;

  if (!isSoftwareGl && (quality === 'alta' || quality === 'ultra')) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  }

  // Baked GI / Light Probe Spherical Harmonics approximation + Single Dynamic Directional Light
  const ambientLight = new THREE.AmbientLight(
    0xffffff,
    activeTimeOfDay === 'noche' ? 0.62 : 0.74
  );
  scene.add(ambientLight);

  const hemiLight = new THREE.HemisphereLight(
    activeTimeOfDay === 'atardecer' ? 0xfed7aa : 0xf0f9ff,
    0x14532d,
    activeTimeOfDay === 'noche' ? 0.72 : 0.85
  );
  hemiLight.position.set(0, 60, 0);
  scene.add(hemiLight);

  const mainLight = new THREE.DirectionalLight(
    activeTimeOfDay === 'atardecer' ? 0xfdba74 : 0xfffbeb,
    activeTimeOfDay === 'noche' ? 1.95 : 2.15
  );
  mainLight.position.set(32, 62, 42);
  if (enableShadows) {
    mainLight.castShadow = true;
    const shadowRes = quality === 'ultra' ? 1024 : 512;
    mainLight.shadow.mapSize.width = shadowRes;
    mainLight.shadow.mapSize.height = shadowRes;
    mainLight.shadow.camera.near = 10;
    mainLight.shadow.camera.far = 190;
    mainLight.shadow.camera.left = -76;
    mainLight.shadow.camera.right = 76;
    mainLight.shadow.camera.top = 52;
    mainLight.shadow.camera.bottom = -52;
    mainLight.shadow.bias = -0.0005;
  }
  scene.add(mainLight);

  // 3. Wide Broadcast TV Camera Setup (41 deg FOV, far=1000 so 140x90m pitch & 80k stadium + exterior city never clip)
  const camera = new THREE.PerspectiveCamera(
    41,
    (mountEl.clientWidth || 1280) / (mountEl.clientHeight || 720),
    0.5,
    1000
  );
  camera.position.set(0, 21.8, 48.2);
  camera.lookAt(0, 0.85, -5.5);

  // 4. SINGLE-PLANE 140 x 90 m PITCH WITH CUSTOM GLSL MOWING & VARIATION SHADER (Optimization #1)
  const apronGeo = new THREE.PlaneGeometry(STADIUM_PITCH_3D_SIZE.width, STADIUM_PITCH_3D_SIZE.depth, 1, 1);
  apronGeo.rotateX(-Math.PI / 2);
  const apronMat = getSharedLambertMaterial(0x1e4619);
  const apronMesh = new THREE.Mesh(apronGeo, apronMat);
  apronMesh.position.y = -0.025;
  freezeStaticMesh(apronMesh);
  scene.add(apronMesh);

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const { colorMap: turfMap, bumpMap: turfBump } = createTurfTextures(
    homeTeam.stadium.turfTone,
    isSoftwareGl,
    maxAniso
  );
  // Single quad plane (1x1 segments = 2 triangles, 1 draw call, zero modeled grass blades)
  const pitchGeo = new THREE.PlaneGeometry(WORLD_PITCH.LENGTH + 8.5, WORLD_PITCH.WIDTH + 7.5, 1, 1);
  pitchGeo.rotateX(-Math.PI / 2);
  const pitchMat = new THREE.MeshStandardMaterial({
    map: turfMap,
    bumpMap: turfBump,
    bumpScale: 0.032,
    roughness:
      settings.match.weather === 'tormenta'
        ? 0.44
        : settings.match.weather === 'lluvia'
        ? 0.52
        : 0.84,
    metalness: settings.match.weather === 'lluvia' || settings.match.weather === 'tormenta' ? 0.04 : 0.01,
  });

  // Custom GLSL Mowing Stripes & Organic Macro/Micro Turf Variation Shader on the Single Plane
  pitchMat.onBeforeCompile = (shader) => {
    shader.vertexShader =
      `varying vec3 vPitchWorldPos;\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vPitchWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        `
      );
    shader.fragmentShader =
      `varying vec3 vPitchWorldPos;\n` +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>
        float stripeX = smoothstep(-0.15, 0.15, sin(vPitchWorldPos.x * 0.4039));
        float stripeZ = smoothstep(-0.2, 0.2, cos(vPitchWorldPos.z * 0.349));
        float macroNoise = sin(vPitchWorldPos.x * 0.09 + vPitchWorldPos.z * 0.11) * 0.5 + 0.5;
        vec3 freshBladeTint = vec3(1.045, 1.06, 0.98);
        vec3 deepCutTint = vec3(0.935, 0.96, 0.94);
        diffuseColor.rgb *= mix(deepCutTint, freshBladeTint, stripeX * 0.72 + stripeZ * 0.16 + macroNoise * 0.12);
        `
      );
  };

  const pitchMesh = new THREE.Mesh(pitchGeo, pitchMat);
  pitchMesh.receiveShadow = enableShadows;
  freezeStaticMesh(pitchMesh);
  scene.add(pitchMesh);

  const markingsGroup = createPitchMarkingsGroup();
  freezeStaticHierarchy(markingsGroup);
  scene.add(markingsGroup);

  // 5. 3D Goals & Nets (at ±70m on the 140x90m pitch)
  const leftGoal = create3DGoal('left');
  const rightGoal = create3DGoal('right');
  scene.add(leftGoal.group, rightGoal.group);

  // 6. Monumental 80,000-Seat 3-Tier Stadium, 6 LOD Light Towers, GPU Vertex-Shader Crowd & Exterior City
  const {
    stadiumGroup,
    flaresGroup,
    cameraFlashes,
    updateJumbotron,
    cullableSectors,
    towerLodObjects,
    lampHeadMat,
    crowdShaderCtrl,
    nearCrowdCount,
    billboardCrowdCount,
  } = create3DStadiumAndCrowd(
    homeTeam,
    awayTeam,
    quality,
    isSoftwareGl,
    equippedOptions?.stadiumThemeId ?? 'stadium_colosseum'
  );
  scene.add(stadiumGroup);

  // Real-time Day / Afternoon / Night Lighting & Lightmap/Probe Switcher (No new scene reload required)
  const setTimeOfDay = (nextTime: GameSettings['match']['timeOfDay']) => {
    activeTimeOfDay = nextTime;
    const nextSky = isFoggy
      ? 0x334155
      : nextTime === 'dia'
      ? 0x1a2636
      : nextTime === 'atardecer'
      ? 0x2a1810
      : 0x090e17;
    (scene.background as THREE.Color).setHex(nextSky);
    sceneFog.color.setHex(nextSky);

    ambientLight.intensity = nextTime === 'noche' ? 0.62 : nextTime === 'atardecer' ? 0.68 : 0.76;
    hemiLight.color.setHex(nextTime === 'atardecer' ? 0xfed7aa : nextTime === 'noche' ? 0xbae6fd : 0xf0f9ff);
    hemiLight.groundColor.setHex(nextTime === 'atardecer' ? 0x1e3a1e : 0x14532d);
    hemiLight.intensity = nextTime === 'noche' ? 0.72 : 0.86;

    mainLight.color.setHex(nextTime === 'atardecer' ? 0xfdba74 : nextTime === 'noche' ? 0xf8fafc : 0xfffbeb);
    mainLight.intensity = nextTime === 'noche' ? 1.95 : nextTime === 'atardecer' ? 2.05 : 2.18;
    if (nextTime === 'atardecer') {
      mainLight.position.set(52, 34, 46);
    } else if (nextTime === 'noche') {
      mainLight.position.set(28, 64, 38);
    } else {
      mainLight.position.set(32, 62, 42);
    }

    // Toggle 6 Floodlight Tower LED matrix glow intensity
    lampHeadMat.color.setHex(
      nextTime === 'noche' ? 0xffffff : nextTime === 'atardecer' ? 0xfef08a : 0xcbd5e1
    );
    renderer.toneMappingExposure =
      nextTime === 'dia' ? 1.08 : nextTime === 'atardecer' ? 1.04 : 1.06;
  };
  setTimeOfDay(activeTimeOfDay);

  // 7. 3D Soccer Ball + Ground Shadow
  const shadowTex = createRadialShadowTexture();
  const ballTex = createSoccerBallTexture(equippedOptions?.ballId ?? 'ball_pro_atlas');
  const ballMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 22, 22),
    new THREE.MeshStandardMaterial({
      map: ballTex,
      roughness: 0.32,
      metalness: 0.08,
    })
  );
  ballMesh.castShadow = enableShadows;
  scene.add(ballMesh);

  const ballShadowGeo = new THREE.PlaneGeometry(0.68, 0.68);
  ballShadowGeo.rotateX(-Math.PI / 2);
  const ballShadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
  });
  const ballShadow = new THREE.Mesh(ballShadowGeo, ballShadowMat);
  ballShadow.position.y = 0.016;
  scene.add(ballShadow);

  // 8. 3D Turf, Dust & Spark Particle System
  const maxParticles = 90;
  const partGeo = new THREE.BoxGeometry(0.13, 0.13, 0.13);
  const partMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const particleInstanced = new THREE.InstancedMesh(partGeo, partMat, maxParticles);
  particleInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  particleInstanced.frustumCulled = false;
  scene.add(particleInstanced);
  const partDummy = new THREE.Object3D();
  const colorTurf = new THREE.Color('#22C55E');
  const colorDust = new THREE.Color('#A16207');
  const colorSpark = new THREE.Color('#FEF08A');

  // 9. 3D Free Kick & Goal Kick Trajectory Preview Arc + Grass Trajectory Arrow
  const arcPointsCount = 24;
  const arcPositions = new Float32Array(arcPointsCount * 3);
  const arcGeo = new THREE.BufferGeometry();
  arcGeo.setAttribute('position', new THREE.BufferAttribute(arcPositions, 3));
  const arcMat = new THREE.LineBasicMaterial({ color: 0xfacc15, linewidth: 2 });
  const freeKickArcLine = new THREE.Line(arcGeo, arcMat);
  freeKickArcLine.visible = false;
  scene.add(freeKickArcLine);

  const gkGroundPositions = new Float32Array(arcPointsCount * 3);
  const gkGroundGeo = new THREE.BufferGeometry();
  gkGroundGeo.setAttribute('position', new THREE.BufferAttribute(gkGroundPositions, 3));
  const gkGroundMat = new THREE.LineBasicMaterial({
    color: 0xd9f938,
    linewidth: 3,
    transparent: true,
    opacity: 0.95,
  });
  const goalKickGroundLine = new THREE.Line(gkGroundGeo, gkGroundMat);

  const goalKickArrowHead = new THREE.Group();
  const arrowConeGeo = new THREE.ConeGeometry(0.68, 1.65, 3);
  arrowConeGeo.rotateZ(-Math.PI / 2);
  arrowConeGeo.rotateX(Math.PI / 2);
  const arrowConeMat = new THREE.MeshBasicMaterial({
    color: 0xd9f938,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  const arrowConeMesh = new THREE.Mesh(arrowConeGeo, arrowConeMat);
  const arrowRingGeo = new THREE.RingGeometry(0.95, 1.32, 24);
  arrowRingGeo.rotateX(-Math.PI / 2);
  const arrowRingMesh = new THREE.Mesh(arrowRingGeo, arrowConeMat);
  goalKickArrowHead.add(arrowConeMesh, arrowRingMesh);

  const goalKickTrajectoryGroup = new THREE.Group();
  goalKickTrajectoryGroup.add(goalKickGroundLine, goalKickArrowHead);
  goalKickTrajectoryGroup.visible = false;
  scene.add(goalKickTrajectoryGroup);

  // 9b. 3D TV Replay Ball Trajectory Trail & Goalscorer Highlight Ring
  const trailPointsCount = 48;
  const trailPositions = new Float32Array(trailPointsCount * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
  const trailMat = new THREE.LineBasicMaterial({
    color: 0x38bdf8,
    linewidth: 3,
    transparent: true,
    opacity: 0.9,
  });
  const replayBallTrailLine = new THREE.Line(trailGeo, trailMat);
  replayBallTrailLine.visible = false;
  scene.add(replayBallTrailLine);

  const scorerHighlightGroup = new THREE.Group();
  const scorerRingGeo = new THREE.RingGeometry(0.95, 1.25, 32);
  scorerRingGeo.rotateX(-Math.PI / 2);
  const scorerRingMat = new THREE.MeshBasicMaterial({
    color: 0xfacc15,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  const scorerRingMesh = new THREE.Mesh(scorerRingGeo, scorerRingMat);
  scorerRingMesh.position.y = 0.03;

  const scorerBeaconGeo = new THREE.ConeGeometry(0.28, 0.65, 6);
  scorerBeaconGeo.rotateX(Math.PI);
  const scorerBeaconMesh = new THREE.Mesh(scorerBeaconGeo, scorerRingMat);
  scorerBeaconMesh.position.y = 3.1;
  scorerHighlightGroup.add(scorerRingMesh, scorerBeaconMesh);
  scorerHighlightGroup.visible = false;
  scene.add(scorerHighlightGroup);

  // 9c. 3D VAR Offside Laser Line & Glowing Plane (spanning full 90m width)
  const varOffsideGroup = new THREE.Group();
  const varLineGeo = new THREE.PlaneGeometry(0.32, WORLD_PITCH.WIDTH);
  varLineGeo.rotateX(-Math.PI / 2);
  const varLineMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const varLineMesh = new THREE.Mesh(varLineGeo, varLineMat);
  varLineMesh.position.y = 0.035;

  const varWallGeo = new THREE.PlaneGeometry(WORLD_PITCH.WIDTH, 2.2);
  varWallGeo.rotateY(Math.PI / 2);
  const varWallMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.24,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const varWallMesh = new THREE.Mesh(varWallGeo, varWallMat);
  varWallMesh.position.y = 1.1;
  varOffsideGroup.add(varLineMesh, varWallMesh);
  varOffsideGroup.visible = false;
  scene.add(varOffsideGroup);

  // 9d. 3D Rain Lightning Bolt Mesh (Easter Egg)
  const lightningGroup = new THREE.Group();
  const boltPointsCount = 12;
  const boltPositions = new Float32Array(boltPointsCount * 3);
  const boltGeo = new THREE.BufferGeometry();
  boltGeo.setAttribute('position', new THREE.BufferAttribute(boltPositions, 3));
  const boltMat = new THREE.LineBasicMaterial({
    color: 0xe0f2fe,
    linewidth: 4,
  });
  const boltLine = new THREE.Line(boltGeo, boltMat);

  const boltImpactRingGeo = new THREE.RingGeometry(0.4, 2.6, 24);
  boltImpactRingGeo.rotateX(-Math.PI / 2);
  const boltImpactRingMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const boltImpactRing = new THREE.Mesh(boltImpactRingGeo, boltImpactRingMat);
  boltImpactRing.position.y = 0.04;
  lightningGroup.add(boltLine, boltImpactRing);
  lightningGroup.visible = false;
  scene.add(lightningGroup);

  // 10. 3D Referee & 2 Sideline Technical Area Coaches
  const refereeRig = createPlayerRig3D('referee', 'home', false, 0, homeTeam, 'home', shadowTex, enableShadows, 'referee');
  const homeCoachRig = createPlayerRig3D('coach_home', 'home', false, 0, homeTeam, 'home', shadowTex, enableShadows, 'coach');
  const awayCoachRig = createPlayerRig3D('coach_away', 'away', false, 0, awayTeam, 'away', shadowTex, enableShadows, 'coach');
  scene.add(refereeRig.root, homeCoachRig.root, awayCoachRig.root);

  // 11. 3D Weather Particles (Rain / Storm / Snow)
  let weatherPoints: THREE.Points | null = null;
  if (
    settings.visual.effects &&
    (settings.match.weather === 'lluvia' ||
      settings.match.weather === 'tormenta' ||
      settings.match.weather === 'nieve')
  ) {
    const isStorm = settings.match.weather === 'tormenta';
    const pCount = isSoftwareGl ? (isStorm ? 360 : 250) : isStorm ? 950 : 700;
    const positions = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 145;
      positions[i * 3 + 1] = Math.random() * 28;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 95;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({
      color: settings.match.weather === 'nieve' ? 0xffffff : isStorm ? 0xe0f2fe : 0xbae6fd,
      size: settings.match.weather === 'nieve' ? 0.35 : isStorm ? 0.26 : 0.22,
      transparent: true,
      opacity: isStorm ? 0.78 : 0.65,
    });
    weatherPoints = new THREE.Points(pGeo, pMat);
    scene.add(weatherPoints);
  }

  // 12. Player 3D Rigs Map
  const playerRigs = new Map<string, PlayerRig3D>();
  let currentHomeKit: KitSelection = homeKit;
  let currentAwayKit: KitSelection = awayKit;
  const activeRetroKitId = equippedOptions?.retroKitId ?? 'kit_default';

  const ensurePlayerRig = (
    id: string,
    side: 'home' | 'away',
    isGk: boolean,
    squadNumber: number,
    heightCm = 180,
    bodyBuild: 'delgado' | 'atletico' | 'robusto' = 'atletico',
    playerName = '',
    aspecto?: PlayerAppearance
  ): PlayerRig3D => {
    let rig = playerRigs.get(id);
    if (!rig) {
      const team = side === 'home' ? homeTeam : awayTeam;
      const kitSel = side === 'home' ? currentHomeKit : currentAwayKit;
      rig = createPlayerRig3D(
        id,
        side,
        isGk,
        squadNumber,
        team,
        kitSel,
        shadowTex,
        enableShadows,
        undefined,
        heightCm,
        bodyBuild,
        activeRetroKitId,
        playerName,
        aspecto
      );
      scene.add(rig.root);
      playerRigs.set(id, rig);
    }
    return rig;
  };

  // Pre-allocated camera, frustum culling, and dynamic resolution scaler state (Zero GC allocations per frame)
  const camTargetPos = new THREE.Vector3(0, 21.8, 48.2);
  const camLookAt = new THREE.Vector3(0, 0.9, -5.5);
  const currentLookAt = new THREE.Vector3(0, 0.9, -5.5);
  const activeSet = new Set<string>();
  const frustum = new THREE.Frustum();
  const projScreenMatrix = new THREE.Matrix4();
  let hadActiveParticles = true;

  // Dynamic Resolution Scaler (Optimization #9: drops render scale after >2s below target FPS and recovers when stable)
  const targetFps = quality === 'baja' ? 30 : 60;
  let currentRenderScale = 1.0;
  let smoothedFps = targetFps;
  let smoothedFrameTimeMs = 1000 / targetFps;
  let lowFpsDurationSec = 0;
  let stableFpsDurationSec = 0;
  let activeSectorCount = cullableSectors.length;
  let culledSectorCount = 0;

  const getPerformanceTelemetry = (): StadiumPerformanceTelemetry => ({
    fps: Math.round(smoothedFps),
    frameTimeMs: Number(smoothedFrameTimeMs.toFixed(2)),
    targetFps,
    renderScalePct: Math.round(currentRenderScale * 100),
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    pitchDimensionsM: `${WORLD_PITCH.LENGTH} x ${WORLD_PITCH.WIDTH} m`,
    pitchScaleFactor: Number(EXPANDED_PITCH_SCALE.FACTOR.toFixed(4)),
    stadiumCapacity: EXPANDED_PITCH_SCALE.STADIUM_CAPACITY,
    gpuInstancedCrowdCount: nearCrowdCount,
    billboardCrowdCount,
    lightTowerCount: towerLodObjects.length,
    activeSectors: activeSectorCount,
    culledSectors: culledSectorCount,
    timeOfDay: activeTimeOfDay,
    qualityTier: quality,
    isSoftwareGl,
  });

  if (!isSoftwareGl) {
    renderer.compile(scene, camera);
  }

  const updateTeamKits = (
    nextHomeTeam: Team,
    nextAwayTeam: Team,
    nextHomeKit: KitSelection,
    nextAwayKit: KitSelection
  ) => {
    currentHomeKit = nextHomeKit;
    currentAwayKit = nextAwayKit;
    for (const [, rig] of playerRigs) {
      scene.remove(rig.root);
    }
    playerRigs.clear();
    homeTeam = nextHomeTeam;
    awayTeam = nextAwayTeam;
  };

  const updateAndRender = (
    eng: MatchEngine,
    dt: number,
    nowMs: number,
    cameraMode: GameSettings['visual']['cameraMode'],
    cameraZoom: number,
    shootChargePct: number
  ) => {
    // 0. Live Jumbotron Score & Minute Update
    updateJumbotron(eng.homeScore, eng.awayScore, Math.max(0, Math.round(eng.matchMinute)));

    const isReplay = eng.phase === 'goal_replay' && eng.replayPlaybackFrames.length > 0;
    const rFrame = isReplay
      ? eng.replayPlaybackFrames[Math.min(eng.replayPlaybackIndex, eng.replayPlaybackFrames.length - 1)]
      : null;

    // 1. Update Ball 3D Position & Rotation
    const bx = rFrame ? rFrame.ballX : eng.ball.x;
    const by = rFrame ? rFrame.ballY : eng.ball.y;
    const bz = rFrame ? rFrame.ballZ : eng.ball.z;
    const bvx = rFrame?.ballVx ?? eng.ball.vx;
    const bvy = rFrame?.ballVy ?? eng.ball.vy;
    const bspin = rFrame?.ballSpin ?? eng.ball.spin;

    const worldBallX = physToWorldX(bx);
    const worldBallZ = physToWorldZ(by);
    const worldBallY = 0.28 + Math.max(0, bz);

    ballMesh.position.set(worldBallX, worldBallY, worldBallZ);
    ballMesh.rotation.x += bvy * dt * 2.4;
    ballMesh.rotation.z -= bvx * dt * 2.4;
    ballMesh.rotation.y += bspin * dt * 4.2;

    ballShadow.position.set(worldBallX, 0.016, worldBallZ);
    const shadowScale = Math.max(0.45, 1 - bz * 0.14);
    ballShadow.scale.set(shadowScale, shadowScale, 1);

    // 1b. Update 3D Replay Ball Trajectory Trail
    if (isReplay) {
      replayBallTrailLine.visible = true;
      const trailAttr = replayBallTrailLine.geometry.getAttribute('position') as THREE.BufferAttribute;
      const endIdx = Math.min(eng.replayPlaybackIndex, eng.replayPlaybackFrames.length - 1);
      for (let k = 0; k < trailPointsCount; k++) {
        const sampleIdx = Math.max(0, endIdx - (trailPointsCount - 1 - k) * 2);
        const sf = eng.replayPlaybackFrames[sampleIdx];
        trailAttr.setXYZ(
          k,
          physToWorldX(sf.ballX),
          0.32 + Math.max(0, sf.ballZ),
          physToWorldZ(sf.ballY)
        );
      }
      trailAttr.needsUpdate = true;
    } else {
      replayBallTrailLine.visible = false;
    }

    // 2. Physical 3D Goal Net Elastic Deformation & Ripple on Ball Impact / Goal Celebration (140x90m WORLD_PITCH)
    const isNearGoalNet =
      Math.abs(worldBallX) > WORLD_PITCH.HALF_X - 1.4 && Math.abs(worldBallZ) < WORLD_PITCH.GOAL_HALF + 0.4;
    const netRipple =
      eng.phase === 'goal_celebration' || (isReplay && isNearGoalNet)
        ? Math.sin(nowMs * 0.032) * 0.32
        : 0;
    const stretchLeft = (eng.ball.netStretchLeft ?? 0) * 1.45 + (worldBallX < 0 ? Math.abs(netRipple) : 0);
    const stretchRight = (eng.ball.netStretchRight ?? 0) * 1.45 + (worldBallX > 0 ? Math.abs(netRipple) : 0);

    leftGoal.group.position.x = netRipple * (worldBallX < 0 ? -0.42 : 0);
    rightGoal.group.position.x = netRipple * (worldBallX > 0 ? 0.42 : 0);
    leftGoal.netMeshes.forEach((nm, idx) => {
      const wave = Math.sin(nowMs * 0.035 + idx * 1.2) * stretchLeft * 0.35;
      if (idx === 0) {
        nm.position.x = -WORLD_PITCH.HALF_X - WORLD_PITCH.GOAL_DEPTH - stretchLeft;
      }
      nm.scale.set(1 + stretchLeft * 0.18 + wave * 0.08, 1 + stretchLeft * 0.12, 1 + wave * 0.08);
    });
    rightGoal.netMeshes.forEach((nm, idx) => {
      const wave = Math.sin(nowMs * 0.035 + idx * 1.2) * stretchRight * 0.35;
      if (idx === 0) {
        nm.position.x = WORLD_PITCH.HALF_X + WORLD_PITCH.GOAL_DEPTH + stretchRight;
      }
      nm.scale.set(1 + stretchRight * 0.18 + wave * 0.08, 1 + stretchRight * 0.12, 1 + wave * 0.08);
    });

    // 2b. 3D VAR Offside / Review Line Presentation
    if (eng.offsideCutscene?.active || eng.varReviewState?.active) {
      varOffsideGroup.visible = true;
      const lineX = eng.varReviewState?.active
        ? eng.varReviewState.lineX
        : eng.offsideCutscene!.lineX;
      const lineWx = physToWorldX(lineX);
      varOffsideGroup.position.set(lineWx, 0, 0);
      varWallMat.opacity = 0.2 + Math.sin(nowMs * 0.015) * 0.1;
    } else {
      varOffsideGroup.visible = false;
    }

    // 2c. 3D Rain Lightning Strike Easter Egg Animation
    if (eng.lightningState?.active) {
      lightningGroup.visible = true;
      const lx = physToWorldX(eng.lightningState.x);
      const lz = physToWorldZ(eng.lightningState.y);
      const posAttr = boltLine.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < boltPointsCount; i++) {
        const t = i / (boltPointsCount - 1);
        const y = (1 - t) * 26;
        const jitterX = i === 0 || i === boltPointsCount - 1 ? 0 : (Math.random() - 0.5) * 2.4;
        const jitterZ = i === 0 || i === boltPointsCount - 1 ? 0 : (Math.random() - 0.5) * 2.4;
        posAttr.setXYZ(i, lx + jitterX, y, lz + jitterZ);
      }
      posAttr.needsUpdate = true;
      boltImpactRing.position.set(lx, 0.05, lz);
      const ringScale = 1 + (1.85 - eng.lightningState.timer) * 2.4;
      boltImpactRing.scale.set(ringScale, ringScale, 1);
      renderer.toneMappingExposure = eng.lightningState.timer > 1.35 ? 2.15 : 1.15;
    } else {
      lightningGroup.visible = false;
      renderer.toneMappingExposure =
        activeTimeOfDay === 'dia' ? 1.08 : activeTimeOfDay === 'atardecer' ? 1.04 : 1.06;
    }

    // 3. Update & Smoothly Blend 22 3D Sculpted Players (All Mocap Skeletal States + Two-Handed Throw-In + Foot IK)
    activeSet.clear();
    const animDamp = 16;
    let scorerWorldPos: { x: number; z: number } | null = null;

    for (const p of eng.players) {
      // Allow sent-off player to remain visible while walking off toward the sideline tunnel during the red-card cutscene
      if (p.redCard && !(eng.cutsceneState?.active && eng.cutsceneState.playerId === p.id)) continue;
      const rp = rFrame ? rFrame.players.find((item) => item.id === p.id) : null;
      const px = rp ? rp.x : p.x;
      const py = rp ? rp.y : p.y;
      const pvx = rp ? rp.vx : p.vx;
      const pvy = rp ? rp.vy : p.vy;
      const facing = rp ? rp.facing : p.facing;
      const lookAngle = rp?.lookTargetAngle ?? p.lookTargetAngle ?? facing;
      const animState = rp?.animState ?? p.animState ?? 'idle';
      const stride = rp?.stridePhase ?? p.stridePhase;
      const leanForward = rp?.leanForward ?? p.leanForward ?? 0;
      const leanBank = rp?.leanBank ?? p.leanBank ?? 0;
      const kickTimer = rp?.kickAnimTimer ?? p.kickAnimTimer;
      const slideTimer = rp?.slideTimer ?? p.slideTimer;
      const diveTimer = rp?.diveTimer ?? p.diveTimer;
      const diveDirY = rp?.diveDirY ?? p.diveDirY;
      const fallTimer = rp?.fallTimer ?? p.fallTimer ?? 0;
      const footIkLeftY = rp?.footIkLeftY ?? p.footIkLeftY ?? 0;
      const footIkRightY = rp?.footIkRightY ?? p.footIkRightY ?? 0;
      const isGk = p.player.position === 'GK';

      const rig = ensurePlayerRig(
        p.id,
        p.side,
        isGk,
        p.player.number,
        p.player.aspecto?.alturaCm ?? p.player.heightCm ?? 180,
        p.player.bodyBuild ?? 'atletico',
        p.player.name,
        p.player.aspecto
      );
      activeSet.add(p.id);
      if (py < -5) {
        rig.root.visible = false;
        continue;
      }
      rig.root.visible = true;

      const wx = physToWorldX(px);
      const wz = physToWorldZ(py);
      rig.root.position.set(wx, 0, wz);
      rig.root.rotation.y = -facing + Math.PI / 2;

      const isTitan = Boolean(p.isRacingTitan && isRacingTitansMasterFlagEnabled());
      const titanScale = isTitan
        ? p.titanScale ?? RACING_TITANS_CONFIG.TITAN_HEIGHT_SCALE
        : 1.0;
      const shadowScale = isTitan ? RACING_TITANS_CONFIG.TITAN_SHADOW_SCALE : 1.0;
      rig.bodyGroup.scale.set(
        rig.baseScaleXZ * titanScale,
        rig.baseScaleY * titanScale,
        rig.baseScaleXZ * titanScale
      );
      rig.contactShadow.scale.set(shadowScale, shadowScale, 1);
      rig.contactShadow.updateMatrix();
      rig.directionArrow.position.set(0, 0.04, 1.02 * (isTitan ? titanScale * 0.72 : 1));
      rig.directionArrow.scale.set(
        isTitan ? 1.65 : 1,
        isTitan ? 1.65 : 1,
        isTitan ? 1.65 : 1
      );
      rig.directionArrow.updateMatrix();

      if (p.id === eng.replayScorerId) {
        scorerWorldPos = { x: wx, z: wz };
      }

      // Active User Indicator (Overhead 3D Red Triangle Cursor ▼ for P1, Cyan ▼ for P2 + ground ring) + Targeted Pass Receiver Ring
      const isUser1Active = p.id === eng.activeUserPlayerId && !isReplay;
      const isUser2Active = Boolean(eng.twoPlayerMode && p.id === eng.activeUser2PlayerId && !isReplay);
      const isUserActive = isUser1Active || isUser2Active;
      const isTargetedReceiver =
        !isUserActive &&
        (p.id === eng.targetedPassMateId || (eng.twoPlayerMode && p.id === eng.targetedPassMateId2)) &&
        !isReplay;
      rig.activeRing.visible = isUserActive || isTargetedReceiver;
      rig.overheadCursor.visible = isUserActive;
      rig.directionArrow.visible = isUserActive;
      const ringMult = isTitan ? titanScale * 0.78 : 1.0;
      if (isUserActive) {
        const indicatorColor = isUser2Active
          ? 0x06b6d4
          : shootChargePct > 0.05
          ? 0xf59e0b
          : 0xef4444;
        (rig.activeRing.material as THREE.MeshBasicMaterial).color.setHex(indicatorColor);
        (rig.overheadCursor.material as THREE.MeshBasicMaterial).color.setHex(indicatorColor);
        const pulse = (1 + Math.sin(nowMs * 0.008) * 0.06) * ringMult;
        rig.activeRing.scale.set(pulse, pulse, 1);
        rig.overheadCursor.position.y =
          (3.02 + Math.sin(nowMs * 0.009) * 0.08) * (isTitan ? titanScale * 0.86 : 1);
        rig.overheadCursor.scale.set(
          isTitan ? 1.7 : 1,
          isTitan ? 1.7 : 1,
          isTitan ? 1.7 : 1
        );
        rig.overheadCursor.rotation.y = nowMs * 0.0025;
      } else if (isTargetedReceiver) {
        (rig.activeRing.material as THREE.MeshBasicMaterial).color.setHex(0x38bdf8);
        const pulse = (0.92 + Math.sin(nowMs * 0.012) * 0.08) * ringMult;
        rig.activeRing.scale.set(pulse, pulse, 1);
      }

      // Head & Upper-Body Orientation toward lookTargetAngle / ball
      let headYawDiff = lookAngle - facing;
      while (headYawDiff > Math.PI) headYawDiff -= Math.PI * 2;
      while (headYawDiff < -Math.PI) headYawDiff += Math.PI * 2;
      const targetHeadYaw = THREE.MathUtils.clamp(-headYawDiff, -0.78, 0.78);
      const targetTorsoYaw = targetHeadYaw * 0.28;

      const speed = Math.hypot(pvx, pvy);
      const swingAmp =
        animState === 'sprint'
          ? Math.min(1.08, 0.55 + speed * 0.065)
          : animState === 'jog'
            ? Math.min(0.76, 0.32 + speed * 0.08)
            : animState === 'walk'
              ? 0.36
              : Math.min(0.88, speed * 0.11);

      let targetBodyY = 0;
      let targetBodyPitch = leanForward;
      let targetBodyRoll = leanBank;
      let targetHeadPitch = 0;
      let targetLArmX = 0;
      let targetRArmX = 0;
      let targetLArmZ = 0;
      let targetRArmZ = 0;
      let targetLLegX = 0;
      let targetRLegX = 0;

      if (animState === 'throw_in') {
        // Saque de banda IFAB con ambas manos sosteniendo el balón sobre la cabeza
        const throwWave = kickTimer > 0 ? Math.sin((1 - kickTimer / 0.32) * Math.PI) : 0;
        targetBodyY = -0.04;
        targetBodyPitch = -0.18 + throwWave * 0.45;
        targetHeadPitch = -0.15;
        targetLArmX = -Math.PI * 1.05 + throwWave * 0.55;
        targetRArmX = -Math.PI * 1.05 + throwWave * 0.55;
        targetLArmZ = 0.14;
        targetRArmZ = -0.14;
        targetLLegX = -0.16;
        targetRLegX = 0.16;
      } else if (
        animState === 'celebrate' ||
        (eng.phase === 'goal_celebration' && p.side !== eng.restartTeam)
      ) {
        targetBodyY = Math.abs(Math.sin(nowMs * 0.011 + p.slotIndex)) * 0.42;
        targetLArmX = -Math.PI * 0.85;
        targetRArmX = -Math.PI * 0.85;
        targetLArmZ = -0.32;
        targetRArmZ = 0.32;
        targetLLegX = 0.26;
        targetRLegX = -0.26;
      } else if (
        animState === 'lament' ||
        (eng.phase === 'goal_celebration' && p.side === eng.restartTeam)
      ) {
        targetBodyY = -0.19;
        targetBodyPitch = 0.38;
        targetHeadPitch = 0.42;
        targetLArmX = -Math.PI * 0.72;
        targetRArmX = -Math.PI * 0.72;
        targetLArmZ = 0.22;
        targetRArmZ = -0.22;
        targetLLegX = -0.18;
        targetRLegX = 0.18;
      } else if (animState === 'fall' || fallTimer > 0) {
        targetBodyY = -0.46;
        targetBodyPitch = 1.34;
        targetLArmX = -0.68;
        targetRArmX = -0.45;
        targetLLegX = 0.22;
        targetRLegX = -0.16;
      } else if ((animState === 'gk_action' || diveTimer > 0) && isGk) {
        const gkAct = p.gkAction ?? 'dive_save';
        const diveProgress = Math.max(0, Math.min(1, (diveTimer || 0.4) / 0.78));
        if (gkAct === 'punch_clear') {
          targetBodyY = 0.62 * Math.sin(diveProgress * Math.PI);
          targetBodyPitch = -0.22;
          targetLArmX = -Math.PI * 0.98;
          targetRArmX = -Math.PI * 0.98;
          targetLArmZ = -0.18;
          targetRArmZ = 0.18;
          targetLLegX = 0.42;
          targetRLegX = -0.28;
        } else if (gkAct === 'block') {
          targetBodyY = -0.36;
          targetBodyPitch = 0.28;
          targetLArmX = -0.52;
          targetRArmX = -0.52;
          targetLArmZ = -0.82;
          targetRArmZ = 0.82;
          targetLLegX = -0.78;
          targetRLegX = 0.72;
        } else {
          const diveDir = diveDirY || 1;
          const airArc = Math.sin(diveProgress * Math.PI);
          targetBodyRoll = -diveDir * (1.32 + airArc * 0.16);
          targetBodyPitch = -0.18;
          targetBodyY = 0.18 + airArc * 0.46;
          targetLArmX = -Math.PI * 0.96;
          targetRArmX = -Math.PI * 0.96;
          targetLArmZ = -0.24 * diveDir;
          targetRArmZ = -0.14 * diveDir;
          targetLLegX = 0.34;
          targetRLegX = -0.24;
        }
      } else if (animState === 'slide' || slideTimer > 0) {
        targetBodyY = -0.38;
        targetBodyPitch = -1.14;
        targetRLegX = -0.92;
        targetLLegX = 0.48;
        targetLArmX = 0.52;
        targetRArmX = -0.42;
        targetLArmZ = -0.35;
        targetRArmZ = 0.35;
      } else if (animState === 'standing_tackle') {
        targetBodyY = -0.14;
        targetBodyPitch = 0.16;
        targetRLegX = -1.08;
        targetLLegX = 0.34;
        targetLArmX = -0.48;
        targetRArmX = 0.36;
        targetLArmZ = -0.42;
        targetRArmZ = 0.42;
      } else if (animState === 'volley') {
        const isChilena = eng.ball.strikeType === 'chilena';
        targetBodyY = isChilena ? 0.62 : 0.38;
        targetBodyPitch = isChilena ? -1.05 : -0.42;
        targetBodyRoll = isChilena ? 0.35 : 0.48;
        targetRLegX = -1.42;
        targetLLegX = 0.58;
        targetLArmX = -0.65;
        targetRArmX = 0.45;
        targetLArmZ = -0.55;
        targetRArmZ = 0.55;
      } else if (animState === 'shoot' || animState === 'pass' || animState === 'cross' || kickTimer > 0) {
        const kickPhase = Math.max(0, Math.min(1, (kickTimer || 0.18) / 0.28));
        const isHardShot = animState === 'shoot';
        const kickAngle = Math.sin((1 - kickPhase) * Math.PI) * (isHardShot ? 1.28 : 0.92);
        targetRLegX = -kickAngle;
        targetLLegX = kickAngle * 0.38;
        targetLArmX = -0.78;
        targetRArmX = 0.54;
        targetLArmZ = -0.42;
        targetRArmZ = 0.28;
        targetBodyPitch = isHardShot ? -0.22 : -0.12;
      } else if (animState === 'header' || animState === 'jump' || (bz > 1.15 && Math.hypot(px - bx, py - by) < 2.2)) {
        targetBodyY = Math.min(0.68, Math.max(0.32, (bz - 0.85) * 0.48));
        targetHeadPitch = animState === 'header' ? 0.38 : 0.12;
        targetBodyPitch = 0.16;
        targetLArmX = -0.58;
        targetRArmX = -0.58;
        targetLArmZ = -0.35;
        targetRArmZ = 0.35;
        targetLLegX = 0.28;
        targetRLegX = 0.22;
      } else if (animState === 'oriented_control') {
        targetBodyY = -0.08;
        targetBodyPitch = 0.12;
        targetRLegX = -0.56;
        targetLLegX = 0.18;
        targetLArmX = -0.35;
        targetRArmX = -0.35;
        targetLArmZ = -0.38;
        targetRArmZ = 0.38;
      } else if (animState === 'feint') {
        const legSwing = Math.sin(stride) * swingAmp;
        targetBodyY = -0.11;
        targetBodyRoll = (leanBank >= 0 ? 1 : -1) * 0.32;
        targetBodyPitch = 0.21;
        targetLLegX = legSwing * 1.15;
        targetRLegX = -legSwing * 1.15;
        targetLArmX = -0.48;
        targetRArmX = 0.38;
        targetLArmZ = -0.44;
        targetRArmZ = 0.44;
      } else if (animState === 'brake') {
        targetBodyY = -0.12;
        targetBodyPitch = -0.24;
        targetLLegX = -0.52;
        targetRLegX = 0.42;
        targetLArmX = -0.38;
        targetRArmX = -0.38;
        targetLArmZ = -0.48;
        targetRArmZ = 0.48;
      } else if (animState === 'turn') {
        const legSwing = Math.sin(stride) * swingAmp;
        targetBodyY = -0.05 + Math.abs(Math.cos(stride)) * 0.05;
        targetBodyRoll = leanBank * 1.35;
        targetLLegX = legSwing;
        targetRLegX = -legSwing;
        targetLArmX = -legSwing * 0.8;
        targetRArmX = legSwing * 0.8;
        targetLArmZ = -0.32;
        targetRArmZ = 0.32;
      } else if (animState === 'jostle') {
        const legSwing = Math.sin(stride) * swingAmp;
        targetBodyY = -0.04;
        targetBodyPitch = 0.18;
        targetLLegX = legSwing;
        targetRLegX = -legSwing;
        targetLArmX = -0.55;
        targetRArmX = -0.55;
        targetLArmZ = -0.52;
        targetRArmZ = 0.52;
      } else {
        const isDribble = animState === 'dribble';
        const legSwing = Math.sin(stride) * (isDribble ? swingAmp * 0.92 : swingAmp);
        targetBodyY =
          speed > 0.35
            ? (isDribble ? -0.04 : 0) +
              Math.abs(Math.cos(stride)) * (animState === 'sprint' ? 0.085 : 0.06)
            : Math.sin(nowMs * 0.003 + p.slotIndex) * 0.016;
        if (isDribble) {
          targetBodyPitch = leanForward + 0.08;
        }
        targetLLegX = legSwing;
        targetRLegX = -legSwing;
        targetLArmX = -legSwing * (animState === 'sprint' ? 0.96 : 0.82);
        targetRArmX = p.callingForBall
          ? -Math.PI * 0.84
          : legSwing * (animState === 'sprint' ? 0.96 : 0.82);
        targetLArmZ = animState === 'sprint' ? -0.14 : isDribble ? -0.18 : -0.06;
        targetRArmZ = animState === 'sprint' ? 0.14 : isDribble ? 0.18 : 0.06;

        if (isGk && speed < 0.8) {
          targetBodyY = -0.07;
          targetLArmX = -0.38;
          targetRArmX = -0.38;
          targetLArmZ = -0.22;
          targetRArmZ = 0.22;
        }
      }

      if (isTitan && targetBodyY < 0) {
        targetBodyY = 0;
      }

      rig.bodyGroup.position.y = THREE.MathUtils.damp(rig.bodyGroup.position.y, targetBodyY, animDamp, dt);
      rig.bodyGroup.rotation.x = THREE.MathUtils.damp(rig.bodyGroup.rotation.x, targetBodyPitch, animDamp, dt);
      rig.bodyGroup.rotation.y = THREE.MathUtils.damp(rig.bodyGroup.rotation.y, targetTorsoYaw, animDamp, dt);
      rig.bodyGroup.rotation.z = THREE.MathUtils.damp(rig.bodyGroup.rotation.z, targetBodyRoll, animDamp, dt);
      rig.headGroup.rotation.x = THREE.MathUtils.damp(rig.headGroup.rotation.x, targetHeadPitch, animDamp, dt);
      rig.headGroup.rotation.y = THREE.MathUtils.damp(rig.headGroup.rotation.y, targetHeadYaw, animDamp, dt);
      rig.leftArmPivot.rotation.x = THREE.MathUtils.damp(rig.leftArmPivot.rotation.x, targetLArmX, animDamp, dt);
      rig.rightArmPivot.rotation.x = THREE.MathUtils.damp(rig.rightArmPivot.rotation.x, targetRArmX, animDamp, dt);
      rig.leftArmPivot.rotation.z = THREE.MathUtils.damp(rig.leftArmPivot.rotation.z, targetLArmZ, animDamp, dt);
      rig.rightArmPivot.rotation.z = THREE.MathUtils.damp(rig.rightArmPivot.rotation.z, targetRArmZ, animDamp, dt);
      rig.leftLegPivot.rotation.x = THREE.MathUtils.damp(rig.leftLegPivot.rotation.x, targetLLegX, animDamp, dt);
      rig.rightLegPivot.rotation.x = THREE.MathUtils.damp(rig.rightLegPivot.rotation.x, targetRLegX, animDamp, dt);
      rig.leftLegPivot.position.y = THREE.MathUtils.damp(
        rig.leftLegPivot.position.y,
        0.68 + footIkLeftY * 0.42,
        animDamp,
        dt
      );
      rig.rightLegPivot.position.y = THREE.MathUtils.damp(
        rig.rightLegPivot.position.y,
        0.68 + footIkRightY * 0.42,
        animDamp,
        dt
      );
    }

    // Highlight Goalscorer during TV Replay & Celebration
    if ((isReplay || eng.phase === 'goal_celebration') && scorerWorldPos) {
      scorerHighlightGroup.visible = true;
      scorerHighlightGroup.position.set(scorerWorldPos.x, 0, scorerWorldPos.z);
      const pulse = 1 + Math.sin(nowMs * 0.01) * 0.14;
      scorerRingMesh.scale.set(pulse, pulse, 1);
      scorerBeaconMesh.position.y = 3.05 + Math.sin(nowMs * 0.008) * 0.22;
      scorerBeaconMesh.rotation.y = nowMs * 0.003;
    } else {
      scorerHighlightGroup.visible = false;
    }

    for (const [id, rig] of playerRigs) {
      if (!activeSet.has(id)) {
        rig.root.visible = false;
      }
    }

    // 4. Update 3D Referee & 2 Technical Area Coaches
    const refWx = physToWorldX(eng.referee.x);
    const refWz = physToWorldZ(eng.referee.y);
    refereeRig.root.position.set(refWx, 0, refWz);
    refereeRig.root.rotation.y = -eng.referee.facing + Math.PI / 2;
    const refSpeed = Math.hypot(eng.referee.vx, eng.referee.vy);
    const refSwing = Math.sin(nowMs * 0.01) * Math.min(0.65, refSpeed * 0.14);
    refereeRig.leftLegPivot.rotation.x = refSwing;
    refereeRig.rightLegPivot.rotation.x = -refSwing;
    if (eng.referee.signalType === 'advantage') {
      refereeRig.leftArmPivot.rotation.x = -Math.PI * 0.55;
      refereeRig.rightArmPivot.rotation.x = -Math.PI * 0.55;
      if (refereeRig.cardMesh) refereeRig.cardMesh.visible = false;
    } else if (eng.referee.signalType === 'yellow' || eng.referee.signalType === 'red') {
      refereeRig.rightArmPivot.rotation.x = -Math.PI * 0.88;
      if (refereeRig.cardMesh) {
        refereeRig.cardMesh.visible = true;
        (refereeRig.cardMesh.material as THREE.MeshBasicMaterial).color.setHex(
          eng.referee.signalType === 'red' ? 0xef4444 : 0xfacc15
        );
      }
    } else {
      refereeRig.leftArmPivot.rotation.x = -refSwing * 0.7;
      refereeRig.rightArmPivot.rotation.x = refSwing * 0.7;
      if (refereeRig.cardMesh) refereeRig.cardMesh.visible = false;
    }

    animateCoachRig(homeCoachRig, eng.homeCoachMood, nowMs, dt, -14.5);
    animateCoachRig(awayCoachRig, eng.awayCoachMood, nowMs + 700, dt, 14.5);

    // 5. Update 3D Turf, Dust & Spark Particles (skip GPU upload when idle)
    const pEvents = eng.particleEvents;
    if (pEvents.length > 0 || hadActiveParticles) {
      hadActiveParticles = pEvents.length > 0;
      for (let i = 0; i < maxParticles; i++) {
        if (i < pEvents.length) {
          const pe = pEvents[i];
          partDummy.position.set(physToWorldX(pe.x), Math.max(0.03, pe.z), physToWorldZ(pe.y));
          const sc = Math.max(0.2, pe.life * 1.4);
          partDummy.scale.set(sc, sc, sc);
          partDummy.rotation.set(nowMs * 0.01 + i, nowMs * 0.015 + i, 0);
          partDummy.updateMatrix();
          particleInstanced.setMatrixAt(i, partDummy.matrix);
          particleInstanced.setColorAt(
            i,
            pe.kind === 'turf' ? colorTurf : pe.kind === 'spark' ? colorSpark : colorDust
          );
        } else {
          partDummy.position.set(0, -10, 0);
          partDummy.scale.set(0, 0, 0);
          partDummy.updateMatrix();
          particleInstanced.setMatrixAt(i, partDummy.matrix);
        }
      }
      particleInstanced.instanceMatrix.needsUpdate = true;
      if (particleInstanced.instanceColor) particleInstanced.instanceColor.needsUpdate = true;
    }

    // 6. Update 3D Free Kick & Goal Kick Trajectory Arc / Grass Line Preview
    if (eng.phase === 'GOAL_KICK_AIM' && eng.goalKickAimState) {
      const gkAim = eng.goalKickAimState;
      const worldAimAngle = (gkAim.team === 'home' ? 0 : Math.PI) + gkAim.aimAngleRad;
      const elev = Math.max(0, Math.min(1, gkAim.elevationSlider));
      const activeCharge =
        shootChargePct > 0.05
          ? shootChargePct
          : gkAim.chargePower > 0.05
          ? gkAim.chargePower
          : 0.65;
      const combinedPower = Math.max(0.18, Math.min(1.0, elev * 0.55 + activeCharge * 0.45));
      const kickDistance = 16 + combinedPower * 54;
      const peakHeight =
        elev < 0.22 ? 0.16 : elev * 7.2 * (0.65 + activeCharge * 0.35);

      freeKickArcLine.visible = true;
      goalKickTrajectoryGroup.visible = true;

      const startWx = physToWorldX(eng.ball.x);
      const startWz = physToWorldZ(eng.ball.y);
      const endPhysX = Math.max(
        2,
        Math.min(PITCH.LENGTH - 2, eng.ball.x + Math.cos(worldAimAngle) * kickDistance)
      );
      const endPhysY = Math.max(
        2,
        Math.min(PITCH.WIDTH - 2, eng.ball.y + Math.sin(worldAimAngle) * kickDistance)
      );
      const endWx = physToWorldX(endPhysX);
      const endWz = physToWorldZ(endPhysY);

      const posAttr = freeKickArcLine.geometry.getAttribute('position') as THREE.BufferAttribute;
      const groundAttr = goalKickGroundLine.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let k = 0; k < arcPointsCount; k++) {
        const t = k / (arcPointsCount - 1);
        const wx = startWx + (endWx - startWx) * t;
        const wz = startWz + (endWz - startWz) * t;
        const wy = 0.12 + Math.sin(t * Math.PI) * peakHeight;
        posAttr.setXYZ(k, wx, wy, wz);
        groundAttr.setXYZ(k, wx, 0.06, wz);
      }
      posAttr.needsUpdate = true;
      groundAttr.needsUpdate = true;

      goalKickArrowHead.position.set(endWx, 0.07, endWz);
      goalKickArrowHead.rotation.y = -worldAimAngle;
      const pulse = 1 + Math.sin(nowMs * 0.01) * 0.08;
      goalKickArrowHead.scale.set(pulse, 1, pulse);
    } else if (eng.phase === 'set_piece' && eng.freeKickState?.awaitingUserInput && !eng.freeKickState.isInMatchPenalty) {
      freeKickArcLine.visible = true;
      goalKickTrajectoryGroup.visible = false;
      const fk = eng.freeKickState;
      const oppGoalX = eng.restartTeam === 'home' ? PITCH.LENGTH : 0;
      const targetY = PITCH.HALF_Y + fk.aimOffset * (PITCH.GOAL_HALF - 0.1);
      const dx = oppGoalX - eng.ball.x;
      const dy = targetY - eng.ball.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const spd = fk.strikeType === 'globo' ? 17 + fk.power * 8 : 25 + fk.power * 8;
      let simX = eng.ball.x;
      let simY = eng.ball.y;
      let simZ = 0.25;
      let simVx = (dx / dist) * spd;
      let simVy = (dy / dist) * spd;
      let simVz = fk.strikeType === 'raso' ? 1.0 + fk.aimHeight * 1.2 : 3.4 + fk.aimHeight * 4.5;
      const simSpin = fk.curve * 2.8;
      const stepT = 0.055;

      const posAttr = freeKickArcLine.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let k = 0; k < arcPointsCount; k++) {
        posAttr.setXYZ(k, physToWorldX(simX), Math.max(0.15, simZ), physToWorldZ(simY));
        const s2d = Math.hypot(simVx, simVy);
        if (s2d > 1) {
          const nx = -simVy / s2d;
          const ny = simVx / s2d;
          simVx += nx * simSpin * s2d * 0.21 * stepT;
          simVy += ny * simSpin * s2d * 0.21 * stepT;
        }
        simX += simVx * stepT;
        simY += simVy * stepT;
        simVz -= 14.8 * stepT;
        simZ = Math.max(0.1, simZ + simVz * stepT);
      }
      posAttr.needsUpdate = true;
    } else {
      freeKickArcLine.visible = false;
      goalKickTrajectoryGroup.visible = false;
    }

    // 7. GPU Vertex-Shader Crowd & Flags Animation + Camera Flashes & Flares (Optimization #2: Zero CPU matrix loops)
    flaresGroup.visible = eng.phase === 'goal_celebration' || eng.matchMinute < 4;
    const isFlashMoment =
      eng.phase === 'goal_celebration' ||
      eng.crowdMood === 'goal_roar' ||
      eng.crowdMood === 'dangerous_play' ||
      Boolean(eng.cutsceneState?.active);
    cameraFlashes.visible = isFlashMoment && Math.sin(nowMs * 0.045) > 0.1;
    if (cameraFlashes.visible) {
      const fMat = cameraFlashes.material as THREE.PointsMaterial;
      fMat.opacity = 0.45 + Math.abs(Math.sin(nowMs * 0.08)) * 0.55;
      cameraFlashes.rotation.y = Math.sin(nowMs * 0.01) * 0.02;
    }

    const isExcited = eng.phase === 'goal_celebration' || eng.crowdMood === 'goal_roar';
    const isDanger = eng.crowdMood === 'dangerous_play' || eng.crowdMood === 'save_applause';
    crowdShaderCtrl.uTime.value = nowMs * 0.001;
    crowdShaderCtrl.uWaveAmp.value = isExcited ? 0.54 : isDanger ? 0.28 : 0.08;
    crowdShaderCtrl.uWaveSpeed.value = isExcited ? 11.5 : isDanger ? 7.2 : 3.4;

    // 8. Weather Particles Animation
    if (weatherPoints) {
      const posAttr = weatherPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const fallSpeed =
        settings.match.weather === 'nieve'
          ? 4.5
          : settings.match.weather === 'tormenta'
          ? 28
          : 22;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] -= fallSpeed * dt;
        if (arr[i + 1] < 0) {
          arr[i + 1] = 25;
        }
      }
      posAttr.needsUpdate = true;
    }

    // 9. EA SPORTS FC TV Broadcast Camera System Scaled for Expanded 140 x 90 m Pitch (FACTOR = 1.3333)
    const zoomFactor = 1 / Math.max(0.75, Math.min(1.35, cameraZoom));
    const camScale = EXPANDED_PITCH_SCALE.CAMERA_SCALE; // 1.3333334

    if (eng.varReviewState?.active) {
      const vx = physToWorldX(eng.varReviewState.focusX);
      const vz = physToWorldZ(eng.varReviewState.focusY);
      if (eng.varReviewState.cameraAngleIndex === 1) {
        camTargetPos.set(vx, 14.5, 38.0);
        camLookAt.set(vx, 0.85, vz * 0.4 - 1.5);
      } else if (eng.varReviewState.cameraAngleIndex === 2) {
        camTargetPos.set(vx - 7.8, 3.2, vz + 11.2);
        camLookAt.set(vx, 1.05, vz);
      } else {
        camTargetPos.set(vx + 5.8, 6.2, vz + 16.5);
        camLookAt.set(vx, 1.15, vz);
      }
    } else if (eng.cutsceneState?.active && (eng.cutsceneState.type === 'yellow_card' || eng.cutsceneState.type === 'red_card')) {
      // Cinemática de Tarjeta Amarilla / Roja: zoom dramático enfocando al árbitro y al infractor
      const cx = physToWorldX(eng.cutsceneState.focusX);
      const cz = physToWorldZ(eng.cutsceneState.focusY);
      camTargetPos.set(cx - 1.2, 3.2, cz + 7.2);
      camLookAt.set(cx - 0.4, 1.38, cz);
    } else if (eng.cutsceneState?.active && eng.cutsceneState.type === 'corner') {
      // Cinemática de Tiro de Esquina: detrás del ejecutante en el banderín mirando hacia los cabeceadores en el área
      const cx = physToWorldX(eng.cutsceneState.focusX);
      const cz = physToWorldZ(eng.cutsceneState.focusY);
      const goalX = eng.cutsceneState.teamSide === 'home' ? WORLD_PITCH.HALF_X : -WORLD_PITCH.HALF_X;
      const signX = cx < 0 ? -1 : 1;
      const signZ = cz < 0 ? -1 : 1;
      camTargetPos.set(cx + signX * 5.2, 3.6, cz + signZ * 5.2);
      camLookAt.set(goalX - signX * 11.5, 1.4, 0);
    } else if (eng.cutsceneState?.active && eng.cutsceneState.type === 'throw_in') {
      // Cinemática de Saque de Banda: encuadre del jugador sosteniendo el balón con ambas manos en la línea de cal
      const cx = physToWorldX(eng.cutsceneState.focusX);
      const cz = physToWorldZ(eng.cutsceneState.focusY);
      const signZ = cz < 0 ? -1 : 1;
      camTargetPos.set(cx - 4.2, 3.1, cz + signZ * 5.8);
      camLookAt.set(cx + 2.8, 1.35, cz - signZ * 7.5);
    } else if (eng.cardCutscene?.active) {
      const cx = physToWorldX(eng.cardCutscene.x);
      const cz = physToWorldZ(eng.cardCutscene.y);
      camTargetPos.set(cx - 0.9, 3.3, cz + 7.6);
      camLookAt.set(cx - 0.5, 1.35, cz);
    } else if (eng.offsideCutscene?.active) {
      const lx = physToWorldX(eng.offsideCutscene.lineX);
      const lz = physToWorldZ(eng.offsideCutscene.y);
      camTargetPos.set(lx, 13.8, 38.5);
      camLookAt.set(lx, 0.8, lz * 0.4 - 2.0);
    } else if (eng.phase === 'GOAL_KICK_AIM' && eng.goalKickAimState) {
      // Cámara de saque: elevada y detrás del arquero mirando hacia el campo rival con transición suave
      const gkAim = eng.goalKickAimState;
      const baseDir = gkAim.team === 'home' ? 1 : -1;
      const worldAimAngle = (gkAim.team === 'home' ? 0 : Math.PI) + gkAim.aimAngleRad;
      const forwardX = Math.cos(worldAimAngle);
      const forwardZ = Math.sin(worldAimAngle);
      camTargetPos.set(
        worldBallX - baseDir * 14.5 - forwardX * 2.5,
        7.2,
        worldBallZ - forwardZ * 10.5
      );
      camLookAt.set(
        worldBallX + forwardX * 42.0,
        1.15,
        worldBallZ + forwardZ * 42.0
      );
    } else if (eng.phase === 'penalty_shootout' || (eng.phase === 'set_piece' && eng.restartType === 'penalty')) {
      const isRightGoal = eng.phase === 'penalty_shootout' || eng.restartTeam === 'home';
      const dir = isRightGoal ? 1 : -1;
      const penSpotX = dir * (WORLD_PITCH.HALF_X - WORLD_PITCH.PENALTY_SPOT_X);
      camTargetPos.set(penSpotX - dir * 11.2, 3.9, 0);
      camLookAt.set(dir * WORLD_PITCH.HALF_X, 1.45, 0);
    } else if (eng.phase === 'set_piece' && eng.freeKickState?.awaitingUserInput) {
      const dir = eng.restartTeam === 'home' ? 1 : -1;
      const goalX = dir * WORLD_PITCH.HALF_X;
      const dx = goalX - worldBallX;
      const dz = 0 - worldBallZ;
      const d = Math.max(1, Math.hypot(dx, dz));
      camTargetPos.set(worldBallX - (dx / d) * 12.2, 4.5, worldBallZ - (dz / d) * 12.2);
      camLookAt.set(goalX, 1.45, eng.freeKickState.aimOffset * WORLD_PITCH.GOAL_HALF);
    } else if (eng.phase === 'goal_celebration') {
      const focusX = scorerWorldPos ? scorerWorldPos.x : THREE.MathUtils.clamp(worldBallX, -62, 62);
      const focusZ = scorerWorldPos ? scorerWorldPos.z : worldBallZ;
      const orbitX = Math.sin(nowMs * 0.002) * 6.5;
      camTargetPos.set(focusX + orbitX, 6.2, focusZ + 13.5);
      camLookAt.set(focusX, 1.35, focusZ);
    } else if (isReplay) {
      const focusX = THREE.MathUtils.clamp(worldBallX, -65, 65);
      const goalDir = focusX >= 0 ? 1 : -1;
      const targetGoalX = goalDir * WORLD_PITCH.HALF_X;

      if (eng.replayCameraAngle === 'broadcast_slow') {
        camTargetPos.set(focusX * 0.82, 16.5, worldBallZ * 0.55 + 32.5);
        camLookAt.set(worldBallX, 0.95, worldBallZ * 0.85 - 2.5);
      } else if (eng.replayCameraAngle === 'low_sideline_slow') {
        // Cámara Libre 360° (permite orbitar alrededor de la jugada con replayFreeCamAngle)
        const freeAngle = eng.replayFreeCamAngle || 0;
        const radius = 15.5;
        camTargetPos.set(
          worldBallX + Math.sin(freeAngle) * radius,
          3.8,
          worldBallZ + Math.cos(freeAngle) * radius
        );
        camLookAt.set(worldBallX, 1.05, worldBallZ);
      } else {
        // Detrás del Arco (behind_goal_zoom)
        camTargetPos.set(targetGoalX + goalDir * 8.8, 3.8, worldBallZ * 0.45);
        camLookAt.set(worldBallX, Math.max(0.85, worldBallY), worldBallZ);
      }
    } else if (cameraMode === 'panoramica') {
      const titanCamH =
        eng.hasActiveRacingTitans && isRacingTitansMasterFlagEnabled()
          ? RACING_TITANS_CONFIG.TITAN_CAMERA_HEIGHT_MULT
          : 1.0;
      const titanCamD =
        eng.hasActiveRacingTitans && isRacingTitansMasterFlagEnabled()
          ? RACING_TITANS_CONFIG.TITAN_CAMERA_DIST_MULT
          : 1.0;
      const cx = THREE.MathUtils.clamp(worldBallX * 0.55, -38, 38);
      const cz = THREE.MathUtils.clamp(worldBallZ * 0.35, -16, 16);
      camTargetPos.set(
        cx,
        39.5 * camScale * 0.85 * zoomFactor * titanCamH,
        cz + 54 * camScale * 0.85 * zoomFactor * titanCamD
      );
      camLookAt.set(
        cx,
        eng.hasActiveRacingTitans && isRacingTitansMasterFlagEnabled()
          ? RACING_TITANS_CONFIG.TITAN_CAMERA_LOOK_Y * 0.5
          : 0,
        cz - 3.5
      );
    } else if (cameraMode === 'dinamica') {
      const titanCamH =
        eng.hasActiveRacingTitans && isRacingTitansMasterFlagEnabled()
          ? RACING_TITANS_CONFIG.TITAN_CAMERA_HEIGHT_MULT
          : 1.0;
      const titanCamD =
        eng.hasActiveRacingTitans && isRacingTitansMasterFlagEnabled()
          ? RACING_TITANS_CONFIG.TITAN_CAMERA_DIST_MULT
          : 1.0;
      const cx = THREE.MathUtils.clamp(worldBallX * 0.9, -58, 58);
      const cz = THREE.MathUtils.clamp(worldBallZ * 0.78, -32, 32);
      camTargetPos.set(
        cx * 0.94,
        17.8 * camScale * 0.88 * zoomFactor * titanCamH,
        cz + 29.5 * camScale * 0.88 * zoomFactor * titanCamD
      );
      camLookAt.set(
        worldBallX * 0.98,
        eng.hasActiveRacingTitans && isRacingTitansMasterFlagEnabled()
          ? RACING_TITANS_CONFIG.TITAN_CAMERA_LOOK_Y
          : 0.75,
        worldBallZ * 0.85 - 2.8
      );
    } else {
      const teleMult = cameraMode === 'tele' ? 0.90 : 1.0;
      const titanCamH =
        eng.hasActiveRacingTitans && isRacingTitansMasterFlagEnabled()
          ? RACING_TITANS_CONFIG.TITAN_CAMERA_HEIGHT_MULT
          : 1.0;
      const titanCamD =
        eng.hasActiveRacingTitans && isRacingTitansMasterFlagEnabled()
          ? RACING_TITANS_CONFIG.TITAN_CAMERA_DIST_MULT
          : 1.0;
      const boxProximity = Math.max(0, (Math.abs(worldBallX) - 26) / 42);
      const ballSpeedZoomOut = Math.min(2.2, Math.hypot(eng.ball.vx, eng.ball.vy) * 0.055);

      const dynamicHeight =
        (21.4 - boxProximity * 2.5 + ballSpeedZoomOut * 0.75) *
        zoomFactor *
        teleMult *
        titanCamH;
      const dynamicDistZ =
        (47.2 - boxProximity * 4.5 + ballSpeedZoomOut * 1.15) *
        zoomFactor *
        teleMult *
        titanCamD;

      const cx = THREE.MathUtils.clamp(worldBallX * 0.84 + eng.ball.vx * 0.15, -52, 52);
      const cz = THREE.MathUtils.clamp(worldBallZ * 0.48 + eng.ball.vy * 0.10, -18, 20);

      const attackBias = worldBallX >= -5 ? 1 : -1;
      const diagonalCamShift = attackBias * 9.6 + worldBallX * 0.15;

      camTargetPos.set(cx - diagonalCamShift, dynamicHeight, cz + dynamicDistZ);
      camLookAt.set(
        THREE.MathUtils.clamp(cx + attackBias * 6.0 + eng.ball.vx * 0.18, -60, 60),
        eng.hasActiveRacingTitans && isRacingTitansMasterFlagEnabled()
          ? RACING_TITANS_CONFIG.TITAN_CAMERA_LOOK_Y
          : 0.85,
        cz * 0.62 - 7.5
      );
    }

    // Screen Shake on Post/Crossbar Impact or Top-Corner Goal
    if (eng.cameraShake > 0.01) {
      camTargetPos.x += (Math.random() - 0.5) * eng.cameraShake * 0.75;
      camTargetPos.y += (Math.random() - 0.5) * eng.cameraShake * 0.75;
    }

    const isSetPieceFocus =
      eng.phase === 'penalty_shootout' ||
      (eng.phase === 'set_piece' && (eng.restartType === 'penalty' || Boolean(eng.freeKickState?.awaitingUserInput)));
    const camDamp = isSetPieceFocus ? 28 : eng.cutsceneState?.active ? 7.5 : isReplay ? 6.5 : 5.8;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, camTargetPos.x, camDamp, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, camTargetPos.y, camDamp, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, camTargetPos.z, camDamp, dt);

    currentLookAt.x = THREE.MathUtils.damp(currentLookAt.x, camLookAt.x, camDamp * 1.25, dt);
    currentLookAt.y = THREE.MathUtils.damp(currentLookAt.y, camLookAt.y, camDamp * 1.25, dt);
    currentLookAt.z = THREE.MathUtils.damp(currentLookAt.z, camLookAt.z, camDamp * 1.25, dt);
    camera.lookAt(currentLookAt);

    // 10. Zero-GC Sector Frustum Culling & 3-Level Floodlight Tower LOD Update (Optimizations #4 & #6)
    camera.updateMatrixWorld();
    projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projScreenMatrix);

    let visSectors = 0;
    let hidSectors = 0;
    for (let sIdx = 0; sIdx < cullableSectors.length; sIdx++) {
      const sec = cullableSectors[sIdx];
      // Exterior city is also culled automatically when camera is low (< 14m height)
      const isLowCamExterior = sec.name === 'ExteriorCity' && camera.position.y < 14.0;
      const inView = !isLowCamExterior && frustum.intersectsSphere(sec.bounds);
      sec.group.visible = inView;
      if (inView) visSectors++;
      else hidSectors++;
    }
    activeSectorCount = visSectors;
    culledSectorCount = hidSectors;

    for (let tIdx = 0; tIdx < towerLodObjects.length; tIdx++) {
      towerLodObjects[tIdx].update(camera);
    }

    // 11. Dynamic Resolution Scaler (Optimization #9: drops render resolution after >2s below target FPS, restores when stable)
    const safeDt = Math.max(0.001, Math.min(0.25, dt));
    const instFps = 1 / safeDt;
    smoothedFps = smoothedFps * 0.92 + instFps * 0.08;
    smoothedFrameTimeMs = smoothedFrameTimeMs * 0.92 + safeDt * 1000 * 0.08;

    if (smoothedFps < targetFps * 0.92) {
      lowFpsDurationSec += safeDt;
      stableFpsDurationSec = 0;
      if (lowFpsDurationSec >= 2.0 && currentRenderScale > 0.68) {
        currentRenderScale = Math.max(0.68, Number((currentRenderScale - 0.10).toFixed(2)));
        renderer.setPixelRatio(baseDevicePixelRatio * currentRenderScale);
        lowFpsDurationSec = 0;
      }
    } else if (smoothedFps >= targetFps * 0.97) {
      lowFpsDurationSec = Math.max(0, lowFpsDurationSec - safeDt * 0.5);
      if (currentRenderScale < 1.0) {
        stableFpsDurationSec += safeDt;
        if (stableFpsDurationSec >= 2.5) {
          currentRenderScale = Math.min(1.0, Number((currentRenderScale + 0.08).toFixed(2)));
          renderer.setPixelRatio(baseDevicePixelRatio * currentRenderScale);
          stableFpsDurationSec = 0;
        }
      }
    }

    renderer.render(scene, camera);
  };

  const resize = (width: number, height: number) => {
    if (width <= 0 || height <= 0) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(baseDevicePixelRatio * currentRenderScale);
    renderer.setSize(width, height);
  };

  const dispose = () => {
    renderer.dispose();
  };

  return {
    renderer,
    isSoftwareGl,
    updateTeamKits,
    setTimeOfDay,
    getPerformanceTelemetry,
    updateAndRender,
    resize,
    dispose,
  };
}
