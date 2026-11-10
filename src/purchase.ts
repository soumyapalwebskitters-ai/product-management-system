export type PurchaseCalc = {
  purchaseQty: number
  boxes: number
  totalItems: number
  extra: number
  itemsPerBox: number
}

/** Purchase quantity is desired stock minus current stock. Boxes always round up. */
export function calcPurchase(
  currentStock: number,
  desiredStock: number,
  itemsPerBox: number,
): PurchaseCalc {
  const current = Math.trunc(currentStock)
  const desired = Math.max(0, Math.trunc(desiredStock))
  const perBox = Math.max(1, Math.trunc(itemsPerBox))
  const purchaseQty = Math.max(0, desired - current)
  const boxes = purchaseQty === 0 ? 0 : Math.ceil(purchaseQty / perBox)
  const totalItems = boxes * perBox
  const extra = totalItems - purchaseQty
  return { purchaseQty, boxes, totalItems, extra, itemsPerBox: perBox }
}

export function needsRestock(currentStock: number, minimumStock: number) {
  return currentStock < minimumStock
}
