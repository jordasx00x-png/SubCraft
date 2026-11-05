import { SubtitleCue } from '../types/subtitle';

// High quality sample video with audio (Nature & Technology documentary narration)
export const SAMPLE_VIDEO_URL =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
export const SAMPLE_VIDEO_NAME = 'Documental_Creativo_5min.mp4';

export const INITIAL_SAMPLE_SUBTITLES: SubtitleCue[] = [
  {
    id: 1,
    start: 0.5,
    end: 3.8,
    text: '¡Bienvenidos a SubCraft AI Studio!',
    speaker: 'Presentador',
  },
  {
    id: 2,
    start: 4.2,
    end: 7.9,
    text: 'Esta plataforma genera subtítulos automáticos para tus videos con inteligencia artificial.',
    speaker: 'Presentador',
  },
  {
    id: 3,
    start: 8.3,
    end: 12.0,
    text: 'Puedes editar cada frase, ajustar los tiempos y personalizar tipografías y colores.',
    speaker: 'Presentador',
  },
  {
    id: 4,
    start: 12.5,
    end: 16.8,
    text: 'Traduce a múltiples idiomas en segundos con tecnología neuronal de Gemini.',
    speaker: 'Presentador',
  },
  {
    id: 5,
    start: 17.2,
    end: 21.5,
    text: 'Exporta tus subtítulos en formato .SRT o descarga el video quemado en alta resolución.',
    speaker: 'Presentador',
  },
  {
    id: 6,
    start: 22.0,
    end: 26.4,
    text: 'Todos tus cambios se sincronizan en la nube automáticamente con tu cuenta de Google.',
    speaker: 'Presentador',
  },
];
