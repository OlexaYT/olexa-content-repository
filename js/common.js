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

  function gameUrl(video) {
    return video.gameSlug ? `game.html?game=${encodeURIComponent(video.gameSlug)}` : `index.html?game=uncategorized#archive`;
  }

  function gameName(video) {
    return video.game || 'Uncategorized';
  }

  function renderVideoCard(video, template) {
    const node = template.content.firstElementChild.cloneNode(true);
    const thumbLink = node.querySelector('.thumbnail-link');
    const titleLink = node.querySelector('.title-link');
    const image = node.querySelector('.thumbnail');
    const fallback = node.querySelector('.thumbnail-fallback');
    const gameLink = node.querySelector('.game-link');
    const tags = node.querySelector('.tag-row');
    const url = youtubeUrl(video);

    thumbLink.href = url;
    titleLink.href = url;
    titleLink.textContent = video.title;
    image.alt = `${video.title} thumbnail`;
    if (video.thumbnail) {
      image.src = video.thumbnail;
      image.addEventListener('load', () => fallback.classList.add('hidden'));
      image.addEventListener('error', () => image.classList.add('hidden'));
    } else {
      image.classList.add('hidden');
    }

    node.querySelector('.duration-badge').textContent = formatDuration(video.durationSeconds);
    node.querySelector('.year-badge').textContent = new Date(video.publishedAt).getFullYear();
    node.querySelector('.views').textContent = `${compactNumber(video.views)} views`;
    gameLink.textContent = gameName(video);
    gameLink.href = gameUrl(video);

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
    if (mode === 'oldest') return copy.sort((a,b) => new Date(a.publishedAt) - new Date(b.publishedAt));
    if (mode === 'views') return copy.sort((a,b) => (b.views || 0) - (a.views || 0));
    if (mode === 'duration') return copy.sort((a,b) => (b.durationSeconds || 0) - (a.durationSeconds || 0));
    if (mode === 'random') return copy.sort(() => Math.random() - .5);
    return copy.sort((a,b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  }

  function randomItem(items) {
    if (!items.length) return null;
    return items[Math.floor(Math.random() * items.length)];
  }

  function watch(video) {
    if (video) window.open(youtubeUrl(video), '_blank', 'noopener');
  }

  return { loadJSON, compactNumber, formatDuration, youtubeUrl, gameUrl, gameName, renderVideoCard, sortVideos, randomItem, watch };
})();
