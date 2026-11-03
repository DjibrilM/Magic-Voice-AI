import { Link, useLocation } from "react-router-dom"
import {
  SidebarToggleIcon,
  SettingsIcon,
  TextToSpeechIcon,
} from "@/components/icons"

function getRouteData(pathname: string) {
  switch (pathname) {
    case "/":
    case "/text-to-speech":
      return { title: "Text To Speech", icon: TextToSpeechIcon }
    case "/settings":
      return { title: "Settings", icon: SettingsIcon }
    default:
      return { title: "Text To Speech", icon: TextToSpeechIcon }
  }
}

interface HeaderProps {
  isSidebarOpen: boolean
  onToggleSidebar: () => void
}

export function Header({ isSidebarOpen, onToggleSidebar }: HeaderProps) {
  const location = useLocation()
  const { title, icon: PageIcon } = getRouteData(location.pathname)

  return (
    <header className="flex h-10 shrink-0 items-center justify-between border-b border-[#262629] bg-[#0f0f10] px-4 select-none">
      {/* Left side: Sidebar Toggle, Separator, Page Icon & Page Title */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="flex size-7 items-center justify-center rounded-md text-[#9d9da4] hover:bg-white/[0.06] hover:text-white transition-colors cursor-pointer"
          title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          aria-label="Toggle Sidebar"
        >
          <SidebarToggleIcon className="size-[18px]" />
        </button>

        <div className="h-4 w-px bg-white/8 mx-0.5" aria-hidden="true" />

        <div className="flex items-center gap-2">
          <PageIcon className="size-4 text-zinc-300 shrink-0" />
          <span className="text-[13.5px] font-semibold text-white tracking-tight">
            {title}
          </span>
        </div>
      </div>

      <div>
        <Link
          to="/settings"
          className="flex size-7 items-center justify-center rounded-md bg-white/6 text-white/75 hover:text-white hover:bg-white/10 transition-colors"
          title="Settings"
          aria-label="Settings"
        >
          <SettingsIcon className="size-[19px]" />
        </Link>
      </div>
    </header>
  )
}
