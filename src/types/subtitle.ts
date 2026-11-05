export interface SubtitleCue {
  id: string | number;
  start: number; // in seconds, e.g. 1.25
  end: number;   // in seconds, e.g. 4.50
  text: string;
  speaker?: string;
}

export type SubtitlePreset =
  | 'viral-yellow'
  | 'netflix'
  | 'cyberpunk-neon'
  | 'bebas-bold'
  | 'minimal-dark'
  | 'bold-white';

export type BackgroundLoopType =
  | 'aurora-gradient'
  | 'synthwave-grid'
  | 'cosmic-nebula'
  | 'sound-spectrum'
  | 'lofi-ambient'
  | 'custom-video';

export interface SubtitleStyle {
  preset: SubtitlePreset | 'custom';
  fontFamily: string;
  fontSize: number; // base size in pixels (responsive scale applied on video)
  fontWeight: '600' | '700' | '800' | '900';
  textColor: string;
  textTransform: 'none' | 'uppercase' | 'capitalize';
  letterSpacing: number; // in px
  hasStroke: boolean;
  strokeColor: string;
  strokeWidth: number;
  hasBackground: boolean;
  backgroundColor: string;
  backgroundOpacity: number; // 0 to 1
  backgroundPadding: number; // in px
  backgroundRounded: number; // in px
  hasShadow: boolean;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  position: 'bottom' | 'top' | 'middle';
  verticalOffset: number; // percent from edge (0 to 30)
  textAlign: 'center' | 'left' | 'right';
  maxWordsPerLine?: number;
  // Audio-only & Background Loop Mode
  isAudioMode?: boolean;
  backgroundLoop?: BackgroundLoopType;
  customBackgroundVideoUrl?: string;
  showAudioVisualizer?: boolean;
  fullScreenSubtitle?: boolean;
}

export interface SubtitleProject {
  id: string;
  userId: string;
  title: string;
  videoFileName?: string;
  videoDuration?: number;
  language: string;
  targetLanguage: string;
  subtitles: SubtitleCue[];
  style: SubtitleStyle;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_STYLE: SubtitleStyle = {
  preset: 'viral-yellow',
  fontFamily: 'Montserrat',
  fontSize: 26,
  fontWeight: '800',
  textColor: '#FFDF00',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  hasStroke: true,
  strokeColor: '#000000',
  strokeWidth: 5,
  hasBackground: false,
  backgroundColor: '#000000',
  backgroundOpacity: 0.7,
  backgroundPadding: 8,
  backgroundRounded: 6,
  hasShadow: true,
  shadowColor: 'rgba(0,0,0,0.85)',
  shadowBlur: 8,
  shadowOffsetX: 2,
  shadowOffsetY: 2,
  position: 'bottom',
  verticalOffset: 10,
  textAlign: 'center',
  isAudioMode: false,
  backgroundLoop: 'aurora-gradient',
  showAudioVisualizer: true,
  fullScreenSubtitle: false,
};

export const STYLE_PRESETS: Record<SubtitlePreset, SubtitleStyle> = {
  'viral-yellow': {
    preset: 'viral-yellow',
    fontFamily: 'Montserrat',
    fontSize: 28,
    fontWeight: '900',
    textColor: '#FACC15',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    hasStroke: true,
    strokeColor: '#000000',
    strokeWidth: 6,
    hasBackground: false,
    backgroundColor: '#000000',
    backgroundOpacity: 0.75,
    backgroundPadding: 8,
    backgroundRounded: 6,
    hasShadow: true,
    shadowColor: 'rgba(0,0,0,0.9)',
    shadowBlur: 10,
    shadowOffsetX: 3,
    shadowOffsetY: 3,
    position: 'bottom',
    verticalOffset: 12,
    textAlign: 'center',
  },
  'netflix': {
    preset: 'netflix',
    fontFamily: 'Inter',
    fontSize: 22,
    fontWeight: '600',
    textColor: '#FFFFFF',
    textTransform: 'none',
    letterSpacing: 0,
    hasStroke: false,
    strokeColor: '#000000',
    strokeWidth: 2,
    hasBackground: true,
    backgroundColor: '#000000',
    backgroundOpacity: 0.75,
    backgroundPadding: 6,
    backgroundRounded: 4,
    hasShadow: false,
    shadowColor: 'rgba(0,0,0,0.6)',
    shadowBlur: 4,
    shadowOffsetX: 0,
    shadowOffsetY: 1,
    position: 'bottom',
    verticalOffset: 8,
    textAlign: 'center',
  },
  'cyberpunk-neon': {
    preset: 'cyberpunk-neon',
    fontFamily: 'Outfit',
    fontSize: 26,
    fontWeight: '800',
    textColor: '#22D3EE',
    textTransform: 'uppercase',
    letterSpacing: 1,
    hasStroke: true,
    strokeColor: '#083344',
    strokeWidth: 4,
    hasBackground: true,
    backgroundColor: '#020617',
    backgroundOpacity: 0.85,
    backgroundPadding: 8,
    backgroundRounded: 8,
    hasShadow: true,
    shadowColor: 'rgba(6,182,212,0.9)',
    shadowBlur: 16,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    position: 'bottom',
    verticalOffset: 12,
    textAlign: 'center',
  },
  'bebas-bold': {
    preset: 'bebas-bold',
    fontFamily: 'Bebas Neue',
    fontSize: 34,
    fontWeight: '700',
    textColor: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    hasStroke: true,
    strokeColor: '#DC2626',
    strokeWidth: 5,
    hasBackground: false,
    backgroundColor: '#000000',
    backgroundOpacity: 0.5,
    backgroundPadding: 6,
    backgroundRounded: 4,
    hasShadow: true,
    shadowColor: 'rgba(0,0,0,0.8)',
    shadowBlur: 8,
    shadowOffsetX: 2,
    shadowOffsetY: 2,
    position: 'bottom',
    verticalOffset: 10,
    textAlign: 'center',
  },
  'minimal-dark': {
    preset: 'minimal-dark',
    fontFamily: 'Poppins',
    fontSize: 22,
    fontWeight: '600',
    textColor: '#F8FAFC',
    textTransform: 'none',
    letterSpacing: 0,
    hasStroke: true,
    strokeColor: '#0F172A',
    strokeWidth: 3,
    hasBackground: false,
    backgroundColor: '#000000',
    backgroundOpacity: 0.5,
    backgroundPadding: 6,
    backgroundRounded: 4,
    hasShadow: true,
    shadowColor: 'rgba(0,0,0,0.7)',
    shadowBlur: 6,
    shadowOffsetX: 1,
    shadowOffsetY: 2,
    position: 'bottom',
    verticalOffset: 9,
    textAlign: 'center',
  },
  'bold-white': {
    preset: 'bold-white',
    fontFamily: 'Rubik',
    fontSize: 28,
    fontWeight: '900',
    textColor: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    hasStroke: true,
    strokeColor: '#000000',
    strokeWidth: 6,
    hasBackground: false,
    backgroundColor: '#000000',
    backgroundOpacity: 0.6,
    backgroundPadding: 6,
    backgroundRounded: 4,
    hasShadow: true,
    shadowColor: 'rgba(0,0,0,0.8)',
    shadowBlur: 8,
    shadowOffsetX: 2,
    shadowOffsetY: 2,
    position: 'bottom',
    verticalOffset: 12,
    textAlign: 'center',
  },
};
