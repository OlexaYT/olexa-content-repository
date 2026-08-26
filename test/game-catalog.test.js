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
  assert.equal(result.videos.find(item => item.id === 'steam').steamAppId, '4075620');
});

test('recovers a direct Steam assignment when only the canonical record retained the App ID', () => {
  const result = buildCatalog({
    generatedAt: '2026-01-01T00:00:00Z',
    existingGames: [{
      slug: 'steam-418530',
      name: 'Spelunky 2',
      steamAppId: '418530',
      steamUrl: 'https://store.steampowered.com/app/418530/'
    }],
    videos: [{
      ...video('legacy-steam', 'A Spelunky 2 Run'),
      game: 'Spelunky 2',
      gameSlug: 'steam-418530',
      gameSource: 'steam',
      steamAppId: null,
      steamUrl: null
    }]
  });
  assert.equal(result.videos[0].gameSlug, 'steam-418530');
  assert.equal(result.videos[0].gameSource, 'steam');
  assert.equal(result.videos[0].steamAppId, '418530');
});

test('does not reuse a stale Steam ID attached to a different curated game', () => {
  const result = buildCatalog({
    generatedAt: '2026-01-01T00:00:00Z',
    curationGames: [{ slug: 'curated-mystery', name: 'Curated Mystery' }],
    existingGames: [{
      slug: 'curated-mystery',
      name: 'Curated Mystery',
      steamAppId: '3430340',
      steamUrl: 'https://store.steampowered.com/app/3430340/'
    }],
    videos: [video('dice', 'Dice a Million', {
      description: 'https://store.steampowered.com/app/3430340/Dice_a_Million/'
    })]
  });
  assert.equal(result.videos[0].gameSlug, 'steam-3430340');
  assert.equal(result.videos[0].game, 'Dice a Million');
});

test('matches a camel-cased canonical name to normally spaced metadata', () => {
  const result = buildCatalog({
    generatedAt: '2026-01-01T00:00:00Z',
    videos: [
      video('steam', 'PotionCraft First Look', {
        description: 'https://store.steampowered.com/app/1210320/PotionCraft/'
      }),
      video('metadata', 'The Best Potion Craft Recipe', {
        tags: ['Potion Craft']
      })
    ]
  });
  assert.equal(result.videos.find(item => item.id === 'metadata').gameSlug, 'steam-1210320');
});

test('deduplicates exact game names that only differ by a leading article', () => {
  const result = buildCatalog({
    generatedAt: '2026-01-01T00:00:00Z',
    videos: [
      video('without-article', 'A Mod Spotlight', {
        description: 'Check out Binding of Isaac: ANTIBIRTH here! https://example.com/antibirth'
      }),
      video('with-article', 'Another Mod Spotlight', {
        description: 'Check out The Binding of Isaac: ANTIBIRTH here! https://example.com/antibirth'
      })
    ]
  });
  assert.equal(result.gamesFile.games.length, 1);
  assert.equal(result.videos[0].gameSlug, result.videos[1].gameSlug);
});

test('does not learn unrelated platform tags as game aliases', () => {
  const result = buildCatalog({
    generatedAt: '2026-01-01T00:00:00Z',
    videos: [
      video('spelunky-1', 'Spelunky 2 First Run', {
        description: 'https://store.steampowered.com/app/418530/Spelunky_2/',
        tags: ['Spelunky 2', 'PS4', 'Mossmouth']
      }),
      video('spelunky-2', 'More Spelunky 2', {
        description: 'https://store.steampowered.com/app/418530/Spelunky_2/',
        tags: ['Spelunky 2', 'PS4', 'Mossmouth']
      }),
      video('spelunky-3', 'Another Spelunky 2 Run', {
        description: 'https://store.steampowered.com/app/418530/Spelunky_2/',
        tags: ['Spelunky 2', 'PS4', 'Mossmouth']
      }),
      video('kingdom-hearts', "Even My PS4 Doesn't Want Me To Win", {
        tags: ['PS4']
      })
    ]
  });
  const spelunky = result.gamesFile.games.find(game => game.slug === 'steam-418530');
  assert.equal(result.videos.find(item => item.id === 'kingdom-hearts').gameSlug, null);
  assert.ok(!spelunky.aliases.includes('ps4'));
  assert.ok(!spelunky.aliases.includes('mossmouth'));
});

test('does not match sequel numbers across title separators', () => {
  const result = buildCatalog({
    generatedAt: '2026-01-01T00:00:00Z',
    videos: [
      video('spelunky-2', 'Spelunky 2 First Run', {
        description: 'https://store.steampowered.com/app/418530/Spelunky_2/'
      }),
      video('holiday', 'SEND LOVE :: Holiday Spelunky :: 2')
    ]
  });
  assert.equal(result.videos.find(item => item.id === 'holiday').gameSlug, null);
});

test('keeps multi-game stream titles out of single-game pages', () => {
  const result = buildCatalog({
    generatedAt: '2026-01-01T00:00:00Z',
    videos: [
      video('spelunky-2', 'Spelunky 2 First Run', {
        description: 'https://store.steampowered.com/app/418530/Spelunky_2/'
      }),
      video('mixed-stream', 'Isaac Retribution Mod and Spelunky 2 | October Stream')
    ]
  });
  assert.equal(result.videos.find(item => item.id === 'mixed-stream').gameSlug, null);
  assert.match(result.audit.ambiguous.find(item => item.id === 'mixed-stream').reason, /Multiple games/);
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
