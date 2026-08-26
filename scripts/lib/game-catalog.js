'use strict';

const GENERIC_TAGS = new Set([
  'olexa', 'video', 'videos', 'indie', 'gaming', 'game', 'games', 'gameplay',
  'pc', 'steam', 'twitch', 'commentary', 'mod', 'mods', 'modded', 'review',
  'roguelike', 'roguelikes', 'roguelite', 'roguelites', 'deckbuilder',
  'deckbuilders', 'strategy', 'puzzle', 'simulation', 'lets play', "let's play",
  'playthrough', 'walkthrough', 'yt quality high', 'yt stretch 16 9', 'the',
  'this', 'that', 'you', 'your', 'our', 'for', 'from', 'with', 'content',
  'live', 'stream', 'demo', 'playtest', 'everyone', 'boom', 'tags', 'episode',
  'lets', 'multiplayer', 'single player', 'co op', 'coop', 'online', 'super',
  'funny', 'indie game', 'strategy game', 'puzzle game', 'new game', 'free game'
]);

const BAD_NAME_WORDS = /\b(channel|discord|merch|merchandise|playlist|podcast|survey|trailer reaction|this video|my video|youtube|twitch|patreon|newsletter|nexus store|full series|all videos|game if you please|play the demo|join me|for yourself|using the link|link below|newest update|latest update|print ['’]?n play version|the ost|all of the competitors|some .{0,30} games|huge list of mods)\b/i;
const BAD_NAME_SHAPE = /^(?:(?:the|a|my|our)\s+)?(?:demo|free demo|playtest|mod|modpack|full series|playlist|everyone|live|stream|game|the game for free|episode|video|link|it)$/i;
const NON_GAME_LINK = /(?:youtube\.com|youtu\.be|twitch\.tv|twitter\.com|x\.com|discord\.(?:gg|com)|steamcommunity\.com|patreon\.com)/i;
const MALFORMED_NAME = /^(?:steam app \d+|unknown|untitled)$/i;
const TAG_SUFFIX = /\s+(?:gameplay|game|steam|review|guide|demo|playtest|trailer|walkthrough|playthrough|playlist|series|ranked|preview|download|full release|pc game|ps[345]|xbox|switch|ไทย|wmp)$/i;
const GENERATED_GAME_FIELDS = new Set([
  'aliases', 'firstPlayedAt', 'lastPlayedAt', 'latestVideo', 'videoCount',
  'totalViews', 'totalDurationSeconds', 'videoIds', 'identificationSources',
  'averageConfidence', 'source'
]);

function cleanGameName(value = '') {
  return String(value)
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/^\s*(?:the\s+)?(?:free\s+)?(?:demo|playtest|store page)\s+(?:for|of)\s+/i, '')
    .replace(/^\s*(?:go\s+)?check\s+out\s+/i, '')
    .replace(/^\s*(?:play|wishlist|try)\s+/i, '')
    .replace(/\s+(?:here|on\s+steam|today|now)\s*!?\s*$/i, '')
    .replace(/[|•]+$/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,:;–—-]+|[\s,:;–—-]+$/g, '')
    .trim();
}

function normalizeText(value = '') {
  return String(value)
    .normalize('NFKD')
    .replace(/[’']/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function slugify(value = '') {
  return normalizeText(value).replace(/\s+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'unknown-game';
}

function isPlausibleGameName(value = '') {
  const name = cleanGameName(value);
  const normalized = normalizeText(name);
  if (name.length < 2 || name.length > 90 || normalized.length < 2) return false;
  if (MALFORMED_NAME.test(name) || BAD_NAME_WORDS.test(name) || BAD_NAME_SHAPE.test(name)) return false;
  if (/^(?:here|click here|today|now|free|new game|the game)$/i.test(name)) return false;
  if (/^[\d\W]+$/.test(name)) return false;
  return true;
}

function isStrongExplicitGameName(value = '') {
  const name = cleanGameName(value);
  if (!isPlausibleGameName(name) || name.length > 65) return false;
  if (/\b(?:your|yourself|ourselves|myself|we|everyone|version|series|videos?|cards?\.\s+join|on\s+(?:itch|(?:my\s+)?nexus)|on\s+tabletop\s+simulator|streak|kickstarter|mods?\s+for|releasing|release)\b/i.test(name)) return false;
  if (/^(?:some|all|this|that|these|those|our|my|your|an?\s+(?:absolutely|new|huge))\b/i.test(name)) return false;
  if (/^(?:todays?|the\s+free\s+(?:autobattler|demo|game))\b/i.test(normalizeText(name))) return false;
  if (/\bmod\b/i.test(name) && !/^mod\b/i.test(name)) return false;
  const words = name.match(/[A-Za-z0-9][A-Za-z0-9'’.-]*/g) || [];
  if (!words.length || words.length > 9) return false;
  const minor = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'vs', 'with']);
  const significant = words.filter(word => !minor.has(word.toLowerCase()));
  const titleLike = significant.filter(word => /^[A-Z0-9]|[A-Z].*[A-Z]/.test(word)).length;
  return significant.length > 0 && titleLike / significant.length >= 0.6;
}

function nameFromSteamPath(pathname = '') {
  try {
    const parts = decodeURIComponent(pathname).split('/').filter(Boolean);
    const appIndex = parts.findIndex(part => part.toLowerCase() === 'app');
    const name = appIndex >= 0 ? parts[appIndex + 2] : '';
    return cleanGameName(String(name || '').replace(/_/g, ' '));
  } catch {
    return '';
  }
}

function extractDescriptionNames(description = '') {
  const text = String(description).replace(/\r/g, ' ');
  const patterns = [
    /(?:go\s+)?check\s+out\s+(?:the\s+)?(?:free\s+)?(?:demo|playtest)\s+(?:for|of)\s+([^\n]{2,90}?)(?:\s+here|\s+on\s+steam|\s+today|\s+now|!|:|\s+--|\s+https?:\/\/)/ig,
    /(?:go\s+)?check\s+out\s+([^\n]{2,90}?)(?:\s+here|\s+on\s+steam|\s+today|\s+now|!|:|\s+--|\s+https?:\/\/)/ig,
    /(?:play|wishlist|try)\s+([^\n]{2,90}?)(?:\s+here|\s+on\s+steam|\s+today|\s+now|!|:|\s+--|\s+https?:\/\/)/ig,
    /go\s+check\s+out\s+([^\n]{2,55}?)\s+and\b/ig
  ];
  const names = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const name = cleanGameName(match[1]);
      const nearby = text.slice(match.index, match.index + match[0].length + 180);
      const linkedUrl = nearby.match(/https?:\/\/[^\s]+/i)?.[0] || '';
      if (linkedUrl && NON_GAME_LINK.test(linkedUrl)) continue;
      if (isPlausibleGameName(name)) names.push(name);
    }
  }
  const unique = [...new Map(names.map(name => [normalizeText(name), name])).values()];
  return unique.filter(name => {
    const normalized = normalizeText(name);
    return !unique.some(other => {
      const shorter = normalizeText(other);
      return shorter !== normalized && normalized.startsWith(`${shorter} and `);
    });
  });
}

function extractSteamCandidates(description = '') {
  const text = String(description);
  const regex = /https?:\/\/(?:store\.)?steampowered\.com\/app\/(\d+)(?:\/[^\s?#]*)?/ig;
  const byApp = new Map();
  for (const match of text.matchAll(regex)) {
    const appId = match[1];
    const before = text.slice(Math.max(0, match.index - 260), match.index + match[0].length);
    const adjacentNames = extractDescriptionNames(before);
    let pathName = '';
    try { pathName = nameFromSteamPath(new URL(match[0]).pathname); } catch { pathName = ''; }
    const current = byApp.get(appId) || {
      steamAppId: appId,
      steamUrl: `https://store.steampowered.com/app/${appId}/`,
      names: [],
      descriptionNames: [],
      pathNames: []
    };
    current.descriptionNames.push(...adjacentNames);
    if (isPlausibleGameName(pathName)) current.pathNames.push(pathName);
    current.descriptionNames = [...new Map(current.descriptionNames.map(name => [normalizeText(name), name])).values()];
    current.pathNames = [...new Map(current.pathNames.map(name => [normalizeText(name), name])).values()];
    current.names.push(...current.descriptionNames, ...current.pathNames);
    current.names = [...new Map(current.names.map(name => [normalizeText(name), name])).values()];
    byApp.set(appId, current);
  }
  return [...byApp.values()];
}

function aliasesForName(name = '') {
  const aliases = new Set();
  const normalized = normalizeText(name);
  if (normalized) aliases.add(normalized);
  const withCamelCaseSpacing = normalizeText(String(name).replace(/([a-z0-9])([A-Z])/g, '$1 $2'));
  if (withCamelCaseSpacing.length >= 3) aliases.add(withCamelCaseSpacing);
  const withoutEdition = normalized
    .replace(/\b(?:demo|playtest|prologue|early access|full release)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (withoutEdition.length >= 3) aliases.add(withoutEdition);
  const arabicNumerals = normalized.replace(/\bii\b/g, '2').replace(/\biii\b/g, '3').replace(/\biv\b/g, '4');
  if (arabicNumerals !== normalized) aliases.add(arabicNumerals);
  return [...aliases];
}

function tagAliases(tag = '') {
  const original = cleanGameName(tag);
  const values = new Set();
  let candidate = original;
  for (let i = 0; i < 3 && candidate; i += 1) {
    const normalized = normalizeText(candidate);
    if (normalized) values.add(normalized);
    const stripped = candidate.replace(TAG_SUFFIX, '').trim();
    if (stripped === candidate) break;
    candidate = stripped;
  }
  return [...values].filter(alias => {
    if (alias.length < 3 || alias.length > 60 || GENERIC_TAGS.has(alias)) return false;
    if (/^yt\b/.test(alias) || /^(?:best|top|new)\s+(?:indie\s+)?(?:roguelike|roguelite|games?)\b/.test(alias)) return false;
    return !BAD_NAME_WORDS.test(alias);
  });
}

function extractTitleCandidates(title = '') {
  const candidates = [];
  const segments = String(title).split(/\s+(?:\||::)\s+/).map(cleanGameName);
  if (segments.length > 1) {
    for (const segment of segments.slice(1)) {
      const cleaned = segment
        .replace(/^\[.*?]\s*/, '')
        .replace(/\s*(?:ep(?:isode)?\.?\s*)?#?\d+\s*$/i, '')
        .trim();
      if (isPlausibleGameName(cleaned) && !/^(?:part|episode|stream|members first)\b/i.test(cleaned)) candidates.push(cleaned);
    }
  }
  return [...new Map(candidates.map(name => [normalizeText(name), name])).values()];
}

function phraseIncludes(haystack, phrase) {
  if (!haystack || !phrase) return false;
  return ` ${haystack} `.includes(` ${phrase} `);
}

function titleLooksLikeMultiGameArchive(title = '', matchedSegments = []) {
  const value = String(title);
  if (!value.includes('|') || !/\bstreams?\b/i.test(value)) return false;
  const primarySegment = value.split(/\s+\|\s+/)[0].trim();
  if (!matchedSegments.includes(primarySegment)) return false;
  return /,\s+|\s+(?:and|&|\+)\s+|\.{2,}/i.test(primarySegment);
}

function chooseCanonicalName(candidates, fallback) {
  const scores = new Map();
  for (const candidate of candidates) {
    const name = cleanGameName(candidate.name);
    if (!isPlausibleGameName(name)) continue;
    const key = normalizeText(name);
    const wordCount = normalizeText(name).split(' ').filter(Boolean).length;
    let qualityPenalty = /^(?:the\s+)?(?:full release|demo|playtest)\s+(?:of\s+)?/i.test(name) ? 8 : 0;
    if (/^(?:a|an|the)\s+(?:new|free|beautiful|brilliant|upcoming)\b/i.test(name)) qualityPenalty += 14;
    if (/\bfrom\s+[A-Z]|,/.test(name)) qualityPenalty += 8;
    qualityPenalty += Math.max(0, wordCount - 6) * 3;
    const score = Number(candidate.weight || 1) - qualityPenalty;
    const entry = scores.get(key) || { name, score: 0, count: 0 };
    entry.score += score;
    entry.count += 1;
    if (name.length < entry.name.length && !/\b(?:demo|playtest)\b/i.test(name)) entry.name = name;
    scores.set(key, entry);
  }
  const best = [...scores.values()].sort((a, b) => b.score - a.score || b.count - a.count || a.name.length - b.name.length)[0];
  return best?.name || fallback;
}

function manualClassification(video, curationGames, rules, overrides) {
  const override = overrides[video.id] || {};
  if (override.hide) return { hide: true };
  const gameBySlug = new Map(curationGames.map(game => [game.slug, game]));
  let slug = override.gameSlug || null;
  let source = slug ? 'override' : null;
  if (!slug && video.gameSlug && ['override', 'rule', 'steam+curated'].includes(video.gameSource)) {
    slug = video.gameSlug;
    source = video.gameSource === 'override' ? 'override' : 'rule';
  }
  if (!slug) {
    const haystack = [video.title, video.description, video.descriptionSnippet, ...(video.tags || [])].join('\n').toLowerCase();
    let best = null;
    for (const rule of rules) {
      const hits = (rule.any || []).filter(term => haystack.includes(String(term).toLowerCase()));
      if (!hits.length) continue;
      const score = Math.max(...hits.map(term => String(term).length)) + hits.length * 3;
      if (!best || score > best.score) best = { slug: rule.gameSlug, score };
    }
    slug = best?.slug || null;
    if (slug) source = 'rule';
  }
  const game = slug ? gameBySlug.get(slug) : null;
  return {
    hide: false,
    gameSlug: slug,
    game: override.game || game?.name || null,
    genres: override.genres || game?.genres || [],
    series: override.series || video.series || null,
    source
  };
}

function preservedMetadata(record = {}) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !GENERATED_GAME_FIELDS.has(key)));
}

function sourceConfidence(source) {
  if (source === 'override') return 1;
  if (source === 'rule' || source === 'steam+curated') return 0.99;
  if (source === 'steam') return 0.98;
  if (source === 'description') return 0.95;
  if (source === 'title') return 0.9;
  if (source === 'metadata') return 0.87;
  if (source === 'tags') return 0.83;
  return 0;
}

function buildCatalog({ videos = [], curationGames = [], existingGames = [], rules = [], overrides = {}, generatedAt = new Date().toISOString() }) {
  const existingBySlug = new Map(existingGames.map(game => [game.slug, game]));
  const existingByApp = new Map(existingGames.filter(game => game.steamAppId).map(game => [String(game.steamAppId), game]));
  const curationBySlug = new Map(curationGames.map(game => [game.slug, game]));
  const identities = new Map();
  const appToSlug = new Map();
  const diagnostics = {
    multiSteamVideos: [],
    steamAppConflicts: [],
    ambiguous: [],
    aliasCollisions: []
  };

  function ensureIdentity(slug, data = {}) {
    const current = identities.get(slug) || { slug, name: data.name || slug, genres: [], aliases: new Set() };
    Object.assign(current, data);
    current.slug = slug;
    current.genres = data.genres?.length ? [...data.genres] : (current.genres || []);
    current.aliases = current.aliases instanceof Set ? current.aliases : new Set(current.aliases || []);
    for (const alias of aliasesForName(current.name)) current.aliases.add(alias);
    identities.set(slug, current);
    if (current.steamAppId) appToSlug.set(String(current.steamAppId), slug);
    return current;
  }

  for (const curated of curationGames) {
    const existing = existingBySlug.get(curated.slug) || {};
    ensureIdentity(curated.slug, { ...preservedMetadata(existing), ...curated });
  }

  const signals = videos.map(video => {
    const description = video.description || video.descriptionSnippet || '';
    const extractedSteam = extractSteamCandidates(description);
    const previousDirectGame = ['steam', 'steam+curated'].includes(video.gameSource)
      ? existingBySlug.get(video.gameSlug)
      : null;
    const recoveredSteamAppId = video.steamAppId || previousDirectGame?.steamAppId;
    const recoveredSteamUrl = video.steamUrl || previousDirectGame?.steamUrl;
    if (recoveredSteamAppId && !extractedSteam.some(item => item.steamAppId === String(recoveredSteamAppId))) {
      extractedSteam.push({
        steamAppId: String(recoveredSteamAppId),
        steamUrl: recoveredSteamUrl || `https://store.steampowered.com/app/${recoveredSteamAppId}/`,
        names: isPlausibleGameName(video.game) ? [video.game] : [],
        descriptionNames: [],
        pathNames: []
      });
    }
    const uniqueSteam = [...new Map(extractedSteam.map(item => [item.steamAppId, item])).values()];
    const manual = manualClassification({ ...video, description }, curationGames, rules, overrides);
    return {
      video,
      description,
      descriptionNames: extractDescriptionNames(description),
      steam: uniqueSteam,
      manual,
      titleCandidates: extractTitleCandidates(video.title),
      assignment: null,
      hidden: manual.hide
    };
  }).filter(signal => !signal.hidden);

  const appGroups = new Map();
  for (const signal of signals) {
    if (signal.steam.length > 1 && !signal.manual.gameSlug) {
      diagnostics.multiSteamVideos.push({
        id: signal.video.id,
        title: signal.video.title,
        steamAppIds: signal.steam.map(item => item.steamAppId)
      });
      continue;
    }
    const steam = signal.steam[0];
    if (!steam) continue;
    const group = appGroups.get(steam.steamAppId) || { signals: [], candidates: [], manualSlugs: new Set() };
    group.signals.push(signal);
    if (signal.manual.gameSlug) group.manualSlugs.add(signal.manual.gameSlug);
    for (const name of steam.pathNames || []) group.candidates.push({ name, weight: 40 });
    for (const name of steam.descriptionNames || []) group.candidates.push({ name, weight: 45 });
    if (!(steam.pathNames || []).length && !(steam.descriptionNames || []).length) {
      for (const name of steam.names || []) group.candidates.push({ name, weight: 2 });
    }
    for (const name of signal.descriptionNames) group.candidates.push({ name, weight: 5 });
    if (isPlausibleGameName(signal.video.game)) group.candidates.push({ name: signal.video.game, weight: 1 });
    appGroups.set(steam.steamAppId, group);
  }

  for (const [appId, group] of appGroups) {
    const manualSlugs = [...group.manualSlugs];
    if (manualSlugs.length > 1) {
      diagnostics.steamAppConflicts.push({ steamAppId: appId, slugs: manualSlugs });
    }
    const curatedForApp = curationGames.find(game => String(game.steamAppId || '') === appId);
    const existingCandidate = existingByApp.get(appId);
    const existingCuration = existingCandidate ? curationBySlug.get(existingCandidate.slug) : null;
    const existingHasCuratedConflict = existingCuration
      && String(existingCuration.steamAppId || '') !== appId;
    const existing = existingHasCuratedConflict ? null : existingCandidate;
    if (existingHasCuratedConflict) {
      diagnostics.steamAppConflicts.push({
        steamAppId: appId,
        slugs: [existingCandidate.slug, `steam-${appId}`],
        reason: 'Existing Steam mapping conflicts with curated game metadata.'
      });
    }
    const slug = curatedForApp?.slug || manualSlugs[0] || existing?.slug || `steam-${appId}`;
    if (curatedForApp?.name) group.candidates.push({ name: curatedForApp.name, weight: 1000 });
    if (existing?.name) group.candidates.push({ name: existing.name, weight: 25 });
    const fallback = `Steam App ${appId}`;
    const name = chooseCanonicalName(group.candidates, fallback);
    const curated = curationBySlug.get(slug) || {};
    ensureIdentity(slug, {
      ...preservedMetadata(existing || existingBySlug.get(slug) || {}),
      ...curated,
      slug,
      name: curated.name || name,
      steamAppId: appId,
      steamUrl: curated.steamUrl || existing?.steamUrl || `https://store.steampowered.com/app/${appId}/`
    });
    appToSlug.set(appId, slug);
  }

  function resolveName(name) {
    const aliases = aliasesForName(name);
    const exactKeys = new Set(aliases.flatMap(alias => [alias, alias.replace(/^the\s+/, '')]));
    const hits = [];
    for (const identity of identities.values()) {
      const identityKeys = [...identity.aliases].flatMap(alias => [alias, alias.replace(/^the\s+/, '')]);
      if (identityKeys.some(alias => exactKeys.has(alias))) hits.push(identity);
    }
    return hits.length === 1 ? hits[0] : null;
  }

  function assign(signal, identity, source, reasons) {
    signal.assignment = {
      slug: identity.slug,
      source,
      confidence: sourceConfidence(source),
      reasons: [...new Set(reasons || [])]
    };
  }

  for (const signal of signals) {
    const steam = signal.steam.length === 1 ? signal.steam[0] : null;
    if (signal.manual.gameSlug) {
      const curated = curationBySlug.get(signal.manual.gameSlug) || existingBySlug.get(signal.manual.gameSlug) || {};
      const currentIdentity = identities.get(signal.manual.gameSlug) || {};
      const identity = ensureIdentity(signal.manual.gameSlug, {
        ...preservedMetadata(curated),
        name: signal.manual.game || curated.name || signal.manual.gameSlug,
        genres: signal.manual.genres || curated.genres || [],
        steamAppId: steam?.steamAppId || curated.steamAppId || currentIdentity.steamAppId || null,
        steamUrl: steam?.steamUrl || curated.steamUrl || currentIdentity.steamUrl || null
      });
      if (steam) appToSlug.set(steam.steamAppId, identity.slug);
      assign(signal, identity, steam ? 'steam+curated' : signal.manual.source, ['manual mapping']);
      continue;
    }
    if (steam && appToSlug.has(steam.steamAppId)) {
      assign(signal, identities.get(appToSlug.get(steam.steamAppId)), 'steam', [`Steam App ${steam.steamAppId}`]);
      continue;
    }
    if (signal.steam.length > 1) continue;
    const explicitName = signal.descriptionNames.find(name => resolveName(name) || isStrongExplicitGameName(name));
    if (explicitName) {
      let identity = resolveName(explicitName);
      if (!identity) {
        let slug = slugify(explicitName);
        if (identities.has(slug) && normalizeText(identities.get(slug).name) !== normalizeText(explicitName)) {
          let suffix = 2;
          while (identities.has(`${slug}-${suffix}`)) suffix += 1;
          slug = `${slug}-${suffix}`;
        }
        identity = ensureIdentity(slug, { name: explicitName, steamAppId: null, steamUrl: null, source: 'description' });
      }
      assign(signal, identity, 'description', [`description names “${explicitName}”`]);
    }
  }

  // Tags frequently contain platforms, publishers, creators, genres, and stale
  // metadata copied from unrelated uploads. Only learn a tag as an alias when
  // it actually contains a trusted alias for the assigned game. Uniqueness in
  // the currently identified corpus is not enough: a tag such as "ps4" can be
  // unique to one seeded game and then contaminate every unrelated PS4 video.
  const trustedAliasesBySlug = new Map(
    [...identities].map(([slug, identity]) => [slug, new Set(identity.aliases)])
  );
  const tagStats = new Map();
  for (const signal of signals.filter(item => item.assignment)) {
    const seen = new Set();
    const trustedAliases = trustedAliasesBySlug.get(signal.assignment.slug) || new Set();
    for (const tag of signal.video.tags || []) {
      for (const alias of tagAliases(tag)) {
        if (seen.has(alias)) continue;
        const belongsToAssignedGame = [...trustedAliases].some(trustedAlias => phraseIncludes(alias, trustedAlias));
        if (!belongsToAssignedGame) continue;
        seen.add(alias);
        const stat = tagStats.get(alias) || new Map();
        stat.set(signal.assignment.slug, (stat.get(signal.assignment.slug) || 0) + 1);
        tagStats.set(alias, stat);
      }
    }
  }

  const learnedAliases = new Map();
  for (const [alias, counts] of tagStats) {
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const identity = ranked.length === 1 ? identities.get(ranked[0][0]) : null;
    const isCanonicalAlias = identity ? aliasesForName(identity.name).includes(alias) : false;
    const isSpecificLearnedAlias = alias.includes(' ') ? ranked[0]?.[1] >= 2 : ranked[0]?.[1] >= 3;
    if (ranked.length === 1 && (isCanonicalAlias || isSpecificLearnedAlias)) {
      learnedAliases.set(alias, { slug: ranked[0][0], count: ranked[0][1] });
      identity?.aliases.add(alias);
    } else if (ranked.length > 1) {
      diagnostics.aliasCollisions.push({ alias, games: ranked.map(([slug, count]) => ({ slug, count })) });
    }
  }

  const titleDiscovery = new Map();
  for (const signal of signals.filter(item => !item.assignment)) {
    for (const name of signal.titleCandidates) {
      const key = normalizeText(name);
      const entry = titleDiscovery.get(key) || { name, videoIds: new Set(), tagSupport: 0 };
      entry.videoIds.add(signal.video.id);
      if ((signal.video.tags || []).some(tag => tagAliases(tag).includes(key))) entry.tagSupport += 1;
      titleDiscovery.set(key, entry);
    }
  }
  for (const [key, entry] of titleDiscovery) {
    if (entry.videoIds.size < 2 || entry.tagSupport < 2) continue;
    if (/\b(?:modded|streaks?|mod spotlights?|tutorials?|gameplay|with (?:friends|the squad)|streams?|road to|rotation|challenges?)\b/i.test(entry.name)) continue;
    if (resolveName(entry.name)) continue;
    let slug = slugify(entry.name);
    if (identities.has(slug)) continue;
    const identity = ensureIdentity(slug, { name: entry.name, steamAppId: null, steamUrl: null, source: 'title' });
    identity.aliases.add(key);
    entry.slug = slug;
    entry.accepted = true;
  }

  const aliasIndex = new Map();
  for (const identity of identities.values()) {
    for (const alias of identity.aliases) {
      if (alias.length < 3 || GENERIC_TAGS.has(alias)) continue;
      const slugs = aliasIndex.get(alias) || new Set();
      slugs.add(identity.slug);
      aliasIndex.set(alias, slugs);
    }
  }

  for (const signal of signals.filter(item => !item.assignment)) {
    if (signal.steam.length > 1) continue;
    const candidates = new Map();
    function addCandidate(slug, score, reason, type) {
      if (!identities.has(slug)) return;
      const candidate = candidates.get(slug) || { slug, score: 0, reasons: [], types: new Set() };
      candidate.score = Math.max(candidate.score, score);
      candidate.reasons.push(reason);
      candidate.types.add(type);
      candidates.set(slug, candidate);
    }

    const titleSegments = String(signal.video.title).split(/\s+(?:\||::)\s+/).filter(Boolean);
    const normalizedTitleSegments = titleSegments.map(normalizeText);
    const normalizedDescription = normalizeText(signal.description.slice(0, 900));
    const titleKeys = new Set(signal.titleCandidates.map(normalizeText));

    for (const [alias, slugs] of aliasIndex) {
      if (titleKeys.has(alias)) {
        for (const slug of slugs) addCandidate(slug, 96, `title segment “${alias}”`, 'title');
      } else if (normalizedTitleSegments.some(segment => phraseIncludes(segment, alias))) {
        const specificity = Math.min(4, Math.max(0, alias.split(' ').length - 1));
        for (const slug of slugs) addCandidate(slug, 92 + specificity, `title contains “${alias}”`, 'title');
      } else if (alias.length >= 8 && phraseIncludes(normalizedDescription, alias)) {
        for (const slug of slugs) {
          const identity = identities.get(slug);
          if (aliasesForName(identity?.name).includes(alias)) {
            addCandidate(slug, 67, `description mentions “${alias}”`, 'description-mention');
          }
        }
      }
    }

    const seenTagAliases = new Set();
    for (const tag of signal.video.tags || []) {
      for (const alias of tagAliases(tag)) {
        if (seenTagAliases.has(alias)) continue;
        seenTagAliases.add(alias);
        const learned = learnedAliases.get(alias);
        if (learned) addCandidate(learned.slug, 78 + Math.min(learned.count, 8), `tag family “${alias}”`, 'tags');
        const exact = aliasIndex.get(alias);
        if (exact) for (const slug of exact) addCandidate(slug, 78, `tag names “${alias}”`, 'tags');
      }
    }

    for (const name of signal.titleCandidates) {
      const discovery = titleDiscovery.get(normalizeText(name));
      if (discovery?.accepted) addCandidate(discovery.slug, 86, `recurring title segment “${name}”`, 'title');
    }

    for (const candidate of candidates.values()) {
      if (candidate.types.size > 1) candidate.score += 5;
    }
    const ranked = [...candidates.values()].sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug));
    const top = ranked[0];
    const closeRivals = top ? ranked.slice(1).filter(candidate => top.score - candidate.score < 8) : [];
    const topName = top ? normalizeText(identities.get(top.slug)?.name) : '';
    const specificDominance = top && closeRivals.length > 0 && closeRivals.every(rival => {
      const rivalName = normalizeText(identities.get(rival.slug)?.name);
      return top.score > rival.score && (phraseIncludes(topName, rivalName) || phraseIncludes(rivalName, topName));
    });
    const matchedTitleSegments = top
      ? titleSegments.filter(segment => [...(identities.get(top.slug)?.aliases || [])]
        .some(alias => phraseIncludes(normalizeText(segment), alias)))
      : [];
    const multiGameTitle = top?.types.size === 1 && top.types.has('title')
      && titleLooksLikeMultiGameArchive(signal.video.title, matchedTitleSegments);
    if (top && top.score >= 82 && !multiGameTitle && (!closeRivals.length || specificDominance)) {
      const source = top.types.has('title') && top.types.has('tags') ? 'metadata' : (top.types.has('title') ? 'title' : 'tags');
      assign(signal, identities.get(top.slug), source, top.reasons);
    } else if (top && top.score >= 70) {
      diagnostics.ambiguous.push({
        id: signal.video.id,
        title: signal.video.title,
        publishedAt: signal.video.publishedAt,
        views: Number(signal.video.views || 0),
        reason: multiGameTitle ? 'Multiple games appear in one title; no single-game mapping was forced.' : undefined,
        candidates: ranked.slice(0, 5).map(candidate => ({
          slug: candidate.slug,
          name: identities.get(candidate.slug)?.name || candidate.slug,
          score: candidate.score,
          reasons: [...new Set(candidate.reasons)]
        }))
      });
    }
  }

  const outputVideos = [];
  for (const signal of signals) {
    const video = { ...signal.video };
    delete video.description;
    const assignment = signal.assignment;
    if (!assignment) {
      video.game = null;
      video.gameSlug = null;
      video.gameSource = null;
      video.gameConfidence = null;
      video.gameEvidence = [];
      video.genres = [];
      outputVideos.push(video);
      continue;
    }
    const identity = identities.get(assignment.slug);
    video.game = identity.name;
    video.gameSlug = identity.slug;
    video.gameSource = assignment.source;
    video.gameConfidence = assignment.confidence;
    video.gameEvidence = assignment.reasons;
    if (['steam', 'steam+curated'].includes(assignment.source) && identity.steamAppId) {
      video.steamAppId = String(identity.steamAppId);
      video.steamUrl = identity.steamUrl || `https://store.steampowered.com/app/${identity.steamAppId}/`;
    }
    video.genres = signal.manual.genres?.length ? signal.manual.genres : (identity.genres || []);
    video.series = signal.manual.series || video.series || null;
    outputVideos.push(video);
  }

  outputVideos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  const videosBySlug = new Map();
  for (const video of outputVideos) {
    if (!video.gameSlug) continue;
    const list = videosBySlug.get(video.gameSlug) || [];
    list.push(video);
    videosBySlug.set(video.gameSlug, list);
  }

  const canonicalGames = [];
  for (const [slug, gameVideos] of videosBySlug) {
    const identity = identities.get(slug) || ensureIdentity(slug, { name: gameVideos[0].game || slug });
    const curated = curationBySlug.get(slug) || {};
    const existing = existingBySlug.get(slug) || {};
    const sorted = [...gameVideos].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    const dates = sorted.map(video => new Date(video.publishedAt)).filter(date => !Number.isNaN(date.valueOf())).sort((a, b) => a - b);
    const sourceCounts = gameVideos.reduce((counts, video) => {
      const source = video.gameSource || 'unknown';
      counts[source] = (counts[source] || 0) + 1;
      return counts;
    }, {});
    const latest = sorted[0];
    canonicalGames.push({
      ...preservedMetadata(existing),
      ...curated,
      slug,
      name: curated.name || identity.name,
      aliases: [...identity.aliases].sort(),
      genres: curated.genres || identity.genres || [],
      description: curated.description || existing.description || null,
      steamAppId: identity.steamAppId || curated.steamAppId || existing.steamAppId || null,
      steamUrl: identity.steamUrl || curated.steamUrl || existing.steamUrl || null,
      firstPlayedAt: dates[0]?.toISOString() || null,
      lastPlayedAt: dates.at(-1)?.toISOString() || null,
      videoCount: gameVideos.length,
      totalViews: gameVideos.reduce((sum, video) => sum + Number(video.views || 0), 0),
      totalDurationSeconds: gameVideos.reduce((sum, video) => sum + Number(video.durationSeconds || 0), 0),
      averageConfidence: Number((gameVideos.reduce((sum, video) => sum + Number(video.gameConfidence || 0), 0) / gameVideos.length).toFixed(3)),
      identificationSources: Object.fromEntries(Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])),
      latestVideo: latest ? {
        id: latest.id,
        title: latest.title,
        publishedAt: latest.publishedAt,
        thumbnail: latest.thumbnail || null
      } : null,
      videoIds: sorted.map(video => video.id)
    });
  }
  canonicalGames.sort((a, b) => a.name.localeCompare(b.name));

  const normalizedGames = new Map();
  for (const game of canonicalGames) {
    const key = normalizeText(game.name).replace(/\b(?:demo|playtest|prologue|early access|full release)\b/g, '').replace(/\s+/g, ' ').trim();
    const list = normalizedGames.get(key) || [];
    list.push(game);
    normalizedGames.set(key, list);
  }
  const duplicateMappings = [...normalizedGames.entries()]
    .filter(([, games]) => games.length > 1)
    .map(([normalizedName, games]) => ({
      normalizedName,
      games: games.map(game => ({ slug: game.slug, name: game.name, steamAppId: game.steamAppId, videoCount: game.videoCount }))
    }));

  const malformedGames = canonicalGames
    .filter(game => MALFORMED_NAME.test(game.name) || /_|%[0-9A-F]{2}/i.test(game.name))
    .map(game => ({ slug: game.slug, name: game.name, steamAppId: game.steamAppId, videoCount: game.videoCount }));

  const unresolved = outputVideos.filter(video => !video.gameSlug);
  const bySource = outputVideos.reduce((counts, video) => {
    const source = video.gameSource || 'unidentified';
    counts[source] = (counts[source] || 0) + 1;
    return counts;
  }, {});
  const baselineIdentified = signals.filter(signal => signal.manual.gameSlug || signal.steam.length >= 1).length;
  const identified = outputVideos.length - unresolved.length;
  const steamLinked = signals.filter(signal => signal.steam.length >= 1).length;

  const audit = {
    schemaVersion: 2,
    generatedAt,
    summary: {
      totalVideos: outputVideos.length,
      beforeIdentifiedVideos: baselineIdentified,
      beforeCoveragePercent: Number((baselineIdentified / Math.max(outputVideos.length, 1) * 100).toFixed(1)),
      identifiedVideos: identified,
      coveragePercent: Number((identified / Math.max(outputVideos.length, 1) * 100).toFixed(1)),
      coverageGain: identified - baselineIdentified,
      steamLinkedVideos: steamLinked,
      canonicalGames: canonicalGames.length,
      unidentifiedVideos: unresolved.length,
      ambiguousVideos: diagnostics.ambiguous.length + diagnostics.multiSteamVideos.length,
      duplicateMappingGroups: duplicateMappings.length,
      malformedGameNames: malformedGames.length,
      identificationSources: Object.fromEntries(Object.entries(bySource).sort((a, b) => b[1] - a[1]))
    },
    ambiguous: [
      ...diagnostics.multiSteamVideos.map(item => ({ ...item, reason: 'Multiple Steam App IDs appear in one video description.' })),
      ...diagnostics.ambiguous
    ].sort((a, b) => Number(b.views || 0) - Number(a.views || 0)),
    duplicateMappings,
    malformedGames,
    steamAppConflicts: diagnostics.steamAppConflicts,
    ambiguousAliases: diagnostics.aliasCollisions,
    unidentified: unresolved
      .map(video => ({
        id: video.id,
        title: video.title,
        publishedAt: video.publishedAt,
        views: Number(video.views || 0),
        tags: (video.tags || []).slice(0, 12),
        url: video.url
      }))
      .sort((a, b) => b.views - a.views || new Date(b.publishedAt) - new Date(a.publishedAt))
  };

  const gamesFile = { schemaVersion: 2, generatedAt, games: canonicalGames };
  const catalog = {
    identifiedVideos: identified,
    steamLinkedVideos: steamLinked,
    uniqueGames: canonicalGames.length,
    coveragePercent: audit.summary.coveragePercent,
    ambiguousVideos: audit.summary.ambiguousVideos,
    identificationSources: audit.summary.identificationSources
  };

  return {
    videos: outputVideos,
    gamesFile,
    audit,
    catalog,
    report: renderAuditMarkdown(audit)
  };
}

function renderAuditMarkdown(audit) {
  const summary = audit.summary;
  const lines = [
    '# Olexa Data Quality V2 audit',
    '',
    `Generated: ${audit.generatedAt}`,
    '',
    '## Coverage',
    '',
    `- Before (Steam/manual rules): **${summary.beforeIdentifiedVideos.toLocaleString()} / ${summary.totalVideos.toLocaleString()} (${summary.beforeCoveragePercent}%)**`,
    `- After Data Quality V2: **${summary.identifiedVideos.toLocaleString()} / ${summary.totalVideos.toLocaleString()} (${summary.coveragePercent}%)**`,
    `- Newly identified through metadata inheritance: **${summary.coverageGain.toLocaleString()}**`,
    `- Canonical games: **${summary.canonicalGames.toLocaleString()}**`,
    `- Unidentified: **${summary.unidentifiedVideos.toLocaleString()}**`,
    `- Ambiguous: **${summary.ambiguousVideos.toLocaleString()}**`,
    `- Possible duplicate mapping groups: **${summary.duplicateMappingGroups.toLocaleString()}**`,
    `- Malformed canonical names: **${summary.malformedGameNames.toLocaleString()}**`,
    '',
    '## Identification sources',
    ''
  ];
  for (const [source, count] of Object.entries(summary.identificationSources)) lines.push(`- ${source}: ${count.toLocaleString()}`);
  lines.push('', '## Highest-view unidentified videos', '');
  for (const video of audit.unidentified.slice(0, 50)) {
    lines.push(`- [${video.title}](${video.url}) — ${video.views.toLocaleString()} views (${String(video.publishedAt).slice(0, 10)})`);
  }
  if (!audit.unidentified.length) lines.push('- None');
  lines.push('', '## Ambiguous videos', '');
  for (const video of audit.ambiguous.slice(0, 50)) {
    const candidates = (video.candidates || []).map(candidate => `${candidate.name} (${candidate.score})`).join(', ');
    lines.push(`- ${video.title} (${video.id})${candidates ? ` — ${candidates}` : ` — ${video.reason}`}`);
  }
  if (!audit.ambiguous.length) lines.push('- None');
  lines.push('', '## Possible duplicate mappings', '');
  for (const group of audit.duplicateMappings.slice(0, 100)) {
    lines.push(`- ${group.games.map(game => `${game.name} [${game.slug}]`).join(' ↔ ')}`);
  }
  if (!audit.duplicateMappings.length) lines.push('- None');
  lines.push('', '> Full review queues, evidence, conflicts, and tags are available in `data/game-audit.json`.', '');
  return `${lines.join('\n')}\n`;
}

module.exports = {
  aliasesForName,
  buildCatalog,
  cleanGameName,
  extractDescriptionNames,
  extractSteamCandidates,
  extractTitleCandidates,
  isPlausibleGameName,
  isStrongExplicitGameName,
  normalizeText,
  renderAuditMarkdown,
  slugify,
  tagAliases
};
