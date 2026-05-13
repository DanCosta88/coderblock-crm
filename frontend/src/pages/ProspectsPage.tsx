import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { api } from '@/services/api'
import { Search, Plus, Download, Pencil, Trash2 } from 'lucide-react'

const STAGES = ['new','contacted','call','demo','proposal','won','lost']
const STAGE_LABELS: Record<string,string> = { new:'New', contacted:'Contacted', call:'Call Scheduled', demo:'Demo', proposal:'Proposal', won:'Won', lost:'Lost' }
const STAGE_COLORS: Record<string,string> = { new:'bg-stone-100 text-stone-700', contacted:'bg-blue-100 text-blue-700', call:'bg-indigo-100 text-indigo-700', demo:'bg-purple-100 text-purple-700', proposal:'bg-amber-100 text-amber-700', won:'bg-green-100 text-green-700', lost:'bg-red-100 text-red-700' }
const ICP_COLORS: Record<number,string> = { 1:'bg-green-100 text-green-700', 2:'bg-amber-100 text-amber-700', 3:'bg-red-100 text-red-700' }
const ICP_LABELS: Record<number,string> = { 1:'Tier 1 \u2b50\u2b50\u2b50', 2:'Tier 2 \u2b50\u2b50', 3:'Tier 3 \u2b50' }

const EMPTY_FORM = { first_name:'', last_name:'', email:'', phone:'', company:'', website:'', industry:'', macro_category:'', linkedin_url:'', source:'other', icp_score:2, pipeline_stage:'new', notes:'' }

export default function ProspectsPage() {
  const [prospects, setProspects] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filterStage, setFilterStage] = useState('')
  const [filterIcp, setFilterIcp] = useState('')
  const [sortBy, setSortBy] = useState('updated_at')
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<any>(null)
  const [form, setForm] = useState({...EMPTY_FORM})
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (filterStage) params.set('stage', filterStage)
      if (filterIcp) params.set('icp_score', filterIcp)
      const data = await api(`/prospects?${params}`)
      let sorted = [...data]
      if (sortBy === 'icp_score') sorted.sort((a,b) => a.icp_score - b.icp_score)
      else if (sortBy === 'company') sorted.sort((a,b) => (a.company||'').localeCompare(b.company||''))
      else sorted.sort((a,b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      setProspects(sorted)
    } catch { toast.error('Failed to load') }
  }, [search, filterStage, filterIcp, sortBy])

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t) }, [load])

  const openCreate = () => { setEditTarget(null); setForm({...EMPTY_FORM}); setShowModal(true) }
  const openEdit = (p: any) => { setEditTarget(p); setForm({ first_name:p.first_name, last_name:p.last_name, email:p.email||'', phone:p.phone||'', company:p.company||'', website:p.website||'', industry:p.industry||'', macro_category:p.macro_category||'', linkedin_url:p.linkedin_url||'', source:p.source||'other', icp_score:p.icp_score||2, pipeline_stage:p.pipeline_stage||'new', notes:p.notes||'' }); setShowModal(true) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try {
      if (editTarget) {
        const updated = await api(`/prospects/${editTarget.id}`, { method:'PUT', body:JSON.stringify(form) })
        setProspects(prev => prev.map(p => p.id === editTarget.id ? updated : p))
        toast.success('Prospect updated!')
      } else {
        const created = await api('/prospects', { method:'POST', body:JSON.stringify(form) })
        setProspects(prev => [created, ...prev])
        toast.success('Prospect added!')
      }
      setShowModal(false)
    } catch (err:any) { toast.error(err.message) } finally { setSaving(false) }
  }

  const handleDelete = async (p: any) => {
    if (!confirm(`Delete ${p.first_name} ${p.last_name}?`)) return
    try {
      await api(`/prospects/${p.id}`, { method:'DELETE' })
      setProspects(prev => prev.filter(x => x.id !== p.id))
      toast.success('Deleted')
    } catch (err:any) { toast.error(err.message) }
  }

  const exportCsv = async () => {
    const token = localStorage.getItem('crm_token')
    const res = await fetch('/api/prospects/export/csv', { headers:{ Authorization:`Bearer ${token}` } })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download='prospects.csv'; a.click()
  }

  const f = (k:string) => (e:any) => setForm(prev => ({...prev, [k]:e.target.value}))

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-stone-800 mr-2">Prospects</h1>
        <span className="bg-stone-100 text-stone-600 text-sm px-2.5 py-0.5 rounded-full font-medium">{prospects.length}</span>
        <div className="flex-1" />
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="pl-8 pr-3 py-2 border border-stone-300 rounded-lg text-sm w-48 focus:outline-none focus:ring-2 focus:ring-amber-500" />
        </div>
        <select value={filterStage} onChange={e => setFilterStage(e.target.value)} className="border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
          <option value="">All Stages</option>
          {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
        </select>
        <select value={filterIcp} onChange={e => setFilterIcp(e.target.value)} className="border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
          <option value="">All ICP</option>
          <option value="1">Tier 1</option><option value="2">Tier 2</option><option value="3">Tier 3</option>
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
          <option value="updated_at">Last Updated</option>
          <option value="icp_score">ICP Score</option>
          <option value="company">Company</option>
        </select>
        <button onClick={exportCsv} className="flex items-center gap-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-2 rounded-lg text-sm font-medium">
          <Download size={14} /> Export
        </button>
        <button onClick={openCreate} className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus size={14} /> Add Prospect
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr>
              {['Name','Company','Stage','ICP','Industry','Source','Last Updated','Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {prospects.map(p => (
              <tr key={p.id} className="hover:bg-stone-50 cursor-pointer transition-colors" onClick={() => navigate(`/prospects/${p.id}`)}>
                <td className="px-4 py-3 font-medium text-stone-800">{p.first_name} {p.last_name}</td>
                <td className="px-4 py-3 text-stone-600">{p.company || '-'}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[p.pipeline_stage]}`}>{STAGE_LABELS[p.pipeline_stage]}</span></td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ICP_COLORS[p.icp_score]}`}>{ICP_LABELS[p.icp_score]}</span></td>
                <td className="px-4 py-3 text-stone-600">{p.industry || '-'}</td>
                <td className="px-4 py-3 text-stone-600 capitalize">{p.source || '-'}</td>
                <td className="px-4 py-3 text-stone-500">{new Date(p.updated_at).toLocaleDateString()}</td>
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-stone-100 rounded text-stone-500 hover:text-stone-700"><Pencil size={14} /></button>
                    <button onClick={() => handleDelete(p)} className="p-1.5 hover:bg-red-50 rounded text-stone-500 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {prospects.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-stone-400">No prospects found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editTarget ? 'Edit Prospect' : 'New Prospect'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium text-stone-600">First Name *</label><input required value={form.first_name} onChange={f('first_name')} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mt-1" /></div>
              <div><label className="text-xs font-medium text-stone-600">Last Name *</label><input required value={form.last_name} onChange={f('last_name')} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mt-1" /></div>
              <div><label className="text-xs font-medium text-stone-600">Email</label><input type="email" value={form.email} onChange={f('email')} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mt-1" /></div>
              <div><label className="text-xs font-medium text-stone-600">Phone</label><input value={form.phone} onChange={f('phone')} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mt-1" /></div>
              <div><label className="text-xs font-medium text-stone-600">Company</label><input value={form.company} onChange={f('company')} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mt-1" /></div>
              <div><label className="text-xs font-medium text-stone-600">Website</label><input value={form.website} onChange={f('website')} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mt-1" /></div>
              <div><label className="text-xs font-medium text-stone-600">Industry</label><input value={form.industry} onChange={f('industry')} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mt-1" /></div>
              <div><label className="text-xs font-medium text-stone-600">Macro Category</label><input value={form.macro_category} onChange={f('macro_category')} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mt-1" /></div>
              <div className="col-span-2"><label className="text-xs font-medium text-stone-600">LinkedIn URL</label><input value={form.linkedin_url} onChange={f('linkedin_url')} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mt-1" /></div>
              <div>
                <label className="text-xs font-medium text-stone-600">Source</label>
                <select value={form.source} onChange={f('source')} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mt-1">
                  {['apollo','referral','event','inbound','other'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-stone-600">ICP Score</label>
                <select value={form.icp_score} onChange={e => setForm(prev => ({...prev, icp_score: parseInt(e.target.value)}))} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mt-1">
                  <option value={1}>Tier 1 (High Potential)</option>
                  <option value={2}>Tier 2 (Medium)</option>
                  <option value={3}>Tier 3 (Low)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-stone-600">Stage</label>
                <select value={form.pipeline_stage} onChange={f('pipeline_stage')} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mt-1">
                  {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                </select>
              </div>
            </div>
            <div><label className="text-xs font-medium text-stone-600">Notes</label><textarea value={form.notes} onChange={f('notes')} rows={3} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mt-1 resize-none" /></div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-sm">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? 'Saving...' : editTarget ? 'Save Changes' : 'Add Prospect'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
