import * as React from 'react'
import { GripVertical } from 'lucide-react'
import { cn } from 'cn'

type Orientation = 'horizontal' | 'vertical'

interface ResizableContextValue {
  orientation: Orientation
  sizes: number[]
  startResize: (handleIndex: number, e: React.PointerEvent) => void
  isDragging: boolean
}

const ResizableContext = React.createContext<ResizableContextValue | null>(null)

function parsePercent(val?: number | string, fallback: number = 50): number {
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const num = parseFloat(val)
    if (!Number.isNaN(num)) return num
  }
  return fallback
}

export interface ResizablePanelGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: Orientation
  direction?: Orientation
  className?: string
  children: React.ReactNode
}

export const ResizablePanelGroup: React.FC<ResizablePanelGroupProps> = ({
  orientation = 'horizontal',
  direction,
  className,
  children,
  ...props
}) => {
  const activeOrientation = direction || orientation
  const isHorizontal = activeOrientation !== 'vertical'
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Extract initial panel sizes from children
  const panelPropsList = React.useMemo(() => {
    const list: { defaultSize: number; minSize: number; maxSize: number }[] = []
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child) && (child.type as any)?.displayName === 'ResizablePanel') {
        const p = child.props as ResizablePanelProps
        list.push({
          defaultSize: parsePercent(p.defaultSize, 50),
          minSize: parsePercent(p.minSize, 10),
          maxSize: parsePercent(p.maxSize, 90),
        })
      }
    })
    return list
  }, [children])

  const [sizes, setSizes] = React.useState<number[]>(() => {
    if (panelPropsList.length === 0) return [50, 50]
    const initial = panelPropsList.map((p) => p.defaultSize)
    const sum = initial.reduce((a, b) => a + b, 0)
    if (sum > 0 && Math.abs(sum - 100) > 0.5) {
      return initial.map((s) => (s / sum) * 100)
    }
    return initial
  })

  const [isDragging, setIsDragging] = React.useState(false)

  // Start resize drag handler
  const startResize = React.useCallback(
    (handleIndex: number, e: React.PointerEvent) => {
      if (!containerRef.current) return
      e.preventDefault()
      e.stopPropagation()

      const container = containerRef.current
      const rect = container.getBoundingClientRect()
      const totalDimension = isHorizontal ? rect.width : rect.height
      if (totalDimension <= 0) return

      const startPos = isHorizontal ? e.clientX : e.clientY
      const initialSizes = [...sizes]

      const leftIdx = handleIndex
      const rightIdx = handleIndex + 1

      if (leftIdx < 0 || rightIdx >= initialSizes.length) return

      const leftConstraints = panelPropsList[leftIdx] || { minSize: 10, maxSize: 90 }
      const rightConstraints = panelPropsList[rightIdx] || { minSize: 10, maxSize: 90 }

      const combinedSize = initialSizes[leftIdx] + initialSizes[rightIdx]

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const currentPos = isHorizontal ? moveEvent.clientX : moveEvent.clientY
        const deltaPx = currentPos - startPos
        const deltaPercent = (deltaPx / totalDimension) * 100

        let newLeft = initialSizes[leftIdx] + deltaPercent
        let newRight = initialSizes[rightIdx] - deltaPercent

        // Clamp to left constraints
        if (newLeft < leftConstraints.minSize) {
          newLeft = leftConstraints.minSize
          newRight = combinedSize - leftConstraints.minSize
        } else if (newLeft > leftConstraints.maxSize) {
          newLeft = leftConstraints.maxSize
          newRight = combinedSize - leftConstraints.maxSize
        }

        // Clamp to right constraints
        if (newRight < rightConstraints.minSize) {
          newRight = rightConstraints.minSize
          newLeft = combinedSize - rightConstraints.minSize
        } else if (newRight > rightConstraints.maxSize) {
          newRight = rightConstraints.maxSize
          newLeft = combinedSize - rightConstraints.maxSize
        }

        setSizes((prev) => {
          const next = [...prev]
          next[leftIdx] = newLeft
          next[rightIdx] = newRight
          return next
        })
      }

      const handlePointerUp = () => {
        setIsDragging(false)
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', handlePointerUp)
      }

      setIsDragging(true)
      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
    },
    [isHorizontal, sizes, panelPropsList]
  )

  const contextValue = React.useMemo<ResizableContextValue>(
    () => ({
      orientation: activeOrientation,
      sizes,
      startResize,
      isDragging,
    }),
    [activeOrientation, sizes, startResize, isDragging]
  )

  // Map children to inject current size and handle index
  let panelIdx = 0
  let handleIdx = 0

  const mappedChildren = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child

    if ((child.type as any)?.displayName === 'ResizablePanel') {
      const currentIdx = panelIdx++
      const size = sizes[currentIdx] ?? panelPropsList[currentIdx]?.defaultSize ?? 50
      return React.cloneElement(child as React.ReactElement<any>, {
        _computedSize: size,
      })
    }

    if ((child.type as any)?.displayName === 'ResizableHandle') {
      const currentHandleIdx = handleIdx++
      return React.cloneElement(child as React.ReactElement<any>, {
        _handleIndex: currentHandleIdx,
      })
    }

    return child
  })

  return (
    <ResizableContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        data-group="true"
        data-orientation={activeOrientation}
        className={cn(
          'flex h-full w-full overflow-hidden',
          !isHorizontal && 'flex-col',
          isDragging && (isHorizontal ? 'cursor-col-resize select-none' : 'cursor-row-resize select-none'),
          className
        )}
        {...props}
      >
        {mappedChildren}
      </div>
    </ResizableContext.Provider>
  )
}
ResizablePanelGroup.displayName = 'ResizablePanelGroup'

export interface ResizablePanelProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultSize?: number | string
  minSize?: number | string
  maxSize?: number | string
  className?: string
  children: React.ReactNode
  /** Internal size injected by ResizablePanelGroup */
  _computedSize?: number
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({
  defaultSize,
  minSize,
  maxSize,
  className,
  children,
  style,
  _computedSize,
  ...props
}) => {
  const context = React.useContext(ResizableContext)
  const isHorizontal = context?.orientation !== 'vertical'
  const sizeValue = _computedSize !== undefined ? _computedSize : parsePercent(defaultSize, 50)
  const sizePercent = `${sizeValue}%`

  return (
    <div
      data-panel="true"
      className={cn('min-h-0 min-w-0 overflow-hidden', className)}
      style={{
        flexBasis: sizePercent,
        flexGrow: 0,
        flexShrink: 0,
        width: isHorizontal ? sizePercent : '100%',
        height: isHorizontal ? '100%' : sizePercent,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  )
}
ResizablePanel.displayName = 'ResizablePanel'

export interface ResizableHandleProps extends React.HTMLAttributes<HTMLDivElement> {
  withHandle?: boolean
  className?: string
  /** Internal handle index injected by ResizablePanelGroup */
  _handleIndex?: number
}

export const ResizableHandle: React.FC<ResizableHandleProps> = ({
  withHandle,
  className,
  _handleIndex = 0,
  ...props
}) => {
  const context = React.useContext(ResizableContext)
  const isHorizontal = context?.orientation !== 'vertical'

  return (
    <div
      role="separator"
      tabIndex={0}
      onPointerDown={(e) => {
        context?.startResize(_handleIndex, e)
      }}
      className={cn(
        'relative flex items-center justify-center bg-[#1f1f23] focus-visible:outline-none select-none shrink-0 z-10',
        isHorizontal
          ? 'w-px h-full cursor-col-resize after:absolute after:inset-y-0 after:-left-1.5 after:-right-1.5 after:cursor-col-resize'
          : 'h-px w-full cursor-row-resize after:absolute after:inset-x-0 after:-top-1.5 after:-bottom-1.5 after:cursor-row-resize',
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="z-10 flex h-4 w-3 items-center justify-center rounded-xs border border-[#27272a] bg-[#161619] text-zinc-400 pointer-events-none">
          <GripVertical className="size-2.5" />
        </div>
      )}
    </div>
  )
}
ResizableHandle.displayName = 'ResizableHandle'
