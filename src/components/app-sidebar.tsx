import { Link, useLocation } from "react-router-dom"
import {
  TextToSpeechIcon,
  SettingsIcon,
} from "@/components/icons"
import { SystemMetrics } from "@/components/system-metrics"

export function AppSidebar({ isOpen = true }: { isOpen?: boolean }) {
  const location = useLocation()

  const navItems = [
    { name: "Text To Speech", path: "/", icon: TextToSpeechIcon },
    { name: "Settings", path: "/settings", icon: SettingsIcon },
  ]

  const isActive = (path: string) => {
    if (path === "/" && (location.pathname === "/" || location.pathname === "/text-to-speech")) return true
    return location.pathname === path
  }

  return (
    <aside
      className={`flex h-full shrink-0 flex-col justify-between border-r border-[#262629] bg-[#161616] select-none transition-all duration-300 ease-in-out ${
        isOpen
          ? "w-[240px] opacity-100"
          : "w-0 opacity-0 -translate-x-full border-r-0 pointer-events-none overflow-hidden"
      }`}
    >
      {/* Top Section: Logo with bottom border aligned at header level */}
      <div className="flex h-10 shrink-0 items-center border-b border-[#262629] px-3">
        <Link
          to="/"
          className="flex items-center gap-2.5 px-2.5 text-white hover:opacity-90 transition-opacity"
        >
          <div className="flex size-6 items-center justify-center rounded-md bg-white/10 text-white">
            <TextToSpeechIcon className="size-4 shrink-0 text-white" />
          </div>
          <span className="text-[14px] font-semibold tracking-tight text-white">Magic-Voice AI</span>
        </Link>
      </div>

      {/* Middle Section: Nav items */}
      <div className="flex flex-1 flex-col overflow-y-auto px-3 py-3 sidebar-scrollbar">
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const active = isActive(item.path)
            const Icon = item.icon
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors ${
                  active
                    ? "bg-[#232323] text-white"
                    : "text-[#a1a1aa] hover:bg-white/4 hover:text-[#f4f4f5]"
                }`}
              >
                <Icon className="size-4.5 shrink-0 text-current" />
                <span className="truncate">{item.name}</span>
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Bottom Section: Minimalist System Resource Telemetry */}
      <div className="border-t border-[#262629]/80 p-3 bg-[#161616]">
        <SystemMetrics />
      </div>
    </aside>
  )
}
