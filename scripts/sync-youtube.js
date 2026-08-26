#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const API = 'https://www.googleapis.com/youtube/v3';
const API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNEL_HANDLE = process.env.YOUTUBE_CHANNEL_HANDLE || '@OlexaYT';

if (!API_KEY) {
  console.error('Missing YOUTUBE_API_KEY.');
  process.exit(1);
}

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8')); }
  catch { return fallback; }
}

function writeJSON(file, value) {
  fs.writeFileSync(path.join(DATA, file), JSON.stringify(value, null, 2) + '\n');
}

function chunks(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function isoDurationToSeconds(value = '') {
  const m = value.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  return (Number(m[1] || 0) * 86400) + (Number(m[2] || 0) * 3600) + (Number(m[3] || 0) * 60) + Number(m[4] || 0);
}

async function api(endpoint, params) {
  const url = new URL(`${API}/${endpoint}`);
  for (const [k, v] of Object.entries({ ...params, key: API_KEY })) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    let details = '';
    try { details = JSON.stringify(await response.json()); } catch { details = await response.text(); }
    throw new Error(`YouTube API ${response.status}: ${details.slice(0, 800)}`);
  }
  return response.json();
}

function chooseThumbnail(thumbnails = {}) {
  return (thumbnails.maxres || thumbnails.standard || thumbnails.high || thumbnails.medium || thumbnails.default || {}).url || null;
}

function cleanGameName(value = '') {
  return value
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[|•]+$/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s:–—-]+|[\s:–—-]+$/g, '')
    .trim();
}

function nameFromSteamPath(pathname = '') {
  try {
    const parts = decodeURIComponent(pathname).split('/').filter(Boolean);
    const appIndex = parts.findIndex(x => x === 'app');
    const slug = appIndex >= 0 ? parts[appIndex + 2] : '';
    return cleanGameName((slug || '').replace(/_/g, ' '));
  } catch {
    return '';
  }
}

function extractSteam(description = '') {
  const regex = /https?:\/\/(?:store\.)?steampowered\.com\/app\/(\d+)(?:\/[^\s?#]*)?/ig;
  const match = regex.exec(description);
  if (!match) return null;

  const appId = match[1];
  const steamUrl = `https://store.steampowered.com/app/${appId}/`;
  const before = description.slice(Math.max(0, match.index - 260), match.index);
  const patterns = [
    /check\s+out\s+([^\n\r]{1,120}?)\s+here!?\s*$/i,
    /check\s+out\s+([^\n\r]{1,120}?)\s+on\s+steam!?\s*$/i,
    /play\s+([^\n\r]{1,120}?)\s+here!?\s*$/i
  ];
  let name = '';
  for (const pattern of patterns) {
    const m = before.match(pattern);
    if (m?.[1]) { name = cleanGameName(m[1]); break; }
  }

  if (!name) {
    try { name = nameFromSteamPath(new URL(match[0]).pathname); }
    catch { name = ''; }
  }

  if (!name) name = `Steam App ${appId}`;
  return { steamAppId: appId, steamUrl, gameName: name };
}

function manualClassification(raw, games, rules, overrides) {
  const override = overrides[raw.id] || {};
  if (override.hide) return { hide: true };
  const gameBySlug = new Map(games.map(g => [g.slug, g]));

  let slug = override.gameSlug || null;
  let source = slug ? 'override' : null;
  if (!slug) {
    const haystack = [raw.snippet.title, raw.snippet.description, ...(raw.snippet.tags || [])].join('\n').toLowerCase();
    let best = null;
    for (const rule of rules) {
      const hits = (rule.any || []).filter(term => haystack.includes(String(term).toLowerCase()));
      if (!hits.length) continue;
      const score = Math.max(...hits.map(x => String(x).length)) + hits.length * 3;
      if (!best || score > best.score) best = { slug: rule.gameSlug, score };
    }
    slug = best?.slug || null;
    if (slug) source = 'rule';
  }

  const game = slug ? gameBySlug.get(slug) : null;
  return {
    gameSlug: slug,
    game: override.game || game?.name || null,
    genres: override.genres || game?.genres || [],
    series: override.series || null,
    source,
    hide: false
  };
}

async function main() {
  console.log(`Resolving YouTube channel ${CHANNEL_HANDLE}…`);
  const channelResponse = await api('channels', {
    part: 'snippet,contentDetails,statistics',
    forHandle: CHANNEL_HANDLE
  });
  const channel = channelResponse.items?.[0];
  if (!channel) throw new Error(`No YouTube channel found for ${CHANNEL_HANDLE}.`);

  const uploadsPlaylist = channel.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylist) throw new Error('Could not find the channel uploads playlist.');
  console.log(`Found ${channel.snippet.title} (${channel.id}). Fetching uploads…`);

  const videoIds = [];
  let pageToken = null;
  let page = 0;
  do {
    const result = await api('playlistItems', {
      part: 'contentDetails', playlistId: uploadsPlaylist, maxResults: 50, pageToken
    });
    for (const item of result.items || []) if (item.contentDetails?.videoId) videoIds.push(item.contentDetails.videoId);
    pageToken = result.nextPageToken || null;
    page += 1;
    process.stdout.write(`\rUploads pages: ${page} · video IDs: ${videoIds.length}`);
  } while (pageToken);
  process.stdout.write('\n');

  const rawVideos = [];
  const batches = chunks(videoIds, 50);
  for (let i = 0; i < batches.length; i++) {
    const result = await api('videos', {
      part: 'snippet,contentDetails,statistics,status', id: batches[i].join(','), maxResults: 50
    });
    rawVideos.push(...(result.items || []));
    process.stdout.write(`\rMetadata batches: ${i + 1}/${batches.length} · videos: ${rawVideos.length}`);
  }
  process.stdout.write('\n');

  const gamesData = readJSON('games.json', { games: [] });
  const rulesData = readJSON('game-rules.json', { rules: [] });
  const overridesData = readJSON('video-overrides.json', { overrides: {} });
  const games = gamesData.games || [];
  const rules = rulesData.rules || [];
  const overrides = overridesData.overrides || {};
  const gameBySlug = new Map(games.map(g => [g.slug, g]));

  // First pass: if a manually-known game has a Steam link, remember that App ID.
  // That lets other episodes of the same game inherit the curated slug automatically.
  const steamToManualSlug = new Map();
  for (const raw of rawVideos) {
    const manual = manualClassification(raw, games, rules, overrides);
    const steam = extractSteam(raw.snippet.description || '');
    if (!manual.hide && manual.gameSlug && steam?.steamAppId) {
      steamToManualSlug.set(steam.steamAppId, manual.gameSlug);
    }
  }

  const videos = rawVideos.map(raw => {
    const manual = manualClassification(raw, games, rules, overrides);
    if (manual.hide) return null;

    const steam = extractSteam(raw.snippet.description || '');
    let gameSlug = manual.gameSlug;
    let game = manual.game;
    let genres = manual.genres || [];
    let gameSource = manual.source;

    if (!gameSlug && steam?.steamAppId && steamToManualSlug.has(steam.steamAppId)) {
      gameSlug = steamToManualSlug.get(steam.steamAppId);
      const curated = gameBySlug.get(gameSlug);
      game = curated?.name || steam.gameName;
      genres = curated?.genres || [];
      gameSource = 'steam+curated';
    } else if (!gameSlug && steam?.steamAppId) {
      gameSlug = `steam-${steam.steamAppId}`;
      game = steam.gameName;
      gameSource = 'steam';
    }

    if (gameSlug && !game) game = gameBySlug.get(gameSlug)?.name || steam?.gameName || null;

    const stats = raw.statistics || {};
    return {
      id: raw.id,
      title: raw.snippet.title,
      publishedAt: raw.snippet.publishedAt,
      thumbnail: chooseThumbnail(raw.snippet.thumbnails),
      views: Number(stats.viewCount || 0),
      likes: Number(stats.likeCount || 0),
      comments: Number(stats.commentCount || 0),
      durationSeconds: isoDurationToSeconds(raw.contentDetails?.duration),
      game,
      gameSlug,
      gameSource,
      genres,
      series: manual.series || null,
      steamAppId: steam?.steamAppId || null,
      steamUrl: steam?.steamUrl || null,
      tags: raw.snippet.tags || [],
      descriptionSnippet: (raw.snippet.description || '').replace(/\s+/g, ' ').trim().slice(0, 420),
      url: `https://www.youtube.com/watch?v=${raw.id}`
    };
  }).filter(Boolean).sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  const assigned = videos.filter(v => v.gameSlug).length;
  const steamDetected = videos.filter(v => v.steamAppId).length;
  const uniqueGames = new Set(videos.filter(v => v.gameSlug).map(v => v.gameSlug)).size;

  const output = {
    channel: {
      id: channel.id,
      handle: CHANNEL_HANDLE.startsWith('@') ? CHANNEL_HANDLE : `@${CHANNEL_HANDLE}`,
      title: channel.snippet.title,
      description: channel.snippet.description,
      thumbnail: chooseThumbnail(channel.snippet.thumbnails),
      subscribers: Number(channel.statistics?.subscriberCount || 0),
      channelViews: Number(channel.statistics?.viewCount || 0),
      videoCount: Number(channel.statistics?.videoCount || videos.length),
      uploadsPlaylist,
      syncedAt: new Date().toISOString(),
      source: 'youtube-data-api-v3'
    },
    catalog: {
      identifiedVideos: assigned,
      steamLinkedVideos: steamDetected,
      uniqueGames
    },
    videos
  };

  writeJSON('videos.json', output);
  console.log(`Done. Wrote ${videos.length} public videos to data/videos.json.`);
  console.log(`Games identified: ${assigned}/${videos.length} (${videos.length ? Math.round(assigned / videos.length * 100) : 0}%).`);
  console.log(`Steam links found: ${steamDetected}/${videos.length} · unique game records: ${uniqueGames}.`);
}

main().catch(err => {
  console.error('\nSync failed:', err.message);
  process.exit(1);
});
