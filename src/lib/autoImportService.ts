import { AppSettings, Supplier } from '../types';
import { storage, localDB } from './dataService';
import { uploadFacturaPDF } from './storageService';

type Notify = (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;

async function upsertSupplier(proveedor: string): Promise<string | undefined> {
  if (!proveedor) return undefined;
  const normalized = proveedor.trim().toLowerCase();
  const existing = (localDB.getAll('suppliers') as Supplier[]).find(
    s => s.name.trim().toLowerCase() === normalized
  );
  if (existing) return existing.id;
  const now = new Date().toISOString();
  const id = `SUPP-${Date.now()}`;
  await storage.save('suppliers', id, {
    id, name: proveedor.trim(), createdAt: now, updatedAt: now,
  });
  return id;
}

export async function procesarFacturasBackground(settings: AppSettings, notify: Notify): Promise<void> {
  const serverUrl = (settings.imapServerUrl || '').trim().replace(/\/$/, '');
  const apiKey = settings.imapApiKey || '';
  if (!serverUrl || !apiKey) return;

  console.log('[AutoImport] Ejecutando...');

  try {
    const TTL_MS = 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - TTL_MS;

    const analizados = localDB.getAll('correos_analizados') as any[];
    const skipUids = analizados
      .filter(d => d.analyzedAt && new Date(d.analyzedAt).getTime() > cutoff)
      .map(d => String(d.emailUid));

    console.log(`[AutoImport] Skip UIDs: ${skipUids.length}`);

    const descartadas = localDB.getAll('facturas_descartadas') as any[];
    const descartadasUids = descartadas.map((d: any) => String(d.emailUid)).filter(Boolean);

    const days = settings.imapDays ?? 7;
    const params = new URLSearchParams({ days: String(days) });
    if (skipUids.length) params.set('skip', skipUids.join(','));
    if (descartadasUids.length) params.set('descartadas', descartadasUids.join(','));

    const r = await fetch(`${serverUrl}/emails/facturas?${params}`, {
      headers: { 'x-api-key': apiKey },
      signal: AbortSignal.timeout(180_000),
    });
    if (!r.ok) return;

    const data = await r.json();
    const now = new Date().toISOString();

    // Cache all analyzed results (keeps localDB in sync with Correos component)
    for (const result of (data.results || []) as any[]) {
      storage.save('correos_analizados', `ANAL-${result.uid}`, {
        id: `ANAL-${result.uid}`,
        emailUid: result.uid,
        es_factura: result.es_factura,
        from: result.from,
        subject: result.subject,
        date: result.date,
        datos_factura: result.datos_factura ?? null,
        tiene_adjunto_pdf: result.tiene_adjunto_pdf ?? false,
        analizado_via: result.analizado_via ?? 'texto',
        analyzedAt: now,
      });
    }

    const importadas = localDB.getAll('facturas_importadas') as any[];
    const existingClavas = new Set(importadas.map((d: any) => d.claveUnica).filter(Boolean));

    const nuevasProveedores: string[] = [];

    const facturasConPdf = (data.facturas || []).filter((f: any) => !!f.attachment_base64);
    console.log(`[AutoImport] Facturas nuevas encontradas: ${facturasConPdf.length} (con PDF)`);

    for (const f of facturasConPdf as any[]) {
      const claveUnica = `${f.uid}-${f.numero_factura}`;
      if (existingClavas.has(claveUnica)) continue;

      let pdfUrl: string | undefined;
      if (f.attachment_base64) {
        try {
          pdfUrl = await uploadFacturaPDF(f.attachment_base64, f.proveedor, f.numero_factura, f.fecha_factura);
        } catch { /* continue without PDF */ }
      }

      let supplierId: string | undefined;
      try { supplierId = await upsertSupplier(f.proveedor); } catch {}

      const importId = `IMP-${Date.now()}-${f.uid}`;
      storage.save('facturas_importadas', importId, {
        id: importId,
        emailUid: f.uid,
        claveUnica,
        proveedor: f.proveedor || '',
        numeroFactura: f.numero_factura || '',
        fecha: f.fecha_factura || '',
        total: f.total ?? 0,
        lineas: f.lineas || [],
        importadoEn: now,
        forzado: false,
        pdfUrl,
        supplierId,
        estado: 'pendiente_revision',
        origen: 'auto',
      });
      storage.save('correos_procesados', `PROC-${f.uid}`, {
        id: `PROC-${f.uid}`,
        emailUid: f.uid,
        tipo: 'stock_importado',
        proveedor: f.proveedor || '',
        numeroFactura: f.numero_factura || '',
        procesadoEn: now,
      });

      nuevasProveedores.push(f.proveedor || 'Proveedor desconocido');
    }

    console.log('[AutoImport] Completado');

    if (nuevasProveedores.length > 0) {
      const proveedores = [...new Set(nuevasProveedores)].join(', ');
      const n = nuevasProveedores.length;
      notify('info', `${n} factura${n > 1 ? 's' : ''} nueva${n > 1 ? 's' : ''} recibida${n > 1 ? 's' : ''} de ${proveedores}`);
    }
  } catch {
    // Silent — background job must never surface errors to the user
  }
}
