import { useEffect, useState, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import {
  HardDrive,
  Folder,
  FolderOpen,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FolderSync,
  Volume2,
  FileAudio,
  Cpu,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface ModelStorageItem {
  id: string
  name: string
  sizeBytes: number
  sizeFormatted: string
  downloaded: boolean
  category?: string
  engine?: string
}

interface StorageData {
  modelsStorageBytes: number
  modelsStorageFormatted: string
  mediaStorageBytes: number
  mediaStorageFormatted: string
  totalStorageBytes: number
  totalStorageFormatted: string
  mediaDestinationFolder: string
  mediaFilesCount?: number
  inferenceDevice?: 'gpu' | 'cpu'
  models: ModelStorageItem[]
}

export function Settings() {
  const [storage, setStorage] = useState<StorageData>({
    modelsStorageBytes: 0,
    modelsStorageFormatted: '0 B',
    mediaStorageBytes: 0,
    mediaStorageFormatted: '0 B',
    totalStorageBytes: 0,
    totalStorageFormatted: '0 B',
    mediaDestinationFolder: '~/Documents/Magic-Voice/Exports',
    mediaFilesCount: 0,
    inferenceDevice: 'gpu',
    models: [],
  })

  const [inferenceDevice, setInferenceDevice] = useState<'gpu' | 'cpu'>('gpu')
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isChangingFolder, setIsChangingFolder] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const fetchStorageInfo = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ipcRenderer) return
    setIsLoading(true)
    try {
      const res = await window.ipcRenderer.invoke('system:getStorageInfo')
      if (res && res.success) {
        setStorage({
          modelsStorageBytes: res.modelsStorageBytes || 0,
          modelsStorageFormatted: res.modelsStorageFormatted || '0 B',
          mediaStorageBytes: res.mediaStorageBytes || 0,
          mediaStorageFormatted: res.mediaStorageFormatted || '0 B',
          totalStorageBytes: res.totalStorageBytes || 0,
          totalStorageFormatted: res.totalStorageFormatted || '0 B',
          mediaDestinationFolder: res.mediaDestinationFolder || '',
          mediaFilesCount: res.mediaFilesCount ?? 0,
          inferenceDevice: res.inferenceDevice || 'gpu',
          models: res.models || [],
        })
        if (res.inferenceDevice) {
          setInferenceDevice(res.inferenceDevice)
        }
      }
    } catch (err) {
      console.warn('[Settings] Failed to fetch storage info:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStorageInfo()
  }, [fetchStorageInfo])

  const handleDeviceChange = async (newDevice: 'gpu' | 'cpu') => {
    if (newDevice === inferenceDevice) return
    setInferenceDevice(newDevice)
    setErrorMessage(null)
    if (typeof window === 'undefined' || !window.ipcRenderer) return
    try {
      const res = await window.ipcRenderer.invoke('system:setInferenceDevice', newDevice)
      if (!res?.success) {
        setErrorMessage(res?.error || 'Failed to update device')
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error updating inference device')
    }
  }

  const handleDeleteAllModels = async () => {
    if (typeof window === 'undefined' || !window.ipcRenderer) return
    setIsDeleting(true)
    setErrorMessage(null)
    try {
      const res = await window.ipcRenderer.invoke('models:delete-all')
      if (res && res.success) {
        await fetchStorageInfo()
      } else {
        setErrorMessage(res?.error || 'Failed to delete models')
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error deleting models')
    } finally {
      setIsDeleting(false)
      setIsDeleteDialogOpen(false)
    }
  }

  const handleSelectMediaFolder = async () => {
    if (typeof window === 'undefined' || !window.ipcRenderer) return
    setIsChangingFolder(true)
    setErrorMessage(null)
    try {
      const res = await window.ipcRenderer.invoke('system:selectMediaFolder')
      if (res && res.success && res.path) {
        setStorage((prev) => ({ ...prev, mediaDestinationFolder: res.path }))
        await fetchStorageInfo()
      } else if (!res?.cancelled && res?.error) {
        setErrorMessage(res.error)
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to select folder')
    } finally {
      setIsChangingFolder(false)
    }
  }

  const handleOpenMediaFolder = async () => {
    if (typeof window === 'undefined' || !window.ipcRenderer) return
    try {
      await window.ipcRenderer.invoke('system:openExports')
    } catch (err) {
      console.warn('[Settings] Failed to open folder:', err)
    }
  }

  // Filter only models related to the active TTS implementation (CosyVoice 3 + Lava-SR enhancer)
  const ttsModels = useMemo(() => {
    return storage.models.filter(
      (m) =>
        m.engine === 'cosyvoice3' ||
        m.engine === 'shared' ||
        m.id.startsWith('cosyvoice') ||
        m.id.startsWith('lavasr')
    )
  }, [storage.models])

  const downloadedTtsModelsCount = useMemo(() => {
    return ttsModels.filter((m) => m.downloaded).length
  }, [ttsModels])

  // Storage breakdown calculations for iOS-style storage bar
  const storageBreakdown = useMemo(() => {
    const totalBytes = Math.max(1, storage.modelsStorageBytes + storage.mediaStorageBytes)
    const modelsPct = Math.round((storage.modelsStorageBytes / totalBytes) * 100)
    const mediaPct = Math.max(0, 100 - modelsPct)
    return { modelsPct, mediaPct }
  }, [storage.modelsStorageBytes, storage.mediaStorageBytes])

  return (
    <div className="flex flex-1 flex-col gap-7 p-6 max-w-3xl select-none mx-auto w-full">
      {/* iOS-Inspired Large Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Settings</h1>
          <p className="text-xs text-[#8e8e93] pt-0.5">
            Manage local storage, voice models, and media destination folders.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={fetchStorageInfo}
          disabled={isLoading}
          className="h-8 gap-1.5 rounded-full border-white/[0.08] bg-[#1c1c1e] hover:bg-white/[0.08] text-zinc-300 text-xs cursor-pointer shadow-sm"
        >
          <RefreshCw className={cn('size-3.5', isLoading && 'animate-spin')} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Error Feedback Banner */}
      {errorMessage && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl text-xs font-medium border shadow-sm transition-all bg-rose-950/40 border-rose-500/30 text-rose-300">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-xs opacity-70 hover:opacity-100 p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. iOS STORAGE OVERVIEW (iPhone Storage style) */}
      <section className="flex flex-col gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8e8e93] px-1">
          Storage
        </span>

        <div className="rounded-2xl border border-white/[0.08] bg-[#1c1c1e] p-5 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-[8px] bg-white/[0.08] border border-white/[0.08] flex items-center justify-center text-white">
                <HardDrive className="size-4.5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-white">App Disk Usage</span>
                <span className="text-xs text-[#8e8e93]">
                  {storage.totalStorageFormatted} total storage used
                </span>
              </div>
            </div>

            <span className="text-xs font-mono text-zinc-400">
              {downloadedTtsModelsCount} of {ttsModels.length} models installed
            </span>
          </div>

          {/* iOS Multi-Segment Storage Bar - Slim Height */}
          <div className="h-1.5 w-full rounded-full bg-white/[0.08] overflow-hidden flex">
            {storage.modelsStorageBytes > 0 && (
              <div
                style={{ width: `${storageBreakdown.modelsPct}%` }}
                className="h-full bg-white transition-all duration-500"
                title={`Models: ${storage.modelsStorageFormatted}`}
              />
            )}
            {storage.mediaStorageBytes > 0 && (
              <div
                style={{ width: `${storageBreakdown.mediaPct}%` }}
                className="h-full bg-zinc-500 transition-all duration-500"
                title={`Audio Media: ${storage.mediaStorageFormatted}`}
              />
            )}
          </div>

          {/* Legend Items */}
          <div className="flex flex-wrap items-center gap-5 pt-0.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-white" />
              <span className="text-zinc-300 font-medium">Voice Models</span>
              <span className="text-[#8e8e93] font-mono">({storage.modelsStorageFormatted})</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-zinc-500" />
              <span className="text-zinc-300 font-medium">Audio Media</span>
              <span className="text-[#8e8e93] font-mono">({storage.mediaStorageFormatted})</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. HARDWARE & INFERENCE COMPUTE */}
      <section className="flex flex-col gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8e8e93] px-1">
          Hardware & Compute
        </span>

        <div className="rounded-2xl border border-white/[0.08] bg-[#1c1c1e] p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="size-8 rounded-[8px] bg-white/[0.08] border border-white/[0.08] flex items-center justify-center text-white shrink-0">
                <Cpu className="size-4.5 text-white" />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">GPU Acceleration</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-zinc-300">
                    {inferenceDevice === 'gpu' ? 'Metal (GPU)' : 'CPU Mode'}
                  </span>
                </div>
                <span className="text-xs text-[#8e8e93] pt-0.5 truncate">
                  {inferenceDevice === 'gpu'
                    ? 'Using Apple Silicon Metal GPU for real-time speech synthesis'
                    : 'Using system CPU execution threads for synthesis'}
                </span>
              </div>
            </div>

            {/* iOS-Style Toggle Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={inferenceDevice === 'gpu'}
              onClick={() => handleDeviceChange(inferenceDevice === 'gpu' ? 'cpu' : 'gpu')}
              className={cn(
                'relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-hidden select-none',
                inferenceDevice === 'gpu' ? 'bg-white' : 'bg-[#39393d]'
              )}
              title={inferenceDevice === 'gpu' ? 'Switch to CPU inference' : 'Switch to GPU inference'}
            >
              <span
                className={cn(
                  'pointer-events-none block size-6 rounded-full shadow-md transform transition-transform duration-200 ease-in-out',
                  inferenceDevice === 'gpu' ? 'translate-x-5 bg-black' : 'translate-x-0 bg-white'
                )}
              />
            </button>
          </div>
        </div>

        {/* iOS Settings Group Caption / Footnote */}
        <p className="text-[11px] text-[#8e8e93] px-1 leading-relaxed">
          Enable GPU Acceleration to run CosyVoice 3 on Apple Silicon Metal compute shaders for fastest real-time generation. Turn off to run inference on CPU cores.
        </p>
      </section>

      {/* 3. MEDIA DESTINATION & EXPORTS */}
      <section className="flex flex-col gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8e8e93] px-1">
          Media & Exports
        </span>

        <div className="rounded-2xl border border-white/[0.08] bg-[#1c1c1e] p-5 shadow-sm flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-[8px] bg-white/[0.08] border border-white/[0.08] flex items-center justify-center text-white shrink-0">
                <Folder className="size-4.5 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Destination Folder</h2>
                <p className="text-xs text-[#8e8e93] pt-0.5">
                  Synthesized speech WAV tracks and recordings are saved here.
                </p>
              </div>
            </div>

            {typeof storage.mediaFilesCount === 'number' && storage.mediaFilesCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/[0.06] text-zinc-300 border border-white/[0.08] shrink-0">
                <FileAudio className="size-3 text-white" />
                {storage.mediaFilesCount} audio files
              </span>
            )}
          </div>

          {/* Current Path Bar & Action Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
            <div className="flex-1 min-w-0 bg-[#121214] border border-white/[0.06] rounded-xl px-3 py-2 text-xs font-mono text-zinc-300 truncate select-all">
              {storage.mediaDestinationFolder || 'No destination folder configured'}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectMediaFolder}
                disabled={isChangingFolder}
                className="h-8 gap-1.5 rounded-xl border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-white text-xs cursor-pointer"
                title="Select another folder on your computer to save media files"
              >
                <FolderSync className={cn('size-3.5', isChangingFolder && 'animate-spin')} />
                <span>Change Folder</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenMediaFolder}
                className="h-8 gap-1.5 rounded-xl border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 text-xs cursor-pointer"
                title="Open the current destination folder in macOS Finder"
              >
                <FolderOpen className="size-3.5" />
                <span>Open in Finder</span>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. VOICE MODELS (COSYVOICE 3 TTS IMPLEMENTATION ONLY) */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8e8e93]">
            Voice Models (CosyVoice 3)
          </span>
          <span className="text-[11px] text-[#8e8e93]">
            {downloadedTtsModelsCount} of {ttsModels.length} active
          </span>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#1c1c1e] divide-y divide-white/[0.06] overflow-hidden shadow-sm">
          {ttsModels.length === 0 ? (
            <div className="p-5 text-center text-xs text-[#8e8e93]">
              No models detected.
            </div>
          ) : (
            ttsModels.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between p-4 text-xs hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-8 rounded-[8px] bg-white/[0.08] border border-white/[0.08] flex items-center justify-center text-white shrink-0">
                    <Volume2 className="size-4 text-white" />
                  </div>

                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-zinc-200 truncate">{m.name}</span>
                    <span className="text-[11px] text-[#8e8e93] font-mono pt-0.5">
                      {m.sizeFormatted} • {m.category || 'Component'}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 pl-3">
                  {m.downloaded ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/[0.08] text-white border border-white/[0.12]">
                      <CheckCircle2 className="size-3 text-white" /> Installed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/[0.04] text-zinc-400 border border-white/[0.06]">
                      Not Installed
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 5. DESTRUCTIVE / RESET SECTION */}
      {downloadedTtsModelsCount > 0 && (
        <section className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8e8e93] px-1">
            Data Management
          </span>

          <div className="rounded-2xl border border-white/[0.08] bg-[#1c1c1e] p-5 shadow-sm flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-[8px] bg-white/[0.08] border border-white/[0.08] flex items-center justify-center text-white shrink-0">
                <Trash2 className="size-4.5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-white">Delete All Models</span>
                <span className="text-xs text-[#8e8e93]">
                  Reclaim {storage.modelsStorageFormatted} of disk storage. You can re-download anytime.
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={isDeleting}
              className="h-8 gap-1.5 rounded-xl border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-white text-xs cursor-pointer shrink-0"
              title="Delete all installed models to reclaim disk storage"
            >
              <Trash2 className="size-3.5 text-white" />
              <span>Delete All Models</span>
            </Button>
          </div>
        </section>
      )}

      {/* iOS-STYLE CONFIRMATION ALERT DIALOG */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl border-white/[0.1] bg-[#1c1c1e] text-white shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-white text-base font-semibold">
              <AlertTriangle className="size-5 text-white" /> Delete All Models?
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs pt-2 leading-relaxed">
              This will permanently delete all downloaded voice models ({storage.modelsStorageFormatted}) from your computer to free up disk storage.
              <br />
              <br />
              You will need to re-download the models before you can generate speech again.
            </DialogDescription>
          </DialogHeader>

          {/* Action buttons with distinct space between Cancel and Yes, Delete */}
          <DialogFooter className="gap-3 sm:gap-3 pt-4 border-none">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(false)}
              className="rounded-xl border-white/[0.08] bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 hover:text-white text-xs h-9 px-4 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={handleDeleteAllModels}
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white gap-1.5 text-xs h-9 px-4 cursor-pointer font-medium"
            >
              <Trash2 className="size-3.5 text-white" />
              {isDeleting ? 'Deleting...' : 'Yes, Delete All Models'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
