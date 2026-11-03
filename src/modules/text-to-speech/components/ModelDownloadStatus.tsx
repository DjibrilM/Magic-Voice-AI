import React, { useState } from 'react'
import { Download, CheckCircle2, Loader2 } from 'lucide-react'
import { useModels } from '@/modules/models'
import { useModelInfo } from '@/lib/hooks/useModelInfo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

interface ModelDownloadStatusProps {
  qvacName: string
  modelId: string
  name: string
  sizeFormatted?: string
  description?: string
  required?: boolean
}

export const ModelDownloadStatus: React.FC<ModelDownloadStatusProps> = ({
  qvacName,
  modelId,
  name,
  sizeFormatted,
  description,
}) => {
  const { info, isLoading, error, refetch } = useModelInfo(qvacName, true)
  const {
    downloadModel,
    cancelDownload,
    downloadingModels,
  } = useModels()

  const [manualError, setManualError] = useState<string | null>(null)

  const isDownloading = !!downloadingModels[modelId]
  const download = downloadingModels[modelId]
  const progress = Math.max(0, Math.min(100, Math.round(download?.percentage ?? 0)))
  const isReady = info?.isCached ?? false
  const isChecking = isLoading

  const handleDownload = async () => {
    setManualError(null)
    try {
      const ok = await downloadModel(modelId)
      if (!ok) {
        setManualError('Download failed. Check logs for details.')
      }
    } catch (err) {
      setManualError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleCancel = async () => {
    await cancelDownload(modelId)
  }

  const handleRetry = async () => {
    await refetch()
  }

  if (isChecking) {
    return (
      <Card className="w-full animate-pulse">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>{name}</CardTitle>
          <Loader2 className="size-4" />
        </CardHeader>
        <CardContent>
          <CardDescription>Checking model status…</CardDescription>
        </CardContent>
      </Card>
    )
  }

  if (error && !info) {
    return (
      <Card className="w-full border-destructive">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>{name}</CardTitle>
          <Button variant="outline" size="sm" onClick={handleRetry}>
            Retry
          </Button>
        </CardHeader>
        <CardContent>
          <CardDescription className="text-destructive">
            Unable to check model status: {error}
          </CardDescription>
        </CardContent>
      </Card>
    )
  }

  if (isReady) {
    return (
      <Card className="w-full border-green-500/50 bg-green-500/5">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-green-600" />
            <CardTitle>{name}</CardTitle>
          </div>
          <span className="text-xs font-medium text-green-700 bg-green-100/50 px-2 py-0.5 rounded">
            Ready
          </span>
        </CardHeader>
        {sizeFormatted && (
          <CardContent>
            <CardDescription>{sizeFormatted}</CardDescription>
          </CardContent>
        )}
        {description && <CardFooter>{description}</CardFooter>}
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Download className="size-4 text-muted-foreground" />
          <CardTitle>{name}</CardTitle>
        </div>
        {isDownloading ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="shrink-0 text-muted-foreground"
          >
            Cancel
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="shrink-0"
            disabled={manualError !== null}
          >
            <Download className="mr-1.5 size-3.5" />
            {manualError ? 'Retry' : 'Download'}
          </Button>
        )}
      </CardHeader>

      {sizeFormatted && (
        <CardContent>
          <CardDescription>{sizeFormatted}</CardDescription>
        </CardContent>
      )}

      {isDownloading && (
        <CardContent className="pt-0">
          <div className="space-y-1.5">
            <div
              className="h-1 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label={`Downloading ${name}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-right text-xs text-muted-foreground">
              {progress}%
            </p>
          </div>
        </CardContent>
      )}

      {(manualError || error) && (
        <CardFooter className="text-destructive text-xs">
          {manualError || error}
        </CardFooter>
      )}

      {description && !isDownloading && !manualError && (
        <CardFooter>{description}</CardFooter>
      )}
    </Card>
  )
}

export default ModelDownloadStatus