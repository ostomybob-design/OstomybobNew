/**
 * backfill-add-participants.js
 *
 * Purpose:
 * - Scan all message documents (collectionGroup('messages')).
 * - For each message determine the parent chatId via doc.ref.parent.parent.id.
 * - Compute participants array = chatId.split('_').
 * - If the message document is missing participants or participants differ, update it.
 * - Ensure the parent privateChats/{chatId} document also contains participants array.
 *
 * Usage:
 * 1) Install dependencies:
 *    npm init -y
 *    npm install firebase-admin
 *
 * 2) Provide a service account JSON file (or set GOOGLE_APPLICATION_CREDENTIALS).
 *    - Put the service-account JSON in the folder as serviceAccountKey.json
 *    OR export the env var:
 *    export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json"
 *
 * 3) Run:
 *    node backfill-add-participants.js
 *
 * Notes:
 * - This script uses batching (up to 400 updates per batch) to avoid exceeding limits.
 * - Running on very large datasets may consume read/write RUs and take time.
 * - Test on a staging project first if you have production data concerns.
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const SERVICE_ACCOUNT_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, 'serviceAccountKey.json');

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error('FATAL: service account key not found at', SERVICE_ACCOUNT_PATH);
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS or place serviceAccountKey.json in the folder.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH))
});

const db = admin.firestore();

(async function main() {
  console.log('Starting backfill of participants on message docs...');

  try {
    const pageSize = 500;
    let processed = 0;
    let lastDoc = null;
    while (true) {
      let query = db.collectionGroup('messages').limit(pageSize);
      if (lastDoc) query = query.startAfter(lastDoc);
      const snap = await query.get();
      if (snap.empty) break;

      const batch = db.batch();
      let batchCount = 0;

      for (const doc of snap.docs) {
        const msgRef = doc.ref;
        const parent = msgRef.parent.parent;
        if (!parent || !parent.id) {
          console.warn('Skipping message at', msgRef.path, '- no parent chat id found');
          continue;
        }
        const chatId = parent.id;
        const participants = chatId.split('_').filter(Boolean);

        // Ensure parent chat doc has participants array
        const chatRef = db.collection('privateChats').doc(chatId);
        try {
          const chatSnap = await chatRef.get();
          if (!chatSnap.exists) {
            batch.set(chatRef, { participants }, { merge: true });
            batchCount++;
          } else {
            const chatData = chatSnap.data() || {};
            if (!Array.isArray(chatData.participants) || chatData.participants.length !== participants.length || participants.some(p => !chatData.participants.includes(p))) {
              batch.set(chatRef, { participants }, { merge: true });
              batchCount++;
            }
          }
        } catch (e) {
          console.warn('Failed to check/set privateChats doc for', chatId, e);
        }

        // Update message doc participants if missing or different
        const msgData = doc.data() || {};
        const existing = Array.isArray(msgData.participants) ? msgData.participants : null;
        let needUpdate = false;
        if (!existing) needUpdate = true;
        else if (existing.length !== participants.length) needUpdate = true;
        else {
          for (const p of participants) {
            if (!existing.includes(p)) { needUpdate = true; break; }
          }
        }

        if (needUpdate) {
          batch.update(msgRef, { participants });
          batchCount++;
        }

        if (batchCount >= 400) {
          await batch.commit();
          console.log('Committed batch of', batchCount, 'updates.');
          processed += batchCount;
          lastDoc = snap.docs[snap.docs.length - 1];
          break;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
        console.log('Committed batch of', batchCount, 'updates.');
        processed += batchCount;
      }

      if (snap.docs.length < pageSize) break;
      lastDoc = snap.docs[snap.docs.length - 1];
    }

    console.log('Backfill complete. Processed approx', processed, 'writes (updates/sets).');
    process.exit(0);
  } catch (err) {
    console.error('Error during backfill:', err);
    process.exit(2);
  }
})();