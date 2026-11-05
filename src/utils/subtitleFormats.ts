import { SubtitleCue } from '../types/subtitle';

export function padZero(num: number, size = 2): string {
  let s = num.toString();
  while (s.length < size) s = '0' + s;
  return s;
}

/**
 * Format seconds to SRT timestamp: 00:01:23,450
 */
export function formatTimeSrt(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.floor((totalSeconds - Math.floor(totalSeconds)) * 1000);

  return `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)},${padZero(milliseconds, 3)}`;
}

/**
 * Format seconds to VTT timestamp: 00:01:23.450
 */
export function formatTimeVtt(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.floor((totalSeconds - Math.floor(totalSeconds)) * 1000);

  return `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}.${padZero(milliseconds, 3)}`;
}

/**
 * Format seconds to user-friendly editor display: MM:SS.s or HH:MM:SS
 */
export function formatTimeDisplay(totalSeconds: number, showDecimals = true): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const tenths = Math.floor((totalSeconds % 1) * 10);

  if (hours > 0) {
    return showDecimals
      ? `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}.${tenths}`
      : `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}`;
  }
  return showDecimals
    ? `${padZero(minutes)}:${padZero(seconds)}.${tenths}`
    : `${padZero(minutes)}:${padZero(seconds)}`;
}

/**
 * Parse any time representation (HH:MM:SS,mmm or MM:SS.mmm or seconds) to numeric seconds
 */
export function parseTimeToSeconds(input: string | number): number {
  if (typeof input === 'number') return input;
  if (!input || typeof input !== 'string') return 0;
  
  const trimmed = input.trim().replace(',', '.');
  const parts = trimmed.split(':');

  if (parts.length === 3) {
    const hours = parseFloat(parts[0]) || 0;
    const mins = parseFloat(parts[1]) || 0;
    const secs = parseFloat(parts[2]) || 0;
    return hours * 3600 + mins * 60 + secs;
  } else if (parts.length === 2) {
    const mins = parseFloat(parts[0]) || 0;
    const secs = parseFloat(parts[1]) || 0;
    return mins * 60 + secs;
  }
  return parseFloat(trimmed) || 0;
}

/**
 * Generate standard SRT formatted string
 */
export function exportToSrt(subtitles: SubtitleCue[]): string {
  const sorted = [...subtitles].sort((a, b) => a.start - b.start);
  return sorted
    .map((cue, index) => {
      const idx = index + 1;
      const start = formatTimeSrt(cue.start);
      const end = formatTimeSrt(cue.end);
      const speakerPrefix = cue.speaker ? `[${cue.speaker}]: ` : '';
      return `${idx}\n${start} --> ${end}\n${speakerPrefix}${cue.text.trim()}\n`;
    })
    .join('\n');
}

/**
 * Generate standard WebVTT formatted string
 */
export function exportToVtt(subtitles: SubtitleCue[]): string {
  const sorted = [...subtitles].sort((a, b) => a.start - b.start);
  const body = sorted
    .map((cue, index) => {
      const idx = index + 1;
      const start = formatTimeVtt(cue.start);
      const end = formatTimeVtt(cue.end);
      const speakerPrefix = cue.speaker ? `<v ${cue.speaker}>` : '';
      const speakerSuffix = cue.speaker ? '</v>' : '';
      return `${idx}\n${start} --> ${end}\n${speakerPrefix}${cue.text.trim()}${speakerSuffix}\n`;
    })
    .join('\n');

  return `WEBVTT\n\n${body}`;
}

/**
 * Generate plain text transcript
 */
export function exportToTxt(subtitles: SubtitleCue[], includeTimestamps = true): string {
  const sorted = [...subtitles].sort((a, b) => a.start - b.start);
  if (!includeTimestamps) {
    return sorted.map((c) => c.text.trim()).join(' ');
  }
  return sorted
    .map((cue) => {
      const time = `[${formatTimeDisplay(cue.start, false)} - ${formatTimeDisplay(cue.end, false)}]`;
      const speaker = cue.speaker ? ` ${cue.speaker}:` : '';
      return `${time}${speaker} ${cue.text.trim()}`;
    })
    .join('\n');
}

/**
 * Parse an imported SRT string into SubtitleCue[]
 */
export function parseSrt(content: string): SubtitleCue[] {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.trim().split(/\n\s*\n/);
  const cues: SubtitleCue[] = [];

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    let timeLineIdx = 0;
    // Check if line 0 is numeric index or time
    if (/^\d+$/.test(lines[0]) && lines.length >= 2) {
      timeLineIdx = 1;
    }

    const timeLine = lines[timeLineIdx];
    const match = timeLine.match(/(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})/);
    if (!match) continue;

    const startSec = parseTimeToSeconds(match[1]);
    const endSec = parseTimeToSeconds(match[2]);
    const textLines = lines.slice(timeLineIdx + 1).join('\n');

    // Check for optional speaker pattern "[Speaker]: text"
    let speaker: string | undefined;
    let cleanText = textLines;
    const speakerMatch = textLines.match(/^\[(.*?)\]:\s*(.*)/s);
    if (speakerMatch) {
      speaker = speakerMatch[1];
      cleanText = speakerMatch[2];
    }

    cues.push({
      id: cues.length + 1,
      start: startSec,
      end: endSec,
      text: cleanText,
      speaker,
    });
  }

  return cues;
}

/**
 * Trigger browser file download
 */
export function downloadFile(content: string | Blob, filename: string, mimeType = 'text/plain;charset=utf-8') {
  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
