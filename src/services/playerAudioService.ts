/**
 * Centralized Audio Controller Service
 * Bridges to the single centralized HTMLAudioElement mounted at root by AudioProvider.
 */

import {
  centralAudioPlaySource,
  centralAudioPause,
  centralAudioResume,
  centralAudioSeek,
  centralAudioSetVolume,
  centralAudioToggleMute,
  getCentralAudioCurrentTime,
  getCentralAudioDuration,
  getCentralAudioElement,
  audioTimeListeners,
  audioStateListeners,
  audioTrackEndedListeners,
} from '@/components/providers/AudioProvider'

export type TimeUpdateCallback = (currentTime: number, duration: number) => void
export type StateChangeCallback = (isPlaying: boolean) => void
export type TrackEndedCallback = () => void

class PlayerAudioService {
  public subscribe(
    onTimeUpdate: TimeUpdateCallback,
    onStateChange: StateChangeCallback,
    onTrackEnded: TrackEndedCallback
  ): () => void {
    const id = `sub_${Date.now()}_${Math.random()}`

    audioTimeListeners.set(id, (time, dur) => {
      onTimeUpdate(time, dur)
    })

    audioStateListeners.set(id, (playing) => {
      onStateChange(playing)
    })

    audioTrackEndedListeners.set(id, () => {
      onTrackEnded()
    })

    // Immediately hydrate listener on subscription
    const el = getCentralAudioElement()
    if (el) {
      onTimeUpdate(el.currentTime || 0, el.duration || 0)
      onStateChange(!el.paused)
    }

    return () => {
      audioTimeListeners.delete(id)
      audioStateListeners.delete(id)
      audioTrackEndedListeners.delete(id)
    }
  }

  public setCallbacks(
    onTimeUpdate: TimeUpdateCallback,
    onStateChange: StateChangeCallback,
    onTrackEnded: TrackEndedCallback
  ) {
    return this.subscribe(onTimeUpdate, onStateChange, onTrackEnded)
  }

  public loadAndPlay(url?: string, startTime = 0): Promise<void> {
    return centralAudioPlaySource(url, startTime)
  }

  public play(): Promise<void> {
    centralAudioResume()
    return Promise.resolve()
  }

  public pause() {
    centralAudioPause()
  }

  public stop() {
    centralAudioPause()
    centralAudioSeek(0)
  }

  public seek(seconds: number) {
    centralAudioSeek(seconds)
  }

  public setVolume(volume: number) {
    centralAudioSetVolume(volume)
  }

  public setMuted(muted: boolean) {
    const el = getCentralAudioElement()
    if (el && el.muted !== muted) {
      centralAudioToggleMute()
    }
  }

  public toggleMute() {
    centralAudioToggleMute()
  }

  public getVolume(): number {
    const el = getCentralAudioElement()
    return el ? el.volume : 0.85
  }

  public getIsMuted(): boolean {
    const el = getCentralAudioElement()
    return el ? el.muted : false
  }

  public getCurrentTime(): number {
    return getCentralAudioCurrentTime()
  }

  public getDuration(): number {
    return getCentralAudioDuration()
  }

  public getAudioElement(): HTMLAudioElement | null {
    return getCentralAudioElement()
  }
}

export const playerAudioService = new PlayerAudioService()
