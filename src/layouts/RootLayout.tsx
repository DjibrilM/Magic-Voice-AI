import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AppSidebar } from '@/components/app-sidebar'
import { Header } from '@/components/header'
import { GlobalPlayerBar } from '@/components/player/GlobalPlayerBar'

export function RootLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev)
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0f0f10] text-[#f4f4f5]">
      {/* Sidebar wraps the left side of the application */}
      <AppSidebar isOpen={isSidebarOpen} />

      {/* Main container with Top Header, Page Outlet, and Persistent Global Player */}
      <div className="flex flex-1 flex-col min-w-0 h-full overflow-hidden bg-[#0f0f10] relative">
        {/* Top Header with toggle, current page icon, title, and settings */}
        <Header
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={toggleSidebar}
        />

        {/* Scrollable Main Content */}
        <main className="flex-1 min-h-0 flex flex-col overflow-auto bg-[#0f0f10] relative">
          <Outlet />
        </main>

        {/* Persistent Application Layout Player Bar (YouTube Music Inspired) */}
        <GlobalPlayerBar />
      </div>
    </div>
  )
}
