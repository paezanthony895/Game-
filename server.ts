import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// REAL-TIME ONLINE MULTIPLAYER ROOM MANAGER (WebSockets)
// ============================================================================
interface OnlineRoomPlayer {
  playerId: string;
  playerName: string;
  teamId: string;
  formationId: string;
  ready: boolean;
  connected: boolean;
  ws: WebSocket | null;
}

interface OnlineRoom {
  code: string;
  createdAt: number;
  lastActivityAt: number;
  status: 'waiting' | 'playing' | 'finished';
  host: OnlineRoomPlayer;
  guest: OnlineRoomPlayer | null;
  latestSnapshot: unknown | null;
}

const activeRooms = new Map<string, OnlineRoom>();
const socketToRoom = new Map<WebSocket, { code: string; side: 'home' | 'away'; playerId: string }>();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateUniqueRoomCode(): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    if (!activeRooms.has(code)) return code;
  }
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function sanitizeRoom(room: OnlineRoom) {
  return {
    code: room.code,
    status: room.status,
    createdAt: room.createdAt,
    host: {
      playerId: room.host.playerId,
      playerName: room.host.playerName,
      teamId: room.host.teamId,
      formationId: room.host.formationId,
      ready: room.host.ready,
      connected: room.host.connected,
    },
    guest: room.guest
      ? {
          playerId: room.guest.playerId,
          playerName: room.guest.playerName,
          teamId: room.guest.teamId,
          formationId: room.guest.formationId,
          ready: room.guest.ready,
          connected: room.guest.connected,
        }
      : null,
  };
}

function sendJson(ws: WebSocket | null, payload: unknown): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(payload));
  } catch {
    // ignore broken pipe
  }
}

function broadcastRoom(room: OnlineRoom, payload: unknown): void {
  sendJson(room.host.ws, payload);
  if (room.guest) sendJson(room.guest.ws, payload);
}

const ALLOWED_ASPECT_RATIOS = new Set([
  '1:1',
  '2:3',
  '3:2',
  '3:4',
  '4:3',
  '9:16',
  '16:9',
  '21:9',
]);

const ALLOWED_SIZES = new Set(['1K', '2K', '4K']);

// LRU cache for synthesized TTS audio (WAV base64) so common calls return in 0ms
const ttsAudioCache = new Map<string, string>();
const MAX_TTS_CACHE = 120;

function cacheTtsAudio(key: string, base64Wav: string): void {
  if (ttsAudioCache.size >= MAX_TTS_CACHE) {
    const oldestKey = ttsAudioCache.keys().next().value;
    if (oldestKey) ttsAudioCache.delete(oldestKey);
  }
  ttsAudioCache.set(key, base64Wav);
}

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT ?? 3000);

  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
      activeMultiplayerRooms: activeRooms.size,
    });
  });

  app.get('/api/multiplayer/rooms/:code', (req, res) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    const room = activeRooms.get(code);
    if (!room) {
      res.status(404).json({ error: 'No existe ninguna sala activa con ese código.', code: 'ROOM_NOT_FOUND' });
      return;
    }
    res.json({ room: sanitizeRoom(room) });
  });

  /**
   * Dual-Voice Latin American Football Commentary via Gemini 3.8 TTS
   * Speakers:
   * - Relator (Puck): Energetic Argentine/Latin American football play-by-play narrator
   * - Comentarista (Fenrir): Analytical second voice
   */
  app.post('/api/tts-commentary', async (req, res) => {
    try {
      const {
        relatorText,
        comentaristaText,
        excitement = 'normal',
      } = (req.body ?? {}) as {
        relatorText?: string;
        comentaristaText?: string;
        excitement?: 'normal' | 'high' | 'goal';
      };

      if (!relatorText || typeof relatorText !== 'string' || !relatorText.trim()) {
        res.status(400).json({ error: 'Se requiere relatorText para sintetizar el relato.' });
        return;
      }

      const cleanRelator = relatorText.trim();
      const cleanComentarista = comentaristaText?.trim() || '';
      const cacheKey = `comm:${excitement}:${cleanRelator}|${cleanComentarista}`;
      const cached = ttsAudioCache.get(cacheKey);
      if (cached) {
        res.json({ audioBase64: cached, mimeType: 'audio/wav', cached: true });
        return;
      }

      const ai = getGenAIClient();
      if (!ai) {
        res.status(200).json({
          audioBase64: null,
          fallback: true,
          code: 'MISSING_API_KEY',
        });
        return;
      }

      const stylePrompt =
        excitement === 'goal'
          ? 'Transmitan como relatores de fútbol sudamericano en un estadio lleno, con máxima pasión, emoción explosiva y ritmo rápido de transmisión deportiva:'
          : excitement === 'high'
          ? 'Transmitan como relatores de televisión de fútbol latinoamericano en jugada de peligro, con tensión, ritmo dinámico y voz natural:'
          : 'Transmitan como dupla de relatores de fútbol latinoamericano en vivo, con cadencia natural de estadio:';

      const transcript = cleanComentarista
        ? `${stylePrompt}\nRelator: ${cleanRelator}\nComentarista: ${cleanComentarista}`
        : `${stylePrompt}\nRelator: ${cleanRelator}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-tts',
        contents: [{ parts: [{ text: transcript }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: [
                {
                  speaker: 'Relator',
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Puck' },
                  },
                },
                {
                  speaker: 'Comentarista',
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Fenrir' },
                  },
                },
              ],
            },
          },
        },
      });

      const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!audioBase64) {
        res.status(200).json({ audioBase64: null, fallback: true });
        return;
      }

      cacheTtsAudio(cacheKey, audioBase64);
      res.json({
        audioBase64,
        mimeType: 'audio/wav',
        cached: false,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al generar audio de relato.';
      res.status(200).json({ audioBase64: null, fallback: true, error: message });
    }
  });

  /**
   * Stadium Crowd Chant / Insult synthesis via Gemini 3.8 Flash Lite TTS
   * Mixed into a multi-voice stadium chorus on the client.
   */
  app.post('/api/tts-crowd', async (req, res) => {
    try {
      const { chantText } = (req.body ?? {}) as { chantText?: string };
      if (!chantText || typeof chantText !== 'string' || !chantText.trim()) {
        res.status(400).json({ error: 'Se requiere chantText.' });
        return;
      }

      const cleanChant = chantText.trim();
      const cacheKey = `crowd:${cleanChant}`;
      const cached = ttsAudioCache.get(cacheKey);
      if (cached) {
        res.json({ audioBase64: cached, mimeType: 'audio/wav', cached: true });
        return;
      }

      const ai = getGenAIClient();
      if (!ai) {
        res.status(200).json({ audioBase64: null, fallback: true, code: 'MISSING_API_KEY' });
        return;
      }

      const prompt = `Grita con fuerza y pasión como un hincha de fútbol sudamericano en la tribuna popular del estadio: ${cleanChant}`;
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Fenrir' },
            },
          },
        },
      });

      const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!audioBase64) {
        res.status(200).json({ audioBase64: null, fallback: true });
        return;
      }

      cacheTtsAudio(cacheKey, audioBase64);
      res.json({ audioBase64, mimeType: 'audio/wav', cached: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error en TTS de hinchada.';
      res.status(200).json({ audioBase64: null, fallback: true, error: message });
    }
  });

  app.post('/api/generate-image', async (req, res) => {
    try {
      const {
        prompt,
        aspectRatio = '1:1',
        imageSize = '1K',
        quality = 'studio',
      } = (req.body ?? {}) as {
        prompt?: string;
        aspectRatio?: string;
        imageSize?: string;
        quality?: 'general' | 'studio';
      };

      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        res.status(400).json({ error: 'Se requiere una descripción válida para generar la imagen.' });
        return;
      }

      const safeAspect = ALLOWED_ASPECT_RATIOS.has(aspectRatio) ? aspectRatio : '1:1';
      const safeSize = ALLOWED_SIZES.has(imageSize) ? imageSize : '1K';

      const ai = getGenAIClient();
      if (!ai) {
        res.status(503).json({
          error: 'La clave GEMINI_API_KEY no está configurada en el entorno del servidor.',
          code: 'MISSING_API_KEY',
        });
        return;
      }

      const model =
        quality === 'general' ? 'gemini-nano-banana-2.1' : 'gemini-3-pro-image-preview';

      const response = await ai.models.generateContent({
        model,
        contents: {
          parts: [{ text: prompt.trim() }],
        },
        config: {
          imageConfig: {
            aspectRatio: safeAspect,
            imageSize: safeSize,
          },
        },
      });

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      let imageDataUrl: string | null = null;
      let textNote = '';

      for (const part of parts) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType ?? 'image/png';
          imageDataUrl = `data:${mime};base64,${part.inlineData.data}`;
        } else if (part.text) {
          textNote += part.text;
        }
      }

      if (!imageDataUrl) {
        res.status(502).json({
          error: 'El modelo no devolvió datos de imagen. Ajusta la descripción e inténtalo de nuevo.',
          note: textNote,
        });
        return;
      }

      res.json({
        imageDataUrl,
        model,
        aspectRatio: safeAspect,
        imageSize: safeSize,
        note: textNote || undefined,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error inesperado al generar la imagen.';
      const status =
        message.includes('403') || message.includes('PERMISSION_DENIED')
          ? 403
          : message.includes('429') || message.includes('RESOURCE_EXHAUSTED')
            ? 429
            : 500;
      res.status(status).json({ error: message });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(__dirname, 'dist');
  const httpServer = http.createServer(app);

  // ==========================================================================
  // WEBSOCKET SERVER FOR REAL-TIME ONLINE MULTIPLAYER (/ws/multiplayer)
  // ==========================================================================
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const reqUrl = request.url || '';
    if (reqUrl.startsWith('/ws/multiplayer')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws: WebSocket) => {
    ws.on('message', (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(raw)) as Record<string, unknown>;
      } catch {
        return;
      }

      const type = String(msg.type || '');

      if (type === 'ping') {
        sendJson(ws, { type: 'pong', t: msg.t ?? Date.now() });
        return;
      }

      if (type === 'create_room') {
        const playerId = String(msg.playerId || `p_${crypto.randomBytes(4).toString('hex')}`);
        const playerName = String(msg.playerName || 'Anfitrión').slice(0, 24);
        const teamId = String(msg.teamId || 'real_madrid');
        const formationId = String(msg.formationId || '4-3-3_standard');
        const code = generateUniqueRoomCode();

        const room: OnlineRoom = {
          code,
          createdAt: Date.now(),
          lastActivityAt: Date.now(),
          status: 'waiting',
          host: {
            playerId,
            playerName,
            teamId,
            formationId,
            ready: true,
            connected: true,
            ws,
          },
          guest: null,
          latestSnapshot: null,
        };

        activeRooms.set(code, room);
        socketToRoom.set(ws, { code, side: 'home', playerId });

        sendJson(ws, {
          type: 'room_created',
          side: 'home',
          playerId,
          room: sanitizeRoom(room),
        });
        return;
      }

      if (type === 'join_room') {
        const code = String(msg.code || '').trim().toUpperCase();
        const playerId = String(msg.playerId || `p_${crypto.randomBytes(4).toString('hex')}`);
        const playerName = String(msg.playerName || 'Invitado').slice(0, 24);
        let teamId = String(msg.teamId || 'fc_barcelona');
        const formationId = String(msg.formationId || '4-3-3_standard');

        if (!/^[A-Z0-9]{6}$/.test(code)) {
          sendJson(ws, {
            type: 'room_error',
            code: 'INVALID_CODE',
            message: 'El código de invitación es inválido. Debe tener 6 caracteres alfanuméricos.',
          });
          return;
        }

        const room = activeRooms.get(code);
        if (!room) {
          sendJson(ws, {
            type: 'room_error',
            code: 'ROOM_NOT_FOUND',
            message: `La sala "${code}" no existe o ya fue cerrada.`,
          });
          return;
        }

        // Check if this is an automatic reconnection from Host or Guest
        if (room.host.playerId === playerId) {
          room.host.ws = ws;
          room.host.connected = true;
          room.lastActivityAt = Date.now();
          socketToRoom.set(ws, { code, side: 'home', playerId });
          sendJson(ws, {
            type: 'room_joined',
            side: 'home',
            playerId,
            reconnected: true,
            room: sanitizeRoom(room),
          });
          broadcastRoom(room, {
            type: 'opponent_reconnected',
            side: 'home',
            room: sanitizeRoom(room),
          });
          return;
        }

        if (room.guest && room.guest.playerId === playerId) {
          room.guest.ws = ws;
          room.guest.connected = true;
          room.lastActivityAt = Date.now();
          socketToRoom.set(ws, { code, side: 'away', playerId });
          sendJson(ws, {
            type: 'room_joined',
            side: 'away',
            playerId,
            reconnected: true,
            room: sanitizeRoom(room),
          });
          broadcastRoom(room, {
            type: 'opponent_reconnected',
            side: 'away',
            room: sanitizeRoom(room),
          });
          return;
        }

        if (room.guest && room.guest.connected) {
          sendJson(ws, {
            type: 'room_error',
            code: 'ROOM_FULL',
            message: 'La sala ya está llena (2/2 jugadores conectados).',
          });
          return;
        }

        // Ensure guest does not duplicate the host's team initially
        if (teamId === room.host.teamId) {
          teamId = room.host.teamId === 'real_madrid' ? 'fc_barcelona' : 'real_madrid';
        }

        room.guest = {
          playerId,
          playerName,
          teamId,
          formationId,
          ready: true,
          connected: true,
          ws,
        };
        room.lastActivityAt = Date.now();
        socketToRoom.set(ws, { code, side: 'away', playerId });

        sendJson(ws, {
          type: 'room_joined',
          side: 'away',
          playerId,
          room: sanitizeRoom(room),
        });
        broadcastRoom(room, {
          type: 'room_updated',
          room: sanitizeRoom(room),
        });
        return;
      }

      const binding = socketToRoom.get(ws);
      if (!binding) return;
      const room = activeRooms.get(binding.code);
      if (!room) return;
      room.lastActivityAt = Date.now();

      if (type === 'select_team') {
        const nextTeamId = String(msg.teamId || '');
        const nextFormationId = String(msg.formationId || '');
        const otherPlayer = binding.side === 'home' ? room.guest : room.host;

        if (nextTeamId && otherPlayer && otherPlayer.teamId === nextTeamId) {
          sendJson(ws, {
            type: 'room_error',
            code: 'DUPLICATE_TEAM',
            message: 'Ese equipo ya fue seleccionado por el otro jugador. Elige un equipo diferente.',
          });
          return;
        }

        const targetPlayer = binding.side === 'home' ? room.host : room.guest;
        if (targetPlayer) {
          if (nextTeamId) targetPlayer.teamId = nextTeamId;
          if (nextFormationId) targetPlayer.formationId = nextFormationId;
          broadcastRoom(room, {
            type: 'room_updated',
            room: sanitizeRoom(room),
          });
        }
        return;
      }

      if (type === 'set_ready') {
        const targetPlayer = binding.side === 'home' ? room.host : room.guest;
        if (targetPlayer) {
          targetPlayer.ready = Boolean(msg.ready);
          broadcastRoom(room, {
            type: 'room_updated',
            room: sanitizeRoom(room),
          });
        }
        return;
      }

      if (type === 'start_match') {
        if (binding.side !== 'home') {
          sendJson(ws, {
            type: 'room_error',
            code: 'ONLY_HOST_CAN_START',
            message: 'Solo el anfitrión de la sala puede iniciar el partido.',
          });
          return;
        }
        if (!room.guest || !room.guest.connected) {
          sendJson(ws, {
            type: 'room_error',
            code: 'WAITING_FOR_GUEST',
            message: 'Esperando a que el segundo jugador se una a la sala.',
          });
          return;
        }
        if (room.host.teamId === room.guest.teamId) {
          sendJson(ws, {
            type: 'room_error',
            code: 'DUPLICATE_TEAM',
            message: 'Ambos jugadores deben elegir equipos distintos antes de iniciar.',
          });
          return;
        }
        room.status = 'playing';
        broadcastRoom(room, {
          type: 'match_started',
          room: sanitizeRoom(room),
        });
        return;
      }

      if (type === 'guest_input') {
        if (binding.side === 'away' && room.host.connected) {
          sendJson(room.host.ws, {
            type: 'remote_guest_input',
            input: msg.input,
            t: Date.now(),
          });
        }
        return;
      }

      if (type === 'host_snapshot') {
        if (binding.side === 'home' && room.guest && room.guest.connected) {
          room.latestSnapshot = msg.snapshot;
          sendJson(room.guest.ws, {
            type: 'match_snapshot',
            snapshot: msg.snapshot,
          });
        }
        return;
      }

      if (type === 'match_event') {
        const targetWs = binding.side === 'home' ? room.guest?.ws ?? null : room.host.ws;
        sendJson(targetWs, {
          type: 'match_event',
          fromSide: binding.side,
          payload: msg.payload,
        });
        return;
      }

      if (type === 'leave_room') {
        socketToRoom.delete(ws);
        if (binding.side === 'home') {
          if (room.guest?.ws) {
            sendJson(room.guest.ws, {
              type: 'opponent_left',
              message: 'El anfitrión cerró la sala.',
            });
            socketToRoom.delete(room.guest.ws);
          }
          activeRooms.delete(room.code);
        } else if (room.guest) {
          room.guest = null;
          room.status = 'waiting';
          sendJson(room.host.ws, {
            type: 'opponent_left',
            message: 'El jugador invitado abandonó la sala.',
            room: sanitizeRoom(room),
          });
        }
        return;
      }
    });

    ws.on('close', () => {
      const binding = socketToRoom.get(ws);
      if (!binding) return;
      socketToRoom.delete(ws);

      const room = activeRooms.get(binding.code);
      if (!room) return;

      if (binding.side === 'home') {
        room.host.connected = false;
        room.host.ws = null;
        if (room.guest?.connected) {
          sendJson(room.guest.ws, {
            type: 'opponent_disconnected',
            side: 'home',
            message: 'El anfitrión perdió la conexión. Esperando reconexión...',
            room: sanitizeRoom(room),
          });
        }
      } else if (room.guest) {
        room.guest.connected = false;
        room.guest.ws = null;
        if (room.host.connected) {
          sendJson(room.host.ws, {
            type: 'opponent_disconnected',
            side: 'away',
            message: 'Tu rival perdió la conexión. Esperando reconexión...',
            room: sanitizeRoom(room),
          });
        }
      }

      // If both players disconnected, schedule room cleanup after 45s grace period
      setTimeout(() => {
        const current = activeRooms.get(binding.code);
        if (!current) return;
        const hostAlive = current.host.connected;
        const guestAlive = current.guest?.connected ?? false;
        if (!hostAlive && !guestAlive) {
          activeRooms.delete(binding.code);
        }
      }, 45_000);
    });
  });

  // Periodic cleanup of inactive rooms older than 20 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [code, room] of activeRooms.entries()) {
      if (now - room.lastActivityAt > 20 * 60 * 1000) {
        activeRooms.delete(code);
      }
    }
  }, 60_000);

  if (!isProd) {
    const disableHmr = process.env.DISABLE_HMR === 'true';
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: disableHmr ? false : { server: httpServer },
        ws: disableHmr ? false : { server: httpServer },
      },
      appType: 'spa',
    });

    if (disableHmr) {
      app.get('/@vite/client', async (_req, res, next) => {
        try {
          const result = await vite.transformRequest('/@vite/client');
          if (!result) return next();
          const patched = result.code.replace(
            /transport\.connect\(createHMRHandler\(handleMessage\)\);?/g,
            'transport.connect = async () => {}; transport.send = async () => {}; transport.disconnect = async () => {};'
          );
          res.status(200).type('application/javascript').send(patched);
        } catch {
          next();
        }
      });
    }

    app.use(vite.middlewares);
  } else if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Atlas Fútbol Pro server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
