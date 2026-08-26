(() => {
  document.addEventListener('DOMContentLoaded', init);
  async function init() {
    const slug = new URLSearchParams(location.search).get('game');
    const hero = document.querySelector('#gameHero'), grid = document.querySelector('#gameVideoGrid'), template = document.querySelector('#videoCardTemplate'), sort = document.querySelector('#gameSort');
    try {
      const [videoData, gameData] = await Promise.all([OlexaArchive.loadJSON('data/videos.json'), OlexaArchive.loadJSON('data/games.json')]);
      const allVideos = Array.isArray(videoData) ? videoData : (videoData.videos || []);
      const curated = Array.isArray(gameData) ? gameData : (gameData.games || []);
      const allGames = OlexaArchive.hydrateGames(allVideos, curated);
      const game = allGames.find(g => g.slug === slug);
      if (!game) throw new Error('No videos are currently catalogued for this game.');
      const videos = game.videos;
      document.title = `${game.name} — Olexa Game Vault`;
      const hours = Math.round(videos.reduce((n, v) => n + (Number(v.durationSeconds) || 0), 0) / 3600);
      const firstYear = game.firstPlayedAt ? new Date(game.firstPlayedAt).getFullYear() : '—';
      const steam = OlexaArchive.steamUrl(game);
      const heroThumb = game.latestVideo?.thumbnail || '';

      hero.innerHTML = `<div class="game-hero-bg"${heroThumb ? ` style="background-image:url('${heroThumb}')"` : ''}></div><div class="game-hero-shade"></div><div class="game-hero-copy"><p class="eyebrow light">GAME ARCHIVE</p><h1>${OlexaArchive.escapeHTML(game.name)}</h1><div class="tag-row">${(game.genres || []).map(g => `<span class="tag light-tag">${OlexaArchive.escapeHTML(g)}</span>`).join('')}</div><p>${OlexaArchive.escapeHTML(game.description || `Every Olexa video currently catalogued for ${game.name}.`)}</p><div class="game-actions">${steam ? `<a class="steam-button" href="${steam}" target="_blank" rel="noopener">View on Steam ↗</a>` : ''}<a class="hero-outline-button" href="#videos">Watch the archive ↓</a></div></div><div class="game-stat-stack"><div class="game-stat"><b>${videos.length}</b><span>Videos</span></div><div class="game-stat"><b>${OlexaArchive.compactNumber(game.totalViews)}</b><span>Views</span></div><div class="game-stat"><b>${hours}</b><span>Hours</span></div><div class="game-stat"><b>${firstYear}</b><span>First played</span></div></div>`;
      document.querySelector('#gameVideoHeading').textContent = `${videos.length} video${videos.length === 1 ? '' : 's'}`;
      const render = () => { grid.replaceChildren(); const frag = document.createDocumentFragment(); OlexaArchive.sortVideos(videos, sort.value).forEach(v => frag.appendChild(OlexaArchive.renderVideoCard({ ...v, game: v.game || game.name, genres: v.genres?.length ? v.genres : game.genres, steamUrl: v.steamUrl || steam }, template))); grid.appendChild(frag); };
      sort.addEventListener('change', render); render();
    } catch (e) { hero.innerHTML = `<div class="game-hero-copy"><p class="eyebrow light">ERROR</p><h1>Game not found.</h1><p>${OlexaArchive.escapeHTML(e.message)}</p></div>`; }
  }
})();
