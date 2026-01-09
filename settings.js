// settings.js — COMPLETE & FIXED (color linking, persistence, temp toggle, profile save with visibility checkboxes, background opacity)

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
            applyBgOpacity(localStorage.getItem('bgOpacity') || '100');  // Re-apply opacity
        });
    }).catch(err => alert("Upload failed: " + err.message));
}

// Background opacity control
function applyBgOpacity(opacityPercent) {
    const opacity = opacityPercent / 100;
    // Use a pseudo-element overlay for fade (keeps content readable)
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

// Load saved opacity and apply
(function loadBgOpacity() {
    const saved = localStorage.getItem('bgOpacity') || '100';
    applyBgOpacity(saved);

    const slider = document.getElementById('bgOpacitySlider');
    const value = document.getElementById('bgOpacityValue');
    if (slider && value) {
        slider.value = saved;
        value.textContent = saved + '%';
    }
})();

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

    // Remove overlay
    const overlay = document.getElementById('bgOpacityOverlay');
    if (overlay) overlay.remove();

    const headerPicker = document.getElementById('headerColorPicker');
    const tickerPicker = document.getElementById('tickerColorPicker');
    const bgPicker = document.getElementById('bgColor');
    if (headerPicker) headerPicker.value = defaultColor;
    if (tickerPicker) tickerPicker.value = defaultColor;
    if (bgPicker) bgPicker.value = defaultColor;

    // Clear saved values
    localStorage.removeItem('headerColor');
    localStorage.removeItem('tickerColor');
    localStorage.removeItem('pageBackgroundColor');
    localStorage.removeItem('pageBackgroundImage');
    localStorage.removeItem('linkColorsEnabled');
    localStorage.removeItem('bgOpacity');

    linkColorsEnabled = false;
    const checkbox = document.getElementById('linkColors');
    if (checkbox) checkbox.checked = false;

    // Reset slider
    const slider = document.getElementById('bgOpacitySlider');
    const value = document.getElementById('bgOpacityValue');
    if (slider && value) {
        slider.value = 100;
        value.textContent = '100%';
    }
    applyBgOpacity(100);
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

    // Apply saved opacity
    loadBgOpacity();
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
// Save featured mode preference
document.querySelectorAll('input[name="featuredMode"]').forEach(radio => {
  radio.addEventListener('change', function() {
    const mode = this.value;
    localStorage.setItem('featuredMode', mode);
    applyFeaturedMode(mode);
  });
});

// Apply the mode (call this on page load and when setting changes)
function applyFeaturedMode(mode) {
  const storyBox = document.getElementById('featured-story-box');
  if (!storyBox) return;

  if (mode === 'inbox') {
    storyBox.innerHTML = `
      <h2 style="text-align:center;margin:20px 0;">Recent Messages</h2>
      <div style="text-align:center;color:#666;">
        <p>Click <strong>Messages</strong> in the menu to view full inbox</p>
        <button onclick="openMessagesInbox()" style="margin-top:15px;padding:12px 24px;background:#8B572A;color:#fff;border:none;border-radius:30px;cursor:pointer;">
          Open Messages
        </button>
      </div>
    `;
  } else {
    // Restore original Featured Story content
    storyBox.innerHTML = `
      <a href="https://www.facebook.com/nagae.line/posts/pfbid0qurhYsYYwM9Gs4qacs5bhA7eisWVW78oykmFsJjaRPi6kYbKfUWri6CeKyxaAxSnl"
         class="featured-story__link" target="_blank" rel="noopener noreferrer"
         aria-label="Read Marie's story on Facebook">
        <div class="featured-story__overlay">
          <h3 class="featured-story__title">Marie’s Story</h3>
          <p class="featured-story__excerpt">
            Marie learned to manage her ostomy after a long journey of trial and error. She shares practical tips, emotional moments, and the one product that changed everything for her—helpful for anyone starting the same path. Her story covers the early recovery, adapting daily routines, and the supportive community that helped her regain confidence.
          </p>
          <span class="featured-story__cta">Read Marie's story</span>
        </div>
      </a>
    `;
  }
}

// Load saved preference on page load
window.addEventListener('load', () => {
  const savedMode = localStorage.getItem('featuredMode') || 'story';
  document.querySelector(`input[name="featuredMode"][value="${savedMode}"]`).checked = true;
  applyFeaturedMode(savedMode);
});

// Reset also clears the mode
function resetAllColors() {
  // ... your existing reset code ...
  localStorage.removeItem('featuredMode');
  applyFeaturedMode('story');
  document.querySelector('input[name="featuredMode"][value="story"]').checked = true;
}
function applyFeaturedMode(mode) {
  const box = document.getElementById('featured-story-box');
  if (!box) return;

  if (mode === 'inbox') {
    // Replace with inline Messages Inbox
    box.innerHTML = `
      <div style="display:flex;height:100%;flex-direction:row;background:#fff8e1;border-radius:30px;overflow:hidden;">
        <!-- Left: Conversation List -->
        <div style="width:40%;background:#8B572A;color:#fff8e1;padding:15px;overflow-y:auto;">
          <h2 style="text-align:center;margin-bottom:15px;font-size:1.8rem;">Your Messages</h2>
          <div id="inboxConversationList" style="max-height:calc(100% - 60px);overflow-y:auto;">
            <p style="text-align:center;color:#ffecb3;opacity:0.8;margin:40px 0;">Loading conversations...</p>
          </div>
        </div>

        <!-- Right: Selected Chat -->
        <div style="width:60%;display:flex;flex-direction:column;">
          <div style="padding:40px 20px 10px;background:#8B572A;color:#fff8e1;text-align:center;font-size:1.4rem;font-weight:bold;" id="inboxSelectedHeader">
            Select a conversation
          </div>
          <div id="inboxMessages" style="flex:1;overflow-y:auto;padding:15px 20px;background:#f9f5f0;font-size:1rem;line-height:1.5;">
            <!-- Messages load here -->
          </div>
          <div id="inboxInputArea" style="padding:15px;background:#fff;border-top:2px solid #8B572A;">
            <div style="display:flex;gap:10px;">
              <input type="text" id="inboxMessageInput" placeholder="Type a message..." style="flex:1;padding:12px;border-radius:30px;border:2px solid #8B572A;outline:none;font-size:1rem;">
              <button onclick="sendInboxMessage()" style="background:#8B572A;color:#fff8e1;padding:12px 24px;border:none;border-radius:30px;font-weight:bold;font-size:1rem;cursor:pointer;">Send</button>
            </div>
          </div>
        </div>
      </div>
    `;
    // Load conversations (call your existing load function)
    loadConversationList();  // Assume this exists in chat.js or ui.js
  } else {
    // Restore Featured Story
    box.innerHTML = `
      <a href="https://www.facebook.com/nagae.line/posts/pfbid0qurhYsYYwM9Gs4qacs5bhA7eisWVW78oykmFsJjaRPi6kYbKfUWri6CeKyxaAxSnl"
         class="featured-story__link" target="_blank" rel="noopener noreferrer"
         aria-label="Read Marie's story on Facebook">
        <div class="featured-story__overlay">
          <h3 class="featured-story__title">Marie’s Story</h3>
          <p class="featured-story__excerpt">
            Marie learned to manage her ostomy after a long journey of trial and error. She shares practical tips, emotional moments, and the one product that changed everything for her—helpful for anyone starting the same path. Her story covers the early recovery, adapting daily routines, and the supportive community that helped her regain confidence.
          </p>
          <span class="featured-story__cta">Read Marie's story</span>
        </div>
      </a>
    `;
  }
}

// Load saved mode on page load
window.addEventListener('load', () => {
  const savedMode = localStorage.getItem('featuredMode') || 'story';
  document.querySelector(`input[name="featuredMode"][value="${savedMode}"]`).checked = true;
  applyFeaturedMode(savedMode);
});

// Save on radio change
document.querySelectorAll('input[name="featuredMode"]').forEach(radio => {
  radio.addEventListener('change', function() {
    const mode = this.value;
    localStorage.setItem('featuredMode', mode);
    applyFeaturedMode(mode);
  });
});

// Reset clears mode
function resetAllColors() {
  // ... your existing reset ...
  localStorage.removeItem('featuredMode');
  applyFeaturedMode('story');
  document.querySelector('input[name="featuredMode"][value="story"]').checked = true;
}
