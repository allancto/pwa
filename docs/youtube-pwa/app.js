// YouTube Notes PWA - v2 with mark-as-read and inline notes

// Register service worker for PWA install and share target
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/pwa/youtube-pwa/sw.js')
    .then(reg => console.log('SW registered:', reg.scope))
    .catch(err => console.log('SW registration failed:', err));
}

const GITHUB_API = 'https://api.github.com';
const DATA_PATH = 'youtube/data.json';
const STORAGE_KEY = 'yt-notes-settings';
const DATA_KEY = 'yt-notes-data';

let settings = {};
let appData = { watchHistory: [], videos: {} };
let currentTab = 'history';
let currentFilter = 'all';
let expandedVideoId = null;
let pendingShare = null;
let syncTimeout = null;
let toastTimeout = null;

async function init() {
  settings = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  checkShareIntent();
  
  // Wire up toast close button
  document.getElementById('toast-close').addEventListener('click', hideToast);
  
  if (!settings.token || !settings.owner) {
    showSetup();
    return;
  }
  showLoading(true);
  const result = await pullFromGitHub();
  showLoading(false);
  if (!result.success && result.error) {
    // Show error but still proceed to main screen
    showToast('Sync: ' + result.error, 'error');
  }
  showMain();
  renderUI();
  if (pendingShare) {
    showSharePanel(pendingShare);
  }
}

function checkShareIntent() {
  const params = new URLSearchParams(window.location.search);
  const url = params.get('url') || params.get('text') || '';
  const title = params.get('title') || '';
  const videoId = extractVideoId(url);
  if (videoId) {
    pendingShare = { videoId, url, title };
    history.replaceState(null, '', window.location.pathname);
  }
}

function extractVideoId(text) {
  if (!text) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function showLoading(show) {
  document.getElementById('loading').classList.toggle('hidden', !show);
}

function showSetup() {
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('setup').classList.add('visible');
  document.getElementById('main').classList.remove('visible');
}

function showMain() {
  document.getElementById('setup').classList.remove('visible');
  document.getElementById('main').classList.add('visible');
}

function showSharePanel(share) {
  const panel = document.getElementById('share-panel');
  const video = appData.videos[share.videoId];
  document.getElementById('share-video-title').textContent = video?.title || share.title || share.videoId;
  document.getElementById('share-video-channel').textContent = video?.channel || '';
  document.getElementById('share-note').value = '';
  panel.classList.add('visible');
}

function hideSharePanel() {
  document.getElementById('share-panel').classList.remove('visible');
  pendingShare = null;
}

function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-msg');
  msgEl.textContent = message;
  toast.className = 'toast visible ' + type;
  
  // Clear any existing timeout
  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }
  
  // Auto-hide success messages after 3s, errors stay until dismissed
  if (type === 'success') {
    toastTimeout = setTimeout(hideToast, 3000);
  }
}

function hideToast() {
  const toast = document.getElementById('toast');
  toast.classList.remove('visible');
  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }
}

function renderUI() {
  renderStats();
  renderList();
  updateSyncStatus();
}

function renderStats() {
  const history = appData.watchHistory || [];
  let withNotes = 0;
  let unread = 0;
  for (const h of history) {
    const v = appData.videos[h.videoId];
    if (v) {
      if ((v.notes || []).length > 0) withNotes++;
      if (!v.read) unread++;
    } else {
      unread++;
    }
  }
  document.getElementById('watch-count').textContent = history.length;
  document.getElementById('unread-count').textContent = unread;
  document.getElementById('notes-count').textContent = withNotes;
}

function renderList() {
  const list = document.getElementById('video-list');
  let videos = [];
  
  if (currentTab === 'history') {
    videos = (appData.watchHistory || []).map(h => ({
      ...h,
      ...(appData.videos[h.videoId] || {})
    }));
  } else {
    for (const id in appData.videos) {
      const v = appData.videos[id];
      if (v.notes && v.notes.length > 0) {
        videos.push(v);
      }
    }
    videos.sort((a, b) => {
      const aLast = a.notes?.[a.notes.length - 1]?.created || '';
      const bLast = b.notes?.[b.notes.length - 1]?.created || '';
      return bLast.localeCompare(aLast);
    });
  }
  
  // Apply filter
  if (currentFilter === 'unread') {
    videos = videos.filter(v => !v.read);
  } else if (currentFilter === 'read') {
    videos = videos.filter(v => v.read);
  }
  
  if (videos.length === 0) {
    const emptyMsg = currentFilter === 'unread' ? 'All caught up! 🎉' : 
                     currentFilter === 'read' ? 'No read videos' :
                     currentTab === 'history' ? 'No videos watched yet' : 'No videos with notes';
    list.innerHTML = `<div class="empty-state">${emptyMsg}</div>`;
    return;
  }
  
  list.innerHTML = videos.map(v => {
    const notesCount = v.notes?.length || 0;
    const isRead = v.read || false;
    const isExpanded = expandedVideoId === v.videoId;
    const notes = v.notes || [];
    
    return `
      <div class="video-item ${isRead ? 'read' : ''} ${isExpanded ? 'expanded' : ''}" data-id="${v.videoId}">
        <div class="video-header">
          <div class="video-status">${isRead ? '✓' : '○'}</div>
          <div class="video-info">
            <div class="video-title">${v.title || v.videoId}</div>
            <div class="video-channel">${v.channel || ''}</div>
            <div class="video-meta">
              ${v.timestamp ? formatDate(v.timestamp) : ''}
              ${notesCount > 0 ? ` • ${notesCount} note${notesCount !== 1 ? 's' : ''}` : ''}
            </div>
          </div>
          <div class="video-expand">▼</div>
        </div>
        <div class="video-details">
          <div class="video-actions">
            <button class="btn-read ${isRead ? 'is-read' : ''}" data-action="toggle-read" data-id="${v.videoId}">
              ${isRead ? '✓ Read' : '○ Mark Read'}
            </button>
            <button class="btn-watch" data-action="watch" data-id="${v.videoId}">▶ Watch</button>
            <button class="btn-delete" data-action="delete" data-id="${v.videoId}">🗑</button>
          </div>
          <div class="note-input-row">
            <input type="text" class="note-input" placeholder="Add a note..." data-id="${v.videoId}">
            <button class="btn-add-note" data-action="add-note" data-id="${v.videoId}">Add</button>
          </div>
          ${notes.length > 0 ? `
            <div class="notes-list">
              <div class="notes-label">Notes:</div>
              ${notes.map((n, i) => `
                <div class="note-item">
                  <span class="note-time">${n.timeStr || '0:00'}</span>
                  ${n.text}
                  <button class="note-delete" data-action="delete-note" data-id="${v.videoId}" data-index="${i}">×</button>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
  
  // Attach event listeners
  list.querySelectorAll('.video-header').forEach(header => {
    header.addEventListener('click', (e) => {
      const id = header.parentElement.dataset.id;
      toggleExpand(id);
    });
  });
  
  list.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', handleAction);
  });
  
  list.querySelectorAll('.note-input').forEach(input => {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addNoteToVideo(input.dataset.id, input.value);
        input.value = '';
      }
    });
  });
}

function toggleExpand(videoId) {
  expandedVideoId = expandedVideoId === videoId ? null : videoId;
  renderList();
}

function handleAction(e) {
  e.stopPropagation();
  const action = e.target.dataset.action;
  const videoId = e.target.dataset.id;
  
  switch(action) {
    case 'toggle-read':
      toggleRead(videoId);
      break;
    case 'watch':
      window.open(`https://youtube.com/watch?v=${videoId}`, '_blank');
      break;
    case 'delete':
      if (confirm('Delete this video?')) {
        deleteVideo(videoId);
      }
      break;
    case 'add-note':
      const input = document.querySelector(`.note-input[data-id="${videoId}"]`);
      if (input && input.value.trim()) {
        addNoteToVideo(videoId, input.value);
        input.value = '';
      }
      break;
    case 'delete-note':
      const index = parseInt(e.target.dataset.index);
      deleteNote(videoId, index);
      break;
  }
}

function toggleRead(videoId) {
  if (!appData.videos[videoId]) {
    appData.videos[videoId] = { videoId };
  }
  appData.videos[videoId].read = !appData.videos[videoId].read;
  saveLocal();
  renderUI();
  debouncedSync();
}

function addNoteToVideo(videoId, text) {
  if (!text.trim()) return;
  
  if (!appData.videos[videoId]) {
    appData.videos[videoId] = { videoId, notes: [] };
  }
  if (!appData.videos[videoId].notes) {
    appData.videos[videoId].notes = [];
  }
  
  appData.videos[videoId].notes.push({
    time: 0,
    timeStr: '0:00',
    text: text.trim(),
    created: new Date().toISOString()
  });
  
  saveLocal();
  renderUI();
  showToast('Note added', 'success');
  debouncedSync();
}

function deleteNote(videoId, index) {
  if (appData.videos[videoId]?.notes) {
    appData.videos[videoId].notes.splice(index, 1);
    saveLocal();
    renderUI();
    debouncedSync();
  }
}

function debouncedSync() {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    pushToGitHub().then(result => {
      if (result.success) {
        updateSyncStatus();
      } else {
        showToast('Auto-sync failed: ' + result.error, 'error');
      }
    });
  }, 2000);
}

function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

function updateSyncStatus() {
  const el = document.getElementById('sync-status');
  const lastSync = localStorage.getItem('yt-notes-last-sync');
  if (lastSync) {
    el.textContent = `Last synced: ${formatDate(lastSync)}`;
    el.className = 'sync-status success';
  } else {
    el.textContent = '';
  }
}

async function pullFromGitHub() {
  try {
    const response = await githubRequest(
      `${GITHUB_API}/repos/${settings.owner}/${settings.repo}/contents/${DATA_PATH}?ref=${settings.branch || 'master'}`
    );
    const content = atob(response.content);
    const remoteData = JSON.parse(content);
    appData = mergeData(appData, remoteData);
    saveLocal();
    return { success: true };
  } catch (e) {
    if (e.message.includes('404') || e.message.includes('Not Found')) {
      // No data file yet - that's OK, we'll create it on first sync
      loadLocal();
      return { success: true };
    }
    console.error('Pull failed:', e);
    loadLocal();
    return { success: false, error: e.message };
  }
}

async function pushToGitHub() {
  try {
    let sha = null;
    try {
      const existing = await githubRequest(
        `${GITHUB_API}/repos/${settings.owner}/${settings.repo}/contents/${DATA_PATH}?ref=${settings.branch || 'master'}`
      );
      sha = existing.sha;
    } catch (e) {
      // File doesn't exist yet, that's fine
    }
    const exportData = {
      version: 2,
      lastUpdated: new Date().toISOString(),
      watchHistory: appData.watchHistory,
      videos: appData.videos
    };
    const content = JSON.stringify(exportData, null, 2);
    await githubRequest(
      `${GITHUB_API}/repos/${settings.owner}/${settings.repo}/contents/${DATA_PATH}`,
      'PUT',
      {
        message: `Sync YouTube data - ${new Date().toISOString()}`,
        content: btoa(unescape(encodeURIComponent(content))),
        branch: settings.branch || 'master',
        ...(sha && { sha })
      }
    );
    localStorage.setItem('yt-notes-last-sync', new Date().toISOString());
    return { success: true };
  } catch (e) {
    console.error('Push failed:', e);
    return { success: false, error: e.message };
  }
}

async function fullSync() {
  showLoading(true);
  const pullResult = await pullFromGitHub();
  if (!pullResult.success) {
    showLoading(false);
    showToast('Pull failed: ' + pullResult.error, 'error');
    renderUI();
    return;
  }
  const pushResult = await pushToGitHub();
  showLoading(false);
  renderUI();
  if (pushResult.success) {
    showToast('Synced!', 'success');
  } else {
    showToast('Push failed: ' + pushResult.error, 'error');
  }
}

function mergeData(local, remote) {
  const merged = {
    watchHistory: [...(local.watchHistory || [])],
    videos: { ...(local.videos || {}) }
  };
  const localIds = new Set(merged.watchHistory.map(h => h.videoId));
  (remote.watchHistory || []).forEach(rh => {
    if (!localIds.has(rh.videoId)) {
      merged.watchHistory.push(rh);
    }
  });
  merged.watchHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  for (const id in (remote.videos || {})) {
    if (!merged.videos[id]) {
      merged.videos[id] = remote.videos[id];
    } else {
      // Merge video data
      const local_v = merged.videos[id];
      const remote_v = remote.videos[id];

      // Preserve fields from remote that local might not have
      if (remote_v.duration && !local_v.duration) {
        local_v.duration = remote_v.duration;
        local_v.durationStr = remote_v.durationStr;
      }
      if (remote_v.title && !local_v.title) {
        local_v.title = remote_v.title;
      }
      if (remote_v.channel && !local_v.channel) {
        local_v.channel = remote_v.channel;
      }

      // Take the most recent read state
      if (remote_v.read !== undefined) {
        local_v.read = local_v.read || remote_v.read;
      }

      // Merge notes
      const localNotes = local_v.notes || [];
      const remoteNotes = remote_v.notes || [];
      const noteKey = n => `${n.time}-${n.text}`;
      const localKeys = new Set(localNotes.map(noteKey));
      remoteNotes.forEach(rn => {
        if (!localKeys.has(noteKey(rn))) {
          localNotes.push(rn);
        }
      });
      localNotes.sort((a, b) => a.time - b.time);
      local_v.notes = localNotes;
    }
  }
  return merged;
}

function saveLocal() {
  localStorage.setItem(DATA_KEY, JSON.stringify(appData));
}

function loadLocal() {
  const saved = localStorage.getItem(DATA_KEY);
  if (saved) {
    appData = JSON.parse(saved);
  }
}

function addVideo(videoId, title, channel, note) {
  const now = new Date().toISOString();
  if (!appData.watchHistory.find(h => h.videoId === videoId)) {
    appData.watchHistory.unshift({ videoId, timestamp: now });
  }
  if (!appData.videos[videoId]) {
    appData.videos[videoId] = {
      videoId,
      title: title || videoId,
      channel: channel || '',
      url: `https://youtube.com/watch?v=${videoId}`,
      timestamp: now,
      notes: [],
      read: false
    };
  }
  if (note && note.trim()) {
    appData.videos[videoId].notes.push({
      time: 0,
      timeStr: '0:00',
      text: note.trim(),
      created: now
    });
  }
  saveLocal();
}

function deleteVideo(videoId) {
  appData.watchHistory = appData.watchHistory.filter(h => h.videoId !== videoId);
  delete appData.videos[videoId];
  saveLocal();
  expandedVideoId = null;
  renderUI();
  debouncedSync();
}

async function githubRequest(url, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${settings.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const msg = error.message || `HTTP ${response.status}`;
    throw new Error(msg);
  }
  return response.json();
}

async function testConnection() {
  // First test: can we authenticate at all?
  try {
    const user = await githubRequest(`${GITHUB_API}/user`);
    return { success: true, username: user.login };
  } catch (e) {
    return { success: false, error: 'Auth failed: ' + e.message };
  }
}

async function testRepoAccess() {
  // Second test: can we access the repo?
  try {
    await githubRequest(`${GITHUB_API}/repos/${settings.owner}/${settings.repo}`);
    return { success: true };
  } catch (e) {
    return { success: false, error: `Repo access failed: ${settings.owner}/${settings.repo} - ${e.message}` };
  }
}

document.addEventListener('DOMContentLoaded', init);

document.getElementById('setup-save').addEventListener('click', async () => {
  const token = document.getElementById('setup-token').value.trim();
  const owner = document.getElementById('setup-owner').value.trim();
  const repo = document.getElementById('setup-repo').value.trim() || 'clodcode';
  const branch = document.getElementById('setup-branch').value.trim() || 'master';

  if (!token || !owner) {
    showToast('Please enter token and owner', 'error');
    return;
  }

  settings = { token, owner, repo, branch };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  
  showLoading(true);
  
  // Test authentication first
  const authTest = await testConnection();
  if (!authTest.success) {
    showLoading(false);
    showToast(authTest.error, 'error');
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  
  // Test repo access
  const repoTest = await testRepoAccess();
  if (!repoTest.success) {
    showLoading(false);
    showToast(repoTest.error, 'error');
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  
  // Now try to pull data
  const result = await pullFromGitHub();
  showLoading(false);
  
  showMain();
  renderUI();
  showToast(`Connected as ${authTest.username}!`, 'success');
});

document.getElementById('settings-btn').addEventListener('click', (e) => {
  e.preventDefault();
  if (confirm('Reset settings and reconnect?')) {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }
});

document.getElementById('refresh-btn').addEventListener('click', async (e) => {
  e.preventDefault();
  await fullSync();
});

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentTab = tab.dataset.tab;
    expandedVideoId = null;
    renderList();
  });
});

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    expandedVideoId = null;
    renderList();
  });
});

document.getElementById('sync-btn').addEventListener('click', fullSync);

document.getElementById('add-btn').addEventListener('click', () => {
  const url = prompt('Paste YouTube URL:');
  const videoId = extractVideoId(url);
  if (videoId) {
    pendingShare = { videoId, url };
    showSharePanel(pendingShare);
  } else if (url) {
    showToast('Invalid YouTube URL', 'error');
  }
});

document.getElementById('share-cancel').addEventListener('click', hideSharePanel);

document.getElementById('share-save').addEventListener('click', async () => {
  if (!pendingShare) return;
  const note = document.getElementById('share-note').value;
  const title = document.getElementById('share-video-title').textContent;
  const channel = document.getElementById('share-video-channel').textContent;
  addVideo(pendingShare.videoId, title, channel, note);
  hideSharePanel();
  renderUI();
  showToast('Video saved!', 'success');
  await pushToGitHub();
  updateSyncStatus();
});
