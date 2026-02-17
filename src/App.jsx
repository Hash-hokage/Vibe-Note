import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import Sidebar from './components/Sidebar'
import ContentEditable from './components/Editor'

/* ─── helpers ─── */
const generateId = () => Math.random().toString(36).substring(2, 10) + Date.now().toString(36)

const formatDate = (ts) => {
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

const stripHtml = (html) => {
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  return tmp.textContent || tmp.innerText || ''
}

/* ─── Tag extraction ─── */
const TAG_REGEX = /#([a-zA-Z0-9_-]+)/g

const extractTags = (html) => {
  const text = stripHtml(html)
  const tags = []
  let m
  while ((m = TAG_REGEX.exec(text)) !== null) {
    const t = m[1].toLowerCase()
    if (!tags.includes(t)) tags.push(t)
  }
  TAG_REGEX.lastIndex = 0
  return tags
}

/* ─── Extract due dates from HTML content ─── */
const extractDueDates = (html) => {
  const dueDates = []
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  const badges = tmp.querySelectorAll('.due-date-badge')
  badges.forEach((badge) => {
    const ts = badge.getAttribute('data-due')
    if (ts) dueDates.push(parseInt(ts, 10))
  })
  return dueDates
}

const createNote = () => ({
  id: generateId(),
  title: '',
  content: '',
  tags: [],
  dueDates: [],
  isDaily: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
})

/* ─── Daily note helpers ─── */
const formatDailyTitle = (date) => {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const createDailyNote = (date) => {
  const title = formatDailyTitle(date)
  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' })
  const template = `<h2>${title} — ${dayOfWeek}</h2><h3>Focus</h3><label class="checkbox-item flex items-center gap-2 py-1 cursor-pointer" contenteditable="false"><input type="checkbox" class="checkbox-input"><span class="checkbox-text flex-1 outline-none min-w-0" contenteditable="true">\u00A0</span></label><h3>Log</h3><div><br></div>`
  return {
    id: 'daily-' + date.toISOString().slice(0, 10),
    title,
    content: template,
    tags: ['daily'],
    dueDates: [],
    isDaily: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

/* ─── initial data ─── */
const INITIAL_NOTES = [
  {
    id: 'welcome',
    title: 'Welcome to Notes',
    content: 'This is your personal notes app. Click the <strong>+</strong> button to create a new note, or start typing here.',
    tags: [],
    dueDates: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
]

/* ─── Extract unchecked tasks from all notes ─── */
const extractTasks = (notes) => {
  const tasks = []
  notes.forEach((note) => {
    if (!note.content) return
    const tmp = document.createElement('div')
    tmp.innerHTML = note.content
    const labels = tmp.querySelectorAll('label.checkbox-item')
    labels.forEach((label) => {
      const cb = label.querySelector('input.checkbox-input')
      const textSpan = label.querySelector('.checkbox-text')
      if (cb && !cb.checked && textSpan) {
        const text = textSpan.textContent.trim()
        if (text && text !== '\u00A0') {
          const dueBadge = label.querySelector('.due-date-badge')
          const dueDate = dueBadge ? parseInt(dueBadge.getAttribute('data-due'), 10) : null
          tasks.push({ text, noteId: note.id, noteTitle: note.title || 'Untitled', dueDate })
        }
      }
    })
  })
  return tasks
}

/* ─── Extract wiki-link target IDs from HTML content ─── */
const extractWikiLinks = (html) => {
  if (!html) return []
  const ids = []
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  const links = tmp.querySelectorAll('span.wiki-link')
  links.forEach((link) => {
    const id = link.getAttribute('data-note-id')
    if (id && !ids.includes(id)) ids.push(id)
  })
  return ids
}

/* ══════════════════════════════════════ */
/*            App Component              */
/* ══════════════════════════════════════ */
export default function App() {
  const [notes, setNotes] = useState(() => {
    const saved = localStorage.getItem('notes-app-data')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return parsed.map(n => ({ ...n, tags: n.tags || extractTags(n.content || '') }))
      } catch { /* fall through */ }
    }
    return INITIAL_NOTES
  })
  const [activeId, setActiveId] = useState(() => notes[0]?.id ?? null)
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState(null)
  const [view, setView] = useState('notes')
  const [showSettings, setShowSettings] = useState(false)
  const [showPalette, setShowPalette] = useState(false)

  useEffect(() => {
    localStorage.setItem('notes-app-data', JSON.stringify(notes))
  }, [notes])

  /* ─── Auto-create today's daily note on mount ─── */
  useEffect(() => {
    const today = new Date()
    const todayTitle = formatDailyTitle(today)
    const exists = notes.some(n => n.title === todayTitle && n.isDaily)
    if (!exists) {
      const daily = createDailyNote(today)
      setNotes(prev => [daily, ...prev])
      setActiveId(daily.id)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Cmd/Ctrl+K global shortcut ─── */
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowPalette(prev => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const activeNote = notes.find((n) => n.id === activeId) || null

  const allTags = useMemo(() => {
    const set = new Set()
    notes.forEach((n) => (n.tags || []).forEach((t) => set.add(t)))
    return [...set].sort()
  }, [notes])

  const globalTasks = useMemo(() => extractTasks(notes), [notes])

  /* ─── Backlinks: find all notes that link TO the active note ─── */
  const backlinks = useMemo(() => {
    if (!activeId) return []
    return notes.filter((n) => {
      if (n.id === activeId) return false
      const linkedIds = extractWikiLinks(n.content)
      return linkedIds.includes(activeId)
    })
  }, [notes, activeId])

  const todayTitle = formatDailyTitle(new Date())
  const todayDailyNote = notes.find(n => n.title === todayTitle && n.isDaily) || null

  const filteredNotes = useMemo(() => {
    const filtered = notes
      .filter((n) => {
        if (activeTag && !(n.tags || []).includes(activeTag)) return false
        if (!search) return true
        const q = search.toLowerCase()
        return n.title.toLowerCase().includes(q) || stripHtml(n.content).toLowerCase().includes(q)
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)
    // Pin today's daily note to the top
    if (todayDailyNote && !search && !activeTag) {
      const idx = filtered.findIndex(n => n.id === todayDailyNote.id)
      if (idx > 0) {
        const [daily] = filtered.splice(idx, 1)
        filtered.unshift(daily)
      }
    }
    return filtered
  }, [notes, activeTag, search, todayDailyNote])

  /* ─── Open/create daily note for a specific date (calendar) ─── */
  const openDailyNote = useCallback((date) => {
    const title = formatDailyTitle(date)
    const existing = notes.find(n => n.title === title && n.isDaily)
    if (existing) {
      setActiveId(existing.id)
      setView('notes')
    } else {
      const daily = createDailyNote(date)
      setNotes(prev => [daily, ...prev])
      setActiveId(daily.id)
      setView('notes')
    }
  }, [notes])

  /* ─── handlers ─── */
  const handleNewNote = () => {
    const note = createNote()
    setNotes((prev) => [note, ...prev])
    setActiveId(note.id)
    setSearch('')
    setView('notes')
  }

  const handleSelectNote = (id) => {
    setActiveId(id)
    setView('notes')
  }

  const handleDeleteNote = (e, id) => {
    e.stopPropagation()
    setNotes((prev) => prev.filter((n) => n.id !== id))
    if (activeId === id) {
      setActiveId(notes.find((n) => n.id !== id)?.id ?? null)
    }
  }

  const handleTitleChange = (e) => {
    const val = e.target.value
    setNotes((prev) =>
      prev.map((n) =>
        n.id === activeId ? { ...n, title: val, updatedAt: Date.now() } : n
      )
    )
  }

  const handleContentChange = useCallback(
    (html) => {
      const tags = extractTags(html)
      const dueDates = extractDueDates(html)
      setNotes((prev) =>
        prev.map((n) =>
          n.id === activeId ? { ...n, content: html, tags, dueDates, updatedAt: Date.now() } : n
        )
      )
    },
    [activeId]
  )

  /* ─── Export / Import ─── */
  const handleExport = () => {
    const data = JSON.stringify(notes, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `backup-${date}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setShowSettings(false)
  }

  const handleImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result)
        if (!Array.isArray(imported)) {
          alert('Invalid file: expected an array of notes.')
          return
        }
        const confirmed = window.confirm(
          `This will replace your current ${notes.length} note(s) with ${imported.length} imported note(s).\n\nThis cannot be undone. Continue?`
        )
        if (!confirmed) return
        const cleaned = imported.map(n => ({
          ...n,
          tags: n.tags || extractTags(n.content || ''),
          dueDates: n.dueDates || [],
        }))
        setNotes(cleaned)
        setActiveId(cleaned[0]?.id ?? null)
        setShowSettings(false)
        setSearch('')
        setActiveTag(null)
      } catch {
        alert('Failed to parse the file. Make sure it is valid JSON.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="flex h-screen bg-apple-bg font-sans overflow-hidden">
      {/* ===== Sidebar ===== */}
      <Sidebar
        notes={notes}
        filteredNotes={filteredNotes}
        activeId={activeId}
        search={search}
        setSearch={setSearch}
        activeTag={activeTag}
        setActiveTag={setActiveTag}
        allTags={allTags}
        view={view}
        setView={setView}
        globalTasks={globalTasks}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        onNewNote={handleNewNote}
        onSelectNote={handleSelectNote}
        onDeleteNote={handleDeleteNote}
        onExport={handleExport}
        onImport={handleImport}
        formatDate={formatDate}
        stripHtml={stripHtml}
        todayDailyNote={todayDailyNote}
        onOpenDailyNote={openDailyNote}
      />

      {/* ===== Main Area ===== */}
      {view === 'tasks' ? (
        <GlobalTasksView tasks={globalTasks} onNavigate={handleSelectNote} />
      ) : activeNote ? (
        <main className="flex-1 flex flex-col bg-white h-full overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-4 px-6 py-3 border-b border-black/[0.06]">
            <span className="text-xs text-gray-400">{formatDate(activeNote.updatedAt)}</span>
            {(activeNote.tags || []).length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {activeNote.tags.map((t) => (
                  <span key={t} className="text-xs text-apple-blue bg-blue-50/50 px-2.5 py-0.5 rounded-full font-medium">#{t}</span>
                ))}
              </div>
            )}
          </div>
          <input
            className="w-full px-6 pt-5 pb-2 text-[26px] font-bold border-none outline-none 
                       placeholder:text-gray-300 tracking-tight bg-transparent font-sans"
            type="text"
            placeholder="Title"
            value={activeNote.title}
            onChange={handleTitleChange}
          />
          <ContentEditable
            key={activeNote.id}
            initialHtml={activeNote.content}
            onChange={handleContentChange}
            notes={notes}
            onNavigateToNote={handleSelectNote}
          />

          {/* ── Backlinks / "Linked Here" section ── */}
          {backlinks.length > 0 && (
            <div className="border-t border-black/[0.06] px-6 py-4 bg-gray-50/50 flex-shrink-0">
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span>🔗</span> Linked Here · {backlinks.length}
              </div>
              <div className="flex flex-col gap-1">
                {backlinks.map((bl) => (
                  <button
                    key={bl.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-left text-[13px] font-medium 
                               text-blue-600 hover:bg-blue-50 transition-colors duration-100 cursor-pointer 
                               border-none bg-transparent font-sans w-full"
                    onClick={() => handleSelectNote(bl.id)}
                  >
                    <span className="text-sm">📄</span>
                    <span className="truncate">{bl.title || 'Untitled'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </main>
      ) : (
        <main className="flex-1 flex flex-col items-center justify-center bg-white text-gray-400">
          <div className="text-5xl mb-3">📝</div>
          <div className="text-lg font-medium text-gray-500">No note selected</div>
          <div className="text-sm mt-1">Select a note or create a new one</div>
        </main>
      )}

      {/* ===== Command Palette ===== */}
      {showPalette && (
        <CommandPalette
          notes={notes}
          onSelect={(id) => { handleSelectNote(id); setShowPalette(false) }}
          onNewNote={() => { handleNewNote(); setShowPalette(false) }}
          onClose={() => setShowPalette(false)}
        />
      )}
    </div>
  )
}

/* ─── Command Palette ─── */
function CommandPalette({ notes, onSelect, onNewNote, onClose }) {
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const results = useMemo(() => {
    const items = []
    items.push({ type: 'action', id: '__new__', label: 'Create New Note', icon: '✨' })
    const q = query.toLowerCase().trim()
    const matched = q
      ? notes.filter(n => (n.title || 'Untitled').toLowerCase().includes(q))
      : notes.slice().sort((a, b) => b.updatedAt - a.updatedAt)
    matched.forEach(n => {
      items.push({
        type: 'note',
        id: n.id,
        label: n.title || 'Untitled',
        icon: '📄',
        preview: stripHtml(n.content).slice(0, 60) || 'No content',
        date: formatDate(n.updatedAt),
      })
    })
    return items
  }, [query, notes])

  useEffect(() => {
    setActiveIdx(0)
  }, [results.length])

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = results[activeIdx]
      if (!item) return
      if (item.type === 'action') onNewNote()
      else onSelect(item.id)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-start justify-center pt-[15vh] bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-[520px] bg-white rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.2)] overflow-hidden
                   animate-[slideIn_0.15s_ease-out] border border-black/10"
      >
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-black/[0.06]">
          <span className="text-gray-400 text-lg">🔍</span>
          <input
            ref={inputRef}
            className="flex-1 bg-transparent border-none outline-none text-[15px] text-gray-800
                       placeholder:text-gray-400 font-sans"
            type="text"
            placeholder="Search notes or type a command…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <kbd className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">ESC</kbd>
        </div>
        <div className="max-h-[320px] overflow-y-auto py-1.5">
          {results.length === 0 && (
            <div className="px-5 py-6 text-center text-gray-400 text-sm">No results found</div>
          )}
          {results.map((item, i) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 px-5 py-2.5 cursor-pointer transition-colors duration-75
                ${i === activeIdx ? 'bg-apple-blue/10' : 'hover:bg-gray-50'}`}
              onClick={() => {
                if (item.type === 'action') onNewNote()
                else onSelect(item.id)
              }}
              onMouseEnter={() => setActiveIdx(i)}
            >
              <span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-base flex-shrink-0">
                {item.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-gray-800 truncate">{item.label}</div>
                {item.preview && (
                  <div className="text-[11px] text-gray-400 truncate">{item.preview}</div>
                )}
              </div>
              {item.date && (
                <span className="text-[11px] text-gray-400 flex-shrink-0">{item.date}</span>
              )}
              {item.type === 'action' && (
                <span className="text-[11px] text-gray-400 flex-shrink-0">Action</span>
              )}
            </div>
          ))}
        </div>
        <div className="px-5 py-2 border-t border-black/[0.06] flex items-center gap-4 text-[10px] text-gray-400">
          <span><kbd className="font-semibold">↑↓</kbd> navigate</span>
          <span><kbd className="font-semibold">↵</kbd> select</span>
          <span><kbd className="font-semibold">esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}

/* ─── GlobalTasksView ─── */
function GlobalTasksView({ tasks, onNavigate }) {
  return (
    <main className="flex-1 flex flex-col bg-white h-full overflow-hidden">
      <div className="flex items-center justify-between px-8 pt-6 pb-4 border-b border-black/[0.06]">
        <h2 className="text-[22px] font-bold tracking-tight">☑️ My Tasks</h2>
        <span className="text-[13px] text-gray-400 font-medium">
          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
        </span>
      </div>
      {tasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
          <div className="text-[40px] mb-2">🎉</div>
          <div className="text-lg font-medium text-gray-500">All done!</div>
          <div className="text-sm mt-1">No unchecked tasks across your notes</div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {tasks.map((task, i) => (
            <div
              key={`${task.noteId}-${i}`}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border-b border-black/[0.04] 
                         hover:bg-gray-50 transition-colors duration-150"
            >
              <span className="text-base text-gray-300 flex-shrink-0 w-5 text-center">○</span>
              <span className="flex-1 text-sm text-gray-800 min-w-0">{task.text}</span>
              {task.dueDate && (
                <span className="flex-shrink-0 text-[11px] font-medium text-amber-600 bg-amber-50 
                               border border-amber-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                  📅 {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
              <button
                className="flex-shrink-0 text-[11px] font-semibold text-apple-blue bg-blue-50/50 
                           border border-blue-100 px-2.5 py-0.5 rounded-full cursor-pointer font-sans
                           transition-all duration-150 hover:bg-blue-100 hover:border-blue-200
                           whitespace-nowrap max-w-[140px] overflow-hidden text-ellipsis"
                onClick={() => onNavigate(task.noteId)}
                title={`Go to "${task.noteTitle}"`}
              >
                {task.noteTitle}
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
