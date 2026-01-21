# New Session Starter Template

Copy-paste this at the start of a new Claude Code session to give instant context:

---

## Project Context

This is the **YouTube Notes PWA** project - a video tracking and notes app that syncs via GitHub.

**Important files to check first:**
1. Read `.claude/pwa-youtube-notes-context.md` - Full project overview
2. Read `docs/youtube-pwa-enhancements-2026-01-21.md` - Latest session changes
3. Read `CLAUDE.md` - Project instructions

**Key info:**
- Location: `docs/youtube-pwa/` (index.html, app.js)
- Tech: Vanilla JS, no build system
- Deployment: GitHub Pages at https://allancto.github.io/pwa/youtube-pwa/
- Data syncs to: `youtube/data.json` in user's GitHub repo

**Recent changes (2026-01-21):**
- Added FAB (floating action button) for adding videos
- Replaced `prompt()` with URL input panel
- Made note timestamps clickable to jump to video time

**Current worktree:** practical-cohen (branch: practical-cohen)
**Main repo:** C:\dev\pwa

---

## Quick Commands for Claude

**To understand the project:**
```
Read .claude/pwa-youtube-notes-context.md
Read docs/youtube-pwa-enhancements-2026-01-21.md
```

**To make changes:**
```
Edit docs/youtube-pwa/index.html
Edit docs/youtube-pwa/app.js
```

**To test:**
Open `docs/youtube-pwa/index.html` in browser

---

## Common Requests

**"Add a feature"** → Check pwa-youtube-notes-context.md for patterns, then edit index.html/app.js

**"Fix a bug"** → Read the relevant files first, then debug

**"Update documentation"** → Edit docs/youtube-pwa-enhancements-2026-01-21.md or pwa-youtube-notes-context.md

**"Deploy changes"** → Changes auto-deploy via GitHub Pages when merged to main

---

After pasting this, follow up with: "Read the project context files and confirm you understand the project"
