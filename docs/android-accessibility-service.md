# Android Accessibility Service for Automatic YouTube Tracking

## How It Would Work

An Android Accessibility Service can "see" what's on screen in other apps. Here's the flow:

1. **You install the app** and grant Accessibility permission
2. **You watch YouTube normally** in the YouTube app
3. **The service detects** when you're watching a video by reading screen content (video title, channel name, URL from share sheet, etc.)
4. **Automatically saves** the video to your data (either local storage or syncs to GitHub)
5. **YTNotes PWA** pulls the same `data.json` from GitHub and shows your history

**How automatic?** Very automatic once set up - you'd just watch videos and they'd appear in YTNotes without any taps.

---

## Project Outline

### Components Needed

1. **Android App (Kotlin/Java)**
   - Accessibility Service to monitor YouTube
   - Logic to extract video info from screen content
   - GitHub API integration to push to `youtube/data.json`
   - Settings screen for GitHub token

2. **Permissions Required**
   - Accessibility Service permission (user must manually enable in Settings)
   - Internet permission

### Development Steps

| Step | Task |
|------|------|
| 1 | Set up Android Studio project |
| 2 | Create basic Accessibility Service |
| 3 | Detect when YouTube is in foreground |
| 4 | Extract video title/channel from screen nodes |
| 5 | Parse video ID (from share intent or URL detection) |
| 6 | Add GitHub sync logic (reuse your existing merge strategy) |
| 7 | Settings UI for GitHub credentials |
| 8 | Background service management (battery optimization) |

### Estimated Complexity

- **If you know Android dev**: A weekend project
- **If new to Android**: 1-2 weeks learning curve + building
- **Lines of code**: ~500-1000 for a basic version

### Challenges

- Accessibility Services are sensitive - Google Play has strict policies
- YouTube UI changes could break detection
- Battery usage needs careful management
- Getting video ID reliably is tricky (might need to trigger share intent programmatically or parse URLs from accessibility nodes)

---

## Status

**Not started** - Saved as a future exploration option.
