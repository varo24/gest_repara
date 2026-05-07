import { storage, localDB } from './dataService';

export async function descontarStock(
  items: Array<{ description?: string; quantity?: number; inventoryItemId?: string }>,
  origin: string,
  referenceId: string
): Promise<void> {
  const now = new Date().toISOString();
  for (const item of items) {
    const qty = item.quantity ?? 1;
    if (qty <= 0) continue;
    // Re-read inventory each iteration so same-item-twice is handled correctly
    const inventory = localDB.getAll('inventory');
    const invItem = item.inventoryItemId
      ? inventory.find((i: any) => i.id === item.inventoryItemId)
      : inventory.find((i: any) =>
          i.description?.toLowerCase() === item.description?.toLowerCase() ||
          i.ref?.toLowerCase() === item.description?.toLowerCase()
        );
    if (!invItem) continue;
    const newStock = Math.max(0, invItem.stock - qty);
    storage.save('inventory', invItem.id, { ...invItem, stock: newStock, updatedAt: now });
    const mvId = `SM-${Date.now()}-${invItem.id}`;
    storage.save('stock_movements', mvId, {
      id: mvId,
      itemId: invItem.id,
      ref: invItem.ref,
      description: invItem.description,
      type: 'salida',
      qty: -qty,
      costPrice: invItem.costPrice,
      date: now.slice(0, 10),
      origin,
      notes: `Usado en ${referenceId}`,
      createdAt: now,
    });
  }
}

export async function devolverStock(
  items: Array<{ description?: string; quantity?: number; inventoryItemId?: string }>,
  origin: string,
  referenceId: string
): Promise<void> {
  const now = new Date().toISOString();
  for (const item of items) {
    const qty = item.quantity ?? 1;
    if (qty <= 0) continue;
    const inventory = localDB.getAll('inventory');
    const invItem = item.inventoryItemId
      ? inventory.find((i: any) => i.id === item.inventoryItemId)
      : inventory.find((i: any) =>
          i.description?.toLowerCase() === item.description?.toLowerCase() ||
          i.ref?.toLowerCase() === item.description?.toLowerCase()
        );
    if (!invItem) continue;
    storage.save('inventory', invItem.id, { ...invItem, stock: invItem.stock + qty, updatedAt: now });
    const mvId = `SM-${Date.now()}-${invItem.id}`;
    storage.save('stock_movements', mvId, {
      id: mvId,
      itemId: invItem.id,
      ref: invItem.ref,
      description: invItem.description,
      type: 'entrada',
      qty,
      costPrice: invItem.costPrice,
      date: now.slice(0, 10),
      origin,
      notes: `Devuelto por ${referenceId}`,
      createdAt: now,
    });
  }
}
