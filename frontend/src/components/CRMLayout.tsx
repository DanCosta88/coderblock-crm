import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  KanbanSquare,
  Users,
  Monitor,
  FileText,
  Activity,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/pipeline', label: 'Pipeline', icon: KanbanSquare },
  { to: '/prospects', label: 'Prospects', icon: Users },
  { to: '/demos', label: 'Demo Tracker', icon: Monitor },
  { to: '/quotes', label: 'Quotes', icon: FileText },
  { to: '/activity', label: 'Activity', icon: Activity },
]

export default function CRMLayout() {
  const [open, setOpen] = useState(false)
  const { logout, user } = useAuth() as any
  const navigate = useNavigate()

  const handleLogout = () => {
    logout?.()
    navigate('/login')
  }

  const userName = user?.full_name || user?.name || user?.email || 'Danilo'

  const Sidebar = (
    <aside className="h-full w-64 bg-stone-900 text-stone-100 flex flex-col">
      <div className="px-6 py-6 border-b border-stone-800">
        <h1 className="font-bold text-xl tracking-tight">
          Coderblock <span className="text-amber-500">CRM</span>
        </h1>
        <p className="text-xs text-stone-500 mt-1">Sales Intelligence</p>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-amber-500/20 text-amber-400 border-l-2 border-amber-500'
                  : 'text-stone-400 hover:text-white hover:bg-stone-800'
              }`
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-stone-800 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center text-stone-900 font-bold text-sm">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{userName}</p>
            <p className="text-xs text-stone-500">Sales</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-md bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" /> Log out
        </button>
      </div>
    </aside>
  )

  return (
    <div className="h-screen flex overflow-hidden font-sans bg-amber-50 text-stone-900">
      <div className="hidden md:block fixed inset-y-0 left-0">{Sidebar}</div>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 bg-stone-900 text-white flex items-center justify-between px-4 py-3 border-b border-stone-800">
        <h1 className="font-bold">
          Coderblock <span className="text-amber-500">CRM</span>
        </h1>
        <button onClick={() => setOpen(true)} className="p-2">
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative z-10">
            {Sidebar}
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 md:ml-64 pt-14 md:pt-0 h-full overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
