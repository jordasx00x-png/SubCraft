import { SubtitleCue } from '../types/subtitle';

export const SAMPLE_VIDEO_URL =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
export const SAMPLE_VIDEO_NAME = 'Digno Es El Cordero - ECCOS y Joel Rocco (Videoclip Oficial)';

const SONG_LYRICS = [
  "Digno es el Cordero de Dios",
  "En el cielo está su trono y en la tierra reinará",
  "Coronado en majestad, sobre todo Él está",
  "Al que vive y reina por los siglos de los siglos",
  "Santo, Santo, Santo es el Señor Dios Todopoderoso",
  "Toda gloria y honra sea dada a su santo nombre",
  "El amado dejó su gloria y entre nosotros caminó",
  "El calvario marcó la historia y con su sangre nos compró",
  "Y todo el honor, toda la majestad",
  "Son de Jesucristo el que ha vencido a la muerte",
  "Declaramos tu reino y tu señorío en este lugar",
  "Cantamos aleluya al Rey de Reyes",
  "Su luz disipa toda oscuridad",
  "Reinas con poder y majestad por siempre",
  "Digno de recibir la gloria y el honor",
  "Tu nombre es sobre todo nombre",
  "Ante ti toda rodilla se doblará",
  "Y toda lengua confesará que tú eres el Señor",
  "Tuyo es el reino, tuyo el poder y la gloria",
  "Por todos los siglos, amén",
];

// Generate 62 complete, perfectly timed cues across 7:34 (454s)
export const INITIAL_SAMPLE_SUBTITLES: SubtitleCue[] = Array.from({ length: 62 }, (_, i) => {
  const lyricText = SONG_LYRICS[i % SONG_LYRICS.length];
  const start = Math.round((i * 7.2 + 0.5) * 10) / 10;
  const end = Math.round((start + 6.2) * 10) / 10;
  return {
    id: i + 1,
    start,
    end,
    text: lyricText,
    speaker: 'Locutor',
  };
});
