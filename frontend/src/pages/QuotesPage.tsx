import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { api } from '@/services/api'
import { Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react'

const STATUS_COLORS: Record<string,string> = { draft:'bg-stone-100 text-stone-600', sent:'bg-blue-100 text-blue-700', viewed:'bg-indigo-100 text-indigo-700', accepted:'bg-green-100 text-green-700', rejected:'bg-red-100 text-red-700' }
const STATUS_LABELS: Record<string,string> = { draft:'Draft', sent:'Sent', viewed:'Viewed', accepted:'Accepted', rejected:'Rejected' }

const EMPTY_FORM = { prospect_id:'', title:'', service_description:'', amount:'', currency:'€', status:'draft', send_date:'', expiry_date:'' }

function fmtAmount(v: any) { if (!v) return '-'; return `€ ${parseFloat(v).toLocaleString('en', {minimumFractionDigits:2})}` }

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<any[]>([])
  const [prospects, setProspects] = useState<any[]>([])
  const [filterStatus, setFilterStatus] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<any>(null)
  const [form, setForm] = useState({...EMPTY_FORM})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api('/quotes').then(setQuotes).catch(() => toast.error('Failed to load quotes'))
    api('/prospects').then(setProspects).catch(() => {})
  }, [])

  const isExpiredWarning = (q: any) => q.status === 'sent' && q.expiry_date && new Date(q.expiry_date) < new Date()

  const filtered = filterStatus === 'all' ? quotes : quotes.filter(q => q.status === filterStatus)

  const openCreate = () => { setEditTarget(null); setForm({...EMPTY_FORM}); setShowModal(true) }
  const openEdit = (q: any) => {
    setEditTarget(q)
    setForm({ prospect_id: q.prospect_id, title: q.title, service_description: q.service_description||'', amount: q.amount||'', currency: q.currency||'€', status: q.status, send_date: q.send_date ? q.send_date.slice(0,10) : '', expiry_date: q.expiry_date ? q.expiry_date.slice(0,10) : '' })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try {
      const payload = { ...form, prospect_id: parseInt(form.prospect_id as any), amount: form.amount ? parseFloat(form.amount as any) : null }
      if (editTarget) {
        const updated = await api(`/quotes/${editTarget.id}`, { method:'PUT', body:JSON.stringify(payload) })
        setQuotes(prev => prev.map(q => q.id === editTarget.id ? updated : q))
        toast.success('Quote updated!')
      } else {
        const created = await api('/quotes', { method:'POST', body:JSON.stringify(payload) })
        setQuotes(prev => [created, ...prev])
        toast.success('Quote created!')
      }
      setShowModal(false)
    } catch (err:any) { toast.error(err.message) } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this quote?')) return
    try {
      await api(`/quotes/${id}`, { method:'DELETE' })
      setQuotes(prev => prev.filter(q => q.id !== id))
      toast.success('Deleted')
    } catch (err:any) { toast.error(err.message) }
  }

  const updateStatus = async (id: number, status: string) => {
    try {
      await api(`/quotes/${id}`, { method:'PATCH', body:JSON.stringify({ status }) })
      setQuotes(prev => prev.map(q => q.id === id ? {...q, status} : q))
    } catch { toast.error('Failed') }
  }

  const f = (k:string) => (e:any) => setForm(prev => ({...prev, [k]:e.target.value}))

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-stone-800">Quotes</h1>
        <div className="flex gap-1 bg-stone-100 rounded-lg p-1">
          {['all','draft','sent','viewed','accepted','rejected'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${filterStatus === s ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}>
              {s === 'all' ? 'All' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button onClick={openCreate} className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus size={14} /> New Quote
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr>
              {['Title','Prospect','Amount','Status','Send Date','Expiry Date','Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filtered.map(q => {
              const warn = isExpiredWarning(q)
              const p = prospects.find(x => x.id === q.prospect_id)
              return (
                <tr key={q.id} className={warn ? 'bg-amber-50 border-l-4 border-amber-400' : 'hover:bg-stone-50'}>
                  <td className="px-4 py-3 font-medium text-stone-800">{q.title}</td>
                  <td className="px-4 py-3 text-stone-600">{p ? `${p.first_name} ${p.last_name}` : '-'}</td>
                  <td className="px-4 py-3 font-medium text-stone-800">{fmtAmount(q.amount)}</td>
                  <td className="px-4 py-3">
                    <select value={q.status} onChange={e => updateStatus(q.id, e.target.value)} className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${STATUS_COLORS[q.status]}`}>
                      {Object.entries(STATUS_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-stone-500">{q.send_date ? new Date(q.send_date).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {warn && <AlertTriangle size={14} className="text-amber-500" />}
                      <span className={warn ? 'text-amber-700 font-medium' : 'text-stone-500'}>
                        {q.expiry_date ? new Date(q.expiry_date).toLocaleDateString() : '-'}
                      </span>
                      {warn && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Expired</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(q)} className="p-1.5 hover:bg-stone-100 rounded text-stone-500"><Pencil size={14} /></button>
                      <button onClick={() => handleDelete(q.id)} className="p-1.5 hover:bg-red-50 rounded text-stone-500 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-stone-400">No quotes found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editTarget ? 'Edit Quote' : 'New Quote'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-stone-600">Prospect *</label>
              <select required value={form.prospect_id} onChange={f('prospect_id')} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mt-1">
                <option value="">Select prospect...</option>
                {prospects.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}{p.company ? ` — ${p.company}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600">Title *</label>
              <input required value={form.title} onChange={f('title')} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mt-1" placeholder="e.g. Web App Development" />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600">Service Description</label>
              <textarea value={form.service_description} onChange={f('service_description')} rows={3} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mt-1 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-stone-600">Amount (€)</label>
                <input type="number" step="0.01" value={form.amount} onChange={f('amount')} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mt-1" placeholder="0.00" />
              </div>
              <div>
                <label className="text-xs font-medium text-stone-600">Status</label>
                <select value={form.status} onChange={f('status')} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mt-1">
                  {Object.entries(STATUS_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-stone-600">Send Date</label>
                <input type="date" value={form.send_date} onChange={f('send_date')} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-stone-600">Expiry Date</label>
                <input type="date" value={form.expiry_date} onChange={f('expiry_date')} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-sm">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? 'Saving...' : editTarget ? 'Save' : 'Create Quote'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
