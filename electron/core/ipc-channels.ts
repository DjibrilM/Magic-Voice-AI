export const IPC_CHANNELS = {
  // Voices domain (metadata & SQLite persistence)
  VOICES_SCAN: 'voices:scan',
  VOICES_LOAD: 'voices:load',
  VOICES_GET: 'voices:get',
  VOICES_LIST_CUSTOM: 'voices:list-custom',
  VOICES_SAVE_CUSTOM: 'voices:save-custom',
  VOICES_DELETE_CUSTOM: 'voices:delete-custom',

  // Voice generation & TTS domain (Echo Voice Engine & conversation persistence)
  TTS_GENERATE: 'tts:generate',
  TTS_CANCEL: 'tts:cancel',
  TTS_PROGRESS: 'tts:progress',
  TTS_COMPLETE: 'tts:complete',
  TTS_ERROR: 'tts:error',
  TTS_HISTORY_LIST: 'tts:history:list',
  TTS_HISTORY_SAVE: 'tts:history:save',
  TTS_HISTORY_DELETE: 'tts:history:delete',
  TTS_HISTORY_CLEAR: 'tts:history:clear',

  // Activity domain (Activities persistence & 1-to-1 origin link)
  ACTIVITY_LIST: 'activity:list',
  ACTIVITY_GET: 'activity:get',
  ACTIVITY_GET_BY_ORIGIN: 'activity:get-by-origin',
  ACTIVITY_SAVE: 'activity:save',
  ACTIVITY_DELETE: 'activity:delete',

  // Music generation domain (ACE-Step & MiniMax-Music3 QVAC AudioGen)
  MUSIC_GENERATE: 'music:generate',
  MUSIC_CANCEL: 'music:cancel',
  MUSIC_EDIT: 'music:edit',
  MUSIC_UNDERSTAND: 'music:understand',
  MUSIC_PROGRESS: 'music:progress',
  MUSIC_COMPLETE: 'music:complete',
  MUSIC_ERROR: 'music:error',
  MUSIC_MODEL_STATUS: 'music:model-status',
  MUSIC_LOAD_MODEL: 'music:load-model',
  MUSIC_UNLOAD_MODEL: 'music:unload-model',
  MUSIC_ASSESS_FIT: 'music:assess-fit',
  MUSIC_HISTORY_LIST: 'music:history:list',
  MUSIC_HISTORY_SAVE: 'music:history:save',
  MUSIC_HISTORY_DELETE: 'music:history:delete',
  MUSIC_HISTORY_CLEAR: 'music:history:clear',
  MUSIC_GET_LOGS: 'music:get-logs',
  MUSIC_CLEAR_LOGS: 'music:clear-logs',
  MUSIC_GENERATE_LYRICS: 'music:generate-lyrics',
  MUSIC_LYRICS_TOKEN: 'music:lyrics-token',

  // Story generation domain (Gemma 4 narrative orchestration & CosyVoice 3 natural audio)
  STORY_GENERATE: 'story:generate',
  STORY_CANCEL: 'story:cancel',
  STORY_PROGRESS: 'story:progress',
  STORY_COMPLETE: 'story:complete',
  STORY_ERROR: 'story:error',

  // Models management domain (Echo Voice Engine weights)
  MODELS_GET_STATUS: 'models:get-status',
  MODELS_GET_INFO: 'models:get-info',
  MODELS_DELETE_ALL: 'models:delete-all',
  MODELS_DOWNLOAD: 'models:download',
  MODELS_DOWNLOAD_PROGRESS: 'models:download-progress',
  MODELS_CANCEL_DOWNLOAD: 'models:cancel-download',

  // System telemetry & utilities domain
  SYSTEM_GET_METRICS: 'system:getMetrics',
  SYSTEM_OPEN_EXPORTS: 'system:openExports',

  // Compatibility aliases
  DB_CONVERSATIONS_LIST: 'tts:history:list',
  DB_CONVERSATIONS_SAVE: 'tts:history:save',
  DB_CONVERSATIONS_DELETE: 'tts:history:delete',
  DB_CONVERSATIONS_CLEAR: 'tts:history:clear',
  DB_VOICES_LIST: 'voices:list-custom',
  DB_VOICES_SAVE: 'voices:save-custom',
  DB_VOICES_DELETE: 'voices:delete-custom',

  // Terminal Log domain
  TERMINAL_LOG: 'terminal:log',

  // Legacy channel aliases for backwards compatibility
  LEGACY_SCAN_VOICE_SAMPLES: 'scan-voice-samples',
  LEGACY_GET_SYSTEM_METRICS: 'get-system-metrics',
  LEGACY_OPEN_EXPORTS_FOLDER: 'open-exports-folder',
} as const;

export interface IpcResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
