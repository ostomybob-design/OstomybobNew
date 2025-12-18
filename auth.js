// auth.js
let currentUserProfile = { displayName: "Friend", photoURL: null };

function applyBackground(type, value) {
    if (type === 'image' && value) {
        document.body.style.background = `url('${value}') center center fixed`;
        document.body.style.backgroundSize = 'cover';
    } else if (type === 'color' && value) {
        document.body.style.background = value;
        document.body.style.backgroundImage = 'none';
    } else {
        document.body.style.background = "url('images/Community.png') center center fixed";
        document.body.style.backgroundSize = 'cover';
    }
}

function loadWeather() {
    const weatherDisplay = document.getElementById('weather-display');
    if (!navigator.geolocation) {
        weatherDisplay.innerHTML = "Location unavailable";
        return;
    }

    navigator.geolocation.getCurrentPosition(async pos => {
        const { latitude: lat, longitude: lon } = pos.coords;
        try {
            const unit = (await db.collection('users').doc(auth.currentUser?.uid).get()).data()?.tempUnit || 'f';
            const tempUnit = unit === 'c' ? 'celsius' : 'fahrenheit';
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode,windspeed_10m,relative_humidity_2m&hourly=temperature_2m&temperature_unit=${tempUnit}&wind_speed_unit=mph&timezone=auto`);
            const data = await res.json();

            const current = data.current;
            const temp = Math.round(current.temperature_2m);
            const wind = Math.round(current.windspeed_10m);
            const hum = current.relative_humidity_2m;
            const cond = {0:"Clear",1:"Mostly Clear",2:"Partly Cloudy",3:"Cloudy",45:"Fog",51:"Drizzle",61:"Rain",71:"Snow",95:"Storm"}[current.weathercode] || "Cloudy";

            const now = new Date();
            const today = now.toISOString().split('T')[0];
            const hourly = data.hourly.time.map((t, i) => ({ time: t, temp: Math.round(data.hourly.temperature_2m[i]) }));

            const times = ['06:00', '12:00', '18:00', '00:00'];
            const labels = ['6am', '12pm', '6pm', 'Midnight'];
            const temps = [];

            times.forEach((time, idx) => {
                const fullTime = `${today}T${time}`;
                const entry = hourly.find(h => h.time.includes(fullTime));
                temps.push(entry ? entry.temp : '--');
            });

  weatherDisplay.innerHTML = `
    <div style="text-align:right;color:#fff8e1;line-height:1.45;font-size:0.95rem;">
        <div style="font-size:1.85rem;font-weight:bold;">${temp}°${unit.toUpperCase()} ${cond}</div>
        <div style="opacity:0.85;">${wind} mph • ${hum}% humidity</div>
        <div style="margin-top:2px;font-size:0.9rem;opacity:0.9;">
            <div style="display:flex;justify-content:flex-end;gap:20px;margin:4px 0;">
                <span>${labels[0]}: ${temps[0]}°</span>
                <span>${labels[1]}: ${temps[1]}°</span>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:20px;margin:4px 0;">
                <span>${labels[2]}: ${temps[2]}°</span>
                <span>${labels[3]}: ${temps[3]}°</span>
            </div>
        </div>
    </div>
`;
        } catch (err) {
            console.error(err);
            weatherDisplay.innerHTML = "Weather unavailable";
        }
    }, () => weatherDisplay.innerHTML = "Location denied");
}



function loadUserProfile(user) {
    db.collection('users').doc(user.uid).get().then(doc => {
        const data = doc.exists ? doc.data() : {};
        currentUserProfile.displayName = data.displayName || user.email.split('@')[0];
        currentUserProfile.photoURL = data.photoURL || null;

        document.getElementById('menuName').textContent = currentUserProfile.displayName;
        const avatar = currentUserProfile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`;
        document.getElementById('menuAvatar').src = avatar;
       const editAvatar = document.getElementById('currentAvatar');
if (editAvatar) editAvatar.src = avatar;

        // Fixed — null check
        const tempSelect = document.getElementById('tempUnit');
        if (tempSelect) tempSelect.value = data.tempUnit || 'f';

        //applyBackground(data.backgroundType || 'default', data.backgroundValue || null);
    });
}



    
auth.onAuthStateChanged(user => {
    const loginModal = document.getElementById('loginModal');
    if (user) {
        loginModal.classList.remove('open');
        document.getElementById('loginMenu').style.display = 'none';
        document.getElementById('userMenu').style.display = 'block';
        loadUserProfile(user);
        loadWeather();
        loadThreads();
        startMessageListener();
        // startMessageListener(); // REMOVE from here if it's outside
    } else {
        loginModal.classList.add('open');
        document.getElementById('loginMenu').style.display = 'block';
        document.getElementById('userMenu').style.display = 'none';

        // Delegate badge/UI clearing to notifications module if present
        if (window._notif_markAsSeen && typeof window._notif_markAsSeen === 'function') {
            // mark seen now so badge is cleared and localStorage is updated
            window._notif_markAsSeen(Date.now());
        } else {
            // fallback
            unreadCount = 0;
            const badgeEl = document.getElementById('notificationBadge');
            if (badgeEl) badgeEl.style.display = 'none';
            localStorage.setItem('notificationLastSeen', String(Date.now()));
        }

        // Safely unsubscribe from the message listener on logout
        if (messageListenerUnsubscribe) {
            try { messageListenerUnsubscribe(); } catch (e) {}
            messageListenerUnsubscribe = null;
        }
    }
});

// Login toggle & button
let isSignUp = false;
document.getElementById('toggleLink')?.addEventListener('click', e => {
    e.preventDefault();
    isSignUp = !isSignUp;
    document.getElementById('modalTitle').textContent = isSignUp ? "Join Ostomy Friends Hub!" : "Welcome Back!";
    document.getElementById('authBtn').textContent = isSignUp ? "Create Account" : "Sign In";
    document.getElementById('profileFields').style.display = isSignUp ? "block" : "none";
});

document.getElementById('authBtn')?.addEventListener('click', () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    if (!email || !password) return alert("Please fill in email and password");

    if (isSignUp) {
        auth.createUserWithEmailAndPassword(email, password)
            .then(cred => db.collection('users').doc(cred.user.uid).set({
                displayName: document.getElementById('displayName').value || "Friend",
                ostomyType: document.getElementById('ostomyType').value || "",
                surgeryDate: document.getElementById('surgeryDate').value || "",
                bio: ""
            }))
            .then(() => loginModal.classList.remove('open'))
            .catch(err => alert(err.message));
    } else {
        auth.signInWithEmailAndPassword(email, password)
            .then(() => loginModal.classList.remove('open'))
            .catch(err => alert(err.message));
    }
});

// Update lastActive on any activity
function updateLastActive() {
    if (auth.currentUser) {
        db.collection('users').doc(auth.currentUser.uid).update({
            lastActive: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(() => {}); // silent
    }
}

// Update every 30 seconds when page is visible
setInterval(() => {
    if (document.visibilityState === 'visible') updateLastActive();
}, 30000);

// Also update on load and mouse move
window.addEventListener('load', updateLastActive);
window.addEventListener('mousemove', updateLastActive);
window.addEventListener('click', updateLastActive);