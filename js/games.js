(() => {
  let games = [];
  const els = {};
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    Object.assign(els, { search: document.querySelector('#gameSearch'), sort: document.querySelector('#gameLibrarySort'), grid: document.querySelector('#gameLibraryGrid'), count: document.querySelector('#gameLibraryCount'), steamOnly: document.querySelector('#steamOnly') });
    const [videoData, gameData] = await Promise.all([OlexaArchive.loadJSON('data/videos.json'), OlexaArchive.loadJSON('data/games.json')]);
    const videos = Array.isArray(videoData) ? videoData : (videoData.videos || []);
    games = OlexaArchive.hydrateGames(videos, Array.isArray(gameData) ? gameData : (gameData.games || []));
    els.search.addEventListener('input', render); els.sort.addEventListener('change', render); els.steamOnly.addEventListener('change', render);
    render();
  }

  function render() {
    const q = els.search.value.trim().toLowerCase();
    let filtered = games.filter(g => !q || [g.name, ...(g.genres || [])].join(' ').toLowerCase().includes(q));
    if (els.steamOnly.checked) filtered = filtered.filter(g => OlexaArchive.steamUrl(g));
    if (els.sort.value === 'videos') filtered.sort((a, b) => b.videoCount - a.videoCount);
    else if (els.sort.value === 'views') filtered.sort((a, b) => b.totalViews - a.totalViews);
    else if (els.sort.value === 'oldest') filtered.sort((a, b) => new Date(a.firstPlayedAt) - new Date(b.firstPlayedAt));
    else if (els.sort.value === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name));
    else filtered.sort((a, b) => new Date(b.lastPlayedAt) - new Date(a.lastPlayedAt));

    els.count.textContent = `${filtered.length.toLocaleString()} games`;
    els.grid.innerHTML = filtered.map(g => {
      const thumb = g.latestVideo?.thumbnail || '';
      const steam = OlexaArchive.steamUrl(g);
      const year = g.firstPlayedAt ? new Date(g.firstPlayedAt).getFullYear() : '—';
      return `<article class="game-card">
        <a class="game-card-art" href="${OlexaArchive.gameUrl(g)}">${thumb ? `<img src="${thumb}" alt="" loading="lazy">` : '<span>O</span>'}<div class="game-card-shade"></div><div class="game-card-name"><small>${year} · ${g.videoCount} video${g.videoCount === 1 ? '' : 's'}</small><h2>${OlexaArchive.escapeHTML(g.name)}</h2></div></a>
        <div class="game-card-footer"><a href="${OlexaArchive.gameUrl(g)}">Olexa archive →</a>${steam ? `<a class="steam-button mini" href="${steam}" target="_blank" rel="noopener">Steam ↗</a>` : '<span class="muted">No Steam link</span>'}</div>
      </article>`;
    }).join('');
  }
})();
