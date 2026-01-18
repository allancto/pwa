// YouTube Notes PWA

const GITHUB_API = 'https://api.github.com';
const DATA_PATH = 'youtube/data.json';
const STORAGE_KEY = 'yt-notes-settings';
const DATA_KEY = 'yt-notes-data';

let settings = {};
let appData = { watchHistory: [], videos: {} };
let currentTab = 'history';
let pendingShare = null;

async function init() {
  settings = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  checkShareIntent();
  if (!settings.token || !settings.owner) {
    showSetup();
    return;
  }
  showLoading(true);
  await pullFromGitHub();
  showLoading(false);
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
  toast.textContent = message;
  toast.className = 'toast visible ' + type;
  setTimeout(() => toast.classList.remove('visible'), 3000);
}

function renderUI() {
  renderStats();
  renderList();
  updateSyncStatus();
}

function renderStats() {
  const history = appData.watchHistory || [];
  let withNotes = 0;
  let totalNotes = 0;
  for (const id in appData.videos) {
    const notes = appData.videos[id].notes || [];
    if (notes.length > 0) {
      withNotes++;
      totalNotes += notes.length;
    }
  }
  document.getElementById('watch-count').textContent = history.length;
  document.getElementById('notes-count').textContent = withNotes;
  document.getElementById('total-notes').textContent = totalNotes;
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
  if (videos.length === 0) {
    list.innerHTML = `<div class="empty-state">${currentTab === 'history' ? 'No videos watched yet' : 'No videos with notes'}</div>`;
    return;
  }
  list.innerHTML = videos.map(v => {
    const notesCount = v.notes?.length || 0;
    return `
      <div class="video-item" data-id="${v.videoId}">
        <div class="video-info">
          <div class="video-title"><a href="https://youtube.com/watch?v=${v.videoId}" target="_blank">${v.title || v.videoId}</a></div>
          <div class="video-channel">${v.channel || ''}</div>
          <div class="video-meta">
            ${v.timestamp ? formatDate(v.timestamp) : ''}
            ${notesCount > 0 ? ` • ${notesCount} note${notesCount !== 1 ? 's' : ''}` : ''}
          </div>
        </div>
        <button class="video-delete" data-id="${v.videoId}">×</button>
      </div>
    `;
  }).join('');
  list.querySelectorAll('.video-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteVideo(btn.dataset.id);
    });
  });
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
      `${GITHUB_API}/repos/${settings.owner}/${settings.repo}/contents/${DATA_PATH}?ref=${settings.branch || 'main'}`
    );
    const content = atob(response.content);
    const remoteData = JSON.parse(content);
    appData = mergeData(appData, remoteData);
    saveLocal();
    return { success: true };
  } catch (e) {
    if (e.message.includes('404')) {
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
        `${GITHUB_API}/repos/${settings.owner}/${settings.repo}/contents/${DATA_PATH}?ref=${settings.branch || 'main'}`
      );
      sha = existing.sha;
    } catch (e) {}
    const exportData = {
      version: 1,
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
        branch: settings.branch || 'main',
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
  await pullFromGitHub();
  const result = await pushToGitHub();
  showLoading(false);
  renderUI();
  if (result.success) {
    showToast('Synced!', 'success');
  } else {
    showToast('Sync failed: ' + result.error, 'error');
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
      const localNotes = merged.videos[id].notes || [];
      const remoteNotes = remote.videos[id].notes || [];
      const noteKey = n => `${n.time}-${n.text}`;
      const localKeys = new Set(localNotes.map(noteKey));
      remoteNotes.forEach(rn => {
        if (!localKeys.has(noteKey(rn))) {
          localNotes.push(rn);
        }
      });
      localNotes.sort((a, b) => a.time - b.time);
      merged.videos[id].notes = localNotes;
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
      notes: []
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
  renderUI();
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
    throw new Error(error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

document.addEventListener('DOMContentLoaded', init);

document.getElementById('setup-save').addEventListener('click', async () => {
  const token = document.getElementById('setup-token').value.trim();
  const owner = document.getElementById('setup-owner').value.trim();
  const repo = document.getElementById('setup-repo').value.trim() || 'pwa';
  if (!token || !owner) {
    showToast('Please enter token and owner', 'error');
    return;
  }
  settings = { token, owner, repo, branch: 'main' };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  showLoading(true);
  const result = await pullFromGitHub();
  showLoading(false);
  if (result.success) {
    showMain();
    renderUI();
    showToast('Connected!', 'success');
  } else {
    showToast('Connection failed: ' + result.error, 'error');
  }
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