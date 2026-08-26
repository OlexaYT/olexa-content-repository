#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');

function read(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8'));
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function main() {
  const videoData = read('videos.json');
  const gameData = read('games.json');
  const audit = read('game-audit.json');
  const videos = videoData.videos || [];
  const games = gameData.games || [];
  const videoById = new Map(videos.map(video => [video.id, video]));
  const gameBySlug = new Map(games.map(game => [game.slug, game]));
  const appIds = new Map();

  invariant(gameData.schemaVersion === 2, 'games.json must use schemaVersion 2.');
  invariant(audit.schemaVersion === 2, 'game-audit.json must use schemaVersion 2.');
  invariant(videoById.size === videos.length, 'Duplicate video IDs found.');
  invariant(gameBySlug.size === games.length, 'Duplicate canonical game slugs found.');

  for (const game of games) {
    invariant(game.slug && game.name, `Canonical game is missing slug or name: ${JSON.stringify(game)}`);
    invariant(game.videoCount === game.videoIds.length, `${game.slug}: videoCount does not match videoIds.`);
    const linkedVideos = game.videoIds.map(id => videoById.get(id));
    invariant(linkedVideos.every(Boolean), `${game.slug}: references a missing video.`);
    invariant(linkedVideos.every(video => video.gameSlug === game.slug), `${game.slug}: contains a video assigned to another game.`);
    invariant(game.totalViews === linkedVideos.reduce((sum, video) => sum + Number(video.views || 0), 0), `${game.slug}: totalViews is stale.`);
    if (game.steamAppId) {
      const appId = String(game.steamAppId);
      invariant(!appIds.has(appId), `Steam App ${appId} maps to both ${appIds.get(appId)} and ${game.slug}.`);
      appIds.set(appId, game.slug);
    }
  }

  for (const video of videos) {
    if (!video.gameSlug) continue;
    invariant(gameBySlug.has(video.gameSlug), `${video.id}: references missing game ${video.gameSlug}.`);
    invariant(gameBySlug.get(video.gameSlug).videoIds.includes(video.id), `${video.id}: missing from canonical game videoIds.`);
  }

  const identified = videos.filter(video => video.gameSlug).length;
  invariant(videoData.catalog.identifiedVideos === identified, 'videos.json identified count is stale.');
  invariant(videoData.catalog.uniqueGames === games.length, 'videos.json unique game count is stale.');
  invariant(audit.summary.identifiedVideos === identified, 'Audit identified count is stale.');
  invariant(audit.summary.canonicalGames === games.length, 'Audit canonical game count is stale.');
  invariant(audit.summary.totalVideos === videos.length, 'Audit total video count is stale.');

  console.log(`Validated ${videos.length} videos, ${identified} assignments, and ${games.length} canonical games.`);
}

main();
