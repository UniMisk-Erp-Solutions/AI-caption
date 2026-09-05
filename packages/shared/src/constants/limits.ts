/**
 * Application limits.
 *
 * These live in one place, not scattered through UI components, because they
 * are the only thing standing between one enthusiastic tester and the entire
 * free-tier allowance for the month.
 */

export const UPLOAD_LIMITS = {
  maxDurationMs: 5 * 60 * 1000,
  recommendedDurationMs: 90 * 1000,
  maxSizeBytes: 250 * 1024 * 1024,
  acceptedMimeTypes: ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'] as const,
  acceptedExtensions: ['.mp4', '.mov', '.webm', '.mkv'] as const,
} as const;

export const STORAGE_LIMITS = {
  maxProjectsPerUser: 10,
  maxBytesPerUser: 1024 * 1024 * 1024,
} as const;

export const AI_LIMITS = {
  /** Whole-project design generations per user per day. */
  designsPerDay: 10,
  transcriptionsPerDay: 20,
  /** Single-scene regenerations, per project. */
  regenerationsPerProject: 60,
  /** Keyframes in one design request - more than this and Gemma loses focus. */
  maxFramesPerRequest: 16,
  /** Long-edge of a keyframe sent to the model. */
  keyframeLongEdge: 448,
  keyframeQuality: 0.72,
  /** Mono audio sample rate for transcription uploads. */
  audioSampleRate: 16000,
} as const;

export const EXPORT_PRESETS = {
  '1080x1920': { width: 1080, height: 1920, fps: 30, bitrate: 8_000_000 },
  '720x1280': { width: 720, height: 1280, fps: 30, bitrate: 4_000_000 },
  '1080x1080': { width: 1080, height: 1080, fps: 30, bitrate: 7_000_000 },
  '1920x1080': { width: 1920, height: 1080, fps: 30, bitrate: 8_000_000 },
} as const;

export type ExportPresetId = keyof typeof EXPORT_PRESETS;

export const AUTOSAVE = {
  /** Debounce before pushing to Supabase. */
  remoteDebounceMs: 1200,
  /** IndexedDB writes are cheap, so they happen almost immediately. */
  localDebounceMs: 250,
  maxHistoryStates: 60,
} as const;

export const PROCESSING_STEPS = [
  { id: 'upload', label: 'Uploading video' },
  { id: 'probe', label: 'Reading media' },
  { id: 'audio', label: 'Extracting audio' },
  { id: 'transcribe', label: 'Creating transcript' },
  { id: 'verify', label: 'Understanding speech' },
  { id: 'frames', label: 'Analysing composition' },
  { id: 'design', label: 'Designing captions' },
  { id: 'ready', label: 'Preparing editor' },
] as const;

export type ProcessingStepId = (typeof PROCESSING_STEPS)[number]['id'];
