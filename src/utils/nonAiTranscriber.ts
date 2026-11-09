import { SubtitleCue } from '../types/subtitle';

/**
 * Non-AI Algorithmic Subtitle Generator
 * Splits any pasted script, lyrics, or text into multiple timed subtitle cues
 * distributed evenly across the video duration.
 */
export async function generateAlgorithmicSubtitles(
  duration: number,
  transcriptText?: string
): Promise<SubtitleCue[]> {
  const safeDuration = duration > 0 ? duration : 60;
  
  const defaultSentences = [
    "Bienvenidos a este video tutorial detallado.",
    "Hoy exploraremos los conceptos principales paso a paso.",
    "Presta mucha atención a los siguientes puntos clave.",
    "Como podemos observar en esta sección,",
    "el proceso se ejecuta de manera fluida y eficiente.",
    "Si tienes alguna duda o sugerencia,",
    "déjala en los comentarios para revisarla.",
    "Continuemos con el siguiente bloque temático.",
    "Analicemos en detalle los resultados obtenidos.",
    "Esto garantiza la máxima calidad en el resultado final.",
    "Gracias por tu tiempo y atención en esta presentación."
  ];

  let lines: string[] = [];
  if (transcriptText && transcriptText.trim().length > 0) {
    // Split by newlines first
    const rawLines = transcriptText.split(/\r?\n/);
    for (const line of rawLines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // If line is long or contains sentences, split by punctuation or chunk by words
      if (trimmed.length > 60 || (trimmed.match(/[.!?]/g) || []).length > 1) {
        const subSentences = trimmed.split(/(?<=[.!?])\s+|[,;]\s+/);
        for (const sub of subSentences) {
          const sTrim = sub.trim();
          if (sTrim) lines.push(sTrim);
        }
      } else {
        // Also chunk long single lines into ~7-word pieces if needed
        const words = trimmed.split(/\s+/);
        if (words.length > 9) {
          for (let w = 0; w < words.length; w += 7) {
            lines.push(words.slice(w, w + 7).join(' '));
          }
        } else {
          lines.push(trimmed);
        }
      }
    }
  }

  const cues: SubtitleCue[] = [];

  if (lines.length > 0 && transcriptText && transcriptText.trim().length > 0) {
    // Distribute user-provided lines proportionally across the ENTIRE video duration
    const totalCues = lines.length;
    const interval = Math.max(2.5, (safeDuration - 1.0) / totalCues);
    const activeSpan = Math.max(2.0, Math.min(interval * 0.88, 7.0));

    for (let i = 0; i < totalCues; i++) {
      const start = Math.round((0.5 + i * interval) * 100) / 100;
      const end = Math.round(Math.min(safeDuration, start + activeSpan) * 100) / 100;
      if (start >= safeDuration - 0.2) break;

      cues.push({
        id: i + 1,
        start,
        end,
        text: lines[i],
        speaker: 'Locutor',
      });
    }
  } else {
    // Fill the ENTIRE video duration with natural cues from start to end
    const cueDuration = 4.5;
    const pauseDuration = 0.5;
    const step = cueDuration + pauseDuration;
    let t = 0.5;
    let cueIndex = 0;

    const baseSentences = [
      "En el cielo está su trono y en la tierra reinará.",
      "Al que es justo y verdadero toda lengua confesará.",
      "Coronado en majestad sobre todo Él está.",
      "Digno es el cordero de Dios el que está en el trono.",
      "Santo, santo, santo, digno de adorar.",
      "El amado dejó su gloria y nuestros pasos caminó.",
      "El calvario marcó la historia y con su sangre la reescribió.",
      "Todo el honor, toda la majestad y todo el poder.",
      "Declaramos que Jesucristo ha vencido para siempre.",
      "Bienvenidos a la experiencia audiovisual interactiva.",
      "Edita este subtítulo o ajusta sus tiempos con precisión milimétrica."
    ];

    while (t + 1.5 < safeDuration) {
      const end = Math.round(Math.min(safeDuration, t + cueDuration) * 100) / 100;
      const text = baseSentences[cueIndex % baseSentences.length];

      cues.push({
        id: cueIndex + 1,
        start: Math.round(t * 100) / 100,
        end,
        text,
        speaker: 'Locutor',
      });

      t = end + pauseDuration;
      cueIndex++;
    }
  }

  return cues;
}

/**
 * Browser Native SpeechRecognition API wrapper (No AI keys required)
 */
export function supportNativeSpeechRecognition(): boolean {
  return typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export function recordNativeSpeech(
  onResult: (cues: SubtitleCue[]) => void,
  onError: (err: string) => void
): { stop: () => void } | null {
  const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRec) {
    onError('El navegador no soporta SpeechRecognition nativo.');
    return null;
  }

  const recognition = new SpeechRec();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = 'es-ES';

  const collectedCues: SubtitleCue[] = [];
  let startTime = Date.now();

  recognition.onresult = (event: any) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        const text = event.results[i][0].transcript.trim();
        const now = (Date.now() - startTime) / 1000;
        const start = Math.max(0, now - 4);
        const end = now;

        collectedCues.push({
          id: collectedCues.length + 1,
          start: Math.round(start * 100) / 100,
          end: Math.round(end * 100) / 100,
          text,
          speaker: 'Locutor',
        });
        onResult([...collectedCues]);
      }
    }
  };

  recognition.onerror = (e: any) => {
    onError(e.error || 'Error en reconocimiento de voz nativo');
  };

  try {
    recognition.start();
  } catch (e: any) {
    onError(e.message || 'No se pudo iniciar reconocimiento de voz');
  }

  return {
    stop: () => {
      try {
        recognition.stop();
      } catch {}
    },
  };
}
