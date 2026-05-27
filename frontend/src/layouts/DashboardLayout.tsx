import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { MessageSquare, Megaphone, Shield, BarChart3, Home, ChevronLeft, ChevronRight } from 'lucide-react'
import { useWebSocket } from '../hooks/useWebSocket'

const navItems = [
  { to: '/inbox',      label: 'Inbox',      icon: <MessageSquare className="w-5 h-5 flex-shrink-0" /> },
  { to: '/campaigns',  label: 'Campaigns',  icon: <Megaphone className="w-5 h-5 flex-shrink-0" /> },
  { to: '/compliance', label: 'Compliance', icon: <Shield className="w-5 h-5 flex-shrink-0" /> },
  { to: '/analytics',  label: 'Analytics',  icon: <BarChart3 className="w-5 h-5 flex-shrink-0" /> },
]

export default function DashboardLayout() {
  useWebSocket('demo-agent')
  const navigate = useNavigate()
  const [open, setOpen] = useState(true)

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">

      {/* Sidebar */}
      <aside
        className={`relative flex-shrink-0 bg-[#0f3833] flex flex-col transition-all duration-200 ${open ? 'w-56' : 'w-14'}`}
      >
        {/* Logo + collapse toggle */}
        <div className="h-14 flex items-center justify-between px-3 border-b border-white/10 flex-shrink-0">
          {/* Logo — click goes home */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 min-w-0 group"
            title="Go to home"
          >
            <div className="w-7 h-7 bg-teal-400 group-hover:bg-teal-300 rounded-lg flex items-center justify-center shadow flex-shrink-0 transition-colors">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            {open && (
              <span className="text-white group-hover:text-teal-200 font-semibold text-sm truncate transition-colors">
                ContextFlow
              </span>
            )}
          </button>

          {/* Collapse button — only visible when sidebar is open */}
          {open && (
            <button
              onClick={() => setOpen(false)}
              className="text-white/50 hover:text-white transition-colors flex-shrink-0 ml-1"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-hidden">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={!open ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-2 py-2.5 rounded-lg transition-colors text-sm font-medium ${
                  isActive
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {item.icon}
              {open && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-2 pb-3 border-t border-white/10 pt-2 flex-shrink-0">
          <NavLink
            to="/"
            title={!open ? 'Home' : undefined}
            className="flex items-center gap-3 px-2 py-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors text-xs"
          >
            <Home className="w-4 h-4 flex-shrink-0" />
            {open && <span className="truncate">Home</span>}
          </NavLink>
          {open && (
            <div className="flex items-center gap-2 px-2 py-2 mt-1">
              <div className="w-6 h-6 rounded-full bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-300 text-xs font-bold flex-shrink-0">
                N
              </div>
              <div className="min-w-0">
                <p className="text-white text-xs font-medium truncate">NeoBank</p>
                <p className="text-white/40 text-[10px] truncate">Demo account</p>
              </div>
            </div>
          )}
        </div>

        {/* Expand tab — floats on the right edge when sidebar is collapsed */}
        {!open && (
          <button
            onClick={() => setOpen(true)}
            title="Expand sidebar"
            className="absolute top-3.5 -right-3 z-10 w-6 h-6 rounded-full bg-[#0f3833] border border-white/20 shadow flex items-center justify-center text-white/70 hover:text-white hover:bg-teal-700 transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-0 min-w-0 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
