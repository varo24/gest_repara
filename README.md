# ReparaPro Unified v4.0.0

Sistema de gestión integral para talleres de reparación. Fusión de **ReparaPro Master** y **Gestión Repara** en una única aplicación.

## Características

### Base (ReparaPro Master)
- **Gestión de Reparaciones** — RMA completo con estados, seguimiento, firma digital
- **Presupuestos** — Creación, envío y seguimiento de presupuestos
- **Tickets e Impresión** — Resguardos A4, tickets térmicos 80mm, etiquetas
- **Clientes** — Agenda de clientes con historial de reparaciones
- **Estadísticas** — Dashboard de rendimiento del taller
- **WhatsApp** — Notificaciones automáticas a clientes
- **PIN de acceso** — Seguridad básica con código PIN
- **PWA** — Instalable como app de escritorio/móvil

### Nuevos Módulos (de Gestión Repara)
- **Planificador / Calendario** — Agenda de visitas con selector de fechas, GPS integrado, sincronización con Google Calendar, avisos WhatsApp
- **Módulos Externos** — Integración de apps de terceros via iframe (WhatsApp Web, Google Sheets, Trello, Canva, etc.)
- **Búsqueda Global (⌘K)** — Búsqueda instantánea en reparaciones, clientes y citas

### Almacenamiento Dual
- **Local-First** — IndexedDB para respuesta inmediata
- **Cloud Sync** — Supabase en background (polling cada 3s)
- **Auto-backup** — Al cerrar la pestaña, cada 5 minutos, y al pasar a segundo plano

## Stack Tecnológico

- React 19 + TypeScript
- Tailwind CSS v4
- Vite 6
- Lucide React (iconos)
- Recharts (gráficos)
- IndexedDB (almacenamiento local)
- Supabase (cloud sync)

## Instalación

```bash
npm install
npm run dev
```

## Configuración

1. Copia `.env.example` a `.env`
2. Configura las credenciales de Supabase (opcional — funciona sin ellas en modo local)
3. `npm run dev` para desarrollo
4. `npm run build` para producción

## Estructura de Archivos

```
src/
├── App.tsx                    # App principal (routing por estado)
├── types.ts                   # Tipos TypeScript unificados
├── main.tsx                   # Entry point
├── components/
│   ├── Dashboard.tsx          # Panel central
│   ├── RepairList.tsx         # Listado de reparaciones
│   ├── RepairForm.tsx         # Formulario de reparación
│   ├── BudgetCreator.tsx      # Creador de presupuestos
│   ├── BudgetList.tsx         # Listado de presupuestos
│   ├── CustomerList.tsx       # Agenda de clientes
│   ├── StatsView.tsx          # Estadísticas
│   ├── SettingsForm.tsx       # Configuración
│   ├── Sidebar.tsx            # Barra lateral con navegación
│   ├── PinScreen.tsx          # Pantalla de PIN
│   ├── CustomerReceipt.tsx    # Resguardo A4
│   ├── ThermalTicket.tsx      # Ticket térmico
│   ├── SignaturePad.tsx       # Firma digital
│   ├── CalendarView.tsx       # ★ NUEVO: Planificador de visitas
│   ├── ExternalAppsView.tsx   # ★ NUEVO: Gestor de módulos externos
│   ├── ExternalAppViewer.tsx  # ★ NUEVO: Visor iframe de apps externas
│   └── GlobalSearch.tsx       # ★ NUEVO: Búsqueda global (⌘K)
├── services/
│   ├── persistence.ts         # Motor de almacenamiento dual
│   ├── localDB.ts             # IndexedDB wrapper
│   ├── supabaseService.ts     # Supabase client
│   ├── whatsappService.ts     # Integración WhatsApp
│   └── geminiService.ts       # AI (opcional)
└── public/
    ├── manifest.json          # PWA manifest
    └── sw.js                  # Service Worker
```

## Nuevas Colecciones de Datos

- **citas** — Visitas/citas agendadas (calendario)
- **apps_externas** — Aplicaciones externas integradas

## Licencia

Uso privado / comercial.
