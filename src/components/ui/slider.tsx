import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center group cursor-pointer",
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-white/[0.16] transition-colors group-hover:bg-white/[0.25]">
      <SliderPrimitive.Range className="absolute h-full bg-white transition-colors" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block size-3.5 rounded-full border border-white/40 bg-white shadow-[0_0_8px_rgba(0,0,0,0.8)] ring-2 ring-black/50 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:scale-125 active:scale-95 cursor-grab active:cursor-grabbing" />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
