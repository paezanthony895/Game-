import React, { useMemo, useState } from 'react';
import { Compass, Code2, Shield, Sparkles, Swords, Users } from 'lucide-react';
import {
  FORMATIONS,
  FORMATION_CATEGORIES,
  getFormation,
  type FormationCategory,
  type FormationDefinition,
  type FormationStyle,
  type TacticalPositionCode,
} from '../data/formations';
import type { Team } from '../types/football';

interface TacticalFormationBoardProps {
  selectedFormationId: string;
  onSelectFormation: (formationId: string) => void;
  team?: Team | null;
  compact?: boolean;
  title?: string;
}

function getPositionColorClasses(pos: TacticalPositionCode): {
  bg: string;
  border: string;
  badge: string;
} {
  switch (pos) {
    case 'POR':
      return {
        bg: 'bg-amber-500 text-slate-950',
        border: 'border-amber-200 ring-amber-400/50',
        badge: 'bg-amber-950/90 text-amber-300 border-amber-500/50',
      };
    case 'DFC':
    case 'LIB':
    case 'LI':
    case 'LD':
    case 'CAI':
    case 'CAD':
      return {
        bg: 'bg-sky-500 text-slate-950',
        border: 'border-sky-200 ring-sky-400/50',
        badge: 'bg-sky-950/90 text-sky-300 border-sky-500/50',
      };
    case 'MCD':
    case 'MC':
    case 'MI':
    case 'MD':
    case 'MCO':
      return {
        bg: 'bg-emerald-500 text-slate-950',
        border: 'border-emerald-200 ring-emerald-400/50',
        badge: 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50',
      };
    case 'EI':
    case 'ED':
    case 'SD':
    case 'F9':
    case 'DC':
      return {
        bg: 'bg-rose-500 text-white',
        border: 'border-rose-200 ring-rose-400/50',
        badge: 'bg-rose-950/90 text-rose-200 border-rose-500/50',
      };
  }
}

function getStyleBadgeClass(estilo: FormationStyle): string {
  switch (estilo) {
    case 'Posesión':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    case 'Presión Alta':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    case 'Contragolpe':
      return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
    case 'Defensiva':
      return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
    case 'Ultra Ofensiva':
      return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    case 'Equilibrada':
    default:
      return 'bg-slate-700/60 text-slate-200 border-slate-600';
  }
}

export const TacticalFormationBoard: React.FC<TacticalFormationBoardProps> = ({
  selectedFormationId,
  onSelectFormation,
  team,
  compact = false,
  title = 'Laboratorio y Pizarra de Formaciones Tácticas (11v11)',
}) => {
  const activeFormation: FormationDefinition = useMemo(
    () => getFormation(selectedFormationId),
    [selectedFormationId]
  );

  const [activeCategory, setActiveCategory] = useState<FormationCategory | 'Todas'>('Todas');
  const [selectedSlotNumber, setSelectedSlotNumber] = useState<number | null>(null);
  const [showJsonInspector, setShowJsonInspector] = useState(false);

  const filteredFormations = useMemo(() => {
    if (activeCategory === 'Todas') return FORMATIONS;
    return FORMATIONS.filter((f) => f.categoria === activeCategory);
  }, [activeCategory]);

  // Calcular líneas tácticas de conexión entre compañeros cercanos para visualización en cancha
  const tacticalLinks = useMemo(() => {
    const links: Array<{ key: string; x1: number; y1: number; x2: number; y2: number }> = [];
    const pts = activeFormation.jugadores;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        if (pts[i].posicion === 'POR' || pts[j].posicion === 'POR') continue;
        const dist = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        if (dist <= 27) {
          links.push({
            key: `${pts[i].numero_slot}-${pts[j].numero_slot}`,
            x1: pts[i].x,
            y1: pts[i].y,
            x2: pts[j].x,
            y2: pts[j].y,
          });
        }
      }
    }
    return links;
  }, [activeFormation]);

  const jsonPreview = useMemo(() => {
    return JSON.stringify(
      {
        id: activeFormation.id,
        nombre: activeFormation.nombre,
        categoria: activeFormation.categoria,
        estilo: activeFormation.estilo,
        descripcion_tactica: activeFormation.descripcion_tactica,
        jugadores: activeFormation.jugadores.map((j) => ({
          numero_slot: j.numero_slot,
          posicion: j.posicion,
          x: j.x,
          y: j.y,
        })),
      },
      null,
      2
    );
  }, [activeFormation]);

  return (
    <div
      data-testid="tactical-formation-board"
      className="rounded-xl bg-[#0D151E] border border-slate-800 p-4 space-y-4 text-xs"
    >
      {/* Header & Active Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-display text-lg font-bold text-white leading-tight">
              {title}
            </h4>
            <p className="text-[11px] text-slate-400">
              {FORMATIONS.length} esquemas tácticos oficiales · 1 Arquero + 10 Jugadores de Campo con coordenadas exactas (0-100)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-bold ${getStyleBadgeClass(
              activeFormation.estilo
            )}`}
          >
            <Sparkles className="w-3 h-3" />
            <span>Estilo: {activeFormation.estilo}</span>
          </span>
          <button
            type="button"
            data-testid="btn-toggle-formation-json"
            onClick={() => setShowJsonInspector((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
              showJsonInspector
                ? 'bg-emerald-600 border-emerald-400 text-white'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Categorías de formaciones tácticas">
        {(['Todas', ...FORMATION_CATEGORIES] as const).map((cat) => {
          const count =
            cat === 'Todas'
              ? FORMATIONS.length
              : FORMATIONS.filter((f) => f.categoria === cat).length;
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-testid={`formation-cat-${cat}`}
              onClick={() => setActiveCategory(cat)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold border transition-colors cursor-pointer ${
                isActive
                  ? 'bg-emerald-600 border-emerald-400 text-white shadow'
                  : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span>{cat}</span>
              <span
                className={`rounded px-1.5 py-0.2 text-[10px] font-mono-tabular ${
                  isActive ? 'bg-emerald-950/70 text-emerald-200' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Content Grid: Left = Formation List, Right = Animated 2D Pitch & Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Formation Selector List */}
        <div
          className={`lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5 overflow-y-auto pr-1 ${
            compact ? 'max-h-64' : 'max-h-[410px]'
          }`}
        >
          {filteredFormations.map((f) => {
            const isSelected = f.id === activeFormation.id;
            return (
              <button
                key={f.id}
                type="button"
                data-testid={`select-formation-${f.id}`}
                onClick={() => onSelectFormation(f.id)}
                className={`w-full rounded-lg p-2.5 border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-950/75 border-emerald-400 text-white shadow-md ring-1 ring-emerald-400/40'
                    : 'bg-slate-900/75 border-slate-800/90 text-slate-300 hover:bg-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-xs text-white truncate">{f.nombre}</span>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold border ${getStyleBadgeClass(
                      f.estilo
                    )}`}
                  >
                    {f.estilo}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                  <span>{f.categoria}</span>
                  <span className="font-mono-tabular text-emerald-400/90">{f.id}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Interactive Animated 2D Tactical Pitch + Tactical Analysis */}
        <div className="lg:col-span-7 space-y-3">
          {/* 2D Football Pitch Canvas with Smooth Transitions */}
          <div
            data-testid="tactical-pitch-visualizer"
            className="relative w-full aspect-[105/68] rounded-xl overflow-hidden border-2 border-emerald-500/40 shadow-inner select-none"
            style={{
              background:
                'repeating-linear-gradient(90deg, #14532d 0%, #14532d 10%, #166534 10%, #166534 20%)',
            }}
          >
            {/* SVG Pitch Lines & Tactical Passing Web */}
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 w-full h-full pointer-events-none"
            >
              {/* Outer boundary */}
              <rect
                x="2"
                y="3"
                width="96"
                height="94"
                fill="none"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="0.5"
              />
              {/* Halfway line */}
              <line
                x1="50"
                y1="3"
                x2="50"
                y2="97"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="0.5"
              />
              {/* Center circle & spot */}
              <circle
                cx="50"
                cy="50"
                r="11"
                fill="none"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="0.5"
              />
              <circle cx="50" cy="50" r="0.9" fill="rgba(255,255,255,0.75)" />

              {/* Left Penalty Area & 6-yard box */}
              <rect
                x="2"
                y="21"
                width="15"
                height="58"
                fill="none"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="0.5"
              />
              <rect
                x="2"
                y="36"
                width="5.5"
                height="28"
                fill="none"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="0.5"
              />
              <circle cx="12" cy="50" r="0.7" fill="rgba(255,255,255,0.7)" />

              {/* Right Penalty Area & 6-yard box */}
              <rect
                x="83"
                y="21"
                width="15"
                height="58"
                fill="none"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="0.5"
              />
              <rect
                x="92.5"
                y="36"
                width="5.5"
                height="28"
                fill="none"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="0.5"
              />
              <circle cx="88" cy="50" r="0.7" fill="rgba(255,255,255,0.7)" />

              {/* Attack direction indicator arrow */}
              <path
                d="M 42 94 L 58 94 L 55 92 M 58 94 L 55 96"
                fill="none"
                stroke="rgba(255,255,255,0.45)"
                strokeWidth="0.6"
              />

              {/* Tactical connection lines between nearby teammates */}
              {tacticalLinks.map((lnk) => (
                <line
                  key={lnk.key}
                  x1={lnk.x1}
                  y1={lnk.y1}
                  x2={lnk.x2}
                  y2={lnk.y2}
                  stroke="rgba(52, 211, 153, 0.28)"
                  strokeWidth="0.45"
                  strokeDasharray="1.2 1.2"
                />
              ))}
            </svg>

            {/* Top Overlay Banner on Pitch */}
            <div className="absolute top-2 left-2.5 right-2.5 flex items-center justify-between pointer-events-none z-10">
              <span className="rounded bg-slate-950/80 border border-white/15 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                {team ? `${team.name} · ` : ''}
                {activeFormation.nombre}
              </span>
              <span className="rounded bg-slate-950/80 border border-white/15 px-2 py-0.5 text-[10px] font-mono-tabular text-emerald-300">
                ATAQUE ➔
              </span>
            </div>

            {/* 11 Animated Player Nodes (Smooth CSS transitions on left/top) */}
            {activeFormation.jugadores.map((jug, idx) => {
              const colors = getPositionColorClasses(jug.posicion);
              const rosterPlayer = team?.players?.[idx];
              const isFocused = selectedSlotNumber === jug.numero_slot;
              const shortLastName = rosterPlayer
                ? rosterPlayer.name.split(' ').slice(-1)[0]
                : `Slot ${jug.numero_slot}`;

              return (
                <button
                  key={jug.numero_slot}
                  type="button"
                  data-testid={`pitch-player-slot-${jug.numero_slot}`}
                  data-x={jug.x}
                  data-y={jug.y}
                  data-pos={jug.posicion}
                  onClick={() =>
                    setSelectedSlotNumber(
                      selectedSlotNumber === jug.numero_slot ? null : jug.numero_slot
                    )
                  }
                  style={{
                    left: `${jug.x}%`,
                    top: `${jug.y}%`,
                  }}
                  title={`#${jug.numero_slot} ${jug.posicion} (${shortLastName}) · x:${jug.x}, y:${jug.y}`}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer transition-all duration-500 ease-out z-20 focus:outline-none"
                >
                  {/* Position Code Pill above token */}
                  <span
                    className={`mb-0.5 rounded px-1 py-0.2 text-[9px] font-mono-tabular font-extrabold border shadow-sm leading-tight ${colors.badge}`}
                  >
                    {jug.posicion}
                  </span>

                  {/* Circular Jersey Token */}
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center font-mono-tabular font-extrabold text-[11px] shadow-lg transition-transform group-hover:scale-110 ${
                      colors.bg
                    } ${colors.border} ${isFocused ? 'ring-4 scale-115' : ''}`}
                  >
                    {rosterPlayer ? rosterPlayer.number : jug.numero_slot}
                  </div>

                  {/* Player Name & Coordinates Label */}
                  <span className="mt-0.5 rounded bg-slate-950/90 border border-white/15 px-1.5 py-0.2 text-[9px] font-semibold text-white whitespace-nowrap shadow">
                    {shortLastName}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Tactical Description & Strengths / Weaknesses Card */}
          <div className="rounded-lg bg-slate-900/90 border border-slate-800 p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-bold text-white text-xs">
                  Análisis Táctico: {activeFormation.nombre}
                </span>
              </div>
              <span className="text-[11px] font-mono-tabular text-slate-400">
                Categoría: <strong className="text-emerald-300">{activeFormation.categoria}</strong>
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              {activeFormation.descripcion_tactica}
            </p>

            {/* 11 Player Coordinates Bar */}
            <div className="pt-1.5 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
                <span className="inline-flex items-center gap-1 font-semibold text-slate-300">
                  <Users className="w-3 h-3 text-emerald-400" />
                  <span>Coordenadas Exactas de los 11 Titulares (x: 0-100, y: 0-100)</span>
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-400" /> POR
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-sky-400" /> DEF
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" /> MED
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-400" /> DEL
                  </span>
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
                {activeFormation.jugadores.map((j) => (
                  <div
                    key={j.numero_slot}
                    className="rounded bg-slate-950/90 border border-slate-800 px-1.5 py-1 flex items-center justify-between text-[10px] font-mono-tabular"
                  >
                    <span className="font-bold text-white">
                      #{j.numero_slot}{' '}
                      <span className="text-emerald-400">{j.posicion}</span>
                    </span>
                    <span className="text-slate-400">
                      {j.x},{j.y}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Optional Collapsible JSON Schema Inspector */}
          {showJsonInspector && (
            <div className="rounded-lg bg-slate-950 border border-slate-800 p-3 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-emerald-400">
                <span className="inline-flex items-center gap-1.5">
                  <Swords className="w-3.5 h-3.5" />
                  <span>Estructura JSON Táctica ({activeFormation.id})</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono-tabular">11 jugadores</span>
              </div>
              <pre
                data-testid="formation-json-preview"
                className="max-h-48 overflow-y-auto rounded bg-slate-900/90 p-2.5 text-[10px] font-mono text-emerald-200 leading-snug"
              >
                {jsonPreview}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
