import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import confetti from 'canvas-confetti'

/* ─── Date resolution for task parser ─── */
const DATE_KEYWORDS = /\b(today|tomorrow)\b/i
const DATE_FORMAT = /\b(\d{1,2}\/(\d{1,2}))\b/

/* ─── Time resolution for notification parser ─── */
const TIME_24H = /@(\d{1,2}):(\d{2})\b/
const TIME_12H = /@(\d{1,2})(?::(\d{2}))?(am|pm)/i

const resolveDate = (keyword) => {
  const now = new Date()
  const lower = keyword.toLowerCase()
  if (lower === 'today') return now
  if (lower === 'tomorrow') {
    const d = new Date(now)
    d.setDate(d.getDate() + 1)
    return d
  }
  const mmdd = keyword.match(/^(\d{1,2})\/(\d{1,2})$/)
  if (mmdd) {
    const month = parseInt(mmdd[1], 10) - 1
    const day = parseInt(mmdd[2], 10)
    const d = new Date(now.getFullYear(), month, day)
    if (d < now) d.setFullYear(d.getFullYear() + 1)
    return d
  }
  return null
}

const formatDueDate = (d) => {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const resolveTime = (match, regex) => {
  const m = match[0].match(regex)
  if (!m) return null
  const now = new Date()
  const target = new Date()
  if (regex === TIME_24H) {
    target.setHours(parseInt(m[1], 10), parseInt(m[2], 10), 0, 0)
  } else {
    let h = parseInt(m[1], 10)
    const min = m[2] ? parseInt(m[2], 10) : 0
    const ampm = m[3].toLowerCase()
    if (ampm === 'pm' && h < 12) h += 12
    if (ampm === 'am' && h === 12) h = 0
    target.setHours(h, min, 0, 0)
  }
  if (target <= now) return null // time already passed today
  return target
}

const formatTime = (d) => {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/* ── Active notification timers ── */
const notificationTimers = new Set()

/* ─── Slash command definitions ─── */
const SLASH_COMMANDS = [
  { id: 'todo',    label: 'To-do',   icon: '☑️', description: 'Add a to-do checkbox' },
  { id: 'heading', label: 'Heading', icon: '𝗛',  description: 'Insert a heading' },
  { id: 'date',    label: 'Date',    icon: '📅', description: "Insert today's date" },
]

/* ─── SlashMenu floating component ─── */
const SlashMenu = React.forwardRef(({ x, y, activeIndex, onSelect, onHover }, forwardedRef) => {
  return (
    <div
      ref={forwardedRef}
      className="fixed z-[1000] min-w-[220px] bg-white border border-black/10 rounded-2xl 
                 shadow-[0_8px_30px_rgba(0,0,0,0.1),0_2px_8px_rgba(0,0,0,0.05)] p-1.5 
                 animate-[slideIn_0.15s_ease-out]"
      style={{ left: x, top: y + 4 }}
    >
      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 py-1.5">
        Commands
      </div>
      {SLASH_COMMANDS.map((cmd, i) => (
        <div
          key={cmd.id}
          className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors duration-100
            ${i === activeIndex ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
          onMouseDown={(e) => { e.preventDefault(); onSelect(cmd.id) }}
          onMouseEnter={() => onHover(i)}
        >
          <span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-base flex-shrink-0">
            {cmd.icon}
          </span>
          <div className="flex flex-col">
            <span className="text-[13px] font-semibold text-gray-800">{cmd.label}</span>
            <span className="text-[11px] text-gray-400">{cmd.description}</span>
          </div>
        </div>
      ))}
    </div>
  )
})

/* ─── WikiLinkMenu: floating note picker for [[ ─── */
const WikiLinkMenu = React.forwardRef(({ x, y, items, activeIndex, onSelect, onHover }, forwardedRef) => {
  if (items.length === 0) return null
  return (
    <div
      ref={forwardedRef}
      className="fixed z-[1000] min-w-[240px] max-w-[320px] bg-white border border-black/10 rounded-2xl 
                 shadow-[0_8px_30px_rgba(0,0,0,0.1),0_2px_8px_rgba(0,0,0,0.05)] p-1.5 
                 animate-[slideIn_0.15s_ease-out] max-h-[220px] overflow-y-auto"
      style={{ left: x, top: y + 4 }}
    >
      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 py-1.5">
        Link to note
      </div>
      {items.map((note, i) => (
        <div
          key={note.id}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition-colors duration-100
            ${i === activeIndex ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
          onMouseDown={(e) => { e.preventDefault(); onSelect(note) }}
          onMouseEnter={() => onHover(i)}
        >
          <span className="text-base flex-shrink-0">📄</span>
          <span className="text-[13px] font-medium text-gray-800 truncate">{note.title || 'Untitled'}</span>
        </div>
      ))}
    </div>
  )
})

/* ─── ContentEditable component ─── */
function ContentEditable({ initialHtml, onChange, notes, onNavigateToNote }) {
  const ref = useRef(null)
  const onChangeRef = useRef(onChange)
  const onNavigateRef = useRef(onNavigateToNote)
  const [slashMenu, setSlashMenu] = useState(null)
  const [slashIndex, setSlashIndex] = useState(0)
  const slashMenuRef = useRef(null)

  // Wiki-link popup state
  const [wikiMenu, setWikiMenu] = useState(null) // { x, y }
  const [wikiQuery, setWikiQuery] = useState('')
  const [wikiIndex, setWikiIndex] = useState(0)
  const wikiMenuRef = useRef(null)
  // Store the text node + offset where [[ was typed so we can replace it later
  const wikiAnchorRef = useRef(null)

  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  useEffect(() => { onNavigateRef.current = onNavigateToNote }, [onNavigateToNote])

  useEffect(() => {
    if (ref.current && initialHtml !== undefined) {
      ref.current.innerHTML = initialHtml
    }
  }, [])

  // Close menus on outside click
  useEffect(() => {
    if (!slashMenu && !wikiMenu) return
    const handler = (e) => {
      if (slashMenu && slashMenuRef.current && !slashMenuRef.current.contains(e.target)) {
        setSlashMenu(null)
      }
      if (wikiMenu && wikiMenuRef.current && !wikiMenuRef.current.contains(e.target)) {
        setWikiMenu(null)
        setWikiQuery('')
        wikiAnchorRef.current = null
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [slashMenu, wikiMenu])

  // Filtered notes for wiki-link popup
  const wikiResults = useMemo(() => {
    if (!notes) return []
    const q = wikiQuery.toLowerCase().trim()
    return q
      ? notes.filter(n => (n.title || 'Untitled').toLowerCase().includes(q))
      : notes.slice().sort((a, b) => b.updatedAt - a.updatedAt)
  }, [notes, wikiQuery])

  // Reset wiki index when results change
  useEffect(() => {
    setWikiIndex(0)
  }, [wikiResults.length])

  const emitChange = useCallback(() => {
    if (ref.current) onChangeRef.current(ref.current.innerHTML)
  }, [])

  const getCaretCoords = () => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return null
    const range = sel.getRangeAt(0).cloneRange()
    range.collapse(true)
    const rect = range.getClientRects()[0]
    if (!rect) {
      const span = document.createElement('span')
      span.textContent = '\u200b'
      range.insertNode(span)
      const r = span.getBoundingClientRect()
      span.parentNode.removeChild(span)
      sel.removeAllRanges()
      sel.addRange(range)
      return { x: r.left, y: r.bottom }
    }
    return { x: rect.left, y: rect.bottom }
  }

  /* ─── Insert wiki link span ─── */
  const insertWikiLink = useCallback((note) => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) { setWikiMenu(null); return }

    const range = sel.getRangeAt(0)
    let node = range.startContainer
    if (node.nodeType !== Node.TEXT_NODE) {
      // Try to find text node
      node = node.childNodes[range.startOffset - 1] || node.firstChild
    }

    if (node && node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent
      // Find the [[ that triggered this - search backwards from cursor
      const bracketIdx = text.lastIndexOf('[[')
      if (bracketIdx !== -1) {
        const before = text.slice(0, bracketIdx)
        const after = text.slice(range.startOffset)

        // Create the wiki-link span
        const link = document.createElement('span')
        link.className = 'wiki-link inline text-blue-600 font-medium cursor-pointer hover:underline'
        link.contentEditable = 'false'
        link.setAttribute('data-note-id', note.id)
        link.textContent = `[[${note.title || 'Untitled'}]]`

        const parent = node.parentNode
        const frag = document.createDocumentFragment()
        if (before) frag.appendChild(document.createTextNode(before))
        frag.appendChild(link)
        const spacer = document.createTextNode('\u00A0' + after)
        frag.appendChild(spacer)
        parent.replaceChild(frag, node)

        // Place cursor after the link
        const newRange = document.createRange()
        newRange.setStart(spacer, 1)
        newRange.collapse(true)
        sel.removeAllRanges()
        sel.addRange(newRange)
      }
    }

    setWikiMenu(null)
    setWikiQuery('')
    wikiAnchorRef.current = null
    if (ref.current) onChangeRef.current(ref.current.innerHTML)
  }, [])

  const executeCommand = useCallback((commandId) => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) { setSlashMenu(null); return }

    const range = sel.getRangeAt(0)
    let node = range.startContainer
    if (node.nodeType !== Node.TEXT_NODE) {
      node = node.childNodes[range.startOffset - 1] || node.firstChild
    }
    if (node && node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent
      const slashIdx = text.lastIndexOf('/')
      if (slashIdx !== -1) {
        node.textContent = text.slice(0, slashIdx) + text.slice(slashIdx + 1)
      }
    }

    const parent = node ? node.parentNode : ref.current

    if (commandId === 'todo') {
      const wrapper = document.createElement('label')
      wrapper.className = 'checkbox-item flex items-center gap-2 py-1 cursor-pointer'
      wrapper.contentEditable = 'false'
      const cb = document.createElement('input')
      cb.type = 'checkbox'
      cb.className = 'checkbox-input'
      const span = document.createElement('span')
      span.className = 'checkbox-text flex-1 outline-none min-w-0'
      span.contentEditable = 'true'
      span.textContent = '\u00A0'
      wrapper.appendChild(cb)
      wrapper.appendChild(span)
      if (node && node.nextSibling) parent.insertBefore(wrapper, node.nextSibling)
      else parent.appendChild(wrapper)
      if (node && node.textContent === '') node.parentNode.removeChild(node)
      const newRange = document.createRange()
      newRange.setStart(span.firstChild || span, 0)
      newRange.collapse(true)
      sel.removeAllRanges()
      sel.addRange(newRange)

    } else if (commandId === 'heading') {
      const h2 = document.createElement('h2')
      h2.textContent = '\u00A0'
      if (node && node.nextSibling) parent.insertBefore(h2, node.nextSibling)
      else parent.appendChild(h2)
      if (node && node.textContent === '') node.parentNode.removeChild(node)
      const newRange = document.createRange()
      newRange.setStart(h2.firstChild || h2, 0)
      newRange.collapse(true)
      sel.removeAllRanges()
      sel.addRange(newRange)

    } else if (commandId === 'date') {
      const now = new Date()
      const formatted = now.toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
      })
      const badge = document.createElement('span')
      badge.className = 'date-badge inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-sm font-medium border border-amber-200 select-none whitespace-nowrap'
      badge.contentEditable = 'false'
      badge.textContent = '📅 ' + formatted
      if (node && node.nextSibling) parent.insertBefore(badge, node.nextSibling)
      else parent.appendChild(badge)
      if (node && node.textContent === '') node.parentNode.removeChild(node)
      const spacer = document.createTextNode('\u00A0')
      badge.parentNode.insertBefore(spacer, badge.nextSibling)
      const newRange = document.createRange()
      newRange.setStart(spacer, 1)
      newRange.collapse(true)
      sel.removeAllRanges()
      sel.addRange(newRange)
    }

    setSlashMenu(null)
    if (ref.current) onChangeRef.current(ref.current.innerHTML)
  }, [])

  const highlightTag = useCallback((node, tagStart, tagEnd) => {
    const sel = window.getSelection()
    const text = node.textContent
    const before = text.slice(0, tagStart)
    const tagText = text.slice(tagStart, tagEnd)
    const after = text.slice(tagEnd)
    const span = document.createElement('span')
    span.className = 'tag-highlight text-blue-600 bg-blue-50 px-1 rounded font-medium'
    span.textContent = tagText
    const parent = node.parentNode
    const frag = document.createDocumentFragment()
    if (before) frag.appendChild(document.createTextNode(before))
    frag.appendChild(span)
    if (after) frag.appendChild(document.createTextNode(after))
    parent.replaceChild(frag, node)
    if (sel) {
      const afterNode = span.nextSibling
      if (afterNode) {
        const newRange = document.createRange()
        newRange.setStart(afterNode, 0)
        newRange.collapse(true)
        sel.removeAllRanges()
        sel.addRange(newRange)
      }
    }
  }, [])

  const handleKeyDown = useCallback((e) => {
    // ─── Wiki-link menu keyboard handling ───
    if (wikiMenu) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setWikiIndex((i) => Math.min(i + 1, wikiResults.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setWikiIndex((i) => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (wikiResults[wikiIndex]) insertWikiLink(wikiResults[wikiIndex])
        return
      }
      if (e.key === 'Escape') { e.preventDefault(); setWikiMenu(null); setWikiQuery(''); wikiAnchorRef.current = null; return }
      // Don't swallow other keys — they'll update the text and handleInput will update wikiQuery
      return
    }

    // ─── Slash menu keyboard handling ───
    if (slashMenu) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIndex((i) => (i + 1) % SLASH_COMMANDS.length); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSlashIndex((i) => (i - 1 + SLASH_COMMANDS.length) % SLASH_COMMANDS.length); return }
      if (e.key === 'Enter') { e.preventDefault(); executeCommand(SLASH_COMMANDS[slashIndex].id); return }
      if (e.key === 'Escape') { e.preventDefault(); setSlashMenu(null); return }
      if (e.key.length === 1 && e.key !== '/') { setSlashMenu(null) }
      return
    }

    if (e.key === ' ') {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return
      const range = sel.getRangeAt(0)
      const node = range.startContainer
      if (node.nodeType !== Node.TEXT_NODE) return
      const text = node.textContent
      const offset = range.startOffset

      // [] checkbox
      if (offset >= 2) {
        const beforeCursor = text.slice(offset - 2, offset)
        if (beforeCursor === '[]') {
          e.preventDefault()
          const textAfter = text.slice(offset)
          const textBefore = text.slice(0, offset - 2)
          const wrapper = document.createElement('label')
          wrapper.className = 'checkbox-item flex items-center gap-2 py-1 cursor-pointer'
          wrapper.contentEditable = 'false'
          const cb = document.createElement('input')
          cb.type = 'checkbox'
          cb.className = 'checkbox-input'
          const span = document.createElement('span')
          span.className = 'checkbox-text flex-1 outline-none min-w-0'
          span.contentEditable = 'true'
          span.textContent = textAfter || '\u00A0'
          wrapper.appendChild(cb)
          wrapper.appendChild(span)
          const parent = node.parentNode
          if (textBefore) {
            node.textContent = textBefore
            parent.insertBefore(wrapper, node.nextSibling)
          } else {
            parent.replaceChild(wrapper, node)
          }
          const newRange = document.createRange()
          const textNode = span.firstChild || span
          newRange.setStart(textNode, 0)
          newRange.collapse(true)
          sel.removeAllRanges()
          sel.addRange(newRange)
          if (ref.current) onChangeRef.current(ref.current.innerHTML)
          return
        }
      }

      // #tag highlight
      const textBefore = text.slice(0, offset)
      const tagMatch = textBefore.match(/#([a-zA-Z0-9_-]+)$/)
      if (tagMatch) {
        const tagStart = tagMatch.index
        const tagEnd = offset
        setTimeout(() => {
          if (!node.parentNode) return
          highlightTag(node, tagStart, tagEnd)
          if (ref.current) onChangeRef.current(ref.current.innerHTML)
        }, 0)
      }
    }
  }, [slashMenu, slashIndex, executeCommand, highlightTag, wikiMenu, wikiResults, wikiIndex, insertWikiLink])

  /* ─── Parse date keywords in checkbox text ─── */
  const parseDateInCheckbox = useCallback((textNode) => {
    const text = textNode.textContent
    const checkboxText = textNode.parentNode
    if (!checkboxText || !checkboxText.classList?.contains('checkbox-text')) return false
    const label = checkboxText.closest('.checkbox-item')
    if (!label) return false
    if (label.querySelector('.due-date-badge')) return false

    let match = text.match(DATE_KEYWORDS)
    if (!match) match = text.match(DATE_FORMAT)
    if (!match) return false

    const keyword = match[0]
    const resolved = resolveDate(keyword)
    if (!resolved) return false

    const before = text.slice(0, match.index)
    const after = text.slice(match.index + keyword.length)
    textNode.textContent = (before + after).replace(/\s{2,}/g, ' ').trim() || '\u00A0'

    const badge = document.createElement('span')
    badge.className = 'due-date-badge inline-flex items-center ml-auto px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[11px] font-medium border border-amber-200 select-none whitespace-nowrap flex-shrink-0'
    badge.contentEditable = 'false'
    badge.setAttribute('data-due', resolved.getTime().toString())
    badge.textContent = '📅 ' + formatDueDate(resolved)
    label.appendChild(badge)

    return true
  }, [])

  /* ─── Parse time keywords in checkbox text for notifications ─── */
  const parseTimeInCheckbox = useCallback((textNode) => {
    const text = textNode.textContent
    const checkboxText = textNode.parentNode
    if (!checkboxText || !checkboxText.classList?.contains('checkbox-text')) return false
    const label = checkboxText.closest('.checkbox-item')
    if (!label) return false
    if (label.querySelector('.time-badge')) return false

    let match = text.match(TIME_24H)
    let regex = TIME_24H
    if (!match) {
      match = text.match(TIME_12H)
      regex = TIME_12H
    }
    if (!match) return false

    const resolved = resolveTime(match, regex)
    if (!resolved) return false

    // Strip the @time from text
    const before = text.slice(0, match.index)
    const after = text.slice(match.index + match[0].length)
    const cleanText = (before + after).replace(/\s{2,}/g, ' ').trim() || '\u00A0'
    textNode.textContent = cleanText

    // Add time badge
    const badge = document.createElement('span')
    badge.className = 'time-badge inline-flex items-center ml-auto px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[11px] font-medium border border-blue-200 select-none whitespace-nowrap flex-shrink-0'
    badge.contentEditable = 'false'
    badge.textContent = '\u23f0 ' + formatTime(resolved)
    label.appendChild(badge)

    // Schedule notification
    const delay = resolved.getTime() - Date.now()
    if (delay > 0 && Notification.permission === 'granted') {
      const timerId = setTimeout(() => {
        new Notification('Zap Reminder \u26a1', {
          body: cleanText,
          icon: '/icon.svg'
        })
        if ('vibrate' in navigator) navigator.vibrate([50, 30, 50])
        notificationTimers.delete(timerId)
      }, delay)
      notificationTimers.add(timerId)
    }

    return true
  }, [])

  const handleInput = useCallback(() => {
    emitChange()
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)
    const node = range.startContainer
    if (node.nodeType !== Node.TEXT_NODE) return
    const text = node.textContent
    const offset = range.startOffset
    const textBefore = text.slice(0, offset)

    // ─── Wiki-link [[ detection ───
    const bracketIdx = textBefore.lastIndexOf('[[')
    if (bracketIdx !== -1) {
      // Check there's no ]] closing yet
      const afterBrackets = textBefore.slice(bracketIdx + 2)
      if (!afterBrackets.includes(']]')) {
        const query = afterBrackets
        setWikiQuery(query)
        if (!wikiMenu) {
          const coords = getCaretCoords()
          if (coords) {
            setWikiMenu(coords)
            setWikiIndex(0)
            wikiAnchorRef.current = { node, bracketIdx }
          }
        }
        return // Don't process slash menu while wiki menu is active
      } else {
        // Closed with ]], dismiss wiki menu
        if (wikiMenu) {
          setWikiMenu(null)
          setWikiQuery('')
          wikiAnchorRef.current = null
        }
      }
    } else if (wikiMenu) {
      // No [[ found anymore, close wiki menu
      setWikiMenu(null)
      setWikiQuery('')
      wikiAnchorRef.current = null
    }

    // Date parsing
    if (textBefore.endsWith(' ') || textBefore.endsWith('\u00A0')) {
      const beforeSpace = textBefore.trimEnd()
      if (DATE_KEYWORDS.test(beforeSpace) || DATE_FORMAT.test(beforeSpace)) {
        const didParse = parseDateInCheckbox(node)
        if (didParse) {
          if (ref.current) onChangeRef.current(ref.current.innerHTML)
          return
        }
      }
      // Time parsing for notifications
      if (TIME_24H.test(beforeSpace) || TIME_12H.test(beforeSpace)) {
        const didParse = parseTimeInCheckbox(node)
        if (didParse) {
          if (ref.current) onChangeRef.current(ref.current.innerHTML)
          return
        }
      }
    }

    // Slash menu
    if (textBefore === '/') {
      const coords = getCaretCoords()
      if (coords) { setSlashMenu(coords); setSlashIndex(0) }
    } else if (slashMenu) {
      setSlashMenu(null)
    }
  }, [slashMenu, wikiMenu, emitChange, parseDateInCheckbox, parseTimeInCheckbox])

  const handleClick = useCallback((e) => {
    const target = e.target

    // ─── Wiki-link click → navigate ───
    if (target.classList?.contains('wiki-link')) {
      e.preventDefault()
      const noteId = target.getAttribute('data-note-id')
      if (noteId && onNavigateRef.current) {
        onNavigateRef.current(noteId)
      }
      return
    }

    // ─── Checkbox click ───
    if (target.tagName === 'INPUT' && target.type === 'checkbox' && target.classList.contains('checkbox-input')) {
      const label = target.closest('.checkbox-item')
      if (!label) return
      const textSpan = label.querySelector('.checkbox-text')
      if (!textSpan) return
      const editor = ref.current
      if (!editor) return

      if (target.checked) {
        label.classList.add('checked')
        textSpan.style.textDecoration = 'line-through'
        textSpan.style.color = '#9ca3af'

        // 🎉 Confetti burst
        confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } })
        // 📳 Haptic tick
        if ('vibrate' in navigator) navigator.vibrate(10)

        let hr = editor.querySelector('hr.completed-divider')
        let heading = editor.querySelector('h3.completed-heading')

        if (!hr) {
          hr = document.createElement('hr')
          hr.className = 'completed-divider border-t border-gray-200 mt-6 mb-3'
          editor.appendChild(hr)
        }
        if (!heading) {
          heading = document.createElement('h3')
          heading.className = 'completed-heading text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2 select-none'
          heading.textContent = 'Completed'
          heading.contentEditable = 'false'
          if (hr.nextSibling) {
            editor.insertBefore(heading, hr.nextSibling)
          } else {
            editor.appendChild(heading)
          }
        }

        editor.appendChild(label)

      } else {
        label.classList.remove('checked')
        textSpan.style.textDecoration = 'none'
        textSpan.style.color = '#1d1d1f'

        const hr = editor.querySelector('hr.completed-divider')
        if (hr) {
          editor.insertBefore(label, hr)
        }

        const heading = editor.querySelector('h3.completed-heading')
        if (heading) {
          const completedItems = editor.querySelectorAll('.checkbox-item.checked')
          if (completedItems.length === 0) {
            if (heading.parentNode) heading.parentNode.removeChild(heading)
            if (hr && hr.parentNode) hr.parentNode.removeChild(hr)
          }
        }
      }

      onChangeRef.current(editor.innerHTML)
    }
  }, [])

  const placeholderId = useMemo(() => Math.floor(Math.random() * 5), [])

  return (
    <>
      <div
        ref={ref}
        className="editor-content px-5 py-6 w-full h-full outline-none border-none ring-0 focus:ring-0 resize-none"
        data-placeholder={placeholderId}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        spellCheck
      />
      {slashMenu && (
        <SlashMenu
          ref={slashMenuRef}
          x={slashMenu.x}
          y={slashMenu.y}
          activeIndex={slashIndex}
          onSelect={(id) => executeCommand(id)}
          onHover={(i) => setSlashIndex(i)}
        />
      )}
      {wikiMenu && (
        <WikiLinkMenu
          ref={wikiMenuRef}
          x={wikiMenu.x}
          y={wikiMenu.y}
          items={wikiResults}
          activeIndex={wikiIndex}
          onSelect={(note) => insertWikiLink(note)}
          onHover={(i) => setWikiIndex(i)}
        />
      )}
    </>
  )
}

export default ContentEditable
