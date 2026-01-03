// search.js — unified frontend for local /api/search and remote /api/poe-search + Supabase featured rotation

const API_BASE = window.__API_BASE || window.API_BASE || 'https://ostomy-bob-web.vercel.app';

const LOCAL_POSTS_URL = API_BASE + '/api/posts';
const LOCAL_SEARCH_URL = API_BASE + '/api/search';
const POE_SEARCH_URL = API_BASE + '/api/poe-search';
// Wait for supabase to load from CDN
let featuredPosts = [];
let currentIndex = 0;

(function () {
  // DOM: uses the existing search input (id="fb-search")
  const input = document.getElementById('fb-search');
  if (!input) {
    console.warn('search.js: fb-search input not found; aborting');
    return;
  }

  // Find the container to attach the popup to so we can absolutely position it
  const container = input.closest('.post-search-box') || input.parentNode;
  // Ensure container is positioned so absolute children are anchored to it
  if (container && getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }

  // Create result container if missing
  let resultsWrap = document.getElementById('localSearchResults');
  let resultsContent = null; // separate container for dynamic HTML (keeps closeBtn intact)
  if (!resultsWrap) {
    resultsWrap = document.createElement('div');
    resultsWrap.id = 'localSearchResults';

    resultsWrap.style.position = 'absolute';
    resultsWrap.style.left = '12px';
    resultsWrap.style.right = '12px';
    resultsWrap.style.maxWidth = 'calc(100% - 24px)';
    resultsWrap.style.padding = '12px';
    resultsWrap.style.background = 'rgba(255,255,255,0.98)';
    resultsWrap.style.borderRadius = '12px';
    resultsWrap.style.maxHeight = '420px';
    resultsWrap.style.overflowY = 'auto';
    resultsWrap.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)';
    resultsWrap.style.display = 'none';
    resultsWrap.style.zIndex = '1000';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.id = 'localSearchClose';
    closeBtn.innerHTML = '✕';
    closeBtn.title = 'Close';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '8px';
    closeBtn.style.right = '8px';
    closeBtn.style.width = '28px';
    closeBtn.style.height = '28px';
    closeBtn.style.border = 'none';
    closeBtn.style.borderRadius = '6px';
    closeBtn.style.background = 'rgba(0,0,0,0.06)';
    closeBtn.style.color = '#222';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.fontSize = '14px';
    closeBtn.style.lineHeight = '1';
    closeBtn.style.display = 'flex';
    closeBtn.style.alignItems = 'center';
    closeBtn.style.justifyContent = 'center';
    closeBtn.style.padding = '0';
    closeBtn.style.zIndex = '1010';

    closeBtn.addEventListener('click', () => {
      hideResults();
    });

    resultsContent = document.createElement('div');
    resultsContent.id = 'localSearchResultsContent';
    resultsContent.style.paddingTop = '6px';

    resultsWrap.appendChild(closeBtn);
    resultsWrap.appendChild(resultsContent);
    container.appendChild(resultsWrap);
  } else {
    resultsContent = document.getElementById('localSearchResultsContent');
    if (!resultsContent) {
      resultsContent = document.createElement('div');
      resultsContent.id = 'localSearchResultsContent';
      resultsWrap.appendChild(resultsContent);
    }
  }

  function positionResults() {
    try {
      const containerRect = container.getBoundingClientRect();
      const headerRect = input.parentNode.getBoundingClientRect();
      const topPx = Math.max(8, headerRect.bottom - containerRect.top + 6);
      resultsWrap.style.top = topPx + 'px';
      resultsWrap.style.left = '12px';
      resultsWrap.style.right = '12px';
      resultsWrap.style.maxWidth = 'calc(100% - 24px)';
    } catch (e) {
      // ignore
    }
  }

  function showResults() {
    positionResults();
    resultsWrap.style.display = 'block';
  }
  function hideResults() {
    resultsWrap.style.display = 'none';
  }

  window.addEventListener('resize', () => {
    if (resultsWrap.style.display !== 'none') positionResults();
  });
  window.addEventListener('scroll', () => {
    if (resultsWrap.style.display !== 'none') positionResults();
  }, true);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      hideResults();
    }
  });

  document.addEventListener('click', function (e) {
    if (!resultsWrap || resultsWrap.style.display === 'none') return;
    if (!resultsWrap.contains(e.target) && e.target !== input) {
      hideResults();
    }
  });

  function renderResults(items) {
    resultsContent.innerHTML = '';

    if (!items || items.length === 0) {
      resultsContent.innerHTML = '<p style="color:#666;text-align:center;margin:18px 0;">No posts found</p>';
      showResults();
      return;
    }
    items.forEach(it => {
      const el = document.createElement('div');
      el.style.padding = '10px';
      el.style.borderBottom = '1px solid rgba(0,0,0,0.06)';
      el.style.display = 'flex';
      el.style.flexDirection = 'column';
      el.style.gap = '6px';

      const title = document.createElement('div');
      title.style.fontWeight = '700';
      title.style.fontSize = '1rem';
      title.textContent = it.title || '(untitled)';

      const tags = document.createElement('div');
      tags.style.fontSize = '0.92rem';
      tags.style.color = '#444';
      tags.textContent = it.tags ? `Tags: ${it.tags}` : '';

      const link = document.createElement('a');
      link.href = it.link || '#';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = it.link ? 'Open on Instagram' : 'No link';
      link.style.color = '#1652f0';
      link.style.fontWeight = '600';
      link.style.marginTop = '6px';

      el.appendChild(title);
      if (tags.textContent) el.appendChild(tags);
      el.appendChild(link);
      resultsContent.appendChild(el);
    });
    showResults();
  }

  function setLoading(on) {
    resultsContent.innerHTML = on ? '<p style="text-align:center;color:#888;margin:20px 0;">Searching…</p>' : '';
    if (on) showResults();
  }

  let apiMode = null;
  async function probeApis() {
    try {
      const r = await fetch(LOCAL_POSTS_URL, { method: 'GET' });
      if (r.ok) {
        apiMode = 'local';
        return;
      }
    } catch (e) { /* ignore */ }

    try {
      const r2 = await fetch(POE_SEARCH_URL + '?q=healthcheck', { method: 'GET' });
      if (r2.ok) {
        apiMode = 'poe';
        return;
      }
    } catch (e) { /* ignore */ }

    apiMode = 'local';
  }

  async function performSearch(q) {
    if (!q || q.trim().length === 0) {
      renderResults([]);
      return;
    }
    setLoading(true);
    try {
      if (!apiMode) await probeApis();

      if (apiMode === 'local') {
        const url = LOCAL_SEARCH_URL + '?q=' + encodeURIComponent(q.trim());
        const r = await fetch(url);
        if (!r.ok) throw new Error('local search failed');
        const data = await r.json();
        setLoading(false);
        renderResults(data.items || []);
        return;
      }

      if (apiMode === 'poe') {
        const url = POE_SEARCH_URL + '?q=' + encodeURIComponent(q.trim());
        const r = await fetch(url);
        if (!r.ok) throw new Error('poe search failed');
        const data = await r.json();
        setLoading(false);
        renderResults(data.items || []);
        return;
      }

      const r = await fetch(LOCAL_SEARCH_URL + '?q=' + encodeURIComponent(q.trim()));
      const data = await r.json();
      setLoading(false);
      renderResults(data.items || []);
    } catch (err) {
      console.error('search error', err);
      setLoading(false);
      resultsContent.innerHTML = '<p style="text-align:center;color:#c66;margin:20px 0;">Search failed</p>';
      showResults();
    }
  }

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      performSearch(input.value);
    }
  });

  window.initFeaturedCarousel = async function (selector, intervalMs = 5000, renderFn) {
    const el = document.querySelector(selector);
    if (!el) return;
    try {
      if (!apiMode) await probeApis();
      let items = [];
      if (apiMode === 'local') {
        const resp = await fetch(LOCAL_POSTS_URL);
        if (resp.ok) {
          const data = await resp.json();
          items = data.items || [];
        }
      } else {
        console.warn('initFeaturedCarousel: local posts not available, carousel disabled');
        return;
      }

      if (!items.length) return;
      let idx = 0;
      function show(i) {
        const post = items[i];
        if (typeof renderFn === 'function') {
          renderFn(post, el);
        } else {
          el.innerHTML = '';
          const a = document.createElement('a');
          a.href = post.link;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.style.display = 'block';
          a.style.textDecoration = 'none';
          a.style.color = 'inherit';
          const title = document.createElement('div');
          title.style.fontWeight = '700';
          title.style.marginBottom = '8px';
          title.textContent = post.title || 'Instagram Post';
          a.appendChild(title);
          const desc = document.createElement('div');
          desc.style.fontSize = '0.95rem';
          desc.style.color = '#444';
          desc.textContent = post.tags || '';
          a.appendChild(desc);
          el.appendChild(a);
        }
      }
      show(idx);
      const timer = setInterval(() => {
        idx = (idx + 1) % items.length;
        show(idx);
      }, intervalMs);
      return () => clearInterval(timer);
    } catch (err) {
      console.error('initFeaturedCarousel error', err);
    }
  };

})();



// Global functions (outside initSupabase)
function rotateFeaturedImage() {
  if (featuredPosts.length === 0) return;
  const img = document.getElementById('featuredImage');
  const link = document.getElementById('featuredLink');
  if (img && link) {
    img.src = featuredPosts[currentIndex].image.replace(/^http:/, 'https:') || 'images/FPost.png';
    link.href = featuredPosts[currentIndex].link || '#';
  }
}

function manualRotate(direction) {
  console.log('Manual rotate:', direction);
  console.log('Before index:', currentIndex);
  console.log('Featured posts length:', featuredPosts.length);
  if (featuredPosts.length === 0) {
console.log('No featured posts yet, cannot rotate');
    // Retry after short delay if data not loaded yet
    setTimeout(() => manualRotate(direction), 200);
    return;
  }
  console.log('Current index before addition :', currentIndex);
  currentIndex = (currentIndex + direction + featuredPosts.length) % featuredPosts.length;
  console.log('Current index after addition :', currentIndex);
  rotateFeaturedImage();
}

// Wait for supabase to load from CDN
function initSupabase() {
  if (typeof supabase === 'undefined') {
    console.error('Supabase CDN not loaded yet');
    setTimeout(initSupabase, 100);
    return;
  }

  const { createClient } = supabase;
  const sbClient = createClient('https://pkakexlbwkqfxamervub.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrYWtleGxid2txZnhhbWVydnViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3MDgwOTIsImV4cCI6MjA4MDI4NDA5Mn0.jfCVyDqu9Xv6vN5gbPjBC5Gj8iCKwe_FWsUXxPJkww0');

  async function loadFeaturedPosts() {
    try {
      const { data, error } = await sbClient
        .from('search_results')
        .select('main_image_url, url');

      if (error) throw error;

      featuredPosts = data.map(post => ({
        image: post.main_image_url || 'images/FPost.png',
        link: post.url || '#'
      }));

      console.log('Loaded featured posts:', featuredPosts);

      if (featuredPosts.length > 0) {
        currentIndex = 0;
        rotateFeaturedImage();  // Immediate first image
      }
    } catch (err) {
      console.error('Supabase load error:', err);
      featuredPosts = [{ image: 'images/FPost.png', link: '#' }];
      currentIndex = 0;
      rotateFeaturedImage();
    }
  }

  // Attach arrow clicks (now functions are global)
  document.addEventListener('DOMContentLoaded', () => {
    //document.getElementById('featuredPrev')?.addEventListener('click', () => manualRotate(-1));
   // document.getElementById('featuredNext')?.addEventListener('click', () => manualRotate(1));
  });

  loadFeaturedPosts();
  console.log('Starting featured image rotation interval');
 setInterval(() => {
  manualRotate(1);  // Use manualRotate for consistent increment
}, 10000);
}



// Start on load
window.addEventListener('load', initSupabase);