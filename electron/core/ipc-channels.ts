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
  SYSTEM_GET_STORAGE_INFO: 'system:getStorageInfo',
  SYSTEM_GET_MEDIA_FOLDER: 'system:getMediaFolder',
  SYSTEM_SELECT_MEDIA_FOLDER: 'system:selectMediaFolder',
  SYSTEM_SET_MEDIA_FOLDER: 'system:setMediaFolder',

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
