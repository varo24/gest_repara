# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Vite dev server (localhost:5173)
npm run build      # TypeScript check + Vite production build
npm run lint       # ESLint
npx tsc --noEmit   # Type-check only (fastest feedback loop)
```

There are no automated tests. Verify changes visually via `npm run dev`.

## Architecture

**React 19 + TypeScript 5.8 SPA** built with Vite 6. Tailwind CSS v4 (CSS-based config, no `tailwind.config.js`). All icons from `lucide-react`.

### Data layer: `src/lib/dataService.ts`

Local-first architecture — all writes hit IndexedDB immediately, broadcast to subscribers, then async Firestore sync. Offline writes queue in localStorage and flush on reconnect.

Key API on the `storage` export:
- `storage.init()` — call once at app start
- `storage.subscribe(col, cb)` — reactive subscription, fires immediately with cached data
- `storage.save(col, id, data)` — upsert (merges with existing)
- `storage.remove(col, id)` — delete
- `storage.nextRmaNumber()` / `storage.nextInvoiceNumber('FAC'|'REC')` — auto-increment helpers

Collections: `repairs`, `budgets`, `invoices`, `inventory`, `stock_movements`, `customers`, `warranties`, `citas`, `apps_externas`, `settings`, and several others — all declared in `ALL_STORES`.

Firebase project: `gestion-reparaciones-45878`, named database: `gestrepara`.

### State management: `src/App.tsx`

All top-level state lives here. `storage.subscribe` calls in `useEffect` wire Firestore/IDB data into React state. Child components receive data as props and call handler callbacks. No Redux/Zustand.

### Views

`ViewType` union controls which component renders. `navigateTo(view)` is the router. Views are rendered inline in App.tsx's JSX block, not via a router library.

Current views and their components:
- `dashboard` → `Dashboard`
- `repairs` / `new-repair` → `RepairList` / `RepairForm`
- `budgets` → `BudgetList` + `BudgetCreator` (overlaid when `activeBudgetRepair` is set)
- `invoices` → `Facturacion`
- `customers` → `CustomerList`
- `inventory` → `Inventario`
- `inventory-entrada` → `EntradaStock`
- `calendar` → `CalendarView`
- `settings` → `SettingsForm`
- `stats` → `StatsView`
- `despacho` → `Despacho`
- `tech-field` → `TechFieldView` / `FieldModeApp`

### Invoice numbering

Two independent series: `FAC-XXXXX` (with IVA) and `REC-XXXXX` (sin IVA / recibos). `storage.nextInvoiceNumber('FAC'|'REC')` computes the next number by filtering on prefix.

### Key type notes

- `Budget.taxEnabled?: boolean` — when false, `effectiveTaxRate = 0`
- `BudgetItem.inventoryItemId?: string` — links budget lines to inventory for auto stock deduction on invoice conversion
- `InventoryItem.category` is `string` (not a union type); default categories are defined locally in components
- `AppSettings.inventoryCategories?: string[]` — user-defined categories stored in Firestore `settings` collection
- `AppSettings.anthropicApiKey?: string` — used by `EntradaStock` AI tab

### Print generation

Both `BudgetCreator` and `Facturacion` open a new window with `window.open('')` + `document.write(html)` + `window.print()`. There is an iframe fallback if the popup is blocked.

### Pre-existing TypeScript errors (do not fix without explicit request)

- `src/components/Facturacion.tsx(435)`: `createdAt` not in `Customer` type
- `src/components/SettingsForm.tsx(361)`: `storage.forceBackup` doesn't exist
