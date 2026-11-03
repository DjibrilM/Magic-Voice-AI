import * as React from 'react'
import { cn } from '@/lib/utils'

export interface AutoResizeTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  minHeight?: number
  maxHeight?: number
}

export const AutoResizeTextarea = React.forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
  (
    {
      className,
      value,
      minHeight = 40,
      maxHeight,
      onChange,
      onInput,
      style,
      ...props
    },
    forwardedRef
  ) => {
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null)

    const setRef = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        innerRef.current = node
        if (typeof forwardedRef === 'function') {
          forwardedRef(node)
        } else if (forwardedRef) {
          (forwardedRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node
        }
      },
      [forwardedRef]
    )

    const resize = React.useCallback(() => {
      const el = innerRef.current
      if (!el) return
      el.style.height = 'auto'
      const scrollHeight = el.scrollHeight
      const targetHeight = Math.max(scrollHeight, minHeight)
      if (maxHeight && targetHeight > maxHeight) {
        el.style.height = `${maxHeight}px`
        el.style.overflowY = 'auto'
      } else {
        el.style.height = `${targetHeight}px`
        el.style.overflowY = 'hidden'
      }
    }, [minHeight, maxHeight])

    React.useEffect(() => {
      resize()
    }, [value, resize])

    return (
      <textarea
        ref={setRef}
        value={value}
        onChange={onChange}
        onInput={(e) => {
          resize()
          onInput?.(e)
        }}
        style={{
          ...style,
          fieldSizing: 'content',
        }}
        className={cn(
          'field-sizing-content resize-none overflow-hidden transition-[height] duration-75',
          className
        )}
        {...props}
      />
    )
  }
)

AutoResizeTextarea.displayName = 'AutoResizeTextarea'
