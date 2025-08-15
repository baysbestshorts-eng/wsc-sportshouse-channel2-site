// Supercharged YouTube channel site with featured video, playlist tabs, filter by year, modal player, search, sort, dark mode, and more!

const fs = require('fs');
const path = require('path');
const https = require('https');

const API_KEY = 'AIzaSyBD-eWEz7em0Fl6O9dU3PuyLd1ZjMOgG_I';
const CHANNEL_ID = 'UCP2lwcWmDw6BFDHvQR6EWbQ';
const MAX_RESULTS_PER_PAGE = 50;
const MAX_TOTAL_RESULTS = 500;

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => resolve(JSON.parse(data)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function getChannelData() {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,brandingSettings,statistics,contentDetails&id=${CHANNEL_ID}&key=${API_KEY}`;
  const res = await fetch(url);
  if (res.items && res.items.length) return res.items[0];
  throw new Error('Channel not found');
}

async function getRecentVideos() {
  let videos = [];
  let nextPageToken = '';
  let pageCount = 0;
  while (videos.length < MAX_TOTAL_RESULTS) {
    const url = `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${CHANNEL_ID}&part=snippet,id&order=date&maxResults=${MAX_RESULTS_PER_PAGE}&type=video${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
    const res = await fetch(url);
    const items = (res.items || []).filter(item => item.id.kind === 'youtube#video');
    videos = videos.concat(items);
    nextPageToken = res.nextPageToken;
    pageCount++;
    if (!nextPageToken || videos.length >= MAX_TOTAL_RESULTS || pageCount >= 10) break;
  }
  return videos.slice(0, MAX_TOTAL_RESULTS);
}

async function getPlaylists() {
  let playlists = [];
  let nextPageToken = '';
  do {
    const url = `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=&channelId=${CHANNEL_ID}&maxResults=50&key=${API_KEY}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
    const res = await fetch(url);
    playlists = playlists.concat(res.items || []);
    nextPageToken = res.nextPageToken;
  } while (nextPageToken);
  return playlists;
}

async function getPlaylistVideos(playlistId) {
  let videos = [];
  let nextPageToken = '';
  do {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&key=${API_KEY}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
    const res = await fetch(url);
    videos = videos.concat(res.items || []);
    nextPageToken = res.nextPageToken;
  } while (nextPageToken);
  return videos.map(item => ({
    id: item.snippet.resourceId.videoId,
    title: item.snippet.title,
    thumb: item.snippet.thumbnails?.high?.url || "",
    date: item.snippet.publishedAt,
    desc: item.snippet.description || "",
    playlistId,
  }));
}

function getYear(dateStr) {
  return new Date(dateStr).getFullYear();
}

(async () => {
  try {
    // Prepare destination
    const siteDir = path.join(__dirname, 'site');
    if (!fs.existsSync(siteDir)) fs.mkdirSync(siteDir);

    // Fetch data
    const channel = await getChannelData();
    const allVideosRaw = await getRecentVideos();
    const playlistsRaw = await getPlaylists();

    // Gather all playlist videos (limit to first 5 playlists for performance)
    const playlistMap = {};
    for (let i = 0; i < Math.min(5, playlistsRaw.length); ++i) {
      const pl = playlistsRaw[i];
      playlistMap[pl.id] = {
        title: pl.snippet.title,
        videos: await getPlaylistVideos(pl.id)
      };
    }

    // Video objects
    const allVideos = allVideosRaw.map(v => ({
      id: v.id.videoId,
      title: v.snippet.title,
      thumb: v.snippet.thumbnails.high.url,
      date: v.snippet.publishedAt,
      desc: v.snippet.description || "",
      playlistIds: Object.keys(playlistMap).filter(pid => playlistMap[pid].videos.some(pv => pv.id === v.id)),
    }));

    // Featured video: most recent video
    const featured = allVideos[0];

    // Channel info
    const title = channel.snippet.title;
    const description = channel.snippet.description.replace(/\n/g, "<br>");
    const banner = channel.brandingSettings?.image?.bannerExternalUrl || "";
    const avatar = channel.snippet.thumbnails?.high?.url || "";
    const subscribeUrl = `https://www.youtube.com/channel/${CHANNEL_ID}?sub_confirmation=1`;
    const subscriberCount = channel.statistics?.subscriberCount
      ? Number(channel.statistics.subscriberCount).toLocaleString()
      : "–";
    const videoCount = channel.statistics?.videoCount
      ? Number(channel.statistics.videoCount).toLocaleString()
      : allVideos.length.toString();

    // Years for filter
    const years = Array.from(new Set(allVideos.map(v => getYear(v.date)))).sort((a, b) => b - a);

    // Playlists for tabs
    const playlistTabs = Object.entries(playlistMap).map(([id, pl]) => ({
      id,
      title: pl.title,
      count: pl.videos.length
    }));

    // Compose HTML
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title} - All Videos & Playlists</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="${title} - YouTube Channel">
  <link rel="icon" href="https://www.youtube.com/s/desktop/5c3f4ff2/img/favicon_32.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Russo+One&family=Roboto:wght@400;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --main-bg: #0a1627;
      --main-fg: #fff;
      --accent: #ffbf00;
      --accent2: #e30613;
      --blue: #0097f6;
      --radius: 20px;
      --shadow: 0 6px 32px 0 #001a3f66;
      --transition: .16s cubic-bezier(.45,1.7,.55,1.07);
    }
    html, body {margin:0;padding:0;}
    body {
      background: linear-gradient(135deg, #0a1627 0%, #122c54 100%);
      color: var(--main-fg);
      font-family: 'Roboto', Arial, sans-serif;
      min-height: 100vh;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #06101f;
      padding: 0 24px;
      height: 82px;
      box-shadow: var(--shadow);
      position: sticky;
      top: 0;
      z-index: 20;
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .logo img {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      box-shadow: 0 4px 16px var(--accent);
    }
    .logo-text {
      font-family: 'Russo One', cursive;
      font-size: 1.8em;
      background: linear-gradient(45deg, var(--accent), #fff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .controls {
      display: flex;
      align-items: center;
      gap: 20px;
    }
    .search-container {
      position: relative;
      display: flex;
      align-items: center;
    }
    .search-box {
      background: #13213a;
      border: 2px solid #1e3a5f;
      border-radius: 25px;
      padding: 10px 20px;
      color: var(--main-fg);
      width: 250px;
      font-size: 16px;
      transition: border-color 0.3s;
    }
    .search-box:focus {
      outline: none;
      border-color: var(--accent);
    }
    .search-box::placeholder {
      color: #888;
    }
    .toggle-theme {
      background: #13213a;
      border: 2px solid #1e3a5f;
      border-radius: 50%;
      width: 44px;
      height: 44px;
      color: var(--accent);
      cursor: pointer;
      font-size: 1.2em;
      transition: all 0.3s;
    }
    .toggle-theme:hover {
      background: var(--accent);
      color: #000;
      transform: scale(1.1);
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 24px;
    }
    .hero {
      background: linear-gradient(135deg, #1e3a5f 0%, #13213a 100%);
      border-radius: var(--radius);
      padding: 32px;
      margin-bottom: 32px;
      box-shadow: var(--shadow);
      display: flex;
      align-items: center;
      gap: 24px;
      flex-wrap: wrap;
    }
    .hero-content {
      flex: 1;
      min-width: 300px;
    }
    .hero h1 {
      font-family: 'Russo One', cursive;
      font-size: 2.8em;
      margin: 0 0 16px 0;
      background: linear-gradient(45deg, var(--accent), #fff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .hero p {
      font-size: 1.2em;
      margin: 0 0 24px 0;
      opacity: 0.9;
      line-height: 1.6;
    }
    .subscribe-btn {
      background: linear-gradient(45deg, var(--accent2), #ff4757);
      color: #fff;
      border: none;
      padding: 16px 32px;
      border-radius: 50px;
      font-size: 1.1em;
      font-weight: bold;
      cursor: pointer;
      transition: transform 0.2s;
      text-decoration: none;
      display: inline-block;
    }
    .subscribe-btn:hover {
      transform: scale(1.05);
    }
    .featured-video {
      flex: 1;
      min-width: 300px;
      max-width: 500px;
    }
    .featured-thumb {
      width: 100%;
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      cursor: pointer;
      transition: transform 0.3s;
    }
    .featured-thumb:hover {
      transform: scale(1.03);
    }
    .nav-tabs {
      display: flex;
      gap: 16px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }
    .tab {
      background: #13213a;
      border: 2px solid #1e3a5f;
      color: var(--main-fg);
      padding: 12px 24px;
      border-radius: 25px;
      cursor: pointer;
      transition: all 0.3s;
      font-weight: bold;
      position: relative;
    }
    .tab:hover, .tab.active {
      background: var(--accent);
      color: #000;
      border-color: var(--accent);
    }
    .tab .count {
      font-size: 0.8em;
      opacity: 0.7;
      margin-left: 8px;
    }
    .filters {
      display: flex;
      gap: 16px;
      margin-bottom: 24px;
      flex-wrap: wrap;
      align-items: center;
    }
    .filter-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .filter-group label {
      font-weight: bold;
      color: var(--accent);
    }
    .year-filter, .sort-filter {
      background: #13213a;
      border: 2px solid #1e3a5f;
      color: var(--main-fg);
      padding: 8px 16px;
      border-radius: 20px;
      cursor: pointer;
      transition: border-color 0.3s;
    }
    .year-filter:focus, .sort-filter:focus {
      outline: none;
      border-color: var(--accent);
    }
    .clear-btn {
      background: var(--accent2);
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 20px;
      cursor: pointer;
      font-weight: bold;
      transition: background-color 0.3s;
    }
    .clear-btn:hover {
      background: #c41e3a;
    }
    .video-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 24px;
      margin-bottom: 32px;
    }
    .video-card {
      background: #13213a;
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      overflow: hidden;
      transition: transform var(--transition), box-shadow var(--transition);
      position: relative;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      opacity: 0;
      animation: fadeIn 0.8s var(--transition) forwards;
    }
    .video-card:hover {
      transform: translateY(-12px) scale(1.034);
      box-shadow: 0 12px 48px #0097f644, 0 1.5px 20px #e3061344;
      z-index: 2;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.97);}
      to { opacity: 1; transform: scale(1);}
    }
    .video-thumb-container {
      position: relative;
      width: 100%;
      aspect-ratio: 16/9;
      overflow: hidden;
      background: #111;
    }
    .video-thumb {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      transition: filter 0.2s;
    }
    .video-card:hover .video-thumb {
      filter: brightness(0.8) blur(1.5px);
    }
    
    /* Video overlay styles for views and likes */
    .video-overlay {
      position: absolute;
      bottom: 8px;
      left: 8px;
      right: 8px;
      display: flex;
      justify-content: space-between;
      gap: 8px;
      z-index: 5;
      pointer-events: none;
    }
    .overlay-badge {
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(4px);
      color: #fff;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 0.75em;
      font-weight: bold;
      border: 1px solid rgba(255, 255, 255, 0.2);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      transition: all 0.2s;
    }
    .overlay-badge.views {
      background: rgba(255, 191, 0, 0.9);
      color: #000;
      text-shadow: none;
    }
    .overlay-badge.likes {
      background: rgba(227, 6, 19, 0.9);
      color: #fff;
    }
    .video-card:hover .overlay-badge {
      transform: scale(1.05);
    }
    
    .play-icon {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%,-50%);
      font-size: 3em;
      color: var(--accent);
      opacity: 0.86;
      pointer-events: none;
      transition: color 0.14s;
      filter: drop-shadow(0 0 8px #fff7);
    }
    .video-card:hover .play-icon { color: #fff; }
    .live-ribbon {
      position: absolute;
      top: 12px; left: -18px;
      background: var(--accent2);
      color: #fff;
      font-weight: bold;
      font-size: 1em;
      padding: 7px 28px;
      border-radius: 8px 999px 999px 8px;
      box-shadow: 0 2px 8px #e3061344;
      transform: rotate(-11deg);
      z-index: 3;
      text-shadow: 0 2px 0 #001a3f44;
      letter-spacing: 0.9px;
    }
    .video-title {
      font-weight: bold;
      font-size: 1.13em;
      margin: 16px 18px 8px 18px;
      color: #fff;
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .video-date {
      font-size: 0.9em;
      color: #aaa;
      margin: 0 18px 12px 18px;
    }
    .share-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 18px;
      background: #0f1a2b;
      border-top: 1px solid #1e3a5f;
    }
    .share-buttons {
      display: flex;
      gap: 8px;
    }
    .share-btn {
      background: #1e3a5f;
      border: none;
      color: var(--main-fg);
      padding: 6px 10px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.8em;
      transition: background-color 0.3s;
    }
    .share-btn:hover {
      background: var(--accent);
      color: #000;
    }
    .video-duration {
      font-size: 0.8em;
      color: #aaa;
    }
    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 16px;
      margin: 32px 0;
    }
    .page-btn {
      background: #13213a;
      border: 2px solid #1e3a5f;
      color: var(--main-fg);
      padding: 10px 16px;
      border-radius: 25px;
      cursor: pointer;
      transition: all 0.3s;
      font-weight: bold;
    }
    .page-btn:hover, .page-btn.active {
      background: var(--accent);
      color: #000;
      border-color: var(--accent);
    }
    .page-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      display: none;
      z-index: 1000;
      padding: 20px;
      box-sizing: border-box;
    }
    .modal-content {
      position: relative;
      max-width: 90vw;
      max-height: 90vh;
      margin: auto;
      background: #13213a;
      border-radius: var(--radius);
      padding: 24px;
      top: 50%;
      transform: translateY(-50%);
      overflow-y: auto;
    }
    .close {
      position: absolute;
      top: 16px;
      right: 20px;
      font-size: 2em;
      color: var(--accent);
      cursor: pointer;
      z-index: 1001;
    }
    .modal-video {
      width: 100%;
      max-width: 800px;
      aspect-ratio: 16/9;
      border-radius: var(--radius);
      margin-bottom: 20px;
    }
    .modal-title {
      font-size: 1.5em;
      margin: 0 0 16px 0;
      color: #fff;
      font-weight: bold;
    }
    .modal-description {
      color: #ccc;
      line-height: 1.6;
      margin-bottom: 16px;
    }
    .modal-actions {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }
    .action-btn {
      background: var(--accent);
      color: #000;
      border: none;
      padding: 12px 24px;
      border-radius: 25px;
      cursor: pointer;
      font-weight: bold;
      text-decoration: none;
      display: inline-block;
      transition: transform 0.2s;
    }
    .action-btn:hover {
      transform: scale(1.05);
    }
    .action-btn.secondary {
      background: #1e3a5f;
      color: var(--main-fg);
    }
    .backtotop {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--accent);
      color: #000;
      border: none;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      font-size: 1.5em;
      cursor: pointer;
      box-shadow: var(--shadow);
      transition: all 0.3s;
      z-index: 100;
    }
    .backtotop:hover {
      transform: scale(1.1) rotate(360deg);
    }
    .footer {
      text-align: center;
      padding: 32px;
      color: #aaa;
      border-top: 1px solid #1e3a5f;
      margin-top: 48px;
    }
    .footer a {
      color: var(--accent);
      text-decoration: none;
    }
    .footer a:hover {
      text-decoration: underline;
    }
    @media (max-width: 768px) {
      .container { padding: 16px; }
      .hero { padding: 20px; }
      .hero h1 { font-size: 2em; }
      .video-grid { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
      .controls { flex-direction: column; gap: 12px; }
      .search-box { width: 200px; }
      .nav-tabs { justify-content: center; }
      .filters { justify-content: center; }
    }
    [data-theme="light"] {
      --main-bg: #f5f7fa;
      --main-fg: #2c3e50;
      --radius: 12px;
      --shadow: 0 4px 20px rgba(0,0,0,0.1);
    }
    [data-theme="light"] body {
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      color: var(--main-fg);
    }
    [data-theme="light"] .video-card {
      background: #fff;
    }
    [data-theme="light"] .hero {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff;
    }
    [data-theme="light"] header {
      background: #fff;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    [data-theme="light"] .logo-text {
      background: linear-gradient(45deg, var(--accent2), var(--blue));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    [data-theme="light"] .tab {
      background: #e9ecef;
      border-color: #dee2e6;
      color: var(--main-fg);
    }
    [data-theme="light"] .tab:hover, [data-theme="light"] .tab.active {
      background: var(--accent);
      color: #000;
    }
    [data-theme="light"] .search-box, [data-theme="light"] .year-filter, [data-theme="light"] .sort-filter {
      background: #fff;
      border-color: #dee2e6;
      color: var(--main-fg);
    }
    [data-theme="light"] .toggle-theme {
      background: #e9ecef;
      border-color: #dee2e6;
      color: var(--main-fg);
    }
    [data-theme="light"] .modal-content {
      background: #fff;
      color: var(--main-fg);
    }
    [data-theme="light"] .share-bar {
      background: #f8f9fa;
      border-color: #dee2e6;
    }
    [data-theme="light"] .share-btn {
      background: #e9ecef;
      color: var(--main-fg);
    }
    [data-theme="light"] .share-btn:hover {
      background: var(--accent);
      color: #000;
    }
  </style>
</head>
<body>
  <header>
    <div class="logo">
      <img src="${avatar}" alt="Channel Avatar">
      <div class="logo-text">${title}</div>
    </div>
    <div class="controls">
      <div class="search-container">
        <input type="text" id="search-box" class="search-box" placeholder="Search videos...">
      </div>
      <button class="toggle-theme" onclick="toggleTheme()" title="Toggle Theme">🌙</button>
    </div>
  </header>

  <div class="container">
    <div class="hero">
      <div class="hero-content">
        <h1>${title}</h1>
        <p>${description}</p>
        <p><strong>${subscriberCount}</strong> subscribers • <strong>${videoCount}</strong> videos</p>
        <a href="${subscribeUrl}" class="subscribe-btn" target="_blank">Subscribe</a>
      </div>
      ${featured ? `<div class="featured-video">
        <img src="${featured.thumb}" alt="${featured.title}" class="featured-thumb" onclick="openModal(${JSON.stringify(featured).replace(/"/g, '&quot;')})">
      </div>` : ''}
    </div>

    <div class="nav-tabs">
      <div class="tab active" data-tab="all" onclick="switchTab(this, 'all')">
        All Videos <span class="count">${allVideos.length}</span>
      </div>
      ${playlistTabs.map(tab => `
        <div class="tab" data-tab="${tab.id}" onclick="switchTab(this, '${tab.id}')">
          ${tab.title} <span class="count">${tab.count}</span>
        </div>
      `).join('')}
    </div>

    <div class="filters">
      <div class="filter-group">
        <label>Year:</label>
        <select id="year-filter" class="year-filter">
          <option value="all">All Years</option>
          ${years.map(year => `<option value="${year}">${year}</option>`).join('')}
        </select>
      </div>
      <div class="filter-group">
        <label>Sort:</label>
        <select id="sort-filter" class="sort-filter">
          <option value="date">Latest First</option>
          <option value="title">Title A-Z</option>
        </select>
      </div>
      <button id="clear-filters" class="clear-btn">Clear</button>
    </div>

    <div id="video-gallery" class="video-grid"></div>
    
    <div class="pagination"></div>
  </div>

  <button class="backtotop" id="backToTopBtn" onclick="window.scrollTo({top:0,behavior:'smooth'})" title="Back to Top">↑</button>
  
  <div class="footer">
    ${allVideos.length} recent videos · Powered by GitHub Pages · Updated: ${new Date().toLocaleString()}<br>
    <a href="https://github.com/baysbestshorts-eng/wsc-sportshouse-channel2-site">Source</a>
  </div>

  <!-- Video Modal -->
  <div id="video-modal" class="modal">
    <div class="modal-content">
      <span class="close" onclick="closeModal()">&times;</span>
      <iframe id="modal-video" class="modal-video" frameborder="0" allowfullscreen></iframe>
      <h2 id="modal-title" class="modal-title"></h2>
      <p id="modal-description" class="modal-description"></p>
      <div class="modal-actions">
        <a id="watch-btn" href="#" target="_blank" class="action-btn">Watch on YouTube</a>
        <button class="action-btn secondary" onclick="closeModal()">Close</button>
      </div>
    </div>
  </div>
  <script>
    // Theme management
    function toggleTheme() {
      const currentTheme = document.body.getAttribute('data-theme');
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      document.body.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
    }

    // Load saved theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      document.body.setAttribute('data-theme', savedTheme);
    }

    // Video data and state
    let allVideos = [];
    let currentPage = 1;
    const videosPerPage = 24;
    const MAX_RESULTS = 500;

    // Fetch and process data
    async function fetchData() {
      try {
        // Channel data would be fetched here
        allVideos = ${JSON.stringify(allVideos)};
        
        // Add playlist associations
        allVideos.forEach(video => {
          video.playlists = video.playlistIds || [];
        });
        
        renderVideos();
        setupEventListeners();
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    }

    // Generate random views and likes for overlays
    function generateRandomStats() {
      const views = Math.floor(Math.random() * (250000 - 12000) + 12000);
      const likes = Math.floor(Math.random() * (18000 - 500) + 500);
      
      return {
        views: formatNumber(views),
        likes: formatNumber(likes)
      };
    }

    // Format numbers for display (e.g., 12,345 or 12.3K)
    function formatNumber(num) {
      if (num >= 1000) {
        return (num / 1000).toFixed(1).replace(/\\.0$/, '') + 'K';
      }
      return num.toLocaleString();
    }

    // Create video card element
    function createVideoCard(video, index) {
      const card = document.createElement('div');
      card.className = 'video-card';
      card.style.animationDelay = (index * 0.013) + "s";
      card.onclick = () => openModal(video);

      const thumbCont = document.createElement('div');
      thumbCont.className = "video-thumb-container";

      const thumb = document.createElement('img');
      thumb.src = video.thumb;
      thumb.alt = video.title;
      thumb.className = "video-thumb";
      thumbCont.appendChild(thumb);

      // Add overlay for views and likes
      const overlay = document.createElement('div');
      overlay.className = 'video-overlay';
      
      const viewsBadge = document.createElement('div');
      viewsBadge.className = 'overlay-badge views';
      viewsBadge.innerHTML = '👁 <span class="views-count">0</span>';
      
      const likesBadge = document.createElement('div');
      likesBadge.className = 'overlay-badge likes';
      likesBadge.innerHTML = '❤ <span class="likes-count">0</span>';
      
      overlay.appendChild(viewsBadge);
      overlay.appendChild(likesBadge);
      thumbCont.appendChild(overlay);

      if (video.live) {
        const live = document.createElement('div');
        live.className = "live-ribbon";
        live.textContent = "LIVE NOW";
        thumbCont.appendChild(live);
      }

      const play = document.createElement('span');
      play.className = "play-icon";
      play.innerHTML = "&#9654;";
      thumbCont.appendChild(play);

      card.appendChild(thumbCont);

      const vTitle = document.createElement('div');
      vTitle.className = "video-title";
      vTitle.textContent = video.title;
      card.appendChild(vTitle);

      const vDate = document.createElement('div');
      vDate.className = "video-date";
      vDate.textContent = formatDate(video.date);
      card.appendChild(vDate);

      // Share bar
      const shareBar = document.createElement('div');
      shareBar.className = 'share-bar';
      
      const shareButtons = document.createElement('div');
      shareButtons.className = 'share-buttons';
      
      const shareTwitter = document.createElement('button');
      shareTwitter.className = 'share-btn';
      shareTwitter.textContent = 'Tweet';
      shareTwitter.onclick = (e) => {
        e.stopPropagation();
        shareOnTwitter(video);
      };
      
      const shareFacebook = document.createElement('button');
      shareFacebook.className = 'share-btn';
      shareFacebook.textContent = 'Share';
      shareFacebook.onclick = (e) => {
        e.stopPropagation();
        shareOnFacebook(video);
      };
      
      const copyLink = document.createElement('button');
      copyLink.className = 'share-btn';
      copyLink.textContent = 'Copy';
      copyLink.onclick = (e) => {
        e.stopPropagation();
        copyVideoLink(video);
      };
      
      shareButtons.appendChild(shareTwitter);
      shareButtons.appendChild(shareFacebook);
      shareButtons.appendChild(copyLink);
      
      const duration = document.createElement('div');
      duration.className = 'video-duration';
      duration.textContent = video.duration || 'N/A';
      
      shareBar.appendChild(shareButtons);
      shareBar.appendChild(duration);
      card.appendChild(shareBar);

      return card;
    }

    // Populate all video overlays with random numbers
    function populateVideoOverlays() {
      const overlayBadges = document.querySelectorAll('.video-overlay');
      overlayBadges.forEach(overlay => {
        const stats = generateRandomStats();
        const viewsElement = overlay.querySelector('.views-count');
        const likesElement = overlay.querySelector('.likes-count');
        
        if (viewsElement) viewsElement.textContent = stats.views;
        if (likesElement) likesElement.textContent = stats.likes;
      });
    }

    // Render videos
    function renderVideos() {
      const gallery = document.getElementById('video-gallery');
      const currentTab = document.querySelector('.tab.active')?.dataset.tab || 'all';
      const selectedYear = document.getElementById('year-filter')?.value || 'all';
      const sortBy = document.getElementById('sort-filter')?.value || 'date';
      const searchQuery = document.getElementById('search-box')?.value.toLowerCase() || '';

      // Filter videos
      let filteredVideos = allVideos.filter(video => {
        const matchesTab = currentTab === 'all' || video.playlists.includes(currentTab);
        const matchesYear = selectedYear === 'all' || getYear(video.date) == selectedYear;
        const matchesSearch = !searchQuery || 
          video.title.toLowerCase().includes(searchQuery) ||
          video.desc.toLowerCase().includes(searchQuery);
        
        return matchesTab && matchesYear && matchesSearch;
      });

      // Sort videos
      filteredVideos.sort((a, b) => {
        switch (sortBy) {
          case 'title':
            return a.title.localeCompare(b.title);
          case 'date':
          default:
            return new Date(b.date) - new Date(a.date);
        }
      });

      // Pagination
      const startIndex = (currentPage - 1) * videosPerPage;
      const endIndex = startIndex + videosPerPage;
      const paginatedVideos = filteredVideos.slice(startIndex, endIndex);

      // Clear and populate gallery
      gallery.innerHTML = "";
      paginatedVideos.forEach((video, idx) => {
        const card = createVideoCard(video, idx);
        gallery.appendChild(card);
      });

      // Populate overlays after a short delay to ensure DOM is ready
      setTimeout(populateVideoOverlays, 100);

      // Update pagination
      updatePagination(filteredVideos.length);
    }

    // Format date
    function formatDate(dateStr) {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    }

    // Get year from date
    function getYear(dateStr) {
      return new Date(dateStr).getFullYear();
    }

    // Modal functions
    function openModal(video) {
      const modal = document.getElementById('video-modal');
      const modalVideo = document.getElementById('modal-video');
      const modalTitle = document.getElementById('modal-title');
      const modalDescription = document.getElementById('modal-description');
      const watchBtn = document.getElementById('watch-btn');

      modalVideo.src = \`https://www.youtube.com/embed/\${video.id}?autoplay=1\`;
      modalTitle.textContent = video.title;
      modalDescription.textContent = video.desc || 'No description available.';
      watchBtn.href = \`https://www.youtube.com/watch?v=\${video.id}\`;

      modal.style.display = 'block';
      document.body.style.overflow = 'hidden';
    }

    function closeModal() {
      const modal = document.getElementById('video-modal');
      const modalVideo = document.getElementById('modal-video');
      
      modal.style.display = 'none';
      modalVideo.src = '';
      document.body.style.overflow = 'auto';
    }

    // Share functions
    function shareOnTwitter(video) {
      const url = \`https://www.youtube.com/watch?v=\${video.id}\`;
      const text = \`Check out this video: \${video.title}\`;
      window.open(\`https://twitter.com/intent/tweet?url=\${encodeURIComponent(url)}&text=\${encodeURIComponent(text)}\`);
    }

    function shareOnFacebook(video) {
      const url = \`https://www.youtube.com/watch?v=\${video.id}\`;
      window.open(\`https://www.facebook.com/sharer/sharer.php?u=\${encodeURIComponent(url)}\`);
    }

    function copyVideoLink(video) {
      const url = \`https://www.youtube.com/watch?v=\${video.id}\`;
      navigator.clipboard.writeText(url).then(() => {
        alert('Link copied to clipboard!');
      });
    }

    // Tab management
    function switchTab(tabElement, tabId) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tabElement.classList.add('active');
      currentPage = 1;
      renderVideos();
    }

    // Pagination
    function updatePagination(totalVideos) {
      const totalPages = Math.ceil(totalVideos / videosPerPage);
      const pagination = document.querySelector('.pagination');
      
      if (!pagination) return;
      
      pagination.innerHTML = '';
      
      if (totalPages <= 1) return;

      // Previous button
      const prevBtn = document.createElement('button');
      prevBtn.className = 'page-btn';
      prevBtn.textContent = '← Previous';
      prevBtn.disabled = currentPage === 1;
      prevBtn.onclick = () => {
        if (currentPage > 1) {
          currentPage--;
          renderVideos();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      };
      pagination.appendChild(prevBtn);

      // Page numbers
      const startPage = Math.max(1, currentPage - 2);
      const endPage = Math.min(totalPages, currentPage + 2);

      for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = 'page-btn';
        pageBtn.textContent = i;
        pageBtn.classList.toggle('active', i === currentPage);
        pageBtn.onclick = () => {
          currentPage = i;
          renderVideos();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        };
        pagination.appendChild(pageBtn);
      }

      // Next button
      const nextBtn = document.createElement('button');
      nextBtn.className = 'page-btn';
      nextBtn.textContent = 'Next →';
      nextBtn.disabled = currentPage === totalPages;
      nextBtn.onclick = () => {
        if (currentPage < totalPages) {
          currentPage++;
          renderVideos();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      };
      pagination.appendChild(nextBtn);
    }

    // Search functionality
    function setupSearch() {
      const searchBox = document.getElementById('search-box');
      if (searchBox) {
        searchBox.addEventListener('input', debounce(() => {
          currentPage = 1;
          renderVideos();
        }, 300));
      }
    }

    // Filter functionality
    function setupFilters() {
      const yearFilter = document.getElementById('year-filter');
      const sortFilter = document.getElementById('sort-filter');
      const clearBtn = document.getElementById('clear-filters');

      if (yearFilter) {
        yearFilter.addEventListener('change', () => {
          currentPage = 1;
          renderVideos();
        });
      }

      if (sortFilter) {
        sortFilter.addEventListener('change', () => {
          currentPage = 1;
          renderVideos();
        });
      }

      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          if (yearFilter) yearFilter.value = 'all';
          if (sortFilter) sortFilter.value = 'date';
          const searchBox = document.getElementById('search-box');
          if (searchBox) searchBox.value = '';
          currentPage = 1;
          renderVideos();
        });
      }
    }

    // Event listeners setup
    function setupEventListeners() {
      // Close modal
      window.onclick = (event) => {
        const modal = document.getElementById('video-modal');
        if (event.target === modal) {
          closeModal();
        }
      };

      // Keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          closeModal();
        }
      });

      setupSearch();
      setupFilters();
    }

    // Utility functions
    function debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }

    // Initialize the application
    document.addEventListener('DOMContentLoaded', () => {
      fetchData();
      
      // Populate video overlays on page load
      setTimeout(populateVideoOverlays, 500);
    });

    // Back to top button functionality
    window.addEventListener('scroll', () => {
      const backToTopBtn = document.getElementById('backToTopBtn');
      if (backToTopBtn) {
        backToTopBtn.style.display = window.scrollY > 300 ? 'block' : 'none';
      }
    });
  </script>
</body>
</html>
`;

    // Write out
    fs.writeFileSync(path.join(siteDir, 'index.html'), html, 'utf8');
    console.log(`Site generated with ${allVideos.length} videos: ./site/index.html`);
  } catch (e) {
    console.error('Failed to generate site:', e.message);
    process.exit(1);
  }
})();
