// ui.js — site UI helpers and safe fallbacks
//
// This is a consolidated, complete ui.js intended to replace the existing file.
// It contains menu handling, user profile popup, private chat modal helpers,
// the messages inbox builder, and safe fallbacks for missing elements/functions.
//
// Note: Some functions (openPrivateChat, loadPrivateMessages, etc.) are implemented in chat.js.
// This file calls them when available.

//
// Menu open/close (uses expandOverlay element in index.html)
//
function openMenu() {
  const sideMenu = document.getElementById('sideMenu');
  const overlay = document.getElementById('expandOverlay'); // site uses expandOverlay
  if (!sideMenu || !overlay) {
    console.warn('openMenu: sideMenu or expandOverlay element not found');
    return;
  }
  sideMenu.classList.add('open');
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeMenu() {
  const sideMenu = document.getElementById('sideMenu');
  const overlay = document.getElementById('expandOverlay');
  if (!sideMenu || !overlay) {
    console.warn('closeMenu: sideMenu or expandOverlay element not found');
    return;
  }
  sideMenu.classList.remove('open');
  overlay.classList.remove('active');
  document.body.style.overflow = 'auto';
}

//
// Forum / layout helpers
//
function expandForum() {
  const forumBox = document.getElementById('forum-box');
  const bobBox = document.getElementById('bob-box');
  if (!forumBox || !bobBox) return;
  bobBox.classList.remove('expanded');
  forumBox.classList.add('expanded');
 
}

function expandBob() {
  const forumBox = document.getElementById('forum-box');
  const bobBox = document.getElementById('bob-box');
  
  if (!forumBox || !bobBox) return;
  
  bobBox.classList.add('expanded');

  forumBox.classList.remove('expanded');
 window.toggleHeader = toggleHeader;
}

//
// User profile popup
//
function showUserProfile(uid) {
  if (!uid || uid === auth.currentUser?.uid) return;
  // stopPropagation if an event exists in scope
  if (typeof event !== 'undefined' && event && event.stopPropagation) event.stopPropagation();

  db.collection('users').doc(uid).get().then(doc => {
    const data = doc.exists ? doc.data() : {};
    const displayName = data.displayName || "Friend";
    const photoURL = data.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`;

    const avatarEl = document.getElementById('popupAvatar');
    const nameEl = document.getElementById('popupName');
    const typeEl = document.getElementById('popupType');
    const dateEl = document.getElementById('popupDate');
    const bioEl = document.getElementById('popupBio');

    if (avatarEl) avatarEl.src = photoURL;
    if (nameEl) nameEl.textContent = displayName;
    if (typeEl) typeEl.textContent = data.ostomyType || "—";
    if (dateEl) dateEl.textContent = data.surgeryDate || "—";
    if (bioEl) bioEl.textContent = data.bio || "No bio yet.";

    // Status dot inside popup
    const dot = document.getElementById('popupStatusDot');
    const lastActive = data.lastActive?.toMillis ? data.lastActive.toMillis() : (data.lastActive ? (data.lastActive.seconds ? data.lastActive.seconds * 1000 : data.lastActive) : 0);
    const minutesAgo = lastActive ? ((Date.now() - lastActive) / 60000) : Infinity;
    if (dot) {
      dot.className = 'status-dot ' +
        (minutesAgo < 5 ? 'status-online' :
          minutesAgo < 30 ? 'status-away' : 'status-offline');
    }

    // Send Message button
    const profileBox = document.querySelector('#userProfilePopup .profile-popup-box');
    if (profileBox) {
      const oldBtn = profileBox.querySelector('button.send-message-btn');
      if (oldBtn) oldBtn.remove();

      const btn = document.createElement('button');
      btn.textContent = "Send Message";
      btn.className = "send-message-btn";
      btn.style = "margin-top:20px;background:#8B572A;color:white;padding:14px 30px;border:none;border-radius:50px;font-weight:bold;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,0.3);width:100%;";
      btn.onclick = e => {
        e.stopPropagation();
        const popup = document.getElementById('userProfilePopup');
        if (popup) popup.classList.remove('open');
        // Prefer the global openPrivateChat (defined in chat.js)
        if (typeof openPrivateChat === 'function') {
          openPrivateChat(uid, displayName, photoURL);
        } else {
          // fallback: open messages inbox and rely on its UI
          openMessagesInbox();
        }
      };
      profileBox.appendChild(btn);
    }

    const userPopup = document.getElementById('userProfilePopup');
    if (userPopup) userPopup.classList.add('open');
  }).catch(err => {
    console.warn('showUserProfile failed', err);
  });
}

//
// Private chat modal helpers
//
function closePrivateChat() {
  const modal = document.getElementById('privateChatModal');
  if (modal) modal.classList.remove('open');
  currentChatPartnerId = null;
}

//
// Toggle notifications fallback — safe and idempotent
// Keeps legacy inline onclick working while notifications.js is preferred.
//
function toggleNotifications() {
  try {
    const dropdown = document.getElementById('notificationsDropdown');
    const badge = document.getElementById('notificationBadge');

    if (window._notif_markAsSeen && typeof window._notif_markAsSeen === 'function') {
      // Mark seen and show dropdown (notifications.js will coordinate)
      window._notif_markAsSeen(Date.now());
      if (dropdown) dropdown.style.display = 'block';
      return;
    }

    if (!dropdown) return;
    if (dropdown.style.display === 'block') {
      dropdown.style.display = 'none';
    } else {
      dropdown.style.display = 'block';
      localStorage.setItem('notificationLastSeen', String(Date.now()));
      if (badge) badge.style.display = 'none';
    }
  } catch (err) {
    console.warn('toggleNotifications error', err);
  }
}

//
// Robust inbox builder: openMessagesInbox()
// - Shows a modal/list of recent conversations by querying privateChats/*/messages (collectionGroup)
// - Deduplicates per chat and shows a clickable list that opens openPrivateChat(partnerId,...)
//
async function openMessagesInbox() {
  try {
    if (!auth || !auth.currentUser) {
      alert('Please sign in to view messages.');
      return;
    }
    const uid = auth.currentUser.uid;
    const chatModal = document.getElementById('privateChatModal');
    const privateMessagesEl = document.getElementById('privateMessages');

    if (!chatModal || !privateMessagesEl) {
      console.warn('openMessagesInbox: privateChatModal or privateMessages container not found');
      alert('Messages UI not available.');
      return;
    }

    // Show modal and loading placeholder
    privateMessagesEl.innerHTML = '<p style="text-align:center;color:#888;margin:30px 0;">Loading conversations…</p>';
    chatModal.classList.add('open');

    // Query recent message docs that include this user
    const snap = await db.collectionGroup('messages')
      .where('participants', 'array-contains', uid)
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();

    const chats = new Map(); // chatId -> { chatId, msg, createdAtMs, participants }

    snap.forEach(doc => {
      const msg = doc.data() || {};
      const chatRef = doc.ref.parent.parent;
      if (!chatRef) return;
      const chatId = chatRef.id;
      const createdAt = msg.createdAt;
      let createdAtMs = Date.now();
      if (createdAt && typeof createdAt.toMillis === 'function') createdAtMs = createdAt.toMillis();
      else if (createdAt && createdAt.seconds) createdAtMs = createdAt.seconds * 1000;
      else if (typeof createdAt === 'number') createdAtMs = createdAt;

      if (!chats.has(chatId)) {
        chats.set(chatId, { chatId, msg, createdAtMs, participants: Array.isArray(msg.participants) ? msg.participants : [] });
      }
    });

    if (chats.size === 0) {
      privateMessagesEl.innerHTML = '<p style="text-align:center;color:#888;margin:30px 0;">No conversations yet</p>';
      return;
    }

    const list = document.createElement('div');
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '8px';
    list.style.padding = '8px';

    // Sort chats by most recent
    const sorted = Array.from(chats.values()).sort((a, b) => b.createdAtMs - a.createdAtMs);

    for (const c of sorted) {
      const { chatId, createdAtMs, participants } = c;
      const others = participants.filter(p => p !== uid);
      const partnerId = others.length ? others[0] : null;

      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.justifyContent = 'space-between';
      item.style.padding = '10px';
      item.style.border = '1px solid #eee';
      item.style.borderRadius = '8px';
      item.style.cursor = 'pointer';
      item.dataset.chatId = chatId;
      item.dataset.partnerId = partnerId || '';

      const left = document.createElement('div');
      left.style.display = 'flex';
      left.style.alignItems = 'center';
      left.style.gap = '12px';

      const avatar = document.createElement('img');
      avatar.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${partnerId || chatId}`;
      avatar.style.width = '44px';
      avatar.style.height = '44px';
      avatar.style.borderRadius = '50%';
      avatar.style.objectFit = 'cover';

      const meta = document.createElement('div');
      meta.style.display = 'flex';
      meta.style.flexDirection = 'column';

      const nameEl = document.createElement('div');
      nameEl.textContent = partnerId ? partnerId : 'Conversation';
      nameEl.style.fontWeight = '600';

      const timeEl = document.createElement('div');
      timeEl.textContent = new Date(createdAtMs).toLocaleString();
      timeEl.style.fontSize = '12px';
      timeEl.style.color = '#666';

      meta.appendChild(nameEl);
      meta.appendChild(timeEl);
      left.appendChild(avatar);
      left.appendChild(meta);

      const openBtn = document.createElement('button');
      openBtn.textContent = 'Open';
      openBtn.style.background = '#8B572A';
      openBtn.style.color = 'white';
      openBtn.style.padding = '8px 12px';
      openBtn.style.border = 'none';
      openBtn.style.borderRadius = '20px';
      openBtn.style.cursor = 'pointer';

      function handleOpen() {
        if (!partnerId) {
          alert('Unable to open conversation: partner not found.');
          return;
        }
        // Fetch partner profile for display and then open chat
        db.collection('users').doc(partnerId).get().then(uDoc => {
          const u = uDoc.exists ? uDoc.data() : {};
          const displayName = u.displayName || partnerId;
          const photoURL = u.photoURL || null;
          if (typeof openPrivateChat === 'function') {
            openPrivateChat(partnerId, displayName, photoURL);
          } else {
            // fallback: manual setup & load messages if loader exists
            const chatNameEl = document.getElementById('chatName');
            const chatAvatarEl = document.getElementById('chatAvatar');
            if (chatNameEl) chatNameEl.textContent = displayName;
            if (chatAvatarEl) chatAvatarEl.src = photoURL || avatar.src;
            currentChatPartnerId = partnerId;
            const pmEl = document.getElementById('privateMessages');
            if (pmEl) pmEl.innerHTML = '<p style="text-align:center;color:#888;margin:30px 0;">Loading chat...</p>';
            if (typeof loadPrivateMessages === 'function') {
              loadPrivateMessages(partnerId);
            }
            const modal = document.getElementById('privateChatModal');
            if (modal) modal.classList.add('open');
          }
        }).catch(err => {
          console.warn('failed to load partner profile', err);
          if (typeof openPrivateChat === 'function') openPrivateChat(partnerId);
        });
      }

      item.addEventListener('click', handleOpen);
      openBtn.addEventListener('click', (ev) => { ev.stopPropagation(); handleOpen(); });

      item.appendChild(left);
      item.appendChild(openBtn);
      list.appendChild(item);
    }

    privateMessagesEl.innerHTML = '';
    privateMessagesEl.appendChild(list);

  } catch (err) {
    console.error('openMessagesInbox error', err);
    alert('Failed to load messages.');
  }
}

//
// Global click handlers (delegated) — keep them idempotent and avoid duplicates
//
if (!window.__ui_clickOutsideHandlerRegistered) {
  window.__ui_clickOutsideHandlerRegistered = true;
  document.addEventListener('click', function (e) {
    // collapse forum and bob boxes when clicking outside
    const forumBox = document.getElementById('forum-box');
    const bobBox = document.getElementById('bob-box');

    if (forumBox && forumBox.classList.contains('expanded') && !forumBox.contains(e.target)) {
      forumBox.classList.remove('expanded');
    }
    if (bobBox && bobBox.classList.contains('expanded') && !bobBox.contains(e.target)) {
      bobBox.classList.remove('expanded');
    }

    // close notifications dropdown when clicking outside (if present)
    const dropdown = document.getElementById('notificationsDropdown');
    const bell = document.getElementById('notificationBell');
    if (dropdown && bell && dropdown.style.display === 'block' && !dropdown.contains(e.target) && !bell.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });
}

//
// Safe fallback functions exported globally so inline onclick handlers keep working
//
window.openMenu = openMenu;
window.closeMenu = closeMenu;
window.showUserProfile = showUserProfile;
window.closePrivateChat = closePrivateChat;
window.toggleNotifications = toggleNotifications;
window.openMessagesInbox = openMessagesInbox;

// Open settings modal (safe fallback for inline onclick="openSettings()")
function openSettings() {
  const modal = document.getElementById('settingsModal');
  if (modal) {
    modal.classList.add('open');
    return;
  }

  // If the modal element isn't present, log a warning and try a fallback
  console.warn('openSettings: #settingsModal not found');
  // optional fallback: navigate to a settings page if you have one
  // window.location.href = '/settings.html';
}
// --- Add this near the other UI helpers in ui.js (e.g. next to openMenu/closeMenu) ---

function openProfile() {
  const modal = document.getElementById('profileModal');
  if (!modal) {
    console.warn('openProfile: #profileModal not found');
    return;
  }

  // If user is signed in, populate fields from Firestore (best-effort)
  try {
    const user = (typeof auth !== 'undefined' && auth) ? auth.currentUser : null;
    if (user && typeof db !== 'undefined' && db) {
      db.collection('users').doc(user.uid).get().then(doc => {
        const data = doc.exists ? doc.data() : {};
        const avatar = document.getElementById('editAvatarPreview');
        const name = document.getElementById('editName');
        const ostType = document.getElementById('editOstomyType');
        const surgeryDate = document.getElementById('editSurgeryDate');
        const bio = document.getElementById('editBio');

        if (avatar) avatar.src = data.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`;
        if (name) name.value = data.displayName || '';
        if (ostType) ostType.value = data.ostomyType || '';
        if (surgeryDate) surgeryDate.value = data.surgeryDate || '';
        if (bio) bio.value = data.bio || '';
      }).catch(err => {
        console.warn('openProfile: failed to load user profile', err);
      });
    } else {
      // If no auth/db available, still allow opening the modal
      console.debug('openProfile: auth or db not available; opening modal without prefilling');
    }
  } catch (e) {
    console.warn('openProfile error', e);
  }

  modal.classList.add('open');
}

// Expose globally so inline onclick="openProfile()" continues to work
window.openProfile = openProfile;
// expose globally for inline handlers
window.openSettings = openSettings;

// Export debug helper (optional)
window._ui_debug = {
  openMenu, closeMenu, expandForum, showUserProfile, openMessagesInbox, toggleNotifications
};
// Open profile modal (safe global fallback for inline onclick)
function openProfile() {
  const modal = document.getElementById('profileModal');
  if (!modal) {
    console.warn('openProfile: #profileModal not found');
    return;
  }

  try {
    const user = (typeof auth !== 'undefined' && auth) ? auth.currentUser : null;
    if (user && typeof db !== 'undefined' && db) {
      db.collection('users').doc(user.uid).get().then(doc => {
        const data = doc.exists ? doc.data() : {};
        const avatar = document.getElementById('editAvatarPreview');
        const name = document.getElementById('editName');
        const ostType = document.getElementById('editOstomyType');
        const surgeryDate = document.getElementById('editSurgeryDate');
        const bio = document.getElementById('editBio');

        if (avatar) avatar.src = data.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`;
        if (name) name.value = data.displayName || '';
        if (ostType) ostType.value = data.ostomyType || '';
        if (surgeryDate) surgeryDate.value = data.surgeryDate || '';
        if (bio) bio.value = data.bio || '';
      }).catch(err => {
        console.warn('openProfile: failed to load user profile', err);
      });
    }
  } catch (e) {
    console.warn('openProfile error', e);
  }

  modal.classList.add('open');
}

// keep it available for inline handlers
window.openProfile = openProfile;
document.getElementById('menuProfileButton')?.addEventListener('click', function (e) {
  e.stopPropagation();
  openProfile();
  if (typeof closeMenu === 'function') closeMenu();
});
function toggleFullScreen() {
  const btn = document.getElementById('fullscreenToggle');
  if (!btn) return;

  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().then(() => {
      btn.textContent = 'Exit Full Screen';
     
    //  document.body.style.zoom = '90%';
    //  document.body.style.zoom = '100%';
     //  document.body.style.zoom = '110%';
       autoFitPage();  // Recalculate fit after entering full screen
     
    }).catch(err => {
      console.error('Fullscreen error:', err);
    });
  } else {
    document.exitFullscreen().then(() => {
      btn.textContent = 'Full Screen';
      
      document.body.style.zoom = '100%';
     // autoFitPage();  // Recalculate fit after exiting full screen
    }).catch(err => {
      console.error('Exit fullscreen error:', err);
    });
  }
}

        // Toggle header visibility — grid is flex-based so content expands automatically
function toggleHeader(eOrBtn) {
  // Accept event, element, or nothing. Find the button if not provided.
  let btn = null;
  if (eOrBtn && eOrBtn.currentTarget) btn = eOrBtn.currentTarget;
  else if (eOrBtn && eOrBtn.nodeType === 1) btn = eOrBtn;
  else btn = document.getElementById('headerToggle') || document.querySelector('.header-toggle-btn');

  const hidden = document.body.classList.toggle('header-hidden');

  // Update button text/aria if available (store labels in data-* so we can localize)
  if (btn) {
    if (!btn.dataset.hideLabel) btn.dataset.hideLabel = btn.textContent || 'Hide Header';
    if (!btn.dataset.showLabel) btn.dataset.showLabel = 'Show Header';
    btn.textContent = hidden ? btn.dataset.showLabel : btn.dataset.hideLabel;
    btn.setAttribute('aria-pressed', String(hidden));
  }

  // Force reflow so layout updates immediately
  void document.body.offsetHeight;
}
// ...existing code...


// Initialize header toggle button on DOM ready (keeps behavior consistent with fullscreen button)
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('headerToggle') || document.querySelector('.header-toggle-btn');
  if (!btn) return;

  if (!btn.dataset.hideLabel) btn.dataset.hideLabel = btn.textContent || 'Hide Header';
  if (!btn.dataset.showLabel) btn.dataset.showLabel = 'Show Header';

  const isHidden = document.body.classList.contains('header-hidden');
  btn.textContent = isHidden ? btn.dataset.showLabel : btn.dataset.hideLabel;
  btn.setAttribute('aria-pressed', String(isHidden));

  // attach handler (mirrors fullscreen button behavior)
  btn.addEventListener('click', (ev) => {
    ev.preventDefault();
    toggleHeader(ev);
  });
});

window.toggleHeader = toggleHeader;


function toggleResources(arg) {
  // debugging helper
  try { console.debug('toggleResources called', arg); } catch (e) {}

  // resolve button (accept element, event, or nothing)
  let btn = null;
  if (arg && arg.nodeType === 1) btn = arg;
  else if (arg && arg.currentTarget) btn = arg.currentTarget;
  else btn = document.getElementById('resourcesToggleBtn') || document.querySelector('[data-resources-toggle]');

  // resolve main areas
  const grid = document.querySelector('.grid-container') || document.getElementById('mainGrid') || document.querySelector('.main-grid');
  const resources = document.getElementById('resourcesPage') || document.querySelector('[data-resources-page]');

  if (!grid) { console.warn('toggleResources: .grid-container not found'); }
  if (!resources) { console.warn('toggleResources: #resourcesPage not found'); }
  if (!grid || !resources) return;

  // Use a body class to track state (more reliable than inline style/read)
  const showing = document.body.classList.toggle('show-resources');

  // Apply visibility via class + inline fallback for older code
  if (showing) {
    document.body.classList.add('show-resources');
    resources.style.display = 'block';
    grid.style.display = 'none';
    if (btn) { btn.textContent = 'Home'; btn.setAttribute('aria-pressed', 'true'); }
  } else {
    document.body.classList.remove('show-resources');
    resources.style.display = 'none';
    grid.style.display = '';
    if (btn) { btn.textContent = 'Resources'; btn.setAttribute('aria-pressed', 'false'); }
  }

  // force layout update
  void document.body.offsetHeight;
  try { console.debug('toggleResources done', { showing, gridDisplay: grid.style.display, resourcesDisplay: resources.style.display }); } catch (e) {}
}
// ...existing code...

// ensure global and attach safe click handler if button exists

// ensure global and attach safe click handler if button exists

// Debug helper: ensure Resources button is wired (safe, idempotent)
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('resourcesToggleBtn');
    const resources = document.getElementById('resourcesPage');
    const grid = document.querySelector('.grid-container');
    console.debug('Debug: resourcesToggleBtn present?', !!btn, 'resources present?', !!resources, 'grid present?', !!grid);

    if (!btn) return;

    // attach a guaranteed handler that logs and calls the toggle
    const handler = (ev) => {
      ev && ev.preventDefault && ev.preventDefault();
      console.debug('Debug: resources button clicked (handler)');
      // call the existing function if available
      if (typeof window.toggleResources === 'function') {
        window.toggleResources(btn);
      } else {
        // fallback: toggle display directly
        if (resources && grid) {
          const showing = window.getComputedStyle(resources).display !== 'none';
          resources.style.display = showing ? 'none' : 'block';
          grid.style.display = showing ? '' : 'none';
          btn.textContent = showing ? 'Resources' : 'Home';
          console.debug('Debug: fallback toggle executed, showing:', !showing);
        } else {
          console.warn('Debug: fallback toggle failed - elements missing');
        }
      }
    };

    // remove previous to avoid double-binding, then attach
    btn.removeEventListener('click', btn._resourcesDbgHandler);
    btn._resourcesDbgHandler = handler;
    btn.addEventListener('click', handler);
});

// expose for inline onclick usage
window.toggleResources = toggleResources;
(function(){
  function updateCssVars(){
    const header = document.getElementById('siteHeader');
    const ticker = document.querySelector('.ticker-container');
    if(header) document.documentElement.style.setProperty('--header-height', (header.offsetHeight || 150) + 'px');
    if(ticker) document.documentElement.style.setProperty('--ticker-height', (ticker.offsetHeight || 56) + 'px');
  }

  function refreshExpandedState(){
    const anyExpanded = !!document.querySelector('.box.expanded');
    document.body.classList.toggle('expanded-active', anyExpanded);
    updateCssVars();
  }

  // run on load and keep in sync
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){
      refreshExpandedState();
      // observe DOM for class changes on boxes
      const mo = new MutationObserver(refreshExpandedState);
      mo.observe(document.body, { attributes: true, subtree: true, childList: true });
      // observe header/ticker size changes
      if (window.ResizeObserver) {
        const ro = new ResizeObserver(updateCssVars);
        const header = document.getElementById('siteHeader');
        const ticker = document.querySelector('.ticker-container');
        if (header) ro.observe(header);
        if (ticker) ro.observe(ticker);
      }
    });
  } else {
    refreshExpandedState();
    const mo = new MutationObserver(refreshExpandedState);
    mo.observe(document.body, { attributes: true, subtree: true, childList: true });
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(updateCssVars);
      const header = document.getElementById('siteHeader');
      const ticker = document.querySelector('.ticker-container');
      if (header) ro.observe(header);
      if (ticker) ro.observe(ticker);
    }
  }

  // also update on window resize / fonts ready
  window.addEventListener('resize', updateCssVars);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(updateCssVars).catch(()=>{});
})();
// ...existing code...
(function(){
  function updateCssVars(){
    const header = document.getElementById('siteHeader');
    const ticker = document.querySelector('.ticker-container');
    if (header) document.documentElement.style.setProperty('--header-height', (header.offsetHeight || 150) + 'px');
    if (ticker) document.documentElement.style.setProperty('--ticker-height', (ticker.offsetHeight || 56) + 'px');
  }

  function refreshExpandedState(){
    const anyExpanded = !!document.querySelector('.box.expanded');

    // toggle body class
    document.body.classList.toggle('expanded-active', anyExpanded);

    // ensure CSS vars reflect current header/ticker sizes
    updateCssVars();

    // If nothing is expanded, clean up any inline positioning that was applied
    if (!anyExpanded) {
      document.documentElement.style.removeProperty('--header-height');
      document.documentElement.style.removeProperty('--ticker-height');
      document.body.style.removeProperty('paddingTop');
      document.body.style.removeProperty('overflow');

      const header = document.getElementById('siteHeader');
      const ticker = document.querySelector('.ticker-container');
      const bell = document.getElementById('notificationBell');

      if (header) {
        header.style.removeProperty('position');
        header.style.removeProperty('top');
        header.style.removeProperty('left');
        header.style.removeProperty('right');
        header.style.removeProperty('z-index');
      }
      if (ticker) {
        ticker.style.removeProperty('position');
        ticker.style.removeProperty('top');
        ticker.style.removeProperty('left');
        ticker.style.removeProperty('right');
        ticker.style.removeProperty('z-index');
      }
      if (bell) {
        bell.style.removeProperty('position');
        bell.style.removeProperty('top');
        bell.style.removeProperty('right');
        bell.style.removeProperty('z-index');
      }
    } else {
      updateCssVars();
      document.body.style.overflow = 'hidden';
    }
  }

  function init(){
    updateCssVars();
    refreshExpandedState();

    if (window.ResizeObserver) {
      const ro = new ResizeObserver(updateCssVars);
      const header = document.getElementById('siteHeader');
      const ticker = document.querySelector('.ticker-container');
      if (header) ro.observe(header);
      if (ticker) ro.observe(ticker);
    }

    const mo = new MutationObserver(refreshExpandedState);
    mo.observe(document.body, { attributes: true, childList: true, subtree: true });

    window.addEventListener('resize', updateCssVars);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(updateCssVars).catch(()=>{});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

function toggleMaximize(boxId) {
  const box = document.getElementById(boxId);
  if (!box) return;

  if (box.classList.contains('maximized')) {
    box.classList.remove('maximized');
  } else {
    // Remove maximized from any other box
    document.querySelectorAll('.box.maximized').forEach(b => b.classList.remove('maximized'));
    box.classList.add('maximized');
  }
}

// Make it global for inline onclick
window.toggleMaximize = toggleMaximize;


// Inside loadFeaturedPosts() after fetching data:
featuredPosts = data.map(post => ({
  image: post.main_image_url || 'images/FPost.png',
  link: post.url || '#'
}));

// Show first image immediately
if (featuredPosts.length > 0) {
  currentIndex = 0;
  updateFeatured();
}

// Rotation function
function updateFeatured() {
  if (featuredPosts.length === 0) return;
  const img = document.getElementById('featuredImage');
  const link = document.getElementById('featuredLink');
  if (img && link) {
    img.src = featuredPosts[currentIndex].image;
    link.href = featuredPosts[currentIndex].link;
  }
}



// Auto rotation
setInterval(() => {
  console.log('Auto-rotating featured post');
  manualRotate(1);
}, 20000);

// Initial load
loadFeaturedPosts();
updateFeatured();  // Immediate first image
function changeFontSize(boxId, delta) {
  const box = document.getElementById(boxId);
  if (!box) return;

  let currentSize = parseFloat(getComputedStyle(box).fontSize) || 16;
  let newSize = currentSize + delta;  // +1 or -1 px
  newSize = Math.max(12, Math.min(24, newSize));  // Limit 12-24px

  box.style.fontSize = newSize + 'px';

  // Save to localStorage (per box)
  localStorage.setItem(`fontSize-${boxId}`, newSize);
}

// Load saved font size on page load
window.addEventListener('load', () => {
  ['bob-box', 'forum-box'].forEach(id => {
    const box = document.getElementById(id);
    const saved = localStorage.getItem(`fontSize-${id}`);
    if (box && saved) {
      box.style.fontSize = saved + 'px';
    }
  });
});
