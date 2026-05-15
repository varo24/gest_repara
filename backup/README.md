# Gestrepara — Backup semanal Firestore

Script Node.js que exporta las colecciones críticas de Firestore a Firebase Storage.
Diseñado para ejecutarse como **Cron Job en Railway** cada lunes a las 3:00 AM.

## Colecciones que se exportan

| Clave en el JSON | Colección en Firestore |
|---|---|
| reparaciones | repairs |
| clientes | customers |
| facturas | invoices |
| presupuestos | budgets |
| cierres_caja | cierres_caja |
| movimientos_caja | cash_movements |
| inventario | inventory |
| proveedores | suppliers |
| citas | citas |
| garantias | warranties |

## Resultado en Firebase Storage

```
gs://gestrepara.firebasestorage.app/
└── backups/
    ├── backup_2026-05-15.json   ← más reciente
    ├── backup_2026-05-08.json
    ├── backup_2026-05-01.json
    └── backup_2026-04-24.json   ← máximo 4, el más antiguo se borra
```

## Desplegar en Railway

### 1. Prerequisito: Service Account

En Firebase Console → Project Settings → Service accounts → **Generate new private key**.

Minificar el JSON descargado (una sola línea):
```bash
# En PowerShell:
(Get-Content "service-account.json" -Raw) -replace "`r`n|`n", "" | Set-Clipboard

# En bash/Linux:
cat service-account.json | tr -d '\n'
```

### 2. Crear el servicio en Railway

1. Railway Dashboard → **New Project** → **Empty Project**
2. **Add Service** → **GitHub Repo** → selecciona `gest_repara`
3. En la configuración del servicio:
   - **Root Directory**: `backup`
   - **Build Command**: `npm install`
   - **Start Command**: `node backup.js`

### 3. Variable de entorno

En Railway → Variables:
```
FIREBASE_SERVICE_ACCOUNT = {"type":"service_account","project_id":"gestion-reparaciones-45878",...}
```
Pega el JSON minificado (una sola línea).

### 4. Configurar el Cron

En Railway → Settings del servicio → **Cron Schedule**:
```
0 3 * * 1
```
_(Cada lunes a las 3:00 AM UTC = 5:00 AM hora España verano)_

### 5. Probar manualmente

En Railway → Deploy → **Trigger Deploy** (ejecuta el script ahora).
Verifica en Firebase Console → Storage → carpeta `backups/`.

## Ejecutar localmente

```bash
cd backup
npm install
export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
node backup.js
```

## Restaurar un backup

```bash
# Descargar desde Firebase Storage
# Firebase Console → Storage → backups → descargar el archivo

# El JSON tiene esta estructura:
# {
#   "fecha": "2026-05-15",
#   "version": "1.0",
#   "totalDocs": 1234,
#   "colecciones": {
#     "reparaciones": [...],
#     "clientes": [...],
#     ...
#   }
# }
```
