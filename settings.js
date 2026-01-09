// settings.js — COMPLETE & FIXED (color linking, persistence, temp toggle, profile save with visibility checkboxes, background opacity, inbox mode)

let linkColorsEnabled = localStorage.getItem('linkColorsEnabled') === 'true';

// Toggle "Link All Colors"
function toggleLinkColors(enabled) {
    linkColorsEnabled = enabled;
    localStorage.setItem('linkColorsEnabled', enabled);

    const checkbox = document.getElementById('linkColors');
    if (checkbox) checkbox.checked = enabled;

    if (enabled) {
        const current = document.getElementById('headerColorPicker')?.value || '#8B572A';
        syncAllColors(current);
    }
}

// Sync ALL elements and pickers
function syncAllColors(color) {
    if (!linkColorsEnabled) return;

    document.querySelector('header').style.background = color;
    document.querySelector('.ticker-container').style.background = color;
    document.body.style.background = color;
    document.body.style.backgroundImage = 'none';

    const headerPicker = document.getElementById('headerColorPicker');
    const tickerPicker = document.getElementById('tickerColorPicker');
    const bgPicker = document.getElementById('bgColor');
    if (headerPicker) headerPicker.value = color;
    if (tickerPicker) tickerPicker.value = color;
    if (bgPicker) bgPicker.value = color;

    localStorage.setItem('headerColor', color);
    localStorage.setItem('tickerColor', color);
    localStorage.setItem('pageBackgroundColor', color);
}

// Individual color changes
function changeHeaderColor(color) {
    document.querySelector('header').style.background = color;
    localStorage.setItem('headerColor', color);
    if (linkColorsEnabled) syncAllColors(color);
}

function changeTickerColor(color) {
    document.querySelector('.ticker-container').style.background = color;
    localStorage.setItem('tickerColor', color);
    if (linkColorsEnabled) syncAllColors(color);
}

function changePageColor(color) {
    document.body.style.background = color;
    document.body.style.backgroundImage = 'none';
    localStorage.setItem('pageBackgroundColor', color);
    localStorage.removeItem('pageBackgroundImage');
    const picker = document.getElementById('bgColor');
    if (picker) picker.value = color;
    if (linkColorsEnabled) syncAllColors(color);
}

function uploadBackground(file) {
    if (!file || !auth.currentUser) return;
    const ref = storage.ref(`backgrounds/${auth.currentUser.uid}`);
    ref.put(file).then(snapshot => {
        snapshot.ref.getDownloadURL().then(url => {
            document.body.style.background = `url('${url}') center center fixed`;
            document.body.style.backgroundSize = 'cover';
            localStorage.setItem('pageBackgroundImage', url);
            localStorage.removeItem('pageBackgroundColor');
            applyBgOpacity(localStorage.getItem('bgOpacity') || '100');
        });
    }).catch(err => alert("Upload failed: " + err.message));
}

// Background opacity control
function applyBgOpacity(opacityPercent) {
    const opacity = opacityPercent / 100;
    let overlay = document.getElementById('bgOpacityOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'bgOpacityOverlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.background = 'white';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '-1';
        document.body.appendChild(overlay);
    }
    overlay.style.opacity = 1 - opacity;
}

// Load saved opacity
function loadBgOpacity() {
    const saved = localStorage.getItem('bgOpacity') || '100';
    applyBgOpacity(saved);

    const slider = document.getElementById('bgOpacitySlider');
    const value = document.getElementById('bgOpacityValue');
    if (slider && value) {
        slider.value = saved;
        value.textContent = saved + '%';
    }
}

// Slider handler
document.getElementById('bgOpacitySlider')?.addEventListener('input', (e) => {
    const value = e.target.value;
    document.getElementById('bgOpacityValue').textContent = value + '%';
    localStorage.setItem('bgOpacity', value);
    applyBgOpacity(value);
});

function resetAllColors() {
    const defaultColor = '#8B572A';

    document.querySelector('header').style.background = defaultColor;
    document.querySelector('.ticker-container').style.background = 'rgba(139, 87, 42, 0.48)';
    document.body.style.background = "url('images/Community.png') center center fixed";
    document.body.style.backgroundSize = 'cover';

    const overlay = document.getElementById('bgOpacityOverlay');
    if (overlay) overlay.remove();

    const headerPicker = document.getElementById('headerColorPicker');
    const tickerPicker = document.getElementById('tickerColorPicker');
    const bgPicker = document.getElementById('bgColor');
    if (headerPicker) headerPicker.value = defaultColor;
    if (tickerPicker) tickerPicker.value = defaultColor;
    if (bgPicker) bgPicker.value = defaultColor;

    localStorage.removeItem('headerColor');
    localStorage.removeItem('tickerColor');
    localStorage.removeItem('pageBackgroundColor');
    localStorage.removeItem('pageBackgroundImage');
    localStorage.removeItem('linkColorsEnabled');
    localStorage.removeItem('bgOpacity');
    localStorage.removeItem('featuredMode');

    linkColorsEnabled = false;
    const checkbox = document.getElementById('linkColors');
    if (checkbox) checkbox.checked = false;

    const slider = document.getElementById('bgOpacitySlider');
    const value = document.getElementById('bgOpacityValue');
    if (slider && value) {
        slider.value = 100;
        value.textContent = '100%';
    }
    applyBgOpacity(100);

    applyFeaturedMode('story');
    const storyRadio = document.querySelector('input[name="featuredMode"][value="story"]');
    if (storyRadio) storyRadio.checked = true;
}

// Load saved colors and background on page load
window.addEventListener('load', () => {
    const savedHeader = localStorage.getItem('headerColor');
    const savedTicker = localStorage.getItem('tickerColor');
    const savedPageImage = localStorage.getItem('pageBackgroundImage');
    const savedPageColor = localStorage.getItem('pageBackgroundColor');

    if (savedHeader) {
        document.querySelector('header').style.background = savedHeader;
        const picker = document.getElementById('headerColorPicker');
        if (picker) picker.value = savedHeader;
    }

    if (savedTicker) {
        document.querySelector('.ticker-container').style.background = savedTicker;
        const picker = document.getElementById('tickerColorPicker');
        if (picker) picker.value = savedTicker;
    }

    if (savedPageImage) {
        document.body.style.background = `url('${savedPageImage}') center center fixed`;
        document.body.style.backgroundSize = 'cover';
    } else if (savedPageColor) {
        document.body.style.background = savedPageColor;
        document.body.style.backgroundImage = 'none';
        const picker = document.getElementById('bgColor');
        if (picker) picker.value = savedPageColor;
    } else {
        document.body.style.background = "url('images/Community.png') center center fixed";
        document.body.style.backgroundSize = 'cover';
    }

    linkColorsEnabled = localStorage.getItem('linkColorsEnabled') === 'true';
    const checkbox = document.getElementById('linkColors');
    if (checkbox) checkbox.checked = linkColorsEnabled;

    loadBgOpacity();

    // Load featured mode preference
    const savedMode = localStorage.getItem('featuredMode') || 'story';
    const modeRadio = document.querySelector(`input[name="featuredMode"][value="${savedMode}"]`);
    if (modeRadio) modeRadio.checked = true;
    applyFeaturedMode(savedMode);
});

function saveProfile() {
    const user = auth.currentUser;
    if (!user) return;

    const updates = {
        displayName: document.getElementById('editName').value.trim() || "Friend",
        ostomyType: document.getElementById('editOstomyType').value,
        surgeryDate: document.getElementById('editSurgeryDate').value,
        bio: document.getElementById('editBio').value.trim(),
        showOstomyType: document.getElementById('showOstomyType').checked,
        showSurgeryDate: document.getElementById('showSurgeryDate').checked,
        showBio: document.getElementById('showBio').checked
    };

    const avatarInput = document.getElementById('avatarInput');
    if (avatarInput && avatarInput.files[0]) {
        const file = avatarInput.files[0];
        const ref = storage.ref(`avatars/${user.uid}`);
        ref.put(file).then(snapshot => {
            snapshot.ref.getDownloadURL().then(url => {
                updates.photoURL = url;
                saveToFirestore(updates);
            });
        });
    } else {
        saveToFirestore(updates);
    }

    function saveToFirestore(data) {
        db.collection('users').doc(user.uid).set(data, { merge: true })
            .then(() => {
                document.getElementById('profileModal').classList.remove('open');
                loadUserProfile(user);
            });
    }
}

// === TEMPERATURE TOGGLE ===
const toggleInput = document.getElementById('tempUnitToggle');
const toggleSwitch = document.getElementById('tempToggleSwitch');
const toggleKnob = document.getElementById('tempToggleKnob');

function updateToggleVisual(isCelsius) {
    if (isCelsius) {
        toggleSwitch.style.background = '#fff8e1';
        toggleKnob.style.left = '38px';
        toggleKnob.style.background = '#8B572A';
    } else {
        toggleSwitch.style.background = '#ccc';
        toggleKnob.style.left = '4px';
        toggleKnob.style.background = 'white';
    }
}

function loadTempPreference() {
    if (!auth.currentUser) return;
    db.collection('users').doc(auth.currentUser.uid).get().then(doc => {
        const isCelsius = doc.exists && doc.data()?.tempUnit === 'c';
        toggleInput.checked = isCelsius;
        updateToggleVisual(isCelsius);
    });
}

if (toggleSwitch && toggleInput) {
    toggleSwitch.addEventListener('click', () => toggleInput.click());
    document.querySelector('label[for="tempUnitToggle"]')?.addEventListener('click', (e) => {
        e.preventDefault();
        toggleInput.click();
    });

    toggleInput.addEventListener('change', function() {
        const newUnit = this.checked ? 'c' : 'f';
        updateToggleVisual(this.checked);

        db.collection('users').doc(auth.currentUser.uid)
            .update({ tempUnit: newUnit })
            .then(() => loadWeather())
            .catch(err => {
                console.error("Failed to save temp unit:", err);
                this.checked = !this.checked;
                updateToggleVisual(this.checked);
            });
    });

    const settingsModal = document.getElementById('settingsModal');
    if (settingsModal) {
        const observer = new MutationObserver(() => {
            if (settingsModal.classList.contains('open')) {
                loadTempPreference();
            }
        });
        observer.observe(settingsModal, { attributes: true, attributeFilter: ['class'] });
    }
}

// Load visibility checkboxes when modal opens
function loadProfileVisibility() {
    const user = auth.currentUser;
    if (!user) return;

    db.collection('users').doc(user.uid).get().then(doc => {
        const data = doc.data() || {};
        document.getElementById('editOstomyType').value = data.ostomyType || '';
        document.getElementById('editName').value = data.displayName || '';
        document.getElementById('editSurgeryDate').value = data.surgeryDate || '';
        document.getElementById('editBio').value = data.bio || '';

        document.getElementById('showOstomyType').checked = data.showOstomyType !== false;
        document.getElementById('showSurgeryDate').checked = data.showSurgeryDate !== false;
        document.getElementById('showBio').checked = data.showBio !== false;
    });
}

// Call when opening the modal
function openProfileModal() {
    document.getElementById('profileModal').classList.add('open');
    loadProfileVisibility();
}

// === FEATURED MODE TOGGLE (Story vs Inbox) ===
document.querySelectorAll('input[name="featuredMode"]').forEach(radio => {
    radio.addEventListener('change', function() {
        const mode = this.value;
        localStorage.setItem('featuredMode', mode);
        applyFeaturedMode(mode);
    });
});

// Apply featured mode
// ...existing code...

// Apply featured mode
function applyFeaturedMode(mode) {
    const box = document.getElementById('featured-story-box');
    if (!box) return;

    box.classList.remove('inbox-mode');

    if (mode === 'inbox') {
        box.classList.add('inbox-mode');
        box.style.backgroundImage = 'none';
        box.style.background = 'linear-gradient(135deg, rgba(139,87,42,0.08) 0%, rgba(166,124,82,0.04) 100%)';
        box.style.padding = '0';
        
        box.innerHTML = `
            <div class="inbox-inline" style="display:flex;height:100%;flex-direction:row;border-radius:30px;overflow:hidden;">
                <div class="inbox-left" style="width:40%;background:#8B572A;color:#fff8e1;padding:15px;overflow-y:auto;">
                    <h2 style="text-align:center;margin-bottom:15px;font-size:1.8rem;">Your Messages</h2>
                    <div id="inboxConversationList" style="max-height:calc(100% - 60px);overflow-y:auto;">
                        <p style="text-align:center;color:#ffecb3;opacity:0.8;margin:40px 0;">Loading conversations...</p>
                    </div>
                </div>

                <div class="inbox-right" style="width:60%;display:flex;flex-direction:column;background:#f9f5f0;">
                    <div id="inboxSelectedHeader" style="padding:20px;background:#8B572A;color:#fff8e1;text-align:center;font-size:1.4rem;font-weight:bold;">
                        Select a conversation
                    </div>
                    <div id="inboxMessages" style="flex:1;overflow-y:auto;padding:15px 20px;font-size:1rem;line-height:1.5;">
                    </div>
                    <div id="inboxInputArea" style="padding:15px;background:#fff;border-top:2px solid #8B572A;">
                        <div style="display:flex;gap:10px;">
                            <input type="text" id="inboxMessageInput" placeholder="Type a message..." 
                                   style="flex:1;padding:12px;border-radius:30px;border:2px solid #8B572A;outline:none;font-size:1rem;">
                            <button onclick="sendInboxMessage()" 
                                    style="background:#8B572A;color:#fff8e1;padding:12px 24px;border:none;border-radius:30px;font-weight:bold;font-size:1rem;cursor:pointer;">
                                Send
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Wait for auth to be ready, then load conversations
        const loadInboxConversations = () => {
            const user = auth.currentUser;
            const list = document.getElementById('inboxConversationList');
            
            if (!user) {
                // Auth not ready yet, wait for it
                const unsubscribe = auth.onAuthStateChanged(authUser => {
                    if (authUser) {
                        unsubscribe();
                        loadInboxConversations(); // Try again
                    } else if (list) {
                        list.innerHTML = '<p style="text-align:center;color:#ffecb3;opacity:0.8;margin:40px 0;">Please log in to view messages</p>';
                    }
                });
                return;
            }

            if (!list) return;

            // User is logged in, load conversations
            db.collection('conversations')
                .where('participants', 'array-contains', user.uid)
                .onSnapshot(snapshot => {
                    list.innerHTML = '';
                    
                    if (snapshot.empty) {
                        // Also check for privateChats collection as fallback
                        db.collection('privateChats')
                            .where('participants', 'array-contains', user.uid)
                            .get()
                            .then(privateChatSnap => {
                                if (privateChatSnap.empty) {
                                    list.innerHTML = '<p style="text-align:center;color:#ffecb3;opacity:0.8;margin:40px 0;">No conversations yet</p>';
                                } else {
                                    // Handle privateChats collection
                                    const chats = [];
                                    privateChatSnap.forEach(doc => {
                                        const data = doc.data();
                                        chats.push({ id: doc.id, ...data });
                                    });
                                    
                                    chats.sort((a, b) => {
                                        const timeA = a.lastMessageTime?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
                                        const timeB = b.lastMessageTime?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
                                        return timeB - timeA;
                                    });
                                    
                                    chats.forEach(chat => {
                                        const otherUserId = chat.participants?.find(p => p !== user.uid);
                                        if (!otherUserId) return;
                                        
                                        // Fetch other user's name
                                        db.collection('users').doc(otherUserId).get().then(userDoc => {
                                            const userData = userDoc.exists ? userDoc.data() : {};
                                            const otherName = userData.displayName || otherUserId;
                                            const photoURL = userData.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUserId}`;
                                            
                                            const div = document.createElement('div');
                                            div.style = 'padding:12px;border-bottom:1px solid rgba(255,255,255,0.2);cursor:pointer;transition:background 0.2s;';
                                            div.innerHTML = `<strong>${otherName}</strong><p style="font-size:0.9rem;opacity:0.8;margin:4px 0 0 0;">${chat.lastMessage || 'No messages yet'}</p>`;
                                            div.onmouseover = () => div.style.background = 'rgba(255,255,255,0.1)';
                                            div.onmouseout = () => div.style.background = 'transparent';
                                            div.onclick = () => openInboxConversation(chat.id, otherName, otherUserId, photoURL);
                                            list.appendChild(div);
                                        });
                                    });
                                }
                            });
                        return;
                    }
                    
                    // Handle conversations collection
                    const conversations = [];
                    snapshot.forEach(doc => {
                        const conv = doc.data();
                        conversations.push({ id: doc.id, ...conv });
                    });
                    
                    // Sort manually by lastMessageTime
                    conversations.sort((a, b) => {
                        const timeA = a.lastMessageTime?.toMillis?.() || 0;
                        const timeB = b.lastMessageTime?.toMillis?.() || 0;
                        return timeB - timeA;
                    });
                    
                    conversations.forEach(conv => {
                        const otherUserId = conv.participants?.find(p => p !== user.uid);
                        const otherName = conv.participantNames?.find(n => n !== (currentUserProfile?.displayName || user.email?.split('@')[0])) || 'Unknown';
                        
                        const div = document.createElement('div');
                        div.style = 'padding:12px;border-bottom:1px solid rgba(255,255,255,0.2);cursor:pointer;transition:background 0.2s;';
                        div.innerHTML = `<strong>${otherName}</strong><p style="font-size:0.9rem;opacity:0.8;margin:4px 0 0 0;">${conv.lastMessage || 'No messages yet'}</p>`;
                        div.onmouseover = () => div.style.background = 'rgba(255,255,255,0.1)';
                        div.onmouseout = () => div.style.background = 'transparent';
                        div.onclick = () => openInboxConversation(conv.id, otherName, otherUserId);
                        list.appendChild(div);
                    });
                }, err => {
                    console.error('Error loading conversations:', err);
                    list.innerHTML = '<p style="text-align:center;color:#ffecb3;opacity:0.8;margin:40px 0;">Error loading conversations</p>';
                });
        };
        
        // Call the function after a brief delay
        setTimeout(loadInboxConversations, 200);
        
    } else {
        box.style.padding = '12px';
        box.innerHTML = `
            <a href="https://www.facebook.com/photo/?fbid=122276974778016943&set=a.122122393778016943"
               class="featured-story__link" target="_blank" rel="noopener noreferrer"
               aria-label="Read Derek's story">
                <div class="featured-story__image" style="background-image: url('images/derek.jpg');"></div>
                <div class="featured-story__overlay">
                    <h3 class="featured-story__title">Featured Story / Interviews</h3>
                    <p class="featured-story__excerpt" style="font-size: 3.5rem;">
                       Military veteran Derek Rutherford faced a life-changing moment when diagnosed with colorectal cancer in 2019, leading to ostomy surgery. Initially, he felt shock and disbelief, but today, he embraces life with a permanent stoma, finding freedom he never imagined.
                    </p>
                    <span class="featured-story__cta">Read Derek's story</span>
                </div>
            </a>
        `;
    }
}



// Helper function to open a conversation
function openInboxConversation(convId, otherName) {
    const header = document.getElementById('inboxSelectedHeader');
    const messages = document.getElementById('inboxMessages');
    
    if (header) header.textContent = otherName;
    if (messages) {
        messages.innerHTML = '<p style="text-align:center;color:#666;margin:40px 0;">Loading messages...</p>';
        
        db.collection('conversations').doc(convId).collection('messages')
            .orderBy('timestamp', 'asc')
            .onSnapshot(snapshot => {
                messages.innerHTML = '';
                snapshot.forEach(doc => {
                    const msg = doc.data();
                    const isMe = msg.senderId === auth.currentUser.uid;
                    const div = document.createElement('div');
                    div.style = `margin:8px 0;text-align:${isMe ? 'right' : 'left'};`;
                    div.innerHTML = `
                        <div style="display:inline-block;max-width:70%;padding:10px 14px;border-radius:18px;background:${isMe ? '#8B572A' : '#e0e0e0'};color:${isMe ? '#fff' : '#000'};">
                            ${msg.text}
                        </div>
                    `;
                    messages.appendChild(div);
                });
                messages.scrollTop = messages.scrollHeight;
            });
    }
    
    window.currentInboxConversation = convId;
}

// Helper function to send message
function sendInboxMessage() {
    const input = document.getElementById('inboxMessageInput');
    const text = input?.value.trim();
    
    if (!text || !window.currentInboxConversation) return;
    
    const user = auth.currentUser;
    if (!user) return alert('Please log in');
    
    db.collection('conversations').doc(window.currentInboxConversation).collection('messages').add({
        text: text,
        senderId: user.uid,
        senderName: currentUserProfile?.displayName || user.email.split('@')[0],
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        input.value = '';
        db.collection('conversations').doc(window.currentInboxConversation).update({
            lastMessage: text,
            lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
        });
    }).catch(err => console.error('Error sending message:', err));
}
// Update openInboxConversation to handle both collection types
function openInboxConversation(convId, otherName, otherUserId, photoURL) {
    const header = document.getElementById('inboxSelectedHeader');
    const messages = document.getElementById('inboxMessages');
    
    if (header) header.textContent = otherName;
    if (messages) {
        messages.innerHTML = '<p style="text-align:center;color:#666;margin:40px 0;">Loading messages...</p>';
        
        // Try conversations collection first
        db.collection('conversations').doc(convId).collection('messages')
            .orderBy('timestamp', 'asc')
            .onSnapshot(snapshot => {
                if (snapshot.empty && otherUserId) {
                    // Fallback to privateChats collection
                    db.collection('privateChats').doc(convId).collection('messages')
                        .orderBy('createdAt', 'asc')
                        .onSnapshot(privateChatSnap => {
                            messages.innerHTML = '';
                            if (privateChatSnap.empty) {
                                messages.innerHTML = '<p style="text-align:center;color:#666;margin:40px 0;">No messages yet. Start the conversation!</p>';
                                return;
                            }
                            privateChatSnap.forEach(doc => {
                                const msg = doc.data();
                                const isMe = msg.senderId === auth.currentUser.uid;
                                const div = document.createElement('div');
                                div.style = `margin:8px 0;text-align:${isMe ? 'right' : 'left'};`;
                                div.innerHTML = `
                                    <div style="display:inline-block;max-width:70%;padding:10px 14px;border-radius:18px;background:${isMe ? '#8B572A' : '#e0e0e0'};color:${isMe ? '#fff' : '#000'};">
                                        ${msg.text || msg.message || ''}
                                    </div>
                                `;
                                messages.appendChild(div);
                            });
                            messages.scrollTop = messages.scrollHeight;
                        });
                    return;
                }
                
                messages.innerHTML = '';
                if (snapshot.empty) {
                    messages.innerHTML = '<p style="text-align:center;color:#666;margin:40px 0;">No messages yet. Start the conversation!</p>';
                    return;
                }
                
                snapshot.forEach(doc => {
                    const msg = doc.data();
                    const isMe = msg.senderId === auth.currentUser.uid;
                    const div = document.createElement('div');
                    div.style = `margin:8px 0;text-align:${isMe ? 'right' : 'left'};`;
                    div.innerHTML = `
                        <div style="display:inline-block;max-width:70%;padding:10px 14px;border-radius:18px;background:${isMe ? '#8B572A' : '#e0e0e0'};color:${isMe ? '#fff' : '#000'};">
                            ${msg.text || msg.message || ''}
                        </div>
                    `;
                    messages.appendChild(div);
                });
                messages.scrollTop = messages.scrollHeight;
            });
    }
    
    window.currentInboxConversation = convId;
    window.currentInboxPartnerId = otherUserId;
}