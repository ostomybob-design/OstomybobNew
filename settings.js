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

    const savedMode = localStorage.getItem('featuredMode') || 'story';
    const modeRadio = document.querySelector(`input[name="featuredMode"][value="${savedMode}"]`);
    if (modeRadio) modeRadio.checked = true;
    
    setTimeout(() => {
        applyFeaturedMode(savedMode);
    }, 100);
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

function openProfileModal() {
    document.getElementById('profileModal').classList.add('open');
    loadProfileVisibility();
}

document.querySelectorAll('input[name="featuredMode"]').forEach(radio => {
    radio.addEventListener('change', function() {
        const mode = this.value;
        localStorage.setItem('featuredMode', mode);
        applyFeaturedMode(mode);
    });
});

function applyFeaturedMode(mode) {
    const box = document.getElementById('featured-story-box');
    if (!box) return;

    let inboxContainer = document.getElementById('settings-inbox-container');
    
    if (!inboxContainer) {
        inboxContainer = document.createElement('div');
        inboxContainer.id = 'settings-inbox-container';
        inboxContainer.style.position = 'absolute';
        inboxContainer.style.top = '0';
        inboxContainer.style.left = '0';
        inboxContainer.style.width = '100%';
        inboxContainer.style.height = '100%';
        inboxContainer.style.borderRadius = '30px';
        inboxContainer.style.overflow = 'hidden';
        inboxContainer.style.display = 'none';
        inboxContainer.style.background = '#fff';
        
        inboxContainer.innerHTML = `
            <div style="display:flex;height:100%;width:100%;">
                <div style="width:35%;background:#8B572A;color:#fff8e1;display:flex;flex-direction:column;border-right:2px solid rgba(0,0,0,0.1);">
                    <h2 style="text-align:center;padding:20px;margin:0;border-bottom:2px solid rgba(255,255,255,0.2);font-size:1.5rem;">Your Messages</h2>
                    <div id="settings-conversationList" style="flex:1;overflow-y:auto;"></div>
                </div>
                <div style="width:65%;display:flex;flex-direction:column;background:#f9f5f0;">
                    <div id="settings-conversationHeader" style="padding:20px;background:#8B572A;color:#fff8e1;text-align:center;font-size:1.3rem;font-weight:bold;border-bottom:2px solid rgba(0,0,0,0.1);">
                        Select a conversation
                    </div>
                    <div id="settings-conversationMessages" style="flex:1;overflow-y:auto;padding:20px;"></div>
                    <div style="padding:15px;background:#fff;border-top:2px solid #8B572A;">
                        <div style="display:flex;gap:10px;">
                            <input type="text" id="settings-messageInput" placeholder="Type a message..." 
                                   style="flex:1;padding:12px;border-radius:25px;border:2px solid #8B572A;outline:none;font-size:1rem;">
                            <button onclick="sendSettingsMessage()" 
                                    style="background:#8B572A;color:#fff8e1;padding:12px 30px;border:none;border-radius:25px;font-weight:bold;cursor:pointer;font-size:1rem;">
                                Send
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        box.appendChild(inboxContainer);
        setTimeout(() => loadSettingsInboxConversations(), 100);
    }
    
    let storyLink = box.querySelector('.featured-story__link');
    
    if (!storyLink) {
        storyLink = document.createElement('a');
        storyLink.href = 'https://www.facebook.com/photo/?fbid=122276974778016943&set=a.122122393778016943';
        storyLink.className = 'featured-story__link';
        storyLink.target = '_blank';
        storyLink.rel = 'noopener noreferrer';
        storyLink.innerHTML = `
            <div class="featured-story__image" style="background-image: url('images/derek.jpg');"></div>
            <div class="featured-story__overlay">
                <h3 class="featured-story__title">Featured Story</h3>
                <p class="featured-story__excerpt" style="font-size: 3.5rem;">
                   Military veteran Derek Rutherford faced a life-changing moment when diagnosed with colorectal cancer in 2019...
                </p>
                <span class="featured-story__cta">Read Derek's story</span>
            </div>
        `;
        box.appendChild(storyLink);
    }
    
    if (mode === 'inbox') {
        inboxContainer.style.display = 'block';
        storyLink.style.display = 'none';
        box.classList.add('inbox-mode');
        box.style.backgroundImage = 'none';
        box.style.background = 'transparent';
        box.style.padding = '0';
    } else {
        inboxContainer.style.display = 'none';
        storyLink.style.display = 'block';
        box.classList.remove('inbox-mode');
        box.style.padding = '12px';
    }
}

// Replace loadSettingsInboxConversations function (around line 429):
function loadSettingsInboxConversations() {
    const user = auth.currentUser;
    const conversationList = document.getElementById('settings-conversationList');
    
    if (!user) {
        const unsubscribe = auth.onAuthStateChanged(authUser => {
            if (authUser) {
                unsubscribe();
                loadSettingsInboxConversations();
            }
        });
        return;
    }
    
    if (!conversationList) return;

    console.log('Loading settings inbox conversations for user:', user.uid);

    // Query the messages subcollection (where actual data lives)
    db.collectionGroup('messages')
        .where('participants', 'array-contains', user.uid)
        .onSnapshot(snapshot => {
            console.log('Settings inbox messages snapshot:', snapshot.size, 'total messages');
            
            const conversations = new Map();
            
            snapshot.forEach(doc => {
                const data = doc.data();
                const otherUserId = data.participants?.find(p => p !== user.uid);
                
                if (!otherUserId) return;
                
                const msgTime = data.timestamp?.toMillis?.() || data.createdAt?.toMillis?.() || 
                               data.timestamp?.seconds * 1000 || data.createdAt?.seconds * 1000 || 0;
                const existing = conversations.get(otherUserId);
                const existingTime = existing ? (existing.timestamp?.toMillis?.() || existing.timestamp?.seconds * 1000 || 0) : 0;
                
                // Keep only the most recent message per conversation
                if (!existing || msgTime > existingTime) {
                    conversations.set(otherUserId, {
                        otherUserId: otherUserId,
                        lastMessage: data.text,
                        timestamp: data.timestamp || data.createdAt,
                        chatPath: doc.ref.parent.parent.path
                    });
                }
            });
            
            console.log('Total unique conversations:', conversations.size);
            
            // Display conversations
            conversationList.innerHTML = '';
            
            if (conversations.size === 0) {
                conversationList.innerHTML = '<p style="text-align:center;padding:40px;opacity:0.8;font-size:1rem;">No conversations yet</p>';
                return;
            }
            
            // Sort by most recent
            const conversationsArray = Array.from(conversations.values());
            conversationsArray.sort((a, b) => {
                const timeA = a.timestamp?.toMillis?.() || a.timestamp?.seconds * 1000 || 0;
                const timeB = b.timestamp?.toMillis?.() || b.timestamp?.seconds * 1000 || 0;
                return timeB - timeA;
            });
            
            conversationsArray.forEach(conv => {
                db.collection('users').doc(conv.otherUserId).get().then(userDoc => {
                    const userData = userDoc.exists ? userDoc.data() : {};
                    const displayName = userData.displayName || 'User';
                    const photoURL = userData.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${conv.otherUserId}`;
                    
                    const conversationItem = document.createElement('div');
                    conversationItem.style.cssText = 'padding:15px;border-bottom:1px solid rgba(255,255,255,0.2);cursor:pointer;display:flex;align-items:center;gap:12px;transition:background 0.2s;';
conversationItem.innerHTML = `
    <img src="${photoURL}" alt="${displayName}" 
         style="width:50px;height:50px;border-radius:50%;object-fit:cover;border:3px solid #fff8e1;">
    <div style="flex:1;min-width:0;">
        <div style="font-weight:bold;font-size:1.1rem;margin-bottom:4px;color:#fff8e1;">${displayName}</div>
        <div style="font-size:0.9rem;color:#ffecb3;opacity:0.8;">Click to chat</div>
    </div>
`;
                    conversationItem.onmouseover = () => conversationItem.style.background = 'rgba(255,255,255,0.1)';
                    conversationItem.onmouseout = () => conversationItem.style.background = 'transparent';
                    conversationItem.onclick = () => openSettingsConversation(conv.chatPath, displayName, conv.otherUserId);
                    conversationList.appendChild(conversationItem);
                });
            });
        }, err => {
            console.error('Error loading settings inbox:', err);
            conversationList.innerHTML = `<p style="text-align:center;padding:40px;color:#ff6b6b;">Error: ${err.message}</p>`;
        });
}


// Add this variable at the TOP of the file (around line 1):
let currentSettingsListener = null;

// Replace openSettingsConversation function completely:
function openSettingsConversation(chatPath, otherName, otherUserId) {
    const header = document.getElementById('settings-conversationHeader');
    const messagesContainer = document.getElementById('settings-conversationMessages');
    
    if (header) header.textContent = otherName;
    if (!messagesContainer) return;
    
    // IMPORTANT: Detach previous listener first
    if (currentSettingsListener) {
        currentSettingsListener();
        currentSettingsListener = null;
    }
    
    messagesContainer.innerHTML = '<p style="text-align:center;padding:40px;color:#999;">Loading messages...</p>';
    
    console.log('Opening settings conversation:', chatPath, otherName);
    
    const messagesRef = db.doc(chatPath).collection('messages');
    
    // Single listener - try createdAt first (most common)
    currentSettingsListener = messagesRef.orderBy('createdAt', 'asc').onSnapshot(snapshot => {
        console.log('Messages snapshot received:', snapshot.size, 'messages');
        
        messagesContainer.innerHTML = '';
        
        if (snapshot.empty) {
            messagesContainer.innerHTML = '<p style="text-align:center;padding:40px;color:#999;">No messages yet. Start the conversation!</p>';
            return;
        }
        
        snapshot.forEach(doc => {
            const msg = doc.data();
            const isMe = msg.senderId === auth.currentUser.uid;
            
            const messageDiv = document.createElement('div');
            messageDiv.style.cssText = `margin:10px 0;text-align:${isMe ? 'right' : 'left'};`;
            messageDiv.innerHTML = `
                <div style="display:inline-block;max-width:70%;padding:12px 16px;border-radius:18px;
                            background:${isMe ? '#8B572A' : '#e0e0e0'};
                            color:${isMe ? '#fff' : '#000'};
                            font-size:1rem;line-height:1.4;word-wrap:break-word;">
                    ${msg.text}
                </div>
            `;
            messagesContainer.appendChild(messageDiv);
        });
        
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, err => {
        console.error('Error with createdAt, trying timestamp:', err);
        
        // Fallback to timestamp if createdAt fails
        currentSettingsListener = messagesRef.orderBy('timestamp', 'asc').onSnapshot(snapshot => {
            messagesContainer.innerHTML = '';
            
            if (snapshot.empty) {
                messagesContainer.innerHTML = '<p style="text-align:center;padding:40px;color:#999;">No messages yet. Start the conversation!</p>';
                return;
            }
            
            snapshot.forEach(doc => {
                const msg = doc.data();
                const isMe = msg.senderId === auth.currentUser.uid;
                
                const messageDiv = document.createElement('div');
                messageDiv.style.cssText = `margin:10px 0;text-align:${isMe ? 'right' : 'left'};`;
                messageDiv.innerHTML = `
                    <div style="display:inline-block;max-width:70%;padding:12px 16px;border-radius:18px;
                                background:${isMe ? '#8B572A' : '#e0e0e0'};
                                color:${isMe ? '#fff' : '#000'};
                                font-size:1rem;line-height:1.4;word-wrap:break-word;">
                        ${msg.text}
                    </div>
                `;
                messagesContainer.appendChild(messageDiv);
            });
            
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        });
    });
    
    window.currentSettingsChatPath = chatPath;
    window.currentSettingsPartnerId = otherUserId;
}

// Update sendSettingsMessage to match chat.js structure:
function sendSettingsMessage() {
    const input = document.getElementById('settings-messageInput');
    const text = input?.value.trim();
    
    if (!text || !window.currentSettingsPartnerId) return;
    
    const user = auth.currentUser;
    if (!user) {
        alert('Please log in to send messages');
        return;
    }
    
    // Use the SAME chatId structure as chat.js
    const chatId = [user.uid, window.currentSettingsPartnerId].sort().join('_');
    
    const messageData = {
        text: text,
        senderId: user.uid,
        senderName: currentUserProfile?.displayName || "Me",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        participants: [user.uid, window.currentSettingsPartnerId]
    };
    
    // Send to the SAME path as chat.js
    db.collection('privateChats').doc(chatId).collection('messages').add(messageData)
        .then(() => {
            input.value = '';
        })
        .catch(err => console.error('Error sending message:', err));
}
// sendSettingsMessage stays the same...

