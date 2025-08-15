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
  <style>...TRUNCATED FOR LENGTH...</style>
</head>
<body>
  <div class="banner"></div>
  <div class="sticky-header">...TRUNCATED FOR LENGTH...</div>
  <div class="container" style="margin-top:0;">...TRUNCATED FOR LENGTH...</div>
  <button class="backtotop" id="backToTopBtn" onclick="window.scrollTo({top:0,behavior:'smooth'})" title="Back to Top">↑</button>
  <div class="footer">
    ${allVideos.length} recent videos · Powered by GitHub Pages · Updated: ${new Date().toLocaleString()}<br>
    <a href="https://github.com/baysbestshorts-eng/wsc-sportshouse-channel2-site">Source</a>
  </div>
  <script>...TRUNCATED FOR LENGTH...</script>
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
