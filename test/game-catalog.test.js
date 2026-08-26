'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildCatalog,
  extractDescriptionNames,
  extractSteamCandidates,
  normalizeText,
  tagAliases
} = require('../scripts/lib/game-catalog');

function video(id, title, { description = '', tags = [], views = 1, publishedAt = '2026-01-01T00:00:00Z' } = {}) {
  return {
    id,
    title,
    description,
    descriptionSnippet: description,
    tags,
    views,
    publishedAt,
    durationSeconds: 600,
    url: `https://www.youtube.com/watch?v=${id}`
  };
}

test('extracts every unique Steam App ID and its nearby name', () => {
  const matches = extractSteamCandidates([
    'Check out Combolands here!',
    'https://store.steampowered.com/app/4075620/Combolands_Roguelike_Citybuilder/',
    'Also: https://store.steampowered.com/app/123/Another_Game/'
  ].join('\n'));
  assert.deepEqual(matches.map(match => match.steamAppId), ['4075620', '123']);
  assert.ok(matches[0].names.some(name => normalizeText(name) === 'combolands'));
});

test('extracts explicit game names even when the link is not Steam', () => {
  assert.deepEqual(
    extractDescriptionNames('Check out the free playtest for Probably Stolen here! https://example.com'),
    ['Probably Stolen']
  );
  assert.deepEqual(
    extractDescriptionNames('Go check out KAZ and beat my high scores today! https://example.com'),
    ['KAZ']
  );
});

test('normalizes useful tag families without keeping generic tags', () => {
  assert.ok(tagAliases('Uncle Chop\'s Rocket Shop gameplay').includes('uncle chops rocket shop'));
  assert.deepEqual(tagAliases('yt:quality=high'), []);
  assert.deepEqual(tagAliases('roguelike'), []);
});

test('inherits a canonical Steam game through title and tag metadata', () => {
  const result = buildCatalog({
    generatedAt: '2026-01-01T00:00:00Z',
    videos: [
      video('steam', 'This Citybuilder Is Great', {
        description: 'Check out Combolands here! https://store.steampowered.com/app/4075620/Combolands_Roguelike_Citybuilder/',
        tags: ['Combolands', 'Combolands gameplay']
      }),
      video('metadata', 'More Combolands Chaos', {
        tags: ['Combolands', 'Combolands gameplay']
      })
    ]
  });
  assert.equal(result.audit.summary.beforeIdentifiedVideos, 1);
  assert.equal(result.audit.summary.identifiedVideos, 2);
  assert.equal(result.gamesFile.games.length, 1);
  assert.equal(result.gamesFile.games[0].steamAppId, '4075620');
  assert.deepEqual(result.gamesFile.games[0].videoIds, ['steam', 'metadata']);
  assert.equal(result.videos.find(item => item.id === 'metadata').gameSlug, 'steam-4075620');
});

test('does not force a single-game mapping when a description links multiple Steam apps', () => {
  const result = buildCatalog({
    generatedAt: '2026-01-01T00:00:00Z',
    videos: [video('roundup', 'Ten Games You Should Play', {
      description: 'https://store.steampowered.com/app/111/One/ https://store.steampowered.com/app/222/Two/'
    })]
  });
  assert.equal(result.videos[0].gameSlug, null);
  assert.equal(result.audit.summary.ambiguousVideos, 1);
});

test('creates a persistent non-Steam canonical record from explicit description text', () => {
  const result = buildCatalog({
    generatedAt: '2026-01-01T00:00:00Z',
    videos: [video('external', 'A Sponsored Dive', {
      description: 'Check out Dive or Die here! https://example.com/dive-or-die'
    })]
  });
  assert.equal(result.videos[0].gameSlug, 'dive-or-die');
  assert.equal(result.videos[0].gameSource, 'description');
  assert.equal(result.gamesFile.games[0].name, 'Dive or Die');
});
