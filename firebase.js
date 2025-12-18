const firebaseConfig = {
    apiKey: "AIzaSyA4IukxujAf3nZBpKqQvM1kmv44tBUU5eI",
    authDomain: "ostomyfriendshub.firebaseapp.com",
    projectId: "ostomyfriendshub",
    storageBucket: "ostomyfriendshub.firebasestorage.app",
    messagingSenderId: "761877119830",
    appId: "1:761877119830:web:65a6ed41e1a8113fad8cf7"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Force long-polling (workaround for QUIC/HTTP3 listen channel failures)
//db.settings({ experimentalForceLongPolling: true, merge: true });
db.settings({
  experimentalForceLongPolling: true,
  experimentalAutoDetectLongPolling: false,
  merge: true
});
const auth = firebase.auth();
const storage = firebase.storage();