const OlexaArchive = (() => {
  const fmt = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

  async function loadJSON(path) {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not load ${path}: ${response.status}`);
    return response.json();
  }

  function compactNumber(value = 0) {
    return fmt.format(Number(value) || 0).replace('.0', '');
  }

  function formatDuration(seconds = 0) {
    seconds = Number(seconds) || 0;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  }

  function youtubeUrl(video) {
    return video.url || `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`;
  }

  function gameUrl(videoOrGame) {
    const slug = videoOrGame?.gameSlug || videoOrGame?.slug;
    return slug ? `game.html?game=${encodeURIComponent(slug)}` : `index.html?game=uncategorized#archive`;
  }

  function gameName(video) {
    return video.game || 'Uncategorized';
  }

  function steamUrl(item) {
    return item?.steamUrl || (item?.steamAppId ? `https://store.steampowered.com/app/${item.steamAppId}/` : null);
  }

  function deriveGames(videos = [], curatedGames = []) {
    const bySlug = new Map();
    for (const curated of curatedGames) {
      bySlug.set(curated.slug, { ...curated, videos: [], videoCount: 0, totalViews: 0 });
    }

    for (const video of videos) {
      if (!video.gameSlug) continue;
      let game = bySlug.get(video.gameSlug);
      if (!game) {
        game = {
          slug: video.gameSlug,
          name: video.game || `Steam App ${video.steamAppId || ''}`.trim(),
          genres: video.genres || [],
          steamAppId: video.steamAppId || null,
          steamUrl: steamUrl(video),
          source: video.gameSource || 'youtube',
          videos: [],
          videoCount: 0,
          totalViews: 0
        };
        bySlug.set(video.gameSlug, game);
      }
      if (!game.steamAppId && video.steamAppId) game.steamAppId = video.steamAppId;
      if (!game.steamUrl && steamUrl(video)) game.steamUrl = steamUrl(video);
      if ((!game.genres || !game.genres.length) && video.genres?.length) game.genres = video.genres;
      if ((!game.name || /^Steam App /.test(game.name)) && video.game) game.name = video.game;
      game.videos.push(video);
      game.videoCount += 1;
      game.totalViews += Number(video.views) || 0;
    }

    for (const game of bySlug.values()) {
      const dates = game.videos.map(v => new Date(v.publishedAt)).filter(d => !Number.isNaN(d.valueOf())).sort((a, b) => a - b);
      game.firstPlayedAt = dates[0]?.toISOString() || null;
      game.lastPlayedAt = dates.at(-1)?.toISOString() || null;
      game.latestVideo = game.videos.slice().sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))[0] || null;
    }
    return [...bySlug.values()].filter(g => g.videoCount > 0);
  }

  function renderVideoCard(video, template) {
    const node = template.content.firstElementChild.cloneNode(true);
    const thumbLink = node.querySelector('.thumbnail-link');
    const titleLink = node.querySelector('.title-link');
    const image = node.querySelector('.thumbnail');
    const fallback = node.querySelector('.thumbnail-fallback');
    const gameLink = node.querySelector('.game-link');
    const tags = node.querySelector('.tag-row');
    const steam = node.querySelector('.steam-mini');
    const url = youtubeUrl(video);

    thumbLink.href = url;
    titleLink.href = url;
    titleLink.textContent = video.title;
    image.alt = `${video.title} thumbnail`;
    if (video.thumbnail) {
      image.src = video.thumbnail;
      image.addEventListener('load', () => fallback.classList.add('hidden'));
      image.addEventListener('error', () => image.classList.add('hidden'));
    } else image.classList.add('hidden');

    node.querySelector('.duration-badge').textContent = formatDuration(video.durationSeconds);
    node.querySelector('.year-badge').textContent = new Date(video.publishedAt).getFullYear();
    node.querySelector('.views').textContent = `${compactNumber(video.views)} views`;
    gameLink.textContent = gameName(video);
    gameLink.href = gameUrl(video);

    if (steam) {
      const link = steamUrl(video);
      steam.classList.toggle('hidden', !link);
      if (link) steam.href = link;
    }

    (video.genres || []).slice(0, 3).forEach(genre => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = genre;
      tags.appendChild(span);
    });
    return node;
  }

  function sortVideos(videos, mode) {
    const copy = [...videos];
    if (mode === 'oldest') return copy.sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt));
    if (mode === 'views') return copy.sort((a, b) => (b.views || 0) - (a.views || 0));
    if (mode === 'duration') return copy.sort((a, b) => (b.durationSeconds || 0) - (a.durationSeconds || 0));
    if (mode === 'random') return copy.sort(() => Math.random() - .5);
    return copy.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  }

  function randomItem(items) {
    if (!items.length) return null;
    return items[Math.floor(Math.random() * items.length)];
  }

  function watch(video) {
    if (video) window.open(youtubeUrl(video), '_blank', 'noopener');
  }

  function escapeHTML(value = '') {
    const d = document.createElement('div'); d.textContent = value; return d.innerHTML;
  }

  return { loadJSON, compactNumber, formatDuration, youtubeUrl, gameUrl, gameName, steamUrl, deriveGames, renderVideoCard, sortVideos, randomItem, watch, escapeHTML };
})();
