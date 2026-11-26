import React, { useEffect, useMemo, useState } from 'react';
import {
  Wifi,
  Copy,
  Check,
  Users,
  Play,
  ArrowLeft,
  ShieldAlert,
  Search,
  Globe,
  Trophy,
  Sparkles,
  LogIn,
  PlusCircle,
} from 'lucide-react';
import type { Team } from '../types/football';
import { FORMATIONS } from '../data/formations';
import { TeamCrest } from './TeamCrest';
import {
  sharedOnlineClient,
  type OnlineRoomSummary,
} from '../multiplayer/onlineClient';

interface OnlineMultiplayerModalProps {
  teams: Team[];
  defaultTeamId: string;
  defaultFormationId: string;
  onClose: () => void;
  onLaunchOnlineMatch: (room: OnlineRoomSummary, side: 'home' | 'away') => void;
}

export const OnlineMultiplayerModal: React.FC<OnlineMultiplayerModalProps> = ({
  teams,
  defaultTeamId,
  defaultFormationId,
  onClose,
  onLaunchOnlineMatch,
}) => {
  const [subMenu, setSubMenu] = useState<'hub' | 'create' | 'join'>('hub');
  const [playerName, setPlayerName] = useState<string>('Jugador 1');
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [room, setRoom] = useState<OnlineRoomSummary | null>(sharedOnlineClient.currentRoom);
  const [side, setSide] = useState<'home' | 'away'>(sharedOnlineClient.side);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [teamQuery, setTeamQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'club' | 'national'>('all');

  useEffect(() => {
    sharedOnlineClient.setListeners({
      onRoomUpdate: (updatedRoom, assignedSide) => {
        setRoom(updatedRoom);
        setSide(assignedSide);
        setErrorMsg(null);
      },
      onError: (_code, message) => {
        setErrorMsg(message);
      },
      onMatchStart: (startedRoom, assignedSide) => {
        onLaunchOnlineMatch(startedRoom, assignedSide);
      },
      onOpponentStatus: (_status, message) => {
        setStatusNotice(message);
      },
    });
  }, [onLaunchOnlineMatch]);

  const myPlayer = side === 'home' ? room?.host : room?.guest;
  const opponentPlayer = side === 'home' ? room?.guest : room?.host;
  const myTeamId = myPlayer?.teamId || defaultTeamId;
  const opponentTeamId = opponentPlayer?.teamId || null;

  const myTeam = useMemo(
    () => teams.find((t) => t.id === myTeamId) ?? teams[0],
    [teams, myTeamId]
  );
  const opponentTeam = useMemo(
    () => (opponentTeamId ? teams.find((t) => t.id === opponentTeamId) ?? null : null),
    [teams, opponentTeamId]
  );

  const filteredTeams = useMemo(() => {
    const q = teamQuery.trim().toLowerCase();
    return teams
      .filter((t) => {
        if (categoryFilter === 'club' && t.type !== 'club') return false;
        if (categoryFilter === 'national' && t.type !== 'national') return false;
        if (!q) return true;
        return (
          t.name.toLowerCase().includes(q) ||
          t.shortName.toLowerCase().includes(q) ||
          t.country.toLowerCase().includes(q) ||
          (t.leagueName || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 60);
  }, [teams, teamQuery, categoryFilter]);

  const handleOpenCreateRoom = () => {
    setErrorMsg(null);
    setStatusNotice(null);
    setSubMenu('create');
    sharedOnlineClient.leaveRoom();
    setRoom(null);
    sharedOnlineClient.createRoom(playerName || 'Anfitrión', defaultTeamId, defaultFormationId);
  };

  const handleOpenJoinView = () => {
    setErrorMsg(null);
    setStatusNotice(null);
    setSubMenu('join');
    sharedOnlineClient.leaveRoom();
    setRoom(null);
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const clean = joinCodeInput.trim().toUpperCase();
    if (clean.length !== 6) {
      setErrorMsg('Ingresa un código válido de 6 caracteres (ej: A7F9K2).');
      return;
    }
    const fallbackGuestTeam =
      defaultTeamId === 'real_madrid' ? 'fc_barcelona' : 'real_madrid';
    sharedOnlineClient.joinRoom(
      clean,
      playerName === 'Jugador 1' ? 'Jugador 2' : playerName,
      fallbackGuestTeam,
      defaultFormationId
    );
  };

  const handleCopyCode = async () => {
    if (!room?.code) return;
    try {
      await navigator.clipboard.writeText(room.code);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2200);
    } catch {
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2200);
    }
  };

  const handleBackToHubOrMenu = () => {
    if (subMenu !== 'hub') {
      sharedOnlineClient.leaveRoom();
      setRoom(null);
      setErrorMsg(null);
      setStatusNotice(null);
      setSubMenu('hub');
      return;
    }
    sharedOnlineClient.leaveRoom();
    onClose();
  };

  return (
    <div
      data-testid="online-multiplayer-modal"
      className="fixed inset-0 z-50 bg-slate-950/92 backdrop-blur-xl flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div className="w-full max-w-5xl rounded-2xl bg-slate-900/95 border border-cyan-500/30 shadow-[0_25px_70px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-950 via-cyan-950/50 to-slate-950 border-b border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-400">
                  MULTIJUGADOR ONLINE EN TIEMPO REAL
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[9px] font-black uppercase">
                  WebSockets 30Hz
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white">
                {subMenu === 'hub'
                  ? 'Centro Multijugador Online'
                  : subMenu === 'create'
                  ? 'Crear Sala Online (Anfitrión)'
                  : 'Unirse a una Sala con Código'}
              </h2>
            </div>
          </div>

          <button
            data-testid="btn-online-back"
            onClick={handleBackToHubOrMenu}
            className="px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-white/15 text-xs font-black uppercase tracking-wider flex items-center gap-2 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            {subMenu === 'hub' ? 'Volver al Menú' : 'Volver'}
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div
              data-testid="online-error-banner"
              className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs font-bold flex items-center gap-2.5"
            >
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {statusNotice && (
            <div className="p-3 rounded-xl bg-amber-950/70 border border-amber-400/40 text-amber-200 text-xs font-bold">
              {statusNotice}
            </div>
          )}

          {/* SUBMENU HUB: 1. CREAR SALA | 2. UNIRSE A UNA SALA | 3. VOLVER AL MENÚ */}
          {subMenu === 'hub' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-slate-950/70 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                    Tu Nombre de Jugador Online
                  </label>
                  <input
                    data-testid="input-online-player-name"
                    type="text"
                    value={playerName}
                    maxLength={22}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Ej: Campeón 2026"
                    className="px-3.5 py-2 rounded-lg bg-slate-900 border border-white/15 text-white text-sm font-bold focus:outline-none focus:border-cyan-400 w-64"
                  />
                </div>
                <div className="text-xs text-slate-300 max-w-md">
                  Juega partidos 1v1 en tiempo real desde distintos dispositivos, teléfonos o navegadores mediante salas privadas con código de invitación de 6 caracteres.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. CREAR SALA */}
                <button
                  data-testid="btn-online-create-room"
                  onClick={handleOpenCreateRoom}
                  className="group p-6 rounded-2xl bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-950 border-2 border-emerald-500/40 hover:border-emerald-400 text-left transition flex flex-col justify-between gap-4 shadow-lg cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 group-hover:scale-105 transition">
                    <PlusCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                      OPCIÓN 1 · ANFITRIÓN (LOCAL)
                    </div>
                    <h3 className="text-xl font-black uppercase text-white mt-1">
                      CREAR SALA
                    </h3>
                    <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                      Genera un código único de 6 caracteres, compártelo con tu amigo y controla al equipo Local.
                    </p>
                  </div>
                </button>

                {/* 2. UNIRSE A UNA SALA */}
                <button
                  data-testid="btn-online-join-room"
                  onClick={handleOpenJoinView}
                  className="group p-6 rounded-2xl bg-gradient-to-br from-cyan-950/80 via-slate-900 to-slate-950 border-2 border-cyan-500/40 hover:border-cyan-400 text-left transition flex flex-col justify-between gap-4 shadow-lg cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 group-hover:scale-105 transition">
                    <LogIn className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
                      OPCIÓN 2 · INVITADO (VISITANTE)
                    </div>
                    <h3 className="text-xl font-black uppercase text-white mt-1">
                      UNIRSE A UNA SALA
                    </h3>
                    <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                      Ingresa el código de invitación de 6 caracteres para conectarte a la sala y controlar al equipo Visitante.
                    </p>
                  </div>
                </button>

                {/* 3. VOLVER AL MENÚ */}
                <button
                  data-testid="btn-online-return-menu"
                  onClick={() => {
                    sharedOnlineClient.leaveRoom();
                    onClose();
                  }}
                  className="group p-6 rounded-2xl bg-slate-950/80 border-2 border-white/10 hover:border-white/30 text-left transition flex flex-col justify-between gap-4 cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-xl bg-slate-800 border border-white/15 flex items-center justify-center text-slate-300">
                    <ArrowLeft className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      OPCIÓN 3 · SALIR
                    </div>
                    <h3 className="text-xl font-black uppercase text-white mt-1">
                      VOLVER AL MENÚ
                    </h3>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      Regresa al menú principal de ATLAS FÚTBOL PRO para jugar modos individuales o locales.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* JOIN ROOM FORM (before room is joined) */}
          {subMenu === 'join' && !room && (
            <form
              onSubmit={handleJoinByCode}
              className="p-6 rounded-2xl bg-slate-950/80 border border-cyan-500/30 max-w-lg mx-auto space-y-4"
            >
              <div className="text-center space-y-1">
                <div className="text-[11px] font-black uppercase tracking-widest text-cyan-400">
                  CONEXIÓN MEDIANTE CÓDIGO DE SALA
                </div>
                <h3 className="text-lg font-black uppercase text-white">
                  Ingresa el Código de Invitación (6 Caracteres)
                </h3>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  data-testid="input-join-room-code"
                  type="text"
                  value={joinCodeInput}
                  maxLength={6}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder="EJ: A7F9K2"
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-900 border-2 border-cyan-500/40 text-center text-2xl font-black tracking-[0.28em] uppercase text-white focus:outline-none focus:border-cyan-400"
                />
                <button
                  data-testid="btn-submit-join-code"
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black uppercase tracking-wider text-xs transition cursor-pointer"
                >
                  Unirse Ahora
                </button>
              </div>
            </form>
          )}

          {/* ACTIVE LOBBY VIEW (Displayed once room is created or joined) */}
          {(subMenu === 'create' || (subMenu === 'join' && room)) && (
            <div className="space-y-5">
              {/* Top Invite Code & Status Bar */}
              <div className="p-4 rounded-2xl bg-slate-950/90 border border-cyan-500/35 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
                      CÓDIGO DE INVITACIÓN DE LA SALA
                    </div>
                    <div
                      data-testid="online-room-code"
                      className="text-3xl font-black tracking-[0.25em] text-white font-mono mt-0.5"
                    >
                      {room?.code ?? '......'}
                    </div>
                  </div>

                  {room?.code && (
                    <button
                      data-testid="btn-copy-room-code"
                      onClick={handleCopyCode}
                      className="px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-200 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer"
                    >
                      {copiedCode ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span>¡Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copiar Código</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Connected Players Status */}
                <div className="flex items-center gap-3">
                  <div className="px-3.5 py-2 rounded-xl bg-slate-900 border border-white/10 flex items-center gap-2">
                    <Users className="w-4 h-4 text-cyan-400" />
                    <span
                      data-testid="online-players-count"
                      className="text-xs font-black uppercase text-white"
                    >
                      Jugadores: {room?.guest?.connected ? '2/2' : '1/2'}
                    </span>
                  </div>

                  <div
                    data-testid="online-waiting-status"
                    className={`px-3.5 py-2 rounded-xl border text-xs font-black uppercase ${
                      room?.guest?.connected
                        ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                        : 'bg-amber-500/15 border-amber-400/40 text-amber-300'
                    }`}
                  >
                    {room?.guest?.connected
                      ? '¡Rival Conectado! Listos para jugar'
                      : 'Esperando a que otro jugador se una...'}
                  </div>
                </div>
              </div>

              {/* Matchup Cards: Host (Home) vs Guest (Away) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Host Card */}
                <div className="p-4 rounded-2xl bg-slate-950/75 border border-emerald-500/35 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {room ? (
                      <TeamCrest
                        team={teams.find((t) => t.id === room.host.teamId) ?? myTeam}
                        size={52}
                      />
                    ) : null}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 text-[9px] font-black uppercase">
                          LOCAL · ANFITRIÓN
                        </span>
                        <span className="text-xs font-bold text-slate-300">
                          {room?.host.playerName ?? playerName}
                        </span>
                      </div>
                      <div className="text-base font-black text-white uppercase mt-1">
                        {(teams.find((t) => t.id === room?.host.teamId) ?? myTeam).name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Esquema: {room?.host.formationId ?? defaultFormationId}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Guest Card */}
                <div className="p-4 rounded-2xl bg-slate-950/75 border border-cyan-500/35 flex items-center justify-between gap-3">
                  {room?.guest ? (
                    <div className="flex items-center gap-3">
                      <TeamCrest
                        team={
                          teams.find((t) => t.id === room.guest?.teamId) ??
                          opponentTeam ??
                          teams[1]
                        }
                        size={52}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-cyan-400 text-slate-950 text-[9px] font-black uppercase">
                            VISITANTE · INVITADO
                          </span>
                          <span className="text-xs font-bold text-slate-300">
                            {room.guest.playerName}
                          </span>
                        </div>
                        <div className="text-base font-black text-white uppercase mt-1">
                          {(teams.find((t) => t.id === room.guest?.teamId) ?? teams[1]).name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Esquema: {room.guest.formationId}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 font-bold py-3">
                      Comparte el código <span className="text-cyan-300 font-black">{room?.code}</span> para que el Jugador 2 se una como Visitante...
                    </div>
                  )}
                </div>
              </div>

              {/* Team & Formation Selector for Current Player */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/10 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
                      SELECCIONA TU EQUIPO ({side === 'home' ? 'LOCAL' : 'VISITANTE'})
                    </div>
                    <p className="text-xs text-slate-400">
                      El equipo elegido por tu rival aparece bloqueado para garantizar camisetas y planteles distintos.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      aria-label="Formación táctica online"
                      value={myPlayer?.formationId || defaultFormationId}
                      onChange={(e) =>
                        sharedOnlineClient.selectTeam(myTeamId, e.target.value)
                      }
                      className="px-3 py-1.5 rounded-lg bg-slate-900 border border-white/15 text-xs font-bold text-white"
                    >
                      {FORMATIONS.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.nombre || f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Filter bar */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={teamQuery}
                      onChange={(e) => setTeamQuery(e.target.value)}
                      placeholder="Buscar entre los 344 clubes y selecciones..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('all')}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase cursor-pointer ${
                      categoryFilter === 'all'
                        ? 'bg-cyan-500 text-slate-950'
                        : 'bg-slate-900 text-slate-300 border border-white/10'
                    }`}
                  >
                    Todos (344)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('club')}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer ${
                      categoryFilter === 'club'
                        ? 'bg-cyan-500 text-slate-950'
                        : 'bg-slate-900 text-slate-300 border border-white/10'
                    }`}
                  >
                    <Trophy className="w-3 h-3" /> Clubes
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('national')}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer ${
                      categoryFilter === 'national'
                        ? 'bg-cyan-500 text-slate-950'
                        : 'bg-slate-900 text-slate-300 border border-white/10'
                    }`}
                  >
                    <Globe className="w-3 h-3" /> Selecciones
                  </button>
                </div>

                {/* Team grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
                  {filteredTeams.map((t) => {
                    const isSelectedByMe = t.id === myTeamId;
                    const isTakenByOpponent = t.id === opponentTeamId;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        disabled={isTakenByOpponent}
                        onClick={() => sharedOnlineClient.selectTeam(t.id)}
                        className={`p-2 rounded-xl border text-left flex items-center gap-2 transition ${
                          isSelectedByMe
                            ? 'bg-cyan-500/20 border-cyan-400 text-white'
                            : isTakenByOpponent
                            ? 'bg-slate-900/40 border-rose-500/30 text-slate-500 opacity-50 cursor-not-allowed'
                            : 'bg-slate-900/80 border-white/10 hover:border-white/25 text-slate-200 cursor-pointer'
                        }`}
                      >
                        <TeamCrest team={t} size={28} />
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-black truncate">{t.name}</div>
                          <div className="text-[9px] text-slate-400 truncate">
                            {isTakenByOpponent ? 'Elegido por rival' : `MED ${t.overall}`}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Start Match Button (Host) or Waiting Indicator (Guest) */}
              <div className="flex items-center justify-end gap-3 pt-1">
                {side === 'home' ? (
                  <button
                    data-testid="btn-online-start-match"
                    disabled={!room?.guest?.connected}
                    onClick={() => sharedOnlineClient.startMatch()}
                    className={`px-6 py-3.5 rounded-xl font-black uppercase tracking-wider text-xs flex items-center gap-2 transition ${
                      room?.guest?.connected
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_25px_rgba(16,185,129,0.45)] cursor-pointer'
                        : 'bg-slate-800 text-slate-500 border border-white/10 cursor-not-allowed'
                    }`}
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>
                      {room?.guest?.connected
                        ? 'INICIAR PARTIDO ONLINE'
                        : 'ESPERANDO AL JUGADOR 2 PARA INICIAR...'}
                    </span>
                  </button>
                ) : (
                  <div className="px-5 py-3 rounded-xl bg-cyan-500/15 border border-cyan-400/40 text-cyan-200 text-xs font-black uppercase flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span>Conectado como Visitante · Esperando a que el Anfitrión inicie el partido...</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
