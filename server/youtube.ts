import { Ytdl, chooseFormat, parseVideoId } from '@distube/ytdl-core';
import { Response } from 'express';

const ytdl = new Ytdl();

export function extractYouTubeId(url: string): string | null {
  try {
    const id = parseVideoId(url);
    if (id) return id;
  } catch {
    // continue to regex
  }
  const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

const INVIDIOUS_INSTANCES = [
  'https://inv.tux.pizza',
  'https://invidious.nerdvpn.de',
  'https://invidious.protokolla.fi',
  'https://yt.artemislena.eu',
];

export interface YouTubeVideoInfo {
  title: string;
  duration: number;
  thumbnail: string;
  author: string;
  videoId: string;
}

/**
 * Fetch YouTube video information
 */
export async function getYouTubeVideoInfo(url: string): Promise<YouTubeVideoInfo> {
  const videoId = extractYouTubeId(url);
  if (!videoId) {
    throw new Error('URL de YouTube inválida. Asegúrate de incluir un enlace de YouTube válido.');
  }

  // Attempt 1: Using @distube/ytdl-core
  try {
    const info = await ytdl.getInfo(url);

    return {
      videoId,
      title: info.videoDetails.title || 'Video de YouTube',
      duration: Number(info.videoDetails.lengthSeconds) || 0,
      thumbnail:
        info.videoDetails.thumbnails?.[info.videoDetails.thumbnails.length - 1]?.url ||
        `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      author: info.videoDetails.author?.name || 'YouTube',
    };
  } catch (err: any) {
    console.warn('ytdl.getInfo notice, using alternative info source:', err?.message);

    // Attempt 2: Fallback to public Invidious instances
    for (const instance of INVIDIOUS_INSTANCES) {
      try {
        const res = await fetch(`${instance}/api/v1/videos/${videoId}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
          const data = await res.json();
          return {
            videoId,
            title: data.title || 'Video de YouTube',
            duration: Number(data.lengthSeconds) || 0,
            thumbnail:
              data.videoThumbnails?.[0]?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
            author: data.author || 'YouTube',
          };
        }
      } catch {
        continue;
      }
    }

    // Default fallback using videoId
    return {
      videoId,
      title: `YouTube Video (${videoId})`,
      duration: 300,
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      author: 'YouTube',
    };
  }
}

/**
 * Stream MP4 video to response
 */
export async function streamYouTubeVideo(url: string, res: Response) {
  const videoId = extractYouTubeId(url);
  if (!videoId) {
    res.status(400).json({ error: 'URL de YouTube no válida.' });
    return;
  }

  // Attempt 1: Stream using ytdl download
  try {
    const info = await ytdl.getInfo(url);
    const format = chooseFormat(info.formats, {
      quality: 'highest',
      filter: (f: any) => f.container === 'mp4' && f.hasVideo && f.hasAudio,
    });

    if (format) {
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(info.videoDetails.title || 'video')}.mp4"`
      );

      const stream = ytdl.download(info, { format });
      stream.on('error', (err: any) => {
        console.error('ytdl download stream error:', err);
      });
      stream.pipe(res);
      return;
    }
  } catch (err: any) {
    console.warn('Direct ytdl streaming notice:', err?.message);
  }

  // Attempt 2: Fallback to Invidious progressive format stream
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const apiRes = await fetch(`${instance}/api/v1/videos/${videoId}`, {
        signal: AbortSignal.timeout(4000),
      });
      if (apiRes.ok) {
        const data = await apiRes.json();
        const formats = data.formatStreams || [];
        const mp4Format =
          formats.find((f: any) => f.container === 'mp4' || f.type?.includes('mp4')) || formats[0];

        if (mp4Format && mp4Format.url) {
          const videoStream = await fetch(mp4Format.url);
          if (videoStream.ok && videoStream.body) {
            res.setHeader('Content-Type', 'video/mp4');
            res.setHeader('Accept-Ranges', 'bytes');
            const reader = videoStream.body.getReader();
            const pump = async () => {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(value);
              }
              res.end();
            };
            await pump();
            return;
          }
        }
      }
    } catch {
      continue;
    }
  }

  if (!res.headersSent) {
    res.status(502).json({
      error:
        'No se pudo descargar automáticamente este video de YouTube debido a restricciones de YouTube. Por favor intenta con otro enlace o sube el archivo descargado.',
    });
  }
}
