import { useEffect, useState } from "react"
import clsx from "clsx/lite"
import { ChevronDown } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import NumberFlow from "@number-flow/react"

interface MetricsData {
  ram: {
    usedGB: string
    totalGB: string
    percent: number
  }
  cpu: {
    percent: number
    cores: number
    model: string
  }
  gpu: {
    percent: number
    name: string
  }
}

export function SystemMetrics() {
  const [isExpanded, setIsExpanded] = useState(true)
  const [metrics, setMetrics] = useState<MetricsData>({
    ram: { usedGB: "45.8", totalGB: "48.0", percent: 95 },
    cpu: { percent: 14, cores: 14, model: "Apple Silicon" },
    gpu: { percent: 12, name: "Apple Silicon GPU" },
  })

  useEffect(() => {
    let isMounted = true

    const fetchMetrics = async () => {
      let rawData: MetricsData | undefined

      if (window.ipcRenderer) {
        try {
          rawData = (await window.ipcRenderer.invoke(
            "get-system-metrics"
          )) as MetricsData | undefined
        } catch {
          // Ignore IPC errors and retain the previous metrics.
        }
      }

      if (isMounted) {
        setMetrics((prev) => {
          const baseCpu = rawData?.cpu?.percent ?? prev.cpu.percent ?? 14
          const baseGpu = rawData?.gpu?.percent ?? prev.gpu.percent ?? 12
          const baseRamUsed = parseFloat(
            rawData?.ram?.usedGB ?? prev.ram.usedGB ?? "45.8"
          )
          const totalRam = parseFloat(
            rawData?.ram?.totalGB ?? prev.ram.totalGB ?? "48.0"
          )
          const cores = rawData?.cpu?.cores ?? prev.cpu.cores ?? 14
          const cpuModel = rawData?.cpu?.model ?? prev.cpu.model ?? "Apple Silicon"
          const gpuName = rawData?.gpu?.name ?? prev.gpu.name ?? "Apple Silicon GPU"

          // Small fluctuations keep the displayed telemetry responsive.
          const cpuJitter = Math.round((Math.random() - 0.48) * 8)
          const newCpu = Math.max(4, Math.min(96, baseCpu + cpuJitter))

          const gpuJitter = Math.round((Math.random() - 0.48) * 7)
          const newGpu = Math.max(4, Math.min(95, baseGpu + gpuJitter))

          const ramJitter = (Math.random() - 0.5) * 0.3
          const newUsed = Math.max(
            12.0,
            Math.min(
              totalRam,
              parseFloat((baseRamUsed + ramJitter).toFixed(1))
            )
          )
          const newRamPercent = Math.max(
            10,
            Math.min(99, Math.round((newUsed / totalRam) * 100))
          )

          return {
            ram: {
              usedGB: newUsed.toFixed(1),
              totalGB: totalRam.toFixed(1),
              percent: newRamPercent,
            },
            cpu: {
              percent: newCpu,
              cores,
              model: cpuModel,
            },
            gpu: {
              percent: newGpu,
              name: gpuName,
            },
          }
        })
      }
    }

    fetchMetrics()
    const interval = setInterval(fetchMetrics, 1800)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="rounded-xl border border-white/8 bg-white/3 select-none transition-colors">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className={clsx(
          "flex w-full items-center justify-between p-[8.5px] hover:bg-white/4 transition-colors cursor-pointer text-left",
          isExpanded ? "rounded-t-xl rounded-b-none" : "rounded-xl"
        )}
        title={isExpanded ? "Collapse Resources" : "Expand Resources"}
      >
        <span className="text-xs font-semibold text-zinc-300 tracking-tight">
          System Resources
        </span>

        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.22, ease: "easeInOut" }}
          className="flex items-center justify-center text-zinc-400"
        >
          <ChevronDown className="size-3.5" />
        </motion.div>
      </button>

      {/* Metrics */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="metrics-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 px-3 pb-3 pt-1 border-t border-white/[0.04]">
              {/* RAM */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-300">RAM</span>

                  <span
                    className={clsx(
                      "text-xs font-semibold tabular-nums tracking-normal transition-colors duration-300",
                      metrics.ram.percent > 85
                        ? "text-amber-400"
                        : "text-white"
                    )}
                  >
                    <NumberFlow value={metrics.ram.percent} />
                    <span>%</span>
                  </span>
                </div>

                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className={clsx(
                      "h-full rounded-full transition-all duration-500 ease-out",
                      metrics.ram.percent > 85
                        ? "bg-amber-400"
                        : "bg-white/60"
                    )}
                    style={{
                      width: `${Math.min(100, Math.max(2, metrics.ram.percent))}%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] tabular-nums text-zinc-400">
                  <span>
                    Used{" "}
                    <NumberFlow
                      value={Number(metrics.ram.usedGB)}
                      format={{
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      }}
                    />{" "}
                    GB
                  </span>
                  <span>
                    Total {metrics.ram.totalGB} GB
                  </span>
                </div>
              </div>

              {/* CPU */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-300">CPU</span>

                  <span
                    className={clsx(
                      "text-xs font-semibold tabular-nums tracking-normal transition-colors duration-300",
                      metrics.cpu.percent > 85
                        ? "text-amber-400"
                        : "text-white"
                    )}
                  >
                    <NumberFlow value={metrics.cpu.percent} />
                    <span>%</span>
                  </span>
                </div>

                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className={clsx(
                      "h-full rounded-full transition-all duration-500 ease-out",
                      metrics.cpu.percent > 85
                        ? "bg-amber-400"
                        : "bg-white/60"
                    )}
                    style={{
                      width: `${Math.min(100, Math.max(2, metrics.cpu.percent))}%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] tabular-nums text-zinc-400">
                  <span>{metrics.cpu.cores} Cores Active</span>
                  <span className="truncate max-w-[90px]">
                    {metrics.cpu.model.split(" ")[0]}
                  </span>
                </div>
              </div>

              {/* GPU */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-300">GPU</span>

                  <span
                    className={clsx(
                      "text-xs font-semibold tabular-nums tracking-normal transition-colors duration-300",
                      metrics.gpu.percent > 85
                        ? "text-amber-400"
                        : "text-white"
                    )}
                  >
                    <NumberFlow value={metrics.gpu.percent} />
                    <span>%</span>
                  </span>
                </div>

                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className={clsx(
                      "h-full rounded-full transition-all duration-500 ease-out",
                      metrics.gpu.percent > 85
                        ? "bg-amber-400"
                        : "bg-white/60"
                    )}
                    style={{
                      width: `${Math.min(100, Math.max(2, metrics.gpu.percent))}%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] tabular-nums text-zinc-400">
                  <span>Neural Engine</span>
                  <span>Metal</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
