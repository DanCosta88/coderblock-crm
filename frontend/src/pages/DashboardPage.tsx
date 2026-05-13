import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  Euro,
  Monitor,
  FileWarning,
  TrendingUp,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { apiClient } from '../services/api'

interface StageStat {
  stage: string
  count: number
  value: number
}

interface InactiveProspect {
  id: number
  first_name: string
  last_name: string
  company?: string
  last_activity_date?: string | null
}

interface ExpiringQuote {
  id: number
  title?: string
  prospect_name?: string
  amount: number
  expiry_date?: string
  valid_until?: string
}

interface Stats {
  total_prospects: number
  pipeline_value: number
  active_demos: number
  expiring_quotes: number
  pipeline_by_stage: StageStat[]
  inactive_prospects: InactiveProspect[]
  expiring_quotes_list: ExpiringQuote[]
}

const STAGE_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  call: 'Call Scheduled',
  demo: 'Demo',
  proposal: 'Proposal',
  won: 'Won',
  lost: 'Lost',
}

const STAGE_COLORS: Record<string, string> = {
  new: 'bg-stone-400',
  contacted: 'bg-blue-500',
  call: 'bg-indigo-500',
  demo: 'bg-purple-500',
  proposal: 'bg-amber-500',
  won: 'bg-green-500',
  lost: 'bg-red-500',
}

function fmtEur(n: number) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n || 0)
}

function daysAgo(s?: string | null) {
  if (!s) return '—'
  const diff = Math.floor((Date.now() - new Date(s).getTime()) / (1000 * 60 * 60 * 24))
  if (diff <= 0) return 'today'
  if (diff === 1) return '1 day ago'
  return `${diff} days ago`
}

function daysUntil(s?: string) {
  if (!s) return Infinity
  return Math.ceil((new Date(s).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const data = await apiClient.get<Stats>('/dashboard/stats')
        if (mounted) setStats(data)
      } catch (e: any) {
        if (mounted) setError(e.message || 'Failed to load dashboard')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-8 w-48 bg-stone-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-white rounded-xl border border-stone-200 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" /> {error || 'No data available.'}
        </div>
      </div>
    )
  }

  const stageOrder = ['new', 'contacted', 'call', 'demo', 'proposal', 'won', 'lost']
  const byStage: Record<string, StageStat> = {}
  ;(stats.pipeline_by_stage || []).forEach((s) => (byStage[s.stage] = s))
  const maxCount = Math.max(1, ...stageOrder.map((s) => byStage[s]?.count || 0))

  const cards = [
    {
      label: 'Total Prospects',
      value: stats.total_prospects ?? 0,
      icon: Users,
      hint: 'in your CRM',
    },
    {
      label: 'Pipeline Value',
      value: fmtEur(stats.pipeline_value ?? 0),
      icon: Euro,
      hint: 'open opportunities',
    },
    {
      label: 'Active Demos',
      value: stats.active_demos ?? 0,
      icon: Monitor,
      hint: 'scheduled / in build',
    },
    {
      label: 'Expiring Quotes',
      value: stats.expiring_quotes ?? 0,
      icon: FileWarning,
      hint: 'within 7 days',
    },
  ]

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-stone-500 mt-1">Good to see you, Danilo. Here's where things stand.</p>
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, hint }) => (
          <div
            key={label}
            className="bg-white rounded-xl shadow-sm border border-stone-200 p-5 hover:shadow-md transition"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-stone-500 font-semibold">
                  {label}
                </p>
                <p className="text-3xl font-bold mt-2">{value}</p>
                <p className="text-xs text-stone-400 mt-1">{hint}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pipeline chart */}
      <section className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-600" /> Pipeline by Stage
            </h2>
            <p className="text-sm text-stone-500">Prospect count and value across stages</p>
          </div>
          <Link
            to="/pipeline"
            className="text-sm text-amber-600 hover:text-amber-700 font-semibold"
          >
            Open board →
          </Link>
        </div>
        <div className="space-y-3">
          {stageOrder.map((stage) => {
            const s = byStage[stage] || { stage, count: 0, value: 0 }
            const width = (s.count / maxCount) * 100
            return (
              <div key={stage} className="flex items-center gap-4">
                <div className="w-32 shrink-0 text-sm font-medium text-stone-700">
                  {STAGE_LABELS[stage]}
                </div>
                <div className="flex-1 h-8 bg-stone-100 rounded-md overflow-hidden relative">
                  <div
                    className={`h-full ${STAGE_COLORS[stage]} transition-all duration-500 flex items-center px-3`}
                    style={{ width: `${Math.max(width, s.count > 0 ? 6 : 0)}%` }}
                  >
                    {s.count > 0 && (
                      <span className="text-xs font-bold text-white">{s.count}</span>
                    )}
                  </div>
                </div>
                <div className="w-32 text-right text-sm">
                  <span className="font-semibold text-stone-900">{fmtEur(s.value)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Two-column lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" /> Inactive Prospects
            </h2>
            <span className="text-xs text-stone-500">14+ days no activity</span>
          </div>
          <div className="space-y-2">
            {(stats.inactive_prospects || []).length === 0 && (
              <p className="text-sm text-stone-500 py-6 text-center">
                Everyone is engaged — nice work.
              </p>
            )}
            {(stats.inactive_prospects || []).slice(0, 8).map((p) => (
              <Link
                key={p.id}
                to={`/prospects/${p.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-amber-50 border border-transparent hover:border-amber-200 transition"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {p.first_name} {p.last_name}
                  </p>
                  <p className="text-xs text-stone-500 truncate">{p.company || '—'}</p>
                </div>
                <span className="text-xs text-stone-400 shrink-0 ml-2">
                  {daysAgo(p.last_activity_date)}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <FileWarning className="w-5 h-5 text-amber-600" /> Expiring Quotes
            </h2>
            <Link
              to="/quotes"
              className="text-xs text-amber-600 hover:text-amber-700 font-semibold"
            >
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {(stats.expiring_quotes_list || []).length === 0 && (
              <p className="text-sm text-stone-500 py-6 text-center">No quotes expiring soon.</p>
            )}
            {(stats.expiring_quotes_list || []).slice(0, 8).map((q) => {
              const expiry = q.expiry_date || q.valid_until
              const d = daysUntil(expiry)
              const urgent = d < 3
              return (
                <div
                  key={q.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-amber-50 border border-transparent hover:border-amber-200 transition"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {q.title || q.prospect_name || `Quote #${q.id}`}
                    </p>
                    <p className="text-xs text-stone-500">{fmtEur(q.amount)}</p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full shrink-0 ml-2 ${
                      urgent
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    {d <= 0 ? 'expired' : `${d}d left`}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
