import React, { useState } from 'react';
import { Sliders, Monitor, Volume2, Gamepad2, User, RotateCcw, Flame } from 'lucide-react';
import { DIFFICULTY_CONFIG_TABLE } from '../engine/ai';
import {
  RACING_TITANS_CONFIG,
  isRacingTitansMasterFlagEnabled,
} from '../engine/racingTitansEasterEgg';
import {
  DIFFICULTY_LABELS,
  type DifficultyLevel,
  type GameSettings,
  type PitchCondition,
  type Team,
  type TimeOfDay,
  type WeatherType,
} from '../types/football';

interface SettingsModalProps {
  settings: GameSettings;
  teams: Team[];
  onChange: (next: GameSettings) => void;
  onResetAllSave: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  teams,
  onChange,
  onResetAllSave,
}) => {
  const [tab, setTab] = useState<'match' | 'visual' | 'audio' | 'controls' | 'profile'>('match');
  const [confirmReset, setConfirmReset] = useState(false);

  const updateMatch = <K extends keyof GameSettings['match']>(k: K, v: GameSettings['match'][K]) => {
    onChange({ ...settings, match: { ...settings.match, [k]: v } });
  };
  const updateVisual = <K extends keyof GameSettings['visual']>(k: K, v: GameSettings['visual'][K]) => {
    onChange({ ...settings, visual: { ...settings.visual, [k]: v } });
  };
  const updateAudio = <K extends keyof GameSettings['audio']>(k: K, v: GameSettings['audio'][K]) => {
    onChange({ ...settings, audio: { ...settings.audio, [k]: v } });
  };
  const updateControls = <K extends keyof GameSettings['controls']>(k: K, v: GameSettings['controls'][K]) => {
    onChange({ ...settings, controls: { ...settings.controls, [k]: v } });
  };
  const updateProfile = <K extends keyof GameSettings['profile']>(k: K, v: GameSettings['profile'][K]) => {
    onChange({ ...settings, profile: { ...settings.profile, [k]: v } });
  };

  const activeDiffRow = DIFFICULTY_CONFIG_TABLE[settings.match.difficulty] ?? DIFFICULTY_CONFIG_TABLE[4];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl font-extrabold text-white">Configuración Completa</h2>
        <p className="text-sm text-slate-400">
          Ajustes de partido, gráficos, audio con dupla de relatores IA, modo hinchada picante y controles móviles.
        </p>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {[
          { id: 'match', label: 'Partido y Dificultad', icon: Sliders },
          { id: 'controls', label: 'Controles Móviles', icon: Gamepad2 },
          { id: 'visual', label: 'Gráficos y Cámara', icon: Monitor },
          { id: 'audio', label: 'Sonido e Hinchada', icon: Volume2 },
          { id: 'profile', label: 'Perfil y Guardado', icon: User },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as typeof tab)}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer ${
                tab === t.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#101923] border border-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Match Settings */}
      {tab === 'match' && (
        <div className="rounded-xl bg-[#101923] border border-slate-800 p-5 grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          <div className="md:col-span-2">
            <label className="block text-slate-300 font-semibold mb-2">
              Nivel de Dificultad IA: <span className="text-emerald-400">{settings.match.difficulty}. {DIFFICULTY_LABELS[settings.match.difficulty]}</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {([1, 2, 3, 4, 5, 6, 7, 8] as DifficultyLevel[]).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => updateMatch('difficulty', lvl)}
                  className={`rounded-lg px-3 py-2.5 font-semibold border text-left cursor-pointer ${
                    settings.match.difficulty === lvl
                      ? lvl >= 7
                        ? 'bg-rose-700 border-rose-400 text-white'
                        : 'bg-emerald-600 border-emerald-400 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span className="font-mono-tabular mr-1.5">{lvl}.</span>
                  {DIFFICULTY_LABELS[lvl]}
                </button>
              ))}
            </div>

            {/* Explicit Difficulty Configuration Parameters Readout */}
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-6 gap-2 rounded-lg bg-slate-950/90 border border-slate-800 p-2.5 text-[11px]">
              <div>
                <span className="text-slate-400 block">Velocidad IA</span>
                <strong className="font-mono-tabular text-emerald-400">{Math.round(activeDiffRow.aiSpeedMultiplier * 100)}%</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Reacción IA</span>
                <strong className="font-mono-tabular text-amber-400">{activeDiffRow.reactionTimeSec.toFixed(3)} s</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Precisión Pase</span>
                <strong className="font-mono-tabular text-sky-400">{Math.round(activeDiffRow.passAccuracy * 100)}%</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Precisión Tiro</span>
                <strong className="font-mono-tabular text-rose-400">{Math.round(activeDiffRow.shotAccuracy * 100)}%</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Presión Bloque</span>
                <strong className="font-mono-tabular text-purple-400">{Math.round(activeDiffRow.pressFrequency * 100)}%</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Reflejos GK</span>
                <strong className="font-mono-tabular text-emerald-300">{Math.round(activeDiffRow.gkReflexes * 100)}%</strong>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Duración por tiempo</label>
            <select
              value={settings.match.halfDurationMinutes}
              onChange={(e) => updateMatch('halfDurationMinutes', Number(e.target.value) as GameSettings['match']['halfDurationMinutes'])}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
            >
              <option value={2}>2 minutos (Relámpago)</option>
              <option value={3}>3 minutos (Estándar)</option>
              <option value={4}>4 minutos</option>
              <option value={5}>5 minutos</option>
              <option value={8}>8 minutos</option>
              <option value={10}>10 minutos (Largo)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Velocidad del juego</label>
            <select
              value={settings.match.gameSpeed}
              onChange={(e) => updateMatch('gameSpeed', e.target.value as GameSettings['match']['gameSpeed'])}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
            >
              <option value="lento">Pausado</option>
              <option value="normal">Normal</option>
              <option value="rapido">Rápido</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Clima</label>
            <select
              value={settings.match.weather}
              onChange={(e) => updateMatch('weather', e.target.value as WeatherType)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
            >
              <option value="despejado">Despejado</option>
              <option value="lluvia">Lluvia</option>
              <option value="tormenta">⚡ Tormenta Eléctrica (99% Rayo)</option>
              <option value="nieve">Nieve</option>
              <option value="viento">Viento Fuerte</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Horario</label>
            <select
              value={settings.match.timeOfDay}
              onChange={(e) => updateMatch('timeOfDay', e.target.value as TimeOfDay)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
            >
              <option value="dia">Día</option>
              <option value="atardecer">Atardecer</option>
              <option value="noche">Noche (Reflectores)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Estado del campo</label>
            <select
              value={settings.match.pitchCondition}
              onChange={(e) => updateMatch('pitchCondition', e.target.value as PitchCondition)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
            >
              <option value="optimo">Óptimo</option>
              <option value="humedo">Húmedo (balón rápido)</option>
              <option value="pesado">Pesado</option>
              <option value="barro">Barro</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Sustituciones máximas</label>
            <select
              value={settings.match.maxSubstitutions}
              onChange={(e) => updateMatch('maxSubstitutions', Number(e.target.value) as 3 | 5)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
            >
              <option value={3}>3 cambios</option>
              <option value={5}>5 cambios</option>
            </select>
          </div>

          <div className="md:col-span-2 flex flex-wrap gap-5 pt-2">
            {[
              ['offsideEnabled', 'Regla de Fuera de Juego'],
              ['extraTimeEnabled', 'Prórroga en eliminatorias'],
              ['penaltiesEnabled', 'Definición por Penales'],
            ].map(([k, label]) => (
              <label key={k} className="inline-flex items-center gap-2 text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(settings.match[k as keyof GameSettings['match']])}
                  onChange={(e) => updateMatch(k as 'offsideEnabled', e.target.checked)}
                  className="w-4 h-4 accent-emerald-500"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          {isRacingTitansMasterFlagEnabled() && (
            <div className="md:col-span-2 mt-2 rounded-xl border border-sky-500/40 bg-gradient-to-r from-sky-950/60 via-slate-950 to-sky-950/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-sky-400" />
                  <span className="font-display text-sm font-extrabold uppercase tracking-wider text-sky-300">
                    Huevo de Pascua: Racing Titanes ({RACING_TITANS_CONFIG.TITAN_HEIGHT_SCALE}x Gigantes)
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                      settings.match.racingTitansUnlocked
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {settings.match.racingTitansUnlocked ? 'Desbloqueado' : 'Secreto (Toca 7 veces el escudo de Racing)'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Cuando Racing Club juega (tuyo o rival), sus 11 jugadores miden {RACING_TITANS_CONFIG.TITAN_HEIGHT_SCALE}x, tienen todos los atributos en 100, IA Suprema sin errores, inmunidad a barridas y pisadas sísmicas.
                </p>
              </div>
              <label
                data-testid="toggle-racing-titans"
                className="inline-flex items-center gap-2.5 rounded-lg bg-slate-900/90 border border-sky-500/40 px-3.5 py-2 text-xs font-bold text-sky-200 cursor-pointer shrink-0 hover:border-sky-400"
              >
                <input
                  type="checkbox"
                  checked={Boolean(settings.match.racingTitansEnabled)}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    onChange({
                      ...settings,
                      match: {
                        ...settings.match,
                        racingTitansUnlocked: settings.match.racingTitansUnlocked || enabled,
                        racingTitansEnabled: enabled,
                      },
                    });
                  }}
                  className="w-4 h-4 accent-sky-400"
                />
                <span>{settings.match.racingTitansEnabled ? 'Activado' : 'Activar Racing Titanes'}</span>
              </label>
            </div>
          )}
        </div>
      )}

      {/* Mobile Touch Controls */}
      {tab === 'controls' && (
        <div className="rounded-xl bg-[#101923] border border-slate-800 p-5 grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          <div>
            <label className="block text-slate-400 mb-1">Esquema de controles</label>
            <select
              value={settings.controls.scheme}
              onChange={(e) => updateControls('scheme', e.target.value as GameSettings['controls']['scheme'])}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
            >
              <option value="classic">Clásico Completo (6 botones + Joystick)</option>
              <option value="simplified">Simplificado (Pasar / Tiro / Sprint)</option>
              <option value="auto_assist">Asistido Máximo</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Tamaño de botones ({Math.round(settings.controls.buttonSize * 100)}%)</label>
            <input
              type="range"
              min={0.75}
              max={1.4}
              step={0.05}
              value={settings.controls.buttonSize}
              onChange={(e) => updateControls('buttonSize', Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Tamaño del Joystick ({Math.round(settings.controls.joystickSize * 100)}%)</label>
            <input
              type="range"
              min={0.75}
              max={1.4}
              step={0.05}
              value={settings.controls.joystickSize}
              onChange={(e) => updateControls('joystickSize', Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Sensibilidad del Joystick ({settings.controls.sensitivity.toFixed(1)}x)</label>
            <input
              type="range"
              min={0.6}
              max={1.5}
              step={0.1}
              value={settings.controls.sensitivity}
              onChange={(e) => updateControls('sensitivity', Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Margen inferior ({settings.controls.bottomOffset} px)</label>
            <input
              type="range"
              min={0}
              max={48}
              step={4}
              value={settings.controls.bottomOffset}
              onChange={(e) => updateControls('bottomOffset', Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Margen lateral ({settings.controls.sideOffset} px)</label>
            <input
              type="range"
              min={0}
              max={48}
              step={4}
              value={settings.controls.sideOffset}
              onChange={(e) => updateControls('sideOffset', Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
          </div>

          <div className="md:col-span-2 flex flex-wrap gap-5 pt-2">
            {[
              ['vibration', 'Vibración háptica'],
              ['passAssist', 'Ayuda de pase'],
              ['shotAssist', 'Ayuda de disparo'],
              ['alwaysShowTouchControls', 'Mostrar controles táctiles también en PC'],
            ].map(([k, label]) => (
              <label key={k} className="inline-flex items-center gap-2 text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(settings.controls[k as keyof GameSettings['controls']])}
                  onChange={(e) => updateControls(k as 'vibration', e.target.checked)}
                  className="w-4 h-4 accent-emerald-500"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Visual Settings */}
      {tab === 'visual' && (
        <div className="rounded-xl bg-[#101923] border border-slate-800 p-5 grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          <div>
            <label className="block text-slate-400 mb-1">Calidad gráfica 3D (Three.js WebGL)</label>
            <select
              value={settings.visual.quality}
              onChange={(e) => updateVisual('quality', e.target.value as GameSettings['visual']['quality'])}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
            >
              <option value="baja">Baja (Máximo ahorro batería)</option>
              <option value="media">Media</option>
              <option value="alta">Alta (Estadio 3D + Público)</option>
              <option value="ultra">Ultra (Máximo detalle 3D + Sombras)</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-400 mb-1">Cámara de transmisión 3D</label>
            <select
              value={settings.visual.cameraMode}
              onChange={(e) => updateVisual('cameraMode', e.target.value as GameSettings['visual']['cameraMode'])}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
            >
              <option value="broadcast">TV Lateral (Principal)</option>
              <option value="panoramica">Panorámica Táctica</option>
              <option value="dinamica">Cercana a la Jugada 3D</option>
              <option value="tele">Teleobjetivo TV</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-400 mb-1">Límite de FPS (Fluidez 3D)</label>
            <select
              value={String(settings.visual.fpsLimit ?? 60)}
              onChange={(e) => {
                const v = e.target.value;
                updateVisual('fpsLimit', v === 'auto' ? 'auto' : (Number(v) as 30 | 60 | 120));
              }}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
            >
              <option value="120">120 FPS (Ultra Fluido Pro)</option>
              <option value="60">60 FPS (Estándar TV)</option>
              <option value="30">30 FPS (Ahorro Batería Móvil)</option>
              <option value="auto">Automático (Sin Límite)</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-400 mb-1">Zoom de cámara ({settings.visual.cameraZoom.toFixed(2)}x)</label>
            <input
              type="range"
              min={0.8}
              max={1.3}
              step={0.05}
              value={settings.visual.cameraZoom}
              onChange={(e) => updateVisual('cameraZoom', Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
          </div>
          <div className="md:col-span-2 flex flex-wrap gap-4 items-center">
            {[
              ['forceLandscape', 'Orientación Horizontal Obligatoria (Partidos 16:9)'],
              ['adaptiveResolution', 'Resolución adaptable móvil'],
              ['shadows', 'Sombras 3D en cancha'],
              ['effects', 'Efectos climáticos 3D y focos'],
              ['animations', 'Repeticiones 3D de gol'],
              ['showRadar', 'Radar táctico'],
              ['showStaminaBars', 'Barras de resistencia'],
            ].map(([k, label]) => (
              <label key={k} className="inline-flex items-center gap-2 text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(settings.visual[k as keyof GameSettings['visual']] ?? true)}
                  onChange={(e) => updateVisual(k as 'shadows', e.target.checked)}
                  className="w-4 h-4 accent-emerald-500"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Audio & Professional Commentator Settings */}
      {tab === 'audio' && (
        <div className="rounded-xl bg-[#101923] border border-slate-800 p-5 space-y-4 text-xs max-w-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-slate-200 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={settings.audio.masterMuted}
                onChange={(e) => updateAudio('masterMuted', e.target.checked)}
                className="w-4 h-4 accent-emerald-500"
              />
              <span>Silenciar todo el sonido</span>
            </label>

            <label className="inline-flex items-center gap-2 text-emerald-300 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={settings.audio.commentaryEnabled !== false}
                onChange={(e) => updateAudio('commentaryEnabled', e.target.checked)}
                className="w-4 h-4 accent-emerald-500"
              />
              <span>Activar Relator + Comentarista en Vivo (Gemini TTS Dual)</span>
            </label>

            <label
              data-testid="toggle-spicy-crowd"
              className="inline-flex items-center gap-2 text-amber-300 font-semibold cursor-pointer"
            >
              <input
                type="checkbox"
                checked={settings.audio.spicyCrowdMode !== false}
                onChange={(e) => updateAudio('spicyCrowdMode', e.target.checked)}
                className="w-4 h-4 accent-amber-500"
              />
              <span>Modo hinchada picante (cánticos e insultos de cancha)</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-slate-400 mb-1">Estilo de Relato (Transmisión Original)</label>
              <select
                value={settings.audio.commentaryStyle ?? 'argentino_pro'}
                onChange={(e) =>
                  updateAudio(
                    'commentaryStyle',
                    e.target.value as NonNullable<GameSettings['audio']['commentaryStyle']>
                  )
                }
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
              >
                <option value="argentino_pro">Relator Argentino Pro (Estilo Transmisión Clásica)</option>
                <option value="latino_dinamico">Relator Latinoamericano Dinámico</option>
                <option value="english_tv">English TV Broadcast</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Idioma / Voz del Relator</label>
              <select
                value={settings.audio.commentaryLanguage ?? 'es-AR'}
                onChange={(e) =>
                  updateAudio(
                    'commentaryLanguage',
                    e.target.value as NonNullable<GameSettings['audio']['commentaryLanguage']>
                  )
                }
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
              >
                <option value="es-AR">Español Argentino (es-AR)</option>
                <option value="es-419">Español Latinoamericano (es-419)</option>
                <option value="en-US">English (en-US)</option>
              </select>
            </div>
          </div>

          {[
            ['commentaryVolume', 'Volumen del Relator de Fútbol'],
            ['crowdVolume', 'Ambiente de Tribuna y Celebraciones'],
            ['sfxVolume', 'Efectos de Cancha (balón, silbato, postes)'],
            ['musicVolume', 'Música de Menú'],
          ].map(([k, label]) => {
            const val = Number(settings.audio[k as keyof GameSettings['audio']] ?? 0.8);
            return (
              <div key={k}>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>{label}</span>
                  <span className="font-mono-tabular">{Math.round(val * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={val}
                  onChange={(e) => updateAudio(k as 'sfxVolume', Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Profile & Save Management */}
      {tab === 'profile' && (
        <div className="rounded-xl bg-[#101923] border border-slate-800 p-5 grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          <div>
            <label className="block text-slate-400 mb-1">Nombre de usuario</label>
            <input
              type="text"
              value={settings.profile.userName}
              onChange={(e) => updateProfile('userName', e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1">Equipo favorito</label>
            <select
              value={settings.profile.favoriteTeamId}
              onChange={(e) => updateProfile('favoriteTeamId', e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
            >
              {teams.slice(0, 80).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-slate-400 mb-1">Idioma</label>
            <select
              value={settings.profile.language}
              onChange={(e) => updateProfile('language', e.target.value as 'es' | 'en')}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
            >
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-400 mb-1">Color del avatar</label>
            <input
              type="color"
              value={settings.profile.avatarColor}
              onChange={(e) => updateProfile('avatarColor', e.target.value)}
              className="w-20 h-10 rounded bg-transparent cursor-pointer"
            />
          </div>

          <div className="md:col-span-2 pt-3 border-t border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">Los progresos se guardan automáticamente en almacenamiento local offline.</span>
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 px-3 py-2 text-rose-300 hover:bg-rose-950/30 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restablecer Datos</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onResetAllSave();
                    setConfirmReset(false);
                  }}
                  className="rounded-lg bg-rose-600 px-3 py-2 text-white font-bold cursor-pointer"
                >
                  Confirmar Borrado
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="rounded-lg bg-slate-800 px-3 py-2 text-slate-300 cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
