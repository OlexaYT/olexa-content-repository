(() => {
  document.addEventListener('DOMContentLoaded', init);
  async function init() {
    const slug = new URLSearchParams(location.search).get('game');
    const hero = document.querySelector('#gameHero');
    const grid = document.querySelector('#gameVideoGrid');
    const template = document.querySelector('#videoCardTemplate');
    const sort = document.querySelector('#gameSort');
    try {
      const [videoData, gameData] = await Promise.all([OlexaArchive.loadJSON('data/videos.json'), OlexaArchive.loadJSON('data/games.json')]);
      const videos = (Array.isArray(videoData)?videoData:videoData.videos||[]).filter(v=>v.gameSlug===slug);
      const games = Array.isArray(gameData)?gameData:gameData.games||[];
      const game = games.find(g=>g.slug===slug) || { name: videos[0]?.game || 'Unknown Game', slug, genres: videos[0]?.genres || [] };
      document.title = `${game.name} — Olexa Archive`;
      const totalViews = videos.reduce((n,v)=>n+(Number(v.views)||0),0);
      const hours = Math.round(videos.reduce((n,v)=>n+(Number(v.durationSeconds)||0),0)/3600);
      const dates = videos.map(v=>new Date(v.publishedAt)).sort((a,b)=>a-b);
      hero.innerHTML = `<div><p class="eyebrow">GAME ARCHIVE</p><h1>${escapeHTML(game.name)}</h1><div class="tag-row">${(game.genres||[]).map(g=>`<span class="tag">${escapeHTML(g)}</span>`).join('')}</div><p>${escapeHTML(game.description || `Every Olexa video currently catalogued for ${game.name}.`)}</p>${game.steam?`<a class="text-link" href="${game.steam}" target="_blank" rel="noopener">Steam page ↗</a>`:''}</div><div class="game-stat-stack"><div class="game-stat"><b>${videos.length}</b><span>Videos</span></div><div class="game-stat"><b>${OlexaArchive.compactNumber(totalViews)}</b><span>Views</span></div><div class="game-stat"><b>${hours}</b><span>Hours</span></div><div class="game-stat"><b>${dates.length?dates[0].getFullYear():'—'}</b><span>First played</span></div></div>`;
      document.querySelector('#gameVideoHeading').textContent = `${videos.length} video${videos.length===1?'':'s'}`;
      const render = () => { grid.replaceChildren(); const frag=document.createDocumentFragment(); OlexaArchive.sortVideos(videos,sort.value).forEach(v=>frag.appendChild(OlexaArchive.renderVideoCard({...v, game:v.game||game.name, genres:v.genres?.length?v.genres:game.genres},template))); grid.appendChild(frag); };
      sort.addEventListener('change', render); render();
    } catch(e) { hero.innerHTML = `<div><p class="eyebrow">ERROR</p><h1>Game not found.</h1><p>${escapeHTML(e.message)}</p></div>`; }
  }
  function escapeHTML(s='') { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
})();
