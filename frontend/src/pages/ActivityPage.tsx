import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { api } from '@/services/api'
import { Plus } from 'lucide-react'

const TYPE_LABELS: Record<string,string> = { email:'Email', call:'Call', note:'Note', linkedin:'LinkedIn', demo:'Demo' }
const TYPE_ICONS: Record<string,string> = { email:'✉️', call:'📞', note:'📝', linkedin:'💼', demo:'🎬' }
const TYPE_COLORS: Record<string,string> = { email:'bg-blue-100', call:'bg-green-100', note:'bg-amber-100', linkedin:'bg-indigo-100', demo:'bg-purple-100' }

const EMPTY_FORM = { prospect_id:'', activity_type:'note', outcome:'', activity_date: new Date().toISOString().slice(0,16) }

export default function ActivityPage() {
  const [activities, setActivities] = useState<any[]>([])
  const [prospects, setProspects] = useState<any[]>([])
  const [filterType, setFilterType] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({...EMPTY_FORM})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api('/activities').then(setActivities).catch(() => toast.error('Failed to load'))
    api('/prospects').then(setProspects).catch(() => {})
  }, [])

  const filtered = filterType === 'all' ? activities : activities.filter(a => a.activity_type === filterType)
  const sorted = [...filtered].sort((a,b) => new Date(b.activity_date).getTime() - new Date(a.activity_date).getTime())

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try {
      const payload = { ...form, prospect_id: parseInt(form.prospect_id as any) }
      const created = await api('/activities', { method:'POST', body:JSON.stringify(payload) })
      setActivities(prev => [created, ...prev])
      setShowModal(false)
      setForm({...EMPTY_FORM, activity_date: new Date().toISOString().slice(0,16)})
      toast.success('Activity logged!')
    } catch (err:any) { toast.error(err.message) } finally { setSaving(false) }
  }

  const f = (k:string) => (e:any) => setForm(prev => ({...prev, [k]:e.target.value}))

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-stone-800">Activity Feed</h1>
        <div className="flex gap-1 bg-stone-100 rounded-lg p-1 flex-wrap">
          {['all','email','call','note','linkedin','demo'].map(t => (
            <button key={t} onClick={() => setFilterType(t)} className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${filterType === t ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}>
              {t === 'all' ? 'All' : `${TYPE_ICONS[t]} ${TYPE_LABELS[t]}`}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus size={14} /> Log Activity
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-stone-200 divide-y divide-stone-100">
        {sorted.map(a => {
          const p = prospects.find(x => x.id === a.prospect_id)
          return (
            <div key={a.id} className="p-4 flex gap-3 hover:bg-stone-50 transition-colors">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-base ${TYPE_COLORS[a.activity_type]}`}>
                {TYPE_ICONS[a.activity_type]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {p ? (
                    <Link to={`/prospects/${p.id}`} className="font-semibold text-stone-800 hover:text-amber-600 transition-colors">
                      {p.first_name} {p.last_name}
                    </Link>
                  ) : (
                    <span className="font-semibold text-stone-600">Unknown Prospect</span>
                  )}
                  {p?.company && <span className="text-stone-400 text-sm">{p.company}</span>}
                  <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full font-medium">{TYPE_LABELS[a.activity_type]}</span>
                </div>
                {a.outcome && <p className="text-stone-700 text-sm mt-1">{a.outcome}</p>}
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-xs text-stone-400">{new Date(a.activity_date).toLocaleDateString()}</div>
                <div className="text-xs text-stone-400">{new Date(a.activity_date).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>
                <div className="text-xs text-stone-400 mt-0.5">{a.author}</div>
              </div>
            </div>
          )
        })}
        {sorted.length === 0 && (
          <div className="px-4 py-12 text-center text-stone-400">No activities yet</div>
        )}
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Log Activity</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-stone-600">Prospect *</label>
              <select required value={form.prospect_id} onChange={f('prospect_id')} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mt-1">
                <option value="">Select prospect...</option>
                {prospects.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}{p.company ? ` — ${p.company}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600">Activity Type</label>
              <select value={form.activity_type} onChange={f('activity_type')} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mt-1">
                {Object.entries(TYPE_LABELS).map(([v,l]) => <option key={v} value={v}>{TYPE_ICONS[v]} {l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600">Outcome / Notes</label>
              <textarea value={form.outcome} onChange={f('outcome')} rows={3} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mt-1 resize-none" placeholder="What happened? Any next steps?" />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600">Date & Time</label>
              <input type="datetime-local" value={form.activity_date} onChange={f('activity_date')} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-sm">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? 'Saving...' : 'Log Activity'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
