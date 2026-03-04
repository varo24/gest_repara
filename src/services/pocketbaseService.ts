// ============================================================
// ReparaPro Master - PocketBase Service v2
// API oficial PocketBase con realtime nativo
// ============================================================

type Callback = (data: any[]) => void;

class PocketBaseService {
  private baseUrl = '';
  private connected = false;
  private clientId = '';
  private subscribers: Record<string, Set<Callback>> = {};
  private sseSource: EventSource | null = null;
  private subscriptions: Set<string> = new Set();

  // ── Conectar ──────────────────────────────────────────────
  async connect(host: string): Promise<boolean> {
    const url = host.replace(/\/$/, '');
    try {
      const res = await fetch(`${url}/api/health`, {
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) return false;
      this.baseUrl = url;
      this.connected = true;
      await this.ensureCollections();
      this.initRealtime();
      console.log('✅ PocketBase conectado:', url);
      return true;
    } catch (e) {
      console.error('PocketBase connect error:', e);
      this.connected = false;
      return false;
    }
  }

  disconnect() {
    this.sseSource?.close();
    this.sseSource = null;
    this.connected = false;
    this.baseUrl = '';
    this.clientId = '';
    this.subscriptions.clear();
  }

  isConnected() { return this.connected; }
  getHost() { return this.baseUrl; }

  // ── Crear colecciones automáticamente ────────────────────
  private async ensureCollections() {
    // Intentar acceder a cada colección, si no existe crearla
    const cols = [
      { name: 'repairs', schema: [] },
      { name: 'budgets', schema: [] },
      { name: 'rp_settings', schema: [] },
    ];

    // Obtener token de admin si existe
    const adminToken = localStorage.getItem('pb_admin_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (adminToken) headers['Authorization'] = adminToken;

    for (const col of cols) {
      try {
        const check = await fetch(`${this.baseUrl}/api/collections/${col.name}`, { headers });
        if (check.status === 404) {
          // Crear colección con un campo data de tipo json
          await fetch(`${this.baseUrl}/api/collections`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              name: col.name,
              type: 'base',
              schema: [
                { name: 'data', type: 'json', required: false },
                { name: 'business_id', type: 'text', required: false }
              ]
            })
          });
        }
      } catch { /* ya existe o sin permisos */ }
    }
  }

  // ── SSE Realtime nativo de PocketBase ─────────────────────
  private initRealtime() {
    if (this.sseSource) {
      this.sseSource.close();
      this.sseSource = null;
    }

    const es = new EventSource(`${this.baseUrl}/api/realtime`);

    es.addEventListener('PB_CONNECT', async (e: any) => {
      try {
        const data = JSON.parse(e.data);
        this.clientId = data.clientId;
        // Suscribirse a todas las colecciones activas
        for (const col of this.subscriptions) {
          await this.sendSubscription(col);
        }
        console.log('🔴 PocketBase realtime conectado, clientId:', this.clientId);
      } catch { /* */ }
    });

    es.onmessage = async (e) => {
      try {
        const event = JSON.parse(e.data);
        const topic = event.action ? event.topic : null;
        if (!topic) return;

        // Extraer nombre de colección del topic (formato: "coleccion/id")
        const colName = topic.split('/')[0];
        if (this.subscribers[colName]?.size > 0) {
          const fresh = await this.getAll(colName);
          this.subscribers[colName].forEach(cb => cb(fresh));
        }
      } catch { /* */ }
    };

    es.onerror = () => {
      console.warn('PocketBase SSE desconectado, reintentando...');
      this.clientId = '';
      setTimeout(() => {
        if (this.connected) this.initRealtime();
      }, 3000);
    };

    this.sseSource = es;
  }

  private async sendSubscription(colName: string) {
    if (!this.clientId) return;
    try {
      await fetch(`${this.baseUrl}/api/realtime`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: this.clientId,
          subscriptions: [`${colName}/*`]
        })
      });
    } catch { /* */ }
  }

  // ── CRUD ─────────────────────────────────────────────────
  async getAll(colName: string): Promise<any[]> {
    if (!this.connected) return [];
    const col = colName === 'settings' ? 'rp_settings' : colName;
    try {
      const res = await fetch(
        `${this.baseUrl}/api/collections/${col}/records?perPage=500&sort=-updated`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (!res.ok) return [];
      const json = await res.json();
      return (json.items || []).map((item: any) => {
        const data = typeof item.data === 'string' ? JSON.parse(item.data) : (item.data || {});
        return { ...data, _pbId: item.id, _pbCol: col };
      });
    } catch { return []; }
  }

  async save(colName: string, record: any): Promise<boolean> {
    if (!this.connected) return false;
    const col = colName === 'settings' ? 'rp_settings' : colName;
    const { _pbId, _pbCol, ...cleanRecord } = record;

    try {
      // Buscar por business_id
      const searchRes = await fetch(
        `${this.baseUrl}/api/collections/${col}/records?filter=(business_id='${cleanRecord.id}')`,
        { signal: AbortSignal.timeout(5000) }
      );
      const searchJson = await searchRes.json();
      const existing = searchJson.items?.[0];

      const body = JSON.stringify({
        data: cleanRecord,
        business_id: cleanRecord.id
      });
      const headers = { 'Content-Type': 'application/json' };

      if (existing) {
        const res = await fetch(
          `${this.baseUrl}/api/collections/${col}/records/${existing.id}`,
          { method: 'PATCH', headers, body, signal: AbortSignal.timeout(5000) }
        );
        return res.ok;
      } else {
        const res = await fetch(
          `${this.baseUrl}/api/collections/${col}/records`,
          { method: 'POST', headers, body, signal: AbortSignal.timeout(5000) }
        );
        return res.ok;
      }
    } catch { return false; }
  }

  async remove(colName: string, businessId: string): Promise<boolean> {
    if (!this.connected) return false;
    const col = colName === 'settings' ? 'rp_settings' : colName;
    try {
      const searchRes = await fetch(
        `${this.baseUrl}/api/collections/${col}/records?filter=(business_id='${businessId}')`,
        { signal: AbortSignal.timeout(5000) }
      );
      const searchJson = await searchRes.json();
      const existing = searchJson.items?.[0];
      if (!existing) return false;

      const res = await fetch(
        `${this.baseUrl}/api/collections/${col}/records/${existing.id}`,
        { method: 'DELETE', signal: AbortSignal.timeout(5000) }
      );
      return res.ok;
    } catch { return false; }
  }

  // ── Suscripción con realtime ──────────────────────────────
  subscribe(colName: string, callback: Callback): () => void {
    if (!this.subscribers[colName]) this.subscribers[colName] = new Set();
    this.subscribers[colName].add(callback);

    // Añadir a subscriptions SSE
    this.subscriptions.add(colName);
    if (this.clientId) this.sendSubscription(colName);

    // Cargar datos iniciales
    this.getAll(colName).then(data => callback(data));

    return () => {
      this.subscribers[colName]?.delete(callback);
    };
  }

  async migrateFromLocal(repairs: any[], budgets: any[], settings: any[]) {
    let counts = { repairs: 0, budgets: 0, settings: 0 };
    for (const r of repairs) if (await this.save('repairs', r)) counts.repairs++;
    for (const b of budgets) if (await this.save('budgets', b)) counts.budgets++;
    for (const s of settings) if (await this.save('settings', s)) counts.settings++;
    return counts;
  }
}

export const pb = new PocketBaseService();
