import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { api } from '@/services/api'
import { Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react'

const STATUS_COLORS: Record<string,string> = { queued:'bg-stone-100 text-stone-600', in_build:'bg-blue-100 text-blue-700', delivered:'bg-green-100 text-green-700' }
const STATUS_LABELS: Record<string,string> = { queued:'Queued', in_build:'In Build', delivered:'Delivered' }
const DEMO_TYPE_LABELS: Record<string,string> = { landing_page:'Landing Page', web_app:'Web App', e_commerce:'E-commerce', other:'Other' }

const EMPTY_FORM = { prospect_id:'', demo_type:'web_app', brief:'', status:'queued', deadline:'' }

export default function DemoTrackerPage() {
  const [demos, setDemos] = useState<any[]>([])
  const [prospects, setProspects] = useState<any[]>([])
  const [filterStatus, setFilterStatus] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<any>(null)
  const [form, setForm] = useState({...EMPTY_FORM})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api('/demos').then(setDemos).catch(() => toast.error('Failed to load demos'))
    api('/prospects').then(setProspects).catch(() => {})
  }, [])

  const isOverdue = (d: any) => d.deadline && new Date(d.deadline) < new Date() && d.status !== 'delivered'

  const filtered = filterStatus === 'all' ? demos : demos.filter(d => d.status === filterStatus)

  const openCreate = () => { setEditTarget(null); setForm({...EMPTY_FORM}); setShowModal(true) }
  const openEdit = (d: any) => {
    setEditTarget(d)
    setForm({ prospect_id: d.prospect_id, demo_type: d.demo_type, brief: d.brief||'', status: d.status, deadline: d.deadline ? d.deadline.slice(0,10) : '' })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try {
      const payload = { ...form, prospect_id: parseInt(form.prospect_id as any) }
      if (editTarget) {
        const updated = await api(`/demos/${editTarget.id}`, { method:'PUT', body:JSON.stringify(payload) })
        setDemos(prev => prev.map(d => d.id === editTarget.id ? updated : d))
        toast.success('Demo updated!')
      } else {
        const created = await api('/demos', { method:'POST', body:JSON.stringify(payload) })
        setDemos(prev => [created, ...prev])
        toast.success('Demo created!')
      }
      setShowModal(false)
    } catch (err:any) { toast.error(err.message) } finally { setSaving(false) }
  }

  const updateStatus = async (id: number, status: string) => {
    try {
      const updated = await api(`/demos/${id}`, { method:'PATCH', body:JSON.stringify({ status }) })
      setDemos(prev => prev.map(d => d.id === id ? {...d, status} : d))
      toast.success('Status updated')
    } catch { toast.error('Failed') }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this demo?')) return
    try {
      await api(`/demos/${id}`, { method:'DELETE' })
      setDemos(prev => prev.filter(d => d.id !== id))
      toast.success('Deleted')
    } catch (err:any) { toast.error(err.message) }
  }

  const f = (k:string) => (e:any) => setForm(prev => ({...prev, [k]:e.target.value}))

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-stone-800">Demo Tracker</h1>
        <div className="flex gap-1 bg-stone-100 rounded-lg p-1">
          {['all','queued','in_build','delivered'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${filterStatus === s ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}>
              {s === 'all' ? 'All' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button onClick={openCreate} className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus size={14} /> New Demo
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr>
              {['Prospect','Type','Brief','Status','Deadline','Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filtered.map(d => {
              const overdue = isOverdue(d)
              const p = prospects.find(x => x.id === d.prospect_id)
              return (
                <tr key={d.id} className={overdue ? 'bg-red-50 border-l-4 border-red-400' : 'hover:bg-stone-50'}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-stone-800">{p ? `${p.first_name} ${p.last_name}` : `Prospect #${d.prospect_id}`}</div>
                    {p?.company && <div className="text-xs text-stone-500">{p.company}</div>}
                  </td>
                  <td className="px-4 py-3 text-stone-600">{DEMO_TYPE_LABELS[d.demo_type] || d.demo_type}</td>
                  <td className="px-4 py-3 text-stone-600 max-w-xs truncate">{d.brief || '-'}</td>
                  <td className="px-4 py-3">
                    <select value={d.status} onChange={e => updateStatus(d.id, e.target.value)} className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${STATUS_COLORS[d.status]}`}>
                      {Object.entries(STATUS_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    <div className="flex items-center gap-1.5">
                      {overdue && <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />}
                      <span className={overdue ? 'text-red-600 font-medium' : ''}>
                        {d.deadline ? new Date(d.deadline).toLocaleDateString() : '-'}
                      </span>
                      {overdue && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">Overdue</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(d)} className="p-1.5 hover:bg-stone-100 rounded text-stone-500"><Pencil size={14} /></button>
                      <button onClick={() => handleDelete(d.id)} className="p-1.5 hover:bg-red-50 rounded text-stone-500 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-stone-400">No demos found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editTarget ? 'Edit Demo' : 'New Demo'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-stone-600">Prospect *</label>
              <select required value={form.prospect_id} onChange={f('prospect_id')} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mt-1">
                <option value="">Select prospect...</option>
                {prospects.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}{p.company ? ` — ${p.company}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600">Demo Type</label>
              <select value={form.demo_type} onChange={f('demo_type')} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mt-1">
                {Object.entries(DEMO_TYPE_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600">Brief</label>
              <textarea value={form.brief} onChange={f('brief')} rows={3} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mt-1 resize-none" placeholder="Describe what needs to be built..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-stone-600">Status</label>
                <select value={form.status} onChange={f('status')} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mt-1">
                  {Object.entries(STATUS_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-stone-600">Deadline</label>
                <input type="date" value={form.deadline} onChange={f('deadline')} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-sm">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? 'Saving...' : editTarget ? 'Save' : 'Create Demo'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
