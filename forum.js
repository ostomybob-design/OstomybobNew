// forum.js — FULLY WORKING FORUM (split files compatible)

let currentCategory = 'general';
let currentThreadId = null;

// Load a category — creates threadList element first
function loadCategory(category) {
    currentCategory = category;
    document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
    if (event?.target) event.target.classList.add('active');

    document.getElementById('forum-box').innerHTML = `
        <h2>Community Forum</h2>
        <div class="forum-categories">
            <button class="category-btn ${category==='general'?'active':''}" onclick="loadCategory('general')">General</button>
            <button class="category-btn ${category==='new'?'active':''}" onclick="loadCategory('new')">New to Ostomy</button>
            <button class="category-btn ${category==='products'?'active':''}" onclick="loadCategory('products')">Product Reviews</button>
            <button class="category-btn ${category==='travel'?'active':''}" onclick="loadCategory('travel')">Travel Tips</button>
        </div>
        <div id="threadList" class="thread-list">
            <p style="text-align:center;color:#666;margin-top:50px;">Loading threads...</p>
        </div>
        <button class="new-thread-btn" onclick="openNewThread()" 
                style="background:#fff8e1;color:#8B572A;padding:18px 40px;border:none;border-radius:50px;font-weight:bold;font-size:1.4rem;cursor:pointer;box-shadow:0 8px 25px rgba(0,0,0,0.3);margin-top:20px;transition:0.3s;width:100%;">
            + New Thread
        </button>
    `;

    loadThreads(); // Safe to call — threadList now exists
}

// Load threads
function loadThreads() {
    const list = document.getElementById('threadList');
    if (!list) return;

    list.innerHTML = '<p style="text-align:center;color:#666;margin-top:50px;">Loading threads...</p>';

    db.collection('threads')
        .where('category', '==', currentCategory)
        .orderBy('lastActivity', 'desc')
        .onSnapshot(snapshot => {
            list.innerHTML = '';
            if (snapshot.empty) {
                list.innerHTML = '<p style="text-align:center;color:#666;margin-top:50px;">No threads yet. Be the first!</p>';
                return;
            }

            snapshot.forEach(doc => {
                const thread = doc.data();
                const threadId = doc.id;
                const isAuthor = thread.authorId === auth.currentUser?.uid;

                const div = document.createElement('div');
                div.className = 'thread';
                div.style.cursor = 'pointer';
                div.onclick = () => openThread(threadId, thread);

                div.innerHTML = `
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 0;border-bottom:1px solid rgba(139,87,42,0.2);">
                        <div style="flex:1;">
                            <div style="font-weight:bold;color:#000;font-size:1.35rem;">
                                ${thread.title}
                                ${isAuthor ? '<span style="color:#A67C52;font-size:0.8rem;margin-left:8px;">(you)</span>' : ''}
                            </div>
                            <div style="color:#000;font-size:1rem;margin-top:6px;">
                                by ${thread.authorName || "Friend"} 
                                • ${new Date(thread.lastActivity.toDate()).toLocaleDateString()}
                                • <strong>${thread.replyCount || 0}</strong> ${thread.replyCount === 1 ? 'reply' : 'replies'}
                            </div>
                        </div>
                        ${isAuthor ? `
                            <div style="margin-left:15px;display:flex;gap:8px;">
                                <button onclick="event.stopPropagation(); editThread('${threadId}', '${escapeHtml(thread.title)}', '${escapeHtml(thread.body)}')" 
                                        style="background:#fff8e1;color:#8B572A;padding:6px 12px;border:none;border-radius:20px;font-size:0.9rem;cursor:pointer;">
                                    Edit
                                </button>
                                <button onclick="event.stopPropagation(); deleteThread('${threadId}')" 
                                        style="background:#ccc;color:#8B572A;padding:6px 12px;border:none;border-radius:20px;font-size:0.9rem;cursor:pointer;">
                                    Delete
                                </button>
                            </div>
                        ` : ''}
                    </div>
                `;
                list.appendChild(div);
            });
        }, err => {
            console.error("Thread load error:", err);
            list.innerHTML = '<p style="text-align:center;color:#c66;">Error loading threads</p>';
        });
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Edit thread
function editThread(threadId, currentTitle, currentBody) {
    const newTitle = prompt("Edit thread title:", currentTitle);
    if (newTitle === null || newTitle.trim() === "") return;
    const newBody = prompt("Edit thread body:", currentBody);
    if (newBody === null) return;

    db.collection('threads').doc(threadId).update({
        title: newTitle.trim(),
        body: newBody.trim(),
        lastActivity: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => alert("Thread updated!")).catch(err => alert("Update failed: " + err.message));
}

// Delete thread
function deleteThread(threadId) {
    if (!confirm("Delete this thread permanently?")) return;

    db.collection('threads').doc(threadId).collection('replies').get()
        .then(snapshot => {
            const batch = db.batch();
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            return batch.commit();
        })
        .then(() => db.collection('threads').doc(threadId).delete())
        .then(() => alert("Thread deleted"))
        .catch(err => alert("Delete failed: " + err.message));
}

// New thread modal
function openNewThread() {
    document.getElementById('newThreadModal').classList.add('open');
}

// Create thread
function createThread() {
    const user = auth.currentUser;
    if (!user) return alert("You must be logged in");

    const title = document.getElementById('threadTitle').value.trim();
    const body = document.getElementById('threadBody').value.trim();
    const category = document.getElementById('threadCategory').value;

    if (!title || !body) return alert("Please fill in title and message");

    db.collection('threads').add({
        title: title,
        body: body,
        category: category,
        authorId: user.uid,
        authorName: currentUserProfile.displayName || user.email.split('@')[0],
        authorPhoto: currentUserProfile.photoURL || null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastActivity: firebase.firestore.FieldValue.serverTimestamp(),
        replyCount: 0
    }).then(() => {
        document.getElementById('newThreadModal').classList.remove('open');
        document.getElementById('threadTitle').value = '';
        document.getElementById('threadBody').value = '';
        alert("Thread posted!");
    }).catch(err => alert("Post failed: " + err.message));
}

// Open thread
function openThread(threadId, threadData) {
    
    currentThreadId = threadId;
    document.getElementById('forum-box').innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
            <button onclick="loadCategory('${threadData.category}')" 
                    style="background:none;border:none;color:#fff8e1;font-size:1.3rem;cursor:pointer;padding:10px 0;">
                ← Back
            </button>
            <h2 style="color:#fff8e1;font-size:2.2rem;margin:0;text-align:center;flex:1;">
                ${threadData.title}
            </h2>
            <div style="width:60px;"></div>
        </div>

        <div id="repliesList" style="flex:1;max-height:650px;overflow-y:auto;padding-right:10px;margin-bottom:20px;">
            <p style="text-align:center;color:#666;margin:20px 0;">Loading replies...</p>
        </div>

        <div style="margin:20px 0 0 0;">
            <textarea id="replyBody" placeholder="Write a reply..." 
                      style="width:100%;height:120px;padding:18px;border-radius:25px;border:3px solid #fff8e1;background:rgba(255,255,255,0.9);font-size:1.1rem;resize:none;margin-bottom:12px;"></textarea>
            <button onclick="postReply()" 
                    style="background:#fff8e1;color:#8B572A;padding:18px 40px;border:none;border-radius:50px;font-weight:bold;font-size:1.4rem;cursor:pointer;width:100%;">
                Post Reply
            </button>
        </div>
    `;

    loadReplies();
}

function loadReplies() {
    if (!currentThreadId) return;
    const repliesList = document.getElementById('repliesList');
    repliesList.innerHTML = '<p style="text-align:center;color:#666;margin:20px 0;">Loading replies...</p>';

    db.collection('threads').doc(currentThreadId).collection('replies')
        .orderBy('createdAt', 'asc')
        .onSnapshot(snapshot => {
            repliesList.innerHTML = '';
            if (snapshot.empty) {
                repliesList.innerHTML = '<p style="text-align:center;color:#666;margin:20px 0;">No replies yet. Be the first!</p>';
                return;
            }

            snapshot.forEach(doc => {
                const reply = doc.data();
                const replyId = doc.id;
                const isAuthor = reply.authorId === auth.currentUser?.uid;

                const avatarUrl = reply.authorPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${reply.authorId || 'user'}`;

                const timestamp = reply.createdAt 
                    ? new Date(reply.createdAt.toDate()).toLocaleString([], { 
                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
                      })
                    : "Just now";

                // Online status
                const lastActive = reply.lastActive?.toMillis() || 0;
                const minutesAgo = (Date.now() - lastActive) / 60000;
                const statusClass = minutesAgo < 5 ? 'status-online' : 
                                   minutesAgo < 30 ? 'status-away' : 'status-offline';

                const div = document.createElement('div');
                div.style = "background:rgba(255,255,255,0.95);border-radius:20px;padding:16px 18px;margin:12px 0;box-shadow:0 4px 15px rgba(0,0,0,0.1);position:relative;";

                div.innerHTML = `
                    <!-- TOP ROW — TIGHT -->
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
                        <div style="display:flex;align-items:center;gap:10px;">
                            <div class="avatar-container">
                                <img src="${avatarUrl}" 
                                     style="width:40px;height:40px;border-radius:50%;border:3px solid #fff8e1;cursor:pointer;"
                                     onclick="event.stopPropagation(); showUserProfile('${reply.authorId}')">
                                <div class="status-dot ${statusClass}"></div>
                            </div>
                            <div style="line-height:1.2;">
                                <strong style="color:#8B572A;font-size:1.1rem;cursor:pointer;" 
                                        onclick="event.stopPropagation(); showUserProfile('${reply.authorId}')">
                                    ${reply.authorName || "Friend"}
                                </strong>
                                <div style="font-size:0.8rem;color:#888;">${timestamp}</div>
                            </div>
                        </div>

                        ${isAuthor ? `
                            <div style="display:flex;gap:12px;">
                                <button onclick="event.stopPropagation(); editReply('${currentThreadId}', '${replyId}', '${escapeHtml(reply.body)}')"
                                        style="background:none;border:none;color:#8B572A;font-weight:600;font-size:0.9rem;cursor:pointer;">
                                    Edit
                                </button>
                                <button onclick="event.stopPropagation(); deleteReply('${currentThreadId}', '${replyId}')"
                                        style="background:none;border:none;color:#c66;font-weight:600;font-size:0.9rem;cursor:pointer;">
                                    Delete
                                </button>
                            </div>
                        ` : ''}
                    </div>

                    <!-- MESSAGE — ZERO MARGIN ABOVE -->
                    <div style="margin-left:50px;margin-top:8px;line-height:1.6;color:#333;white-space:pre-wrap;word-wrap:break-word;">
                        ${reply.body.replace(/\n/g, '<br>')}
                    </div>
                `;

                repliesList.appendChild(div);
            });
            repliesList.scrollTop = repliesList.scrollHeight;
        });
}




function postReply() {
    const user = auth.currentUser;
    if (!user) return alert("You must be logged in");

    const body = document.getElementById('replyBody').value.trim();
    if (!body) return alert("Please write a reply");

    db.collection('threads').doc(currentThreadId).collection('replies').add({
        body: body,
        authorId: user.uid,
        authorName: currentUserProfile.displayName || user.email.split('@')[0],
        authorPhoto: currentUserProfile.photoURL || null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        document.getElementById('replyBody').value = '';
        db.collection('threads').doc(currentThreadId).update({
            lastActivity: firebase.firestore.FieldValue.serverTimestamp(),
            replyCount: firebase.firestore.FieldValue.increment(1)
        });
    }).catch(err => alert("Reply failed: " + err.message));
}

// Edit reply
function editReply(threadId, replyId, currentBody) {
    const newBody = prompt("Edit your reply:", currentBody);
    if (newBody === null || newBody.trim() === "") return;

    db.collection('threads').doc(threadId).collection('replies').doc(replyId).update({
        body: newBody.trim(),
        editedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {}).catch(err => alert("Edit failed: " + err.message));
}

// Delete reply
function deleteReply(threadId, replyId) {
    if (!confirm("Delete this reply permanently?")) return;

    db.collection('threads').doc(threadId).collection('replies').doc(replyId).delete()
        .then(() => {
            db.collection('threads').doc(threadId).update({
                replyCount: firebase.firestore.FieldValue.increment(-1),
                lastActivity: firebase.firestore.FieldValue.serverTimestamp()
            });
        })
        .catch(err => alert("Delete failed: " + err.message));
}

// Start loading threads on login
auth.onAuthStateChanged(user => {
    if (user) {
        loadThreads();
    }
});