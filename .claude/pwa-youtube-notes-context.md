# YouTube Notes PWA - Project Context

## Quick Start
This is a YouTube video notes tracking PWA that syncs via GitHub. Built with vanilla JavaScript (no frameworks/build tools).

**Recent Session:** Refer to `docs/youtube-pwa-enhancements-2026-01-21.md` for latest changes.

## Project Structure
```
pwa/
├── docs/
│   ├── youtube-pwa/          # Main PWA application
│   │   ├── index.html        # UI with embedded CSS
│   │   ├── app.js            # Core application logic
│   │   ├── manifest.json     # PWA manifest
│   │   └── sw.js             # Service worker
│   └── youtube-pwa-enhancements-2026-01-21.md  # Latest changes
├── youtube/
│   └── data.json            # GitHub-synced data store (in main repo)
└── CLAUDE.md                # Project instructions
```

## Key Files & Their Purpose

### docs/youtube-pwa/index.html
- Single-file PWA with embedded CSS (lines 13-476)
- Dark theme UI (#1a1a1a background, #3ea6ff accent)
- Contains: Setup screen, URL input panel, video list, FAB button
- **Recent additions:** FAB button (line 533), URL input panel (lines 492-499), clickable timestamp styling (lines 344-353)

### docs/youtube-pwa/app.js
- Vanilla JavaScript, ES6+
- **Key patterns:**
  - Local-first: localStorage → GitHub sync
  - Event-driven: `handleAction(e)` centralizes all user actions
  - Debounced sync: 2-second delay on data changes

- **Important functions:**
  - `pullFromGitHub()` / `pushToGitHub()` - Sync logic
  - `mergeData()` - Intelligent merge of local/remote data
  - `renderUI()` / `renderList()` - Main render functions
  - `handleAction()` - Centralized event handler (lines 267-310)
  - `showUrlInputPanel()` / `hideUrlInputPanel()` - New URL input UX (lines 102-110)

### Data Model (youtube/data.json)
```json
{
  "version": 2,
  "lastUpdated": "ISO-8601",
  "watchHistory": [{"videoId": "string", "timestamp": "ISO-8601"}],
  "videos": {
    "videoId": {
      "videoId": "string",
      "title": "string",
      "channel": "string",
      "url": "string",
      "timestamp": "ISO-8601",
      "notes": [{"time": 0, "timeStr": "0:00", "text": "string", "created": "ISO-8601"}],
      "read": false
    }
  }
}
```

## Recent Changes (2026-01-21)

### 1. Floating Action Button (FAB)
- **Location:** index.html:455-475 (CSS), line 533 (HTML), app.js:678-680 (handler)
- **Purpose:** Replace old "Add URL" button with modern circular FAB
- **Styling:** 56px diameter, blue (#3ea6ff), bottom-right corner

### 2. URL Input Panel
- **Location:** index.html:492-499, app.js:102-110, 682-712
- **Purpose:** Replace `prompt()` with proper UI panel
- **Flow:** Click FAB → URL input → Next → Video details → Save

### 3. Clickable Timestamps
- **Location:** app.js:238 (HTML), 279-282 (handler), index.html:344-353 (CSS)
- **Purpose:** Click note timestamp to open video at that time
- **URL format:** `https://youtube.com/watch?v={videoId}&t={time}s`

## Common Tasks

### Make Code Changes
1. Edit `docs/youtube-pwa/index.html` or `app.js`
2. Test locally by opening index.html in browser
3. Changes auto-deploy via GitHub Pages

### Update PWA on Devices
- **Desktop:** Hard refresh (Ctrl+Shift+R)
- **Android:** Pull-down refresh or clear cache

### Debug Issues
- Check browser DevTools console
- Verify localStorage: `yt-notes-settings`, `yt-notes-data`
- Check GitHub API responses in Network tab

### Add New Features
1. Read CLAUDE.md for architecture patterns
2. Use centralized `handleAction()` for user actions
3. Follow local-first pattern: update localStorage → debounced sync
4. Use `showToast()` for user feedback

## Tech Stack
- **Frontend:** Vanilla JS (ES6+), HTML5, CSS3
- **Storage:** localStorage (local) + GitHub API (sync)
- **PWA:** Service Worker, Web App Manifest
- **Deployment:** GitHub Pages (https://allancto.github.io/pwa/youtube-pwa/)

## Important Notes
- **No build system** - Files served directly
- **Service worker path:** /pwa/youtube-pwa/sw.js
- **Data location:** youtube/data.json in user's GitHub repo
- **Default branch:** master (configurable)
- **Auto-sync:** 2-second debounce after changes

## Git Workflow
- **Main repo:** C:\dev\pwa
- **Current worktree:** C:\Users\Dad\.claude-worktrees\pwa\practical-cohen
- **Branch:** practical-cohen
- **Publishing:** Merges to main deploy to GitHub Pages

## localStorage Keys
- `yt-notes-settings` - GitHub token, owner, repo, branch
- `yt-notes-data` - Full application data
- `yt-notes-last-sync` - Last sync timestamp

## Event Handler Actions
All user actions route through `handleAction(e)`:
- `toggle-read` - Toggle video read/unread status
- `watch` - Open video from beginning
- `watch-at-time` - Open video at specific timestamp
- `delete` - Delete video
- `add-note` - Add note to video
- `delete-note` - Delete specific note

## Testing Checklist
- [ ] FAB button appears and opens URL input panel
- [ ] Can add video via URL input
- [ ] Note timestamps are clickable
- [ ] Clicking timestamp opens video at correct time
- [ ] Mark Read toggles video status
- [ ] Filters (All/Unread/Read) work
- [ ] Sync button syncs to GitHub
- [ ] Data persists across refreshes

## Next Steps / Ideas
- Add timestamp input when creating notes (currently defaults to 0:00)
- Fetch video metadata from YouTube API
- Add search/filter for notes
- Export notes to markdown
- Keyboard shortcuts
