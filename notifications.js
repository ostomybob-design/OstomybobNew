/* notifications.js — per-notification read handling, no global clear on bell click
   - Exposes _notif_addNotification(item) to add a notification
   - Persists per-message reads via localStorage.notificationReadIds (array of ids)
   - Clicking the bell toggles dropdown only (does NOT mark all seen)
   - Clicking a notification opens chat and marks that message read (removes it)
   - _notif_markAsSeen(ts) still exists to mark everything seen if desired
*/
  const bell = document.getElementById('notificationBell');
  const badge = document.getElementById('notificationBadge');
  const dropdown = document.getElementById('notificationsDropdown');
  const list = document.getElementById('notificationList');
(function () {
  // DOM refs


  // State
  let unsub = null;
  let currentUid = null;
  let unreadCount = 0;
  let lastSeenTimestamp = parseInt(localStorage.getItem('notificationLastSeen') || '0', 10) || 0;

  // Persist per-message read ids (so clicking one notification doesn't clear everything)
  const readIds = new Set(JSON.parse(localStorage.getItem('notificationReadIds') || '[]'));

  const seenIds = new Set(); // dedupe to avoid double-adding from initial query + realtime
  function persistReadIds() {
    try {
      localStorage.setItem('notificationReadIds', JSON.stringify(Array.from(readIds)));
    } catch (e) { /* ignore */ }
  }

  // Helpers
  function log(...args) { console.debug('[notif]', ...args); }
  function warn(...args) { console.warn('[notif]', ...args); }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function updateBadge(count = unreadCount) {
    if (!badge) return;
    if (count && count > 0) {
      badge.style.display = 'flex';
      badge.style.alignItems = 'center';
      badge.style.justifyContent = 'center';
      badge.textContent = count > 99 ? '99+' : String(count);
    } else {
      badge.style.display = 'none';
      badge.textContent = '';
    }
  }

  function clearList() {
    if (!list) return;
    list.innerHTML = '';
  }

  function normalizeTimestamp(createdAt) {
    if (!createdAt) return Date.now();
    if (typeof createdAt === 'number') return createdAt;
    if (createdAt.toMillis && typeof createdAt.toMillis === 'function') return createdAt.toMillis();
    if (createdAt.seconds) return createdAt.seconds * 1000;
    return Date.now();
  }

  // Remove a single notification UI and mark it read locally
  function markNotificationRead(id) {
    if (!id) return;
    // Add to readIds so it won't reappear after refresh
    readIds.add(id);
    persistReadIds();

    // Remove element from DOM
    try {
      const elNode = list?.querySelector(`[data-id="${id}"]`);
      if (elNode) elNode.remove();
    } catch (e) {}

    // Decrement counter
    if (unreadCount > 0) unreadCount = Math.max(0, unreadCount - 1);
    updateBadge();
  }

  // Build visible item — clicking it opens chat and marks only that item read
  function buildItem({ id, fromId, fromName, photo, preview, createdAtMs }) {
    const wrapper = el('div', 'notif-item');
    wrapper.style.padding = '10px 14px';
    wrapper.style.borderBottom = '1px solid rgba(0,0,0,0.06)';
    wrapper.style.cursor = 'pointer';
    wrapper.style.display = 'flex';
    wrapper.style.gap = '12px';
    wrapper.style.alignItems = 'center';
    wrapper.dataset.id = id;

    const avatar = el('img');
    avatar.src = photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${fromId || 'anon'}`;
    avatar.style.width = '44px';
    avatar.style.height = '44px';
    avatar.style.borderRadius = '50%';
    avatar.style.flex = '0 0 44px';
    avatar.style.objectFit = 'cover';

    const body = el('div', null);
    body.style.flex = '1';

    const top = el('div', null);
    top.style.display = 'flex';
    top.style.justifyContent = 'space-between';
    top.style.alignItems = 'center';

    const nameEl = el('div', null, fromName || 'Someone');
    nameEl.style.fontWeight = '600';
    nameEl.style.fontSize = '14px';

    const timeEl = el('div', null, new Date(createdAtMs || Date.now()).toLocaleString());
    timeEl.style.fontSize = '12px';
    timeEl.style.color = '#666';

    top.appendChild(nameEl);
    top.appendChild(timeEl);

    const previewEl = el('div', null, preview || '');
    previewEl.style.fontSize = '13px';
    previewEl.style.color = '#444';
    previewEl.style.marginTop = '6px';

    body.appendChild(top);
    body.appendChild(previewEl);

    const actionBtn = el('button', null, 'Open');
    actionBtn.style.background = '#8B572A';
    actionBtn.style.color = 'white';
    actionBtn.style.padding = '8px 14px';
    actionBtn.style.border = 'none';
    actionBtn.style.borderRadius = '20px';
    actionBtn.style.fontWeight = '600';
    actionBtn.style.cursor = 'pointer';

    function onOpen(e) {
      // Mark this notification read locally (does NOT change global lastSeen)
      markNotificationRead(id);

      // Open chat
      try {
        if (typeof window.openPrivateChat === 'function') {
          window.openPrivateChat(fromId, fromName, photo);
        }
      } catch (err) {
        console.warn('openPrivateChat failed', err);
      }
    }

    wrapper.addEventListener('click', onOpen);
    actionBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      onOpen();
    });

    wrapper.appendChild(avatar);
    wrapper.appendChild(body);
    wrapper.appendChild(actionBtn);

    return wrapper;
  }

  function showNoNew() {
    if (!list) return;
    list.innerHTML = '<p style="text-align:center;color:#888;margin:30px 0;">No new messages</p>';
  }

  // Add a notification from other modules (chat.js will call this)
  // item: { id, fromId, fromName, photo, preview, createdAtMs }
  window._notif_addNotification = function (item) {
    try {
      if (!currentUid) {
        // auth not ready — ignore for now
        return;
      }
      if (!item || !item.id) return;

      // If we've already read this item, skip it
      if (readIds.has(item.id)) return;

      // If duplicate (seen in initial query + realtime), skip
      if (seenIds.has(item.id)) return;
      seenIds.add(item.id);

      const createdAtMs = item.createdAtMs || Date.now();

      // Skip if message is older/equal than lastSeenTimestamp (back-compat)
      if (createdAtMs <= lastSeenTimestamp) return;

      // Prepare UI
      if (list && list.querySelector('p') && list.querySelector('p').textContent.includes('No new messages')) {
        list.innerHTML = '';
      }
      const ui = buildItem({
        id: item.id,
        fromId: item.fromId,
        fromName: item.fromName,
        photo: item.photo,
        preview: item.preview,
        createdAtMs: createdAtMs
      });

      if (list) list.prepend(ui);
      unreadCount++;
      updateBadge();
    } catch (e) {
      console.warn('[notif] _notif_addNotification failed', e);
    }
  };

  // Global: mark everything seen (keeps old behavior for "clear all")
  window._notif_markAsSeen = function (ts) {
    // Update the global lastSeen timestamp so old messages won't reappear
    lastSeenTimestamp = ts || Date.now();
    localStorage.setItem('notificationLastSeen', String(lastSeenTimestamp));

    // Clear UI and reset unread count
    unreadCount = 0;
    updateBadge();
    // persist that all existing items are read by recording visible ids
    try {
      const ids = Array.from(list?.querySelectorAll('[data-id]') || []).map(n => n.dataset.id).filter(Boolean);
      ids.forEach(id => readIds.add(id));
      persistReadIds();
    } catch (e) {}
    clearList();
    showNoNew();
  };

  // Initial reconciliation: load messages newer than lastSeenTimestamp once, then start realtime
  function reconcileThenListen() {
    if (!auth || !db) {
      warn('firebase auth/db not available');
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      log('not signed in; reconcile not started');
      return;
    }
    currentUid = user.uid;

    lastSeenTimestamp = parseInt(localStorage.getItem('notificationLastSeen') || '0', 10) || 0;
    // initial query for messages after lastSeenTimestamp
    let initialQuery = db.collectionGroup('messages');
    if (lastSeenTimestamp > 0 && firebase && firebase.firestore && firebase.firestore.Timestamp) {
      const sinceTs = firebase.firestore.Timestamp.fromMillis(lastSeenTimestamp);
      initialQuery = initialQuery.where('createdAt', '>', sinceTs);
    }

    initialQuery.get().then(snapshot => {
      snapshot.forEach(doc => {
        const data = doc.data() || {};
        const senderId = data.senderId || data.sender || data.uid || null;
        const createdAtMs = normalizeTimestamp(data.createdAt);
        const msgId = doc.id;
        if (!senderId || senderId === currentUid) return;
        if (createdAtMs <= lastSeenTimestamp) return;
        if (readIds.has(msgId)) return;
        // fetch user info and call add
        db.collection('users').doc(senderId).get().then(uDoc => {
          const u = uDoc.exists ? uDoc.data() : {};
          window._notif_addNotification({
            id: msgId,
            fromId: senderId,
            fromName: u.displayName || (u.email ? u.email.split('@')[0] : 'Someone'),
            photo: u.photoURL || null,
            preview: (data.text && String(data.text).slice(0, 120)) || data.preview || '',
            createdAtMs: createdAtMs
          });
        }).catch(err => {
          window._notif_addNotification({
            id: msgId,
            fromId: senderId,
            fromName: 'Someone',
            photo: null,
            preview: (data.text && String(data.text).slice(0, 120)) || data.preview || '',
            createdAtMs: createdAtMs
          });
        });
      });
      startRealtimeListener();
    }).catch(err => {
      warn('initial notifications query failed', err);
      startRealtimeListener();
    });
  }

  function startRealtimeListener() {
    if (unsub) return;
    log('starting realtime listener for notifications');

    unsub = db.collectionGroup('messages').onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type !== 'added') return;
        const doc = change.doc;
        if (seenIds.has(doc.id)) return;
        const data = doc.data() || {};
        const senderId = data.senderId || data.sender || data.uid || null;
        const createdAtMs = normalizeTimestamp(data.createdAt);
        if (!senderId || senderId === currentUid) return;
        if (createdAtMs <= lastSeenTimestamp) return;
        if (readIds.has(doc.id)) return;
        // add notification (fetch user)
        db.collection('users').doc(senderId).get().then(uDoc => {
          const u = uDoc.exists ? uDoc.data() : {};
          window._notif_addNotification({
            id: doc.id,
            fromId: senderId,
            fromName: u.displayName || (u.email ? u.email.split('@')[0] : 'Someone'),
            photo: u.photoURL || null,
            preview: (data.text && String(data.text).slice(0, 120)) || data.preview || '',
            createdAtMs: createdAtMs
          });
        }).catch(err => {
          window._notif_addNotification({
            id: doc.id,
            fromId: senderId,
            fromName: 'Someone',
            photo: null,
            preview: (data.text && String(data.text).slice(0, 120)) || data.preview || '',
            createdAtMs: createdAtMs
          });
        });
      });
    }, err => warn('notifications listener error', err));
  }

  function stopListener() {
    if (typeof unsub === 'function') {
      unsub();
      unsub = null;
    }
    unreadCount = 0;
    updateBadge();
    seenIds.clear();
  }

  // Auth observer
  if (auth && typeof auth.onAuthStateChanged === 'function') {
    auth.onAuthStateChanged(user => {
      if (user) {
        currentUid = user.uid;
        lastSeenTimestamp = parseInt(localStorage.getItem('notificationLastSeen') || '0', 10) || 0;
        reconcileThenListen();
      } else {
        currentUid = null;
        stopListener();
        clearList();
        showNoNew();
      }
    });
  } else {
    // attempt anyway
    reconcileThenListen();
  }

  // Bell: toggle dropdown only. DO NOT mark everything seen here.
  if (bell) {
    bell.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!dropdown) return;
      if (dropdown.style.display === 'block') {
        dropdown.style.display = 'none';
      } else {
        dropdown.style.display = 'block';
      }
    });
  }

  // Click outside closes dropdown
  document.addEventListener('click', function (e) {
    if (!dropdown) return;
    if (dropdown.style.display === 'block' && !dropdown.contains(e.target) && !(bell && bell.contains(e.target))) {
      dropdown.style.display = 'none';
    }
  });

  // Sync reads and lastSeen across tabs
  window.addEventListener('storage', function (e) {
    if (!e.key) return;
    if (e.key === 'notificationLastSeen') {
      const v = parseInt(e.newValue || '0', 10) || 0;
      lastSeenTimestamp = v;
      // drop any notifications older than lastSeen by clearing and relying on reconciliation
      unreadCount = 0;
      updateBadge();
      clearList();
      showNoNew();
      seenIds.clear();
    } else if (e.key === 'notificationReadIds') {
      try {
        const arr = JSON.parse(e.newValue || '[]');
        readIds.clear();
        arr.forEach(id => readIds.add(id));
        // Remove any elements in the DOM matching read ids and update count
        try {
          const nodes = Array.from(list?.querySelectorAll('[data-id]') || []);
          let removed = 0;
          nodes.forEach(n => {
            const id = n.dataset.id;
            if (readIds.has(id)) { n.remove(); removed++; }
          });
          // adjust unreadCount conservatively
          unreadCount = Math.max(0, unreadCount - removed);
          updateBadge();
          if ((list?.children?.length || 0) === 0) showNoNew();
        } catch (e) {}
      } catch (e) {}
    }
  });

  // Init UI
  updateBadge();
  if (list && (!list.children || list.children.length === 0)) showNoNew();

  // Debug helpers
  window._notif_debug = {
    reconcileThenListen,
    startRealtimeListener,
    stopListener,
    getLastSeen: () => lastSeenTimestamp,
    setLastSeen: v => { lastSeenTimestamp = v; localStorage.setItem('notificationLastSeen', String(v)); },
    getSeenIds: () => Array.from(seenIds),
    getReadIds: () => Array.from(readIds)
  };
})();