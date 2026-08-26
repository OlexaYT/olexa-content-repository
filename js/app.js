(() => {
  const state = { videos: [], filtered: [], visible: 48, games: [], channel: {} };
  const els = {};

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    Object.assign(els, {
      grid: document.querySelector('#videoGrid'), template: document.querySelector('#videoCardTemplate'),
      search: document.querySelector('#searchInput'), game: document.querySelector('#gameFilter'),
      genre: document.querySelector('#genreFilter'), year: document.querySelector('#yearFilter'),
      sort: document.querySelector('#sortFilter'), clear: document.querySelector('#clearFilters'),
      resultCount: document.querySelector('#resultCount'), heroStats: document.querySelector('#heroStats'),
      topGames: document.querySelector('#topGamesPanel'), onThisDay: document.querySelector('#onThisDayPanel'),
      timeMachine: document.querySelector('#timeMachinePanel'), lastUpdated: document.querySelector('#lastUpdated'),
      quickFilters: document.querySelector('#quickFilters'), loadMore: document.querySelector('#loadMoreButton'),
      empty: document.querySelector('#emptyState'), emptyReset: document.querySelector('#emptyReset')
    });

    try {
      const [videoData, gameData] = await Promise.all([
        OlexaArchive.loadJSON('data/videos.json'), OlexaArchive.loadJSON('data/games.json')
      ]);
      state.videos = Array.isArray(videoData) ? videoData : (videoData.videos || []);
      state.channel = Array.isArray(videoData) ? {} : (videoData.channel || {});
      state.games = Array.isArray(gameData) ? gameData : (gameData.games || []);
      hydrateVideoMetadata();
      buildControls();
      renderDiscovery();
      bindEvents();
      readQuery();
      applyFilters();
    } catch (err) {
      console.error(err);
      els.grid.innerHTML = `<div class="empty-state"><p class="eyebrow">DATA ERROR</p><h3>The archive data could not be loaded.</h3><p class="muted">Run <code>npm run dev</code> instead of opening index.html directly.</p></div>`;
    }
  }

  function hydrateVideoMetadata() {
    const gameBySlug = new Map(state.games.map(g => [g.slug, g]));
    state.videos = state.videos.map(v => {
      const game = gameBySlug.get(v.gameSlug);
      return { ...v, game: v.game || game?.name || null, genres: v.genres?.length ? v.genres : (game?.genres || []) };
    });
  }

  function buildControls() {
    const gameCounts = countBy(state.videos, v => v.gameSlug || 'uncategorized');
    const gameNameMap = new Map(state.games.map(g => [g.slug, g.name]));
    [...gameCounts.entries()].sort((a,b) => b[1]-a[1]).forEach(([slug,count]) => {
      const option = new Option(`${gameNameMap.get(slug) || 'Uncategorized'} (${count})`, slug);
      els.game.add(option);
    });

    const genres = [...new Set(state.videos.flatMap(v => v.genres || []))].sort();
    genres.forEach(g => els.genre.add(new Option(g,g)));
    const years = [...new Set(state.videos.map(v => new Date(v.publishedAt).getFullYear()))].sort((a,b)=>b-a);
    years.forEach(y => els.year.add(new Option(y,y)));

    genres.slice(0, 10).forEach(genre => {
      const b = document.createElement('button'); b.type='button'; b.className='quick-chip'; b.textContent=genre; b.dataset.genre=genre;
      els.quickFilters.appendChild(b);
    });
  }

  function renderDiscovery() {
    const totalViews = state.videos.reduce((n,v)=>n+(Number(v.views)||0),0);
    const assignedGames = new Set(state.videos.filter(v=>v.gameSlug).map(v=>v.gameSlug)).size;
    const years = state.videos.map(v=>new Date(v.publishedAt).getFullYear()).filter(Boolean);
    const firstYear = years.length ? Math.min(...years) : '—';
    const totalHours = Math.round(state.videos.reduce((n,v)=>n+(Number(v.durationSeconds)||0),0)/3600);
    const stats = [
      [OlexaArchive.compactNumber(state.videos.length), 'Videos archived'],
      [OlexaArchive.compactNumber(assignedGames), 'Games identified'],
      [OlexaArchive.compactNumber(totalViews), 'Combined views'],
      [OlexaArchive.compactNumber(totalHours), 'Hours of Olexa']
    ];
    els.heroStats.innerHTML = stats.map(([v,l])=>`<div class="stat-card"><strong>${v}</strong><span>${l}</span></div>`).join('');
    if (state.channel.syncedAt) els.lastUpdated.textContent = `Archive synced ${new Date(state.channel.syncedAt).toLocaleString()}`;

    const gameCounts = [...countBy(state.videos.filter(v=>v.gameSlug), v=>v.gameSlug).entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);
    const gameMap = new Map(state.games.map(g=>[g.slug,g]));
    els.topGames.innerHTML = `<div><p class="eyebrow">MOST PLAYED</p><h3>Games that became a problem</h3></div><div class="mini-list">${gameCounts.map(([slug,count])=>`<a class="mini-game" href="game.html?game=${encodeURIComponent(slug)}"><span>${escapeHTML(gameMap.get(slug)?.name || slug)}</span><small>${count} videos</small></a>`).join('') || '<p>Add game metadata to start ranking the obsession.</p>'}</div>`;

    const today = new Date();
    const sameDay = state.videos.filter(v=>{ const d=new Date(v.publishedAt); return d.getMonth()===today.getMonth() && d.getDate()===today.getDate() && d.getFullYear()!==today.getFullYear(); }).sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt));
    const memory = sameDay[0] || OlexaArchive.randomItem(state.videos);
    els.onThisDay.innerHTML = memory ? `<div><p class="eyebrow">${sameDay.length?'ON THIS DAY':'ARCHIVE PICK'}</p><h3>${escapeHTML(memory.title)}</h3><p>${new Date(memory.publishedAt).toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'})} · ${OlexaArchive.compactNumber(memory.views)} views</p></div><div class="panel-footer"><a class="text-link" href="${OlexaArchive.youtubeUrl(memory)}" target="_blank" rel="noopener">Watch it again ↗</a><span class="big-year" style="font-size:34px">${new Date(memory.publishedAt).getFullYear()}</span></div>` : '<p>No videos yet.</p>';

    const randomYear = years.length ? years[Math.floor(Math.random()*years.length)] : firstYear;
    const yearCount = state.videos.filter(v=>new Date(v.publishedAt).getFullYear()===randomYear).length;
    els.timeMachine.innerHTML = `<div><p class="eyebrow">TIME MACHINE</p><h3>Go somewhere irresponsible.</h3><p>Jump into a random year from the archive.</p></div><div class="panel-footer"><button class="clear-button" style="color:#17130f;border-color:rgba(0,0,0,.25)" id="jumpYear">Browse ${randomYear}</button><div class="big-year">${randomYear}</div></div><small>${yearCount} videos waiting</small>`;
    document.querySelector('#jumpYear')?.addEventListener('click',()=>{ els.year.value=String(randomYear); applyFilters(); document.querySelector('#archive').scrollIntoView(); });
  }

  function bindEvents() {
    [els.search, els.game, els.genre, els.year, els.sort].forEach(el=>el.addEventListener(el===els.search?'input':'change',()=>{ state.visible=48; applyFilters(); }));
    els.clear.addEventListener('click', resetFilters); els.emptyReset.addEventListener('click', resetFilters);
    els.quickFilters.addEventListener('click', e=>{ const b=e.target.closest('[data-genre]'); if(!b)return; els.genre.value = els.genre.value===b.dataset.genre ? '' : b.dataset.genre; state.visible=48; applyFilters(); });
    els.loadMore.addEventListener('click',()=>{ state.visible+=48; renderGrid(); });
    document.querySelector('#heroRandomButton').addEventListener('click',()=>OlexaArchive.watch(OlexaArchive.randomItem(state.filtered.length?state.filtered:state.videos)));
    document.querySelector('#randomNavButton').addEventListener('click',()=>OlexaArchive.watch(OlexaArchive.randomItem(state.videos)));
    document.addEventListener('keydown', e=>{ if(e.key==='/' && document.activeElement.tagName!=='INPUT'){ e.preventDefault(); els.search.focus(); }});
  }

  function readQuery() {
    const p = new URLSearchParams(location.search);
    if (p.get('game')) els.game.value = p.get('game');
  }

  function resetFilters() {
    els.search.value=''; els.game.value=''; els.genre.value=''; els.year.value=''; els.sort.value='newest'; state.visible=48; applyFilters();
  }

  function applyFilters() {
    const q = els.search.value.trim().toLowerCase();
    const game = els.game.value, genre = els.genre.value, year = els.year.value;
    state.filtered = state.videos.filter(v => {
      const haystack = [v.title, v.game, ...(v.genres||[]), ...(v.tags||[]), v.series].filter(Boolean).join(' ').toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (game && (v.gameSlug || 'uncategorized') !== game) return false;
      if (genre && !(v.genres||[]).includes(genre)) return false;
      if (year && String(new Date(v.publishedAt).getFullYear()) !== year) return false;
      return true;
    });
    state.filtered = OlexaArchive.sortVideos(state.filtered, els.sort.value);
    [...els.quickFilters.querySelectorAll('.quick-chip')].forEach(b=>b.classList.toggle('active', b.dataset.genre===genre));
    renderGrid();
  }

  function renderGrid() {
    els.grid.replaceChildren();
    const subset = state.filtered.slice(0,state.visible);
    const frag = document.createDocumentFragment();
    subset.forEach(v=>frag.appendChild(OlexaArchive.renderVideoCard(v,els.template)));
    els.grid.appendChild(frag);
    els.resultCount.textContent = `${state.filtered.length.toLocaleString()} of ${state.videos.length.toLocaleString()} videos`;
    els.empty.classList.toggle('hidden', state.filtered.length>0);
    els.loadMore.classList.toggle('hidden', state.visible>=state.filtered.length);
  }

  function countBy(items, fn) { const m=new Map(); items.forEach(x=>{const k=fn(x);m.set(k,(m.get(k)||0)+1)}); return m; }
  function escapeHTML(s='') { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
})();
