import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import Sidebar from './components/Sidebar'
import ContentEditable from './components/Editor'
import TagDashboard from './components/TagDashboard'

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
  const template = [
    `<h2>${title} — ${dayOfWeek}</h2>`,
    `<div><br></div>`,
    `<h2>Focus</h2>`,
    `<div class="checkbox-item flex items-center gap-2 py-1"><input type="checkbox" class="checkbox-input"><span class="checkbox-text flex-1 outline-none min-w-0" contenteditable="true">One big thing to achieve today...</span></div>`,
    `<div><br></div>`,
    `<div><br></div>`,
    `<h2>Log</h2>`,
    `<p>What happened today?</p>`,
    `<div><br></div>`,
  ].join('')
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
  const [mobileView, setMobileView] = useState('LIST') // 'LIST' or 'EDITOR'

  /* ─── Task Rollover & Streak Logic ─── */
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    // 1. Calculate Streak
    const dailyNotes = notes.filter(n => n.isDaily).sort((a, b) => new Date(b.title) - new Date(a.title))
    if (dailyNotes.length > 0) {
      let currentStreak = 0
      const now = new Date()
      now.setHours(0,0,0,0)
      
      const lastNoteDate = new Date(dailyNotes[0].title)
      lastNoteDate.setHours(0,0,0,0)
      const diffHours = (now - lastNoteDate) / (1000 * 60 * 60)
      
      // Grace period: < 48h (so if executed today, last note could be yesterday or today)
      // Actually if last note is today, diff is 0. If yesterday, diff is 24.
      // If day before yesterday, diff is 48. So < 48 keeps chain alive.
      if (diffHours < 48) {
        currentStreak = 1
        let prevDate = lastNoteDate
        for (let i = 1; i < dailyNotes.length; i++) {
          const d = new Date(dailyNotes[i].title)
          d.setHours(0,0,0,0)
          const gap = (prevDate - d) / (1000 * 60 * 60 * 24)
          if (gap === 1) {
            currentStreak++
            prevDate = d
          } else {
            break
          }
        }
      }
      setStreak(currentStreak)
    }

    // 2. Task Rollover
    const todayTitle = formatDailyTitle(new Date())
    const todayNote = notes.find(n => n.title === todayTitle && n.isDaily)
    
    // Find most recent daily note that is NOT today
    const recentNote = dailyNotes.find(n => n.title !== todayTitle)

    if (recentNote && todayNote) {
      const tmp = document.createElement('div')
      tmp.innerHTML = recentNote.content
      const unfinished = []
      let hasChanges = false

      tmp.querySelectorAll('.checkbox-item').forEach(item => {
        const input = item.querySelector('input')
        const span = item.querySelector('.checkbox-text')
        // Check if unchecked, not disabled, and not already moved
        if (input && !input.checked && !input.disabled && !item.classList.contains('checked')) {
          const text = span.textContent.trim()
          if (text && text !== 'One big thing to achieve today...' && !text.startsWith('[>]')) {
             unfinished.push(item.outerHTML)
             // Mark as moved
             span.textContent = `[>] ${text}`
             span.style.color = '#9ca3af'
             input.disabled = true
             hasChanges = true
          }
        }
      })

      if (hasChanges && unfinished.length > 0) {
        const updatedRecent = { ...recentNote, content: tmp.innerHTML, updatedAt: Date.now() }
        const rolloverHtml = `<h2>↩️ Rolled Over</h2>${unfinished.join('')}<div><br></div>`
        const updatedToday = { ...todayNote, content: todayNote.content + rolloverHtml, updatedAt: Date.now() }

        setNotes(prev => prev.map(n => 
          n.id === updatedRecent.id ? updatedRecent : 
          n.id === updatedToday.id ? updatedToday : n
        ))
        
        if ('vibrate' in navigator) navigator.vibrate(50)
      }
    }
  }, []) 

  /* ─── Tag View Logic ─── */
  useEffect(() => {
    if (activeTag) {
      setView('tags')
      if (isMobile) setMobileView('EDITOR') // Show dashboard on mobile
    } else if (view === 'tags') {
      setView('notes')
    }
  }, [activeTag])

  /* ─── Dark mode ─── */
  /* ─── Dark mode ─── */
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  useEffect(() => {
    const root = document.documentElement
    if (isDarkMode) {
      root.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      root.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [isDarkMode])
  const toggleDarkMode = useCallback(() => setIsDarkMode(prev => !prev), [])

  /* ─── Responsive: detect mobile (<768px) ─── */
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

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
    setMobileView('EDITOR')
  }

  const handleSelectNote = (id) => {
    setActiveId(id)
    setView('notes')
    setMobileView('EDITOR')
  }

  const handleDeleteNote = (e, id) => {
    e.stopPropagation()
    if ('vibrate' in navigator) navigator.vibrate([10, 30, 10])
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

  const showSidebar = !isMobile || mobileView === 'LIST'
  const showMain = !isMobile || mobileView === 'EDITOR'

  return (
    <div className={`flex h-screen font-sans overflow-hidden ${isDarkMode ? 'bg-zinc-950' : 'bg-apple-bg'}`}>
      {/* ===== Sidebar ===== */}
      {showSidebar && (
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
          isMobile={isMobile}
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
          streak={streak}
        />
      )}

      {/* ===== Main Area ===== */}
      {showMain && (
        <>
        {view === 'tasks' ? (
          <GlobalTasksView tasks={globalTasks} onNavigate={handleSelectNote}
            onBack={isMobile ? () => setMobileView('LIST') : null} isMobile={isMobile} />
        ) : view === 'tags' && activeTag ? (
          <TagDashboard 
            notes={notes}
            activeTag={activeTag}
            isDarkMode={isDarkMode}
            onNavigate={(noteId) => {
              setActiveId(noteId)
              setActiveTag(null) // Clear tag to return to editor
            }}
            onClose={() => setActiveTag(null)}
          />
        ) : activeNote ? (
          <main className={`flex-1 flex flex-col h-full overflow-hidden w-full ${isDarkMode ? 'bg-zinc-950' : 'bg-white'}`}>
            {/* Toolbar */}
            <div className={`flex items-center gap-4 px-4 md:px-6 py-3 border-b ${isDarkMode ? 'border-zinc-800' : 'border-black/[0.06]'}`}>
              {isMobile && (
                <button
                  className="flex items-center gap-1 text-apple-blue text-sm font-medium bg-transparent border-none 
                             cursor-pointer px-0 py-1 -ml-1 flex-shrink-0 font-sans"
                  onClick={() => setMobileView('LIST')}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  Back
                </button>
              )}
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
          <main className="flex-1 flex flex-col items-center justify-center bg-white text-gray-400 w-full">
            {isMobile && (
              <button
                className="absolute top-4 left-4 flex items-center gap-1 text-apple-blue text-sm font-medium bg-transparent border-none 
                           cursor-pointer px-0 py-1 font-sans"
                onClick={() => setMobileView('LIST')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Back
              </button>
            )}
            <div className="text-5xl mb-3">📝</div>
            <div className="text-lg font-medium text-gray-500">No note selected</div>
            <div className="text-sm mt-1">Select a note or create a new one</div>
          </main>
        )}
        </>
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

      {/* ===== Mobile FAB (New Note) ===== */}
      {isMobile && mobileView === 'LIST' && (
        <button
          className="fixed bottom-8 right-8 z-50 w-14 h-14 rounded-full bg-yellow-400 shadow-2xl
                     flex items-center justify-center text-black text-3xl font-bold
                     active:scale-90 transition-transform duration-150 border-none cursor-pointer
                     hover:bg-yellow-300"
          onClick={handleNewNote}
          aria-label="New Note"
        >
          +
        </button>
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
function GlobalTasksView({ tasks, onNavigate, onBack, isMobile }) {
  return (
    <main className="flex-1 flex flex-col bg-white h-full overflow-hidden w-full">
      <div className="flex items-center justify-between px-4 md:px-8 pt-6 pb-4 border-b border-black/[0.06]">
        <div className="flex items-center gap-2">
          {isMobile && onBack && (
            <button
              className="flex items-center gap-1 text-apple-blue text-sm font-medium bg-transparent border-none 
                         cursor-pointer px-0 py-1 -ml-1 flex-shrink-0 font-sans"
              onClick={onBack}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}
          <h2 className="text-[22px] font-bold tracking-tight">☑️ My Tasks</h2>
        </div>
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
