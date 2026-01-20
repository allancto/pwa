# CLAUDE.md

## Project Overview

YouTube video tracking and notes PWA that syncs data across devices via GitHub. Built with vanilla JavaScript, HTML5, and CSS3 (no frameworks or build tools).

## Directory Structure

```
pwa/
├── youtube-pwa/          # Main PWA application
│   ├── index.html        # UI with embedded CSS
│   ├── app.js            # Core application logic
│   └── manifest.json     # PWA manifest for installation
└── youtube/
    └── data.json         # GitHub-synced data store
```

## Tech Stack

- Vanilla JavaScript (ES6+)
- HTML5 / CSS3
- PWA (Service Worker, Web App Manifest)
- GitHub API for data sync
- localStorage for local persistence

## No Build System

This is a static PWA - no compilation, bundling, or npm required. Files are served directly.

## Architecture Patterns

- **Local-first**: Data in localStorage, synced to GitHub
- **Event-driven**: Dynamic event listeners on UI elements
- **Debounced sync**: Auto-sync to GitHub after 2-second debounce
- **Share intent handling**: Receives URLs via OS share menu query params

## Data Model

```javascript
appData = {
  watchHistory: [{ videoId, timestamp }],
  videos: {
    [videoId]: {
      videoId, title, channel, url, timestamp,
      notes: [{ time, timeStr, text, created }],
      read: boolean
    }
  }
}
```

## Key Functions (app.js)

- `pullFromGitHub()` / `pushToGitHub()` - GitHub API sync
- `mergeData()` - Intelligent merge of local and remote data
- `renderUI()` - Main render (stats, video list)
- `handleAction()` - Centralized event handler for video actions
- `extractVideoId()` - Parse YouTube URLs (supports multiple formats)

## LocalStorage Keys

- `yt-notes-settings` - GitHub credentials and config
- `yt-notes-data` - Application data
- `yt-notes-last-sync` - Last sync timestamp

## UI Conventions

- Dark theme with `#1a1a1a` background, `#3ea6ff` accent
- Tabs: "History" (all videos), "With Notes" (filtered)
- Filters: All/Unread/Read
- Toast notifications: auto-hide on success, persistent with close button on error

## GitHub Integration

- Requires personal access token with 'repo' scope
- Stores data at `youtube/data.json` in user's repo
- Supports custom branch (defaults to 'main')
