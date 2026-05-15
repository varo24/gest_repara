#!/usr/bin/env node
/**
 * Firestore weekly backup → Firebase Storage
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}' node backup.js
 *
 * Saves: gs://gestrepara.firebasestorage.app/backups/backup_YYYY-MM-DD.json
 * Keeps: last 4 backups (deletes oldest automatically)
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');
const { getStorage }          = require('firebase-admin/storage');

const COLLECTIONS = [
  'repairs',
  'customers',
  'invoices',
  'budgets',
  'cierres_caja',
  'cash_movements',
  'inventory',
  'stock_movements',
  'warranties',
  'suppliers',
  'citas',
  'settings',
];

const MAX_BACKUPS = 4;
const BACKUP_PREFIX = 'backups/backup_';

async function main() {
  // ── Init ──────────────────────────────────────────────────────────────────
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

  const app = initializeApp({
    credential: cert(serviceAccount),
    storageBucket: 'gestrepara.firebasestorage.app',
  });

  const db      = getFirestore(app, 'gestrepara');
  const bucket  = getStorage(app).bucket();

  // ── Read all collections ──────────────────────────────────────────────────
  console.log('Reading collections...');
  const backup = {
    createdAt: new Date().toISOString(),
    collections: {},
  };

  for (const col of COLLECTIONS) {
    try {
      const snap = await db.collection(col).get();
      backup.collections[col] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      console.log(`  ${col}: ${snap.docs.length} documents`);
    } catch (err) {
      console.warn(`  ${col}: skipped (${err.message})`);
      backup.collections[col] = [];
    }
  }

  // ── Upload ────────────────────────────────────────────────────────────────
  const date     = new Date().toISOString().slice(0, 10);
  const filename = `${BACKUP_PREFIX}${date}.json`;
  const file     = bucket.file(filename);
  const json     = JSON.stringify(backup, null, 2);

  await file.save(Buffer.from(json, 'utf8'), {
    contentType: 'application/json',
    metadata: { cacheControl: 'private' },
  });
  console.log(`\nUploaded: ${filename} (${(json.length / 1024).toFixed(1)} KB)`);

  // ── Rotate: keep only MAX_BACKUPS ─────────────────────────────────────────
  const [files] = await bucket.getFiles({ prefix: BACKUP_PREFIX });
  const sorted  = files
    .map(f => ({ name: f.name, updated: f.metadata.updated }))
    .sort((a, b) => a.updated.localeCompare(b.updated));   // oldest first

  const toDelete = sorted.slice(0, Math.max(0, sorted.length - MAX_BACKUPS));
  for (const f of toDelete) {
    await bucket.file(f.name).delete();
    console.log(`Deleted old backup: ${f.name}`);
  }

  console.log(`\nDone. ${Math.min(sorted.length, MAX_BACKUPS)} backup(s) retained.`);
  process.exit(0);
}

main().catch(err => {
  console.error('Backup failed:', err.message);
  process.exit(1);
});
