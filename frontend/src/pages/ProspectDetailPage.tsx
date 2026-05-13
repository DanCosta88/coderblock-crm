import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Pencil,
  Save,
  X,
  Mail,
  Phone,
  Globe,
  Linkedin,
  Plus,
  Trash2,
  StickyNote,
  Monitor,
  FileText,
} from 'lucide-react'
import { api } from '../services/api'

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
  new: 'bg-stone-200 text-stone-700',
  contacted: 'bg-blue-100 text-blue-700',
  call: 'bg-indigo-100 text-indigo-700',
  demo: 'bg-purple-100 text-purple-700',
  proposal: 'bg-amber-100 text-amber-700',
  won: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-700',
}

const ICP_LABELS: Record<number, { label: string; cls: string }> = {
  1: { label: 'Tier 1 ⭐⭐⭐', cls: 'bg-green-100 text-green-700' },
  2: { label: 'Tier 2 ⭐⭐', cls: 'bg-amber-100 text-amber-700' },
  3: { label: 'Tier 3 ⭐', cls: 'bg-red-100 text-red-700' },
}

const ACTIVITY_ICONS: Record<string, string> = {
  email: '📧',
  call: '📞',
  note: '📝',
  linkedin: '💼',
  demo: '🎬',
}

const QUOTE_STATUS_CLS: Record<string, string> = {
  draft: 'bg-stone-200 text-stone-700',
  sent: 'bg-blue-100 text-blue-700',
  viewed: 'bg-indigo-100 text-indigo-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-orange-100 text-orange-700',
}

interface Activity {
  id: number
  activity_type: string
  outcome?: string
  activity_date: string
}

interface Quote {
  id: number
  title?: string
  amount: number
  status: string
  expiry_date?: string
  valid_until?: string
}

interface Prospect {
  id: number
  first_name: string
  last_name: string
  email?: string
  phone?: string
  company?: string
  website?: string
  industry?: string
  macro_category?: string
  linkedin_url?: string
  source?: string
  icp_score?: number
  notes?: string
  pipeline_stage?: string
  activities?: Activity[]
  quotes?: Quote[]
}

function fmtEur(n: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)
}

function fmtDate(s?: string) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtDateTime(s?: string) {
  if (!s) return '—'
  return new Date(s).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function callApi(path: string, options: RequestInit = {}) {
  // Support both api() function-style and method-style exports
  if (typeof (api as any) === 'function') {
    return (api as any)(path, options)
  }
  throw new Error('api service unavailable')
}

export default function ProspectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [prospect, setProspect] = useState<Prospect | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<Prospect>>({})
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  // Activity form
  const [actType, setActType] = useState('email')
  const [actOutcome, setActOutcome] = useState('')
  const [actDate, setActDate] = useState(new Date().toISOString().slice(0, 16))

  // Quote form
  const [showQuote, setShowQuote] = useState(false)
  const [qTitle, setQTitle] = useState('')
  const [qAmount, setQAmount] = useState('')
  const [qExpiry, setQExpiry] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await callApi(`/prospects/${id}`)
      setProspect(data)
      setForm(data)
      setNotes(data.notes || '')
    } catch (e: any) {
      toast.error(e.message || 'Failed to load prospect')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const saveEdit = async () => {
    try {
      const updated = await callApi(`/prospects/${id}`, {
        method: 'PUT',
        body: JSON.stringify(form),
      })
      setProspect(updated)
      setEditing(false)
      toast.success('Prospect updated')
    } catch (e: any) {
      toast.error(e.message || 'Update failed')
    }
  }

  const saveNotes = async () => {
    setSavingNotes(true)
    try {
      const updated = await callApi(`/prospects/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...prospect, notes }),
      })
      setProspect(updated)
      toast.success('Notes saved')
    } catch (e: any) {
      toast.error(e.message || 'Failed to save notes')
    } finally {
      setSavingNotes(false)
    }
  }

  const logActivity = async () => {
    if (!actOutcome.trim()) {
      toast.error('Please add an outcome')
      return
    }
    try {
      await callApi('/activities', {
        method: 'POST',
        body: JSON.stringify({
          prospect_id: Number(id),
          activity_type: actType,
          outcome: actOutcome,
          activity_date: new Date(actDate).toISOString(),
        }),
      })
      setActOutcome('')
      toast.success('Activity logged')
      load()
    } catch (e: any) {
      toast.error(e.message || 'Failed to log activity')
    }
  }

  const addQuote = async () => {
    if (!qTitle.trim() || !qAmount) {
      toast.error('Title and amount are required')
      return
    }
    try {
      await callApi('/quotes', {
        method: 'POST',
        body: JSON.stringify({
          prospect_id: Number(id),
          title: qTitle,
          amount: Number(qAmount),
          status: 'draft',
          expiry_date: qExpiry ? new Date(qExpiry).toISOString() : null,
          valid_until: qExpiry ? new Date(qExpiry).toISOString() : null,
        }),
      })
      setQTitle('')
      setQAmount('')
      setQExpiry('')
      setShowQuote(false)
      toast.success('Quote added')
      load()
    } catch (e: any) {
      toast.error(e.message || 'Failed to add quote')
    }
  }

  const removeProspect = async () => {
    if (!confirm('Delete this prospect permanently?')) return
    try {
      await callApi(`/prospects/${id}`, { method: 'DELETE' })
      toast.success('Prospect deleted')
      navigate('/prospects')
    } catch (e: any) {
      toast.error(e.message || 'Delete failed')
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-8 w-48 bg-stone-200 rounded animate-pulse mb-4" />
        <div className="h-64 bg-white rounded-xl border border-stone-200 animate-pulse" />
      </div>
    )
  }

  if (!prospect) {
    return (
      <div className="p-8">
        <p>Prospect not found.</p>
        <Link to="/prospects" className="text-amber-600 hover:underline">
          ← Back to prospects
        </Link>
      </div>
    )
  }

  const icp = prospect.icp_score ? ICP_LABELS[prospect.icp_score] : null
  const stage = prospect.pipeline_stage || 'new'

  return (
    <div className="p-6 lg:p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <Link
          to="/prospects"
          className="inline-flex items-center gap-2 text-sm text-stone-600 hover:text-amber-700 font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> All Prospects
        </Link>
        <button
          onClick={removeProspect}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md text-red-600 hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4" /> Delete
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header card */}
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold truncate">
                  {prospect.first_name} {prospect.last_name}
                </h1>
                <p className="text-stone-500 mt-0.5 truncate">{prospect.company || '—'}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STAGE_COLORS[stage]}`}>
                    {STAGE_LABELS[stage] || stage}
                  </span>
                  {icp && (
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${icp.cls}`}>
                      {icp.label}
                    </span>
                  )}
                </div>
              </div>
              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-stone-100 hover:bg-stone-200 rounded-md"
                >
                  <Pencil className="w-4 h-4" /> Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={saveEdit}
                    className="inline-flex items-center gap-1 px-3 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-md"
                  >
                    <Save className="w-4 h-4" /> Save
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false)
                      setForm(prospect)
                    }}
                    className="inline-flex items-center gap-1 px-3 py-2 text-sm bg-stone-100 hover:bg-stone-200 rounded-md"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {editing && (
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-stone-200 pt-5">
                <Field label="First name" value={form.first_name} onChange={(v) => setForm({ ...form, first_name: v })} />
                <Field label="Last name" value={form.last_name} onChange={(v) => setForm({ ...form, last_name: v })} />
                <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
                <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
                <Field label="Company" value={form.company} onChange={(v) => setForm({ ...form, company: v })} />
                <Field label="Website" value={form.website} onChange={(v) => setForm({ ...form, website: v })} />
                <Field label="Industry" value={form.industry} onChange={(v) => setForm({ ...form, industry: v })} />
                <Field label="Macro category" value={form.macro_category} onChange={(v) => setForm({ ...form, macro_category: v })} />
                <Field label="LinkedIn URL" value={form.linkedin_url} onChange={(v) => setForm({ ...form, linkedin_url: v })} />
                <Field label="Source" value={form.source} onChange={(v) => setForm({ ...form, source: v })} />
                <SelectField
                  label="Stage"
                  value={form.pipeline_stage || 'new'}
                  options={Object.entries(STAGE_LABELS).map(([k, v]) => ({ value: k, label: v }))}
                  onChange={(v) => setForm({ ...form, pipeline_stage: v })}
                />
                <SelectField
                  label="ICP Score"
                  value={String(form.icp_score || 2)}
                  options={[
                    { value: '1', label: 'Tier 1 ⭐⭐⭐' },
                    { value: '2', label: 'Tier 2 ⭐⭐' },
                    { value: '3', label: 'Tier 3 ⭐' },
                  ]}
                  onChange={(v) => setForm({ ...form, icp_score: Number(v) })}
                />
              </div>
            )}
          </div>

          {/* Activity timeline */}
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
            <h2 className="text-lg font-bold mb-4">Activity Timeline</h2>
            <div className="space-y-3 mb-6">
              {(prospect.activities || []).length === 0 && (
                <p className="text-sm text-stone-500 py-4 text-center">
                  No activity yet — log your first touch below.
                </p>
              )}
              {(prospect.activities || [])
                .slice()
                .sort((a, b) => new Date(b.activity_date).getTime() - new Date(a.activity_date).getTime())
                .map((a) => (
                  <div key={a.id} className="flex gap-3 p-3 rounded-lg hover:bg-amber-50/50 border border-stone-100">
                    <div className="text-2xl shrink-0">{ACTIVITY_ICONS[a.activity_type] || '📌'}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold capitalize">{a.activity_type}</p>
                        <span className="text-xs text-stone-400">{fmtDateTime(a.activity_date)}</span>
                      </div>
                      {a.outcome && <p className="text-sm text-stone-600 mt-1">{a.outcome}</p>}
                    </div>
                  </div>
                ))}
            </div>

            <div className="border-t border-stone-200 pt-4">
              <p className="text-sm font-semibold text-stone-700 mb-3 flex items-center gap-2">
                <Plus className="w-4 h-4" /> Log Activity
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                <select
                  value={actType}
                  onChange={(e) => setActType(e.target.value)}
                  className="px-3 py-2 border border-stone-200 rounded-md text-sm bg-white"
                >
                  <option value="email">📧 Email</option>
                  <option value="call">📞 Call</option>
                  <option value="note">📝 Note</option>
                  <option value="linkedin">💼 LinkedIn</option>
                  <option value="demo">🎬 Demo</option>
                </select>
                <input
                  type="datetime-local"
                  value={actDate}
                  onChange={(e) => setActDate(e.target.value)}
                  className="px-3 py-2 border border-stone-200 rounded-md text-sm sm:col-span-2"
                />
              </div>
              <textarea
                value={actOutcome}
                onChange={(e) => setActOutcome(e.target.value)}
                placeholder="What happened? Outcome / next steps..."
                rows={3}
                className="w-full px-3 py-2 border border-stone-200 rounded-md text-sm mb-2"
              />
              <button
                onClick={logActivity}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-sm font-semibold"
              >
                Log Activity
              </button>
            </div>
          </div>

          {/* Quotes */}
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-600" /> Quotes
              </h2>
              <button
                onClick={() => setShowQuote(!showQuote)}
                className="text-sm font-semibold text-amber-600 hover:text-amber-700 inline-flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add Quote
              </button>
            </div>

            {showQuote && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 space-y-2">
                <input
                  value={qTitle}
                  onChange={(e) => setQTitle(e.target.value)}
                  placeholder="Quote title"
                  className="w-full px-3 py-2 border border-stone-200 rounded-md text-sm bg-white"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={qAmount}
                    onChange={(e) => setQAmount(e.target.value)}
                    placeholder="Amount (€)"
                    className="px-3 py-2 border border-stone-200 rounded-md text-sm bg-white"
                  />
                  <input
                    type="date"
                    value={qExpiry}
                    onChange={(e) => setQExpiry(e.target.value)}
                    className="px-3 py-2 border border-stone-200 rounded-md text-sm bg-white"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={addQuote}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-sm font-semibold"
                  >
                    Save Quote
                  </button>
                  <button
                    onClick={() => setShowQuote(false)}
                    className="px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-md text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {(prospect.quotes || []).length === 0 && (
                <p className="text-sm text-stone-500 py-3 text-center">No quotes for this prospect yet.</p>
              )}
              {(prospect.quotes || []).map((q) => (
                <div
                  key={q.id}
                  className="flex items-center justify-between p-3 border border-stone-100 rounded-lg hover:bg-amber-50/50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{q.title || `Quote #${q.id}`}</p>
                    <p className="text-xs text-stone-500">
                      Expires {fmtDate(q.expiry_date || q.valid_until)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-bold">{fmtEur(q.amount)}</span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        QUOTE_STATUS_CLS[q.status] || 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {q.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
            <h3 className="font-bold mb-3">Contact</h3>
            <div className="space-y-3 text-sm">
              <ContactRow icon={Mail} label={prospect.email} href={prospect.email ? `mailto:${prospect.email}` : undefined} />
              <ContactRow icon={Phone} label={prospect.phone} href={prospect.phone ? `tel:${prospect.phone}` : undefined} />
              <ContactRow icon={Globe} label={prospect.website} href={prospect.website} />
              <ContactRow icon={Linkedin} label={prospect.linkedin_url} href={prospect.linkedin_url} />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
            <h3 className="font-bold mb-3">Details</h3>
            <dl className="space-y-2 text-sm">
              <DetailRow label="Industry" value={prospect.industry} />
              <DetailRow label="Category" value={prospect.macro_category} />
              <DetailRow label="Source" value={prospect.source} />
            </dl>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-amber-600" /> Notes
            </h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
              placeholder="Internal notes about this prospect..."
              className="w-full px-3 py-2 border border-stone-200 rounded-md text-sm resize-none"
            />
            <button
              onClick={saveNotes}
              disabled={savingNotes}
              className="mt-2 w-full px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white rounded-md text-sm font-semibold"
            >
              {savingNotes ? 'Saving…' : 'Save Notes'}
            </button>
          </div>

          <Link
            to="/demos"
            className="flex items-center gap-2 w-full p-4 bg-white rounded-xl border border-stone-200 hover:border-amber-300 text-sm font-semibold"
          >
            <Monitor className="w-4 h-4 text-amber-600" /> Open Demo Tracker
          </Link>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-stone-600 mb-1">{label}</label>
      <input
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-stone-200 rounded-md text-sm"
      />
    </div>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-stone-600 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-stone-200 rounded-md text-sm bg-white"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function ContactRow({ icon: Icon, label, href }: { icon: any; label?: string; href?: string }) {
  if (!label) {
    return (
      <div className="flex items-center gap-3 text-stone-400">
        <Icon className="w-4 h-4 shrink-0" />
        <span>—</span>
      </div>
    )
  }
  return (
    <a
      href={href}
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel="noreferrer"
      className="flex items-center gap-3 text-stone-700 hover:text-amber-700 transition-colors min-w-0"
    >
      <Icon className="w-4 h-4 shrink-0 text-amber-600" />
      <span className="truncate">{label}</span>
    </a>
  )
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-stone-500">{label}</dt>
      <dd className="font-medium text-right truncate">{value || '—'}</dd>
    </div>
  )
}
