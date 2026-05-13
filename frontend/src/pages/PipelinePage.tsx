import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { apiClient } from '@/services/api'
import { Plus } from 'lucide-react'

const STAGES = ['new', 'contacted', 'call', 'demo', 'proposal', 'won', 'lost']
const STAGE_LABELS: Record<string, string> = { new: 'New', contacted: 'Contacted', call: 'Call Scheduled', demo: 'Demo', proposal: 'Proposal', won: 'Won', lost: 'Lost' }
const STAGE_HEADER: Record<string, string> = { new: 'bg-stone-200 text-stone-800', contacted: 'bg-blue-200 text-blue-800', call: 'bg-indigo-200 text-indigo-800', demo: 'bg-purple-200 text-purple-800', proposal: 'bg-amber-200 text-amber-800', won: 'bg-green-200 text-green-800', lost: 'bg-red-200 text-red-800' }
const ICP_COLORS: Record<number, string> = { 1: 'bg-green-100 text-green-700', 2: 'bg-amber-100 text-amber-700', 3: 'bg-red-100 text-red-700' }
const ICP_LABELS: Record<number, string> = { 1: 'T1 ⭐⭐⭐', 2: 'T2 ⭐⭐', 3: 'T3 ⭐' }

function relativeTime(dateStr: string) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return '1d ago'
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

const EMPTY_FORM = { first_name: '', last_name: '', email: '', phone: '', company: '', website: '', industry: '', macro_category: '', linkedin_url: '', source: 'other', icp_score: 2, pipeline_stage: 'new', notes: '' }

export default function PipelinePage() {
  const [prospects, setProspects] = useState<any[]>([])
  const [grouped, setGrouped] = useState<Record<string, any[]>>({})
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    apiClient.get<any[]>('/prospects').then(data => {
      setProspects(data)
      regroupProspects(data)
    }).catch(() => toast.error('Failed to load prospects'))
  }, [])

  function regroupProspects(list: any[]) {
    const g: Record<string, any[]> = {}
    STAGES.forEach(s => g[s] = [])
    list.forEach(p => { const s = p.pipeline_stage || 'new'; if (g[s]) g[s].push(p) })
    setGrouped(g)
  }

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result
    if (!destination || destination.droppableId === source.droppableId) return
    const newStage = destination.droppableId
    const id = parseInt(draggableId)
    const updated = prospects.map(p => p.id === id ? { ...p, pipeline_stage: newStage, updated_at: new Date().toISOString() } : p)
    setProspects(updated)
    regroupProspects(updated)
    try {
      await apiClient.patch(`/prospects/${id}/stage`, { pipeline_stage: newStage })
    } catch {
      toast.error('Failed to update stage')
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const created = await apiClient.post('/prospects', form)
      const updated = [...prospects, created]
      setProspects(updated)
      regroupProspects(updated)
      setShowModal(false)
      setForm({ ...EMPTY_FORM })
      toast.success('Prospect added!')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const f = (k: string) => (e: any) => setForm(prev => ({ ...prev, [k]: e.target.value }))

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {/* Fixed header bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-amber-50 border-b border-stone-200 z-10 flex-shrink-0">
        <h1 className="text-2xl font-bold text-stone-800">Pipeline</h1>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} /> New Prospect
        </button>
      </div>

      {/* Scrollable pipeline area - both x and y scroll here */}
      <div className="flex-1 overflow-auto">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-3 p-6 h-full" style={{ minWidth: `${STAGES.length * 296}px` }}>
            {STAGES.map(stage => (
              <div key={stage} className="flex-shrink-0 w-72 flex flex-col rounded-xl overflow-hidden border border-stone-200 shadow-sm h-full">
                <div className={`px-3 py-2.5 flex items-center justify-between flex-shrink-0 ${STAGE_HEADER[stage]}`}>
                  <span className="font-semibold text-sm">{STAGE_LABELS[stage]}</span>
                  <span className="text-xs font-bold bg-white/50 px-2 py-0.5 rounded-full">{grouped[stage]?.length || 0}</span>
                </div>
                <Droppable droppableId={stage}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 p-2 space-y-2 overflow-y-auto transition-colors ${snapshot.isDraggingOver ? 'bg-amber-50' : 'bg-stone-50/50'}`}
                    >
                      {(grouped[stage] || []).map((p, index) => (
                        <Draggable key={p.id} draggableId={String(p.id)} index={index}>
                          {(prov, snap) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              onClick={() => !snap.isDragging && navigate(`/prospects/${p.id}`)}
                              className={`bg-white rounded-lg border border-stone-200 p-3 cursor-pointer hover:shadow-md transition-shadow ${snap.isDragging ? 'shadow-lg rotate-1' : ''}`}
                            >
                              <div className="flex items-start justify-between gap-1">
                                <span className="font-semibold text-stone-800 text-sm leading-tight">{p.first_name} {p.last_name}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${ICP_COLORS[p.icp_score]}`}>{ICP_LABELS[p.icp_score]}</span>
                              </div>
                              {p.company && <p className="text-stone-500 text-xs mt-0.5">{p.company}</p>}
                              <p className="text-stone-400 text-xs mt-1.5">{relativeTime(p.updated_at)}</p>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Prospect</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
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
                  <option value={1}>Tier 1 ⭐⭐⭐</option><option value={2}>Tier 2 ⭐⭐</option><option value={3}>Tier 3 ⭐</option>
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
                {saving ? 'Saving...' : 'Add Prospect'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
