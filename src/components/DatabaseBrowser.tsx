import React, { useMemo, useRef, useState } from 'react';
import { Search, Upload, Download, Globe2, Shield, Info, CheckCircle2, AlertCircle, FileJson } from 'lucide-react';
import type { Confederation, Player, Team } from '../types/football';
import { validateAndParseImportedTeams } from '../data/database';
import { TeamCrest } from './TeamCrest';
import { TeamCoverBanner } from './TeamCoverBanner';

interface DatabaseBrowserProps {
  teams: Team[];
  initialTab?: 'clubs' | 'nations';
  onSelectForQuickMatch?: (team: Team) => void;
  onImportTeams: (newTeams: Team[]) => void;
}

const CONFEDERATIONS: { id: 'ALL' | Confederation; label: string }[] = [
  { id: 'ALL', label: 'Todas' },
  { id: 'UEFA', label: 'UEFA' },
  { id: 'CONMEBOL', label: 'CONMEBOL' },
  { id: 'CONCACAF', label: 'CONCACAF' },
  { id: 'CAF', label: 'CAF' },
  { id: 'AFC', label: 'AFC' },
  { id: 'OFC', label: 'OFC' },
  { id: 'NON_FIFA', label: 'No FIFA' },
];

export const DatabaseBrowser: React.FC<DatabaseBrowserProps> = ({
  teams,
  initialTab = 'clubs',
  onSelectForQuickMatch,
  onImportTeams,
}) => {
  const [tab, setTab] = useState<'clubs' | 'nations'>(initialTab);
  const [confFilter, setConfFilter] = useState<'ALL' | Confederation>('ALL');
  const [divisionFilter, setDivisionFilter] = useState<string>('ALL');
  const [query, setQuery] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(teams[0] ?? null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(teams[0]?.players[0] ?? null);
  const [importJson, setImportJson] = useState('');
  const [showImporter, setShowImporter] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredTeams = useMemo(() => {
    const q = query.trim().toLowerCase();
    return teams.filter((t) => {
      if (tab === 'clubs' && t.type !== 'club') return false;
      if (tab === 'nations' && t.type !== 'national') return false;
      if (confFilter !== 'ALL' && t.confederation !== confFilter) return false;
      if (tab === 'clubs' && divisionFilter !== 'ALL') {
        if (divisionFilter === 'HIST' && !t.isHistoric) return false;
        if (divisionFilter !== 'HIST' && t.division !== Number(divisionFilter)) return false;
      }
      if (q) {
        const hay = `${t.name} ${t.country} ${t.city ?? ''} ${t.leagueName ?? ''} ${t.shortName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [teams, tab, confFilter, divisionFilter, query]);

  const clubCount = useMemo(() => teams.filter((t) => t.type === 'club').length, [teams]);
  const nationCount = useMemo(() => teams.filter((t) => t.type === 'national').length, [teams]);
  const realSquadCount = useMemo(() => teams.filter((t) => t.rosterSource === 'curated').length, [teams]);

  const applyImportRaw = (rawText: string) => {
    const res = validateAndParseImportedTeams(rawText, teams);
    if (res.error) {
      setImportStatus({ type: 'err', msg: res.error });
      return;
    }
    onImportTeams(res.teams);
    if (res.teams.length > 0) {
      setSelectedTeam(res.teams[0]);
      setSelectedPlayer(res.teams[0].players[0] ?? null);
    }
    setImportStatus({
      type: 'ok',
      msg: `Parche acumulativo aplicado: ${res.teams.length} equipo(s) actualizados a "Plantilla Real 2026".`,
    });
    setImportJson('');
  };

  const handleImport = () => {
    applyImportRaw(importJson);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      setImportJson(content);
      applyImportRaw(content);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportSample = () => {
    const sample = JSON.stringify(teams.slice(0, 3), null, 2);
    const blob = new Blob([sample], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'atlas_futbol_parche_2026.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Header & Import Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-extrabold text-white tracking-tight">
            Base de Datos Internacional
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {nationCount} selecciones nacionales (211 FIFA + asociaciones No FIFA) · {clubCount} clubes ·{' '}
            <span className="text-emerald-400 font-semibold">{realSquadCount} equipos con Plantilla Real 2026</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="btn-toggle-json-importer"
            onClick={() => setShowImporter((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3.5 py-2 text-xs font-semibold text-white min-h-[40px] cursor-pointer"
          >
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>Importar Base JSON</span>
          </button>
          <button
            type="button"
            onClick={handleExportSample}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-200 min-h-[40px] cursor-pointer"
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>Exportar Esquema</span>
          </button>
        </div>
      </div>

      {/* Transparency Notice */}
      <div className="flex items-start gap-3 rounded-xl bg-[#101923] border border-slate-800 p-3.5 text-xs text-slate-300">
        <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
        <p>
          Las selecciones y clubes principales incluyen su{' '}
          <strong className="text-emerald-400">Plantilla Real 2026</strong> (18 futbolistas reales con dorsales, posiciones, OVR y aspecto físico 3D real en cancha). Los equipos marcados como{' '}
          <strong className="text-white">Motor Procedural</strong> usan generación regional y pueden actualizarse mediante{' '}
          <strong className="text-emerald-400">Importar Base JSON (Modo Parche Acumulativo)</strong> sin borrar al resto de equipos.
        </p>
      </div>

      {/* JSON Importer Drawer (Cumulative Patch Mode) */}
      {showImporter && (
        <div className="rounded-xl bg-[#101923] border border-emerald-500/30 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-lg font-bold text-white">
                Importar Base JSON · Modo Parche Acumulativo (Temporada 2026)
              </h3>
              <p className="text-xs text-slate-400">
                Haz merge sobre la base actual por <code>id</code> o <code>name</code> para actualizar escudo (<code>logoUrl</code>), camisetas y los 18 jugadores con su <code>aspecto</code> físico real.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-1.5 text-xs font-semibold text-emerald-300 cursor-pointer"
              >
                <FileJson className="w-3.5 h-3.5" />
                <span>Cargar archivo .JSON</span>
              </button>
              <button
                type="button"
                onClick={() => setShowImporter(false)}
                className="text-xs text-slate-400 hover:text-white cursor-pointer px-2 py-1"
              >
                Cerrar
              </button>
            </div>
          </div>
          <textarea
            data-testid="input-import-json"
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder='[{"id": "club_get", "name": "Getafe CF", "country": "España", "overall": 78, "primaryColor": "#005999", "players": [{"name": "Borja Mayoral", "number": 9, "position": "ST", "overall": 80, "aspecto": {"tonoPiel": "#F1C6A7", "peinado": "corto", "colorPelo": "#2A1B12", "barba": "corta", "alturaCm": 182, "colorBotines": "#F97316", "piernaHabil": "D"}}]}]'
            rows={4}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
          />
          {importStatus && (
            <div
              data-testid="import-status-msg"
              className={`flex items-center gap-2 text-xs font-medium ${importStatus.type === 'ok' ? 'text-emerald-400' : 'text-rose-400'}`}
            >
              {importStatus.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{importStatus.msg}</span>
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              data-testid="btn-submit-import-json"
              onClick={handleImport}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white min-h-[40px] cursor-pointer"
            >
              Aplicar Parche Acumulativo a la Base
            </button>
          </div>
        </div>
      )}

      {/* Filters Row */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-[#101923] border border-slate-800 p-1">
            <button
              type="button"
              onClick={() => setTab('clubs')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-semibold cursor-pointer ${
                tab === 'clubs' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Clubes ({clubCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('nations')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-semibold cursor-pointer ${
                tab === 'nations' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Globe2 className="w-3.5 h-3.5" />
              <span>Selecciones ({nationCount})</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-1">
            {CONFEDERATIONS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setConfFilter(c.id)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer border ${
                  confFilter === c.id
                    ? 'bg-slate-800 border-emerald-500 text-emerald-400'
                    : 'bg-[#101923] border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {tab === 'clubs' && (
            <select
              aria-label="Filtrar por división"
              value={divisionFilter}
              onChange={(e) => setDivisionFilter(e.target.value)}
              className="rounded-lg bg-[#101923] border border-slate-800 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">Todas las divisiones</option>
              <option value="1">1ª División</option>
              <option value="2">2ª División</option>
              <option value="3">3ª División</option>
              <option value="HIST">Históricos / All-Star</option>
            </select>
          )}
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar país, club, liga o ciudad..."
            className="w-full rounded-lg bg-[#101923] border border-slate-800 pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Main Master-Detail Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Team List */}
        <div className="lg:col-span-5 rounded-xl bg-[#101923] border border-slate-800 overflow-hidden flex flex-col max-h-[580px]">
          <div className="px-4 py-2.5 border-b border-slate-800 text-xs font-semibold text-slate-400 flex justify-between">
            <span>Resultados: {filteredTeams.length}</span>
            <span>OVR</span>
          </div>
          <div className="overflow-y-auto divide-y divide-slate-800/70">
            {filteredTeams.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setSelectedTeam(t);
                  setSelectedPlayer(t.players[0] ?? null);
                }}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors cursor-pointer ${
                  selectedTeam?.id === t.id ? 'bg-emerald-950/40' : 'hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <TeamCrest team={t} size={34} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-white truncate">{t.name}</span>
                      {t.rosterSource === 'curated' && (
                        <span className="shrink-0 rounded bg-emerald-500/20 border border-emerald-500/40 px-1.5 py-0.2 text-[9px] font-bold text-emerald-400">
                          REAL 2026
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 truncate">
                      {t.country} · {t.type === 'club' ? (t.leagueName ?? 'Club') : t.confederation}
                    </div>
                  </div>
                </div>
                <span className="font-mono-tabular text-sm font-bold text-emerald-400 shrink-0">{t.overall}</span>
              </button>
            ))}
            {filteredTeams.length === 0 && (
              <div className="p-8 text-center text-sm text-slate-400">
                No se encontraron equipos con esos filtros.
              </div>
            )}
          </div>
        </div>

        {/* Team & Squad Inspector */}
        <div className="lg:col-span-7 rounded-xl bg-[#101923] border border-slate-800 p-5 space-y-5">
          {selectedTeam ? (
            <>
              <div className="space-y-3 pb-4 border-b border-slate-800">
                <TeamCoverBanner team={selectedTeam} />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-400">
                    Formación <strong className="text-white">{selectedTeam.formationId}</strong> · Táctica{' '}
                    <strong className="text-white">{selectedTeam.tacticalStyle}</strong> ·{' '}
                    {selectedTeam.rosterSource === 'curated' ? (
                      <span data-testid="team-roster-badge" className="text-emerald-400 font-bold">
                        Plantilla Real 2026 ({selectedTeam.players.length} futbolistas)
                      </span>
                    ) : (
                      <span data-testid="team-roster-badge" className="text-amber-400 font-semibold">
                        Motor Procedural ({selectedTeam.players.length} futbolistas)
                      </span>
                    )}
                  </div>
                  {onSelectForQuickMatch && (
                    <button
                      type="button"
                      onClick={() => onSelectForQuickMatch(selectedTeam)}
                      className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white whitespace-nowrap shrink-0 min-h-[38px] cursor-pointer"
                    >
                      Jugar con este equipo
                    </button>
                  )}
                </div>
              </div>

              {/* Squad List */}
              <div>
                <div className="text-xs font-semibold text-slate-400 mb-2">
                  Plantilla completa ({selectedTeam.players.length} jugadores — pulsa uno para ver 18 atributos y aspecto físico 3D)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                  {selectedTeam.players.map((pl) => (
                    <button
                      key={pl.id}
                      type="button"
                      onClick={() => setSelectedPlayer(pl)}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs border text-left cursor-pointer ${
                        selectedPlayer?.id === pl.id
                          ? 'bg-slate-800 border-emerald-500 text-white'
                          : 'bg-slate-900/70 border-slate-800/80 text-slate-300 hover:bg-slate-800/60'
                      }`}
                    >
                      <span className="truncate flex items-center gap-1.5">
                        {pl.aspecto && (
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full shrink-0 border border-slate-700"
                            style={{ backgroundColor: pl.aspecto.tonoPiel }}
                            title={`Peinado: ${pl.aspecto.peinado} · Altura: ${pl.aspecto.alturaCm}cm`}
                          />
                        )}
                        <strong className="font-mono-tabular text-slate-400">#{pl.number}</strong>
                        <span className="font-semibold text-amber-400">{pl.position}</span>
                        <span className="truncate">{pl.name}</span>
                      </span>
                      <span className="font-mono-tabular font-bold text-emerald-400 ml-2">{pl.overall}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected Player 18-Attribute & Physical Appearance Sheet */}
              {selectedPlayer && (
                <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-display text-xl font-bold text-white">
                        {selectedPlayer.name} · #{selectedPlayer.number} ({selectedPlayer.position})
                      </div>
                      <div className="text-xs text-slate-400">
                        {selectedPlayer.age} años · {selectedPlayer.aspecto?.alturaCm ?? selectedPlayer.heightCm} cm · Pierna{' '}
                        {selectedPlayer.aspecto?.piernaHabil ?? (selectedPlayer.preferredFoot === 'Izquierdo' ? 'I' : selectedPlayer.preferredFoot === 'Ambidiestro' ? 'A' : 'D')} · Potencial {selectedPlayer.potential} · Moral {selectedPlayer.morale}%
                      </div>
                    </div>
                    <div className="font-display text-2xl font-extrabold text-emerald-400 tabular-nums">
                      OVR {selectedPlayer.overall}
                    </div>
                  </div>

                  {selectedPlayer.aspecto && (
                    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-900/90 border border-slate-800 px-3 py-2 text-[11px] text-slate-300">
                      <span className="font-bold text-slate-400 uppercase tracking-wider">Aspecto 3D en Cancha:</span>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="w-3 h-3 rounded-full border border-slate-600"
                          style={{ backgroundColor: selectedPlayer.aspecto.tonoPiel }}
                        />
                        <span>Piel</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="w-3 h-3 rounded-full border border-slate-600"
                          style={{ backgroundColor: selectedPlayer.aspecto.colorPelo }}
                        />
                        <span>Peinado: <strong className="text-white">{selectedPlayer.aspecto.peinado}</strong></span>
                      </span>
                      <span>
                        Barba: <strong className="text-white">{selectedPlayer.aspecto.barba}</strong>
                      </span>
                      <span>
                        Altura: <strong className="text-white">{selectedPlayer.aspecto.alturaCm} cm</strong>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="w-3 h-3 rounded-full border border-slate-600"
                          style={{ backgroundColor: selectedPlayer.aspecto.colorBotines }}
                        />
                        <span>Botines</span>
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
                    {[
                      ['Velocidad', selectedPlayer.attributes.pace],
                      ['Aceleración', selectedPlayer.attributes.acceleration],
                      ['Resistencia', selectedPlayer.attributes.stamina],
                      ['Fuerza', selectedPlayer.attributes.strength],
                      ['Control', selectedPlayer.attributes.ballControl],
                      ['Regate', selectedPlayer.attributes.dribbling],
                      ['Pase corto', selectedPlayer.attributes.shortPassing],
                      ['Pase largo', selectedPlayer.attributes.longPassing],
                      ['Visión', selectedPlayer.attributes.vision],
                      ['Definición', selectedPlayer.attributes.finishing],
                      ['Potencia tiro', selectedPlayer.attributes.shotPower],
                      ['Precisión', selectedPlayer.attributes.accuracy],
                      ['Cabeceo', selectedPlayer.attributes.heading],
                      ['Marcaje', selectedPlayer.attributes.marking],
                      ['Entrada', selectedPlayer.attributes.tackling],
                      ['Posicionamiento', selectedPlayer.attributes.positioning],
                      ['Reflejos', selectedPlayer.attributes.reflexes],
                      ['Reacción', selectedPlayer.attributes.reactions],
                    ].map(([label, val]) => (
                      <div key={String(label)} className="flex items-center justify-between py-0.5 border-b border-slate-800/50">
                        <span className="text-slate-400">{label}</span>
                        <span className={`font-mono-tabular font-bold ${Number(val) >= 82 ? 'text-emerald-400' : Number(val) >= 70 ? 'text-white' : 'text-slate-400'}`}>
                          {val}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="p-8 text-center text-slate-400 text-sm">Selecciona un equipo para inspeccionar su plantilla.</div>
          )}
        </div>
      </div>
    </div>
  );
};
