#!/usr/bin/env node
/**
 * Gestrepara — Firestore weekly backup → Firebase Storage
 *
 * Reads critical Firestore collections and writes a timestamped JSON
 * to gs://gestrepara.firebasestorage.app/backups/backup_YYYY-MM-DD.json
 * Retains the last 4 backups; older files are deleted automatically.
 *
 * Env vars required:
 *   FIREBASE_SERVICE_ACCOUNT  — service account JSON, minified (single line)
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');
const { getStorage }          = require('firebase-admin/storage');

// Firestore collection name → JSON export key (Spanish label)
const COLLECTIONS = {
  repairs:        'reparaciones',
  customers:      'clientes',
  invoices:       'facturas',
  budgets:        'presupuestos',
  cierres_caja:   'cierres_caja',
  cash_movements: 'movimientos_caja',
  inventory:      'inventario',
  suppliers:      'proveedores',
  citas:          'citas',
  warranties:     'garantias',
};

const MAX_BACKUPS   = 4;
const BACKUP_PREFIX = 'backups/backup_';
const DATABASE_ID   = 'gestrepara';
const STORAGE_BUCKET = 'gestrepara.firebasestorage.app';

// ── Parse service account ──────────────────────────────────────────────────
let serviceAccount;
try {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not set');
  serviceAccount = JSON.parse(raw.trim());
} catch (err) {
  console.error('ERROR: Cannot parse FIREBASE_SERVICE_ACCOUNT —', err.message);
  console.error('Make sure the variable contains the full service account JSON (minified, single line).');
  process.exit(1);
}

// ── Init Firebase Admin ────────────────────────────────────────────────────
const app    = initializeApp({ credential: cert(serviceAccount), storageBucket: STORAGE_BUCKET });
const db     = getFirestore(app, DATABASE_ID);
const bucket = getStorage(app).bucket();

async function main() {
  const date  = new Date().toISOString().slice(0, 10);
  console.log(`\n=== Gestrepara backup ${date} ===\n`);

  // ── Read collections ───────────────────────────────────────────────────
  const colecciones = {};
  let totalDocs = 0;

  for (const [firestoreCol, exportKey] of Object.entries(COLLECTIONS)) {
    try {
      const snap = await db.collection(firestoreCol).get();
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      colecciones[exportKey] = docs;
      totalDocs += docs.length;
      console.log(`  ✓ ${exportKey.padEnd(20)} ${docs.length} docs`);
    } catch (err) {
      colecciones[exportKey] = [];
      console.warn(`  ✗ ${exportKey.padEnd(20)} error: ${err.message}`);
    }
  }

  // ── Build payload ──────────────────────────────────────────────────────
  const payload = {
    fecha:    date,
    version:  '1.0',
    totalDocs,
    colecciones,
  };

  const json     = JSON.stringify(payload, null, 2);
  const filename = `${BACKUP_PREFIX}${date}.json`;
  const sizeKB   = (json.length / 1024).toFixed(1);

  // ── Upload ─────────────────────────────────────────────────────────────
  const file = bucket.file(filename);
  await file.save(Buffer.from(json, 'utf8'), {
    contentType: 'application/json',
    metadata: { cacheControl: 'private, no-store' },
  });
  console.log(`\n→ Uploaded: ${filename} (${sizeKB} KB, ${totalDocs} docs total)`);

  // ── Rotate — keep only MAX_BACKUPS ─────────────────────────────────────
  const [files] = await bucket.getFiles({ prefix: BACKUP_PREFIX });
  const sorted  = files
    .filter(f => f.name !== filename)           // exclude the one we just created
    .map(f => ({ name: f.name, time: f.metadata.timeCreated || f.metadata.updated }))
    .sort((a, b) => a.time.localeCompare(b.time)); // oldest first

  // files we're keeping = the new one + up to (MAX_BACKUPS - 1) existing
  const keep    = MAX_BACKUPS - 1;
  const toDelete = sorted.slice(0, Math.max(0, sorted.length - keep));

  for (const f of toDelete) {
    await bucket.file(f.name).delete();
    console.log(`  Deleted old backup: ${f.name}`);
  }

  const retained = Math.min(sorted.length, keep) + 1;
  console.log(`\n✓ Done. ${retained}/${MAX_BACKUPS} backups retained.\n`);
  process.exit(0);
}

main().catch(err => {
  console.error('\n✗ Backup failed:', err.message);
  process.exit(1);
});
