#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { buildCatalog } = require('./lib/game-catalog');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const REPORTS = path.join(ROOT, 'reports');

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8')); }
  catch { return fallback; }
}

function writeJSON(file, value) {
  fs.writeFileSync(path.join(DATA, file), `${JSON.stringify(value, null, 2)}\n`);
}

function main() {
  const videoData = readJSON('videos.json', { videos: [] });
  const currentGames = readJSON('games.json', { games: [] });
  const curation = readJSON('game-curation.json', { games: [] });
  const rules = readJSON('game-rules.json', { rules: [] });
  const overrides = readJSON('video-overrides.json', { overrides: {} });
  const videos = (videoData.videos || []).map(video => ({
    ...video,
    description: video.descriptionSnippet || ''
  }));
  const generatedAt = videoData.channel?.syncedAt || new Date().toISOString();
  const result = buildCatalog({
    videos,
    curationGames: curation.games || [],
    existingGames: currentGames.games || [],
    rules: rules.rules || [],
    overrides: overrides.overrides || {},
    generatedAt
  });

  writeJSON('videos.json', { ...videoData, catalog: result.catalog, videos: result.videos });
  writeJSON('games.json', result.gamesFile);
  writeJSON('game-audit.json', result.audit);
  fs.mkdirSync(REPORTS, { recursive: true });
  fs.writeFileSync(path.join(REPORTS, 'data-quality.md'), result.report);

  const before = result.audit.summary.beforeIdentifiedVideos;
  const after = result.audit.summary.identifiedVideos;
  const total = result.audit.summary.totalVideos;
  console.log(`Before: ${before}/${total} (${result.audit.summary.beforeCoveragePercent}%)`);
  console.log(`After:  ${after}/${total} (${result.audit.summary.coveragePercent}%)`);
  console.log(`Gain:   ${result.audit.summary.coverageGain} videos`);
  console.log(`Games:  ${result.audit.summary.canonicalGames}`);
  console.log(`Audit:  ${result.audit.summary.ambiguousVideos} ambiguous · ${result.audit.summary.unidentifiedVideos} unidentified · ${result.audit.summary.duplicateMappingGroups} duplicate groups`);
}

main();
