import { useState, useRef, useCallback } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { MessageSquare, Megaphone, Shield, BarChart3, Home, ChevronLeft, ChevronRight } from 'lucide-react'
import { useWebSocket } from '../hooks/useWebSocket'

const navItems = [
  { to: '/inbox',      label: 'Inbox',      icon: <MessageSquare className="w-5 h-5 flex-shrink-0" /> },
  { to: '/campaigns',  label: 'Campaigns',  icon: <Megaphone className="w-5 h-5 flex-shrink-0" /> },
  { to: '/compliance', label: 'Compliance', icon: <Shield className="w-5 h-5 flex-shrink-0" /> },
  { to: '/analytics',  label: 'Analytics',  icon: <BarChart3 className="w-5 h-5 flex-shrink-0" /> },
]

const MIN_WIDTH = 56
const MAX_WIDTH = 320
const COLLAPSED_WIDTH = 56
const DEFAULT_WIDTH = 224  // w-56

export default function DashboardLayout() {
  useWebSocket('demo-agent')
  const navigate = useNavigate()
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH)
  const [open, setOpen] = useState(true)
  const dragging = useRef(false)
  const startX = useRef(0)
  const startW = useRef(0)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true
    startX.current = e.clientX
    startW.current = sidebarWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      const newW = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW.current + ev.clientX - startX.current))
      setSidebarWidth(newW)
      if (newW <= COLLAPSED_WIDTH + 10) setOpen(false)
      else setOpen(true)
    }

    const onMouseUp = () => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [sidebarWidth])

  const collapse = () => { setOpen(false); setSidebarWidth(COLLAPSED_WIDTH) }
  const expand = () => { setOpen(true); setSidebarWidth(DEFAULT_WIDTH) }

  const effectiveWidth = open ? sidebarWidth : COLLAPSED_WIDTH

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-teal-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-medium">
        Skip to main content
      </a>

      {/* Sidebar */}
      <aside
        aria-label="Main navigation"
        style={{ width: effectiveWidth }}
        className="relative flex-shrink-0 bg-[#0f3833] flex flex-col"
      >
        {/* Logo + collapse toggle */}
        <div className="h-14 flex items-center justify-between px-3 border-b border-white/10 flex-shrink-0">
          <button
            onClick={() => navigate('/home')}
            className="flex items-center group min-w-0"
            aria-label="Go to home"
          >
            {open && sidebarWidth > 90 ? (
              <img
                src="/logo.png"
                alt="ContextFlow"
                className="h-8 w-auto object-contain"
                style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.7))' }}
              />
            ) : (
              <div className="w-7 h-7 bg-teal-400 group-hover:bg-teal-300 rounded-lg flex items-center justify-center shadow flex-shrink-0 transition-colors">
                <MessageSquare className="w-4 h-4 text-white" aria-hidden="true" />
              </div>
            )}
          </button>

          {open && (
            <button
              onClick={collapse}
              className="text-white/50 hover:text-white transition-colors flex-shrink-0 ml-2"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-hidden">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              aria-label={!open || sidebarWidth <= 90 ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-2 py-2.5 rounded-lg transition-colors text-sm font-medium ${
                  isActive
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {item.icon}
              {open && sidebarWidth > 90 && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-2 pb-3 border-t border-white/10 pt-2 flex-shrink-0">
          <NavLink
            to="/home"
            aria-label={!open || sidebarWidth <= 90 ? 'Home' : undefined}
            className="flex items-center gap-3 px-2 py-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors text-xs"
          >
            <Home className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            {open && sidebarWidth > 90 && <span className="truncate">Home</span>}
          </NavLink>
          {open && sidebarWidth > 90 && (
            <div className="flex items-center gap-2 px-2 py-2 mt-1">
              <div className="w-6 h-6 rounded-full bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-300 text-xs font-bold flex-shrink-0" aria-hidden="true">
                N
              </div>
              <div className="min-w-0">
                <p className="text-white text-xs font-medium truncate">NeoBank</p>
                <p className="text-white/40 text-[10px] truncate">Demo account</p>
              </div>
            </div>
          )}
        </div>

        {/* Expand tab when collapsed */}
        {!open && (
          <button
            onClick={expand}
            aria-label="Expand sidebar"
            className="absolute top-3.5 -right-3 z-10 w-6 h-6 rounded-full bg-[#0f3833] border border-white/20 shadow flex items-center justify-center text-white/70 hover:text-white hover:bg-teal-700 transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}

        {/* Drag handle */}
        <div
          onMouseDown={onMouseDown}
          aria-hidden="true"
          className="absolute top-0 right-0 w-2 h-full cursor-col-resize group z-20 flex items-center justify-center"
        >
          <div className="w-0.5 h-full bg-white/10 group-hover:bg-teal-400/60 group-active:bg-teal-400 transition-colors" />
        </div>
      </aside>

      {/* Main content */}
      <main id="main-content" className="flex-1 min-h-0 min-w-0 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
