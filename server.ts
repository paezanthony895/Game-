import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Modality } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    });
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
