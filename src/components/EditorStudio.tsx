import React, { useState } from 'react';
import { Plus, Save, Sparkles, Shield, Users, MapPin, Image as ImageIcon, Loader2 } from 'lucide-react';
import type {
  CrestConfig,
  KitPattern,
  Player,
  PlayerPosition,
  Team,
} from '../types/football';
import { generateSquadForTeam } from '../data/database';
import { TeamCrest } from './TeamCrest';
import { TacticalFormationBoard } from './TacticalFormationBoard';

interface EditorStudioProps {
  teams: Team[];
  onSaveTeam: (team: Team) => void;
}

const ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9'] as const;
const IMAGE_SIZES = ['1K', '2K', '4K'] as const;

export const EditorStudio: React.FC<EditorStudioProps> = ({ teams, onSaveTeam }) => {
  const [selectedTeamId, setSelectedTeamId] = useState<string>(teams[0]?.id ?? '');
  const activeTeam = teams.find((t) => t.id === selectedTeamId) ?? teams[0];

  const [draft, setDraft] = useState<Team>(() => structuredClone(activeTeam));
  const [editorTab, setEditorTab] = useState<'club' | 'squad' | 'stadium' | 'ai_studio'>('club');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // New player form state
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerPos, setNewPlayerPos] = useState<PlayerPosition>('ST');
  const [newPlayerOvr, setNewPlayerOvr] = useState(78);

  // AI Image Studio state
  const [aiPrompt, setAiPrompt] = useState(
    'Escudo deportivo minimalista con águila dorada y balón clásico sobre fondo azul marino, diseño vectorial profesional'
  );
  const [aiAspectRatio, setAiAspectRatio] = useState<(typeof ASPECT_RATIOS)[number]>('1:1');
  const [aiImageSize, setAiImageSize] = useState<(typeof IMAGE_SIZES)[number]>('1K');
  const [aiQuality, setAiQuality] = useState<'studio' | 'general'>('studio');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResultUrl, setAiResultUrl] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const loadTeam = (id: string) => {
    setSelectedTeamId(id);
    const found = teams.find((t) => t.id === id);
    if (found) setDraft(structuredClone(found));
    setSavedNotice(null);
  };

  const handleCreateNewClub = () => {
    const id = `custom_${Date.now()}`;
    const fresh: Team = {
      id,
      name: 'Nuevo Club Atlético',
      shortName: 'NCA',
      type: 'club',
      country: 'España',
      countryCode: 'ESP',
      confederation: 'UEFA',
      leagueId: 'custom',
      leagueName: 'Liga Personalizada',
      division: 1,
      city: 'Madrid',
      primaryColor: '#10B981',
      secondaryColor: '#FFFFFF',
      awayColor: '#0F172A',
      kitPattern: 'stripes',
      crest: {
        shape: 'shield',
        primaryColor: '#10B981',
        secondaryColor: '#FFFFFF',
        accentColor: '#F59E0B',
        symbol: 'star',
      },
      stadium: {
        id: `stad_${id}`,
        name: 'Estadio Nuevo Horizonte',
        city: 'Madrid',
        capacity: 42000,
        turfTone: 'emerald',
        standColor: '#10B981',
        hasRoof: true,
      },
      formationId: '4-3-3',
      tacticalStyle: 'EQUILIBRADO',
      overall: 78,
      attack: 78,
      midfield: 78,
      defense: 78,
      budgetMillions: 60,
      rosterSource: 'custom',
      players: generateSquadForTeam(id, 'España', 'ESP', 'UEFA', 78),
    };
    setDraft(fresh);
    setSelectedTeamId(id);
    onSaveTeam(fresh);
    setSavedNotice('Club nuevo creado y guardado.');
  };

  const handleSaveChanges = () => {
    const updated: Team = { ...draft, rosterSource: 'custom' };
    onSaveTeam(updated);
    setSavedNotice(`Cambios guardados para ${updated.name}.`);
  };

  const handleAddPlayer = () => {
    if (!newPlayerName.trim()) return;
    const base = draft.players[0];
    const created: Player = {
      ...structuredClone(base),
      id: `${draft.id}_custom_${Date.now()}`,
      name: newPlayerName.trim(),
      number: draft.players.length + 1,
      position: newPlayerPos,
      overall: newPlayerOvr,
      potential: Math.min(99, newPlayerOvr + 5),
      isProcedural: false,
    };
    setDraft({ ...draft, players: [created, ...draft.players] });
    setNewPlayerName('');
  };

  const handleGenerateArtwork = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          aspectRatio: aiAspectRatio,
          imageSize: aiImageSize,
          quality: aiQuality,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error ?? 'No se pudo generar la imagen.');
      } else {
        setAiResultUrl(data.imageDataUrl);
      }
    } catch {
      setAiError('Sin conexión o servidor ocupado. El resto del juego sigue funcionando offline.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-extrabold text-white">Editor Total y Estudio Creativo</h2>
          <p className="text-sm text-slate-400">
            Crea clubes desde cero, diseña escudos y uniformes, edita jugadores, estadios y genera arte deportivo de alta resolución.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Seleccionar equipo para editar"
            value={selectedTeamId}
            onChange={(e) => loadTeam(e.target.value)}
            className="rounded-lg bg-[#101923] border border-slate-700 px-3 py-2 text-xs text-white max-w-[230px]"
          >
            {teams.slice(0, 120).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.shortName})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleCreateNewClub}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3.5 py-2 text-xs font-semibold text-white min-h-[40px] cursor-pointer"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Crear Club Nuevo</span>
          </button>

          <button
            type="button"
            onClick={handleSaveChanges}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white min-h-[40px] cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Guardar Cambios</span>
          </button>
        </div>
      </div>

      {savedNotice && (
        <div className="rounded-lg bg-emerald-950/50 border border-emerald-500/40 px-4 py-2.5 text-xs font-semibold text-emerald-300">
          {savedNotice}
        </div>
      )}

      {/* Editor Subtabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {[
          { id: 'club', label: 'Identidad, Escudo y Uniforme', icon: Shield },
          { id: 'squad', label: 'Plantilla y Jugadores', icon: Users },
          { id: 'stadium', label: 'Estadio y Formación', icon: MapPin },
          { id: 'ai_studio', label: 'Estudio Creativo IA (1K-4K)', icon: Sparkles },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setEditorTab(t.id as typeof editorTab)}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer ${
                editorTab === t.id
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

      {/* Tab 1: Club Identity, Crest & Kit */}
      {editorTab === 'club' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 rounded-xl bg-[#101923] border border-slate-800 p-6 flex flex-col items-center justify-center text-center">
            <TeamCrest team={draft} size={112} />
            <h3 className="font-display text-2xl font-extrabold text-white mt-4">{draft.name}</h3>
            <p className="text-xs text-slate-400 mt-1">
              {draft.shortName} · {draft.city}, {draft.country}
            </p>
            {/* Kit Preview Swatch */}
            <div className="mt-5 flex items-center gap-3">
              <div className="text-center">
                <div
                  className="w-14 h-16 rounded-lg border border-white/20 shadow"
                  style={{
                    background:
                      draft.kitPattern === 'stripes'
                        ? `repeating-linear-gradient(90deg, ${draft.primaryColor} 0 8px, ${draft.secondaryColor} 8px 16px)`
                        : draft.kitPattern === 'hoops'
                          ? `repeating-linear-gradient(0deg, ${draft.primaryColor} 0 8px, ${draft.secondaryColor} 8px 16px)`
                          : draft.kitPattern === 'halves'
                            ? `linear-gradient(90deg, ${draft.primaryColor} 50%, ${draft.secondaryColor} 50%)`
                            : draft.primaryColor,
                  }}
                />
                <span className="text-[11px] text-slate-400 mt-1 block">Local</span>
              </div>
              <div className="text-center">
                <div
                  className="w-14 h-16 rounded-lg border border-white/20 shadow"
                  style={{ backgroundColor: draft.awayColor }}
                />
                <span className="text-[11px] text-slate-400 mt-1 block">Visitante</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 rounded-xl bg-[#101923] border border-slate-800 p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Nombre del club / selección</label>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Siglas (3 letras)</label>
              <input
                type="text"
                maxLength={4}
                value={draft.shortName}
                onChange={(e) => setDraft({ ...draft, shortName: e.target.value.toUpperCase() })}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Forma del escudo</label>
              <select
                value={draft.crest.shape}
                onChange={(e) => setDraft({ ...draft, crest: { ...draft.crest, shape: e.target.value as CrestConfig['shape'] } })}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
              >
                <option value="shield">Escudo Clásico</option>
                <option value="circle">Circular</option>
                <option value="diamond">Diamante</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Símbolo del escudo</label>
              <select
                value={draft.crest.symbol}
                onChange={(e) => setDraft({ ...draft, crest: { ...draft.crest, symbol: e.target.value as CrestConfig['symbol'] } })}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
              >
                <option value="star">Estrella</option>
                <option value="ball">Balón</option>
                <option value="crown">Corona</option>
                <option value="eagle">Águila</option>
                <option value="stripes">Franjas</option>
                <option value="flame">Llama</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Diseño del uniforme</label>
              <select
                value={draft.kitPattern}
                onChange={(e) => setDraft({ ...draft, kitPattern: e.target.value as KitPattern })}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
              >
                <option value="solid">Liso</option>
                <option value="stripes">Rayas Verticales</option>
                <option value="hoops">Franjas Horizontales</option>
                <option value="halves">Mitades</option>
                <option value="sash">Banda Diagonal</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Valoración General (OVR: {draft.overall})</label>
              <input
                type="range"
                min={55}
                max={95}
                value={draft.overall}
                onChange={(e) => setDraft({ ...draft, overall: Number(e.target.value) })}
                className="w-full accent-emerald-500 mt-2"
              />
            </div>

            <div className="sm:col-span-2 grid grid-cols-3 sm:grid-cols-5 gap-3 pt-2">
              <div>
                <label className="block text-slate-400 mb-1">Local Principal</label>
                <input
                  type="color"
                  value={draft.primaryColor}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      primaryColor: e.target.value,
                      crest: { ...draft.crest, primaryColor: e.target.value },
                    })
                  }
                  className="w-full h-10 rounded cursor-pointer bg-transparent"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Local Secundario</label>
                <input
                  type="color"
                  value={draft.secondaryColor}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      secondaryColor: e.target.value,
                      crest: { ...draft.crest, secondaryColor: e.target.value },
                    })
                  }
                  className="w-full h-10 rounded cursor-pointer bg-transparent"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Uniforme Visita</label>
                <input
                  type="color"
                  value={draft.awayColor}
                  onChange={(e) => setDraft({ ...draft, awayColor: e.target.value })}
                  className="w-full h-10 rounded cursor-pointer bg-transparent"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">3º Uniforme</label>
                <input
                  type="color"
                  value={draft.thirdColor ?? '#1E293B'}
                  onChange={(e) => setDraft({ ...draft, thirdColor: e.target.value })}
                  className="w-full h-10 rounded cursor-pointer bg-transparent"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Arquero (GK)</label>
                <input
                  type="color"
                  value={draft.gkPrimaryColor ?? '#16A34A'}
                  onChange={(e) => setDraft({ ...draft, gkPrimaryColor: e.target.value })}
                  className="w-full h-10 rounded cursor-pointer bg-transparent"
                />
              </div>
            </div>

            <div className="sm:col-span-2 pt-2">
              <label className="block text-slate-400 mb-1">
                URL o Data-URI de Escudo Oficial (opcional · permite importar recursos gráficos oficiales sin modificar el motor)
              </label>
              <input
                type="url"
                value={draft.crestUrl ?? ''}
                placeholder="https://ejemplo.com/escudo-oficial.svg"
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    crestUrl: e.target.value.trim() || undefined,
                    crestStatus: e.target.value.trim() ? 'official_imported' : draft.crestStatus,
                  })
                }
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Squad & Player Creator */}
      {editorTab === 'squad' && (
        <div className="space-y-5">
          <div className="rounded-xl bg-[#101923] border border-slate-800 p-4 flex flex-col sm:flex-row items-stretch sm:items-end gap-3 text-xs">
            <div className="flex-1">
              <label className="block text-slate-400 mb-1">Nombre del nuevo futbolista</label>
              <input
                type="text"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="Ej. Mateo Solís"
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Posición</label>
              <select
                value={newPlayerPos}
                onChange={(e) => setNewPlayerPos(e.target.value as PlayerPosition)}
                className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
              >
                {(['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'] as PlayerPosition[]).map((pos) => (
                  <option key={pos} value={pos}>{pos}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">OVR ({newPlayerOvr})</label>
              <input
                type="number"
                min={50}
                max={99}
                value={newPlayerOvr}
                onChange={(e) => setNewPlayerOvr(Number(e.target.value))}
                className="w-20 rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white font-mono"
              />
            </div>
            <button
              type="button"
              onClick={handleAddPlayer}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 font-bold text-white min-h-[38px] cursor-pointer"
            >
              Añadir Jugador
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {draft.players.map((pl, idx) => (
              <div key={pl.id} className="rounded-xl bg-[#101923] border border-slate-800 p-3 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0 flex-1">
                  <input
                    type="text"
                    value={pl.name}
                    onChange={(e) => {
                      const next = [...draft.players];
                      next[idx] = { ...pl, name: e.target.value };
                      setDraft({ ...draft, players: next });
                    }}
                    className="w-full bg-transparent text-white font-semibold border-b border-transparent focus:border-emerald-500 focus:outline-none"
                  />
                  <div className="text-slate-400 mt-1">
                    #{pl.number} · {pl.position} · Edad {pl.age}
                  </div>
                </div>
                <input
                  type="number"
                  min={45}
                  max={99}
                  value={pl.overall}
                  onChange={(e) => {
                    const next = [...draft.players];
                    next[idx] = { ...pl, overall: Number(e.target.value) };
                    setDraft({ ...draft, players: next });
                  }}
                  className="w-14 rounded bg-slate-950 border border-slate-700 px-2 py-1 text-center font-mono-tabular font-bold text-emerald-400"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Stadium & Formation */}
      {editorTab === 'stadium' && (
        <div className="rounded-xl bg-[#101923] border border-slate-800 p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1">Nombre del Estadio</label>
            <input
              type="text"
              value={draft.stadium.name}
              onChange={(e) => setDraft({ ...draft, stadium: { ...draft.stadium, name: e.target.value } })}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1">Ciudad</label>
            <input
              type="text"
              value={draft.stadium.city}
              onChange={(e) => setDraft({ ...draft, stadium: { ...draft.stadium, city: e.target.value } })}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1">Capacidad de espectadores</label>
            <input
              type="number"
              min={2000}
              max={120000}
              value={draft.stadium.capacity}
              onChange={(e) => setDraft({ ...draft, stadium: { ...draft.stadium, capacity: Number(e.target.value) } })}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white font-mono"
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1">Tono del césped</label>
            <select
              value={draft.stadium.turfTone}
              onChange={(e) => setDraft({ ...draft, stadium: { ...draft.stadium, turfTone: e.target.value as Team['stadium']['turfTone'] } })}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
            >
              <option value="emerald">Esmeralda Moderno</option>
              <option value="classic">Verde Clásico</option>
              <option value="deep">Bosque Profundo</option>
              <option value="worn">Desgastado Histórico</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <TacticalFormationBoard
              selectedFormationId={draft.formationId}
              onSelectFormation={(fId) => setDraft({ ...draft, formationId: fId })}
              team={draft}
              title={`Formación Táctica Predeterminada · ${draft.name}`}
            />
          </div>
        </div>
      )}

      {/* Tab 4: AI Asset Studio (High Quality 1K/2K/4K & Aspect Ratios) */}
      {editorTab === 'ai_studio' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 rounded-xl bg-[#101923] border border-slate-800 p-5 space-y-4 text-xs">
            <div>
              <h3 className="font-display text-xl font-bold text-white">Estudio Creativo de Escudos, Estadios y Carteles</h3>
              <p className="text-slate-400 mt-0.5">
                Genera arte de alta resolución (1K, 2K, 4K) y relación de aspecto configurable para tus clubes y torneos. Requiere conexión activa.
              </p>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Descripción visual</label>
              <textarea
                rows={3}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Motor de Calidad</label>
                <select
                  value={aiQuality}
                  onChange={(e) => setAiQuality(e.target.value as 'studio' | 'general')}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
                >
                  <option value="studio">Calidad Estudio (Pro Image)</option>
                  <option value="general">Uso General (Nano Banana 2.1)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Resolución de Salida</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {IMAGE_SIZES.map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setAiImageSize(sz)}
                      className={`py-2 rounded-lg font-mono-tabular font-bold border cursor-pointer ${
                        aiImageSize === sz
                          ? 'bg-emerald-600 border-emerald-400 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-300'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1.5">Relación de Aspecto</label>
              <div className="grid grid-cols-4 gap-1.5">
                {ASPECT_RATIOS.map((ar) => (
                  <button
                    key={ar}
                    type="button"
                    onClick={() => setAiAspectRatio(ar)}
                    className={`py-2 rounded-lg font-mono-tabular font-semibold border cursor-pointer ${
                      aiAspectRatio === ar
                        ? 'bg-emerald-600 border-emerald-400 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    {ar}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={aiLoading}
              onClick={handleGenerateArtwork}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 py-3 text-sm font-bold text-white cursor-pointer min-h-[44px]"
            >
              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{aiLoading ? 'Generando imagen...' : `Generar Arte (${aiImageSize} · ${aiAspectRatio})`}</span>
            </button>

            {aiError && (
              <div className="rounded-lg bg-rose-950/40 border border-rose-500/40 p-3 text-rose-300">
                {aiError}
              </div>
            )}
          </div>

          <div className="lg:col-span-6 rounded-xl bg-[#101923] border border-slate-800 p-5 flex flex-col items-center justify-center min-h-[300px]">
            {aiResultUrl ? (
              <div className="space-y-3 w-full">
                <img
                  src={aiResultUrl}
                  alt="Arte generado para el club"
                  className="w-full max-h-[360px] object-contain rounded-lg border border-slate-700 bg-slate-950"
                />
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span>Formato: {aiAspectRatio} · {aiImageSize}</span>
                  <a
                    href={aiResultUrl}
                    download={`atlas_arte_${draft.shortName}.png`}
                    className="text-emerald-400 font-semibold hover:underline"
                  >
                    Descargar PNG
                  </a>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-500 space-y-2">
                <ImageIcon className="w-10 h-10 mx-auto opacity-40" />
                <p className="text-xs">Tu escudo, estadio o póster aparecerá aquí.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
