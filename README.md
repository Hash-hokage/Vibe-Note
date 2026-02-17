<div align="center">

# ⚡ Zap

**Lightning fast notes. Offline ready. Zero friction.**

[![Built with React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Powered by Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Styled with Tailwind](https://img.shields.io/badge/Tailwind_CSS-3-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-FFD700?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)

</div>

---

## 🧠 What is Zap?

Zap is a **Progressive Web App** for capturing ideas at the speed of thought. It combines the simplicity of Apple Notes with powerful productivity features like bi-directional linking, daily notes, and a global task manager — all running locally in your browser with **zero backend** and **full offline support**.

---

## ✨ Features

### 📝 Rich Text Editing
- `contentEditable`-powered editor with a clean, distraction-free interface
- Supports headings, inline formatting, and multi-line content

### ☑️ Smart Checkboxes
- Type `[]` + `Space` to instantly create interactive checkboxes
- Checked items automatically move to a **"Completed"** section at the bottom
- Unchecking moves them back — everything stays organized

### 🏷️ Inline Tags
- Type `#tagname` + `Space` to create highlighted, clickable tags
- Tags are extracted to metadata and displayed in the sidebar
- Click any tag to **filter notes** by topic

### ⚡ Slash Commands
- Type `/` to open a floating command menu
- Available commands:
  - **To-do** — Insert a checkbox
  - **Heading** — Insert an `<h2>` heading
  - **Date** — Stamp today's date as a styled badge

### 🔗 Bi-directional Wiki Links
- Type `[[` to open a **note picker popup**
- Search and select any note to insert a clickable `[[Link]]`
- Clicking a link navigates to the referenced note
- A **"🔗 Linked Here"** section appears at the bottom of any note that other notes point to

### 📅 Daily Notes & Calendar
- **Auto-creation**: On app open, today's daily note is created if it doesn't exist
- **Template**: Pre-filled with `## Focus` (with a checkbox) and `## Log` sections
- **Pinned**: Today's note is always pinned to the top of the sidebar with a warm amber highlight
- **Calendar View**: Click the 📅 icon in the sidebar to open a month grid — click any date to open or create its daily note

### 🔍 Command Palette
- Press `Ctrl+K` / `Cmd+K` to open a spotlight-style search
- Search notes by title, or create a new note instantly
- Full keyboard navigation with `↑↓`, `Enter`, and `Escape`

### ☑️ Global Tasks View ("My Tasks")
- One-click view of **all unchecked tasks** across every note
- Shows source note name and due dates
- Click any task to jump to its source note

### 📅 Due Dates
- Type `today`, `tomorrow`, or `MM/DD` inside a checkbox line
- Automatically parsed into a styled date badge
- Due dates appear in the global tasks view

### 💾 Data Management
- **Auto-save** to `localStorage` — your notes persist across sessions
- **Export**: Download all notes as a JSON backup
- **Import**: Restore from a previously exported file

### 📱 Progressive Web App
- **Installable** on desktop and mobile (Chrome, Edge, Safari)
- **Offline-capable** via auto-updating service worker
- **Standalone mode** — runs like a native app with no browser chrome

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | React 19 |
| **Build Tool** | Vite 7 |
| **Styling** | Tailwind CSS 3 |
| **PWA** | vite-plugin-pwa (Workbox) |
| **Persistence** | localStorage |
| **Typography** | Inter (Google Fonts) |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 20.19+ or 22.12+ (recommended)
- **npm** 10+

### Installation

```bash
# Clone the repository
git clone https://github.com/Hash-hokage/Vibe-Note.git
cd Vibe-Note

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at `http://localhost:5174/`.

### Production Build

```bash
# Build for production (generates PWA assets)
npm run build

# Preview the production build
npm run preview
```

---

## 📁 Project Structure

```
Vibe-Note/
├── public/
│   └── icon.svg              # PWA icon (lightning bolt)
├── src/
│   ├── components/
│   │   ├── Editor.jsx         # ContentEditable engine, parsers, wiki-link popup
│   │   └── Sidebar.jsx        # Navigation, search, calendar, tags, settings
│   ├── App.jsx                # State management hub, command palette, tasks view
│   ├── index.css              # Tailwind directives & custom styles
│   └── main.jsx               # React entry point
├── index.html                 # HTML shell with PWA meta tags
├── vite.config.js             # Vite + PWA plugin configuration
├── tailwind.config.js         # Tailwind theme (Apple-inspired palette)
├── postcss.config.js          # PostCSS pipeline
└── package.json
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + K` | Open Command Palette |
| `[]` + `Space` | Create a checkbox |
| `#tag` + `Space` | Create an inline tag |
| `/` | Open slash command menu |
| `[[` | Open wiki-link note picker |
| `↑ ↓` | Navigate menus |
| `Enter` | Select menu item |
| `Escape` | Close any popup/menu |

---

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'The Amazing Feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

<div align="center">

**Built with ⚡ by the Zap Team**

</div>
