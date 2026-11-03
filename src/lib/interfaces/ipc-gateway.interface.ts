export interface TerminalLogMessage {
  projectId?: string
  text: string
  stream: 'stdout' | 'stderr' | 'system'
  timestamp?: string
}

export interface TtsProgressEvent {
  taskId: string
  progress: number
  message: string
  phase: string
}

export interface TtsCompleteEvent {
  taskId: string
  generation: any
}

export interface TtsErrorEvent {
  taskId: string
  error: string
}
