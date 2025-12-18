// chat.js — Full merged file
// - Preserves inbox UI, sending, loading messages, and all existing behaviors.
// - Delegates notification UI / badge updates to notifications.js when available
//   (window._notif_addNotification / window._notif_markAsSeen).
// - Provides safe fallbacks so the app still works if notifications.js isn't loaded.
//
// Important: ensure notifications.js is loaded before this file in index.html so delegation works.

let messageListenerUnsubscribe = null;
let currentChatPartnerId = null;
let unreadCount = 0;
let lastSeenTimestamp = parseInt(localStorage.getItem('notificationLastSeen') || '0', 10) || 0;
let currentInboxPartner = null;

// Helpers
function normalizeTimestamp(createdAt) {
    if (!createdAt) return Date.now();
    if (typeof createdAt === 'number') return createdAt;
    if (createdAt.toMillis && typeof createdAt.toMillis === 'function') return createdAt.toMillis();
    if (createdAt.seconds) return createdAt.seconds * 1000;
    return Date.now();
}

// Fallback badge updater (used only if notifications.js not present)
function updateBadge() {
    const badge = document.getElementById('notificationBadge');
    if (!badge) return;
    if (unreadCount <= 0) {
        badge.style.display = 'none';
    } else {
        badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
        badge.style.display = 'flex';
    }
}

// Fallback notification UI (used only if notifications.js not present)
function showMessageNotificationFallback(senderId, senderName, senderPhoto, msgTimestamp) {
    const msgTime = (typeof msgTimestamp === 'number') ? msgTimestamp : (msgTimestamp?.toMillis ? msgTimestamp.toMillis() : Date.now());

    // Only count and show if newer than last seen
    if (msgTime <= lastSeenTimestamp) return;

    unreadCount++;
    updateBadge();

    const list = document.getElementById('notificationList');
    if (list && list.innerHTML.includes('No new messages')) list.innerHTML = '';

    const item = document.createElement('div');
    item.style = "padding:16px 20px;border-bottom:1px solid #eee;display:flex;gap:14px;align-items:center;cursor:pointer;background:#f9f9f9;transition:0.2s;";

    item.onclick = () => {
        if (typeof openPrivateChat === 'function') {
            openPrivateChat(senderId, senderName, senderPhoto);
        }
        const dropdown = document.getElementById('notificationsDropdown');
        if (dropdown) dropdown.style.display = 'none';

        // Mark as seen now (local)
        lastSeenTimestamp = Date.now();
        localStorage.setItem('notificationLastSeen', String(lastSeenTimestamp));
        unreadCount = 0;
        updateBadge();
        if (list) list.innerHTML = '<p style="text-align:center;color:#888;margin:30px 0;">No new messages</p>';
    };

    item.innerHTML = `
        <img src="${senderPhoto || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + senderId}" style="width:44px;height:44px;border-radius:50%;">
        <div style="flex:1;">
            <strong>${senderName || "Someone"}</strong> sent you a message
            <div style="font-size:0.9rem;color:#888;margin-top:4px;">Click to open chat</div>
        </div>
        <button style="background:#8B572A;color:white;padding:8px 16px;border:none;border-radius:25px;font-size:0.9rem;font-weight:bold;">Open</button>
    `;

    const listEl = document.getElementById('notificationList');
    if (listEl) listEl.prepend(item);
}

// Notify helper: delegate to notifications.js when available, otherwise fallback
function notifyIncomingMessage({ id, fromId, fromName, photo, preview, createdAtMs }) {
    if (window._notif_addNotification && typeof window._notif_addNotification === 'function') {
        window._notif_addNotification({
            id,
            fromId,
            fromName,
            photo,
            preview,
            createdAtMs
        });
    } else {
        // Use fallback notification renderer that manipulates the badge directly
        showMessageNotificationFallback(fromId, fromName || 'Someone', photo || null, createdAtMs);
    }
}

// Message listener — listens to collectionGroup('messages') and delegates notifications
function startMessageListener() {
    const user = auth.currentUser;
    if (!user || messageListenerUnsubscribe) return;

    // ensure lastSeenTimestamp is up to date at start
    lastSeenTimestamp = parseInt(localStorage.getItem('notificationLastSeen') || '0', 10) || 0;

    messageListenerUnsubscribe = db.collectionGroup('messages')
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type !== 'added') return;
                const doc = change.doc;
                const msg = doc.data() || {};

                // Normalize sender id (various field names)
                const senderId = msg.senderId || msg.sender || msg.uid || null;

                // createdAt to ms
                const createdAtMs = normalizeTimestamp(msg.createdAt);

                // Skip own messages
                if (!senderId || senderId === user.uid) return;

                // Skip messages older or equal to lastSeen
                if (createdAtMs <= lastSeenTimestamp) return;

                // Try to derive partnerId — prefer participants array or chatId from doc ref
                let partnerId = null;
                if (Array.isArray(msg.participants)) {
                    partnerId = msg.participants.find(p => p !== user.uid) || null;
                }
                // Fallback: try parse chatId from ref parent
                try {
                    const chatRef = doc.ref.parent.parent;
                    if (chatRef && chatRef.id) {
                        const chatId = chatRef.id;
                        // if chatId is in form 'uid1_uid2' we can deduce partner
                        if (!partnerId && chatId.includes('_')) {
                            const parts = chatId.split('_');
                            partnerId = parts.find(p => p !== user.uid) || null;
                        }
                    }
                } catch (e) { /* ignore */ }

                // Fetch sender profile info and notify
                db.collection('users').doc(senderId).get().then(uDoc => {
                    const u = uDoc.exists ? uDoc.data() : {};
                    notifyIncomingMessage({
                        id: doc.id,
                        fromId: senderId,
                        fromName: u.displayName || (u.email ? u.email.split('@')[0] : 'Someone'),
                        photo: u.photoURL || null,
                        preview: (msg.text && String(msg.text).slice(0, 120)) || msg.preview || '',
                        createdAtMs: createdAtMs
                    });
                }).catch(err => {
                    console.warn('failed to fetch user for notif', err);
                    notifyIncomingMessage({
                        id: doc.id,
                        fromId: senderId,
                        fromName: 'Someone',
                        photo: null,
                        preview: (msg.text && String(msg.text).slice(0, 120)) || msg.preview || '',
                        createdAtMs: createdAtMs
                    });
                });
            });
        }, err => {
            console.warn('message listener error', err);
        });
}

// Stop listener
function stopMessageListener() {
    if (messageListenerUnsubscribe) {
        try { messageListenerUnsubscribe(); } catch (e) { /* ignore */ }
        messageListenerUnsubscribe = null;
    }
}

// Open private chat modal (used by notifications and inbox)
function openPrivateChat(uid, name, photoURL) {
    if (!uid || !auth.currentUser) return;

    currentChatPartnerId = uid;
    const chatNameEl = document.getElementById('chatName');
    const chatAvatarEl = document.getElementById('chatAvatar');
    if (chatNameEl) chatNameEl.textContent = name || "Friend";
    if (chatAvatarEl) chatAvatarEl.src = photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`;
    const pmEl = document.getElementById('privateMessages');
    if (pmEl) pmEl.innerHTML = '<p style="text-align:center;color:#888;margin:30px 0;">Loading chat...</p>';
    if (typeof loadPrivateMessages === 'function') loadPrivateMessages(uid);
    const modal = document.getElementById('privateChatModal');
    if (modal) modal.classList.add('open');
    setTimeout(() => document.getElementById('privateMessageInput')?.focus(), 200);
}

// Send message from private chat modal
function sendPrivateMessage() {
    const input = document.getElementById('privateMessageInput');
    const text = input.value.trim();
    if (!text || !currentChatPartnerId) return;

    const chatId = [auth.currentUser.uid, currentChatPartnerId].sort().join('_');

    db.collection('privateChats').doc(chatId).collection('messages').add({
        text: text,
        senderId: auth.currentUser.uid,
        senderName: currentUserProfile.displayName || "Me",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        participants: [auth.currentUser.uid, currentChatPartnerId]
    }).then(() => {
        input.value = '';
        input.focus();
    }).catch(err => {
        console.error('sendPrivateMessage failed', err);
        alert('Failed to send message.');
    });
}

// Load live private messages into modal
function loadPrivateMessages(partnerId) {
    const user = auth.currentUser;
    if (!user) return;

    const chatId = [user.uid, partnerId].sort().join('_');
    const messagesDiv = document.getElementById('privateMessages');
    if (!messagesDiv) return;

    // Detach any previous listener by reading from a unique ref? In this simple implementation we reattach each call.
    db.collection('privateChats').doc(chatId).collection('messages')
        .orderBy('createdAt')
        .onSnapshot(snapshot => {
            messagesDiv.innerHTML = '';
            snapshot.forEach(doc => {
                const msg = doc.data();
                const isMe = msg.senderId === user.uid;
                const bubble = document.createElement('div');
                bubble.style = `max-width:75%;margin:${isMe ? '10px 0 10px auto' : '10px 0 10px 0'};padding:12px 18px;border-radius:20px;background:${isMe ? '#8B572A' : '#e9e9e9'};color:${isMe ? 'white' : '#333'};align-self:${isMe ? 'flex-end' : 'flex-start'};`;
                bubble.innerHTML = `<div style="font-weight:bold;font-size:0.9rem;margin-bottom:4px;opacity:0.8;">${msg.senderName || (isMe ? 'Me' : 'Them')}</div>${(msg.text||'').replace(/\n/g, '<br>')}`;
                messagesDiv.appendChild(bubble);
            });
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }, err => {
            console.error('loadPrivateMessages snapshot error', err);
            messagesDiv.innerHTML = '<p style="text-align:center;color:#c66;">Failed to load messages</p>';
        });
}

// ---------- Inbox & Conversation list (left panel) ----------

function openMessagesInbox() {
    const modal = document.getElementById('messagesInboxModal');
    if (modal) {
        modal.classList.add('open');
        loadConversationList();
    }
}

function closeMessagesInbox() {
    document.getElementById('messagesInboxModal')?.classList.remove('open');
    // Optionally stop realtime listener — but keep messageListenerUnsubscribe for incoming notification listening.
}

// Load list of all users (used for starting a new chat) — this function existed in previous version
function loadConversationList() {
    const list = document.getElementById('conversationList');
    if (!list) return;
    list.innerHTML = '<p style="text-align:center;color:#ffecb3;opacity:0.8;">Loading users...</p>';

    if (!auth.currentUser) {
        list.innerHTML = '<p style="text-align:center;color:#ffecb3;opacity:0.8;">Sign in to message others</p>';
        return;
    }

    const currentUid = auth.currentUser.uid;

    db.collection('users')
        .orderBy('displayName')
        .get()
        .then(snapshot => {
            if (snapshot.empty) {
                list.innerHTML = '<p style="text-align:center;color:#ffecb3;opacity:0.8;">No users found</p>';
                return;
            }

            list.innerHTML = '';
            snapshot.forEach(doc => {
                const userData = doc.data();
                const uid = doc.id;
                if (uid === currentUid) return; // skip yourself

                const name = userData.displayName || "Friend";
                const photo = userData.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`;

                const item = document.createElement('div');
                item.style = "display:flex;align-items:center;gap:15px;padding:15px;border-bottom:1px solid rgba(255,248,225,0.3);cursor:pointer;transition:0.3s;";
                item.onclick = () => openChatInInbox(uid, name, photo);
                item.onmouseover = () => item.style.background = 'rgba(255,248,225,0.2)';
                item.onmouseout = () => item.style.background = 'transparent';
                item.innerHTML = `
                    <img src="${photo}" style="width:50px;height:50px;border-radius:50%;border:3px solid #fff8e1;object-fit:cover;">
                    <div style="flex:1;">
                        <div style="font-weight:bold;font-size:1.1rem;color:#fff8e1;">${name}</div>
                        <div style="font-size:0.9rem;color:#ffecb3;opacity:0.8;">Click to chat</div>
                    </div>
                    <button onclick="event.stopPropagation(); viewUserProfile('${uid}')" style="background:#fff8e1;color:#8B572A;padding:8px 16px;border:none;border-radius:25px;font-size:0.9rem;font-weight:bold;">View Profile</button>
                `;

                list.appendChild(item);
            });
        }).catch(err => {
            console.error('loadConversationList failed', err);
            list.innerHTML = '<p style="text-align:center;color:#c66;">Failed to load users</p>';
        });
}

// Open chat in inbox (right panel)
function openChatInInbox(uid, name, photo) {
    currentInboxPartner = uid;

    const nameEl = document.getElementById('inboxChatName');
    const avatarEl = document.getElementById('inboxChatAvatar');
    const messagesEl = document.getElementById('inboxMessages');
    const input = document.getElementById('inboxMessageInput');

    if (nameEl) nameEl.textContent = name || "Friend";
    if (avatarEl) avatarEl.src = photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`;
    if (messagesEl) messagesEl.innerHTML = '<p style="text-align:center;color:#ffecb3;opacity:0.8;">Loading messages...</p>';
    if (input) input.focus();

    loadInboxMessages(uid);
}

// Load messages for inbox right panel
function loadInboxMessages(partnerId) {
    const user = auth.currentUser;
    if (!user) return;

    const chatId = [user.uid, partnerId].sort().join('_');
    const messagesDiv = document.getElementById('inboxMessages');
    if (!messagesDiv) return;

    db.collection('privateChats').doc(chatId).collection('messages')
        .orderBy('createdAt')
        .onSnapshot(snapshot => {
            messagesDiv.innerHTML = '';
            snapshot.forEach(doc => {
                const msg = doc.data();
                const isMe = msg.senderId === user.uid;
                const bubble = document.createElement('div');
                bubble.style = `max-width:75%;margin:${isMe ? '10px 0 10px auto' : '10px 0 10px 0'};padding:12px 18px;border-radius:20px;background:${isMe ? '#8B572A' : '#e9e9e9'};color:${isMe ? 'white' : '#333'};align-self:${isMe ? 'flex-end' : 'flex-start'};`;
                bubble.innerHTML = `<div style="font-weight:bold;font-size:0.9rem;margin-bottom:4px;opacity:0.8;">${msg.senderName || (isMe ? 'Me' : 'Them')}</div>${(msg.text||'').replace(/\n/g, '<br>')}`;
                messagesDiv.appendChild(bubble);
            });
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }, err => {
            console.error('loadInboxMessages snapshot error', err);
            messagesDiv.innerHTML = '<p style="text-align:center;color:#c66;">Failed to load messages</p>';
        });
}

// Send message from inbox input
function sendInboxMessage() {
    const input = document.getElementById('inboxMessageInput');
    const text = input.value.trim();
    if (!text || !currentInboxPartner) return;

    const chatId = [auth.currentUser.uid, currentInboxPartner].sort().join('_');

    db.collection('privateChats').doc(chatId).collection('messages').add({
        text: text,
        senderId: auth.currentUser.uid,
        senderName: currentUserProfile.displayName || "Me",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        participants: [auth.currentUser.uid, currentInboxPartner]
    }).then(() => {
        input.value = '';
        input.focus();
    }).catch(err => {
        console.error('sendInboxMessage failed', err);
        alert('Failed to send message.');
    });
}

// Close private chat modal
function closePrivateChatModal() {
    document.getElementById('privateChatModal')?.classList.remove('open');
    currentChatPartnerId = null;
    stopMessageListener();  // Optional: stop if not needed for background notifications
}

// View user profile modal (new)
async function viewUserProfile(userId) {
    if (!userId) return;

    const userDoc = await db.collection('users').doc(userId).get();
    const data = userDoc.data();

    if (data) {
        let profileContent = `
            <img src="${data.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + userId}" alt="Avatar" style="width:100px; height:100px; border-radius:50%;">
            <h3>${data.displayName || 'Friend'}</h3>
        `;

        // Conditionally show fields based on visibility flags (default true if undefined)
        if (data.showOstomyType !== false && data.ostomyType) {
            profileContent += `<p>Ostomy Type: ${data.ostomyType}</p>`;
        }
        if (data.showSurgeryDate !== false && data.surgeryDate) {
            profileContent += `<p>Surgery Date: ${new Date(data.surgeryDate).toLocaleDateString()}</p>`;
        }
        if (data.showBio !== false && data.bio) {
            profileContent += `<p>Bio: ${data.bio}</p>`;
        }

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
                ${profileContent}
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        alert('User profile not found.');
    }
}

// Init listeners on load (if needed)
window.addEventListener('load', () => {
    startMessageListener();
    // Other init if any
});