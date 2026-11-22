import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { MatchEngine } from '../engine/matchEngine';
import {
  createMatchScene3D,
  STADIUM_PITCH_3D_SIZE,
  type MatchScene3DController,
} from '../engine/scene3d';
import type { GameSettings, KitSelection, Team } from '../types/football';

export const STADIUM_3D_DIMENSIONS = {
  width: STADIUM_PITCH_3D_SIZE.width, // 1050
  height: STADIUM_PITCH_3D_SIZE.depth, // 600
} as const;

export const LATERAL_BROADCAST_CAMERA_PRESETS: Record<
  GameSettings['visual']['cameraMode'],
  { fov: number; height: number; lateralDistance: number; lookAhead: number }
> = {
  broadcast: { fov: 37, height: 15.2, lateralDistance: 35.5, lookAhead: 0.9 },
  tele: { fov: 33, height: 16.4, lateralDistance: 39.0, lookAhead: 0.85 },
  panoramica: { fov: 42, height: 22.0, lateralDistance: 44.5, lookAhead: 0.6 },
  dinamica: { fov: 40, height: 11.4, lateralDistance: 25.0, lookAhead: 1.15 },
  vertical: { fov: 37, height: 15.2, lateralDistance: 35.5, lookAhead: 0.9 },
};

/**
 * Declarative React Three Fiber 3D Pitch & Ambient Lighting Node (1050x600 scale)
 */
export const StadiumPitchR3F: React.FC<{
  width?: number;
  depth?: number;
  timeOfDay?: GameSettings['match']['timeOfDay'];
}> = ({
  width = STADIUM_3D_DIMENSIONS.width,
  depth = STADIUM_3D_DIMENSIONS.height,
  timeOfDay = 'noche',
}) => {
  const ambientIntensity = timeOfDay === 'noche' ? 0.58 : 0.72;
  const directionalIntensity = timeOfDay === 'noche' ? 1.95 : 2.15;

  return (
    <group name="stadium-3d-r3f-root">
      <ambientLight intensity={ambientIntensity} color="#ffffff" />
      <hemisphereLight
        args={[timeOfDay === 'atardecer' ? '#fed7aa' : '#f0f9ff', '#14532d', 0.82]}
        position={[0, 50, 0]}
      />
      <directionalLight
        position={[24, 48, 34]}
        intensity={directionalIntensity}
        color={timeOfDay === 'atardecer' ? '#fdba74' : '#fffbeb'}
        castShadow
      />
      {/* 1050x600 3D Pitch Ground Plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#2C6A24" roughness={0.84} metalness={0.02} />
      </mesh>
    </group>
  );
};

/**
 * Declarative React Three Fiber Lateral Broadcast Camera Controller
 */
export const LateralBroadcastCameraR3F: React.FC<{
  cameraMode: GameSettings['visual']['cameraMode'];
  targetX?: number;
  targetZ?: number;
}> = ({ cameraMode, targetX = 0, targetZ = 0 }) => {
  const { camera } = useThree();
  const lookAtTargetRef = useRef(new THREE.Vector3(0, 0.85, -3.2));

  useFrame((_, delta) => {
    const preset = LATERAL_BROADCAST_CAMERA_PRESETS[cameraMode] ?? LATERAL_BROADCAST_CAMERA_PRESETS.broadcast;
    const desiredX = targetX * 0.68;
    const desiredY = preset.height;
    const desiredZ = targetZ * 0.48 + preset.lateralDistance;

    camera.position.x = THREE.MathUtils.damp(camera.position.x, desiredX, 4.5, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, desiredY, 4.5, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, desiredZ, 4.5, delta);

    if (camera instanceof THREE.PerspectiveCamera && Math.abs(camera.fov - preset.fov) > 0.1) {
      camera.fov = THREE.MathUtils.damp(camera.fov, preset.fov, 6, delta);
      camera.updateProjectionMatrix();
    }

    lookAtTargetRef.current.set(
      THREE.MathUtils.damp(lookAtTargetRef.current.x, targetX * 0.82, 6, delta),
      preset.lookAhead,
      THREE.MathUtils.damp(lookAtTargetRef.current.z, targetZ * 0.65 - 3.2, 6, delta)
    );
    camera.lookAt(lookAtTargetRef.current);
  });

  return null;
};

/**
 * Standalone React Three Fiber Canvas wrapper for declarative R3F usage
 */
export const Stadium3DFiberCanvas: React.FC<{
  cameraMode: GameSettings['visual']['cameraMode'];
  timeOfDay: GameSettings['match']['timeOfDay'];
}> = ({ cameraMode, timeOfDay }) => {
  const preset = LATERAL_BROADCAST_CAMERA_PRESETS[cameraMode] ?? LATERAL_BROADCAST_CAMERA_PRESETS.broadcast;
  return (
    <Canvas
      shadows
      camera={{
        fov: preset.fov,
        position: [0, preset.height, preset.lateralDistance],
        near: 0.5,
        far: 2600,
      }}
    >
      <StadiumPitchR3F
        width={STADIUM_3D_DIMENSIONS.width}
        depth={STADIUM_3D_DIMENSIONS.height}
        timeOfDay={timeOfDay}
      />
      <LateralBroadcastCameraR3F cameraMode={cameraMode} />
    </Canvas>
  );
};

export interface Stadium3DProps {
  engineRef: React.MutableRefObject<MatchEngine | null>;
  pausedRef: React.MutableRefObject<boolean>;
  homeTeam: Team;
  awayTeam: Team;
  homeKit: KitSelection;
  awayKit: KitSelection;
  settings: GameSettings;
  cameraMode: GameSettings['visual']['cameraMode'];
  equippedOptions?: {
    ballId?: string;
    retroKitId?: string;
    stadiumThemeId?: string;
  };
  onBeforeEngineStep: (eng: MatchEngine, rawDt: number, now: number) => number;
  onAfterEngineRender: (eng: MatchEngine, shootChargePct: number, now: number) => void;
}

/**
 * Stadium3D Component
 * Replaces the 2D canvas render in MatchCanvas with a full Three.js + React Three Fiber
 * 3D Stadium & 1050x600 Pitch scene, ambient & floodlight stadium illumination,
 * lateral TV broadcast cameras, and software-WebGL pacing support while preserving
 * all match state and touch controls.
 */
export const Stadium3D: React.FC<Stadium3DProps> = ({
  engineRef,
  pausedRef,
  homeTeam,
  awayTeam,
  homeKit,
  awayKit,
  settings,
  cameraMode,
  equippedOptions,
  onBeforeEngineStep,
  onAfterEngineRender,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneControllerRef = useRef<MatchScene3DController | null>(null);
  const cameraModeRef = useRef(cameraMode);
  cameraModeRef.current = cameraMode;

  const onBeforeStepRef = useRef(onBeforeEngineStep);
  onBeforeStepRef.current = onBeforeEngineStep;

  const onAfterRenderRef = useRef(onAfterEngineRender);
  onAfterRenderRef.current = onAfterEngineRender;

  const fpsLimitRef = useRef<GameSettings['visual']['fpsLimit']>(settings.visual.fpsLimit ?? 60);
  fpsLimitRef.current = settings.visual.fpsLimit ?? 60;

  const cameraZoomRef = useRef<number>(settings.visual.cameraZoom);
  cameraZoomRef.current = settings.visual.cameraZoom;

  // Dynamically update 3D team kits whenever homeKit / awayKit changes
  const prevKitSigRef = useRef(`${homeTeam.id}|${awayTeam.id}|${homeKit}|${awayKit}`);
  useEffect(() => {
    const nextSig = `${homeTeam.id}|${awayTeam.id}|${homeKit}|${awayKit}`;
    if (prevKitSigRef.current !== nextSig) {
      prevKitSigRef.current = nextSig;
      sceneControllerRef.current?.updateTeamKits(homeTeam, awayTeam, homeKit, awayKit);
    }
  }, [homeTeam, awayTeam, homeKit, awayKit]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const controller = createMatchScene3D(
      mount,
      homeTeam,
      awayTeam,
      homeKit,
      awayKit,
      settings,
      equippedOptions
    );
    sceneControllerRef.current = controller;

    const updateSize = () => {
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      controller.resize(w, h);
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(mount);

    const gl = controller.renderer.getContext() as WebGL2RenderingContext | WebGLRenderingContext;
    const isSoftwareGl = controller.isSoftwareGl;

    let cancelled = false;
    let raf = 0;
    let timer = 0;
    let lastTime = performance.now();
    let lastRenderTime = 0;
    let drawnWhilePaused = false;

    const afterDraw = (cb: () => void) => {
      if (!isSoftwareGl) {
        raf = requestAnimationFrame(cb);
        return;
      }
      const gl2 = gl as WebGL2RenderingContext;
      if (typeof gl2.fenceSync === 'function') {
        const sync = gl2.fenceSync(gl2.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl2.flush();
        const poll = () => {
          if (cancelled) return;
          const s = gl2.clientWaitSync(sync!, 0, 0);
          if (s === gl2.ALREADY_SIGNALED || s === gl2.CONDITION_SATISFIED) {
            gl2.deleteSync(sync);
            timer = window.setTimeout(cb, 80);
          } else {
            timer = window.setTimeout(poll, 16);
          }
        };
        timer = window.setTimeout(poll, 16);
      } else {
        gl.finish();
        timer = window.setTimeout(cb, 80);
      }
    };

    const tick = () => {
      if (cancelled) return;
      const now = performance.now();

      const fpsLimit = fpsLimitRef.current ?? 60;
      const minFrameMs = fpsLimit === 30 ? 32.5 : fpsLimit === 60 ? 15.2 : 0;

      if (!isSoftwareGl && minFrameMs > 0 && now - lastRenderTime < minFrameMs) {
        raf = requestAnimationFrame(tick);
        return;
      }
      lastRenderTime = now;

      const rawDt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const eng = engineRef.current;
      if (eng) {
        if (pausedRef.current && drawnWhilePaused) {
          afterDraw(tick);
          return;
        }
        drawnWhilePaused = pausedRef.current;

        const shootChargePct = onBeforeStepRef.current(eng, rawDt, now);

        controller.updateAndRender(
          eng,
          rawDt,
          now,
          cameraModeRef.current,
          cameraZoomRef.current,
          shootChargePct
        );

        onAfterRenderRef.current(eng, shootChargePct, now);
      }

      afterDraw(tick);
    };

    tick();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      ro.disconnect();
      controller.dispose();
      sceneControllerRef.current = null;
    };
    // Mount WebGLRenderer once per Stadium3D lifecycle so HUD state updates never recreate the WebGL context
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={mountRef}
      data-testid="stadium-3d"
      data-pitch-scale={`${STADIUM_3D_DIMENSIONS.width}x${STADIUM_3D_DIMENSIONS.height}`}
      data-camera-mode={cameraMode}
      className="w-full h-full"
    />
  );
};

export default Stadium3D;
