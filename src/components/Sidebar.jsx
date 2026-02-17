import React, { useRef, useState, useMemo } from 'react'

/* ─── Mini calendar grid ─── */
function CalendarPopup({ notes, onOpenDate, onClose }) {
  const [viewDate, setViewDate] = useState(new Date())
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  // Which dates have daily notes?
  const dailyDates = useMemo(() => {
    const set = new Set()
    notes.forEach(n => {
      if (n.isDaily && n.title) {
        // Parse title like "Feb 17, 2026" back to a date key
        const d = new Date(n.title)
        if (!isNaN(d)) set.add(d.toISOString().slice(0, 10))
      }
    })
    return set
  }, [notes])

  // Build the grid
  const firstDay = new Date(year, month, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1))
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1))

  return (
    <div className="px-3 py-3 border-t border-black/[0.06] bg-white/80 backdrop-blur animate-[slideIn_0.15s_ease-out]">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 px-0.5">
        <button
          className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 
                     transition-colors cursor-pointer border-none bg-transparent text-sm font-bold"
          onClick={prevMonth}
        >‹</button>
        <span className="text-[12px] font-semibold text-gray-700">{monthLabel}</span>
        <button
          className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 
                     transition-colors cursor-pointer border-none bg-transparent text-sm font-bold"
          onClick={nextMonth}
        >›</button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-0 mb-0.5">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} className="text-[9px] font-semibold text-gray-400 text-center py-0.5 uppercase">{d}</div>
        ))}
      </div>

      {/* Date cells */}
      <div className="grid grid-cols-7 gap-0">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} className="h-7" />
          const cellDate = new Date(year, month, day)
          const dateKey = cellDate.toISOString().slice(0, 10)
          const isToday = cellDate.toDateString() === today.toDateString()
          const hasDaily = dailyDates.has(dateKey)

          return (
            <button
              key={day}
              className={`h-7 w-full rounded-md text-[11px] font-medium cursor-pointer border-none 
                         transition-all duration-100 font-sans flex items-center justify-center
                ${isToday
                  ? 'bg-apple-blue text-white font-bold'
                  : hasDaily
                    ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    : 'bg-transparent text-gray-600 hover:bg-gray-100'
                }`}
              onClick={() => { onOpenDate(cellDate); onClose() }}
              title={isToday ? 'Today' : hasDaily ? 'Daily note exists' : 'Create daily note'}
            >
              {day}
            </button>
          )
        })}
      </div>

      {/* Today shortcut */}
      <button
        className="w-full mt-2 py-1.5 rounded-lg text-[11px] font-semibold text-apple-blue 
                   bg-blue-50/50 hover:bg-blue-100 transition-colors cursor-pointer border border-blue-100 font-sans"
        onClick={() => { onOpenDate(new Date()); onClose() }}
      >
        ↩ Go to Today
      </button>
    </div>
  )
}

export default function Sidebar({
  notes,
  filteredNotes,
  activeId,
  search,
  setSearch,
  activeTag,
  setActiveTag,
  allTags,
  view,
  setView,
  globalTasks,
  showSettings,
  setShowSettings,
  onNewNote,
  onSelectNote,
  onDeleteNote,
  onExport,
  onImport,
  formatDate,
  stripHtml,
  todayDailyNote,
  onOpenDailyNote,
  isMobile,
}) {
  const fileInputRef = useRef(null)
  const [showCalendar, setShowCalendar] = useState(false)

  return (
    <aside className={`${isMobile ? 'w-full' : 'w-[280px] min-w-[280px]'} bg-apple-sidebar border-r border-black/[0.06] flex flex-col h-full select-none`}>

      {/* My Tasks button */}
      <button
        className={`flex items-center gap-2 mx-3 mt-3 px-3.5 py-2.5 rounded-lg border text-[13px] font-semibold cursor-pointer transition-all duration-150
          ${view === 'tasks'
            ? 'bg-apple-blue text-white border-blue-600'
            : 'bg-black/[0.03] text-gray-500 border-transparent hover:bg-black/[0.06] hover:text-gray-700'
          }`}
        onClick={() => setView(view === 'tasks' ? 'notes' : 'tasks')}
      >
        <span className="text-base">☑️</span>
        <span>My Tasks</span>
        {globalTasks.length > 0 && (
          <span className={`ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center
            ${view === 'tasks' ? 'bg-white/20 text-white' : 'bg-black/[0.08] text-gray-500'}`}>
            {globalTasks.length}
          </span>
        )}
      </button>

      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight text-gray-800">Notes</h1>
        <button
          className="w-8 h-8 rounded-lg bg-apple-accent text-white font-bold text-lg flex items-center justify-center 
                     hover:bg-amber-400 hover:scale-105 transition-all duration-150 active:scale-95
                     border-none cursor-pointer shadow-sm"
          onClick={onNewNote}
          title="New note"
        >
          +
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2.5">
        <input
          className="w-full px-3 py-2 rounded-lg bg-black/[0.04] border-none outline-none text-[13px] 
                     placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-apple-accent/50 
                     transition-all duration-150 font-sans"
          type="text"
          placeholder="Search notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto px-2.5">
        {filteredNotes.length === 0 && (
          <div className="py-6 px-3.5 text-center text-gray-400 text-[13px]">
            {search || activeTag ? 'No matching notes' : 'No notes yet'}
          </div>
        )}
        {filteredNotes.map((note) => {
          const isDaily = note.isDaily
          const isTodayDaily = todayDailyNote && note.id === todayDailyNote.id

          return (
            <div
              key={note.id}
              className={`relative group p-3 rounded-xl mb-0.5 cursor-pointer transition-all duration-150
                ${note.id === activeId
                  ? 'bg-apple-accent/20 border border-apple-accent/30'
                  : isTodayDaily
                    ? 'bg-gradient-to-r from-amber-50/80 to-orange-50/50 border border-amber-200/50 hover:border-amber-300/70'
                    : 'hover:bg-black/[0.04] border border-transparent'
                }`}
              onClick={() => onSelectNote(note.id)}
            >
              <div className="flex items-center gap-1.5">
                {isDaily && <span className="text-[12px]">📅</span>}
                <div className="text-sm font-semibold text-gray-800 truncate">{note.title || 'Untitled'}</div>
                {isTodayDaily && (
                  <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full uppercase tracking-wide ml-auto flex-shrink-0">
                    Today
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-400 truncate leading-snug mt-0.5">{stripHtml(note.content) || 'No content'}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] text-gray-400">{formatDate(note.updatedAt)}</span>
                {(note.tags || []).length > 0 && (
                  <span className="flex gap-1 flex-wrap">
                    {note.tags.filter(t => t !== 'daily').slice(0, 3).map((t) => (
                      <span key={t} className="text-[10px] text-apple-blue bg-blue-50 px-1.5 rounded-md font-medium">#{t}</span>
                    ))}
                    {note.tags.filter(t => t !== 'daily').length > 3 && <span className="text-[10px] text-apple-blue bg-blue-50 px-1.5 rounded-md font-medium">+{note.tags.filter(t => t !== 'daily').length - 3}</span>}
                  </span>
                )}
              </div>
              <button
                className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-transparent border-none text-gray-400 
                           text-base flex items-center justify-center opacity-0 group-hover:opacity-100 
                           hover:bg-red-50 hover:text-red-500 transition-all duration-150 cursor-pointer"
                onClick={(e) => onDeleteNote(e, note.id)}
                title="Delete note"
              >
                ×
              </button>
            </div>
          )
        })}
      </div>

      {/* Tags section */}
      {allTags.length > 0 && (
        <div className="px-3 py-2 border-t border-black/[0.06]">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-1.5 py-1 flex items-center justify-between">
            Tags
            {activeTag && (
              <button
                className="text-[10px] text-apple-blue bg-transparent border-none cursor-pointer font-semibold uppercase tracking-wide px-1 py-0.5 rounded hover:bg-blue-50 transition-colors"
                onClick={() => setActiveTag(null)}
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1 px-0.5 py-1">
            {allTags.map((tag) => (
              <button
                key={tag}
                className={`text-xs px-2.5 py-0.5 rounded-full cursor-pointer font-medium font-sans transition-all duration-150 border
                  ${activeTag === tag
                    ? 'bg-apple-blue text-white border-apple-blue'
                    : 'text-apple-blue bg-blue-50/50 border-blue-100 hover:bg-blue-100 hover:border-blue-200'
                  }`}
                onClick={() => setActiveTag((prev) => (prev === tag ? null : tag))}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Notes count + Calendar + Settings */}
      <div className="px-4 py-2.5 text-[11px] text-gray-400 border-t border-black/[0.06] flex items-center justify-between">
        <span>{notes.length} {notes.length === 1 ? 'note' : 'notes'}</span>
        <div className="flex items-center gap-1">
          <button
            className={`w-7 h-7 rounded-lg flex items-center justify-center text-base cursor-pointer transition-all duration-150 border-none
              ${showCalendar
                ? 'bg-amber-100 text-amber-700'
                : 'bg-transparent text-gray-400 hover:bg-black/[0.05] hover:text-gray-600'
              }`}
            onClick={() => { setShowCalendar(s => !s); setShowSettings(false) }}
            title="Daily Notes Calendar"
          >
            📅
          </button>
          <button
            className={`w-7 h-7 rounded-lg flex items-center justify-center text-base cursor-pointer transition-all duration-150 border-none
              ${showSettings
                ? 'bg-gray-200 text-gray-700'
                : 'bg-transparent text-gray-400 hover:bg-black/[0.05] hover:text-gray-600'
              }`}
            onClick={() => { setShowSettings(s => !s); setShowCalendar(false) }}
            title="Settings"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Calendar panel */}
      {showCalendar && (
        <CalendarPopup
          notes={notes}
          onOpenDate={onOpenDailyNote}
          onClose={() => setShowCalendar(false)}
        />
      )}

      {/* Settings panel */}
      {showSettings && (
        <div className="px-3 py-3 border-t border-black/[0.06] bg-white/60 backdrop-blur">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">Settings</div>
          <button
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-gray-700
                       bg-black/[0.03] hover:bg-black/[0.06] transition-colors duration-150 cursor-pointer border-none
                       font-sans mb-1.5"
            onClick={onExport}
          >
            <span className="text-base">📥</span>
            Export Data
          </button>
          <button
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-gray-700
                       bg-black/[0.03] hover:bg-black/[0.06] transition-colors duration-150 cursor-pointer border-none
                       font-sans"
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="text-base">📤</span>
            Import Data
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={onImport}
          />
        </div>
      )}
    </aside>
  )
}
