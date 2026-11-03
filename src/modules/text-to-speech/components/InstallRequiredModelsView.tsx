import React, { useState } from 'react'
import { Download, CheckCircle2 } from 'lucide-react'
import { useModels } from '@/modules/models'
import { Button } from '@/components/ui/button'

export const InstallRequiredModelsView: React.FC = () => {
  const {
    activeEngineModels,
    totalSizeGb,
    allRequiredReady,
    downloadingModels,
    downloadModel,
    downloadAllRequired,
    cancelDownload,
  } = useModels()

  const [isStartingAll, setIsStartingAll] = useState(false)
  const anyDownloading = Object.keys(downloadingModels).length > 0

  const handleInstallAll = async () => {
    setIsStartingAll(true)
    try {
      await downloadAllRequired()
    } finally {
      setIsStartingAll(false)
    }
  }

  return (
    <div className="flex h-full w-full flex-1 items-center justify-center overflow-y-auto p-6">
      <div className="flex w-full max-w-xl flex-col gap-6">
        <header className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Set up CosyVoice 3 Models
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/10 text-zinc-300 border border-white/10">
              CosyVoice 3
            </span>
          </div>

          <p className="text-sm text-muted-foreground">
            Download the neural speech synthesis backbone, vocoder, and cloning models to run locally offline.
          </p>
        </header>

        <div className="space-y-2">
          {activeEngineModels.map((model) => {
            const download = downloadingModels[model.id]
            const isDownloading = !!download
            const progress = Math.max(
              0,
              Math.min(100, Math.round(download?.percentage ?? 0))
            )
            const isReady = model.downloaded

            return (
              <div
                key={model.id}
                className="rounded-lg border border-border bg-background p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {model.name}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {model.sizeFormatted} &bull; {model.description}
                    </p>
                  </div>

                  {isReady ? (
                    <span className="flex shrink-0 items-center gap-1.5 text-xs text-white font-medium">
                      <CheckCircle2 className="size-4 text-white" />
                      Ready
                    </span>
                  ) : isDownloading ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => cancelDownload(model.id)}
                      className="shrink-0 text-muted-foreground hover:text-white"
                    >
                      Cancel
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => downloadModel(model.id)}
                      className="shrink-0 text-white"
                    >
                      <Download className="mr-1.5 size-3.5 text-white" />
                      Download
                    </Button>
                  )}
                </div>

                {isDownloading && (
                  <div className="mt-3 space-y-1.5">
                    <div
                      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-label={`Downloading ${model.name}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={progress}
                    >
                      <div
                        className="h-full rounded-full bg-white transition-[width] duration-200"
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="truncate max-w-[320px]">{download?.speed || 'Downloading...'}</span>
                      <span className="font-mono">{progress}%</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <Button
          type="button"
          onClick={handleInstallAll}
          disabled={isStartingAll || anyDownloading || allRequiredReady}
          className="w-full"
        >
          {allRequiredReady
            ? 'All models ready'
            : isStartingAll
              ? 'Starting downloads...'
              : `Download all (${totalSizeGb} GB)`}
        </Button>
      </div>
    </div>
  )
}
