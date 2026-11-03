import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  HardDrive,
  Folder,
  FolderOpen,
  Trash2,
  RefreshCw,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  FolderSync,
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
    models: [],
  })

  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isChangingFolder, setIsChangingFolder] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

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
          models: res.models || [],
        })
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

  const handleDeleteAllModels = async () => {
    if (typeof window === 'undefined' || !window.ipcRenderer) return
    setIsDeleting(true)
    setFeedbackMessage(null)
    try {
      const res = await window.ipcRenderer.invoke('models:delete-all')
      if (res && res.success) {
        setFeedbackMessage({ text: 'All neural models successfully removed from disk.', type: 'success' })
        await fetchStorageInfo()
      } else {
        setFeedbackMessage({ text: res?.error || 'Failed to delete models', type: 'error' })
      }
    } catch (err: any) {
      setFeedbackMessage({ text: err?.message || 'Error deleting models', type: 'error' })
    } finally {
      setIsDeleting(false)
      setIsDeleteDialogOpen(false)
    }
  }

  const handleSelectMediaFolder = async () => {
    if (typeof window === 'undefined' || !window.ipcRenderer) return
    setIsChangingFolder(true)
    setFeedbackMessage(null)
    try {
      const res = await window.ipcRenderer.invoke('system:selectMediaFolder')
      if (res && res.success && res.path) {
        setStorage((prev) => ({ ...prev, mediaDestinationFolder: res.path }))
        setFeedbackMessage({ text: 'Media destination folder updated successfully.', type: 'success' })
        await fetchStorageInfo()
      } else if (!res?.cancelled && res?.error) {
        setFeedbackMessage({ text: res.error, type: 'error' })
      }
    } catch (err: any) {
      setFeedbackMessage({ text: err?.message || 'Failed to select folder', type: 'error' })
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

  const downloadedModelsCount = storage.models.filter((m) => m.downloaded).length

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 max-w-4xl select-none mx-auto w-full">
      {/* Page Title & Refresh */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-white">Settings</h1>
          <p className="text-xs text-zinc-400">
            Manage local storage, neural voice models, and media destination folders.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={fetchStorageInfo}
          disabled={isLoading}
          className="h-8 gap-1.5 border-zinc-800 bg-white/[0.04] hover:bg-white/[0.08] hover:border-zinc-700 text-zinc-300 text-xs cursor-pointer"
        >
          <RefreshCw className={cn('size-3.5', isLoading && 'animate-spin')} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Feedback banner */}
      {feedbackMessage && (
        <div
          className={cn(
            'flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium border transition-colors',
            feedbackMessage.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
          )}
        >
          <span>{feedbackMessage.text}</span>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="text-xs opacity-70 hover:opacity-100 p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. STORAGE USAGE SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-4 border-zinc-800 bg-[#161616] flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>Models Storage</span>
            <HardDrive className="size-3.5 text-zinc-400" />
          </div>
          <div className="text-xl font-bold text-white tracking-tight">
            {storage.modelsStorageFormatted}
          </div>
          <span className="text-[11px] text-zinc-500">
            {downloadedModelsCount} of {storage.models.length} models installed
          </span>
        </Card>

        <Card className="p-4 border-zinc-800 bg-[#161616] flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>Media Storage</span>
            <Folder className="size-3.5 text-zinc-400" />
          </div>
          <div className="text-xl font-bold text-white tracking-tight">
            {storage.mediaStorageFormatted}
          </div>
          <span className="text-[11px] text-zinc-500">Audio cache & exported generations</span>
        </Card>

        <Card className="p-4 border-zinc-800 bg-[#161616] flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>Total Storage Taken</span>
            <HardDrive className="size-3.5 text-zinc-400" />
          </div>
          <div className="text-xl font-bold text-white tracking-tight">
            {storage.totalStorageFormatted}
          </div>
          <span className="text-[11px] text-zinc-500">Combined disk footprint</span>
        </Card>
      </div>

      {/* 2. MEDIA DESTINATION FOLDER SECTION */}
      <Card className="p-5 border-zinc-800 bg-[#161616] flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Folder className="size-4.5 text-zinc-300" />
            <div>
              <h2 className="text-sm font-semibold text-white">Media Destination Folder</h2>
              <p className="text-xs text-zinc-400">
                All synthesized voice audio files, exported WAV tracks, and master recordings are saved to this directory.
              </p>
            </div>
          </div>
        </div>

        {/* Current Folder Path Display & Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
          <div className="flex-1 min-w-0 bg-[#0f0f10] border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-300 truncate select-all">
            {storage.mediaDestinationFolder || 'No destination folder configured'}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSelectMediaFolder}
              disabled={isChangingFolder}
              className="h-8 gap-1.5 border-zinc-700 bg-white/[0.04] hover:bg-white/[0.08] text-white text-xs cursor-pointer"
              title="Select another folder on your computer to save media files"
            >
              <FolderSync className={cn('size-3.5', isChangingFolder && 'animate-spin')} />
              <span>Replace Folder</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenMediaFolder}
              className="h-8 gap-1.5 border-zinc-700 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 text-xs cursor-pointer"
              title="Open the current destination folder in macOS Finder"
            >
              <FolderOpen className="size-3.5" />
              <span>Open in Finder</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* 3. NEURAL MODELS STORAGE & DELETION SECTION */}
      <Card className="p-5 border-zinc-800 bg-[#161616] flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <HardDrive className="size-4.5 text-zinc-300" />
            <div>
              <h2 className="text-sm font-semibold text-white">Installed Neural Models</h2>
              <p className="text-xs text-zinc-400">
                CosyVoice 3, Lava-SR, and neural vocoder model weights stored locally in the application cache.
              </p>
            </div>
          </div>

          {downloadedModelsCount > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={isDeleting}
              className="h-8 gap-1.5 border-rose-900/50 bg-rose-950/20 hover:bg-rose-950/40 hover:border-rose-700 text-rose-300 text-xs cursor-pointer"
              title="Delete all installed neural models to reclaim disk storage"
            >
              <Trash2 className="size-3.5" />
              <span>Delete All Models</span>
            </Button>
          )}
        </div>

        {/* Model Items List */}
        <div className="flex flex-col divide-y divide-zinc-800/80 border border-zinc-800 rounded-lg overflow-hidden bg-[#0f0f10]">
          {storage.models.length === 0 ? (
            <div className="p-4 text-center text-xs text-zinc-500">
              No models detected.
            </div>
          ) : (
            storage.models.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={cn(
                      'size-2 rounded-full shrink-0',
                      m.downloaded ? 'bg-emerald-400' : 'bg-zinc-600'
                    )}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-zinc-200 truncate">{m.name}</span>
                    <span className="text-[11px] text-zinc-500 font-mono">{m.sizeFormatted}</span>
                  </div>
                </div>

                <div className="shrink-0">
                  {m.downloaded ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/40 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="size-3" /> Installed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800/60 text-zinc-400 border border-zinc-700/40">
                      Not Installed
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* 4. LOCAL NEURAL INFERENCE ENGINE INFO */}
      <Card className="p-5 border-zinc-800 bg-[#161616] flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <Cpu className="size-4.5 text-zinc-300" />
          <h2 className="text-sm font-semibold text-white">Local Neural Inference Engine</h2>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Magic-Voice AI runs speech synthesis 100% locally on your machine via CosyVoice 3 and Apple Silicon Metal acceleration. Your audio samples, scripts, voice cloning reference audio, and transcripts never leave your device.
        </p>
        <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium pt-1">
          <span className="size-2 rounded-full bg-emerald-400" />
          Local Offline Inference Active
        </div>
      </Card>

      {/* DELETE ALL MODELS CONFIRMATION DIALOG */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md border-zinc-800 bg-[#161616] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-400">
              <AlertTriangle className="size-5" /> Delete All Neural Models?
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs pt-2">
              This will permanently delete all downloaded voice models ({storage.modelsStorageFormatted}) from your computer to free up disk storage.
              <br />
              <br />
              You will need to re-download the models before you can generate speech again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(false)}
              className="border-zinc-700 bg-white/[0.04] text-zinc-300 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={handleDeleteAllModels}
              className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
            >
              <Trash2 className="size-3.5" />
              {isDeleting ? 'Deleting...' : 'Yes, Delete All Models'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Settings
