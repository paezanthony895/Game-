import type { UserInputState } from '../engine/matchEngine';
import type { MatchEngine } from '../engine/matchEngine';

export interface OnlinePlayerSummary {
  playerId: string;
  playerName: string;
  teamId: string;
  formationId: string;
  ready: boolean;
  connected: boolean;
}

export interface OnlineRoomSummary {
  code: string;
  status: 'waiting' | 'playing' | 'finished';
  createdAt: number;
  host: OnlinePlayerSummary;
  guest: OnlinePlayerSummary | null;
}

export type OnlineSnapshotData = ReturnType<MatchEngine['serializeOnlineSnapshot']>;

export interface OnlineClientListeners {
  onRoomUpdate?: (room: OnlineRoomSummary, side: 'home' | 'away') => void;
  onError?: (code: string, message: string) => void;
  onMatchStart?: (room: OnlineRoomSummary, side: 'home' | 'away') => void;
  onRemoteGuestInput?: (input: UserInputState) => void;
  onMatchSnapshot?: (snapshot: OnlineSnapshotData) => void;
  onOpponentStatus?: (status: 'disconnected' | 'reconnected' | 'left', message: string) => void;
  onConnectionChange?: (connected: boolean) => void;
}

function getPersistentPlayerId(): string {
  try {
    const key = 'atlas_online_player_id';
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const created = `p_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(key, created);
    return created;
  } catch {
    return `p_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export class OnlineMultiplayerClient {
  private ws: WebSocket | null = null;
  private listeners: OnlineClientListeners = {};
  private playerId: string = getPersistentPlayerId();
  public side: 'home' | 'away' = 'home';
  public currentRoom: OnlineRoomSummary | null = null;
  public isConnected = false;
  private pingInterval: number | null = null;

  public setListeners(next: OnlineClientListeners): void {
    this.listeners = { ...this.listeners, ...next };
  }

  public connect(onOpen?: () => void): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      if (this.ws.readyState === WebSocket.OPEN) onOpen?.();
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/multiplayer`;
    const ws = new WebSocket(wsUrl);
    this.ws = ws;

    ws.onopen = () => {
      this.isConnected = true;
      this.listeners.onConnectionChange?.(true);
      if (this.pingInterval) window.clearInterval(this.pingInterval);
      this.pingInterval = window.setInterval(() => {
        this.send({ type: 'ping', t: Date.now() });
      }, 12_000);
      onOpen?.();
    };

    ws.onmessage = (ev) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(ev.data)) as Record<string, unknown>;
      } catch {
        return;
      }

      const type = String(msg.type || '');

      if (type === 'room_created' || type === 'room_joined') {
        this.side = (msg.side as 'home' | 'away') || 'home';
        this.currentRoom = msg.room as OnlineRoomSummary;
        this.listeners.onRoomUpdate?.(this.currentRoom, this.side);
        return;
      }

      if (type === 'room_updated') {
        this.currentRoom = msg.room as OnlineRoomSummary;
        this.listeners.onRoomUpdate?.(this.currentRoom, this.side);
        return;
      }

      if (type === 'room_error') {
        this.listeners.onError?.(String(msg.code || 'ERROR'), String(msg.message || 'Error en la sala.'));
        return;
      }

      if (type === 'match_started') {
        this.currentRoom = msg.room as OnlineRoomSummary;
        this.listeners.onMatchStart?.(this.currentRoom, this.side);
        return;
      }

      if (type === 'remote_guest_input') {
        if (msg.input) {
          this.listeners.onRemoteGuestInput?.(msg.input as UserInputState);
        }
        return;
      }

      if (type === 'match_snapshot') {
        if (msg.snapshot) {
          this.listeners.onMatchSnapshot?.(msg.snapshot as OnlineSnapshotData);
        }
        return;
      }

      if (type === 'opponent_disconnected') {
        if (msg.room) this.currentRoom = msg.room as OnlineRoomSummary;
        this.listeners.onOpponentStatus?.(
          'disconnected',
          String(msg.message || 'Tu rival perdió la conexión.')
        );
        if (this.currentRoom) this.listeners.onRoomUpdate?.(this.currentRoom, this.side);
        return;
      }

      if (type === 'opponent_reconnected') {
        if (msg.room) this.currentRoom = msg.room as OnlineRoomSummary;
        this.listeners.onOpponentStatus?.(
          'reconnected',
          '¡Tu rival se ha reconectado a la partida!'
        );
        if (this.currentRoom) this.listeners.onRoomUpdate?.(this.currentRoom, this.side);
        return;
      }

      if (type === 'opponent_left') {
        if (msg.room) {
          this.currentRoom = msg.room as OnlineRoomSummary;
          this.listeners.onRoomUpdate?.(this.currentRoom, this.side);
        } else {
          this.currentRoom = null;
        }
        this.listeners.onOpponentStatus?.(
          'left',
          String(msg.message || 'El otro jugador abandonó la sala.')
        );
        return;
      }
    };

    ws.onclose = () => {
      this.isConnected = false;
      this.listeners.onConnectionChange?.(false);
      if (this.pingInterval) {
        window.clearInterval(this.pingInterval);
        this.pingInterval = null;
      }
    };
  }

  private send(payload: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(payload));
  }

  public createRoom(playerName: string, teamId: string, formationId: string): void {
    this.connect(() => {
      this.send({
        type: 'create_room',
        playerId: this.playerId,
        playerName: playerName.trim() || 'Anfitrión',
        teamId,
        formationId,
      });
    });
  }

  public joinRoom(code: string, playerName: string, teamId: string, formationId: string): void {
    const cleanCode = code.trim().toUpperCase();
    this.connect(() => {
      this.send({
        type: 'join_room',
        code: cleanCode,
        playerId: this.playerId,
        playerName: playerName.trim() || 'Invitado',
        teamId,
        formationId,
      });
    });
  }

  public selectTeam(teamId: string, formationId?: string): void {
    if (!this.currentRoom) return;
    this.send({
      type: 'select_team',
      code: this.currentRoom.code,
      teamId,
      formationId:
        formationId ??
        (this.side === 'home'
          ? this.currentRoom.host.formationId
          : this.currentRoom.guest?.formationId || '4-3-3_standard'),
    });
  }

  public startMatch(): void {
    if (!this.currentRoom) return;
    this.send({
      type: 'start_match',
      code: this.currentRoom.code,
    });
  }

  public sendGuestInput(input: UserInputState): void {
    if (!this.currentRoom || this.side !== 'away') return;
    this.send({
      type: 'guest_input',
      code: this.currentRoom.code,
      input,
    });
  }

  public sendHostSnapshot(snapshot: OnlineSnapshotData): void {
    if (!this.currentRoom || this.side !== 'home') return;
    this.send({
      type: 'host_snapshot',
      code: this.currentRoom.code,
      snapshot,
    });
  }

  public leaveRoom(): void {
    if (this.currentRoom) {
      this.send({
        type: 'leave_room',
        code: this.currentRoom.code,
      });
      this.currentRoom = null;
    }
  }

  public disconnect(): void {
    this.leaveRoom();
    if (this.pingInterval) {
      window.clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}

export const sharedOnlineClient = new OnlineMultiplayerClient();
