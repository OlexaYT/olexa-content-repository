#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { buildCatalog } = require('./lib/game-catalog');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const REPORTS = path.join(ROOT, 'reports');
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
  const curationData = readJSON('game-curation.json', { games: [] });
  const rulesData = readJSON('game-rules.json', { rules: [] });
  const overridesData = readJSON('video-overrides.json', { overrides: {} });
  const generatedAt = new Date().toISOString();
  const baseVideos = rawVideos.map(raw => {
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
      game: null,
      gameSlug: null,
      gameSource: null,
      genres: [],
      series: null,
      steamAppId: null,
      steamUrl: null,
      tags: raw.snippet.tags || [],
      description: raw.snippet.description || '',
      descriptionSnippet: (raw.snippet.description || '').replace(/\s+/g, ' ').trim().slice(0, 420),
      url: `https://www.youtube.com/watch?v=${raw.id}`
    };
  });

  const result = buildCatalog({
    videos: baseVideos,
    curationGames: curationData.games || [],
    existingGames: gamesData.games || [],
    rules: rulesData.rules || [],
    overrides: overridesData.overrides || {},
    generatedAt
  });

  const output = {
    channel: {
      id: channel.id,
      handle: CHANNEL_HANDLE.startsWith('@') ? CHANNEL_HANDLE : `@${CHANNEL_HANDLE}`,
      title: channel.snippet.title,
      description: channel.snippet.description,
      thumbnail: chooseThumbnail(channel.snippet.thumbnails),
      subscribers: Number(channel.statistics?.subscriberCount || 0),
      channelViews: Number(channel.statistics?.viewCount || 0),
      videoCount: Number(channel.statistics?.videoCount || result.videos.length),
      uploadsPlaylist,
      syncedAt: generatedAt,
      source: 'youtube-data-api-v3'
    },
    catalog: result.catalog,
    videos: result.videos
  };

  writeJSON('videos.json', output);
  writeJSON('games.json', result.gamesFile);
  writeJSON('game-audit.json', result.audit);
  fs.mkdirSync(REPORTS, { recursive: true });
  fs.writeFileSync(path.join(REPORTS, 'data-quality.md'), result.report);
  console.log(`Done. Wrote ${result.videos.length} public videos to data/videos.json.`);
  console.log(`Games identified: ${result.catalog.identifiedVideos}/${result.videos.length} (${result.catalog.coveragePercent}%).`);
  console.log(`Steam links found: ${result.catalog.steamLinkedVideos}/${result.videos.length} · canonical games: ${result.catalog.uniqueGames}.`);
  console.log(`Audit: ${result.audit.summary.ambiguousVideos} ambiguous · ${result.audit.summary.unidentifiedVideos} unidentified.`);
}

main().catch(err => {
  console.error('\nSync failed:', err.message);
  process.exit(1);
});
