document.addEventListener('DOMContentLoaded', async () => {
  const grid=document.querySelector('#artGrid');
  try {
    const data=await fetch('data/community.json',{cache:'no-store'}).then(r=>r.json());
    const items=data.items||data;
    grid.innerHTML=items.length?items.map(item=>`<article class="art-card"><div class="art-image">${item.image?`<img src="${item.image}" alt="${esc(item.title)}" loading="lazy">`:'ARTIFACT IMAGE'}</div><div class="art-body"><p class="eyebrow">${esc(item.type||'COMMUNITY ART')}</p><h3>${esc(item.title)}</h3><p>by ${esc(item.artist||'Unknown')} ${item.game?`· ${esc(item.game)}`:''}</p></div></article>`).join(''):`<article class="art-card"><div class="art-image">YOUR ART HERE</div><div class="art-body"><p class="eyebrow">EMPTY DISPLAY CASE</p><h3>The museum is ready.</h3><p>Add approved submissions to data/community.json.</p></div></article>`;
  } catch { grid.innerHTML='<p class="muted">Community data could not be loaded.</p>'; }
  function esc(s=''){const d=document.createElement('div');d.textContent=s;return d.innerHTML;}
});
