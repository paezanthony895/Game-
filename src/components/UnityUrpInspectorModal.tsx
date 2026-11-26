import React, { useState } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  Cpu,
  Layers,
  Sun,
  Sunset,
  Moon,
  Terminal,
  FileCode,
  HardDrive,
  Gauge,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  UNITY_URP_SOURCE_FILES,
  UNITY_EXTERNAL_ASSETS_MANIFEST,
  UNITY_QUALITY_TIER_PROFILES,
  UNITY_DELIVERABLE_STATUS_LIST,
  UNITY_IMPORT_AND_APK_BUILD_STEPS,
  buildUnityProjectBundleText,
} from '../unity/unityUrpSuite';
import { EXPANDED_PITCH_SCALE, getScaledPitchDimensions } from '../engine/physics';
import { StadiumPerformanceTelemetry } from '../engine/scene3d';
import { GameSettings } from '../types/football';

interface UnityUrpInspectorModalProps {
  onClose: () => void;
  telemetry?: StadiumPerformanceTelemetry | null;
  currentTimeOfDay?: GameSettings['match']['timeOfDay'];
  currentQuality?: GameSettings['visual']['quality'];
  onChangeTimeOfDay?: (tod: GameSettings['match']['timeOfDay']) => void;
  onChangeQuality?: (q: GameSettings['visual']['quality']) => void;
}

type InspectorTab =
  | 'code'
  | 'assets'
  | 'performance'
  | 'status'
  | 'apk';

export const UnityUrpInspectorModal: React.FC<UnityUrpInspectorModalProps> = ({
  onClose,
  telemetry,
  currentTimeOfDay = 'noche',
  currentQuality = 'alta',
  onChangeTimeOfDay,
  onChangeQuality,
}) => {
  const [activeTab, setActiveTab] = useState<InspectorTab>('code');
  const [selectedFileId, setSelectedFileId] = useState<string>(UNITY_URP_SOURCE_FILES[0].id);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const selectedFile =
    UNITY_URP_SOURCE_FILES.find((f) => f.id === selectedFileId) ?? UNITY_URP_SOURCE_FILES[0];
  const scaledDims = getScaledPitchDimensions();

  const handleCopyCode = (id: string, text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleDownloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadFullBundle = () => {
    const bundleText = buildUnityProjectBundleText();
    handleDownloadFile('AtlasFutbol_Unity2022LTS_URP_80K_140x90m_Suite.txt', bundleText);
  };

  return (
    <div
      data-testid="unity-urp-inspector-modal"
      className="fixed inset-0 z-[120] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden"
    >
      <div className="w-full max-w-6xl h-[92vh] bg-slate-900 border border-cyan-500/35 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Top Engineering Header */}
        <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-black tracking-wider uppercase text-white">
                  INGENIERÍA UNITY 2022 LTS URP · ESTADIO 80.000 & CAMPO 140×90 M
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded">
                  IL2CPP · ARM64 · VULKAN / GLES3
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Factor Escala Constante:{' '}
                <span className="text-cyan-300 font-mono font-semibold">
                  PITCH_SCALE_FACTOR = {EXPANDED_PITCH_SCALE.FACTOR.toFixed(4)}x
                </span>{' '}
                ({scaledDims.lengthM}×{scaledDims.widthM} m · Área Penal {scaledDims.penaltyAreaLengthM}×
                {scaledDims.penaltyAreaWidthM} m · Círculo R={scaledDims.centerCircleRadiusM} m)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="download-unity-bundle-btn"
              onClick={handleDownloadFullBundle}
              className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Descargar Suite Unity ({UNITY_URP_SOURCE_FILES.length} Archivos)
            </button>
            <button
              type="button"
              data-testid="close-unity-inspector-btn"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              aria-label="Cerrar Inspector Unity URP"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Stadium Controls & Telemetry Bar */}
        <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Live Day / Afternoon / Night Switcher without scene reload */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Ciclo Lightmap / Skybox (Sin Recargar Escena):
            </span>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              {(
                [
                  { id: 'dia', label: 'Día', icon: Sun },
                  { id: 'atardecer', label: 'Tarde', icon: Sunset },
                  { id: 'noche', label: 'Noche (6 Torres)', icon: Moon },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const active = (telemetry?.timeOfDay ?? currentTimeOfDay) === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={`lighting-cycle-${item.id}`}
                    onClick={() => onChangeTimeOfDay?.(item.id)}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition cursor-pointer ${
                      active
                        ? 'bg-amber-500 text-slate-950 shadow'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quality Tier Switcher */}
          {onChangeQuality && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Calidad URP:
              </span>
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                {(['baja', 'media', 'alta', 'ultra'] as const).map((q) => {
                  const active = (telemetry?.qualityTier ?? currentQuality) === q;
                  return (
                    <button
                      key={q}
                      type="button"
                      data-testid={`quality-tier-${q}`}
                      onClick={() => onChangeQuality(q)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase transition cursor-pointer ${
                        active
                          ? 'bg-cyan-500 text-slate-950'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {q}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Real-Time Engine Telemetry Badges */}
          <div className="flex items-center gap-2 flex-wrap font-mono text-[11px]">
            <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-emerald-400">
              Cancha: 140×90 m (1 Plano · 2 Tris)
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-cyan-300">
              Capacidad: 80.000 (GPU Vertex Instancing)
            </span>
            {telemetry && (
              <>
                <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-amber-300">
                  FPS: {telemetry.fps} / {telemetry.targetFps} ({telemetry.frameTimeMs} ms)
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-purple-300">
                  Res. Dinámica: {telemetry.renderScalePct}%
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                  Sectores Activos: {telemetry.activeSectors}/{telemetry.activeSectors + telemetry.culledSectors}
                </span>
              </>
            )}
          </div>
        </div>

        {/* 5 Deliverables Navigation Tabs */}
        <div className="px-4 pt-2 bg-slate-950 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto">
          {(
            [
              {
                id: 'code',
                label: `1. Código Unity C# y Shaders HLSL (${UNITY_URP_SOURCE_FILES.length})`,
                icon: FileCode,
              },
              {
                id: 'assets',
                label: `2. Lista de Assets Externos ASTC (${UNITY_EXTERNAL_ASSETS_MANIFEST.length})`,
                icon: HardDrive,
              },
              {
                id: 'performance',
                label: '3. Perfil de Rendimiento (Baja / Media / Alta / Ultra)',
                icon: Gauge,
              },
              {
                id: 'status',
                label: '4. Estado Implementado vs Pendiente',
                icon: CheckCircle2,
              },
              {
                id: 'apk',
                label: '5. Guía de Importación y Compilación APK Android',
                icon: Terminal,
              },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`unity-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 rounded-t-lg text-xs font-bold flex items-center gap-1.5 border-b-2 transition whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-cyan-300 border-cyan-400'
                    : 'text-slate-400 hover:text-slate-200 border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* TAB 1: UNITY C# & HLSL SOURCE CODE */}
          {activeTab === 'code' && (
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* File Tree Sidebar */}
              <div className="w-full md:w-80 bg-slate-950/70 border-b md:border-b-0 md:border-r border-slate-800 overflow-y-auto p-3 space-y-1.5 max-h-48 md:max-h-none">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 pb-1">
                  Archivos del Proyecto Unity 2022 LTS
                </div>
                {UNITY_URP_SOURCE_FILES.map((file) => {
                  const active = file.id === selectedFile.id;
                  return (
                    <button
                      key={file.id}
                      type="button"
                      data-testid={`unity-file-${file.id}`}
                      onClick={() => setSelectedFileId(file.id)}
                      className={`w-full text-left p-2.5 rounded-lg border transition cursor-pointer ${
                        active
                          ? 'bg-cyan-500/15 border-cyan-400/50 text-white'
                          : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300">
                          {file.category}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 uppercase">
                          {file.language}
                        </span>
                      </div>
                      <div className="text-xs font-bold mt-1 truncate text-slate-100">
                        {file.relativePath.split('/').pop()}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 truncate">
                        {file.relativePath}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Code Viewer Pane */}
              <div className="flex-1 flex flex-col overflow-hidden bg-slate-900">
                <div className="p-3 bg-slate-950/50 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-mono text-cyan-300">{selectedFile.relativePath}</div>
                    <h3 className="text-sm font-black text-white">{selectedFile.title}</h3>
                    <p className="text-xs text-slate-400 mt-0.5 max-w-3xl">{selectedFile.summary}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {selectedFile.optimizationsCovered.map((opt, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 text-[10px] font-semibold rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                        >
                          ✓ {opt}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyCode(selectedFile.id, selectedFile.code)}
                      className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
                    >
                      {copiedId === selectedFile.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copiar Código
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleDownloadFile(
                          selectedFile.relativePath.split('/').pop() || 'script.cs',
                          selectedFile.code
                        )
                      }
                      className="px-2.5 py-1.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-xs font-bold text-cyan-200 flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Descargar Archivo
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-4 bg-slate-950 font-mono text-xs leading-relaxed text-slate-200 select-all">
                  <pre className="whitespace-pre overflow-x-auto">{selectedFile.code}</pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EXTERNAL ASSETS MANIFEST (ASTC & MESHES) */}
          {activeTab === 'assets' && (
            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-black uppercase text-white">
                    Manifiesto Exacto de Assets Externos (Compresión ASTC, Atlas y Mipmaps)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Cumple la regla obligatoria #7: compresión ASTC en todas las texturas, mipmaps activos, atlas compartidos, máximo 2048 px para estructura del estadio y 1024 px para elementos secundarios.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-xs font-bold">
                  VRAM Total Texturas + Mallas: ~25.24 MB
                </span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950 text-slate-300 border-b border-slate-800 uppercase text-[11px]">
                      <th className="p-3">Nombre del Asset</th>
                      <th className="p-3">Tipo</th>
                      <th className="p-3">Resolución / Triángulos</th>
                      <th className="p-3">Formato Android</th>
                      <th className="p-3">Mipmaps</th>
                      <th className="p-3">Memoria</th>
                      <th className="p-3">Uso en el Estadio 80K</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 bg-slate-900/60">
                    {UNITY_EXTERNAL_ASSETS_MANIFEST.map((asset) => (
                      <tr key={asset.id} className="hover:bg-slate-800/40">
                        <td className="p-3 font-mono font-bold text-cyan-300">{asset.name}</td>
                        <td className="p-3 text-slate-300">{asset.type}</td>
                        <td className="p-3 font-mono text-amber-300">{asset.resolutionOrTris}</td>
                        <td className="p-3 font-mono text-emerald-300">{asset.androidFormat}</td>
                        <td className="p-3">
                          {asset.mipmaps ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                              ACTIVOS
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                              N/A
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-slate-200">{asset.memoryFootprintMb}</td>
                        <td className="p-3 text-slate-400 max-w-xs">{asset.usage}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: PERFORMANCE PROFILE PER QUALITY TIER */}
          {activeTab === 'performance' && (
            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-200">
                  <span className="font-black text-amber-300 uppercase">
                    Transparencia de Ingeniería (Sin Benchmarks Inventados):{' '}
                  </span>
                  La tabla distingue explícitamente las métricas verificadas y medidas en nuestro motor 3D WebGL activo en este entorno frente a las estimaciones de ingeniería proyectadas para hardware físico Android (Snapdragon serie 7 y gama baja), dado que el binario propietario de Unity Editor / Android NDK no se ejecuta dentro de este contenedor web.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {UNITY_QUALITY_TIER_PROFILES.map((prof) => (
                  <div
                    key={prof.tier}
                    className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                          Perfil de Calidad URP
                        </span>
                        <h4 className="text-base font-black uppercase text-white">
                          Calidad {prof.tier}
                        </h4>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-black">
                        {prof.targetFps}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5 text-xs">
                      <div>
                        <span className="text-slate-400 font-semibold">Dispositivo Objetivo: </span>
                        <span className="text-slate-200">{prof.targetDeviceClass}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-semibold">Escala Resolución Dinámica: </span>
                        <span className="text-cyan-300 font-mono">{prof.renderScaleRange}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-semibold">Iluminación y Sombras: </span>
                        <span className="text-slate-200">{prof.shadowConfig}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-semibold">Público GPU Instanced: </span>
                        <span className="text-slate-200">{prof.crowdInstancesRendered}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-semibold">Post-Procesado: </span>
                        <span className="text-slate-200">{prof.postProcessingActive}</span>
                      </div>
                      <div className="flex flex-wrap gap-3 pt-1">
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] text-amber-300">
                          {prof.drawCallsStadiumAndCrowd}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] text-purple-300">
                          {prof.totalTrianglesVisible}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] text-emerald-300">
                          {prof.vramAndRamBudget}
                        </span>
                      </div>
                      <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-1 text-[11px]">
                        <div className="text-emerald-300">
                          <strong>✓ Medido en Motor 3D Activo:</strong> {prof.measuredWebGlEngine}
                        </div>
                        <div className="text-amber-300">
                          <strong>⊙ Estimado en Hardware Android:</strong> {prof.estimatedAndroidHardware}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: IMPLEMENTED VS PENDING STATUS */}
          {activeTab === 'status' && (
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {UNITY_DELIVERABLE_STATUS_LIST.map((item) => {
                const isLive = item.status.startsWith('IMPLEMENTADO');
                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h4 className="text-xs sm:text-sm font-black text-white">
                        {item.requirement}
                      </h4>
                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                          isLive
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <div className="text-xs text-cyan-300">
                      <strong>Verificación:</strong> {item.verificationMethod}
                    </div>
                    <div className="text-xs text-slate-400">{item.notes}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 5: UNITY IMPORT & ANDROID APK COMPILATION STEPS */}
          {activeTab === 'apk' && (
            <div className="flex-1 overflow-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-cyan-300">
                  <Layers className="w-5 h-5" />
                  <h3 className="text-sm font-black uppercase">
                    A. Instrucciones Paso a Paso para Importar en Unity 2022 LTS
                  </h3>
                </div>
                <div className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
                  {UNITY_IMPORT_AND_APK_BUILD_STEPS.unityImportSteps.map((step, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80">
                      {step}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-emerald-300">
                  <Terminal className="w-5 h-5" />
                  <h3 className="text-sm font-black uppercase">
                    B. Compilación del APK Android (IL2CPP · ARM64 · Vulkan + OpenGLES3)
                  </h3>
                </div>
                <div className="space-y-2.5 text-xs text-slate-300 leading-relaxed font-mono">
                  {UNITY_IMPORT_AND_APK_BUILD_STEPS.androidApkBuildSteps.map((step, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 whitespace-pre-wrap">
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
