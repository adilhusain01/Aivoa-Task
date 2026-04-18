// components/FormPanel.jsx
import React, { useState, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Search, ChevronDown, Calendar, Clock, Users, FileText,
  Package, Smile, Meh, Frown, Mic, X, Plus, CheckCircle,
  AlertCircle, Loader2, RotateCcw, Sparkles
} from 'lucide-react'
import {
  updateField, setSentiment, addMaterial, removeMaterial,
  addSample, removeSample, submitInteractionForm,
  resetForm, clearMessages, fetchHCPs,
} from '../store/interactionSlice'

const INTERACTION_TYPES = ['Meeting', 'Call', 'Email', 'Conference', 'Webinar', 'Detail Visit']

export default function FormPanel() {
  const dispatch = useDispatch()
  const { form, hcps, status, error, successMessage, aiSuggestedFollowups } = useSelector(s => s.interaction)

  const [hcpQuery, setHcpQuery] = useState('')
  const [showHcpDropdown, setShowHcpDropdown] = useState(false)
  const [showTypeDropdown, setShowTypeDropdown] = useState(false)
  const [materialInput, setMaterialInput] = useState('')
  const [sampleInput, setSampleInput] = useState('')
  const hcpRef = useRef(null)

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = e => {
      if (hcpRef.current && !hcpRef.current.contains(e.target)) {
        setShowHcpDropdown(false)
        setShowTypeDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    dispatch(fetchHCPs(hcpQuery))
  }, [hcpQuery, dispatch])

  const handleFieldChange = (field, value) => dispatch(updateField({ field, value }))

  const handleSubmit = async e => {
    e.preventDefault()
    dispatch(submitInteractionForm(form))
  }

  const handleAddFollowup = (suggestion) => {
    const current = form.follow_up_actions
    const updated = current ? `${current}\n• ${suggestion}` : `• ${suggestion}`
    handleFieldChange('follow_up_actions', updated)
  }

  return (
    <div style={styles.panel}>
      {/* Header */}
      <div style={styles.panelHeader}>
        <h2 style={styles.panelTitle}>Interaction Details</h2>
      </div>

      <form onSubmit={handleSubmit} style={styles.form}>
        {/* Row 1: HCP Name + Interaction Type */}
        <div style={styles.row}>
          {/* HCP Name */}
          <div style={{ ...styles.field, flex: 1 }} ref={hcpRef}>
            <label style={styles.label}>HCP Name</label>
            <div style={styles.searchWrap}>
              <Search size={14} style={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search or select HCP..."
                value={form.hcp_name || hcpQuery}
                onChange={e => {
                  setHcpQuery(e.target.value)
                  handleFieldChange('hcp_name', e.target.value)
                  setShowHcpDropdown(true)
                }}
                onFocus={() => setShowHcpDropdown(true)}
                style={{ ...styles.input, paddingLeft: 32 }}
                required
              />
              {showHcpDropdown && hcps.length > 0 && (
                <div style={styles.dropdown}>
                  {hcps.slice(0, 6).map(h => (
                    <div
                      key={h.id}
                      style={styles.dropdownItem}
                      onMouseDown={() => {
                        handleFieldChange('hcp_name', h.name)
                        setHcpQuery(h.name)
                        setShowHcpDropdown(false)
                      }}
                    >
                      <span style={styles.dropdownName}>{h.name}</span>
                      {h.specialty && <span style={styles.dropdownSub}>{h.specialty}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Interaction Type */}
          <div style={{ ...styles.field, width: 200 }}>
            <label style={styles.label}>Interaction Type</label>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowTypeDropdown(v => !v)}
                style={styles.selectBtn}
              >
                {form.interaction_type}
                <ChevronDown size={14} />
              </button>
              {showTypeDropdown && (
                <div style={styles.dropdown}>
                  {INTERACTION_TYPES.map(t => (
                    <div
                      key={t}
                      style={{
                        ...styles.dropdownItem,
                        background: form.interaction_type === t ? 'var(--blue-50)' : undefined,
                        color: form.interaction_type === t ? 'var(--blue-600)' : undefined,
                      }}
                      onMouseDown={() => {
                        handleFieldChange('interaction_type', t)
                        setShowTypeDropdown(false)
                      }}
                    >
                      {t}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Date + Time */}
        <div style={styles.row}>
          <div style={{ ...styles.field, flex: 1 }}>
            <label style={styles.label}><Calendar size={13} /> Date</label>
            <input
              type="date"
              value={form.interaction_date}
              onChange={e => handleFieldChange('interaction_date', e.target.value)}
              style={styles.input}
              required
            />
          </div>
          <div style={{ ...styles.field, flex: 1 }}>
            <label style={styles.label}><Clock size={13} /> Time</label>
            <input
              type="time"
              value={form.interaction_time}
              onChange={e => handleFieldChange('interaction_time', e.target.value)}
              style={styles.input}
            />
          </div>
        </div>

        {/* Attendees */}
        <div style={styles.field}>
          <label style={styles.label}><Users size={13} /> Attendees</label>
          <input
            type="text"
            placeholder="Enter names or search..."
            value={form.attendees}
            onChange={e => handleFieldChange('attendees', e.target.value)}
            style={styles.input}
          />
        </div>

        {/* Topics Discussed */}
        <div style={styles.field}>
          <label style={styles.label}><FileText size={13} /> Topics Discussed</label>
          <div style={{ position: 'relative' }}>
            <textarea
              placeholder="Enter key discussion points..."
              value={form.topics_discussed}
              onChange={e => handleFieldChange('topics_discussed', e.target.value)}
              style={{ ...styles.textarea, minHeight: 90 }}
            />
            <button type="button" style={styles.micBtn} title="Voice input">
              <Mic size={13} />
            </button>
          </div>
          <button type="button" style={styles.voiceBtn}>
            <Sparkles size={13} />
            Summarize from Voice Note (Requires Consent)
          </button>
        </div>

        {/* Materials & Samples */}
        <div style={styles.card}>
          {/* Materials */}
          <div style={styles.cardSection}>
            <div style={styles.cardRow}>
              <span style={styles.cardLabel}><Package size={13} /> Materials Shared</span>
              <button
                type="button"
                style={styles.addBtn}
                onClick={() => {
                  if (materialInput.trim()) {
                    dispatch(addMaterial(materialInput.trim()))
                    setMaterialInput('')
                  }
                }}
              >
                <Search size={12} /> Search/Add
              </button>
            </div>
            <input
              type="text"
              placeholder="Type material name and click Search/Add..."
              value={materialInput}
              onChange={e => setMaterialInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (materialInput.trim()) {
                    dispatch(addMaterial(materialInput.trim()))
                    setMaterialInput('')
                  }
                }
              }}
              style={{ ...styles.input, marginTop: 6, marginBottom: 4 }}
            />
            {form.materials_shared.length === 0 ? (
              <p style={styles.emptyLabel}>No materials added.</p>
            ) : (
              <div style={styles.tagList}>
                {form.materials_shared.map((m, i) => (
                  <span key={i} style={styles.tag}>
                    {m}
                    <button type="button" onClick={() => dispatch(removeMaterial(m))} style={styles.tagX}>
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={styles.divider} />

          {/* Samples */}
          <div style={styles.cardSection}>
            <div style={styles.cardRow}>
              <span style={styles.cardLabel}><Package size={13} /> Samples Distributed</span>
              <button
                type="button"
                style={styles.addBtn}
                onClick={() => {
                  if (sampleInput.trim()) {
                    dispatch(addSample(sampleInput.trim()))
                    setSampleInput('')
                  }
                }}
              >
                <Plus size={12} /> Add Sample
              </button>
            </div>
            <input
              type="text"
              placeholder="Type sample name and click Add Sample..."
              value={sampleInput}
              onChange={e => setSampleInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (sampleInput.trim()) {
                    dispatch(addSample(sampleInput.trim()))
                    setSampleInput('')
                  }
                }
              }}
              style={{ ...styles.input, marginTop: 6, marginBottom: 4 }}
            />
            {form.samples_distributed.length === 0 ? (
              <p style={styles.emptyLabel}>No samples added.</p>
            ) : (
              <div style={styles.tagList}>
                {form.samples_distributed.map((s, i) => (
                  <span key={i} style={{ ...styles.tag, background: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0' }}>
                    {s}
                    <button type="button" onClick={() => dispatch(removeSample(s))} style={styles.tagX}>
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sentiment */}
        <div style={styles.field}>
          <label style={styles.label}>Observed/Inferred HCP Sentiment</label>
          <div style={styles.sentimentRow}>
            {[
              { value: 'positive', Icon: Smile, color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
              { value: 'neutral',  Icon: Meh,   color: '#d97706', bg: '#fffbeb', border: '#fcd34d' },
              { value: 'negative', Icon: Frown,  color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
            ].map(({ value, Icon, color, bg, border }) => (
              <label
                key={value}
                style={{
                  ...styles.sentimentOption,
                  ...(form.sentiment === value ? { background: bg, borderColor: border, color } : {}),
                }}
              >
                <input
                  type="radio"
                  name="sentiment"
                  value={value}
                  checked={form.sentiment === value}
                  onChange={() => dispatch(setSentiment(value))}
                  style={{ display: 'none' }}
                />
                <Icon size={16} style={{ color: form.sentiment === value ? color : 'var(--gray-400)' }} />
                <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{value}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Outcomes */}
        <div style={styles.field}>
          <label style={styles.label}>Outcomes</label>
          <textarea
            placeholder="Key outcomes or agreements..."
            value={form.outcomes}
            onChange={e => handleFieldChange('outcomes', e.target.value)}
            style={{ ...styles.textarea, minHeight: 72 }}
          />
        </div>

        {/* Follow-up Actions */}
        <div style={styles.field}>
          <label style={styles.label}>Follow-up Actions</label>
          <textarea
            placeholder="Enter next steps or tasks..."
            value={form.follow_up_actions}
            onChange={e => handleFieldChange('follow_up_actions', e.target.value)}
            style={{ ...styles.textarea, minHeight: 72 }}
          />
        </div>

        {/* AI Suggested Follow-ups */}
        {aiSuggestedFollowups.length > 0 && (
          <div style={styles.aiSuggestions}>
            <p style={styles.aiLabel}><Sparkles size={13} /> AI Suggested Follow-ups:</p>
            {aiSuggestedFollowups.map((s, i) => (
              <button
                key={i}
                type="button"
                style={styles.suggestionItem}
                onClick={() => handleAddFollowup(s)}
              >
                <Plus size={12} style={{ color: 'var(--blue-600)' }} />
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Status messages */}
        {error && (
          <div style={styles.errorBox}>
            <AlertCircle size={15} /> {error}
          </div>
        )}
        {successMessage && (
          <div style={styles.successBox}>
            <CheckCircle size={15} /> {successMessage}
          </div>
        )}

        {/* Actions */}
        <div style={styles.formActions}>
          <button
            type="button"
            style={styles.secondaryBtn}
            onClick={() => { dispatch(resetForm()); dispatch(clearMessages()) }}
          >
            <RotateCcw size={14} /> Reset
          </button>
          <button
            type="submit"
            style={styles.primaryBtn}
            disabled={status === 'loading'}
          >
            {status === 'loading' ? (
              <><Loader2 size={14} className="animate-spin" style={{ animation: 'spin 0.8s linear infinite' }} /> Saving...</>
            ) : (
              <><CheckCircle size={14} /> Log Interaction</>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  panel: {
    flex: 1,
    overflowY: 'auto',
    background: '#fff',
    borderRight: '1px solid var(--gray-200)',
    display: 'flex',
    flexDirection: 'column',
  },
  panelHeader: {
    padding: '20px 24px 16px',
    borderBottom: '1px solid var(--gray-100)',
    position: 'sticky',
    top: 0,
    background: '#fff',
    zIndex: 10,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--gray-800)',
  },
  form: {
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  row: {
    display: 'flex',
    gap: 16,
    alignItems: 'flex-start',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--gray-600)',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    fontSize: 13,
    border: '1px solid var(--gray-200)',
    borderRadius: 'var(--radius-sm)',
    outline: 'none',
    fontFamily: 'var(--font)',
    color: 'var(--gray-800)',
    background: '#fff',
    transition: 'border 0.15s',
  },
  textarea: {
    width: '100%',
    padding: '8px 12px',
    fontSize: 13,
    border: '1px solid var(--gray-200)',
    borderRadius: 'var(--radius-sm)',
    outline: 'none',
    fontFamily: 'var(--font)',
    color: 'var(--gray-800)',
    resize: 'vertical',
    lineHeight: 1.5,
  },
  searchWrap: { position: 'relative' },
  searchIcon: {
    position: 'absolute', left: 10, top: '50%',
    transform: 'translateY(-50%)', color: 'var(--gray-400)', pointerEvents: 'none',
  },
  selectBtn: {
    width: '100%',
    padding: '8px 12px',
    fontSize: 13,
    border: '1px solid var(--gray-200)',
    borderRadius: 'var(--radius-sm)',
    background: '#fff',
    fontFamily: 'var(--font)',
    color: 'var(--gray-800)',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0, right: 0,
    background: '#fff',
    border: '1px solid var(--gray-200)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow-lg)',
    zIndex: 100,
    maxHeight: 200,
    overflowY: 'auto',
  },
  dropdownItem: {
    padding: '9px 14px',
    cursor: 'pointer',
    fontSize: 13,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    transition: 'background 0.1s',
  },
  dropdownName: { fontWeight: 500, color: 'var(--gray-800)' },
  dropdownSub: { fontSize: 11, color: 'var(--gray-400)' },
  micBtn: {
    position: 'absolute', bottom: 8, right: 8,
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--gray-400)', padding: 4,
  },
  voiceBtn: {
    marginTop: 8,
    padding: '7px 12px',
    border: '1px solid var(--gray-200)',
    borderRadius: 'var(--radius-sm)',
    background: '#fff',
    fontSize: 12,
    fontFamily: 'var(--font)',
    color: 'var(--gray-600)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontWeight: 500,
  },
  card: {
    border: '1px solid var(--gray-200)',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
  },
  cardSection: { padding: 14 },
  cardRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--gray-700)',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  addBtn: {
    padding: '5px 10px',
    border: '1px solid var(--gray-200)',
    borderRadius: 'var(--radius-sm)',
    background: '#fff',
    fontSize: 12,
    fontFamily: 'var(--font)',
    color: 'var(--gray-600)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontWeight: 500,
  },
  emptyLabel: { fontSize: 12, color: 'var(--gray-400)', fontStyle: 'italic', marginTop: 4 },
  tagList: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '3px 10px',
    background: 'var(--blue-50)',
    color: 'var(--blue-700)',
    border: '1px solid var(--blue-100)',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 500,
  },
  tagX: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'inherit',
    display: 'flex',
    alignItems: 'center',
    padding: 0,
    opacity: 0.6,
  },
  divider: { height: 1, background: 'var(--gray-100)' },
  sentimentRow: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  sentimentOption: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '8px 16px',
    border: '1px solid var(--gray-200)',
    borderRadius: 20,
    cursor: 'pointer',
    fontSize: 13,
    color: 'var(--gray-600)',
    background: '#fff',
    fontFamily: 'var(--font)',
    transition: 'all 0.15s',
  },
  aiSuggestions: {
    background: 'var(--blue-50)',
    borderRadius: 'var(--radius)',
    padding: 14,
    border: '1px solid var(--blue-100)',
  },
  aiLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--blue-700)',
    marginBottom: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  },
  suggestionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'none',
    border: 'none',
    fontFamily: 'var(--font)',
    fontSize: 13,
    color: 'var(--blue-700)',
    cursor: 'pointer',
    padding: '3px 0',
    textAlign: 'left',
    textDecoration: 'underline',
    textDecorationColor: 'transparent',
    width: '100%',
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 8,
    borderTop: '1px solid var(--gray-100)',
    marginTop: 4,
  },
  primaryBtn: {
    padding: '9px 20px',
    background: 'var(--blue-600)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--font)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    transition: 'background 0.15s',
  },
  secondaryBtn: {
    padding: '9px 16px',
    background: '#fff',
    color: 'var(--gray-600)',
    border: '1px solid var(--gray-200)',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--font)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 7,
  },
  errorBox: {
    padding: '10px 14px',
    background: 'var(--red-50)',
    border: '1px solid #fca5a5',
    borderRadius: 'var(--radius-sm)',
    color: '#dc2626',
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  successBox: {
    padding: '10px 14px',
    background: 'var(--green-50)',
    border: '1px solid #86efac',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--green-600)',
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
}
