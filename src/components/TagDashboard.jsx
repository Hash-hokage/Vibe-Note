import React from 'react'

export default function TagDashboard({ notes, activeTag, onNavigate, onClose, isDarkMode }) {
  if (!activeTag) return null

  // Extract snippets
  const snippets = []
  notes.forEach(note => {
    // Create temp div to parse HTML
    const tmp = document.createElement('div')
    tmp.innerHTML = note.content
    
    // Check paragraphs and list items
    const elements = tmp.querySelectorAll('p, li, div, h1, h2, h3')
    elements.forEach(el => {
      if (el.textContent.toLowerCase().includes(`#${activeTag}`)) {
        snippets.push({
          id: note.id,
          title: note.title || 'Untitled',
          content: el.textContent.trim(),
          date: note.updatedAt
        })
      }
    })
  })

  // Dedup snippets (some might be duplicates if nested)
  const uniqueSnippets = snippets.filter((v, i, a) => a.findIndex(t => t.content === v.content && t.id === v.id) === i)

  return (
    <div className={`h-full flex flex-col ${isDarkMode ? 'bg-zinc-950 text-gray-100' : 'bg-apple-bg text-gray-900'} overflow-hidden`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-6 py-4 border-b ${isDarkMode ? 'border-zinc-800' : 'border-gray-200'}`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-apple-blue">#{activeTag}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isDarkMode ? 'bg-zinc-800 text-gray-400' : 'bg-gray-200 text-gray-600'}`}>
            {uniqueSnippets.length} refs
          </span>
        </div>
        <button 
          onClick={onClose}
          className={`w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200/50 transition-colors text-xl font-bold ${isDarkMode ? 'text-gray-400 hover:bg-white/10' : 'text-gray-500'}`}
          title="Close View"
        >
          ×
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {uniqueSnippets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 opacity-60">
            <span className="text-4xl mb-2">🏷️</span>
            <p>No mentions found for #{activeTag}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {uniqueSnippets.map((snippet, idx) => (
              <div 
                key={`${snippet.id}-${idx}`}
                onClick={() => onNavigate(snippet.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 hover:scale-[1.01] hover:shadow-sm
                  ${isDarkMode 
                    ? 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800' 
                    : 'bg-white border-gray-200 hover:bg-white hover:border-gray-300 shadow-sm'}`}
              >
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2 flex justify-between">
                  <span className="truncate max-w-[70%]">{snippet.title}</span>
                  <span>{new Date(snippet.date).toLocaleDateString()}</span>
                </div>
                <div className={`text-sm leading-relaxed ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {snippet.content.split(new RegExp(`(#${activeTag})`, 'gi')).map((part, i) => 
                    part.toLowerCase() === `#${activeTag}` 
                      ? <span key={i} className="text-apple-blue font-bold">{part}</span> 
                      : part
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
