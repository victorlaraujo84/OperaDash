import type { InventoryDimensionRow } from '../types/operadora';
export type InventorySortKey = 'name' | 'links' | 'assets' | 'availabilityPercent';
export type SortDirection = 'asc' | 'desc';
export function sortInventoryRows(rows: InventoryDimensionRow[], key: InventorySortKey, direction: SortDirection): InventoryDimensionRow[] {
  return [...rows].sort((a, b) => {
    const left = a[key], right = b[key];
    if (left === null && right !== null) return 1;
    if (right === null && left !== null) return -1;
    const comparison = typeof left === 'string' && typeof right === 'string' ? left.localeCompare(right, 'pt-BR', { numeric: true }) : Number(left) - Number(right);
    return (direction === 'asc' ? comparison : -comparison) || a.name.localeCompare(b.name, 'pt-BR');
  });
}
