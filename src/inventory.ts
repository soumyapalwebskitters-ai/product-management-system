import { calcPurchase, needsRestock } from './purchase'
import type { PurchaseCalc } from './purchase'
import type {
  Movement,
  Product,
  ProductInput,
  Purchase,
  PurchaseInput,
  State,
  Variant,
  VariantInput,
} from './types'

export const MAX_STOCK = 1_000_000

export type Outcome = { ok: true; state: State } | { ok: false; error: string }

export type StockStatus = 'ok' | 'low' | 'out'

export type BuyRow = {
  productId: string
  productName: string
  variant: Variant
  calc: PurchaseCalc
  onOrderItems: number
  status: 'low' | 'out'
}

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error }
}

function success(state: State): Outcome {
  return { ok: true, state }
}

function createId() {
  return crypto.randomUUID()
}

function cleanNote(note: string) {
  return note.trim().slice(0, 500)
}

function wholeNumber(value: number, label: string, min: number) {
  if (!Number.isInteger(value)) return `${label} must be a whole number.`
  if (value < min) {
    return min === 0 ? `${label} cannot be negative.` : `${label} must be at least ${min}.`
  }
  if (value > MAX_STOCK) return `${label} cannot exceed ${MAX_STOCK.toLocaleString()}.`
  return null
}

function locate(state: State, productId: string, variantId: string) {
  const productIndex = state.products.findIndex((product) => product.id === productId)
  if (productIndex < 0) return null
  const variantIndex = state.products[productIndex].variants.findIndex(
    (variant) => variant.id === variantId,
  )
  if (variantIndex < 0) return null
  return { productIndex, variantIndex }
}

function skuKey(sku: string) {
  return sku.trim().toLowerCase()
}

function purchaseStatus(ordered: number, received: number): Purchase['status'] {
  if (received <= 0) return 'ordered'
  if (received < ordered) return 'partial'
  return 'received'
}

function parseProduct(
  input: ProductInput,
  existing: Variant[] | null,
): { ok: true; name: string; variants: VariantInput[] } | { ok: false; error: string } {
  const name = input.name.trim()
  if (!name) return fail('Enter a product name.')
  if (name.length > 80) return fail('Product name must be 80 characters or fewer.')
  if (input.variants.length === 0) return fail('Add at least one variant.')

  const variants: VariantInput[] = []
  const seenIds = new Set<string>()
  const seenSkus = new Set<string>()

  for (let index = 0; index < input.variants.length; index += 1) {
    const source = input.variants[index]
    const variantName = source.name.trim()
    const sku = source.sku.trim()
    if (!variantName) return fail(`Enter a name for variant ${index + 1}.`)
    if (variantName.length > 80) return fail(`${variantName} must be 80 characters or fewer.`)
    if (!sku) return fail(`Enter a SKU for ${variantName}.`)
    if (sku.length > 40) return fail(`SKU ${sku} must be 40 characters or fewer.`)

    const boxError = wholeNumber(source.itemsPerBox, `Items per box for ${variantName}`, 1)
    if (boxError) return fail(boxError)
    const stockError = wholeNumber(source.currentStock, `Current stock for ${variantName}`, 0)
    if (stockError) return fail(stockError)
    const minimumError = wholeNumber(source.minimumStock, `Minimum stock for ${variantName}`, 0)
    if (minimumError) return fail(minimumError)
    const desiredError = wholeNumber(source.desiredStock, `Desired stock for ${variantName}`, 0)
    if (desiredError) return fail(desiredError)

    if (source.id) {
      if (seenIds.has(source.id)) return fail('A variant was included twice.')
      seenIds.add(source.id)
      if (!existing?.some((variant) => variant.id === source.id)) {
        return fail('A variant does not belong to this product.')
      }
    }

    const key = skuKey(sku)
    if (seenSkus.has(key)) return fail(`SKU ${sku} is used more than once.`)
    seenSkus.add(key)

    const price = source.price ?? 0
    const priceError = wholeNumber(price, `Selling price for ${variantName}`, 0)
    if (priceError) return fail(priceError)

    variants.push({
      id: source.id,
      name: variantName,
      sku,
      itemsPerBox: source.itemsPerBox,
      price,
      currentStock: source.currentStock,
      minimumStock: source.minimumStock,
      desiredStock: source.desiredStock,
    })
  }

  return { ok: true, name, variants }
}

function skuClash(state: State, variants: VariantInput[], ignoreIds: Set<string>) {
  for (const variant of variants) {
    const key = skuKey(variant.sku)
    const clash = state.products.some((product) =>
      product.variants.some(
        (existing) => skuKey(existing.sku) === key && !ignoreIds.has(existing.id),
      ),
    )
    if (clash) return `SKU ${variant.sku} is already used.`
  }
  return null
}

function toVariant(input: VariantInput): Variant {
  return {
    id: input.id ?? createId(),
    name: input.name,
    sku: input.sku,
    itemsPerBox: input.itemsPerBox,
    price: input.price ?? 0,
    currentStock: input.currentStock,
    minimumStock: input.minimumStock,
    desiredStock: input.desiredStock,
  }
}

function stockMovement(
  product: Product,
  variant: Variant,
  previousStock: number,
  nextStock: number,
  type: Movement['type'],
  note: string,
  now: string,
  purchaseId?: string,
): Movement {
  return {
    id: createId(),
    type,
    productId: product.id,
    variantId: variant.id,
    productName: product.name,
    variantName: variant.name,
    sku: variant.sku,
    delta: nextStock - previousStock,
    previousStock,
    newStock: nextStock,
    note,
    createdAt: now,
    purchaseId,
  }
}

export function stockStatus(variant: Variant): StockStatus {
  if (variant.currentStock < variant.minimumStock) {
    return variant.currentStock <= 0 ? 'out' : 'low'
  }
  return 'ok'
}

export function onOrderItems(state: State, variantId: string) {
  return state.purchases
    .filter((purchase) => purchase.variantId === variantId && purchase.status !== 'received')
    .reduce(
      (sum, purchase) => sum + Math.max(0, purchase.orderedItems - purchase.receivedItems),
      0,
    )
}

export function remainingItems(purchase: Purchase) {
  return Math.max(0, purchase.orderedItems - purchase.receivedItems)
}

export function buyRows(state: State): BuyRow[] {
  const rows: BuyRow[] = []
  for (const product of state.products) {
    for (const variant of product.variants) {
      if (!needsRestock(variant.currentStock, variant.minimumStock)) continue
      rows.push({
        productId: product.id,
        productName: product.name,
        variant,
        calc: calcPurchase(variant.currentStock, variant.desiredStock, variant.itemsPerBox),
        onOrderItems: onOrderItems(state, variant.id),
        status: variant.currentStock <= 0 ? 'out' : 'low',
      })
    }
  }
  rows.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'out' ? -1 : 1
    const byProduct = a.productName.localeCompare(b.productName)
    if (byProduct !== 0) return byProduct
    return a.variant.name.localeCompare(b.variant.name)
  })
  return rows
}

export function catalogStats(state: State) {
  let variants = 0
  let low = 0
  let out = 0
  for (const product of state.products) {
    for (const variant of product.variants) {
      variants += 1
      const status = stockStatus(variant)
      if (status === 'low') low += 1
      if (status === 'out') out += 1
    }
  }
  return { products: state.products.length, variants, low, out }
}

export function createProduct(state: State, input: ProductInput, now: string): Outcome {
  const parsed = parseProduct(input, null)
  if (!parsed.ok) return parsed
  const clash = skuClash(state, parsed.variants, new Set())
  if (clash) return fail(clash)

  const next = structuredClone(state)
  const product: Product = {
    id: createId(),
    name: parsed.name,
    variants: parsed.variants.map(toVariant),
    createdAt: now,
    updatedAt: now,
  }
  for (const variant of product.variants) {
    if (variant.currentStock > 0) {
      next.movements.unshift(
        stockMovement(product, variant, 0, variant.currentStock, 'receipt', 'Opening stock', now),
      )
    }
  }
  next.products.push(product)
  return success(next)
}

export function updateProduct(
  state: State,
  productId: string,
  input: ProductInput,
  now: string,
): Outcome {
  const productIndex = state.products.findIndex((product) => product.id === productId)
  if (productIndex < 0) return fail('Product not found.')
  const existing = state.products[productIndex]
  const parsed = parseProduct(input, existing.variants)
  if (!parsed.ok) return parsed
  const clash = skuClash(state, parsed.variants, new Set(existing.variants.map((variant) => variant.id)))
  if (clash) return fail(clash)

  const next = structuredClone(state)
  const previousById = new Map(existing.variants.map((variant) => [variant.id, variant]))
  const product: Product = {
    ...existing,
    name: parsed.name,
    variants: parsed.variants.map(toVariant),
    updatedAt: now,
  }

  for (const variant of product.variants) {
    const previous = variant.id ? previousById.get(variant.id) : undefined
    if (!previous) {
      if (variant.currentStock > 0) {
        next.movements.unshift(
          stockMovement(product, variant, 0, variant.currentStock, 'receipt', 'Opening stock', now),
        )
      }
      continue
    }
    if (previous.currentStock !== variant.currentStock) {
      next.movements.unshift(
        stockMovement(
          product,
          variant,
          previous.currentStock,
          variant.currentStock,
          'adjustment',
          'Updated from product editor',
          now,
        ),
      )
    }
  }

  next.products[productIndex] = product
  return success(next)
}

export function deleteProduct(state: State, productId: string): Outcome {
  if (!state.products.some((product) => product.id === productId)) return fail('Product not found.')
  const next = structuredClone(state)
  next.products = next.products.filter((product) => product.id !== productId)
  return success(next)
}

export function setDesiredStock(
  state: State,
  productId: string,
  variantId: string,
  desiredStock: number,
  now: string,
): Outcome {
  const error = wholeNumber(desiredStock, 'Desired stock', 0)
  if (error) return fail(error)
  const place = locate(state, productId, variantId)
  if (!place) return fail('Variant not found.')
  const next = structuredClone(state)
  const product = next.products[place.productIndex]
  product.variants[place.variantIndex].desiredStock = desiredStock
  product.updatedAt = now
  return success(next)
}

function applyStockChange(
  state: State,
  productId: string,
  variantId: string,
  nextStock: number,
  type: Movement['type'],
  note: string,
  now: string,
  purchaseId?: string,
): Outcome {
  const place = locate(state, productId, variantId)
  if (!place) return fail('Variant not found.')
  const stockError = wholeNumber(nextStock, 'Stock', -MAX_STOCK)
  if (stockError) return fail(stockError)
  const next = structuredClone(state)
  const product = next.products[place.productIndex]
  const variant = product.variants[place.variantIndex]
  const previousStock = variant.currentStock
  if (previousStock === nextStock) return success(state)
  variant.currentStock = nextStock
  product.updatedAt = now
  next.movements.unshift(
    stockMovement(product, variant, previousStock, nextStock, type, cleanNote(note), now, purchaseId),
  )
  return success(next)
}

export function moveStock(
  state: State,
  productId: string,
  variantId: string,
  nextStock: number,
  type: Movement['type'],
  note: string,
  now: string,
): Outcome {
  return applyStockChange(state, productId, variantId, nextStock, type, note, now)
}

export function recordSale(
  state: State,
  productId: string,
  variantId: string,
  quantity: number,
  note: string,
  now: string,
): Outcome {
  const error = wholeNumber(quantity, 'Sale quantity', 1)
  if (error) return fail(error)
  const place = locate(state, productId, variantId)
  if (!place) return fail('Variant not found.')
  const current = state.products[place.productIndex].variants[place.variantIndex].currentStock
  if (quantity > current) {
    return fail(`Only ${current.toLocaleString()} ${current === 1 ? 'item is' : 'items are'} in stock.`)
  }
  return applyStockChange(state, productId, variantId, current - quantity, 'sale', note, now)
}

export function setStock(
  state: State,
  productId: string,
  variantId: string,
  stock: number,
  note: string,
  now: string,
): Outcome {
  const error = wholeNumber(stock, 'New stock', 0)
  if (error) return fail(error)
  return applyStockChange(state, productId, variantId, stock, 'adjustment', note, now)
}

export function receiveStock(
  state: State,
  productId: string,
  variantId: string,
  quantity: number,
  note: string,
  now: string,
): Outcome {
  const error = wholeNumber(quantity, 'Received quantity', 1)
  if (error) return fail(error)
  const place = locate(state, productId, variantId)
  if (!place) return fail('Variant not found.')
  const current = state.products[place.productIndex].variants[place.variantIndex].currentStock
  return applyStockChange(state, productId, variantId, current + quantity, 'receipt', note, now)
}

export function recordPurchase(state: State, input: PurchaseInput, now: string): Outcome {
  const place = locate(state, input.productId, input.variantId)
  if (!place) return fail('Variant not found.')
  const boxError = wholeNumber(input.boxes, 'Boxes', 1)
  if (boxError) return fail(boxError)
  const itemError = wholeNumber(input.items, 'Purchased quantity', 1)
  if (itemError) return fail(itemError)

  const next = structuredClone(state)
  const product = next.products[place.productIndex]
  const variant = product.variants[place.variantIndex]
  const receivedItems = input.receiveNow ? input.items : 0
  const purchase: Purchase = {
    id: createId(),
    productId: product.id,
    variantId: variant.id,
    productName: product.name,
    variantName: variant.name,
    sku: variant.sku,
    itemsPerBox: variant.itemsPerBox,
    boxes: input.boxes,
    orderedItems: input.items,
    receivedItems,
    status: purchaseStatus(input.items, receivedItems),
    note: cleanNote(input.note),
    createdAt: now,
    updatedAt: now,
  }
  next.purchases.unshift(purchase)

  if (input.receiveNow) {
    const previousStock = variant.currentStock
    const nextStock = previousStock + input.items
    const stockError = wholeNumber(nextStock, 'Stock', 0)
    if (stockError) return fail(stockError)
    variant.currentStock = nextStock
    product.updatedAt = now
    next.movements.unshift(
      stockMovement(
        product,
        variant,
        previousStock,
        nextStock,
        'purchase',
        cleanNote(input.note) || 'Purchase added to stock',
        now,
        purchase.id,
      ),
    )
  }

  return success(next)
}

export function receivePurchase(
  state: State,
  purchaseId: string,
  items: number,
  note: string,
  now: string,
): Outcome {
  const error = wholeNumber(items, 'Received quantity', 1)
  if (error) return fail(error)
  const purchaseIndex = state.purchases.findIndex((purchase) => purchase.id === purchaseId)
  if (purchaseIndex < 0) return fail('Purchase not found.')
  const existing = state.purchases[purchaseIndex]
  if (existing.status === 'received') return fail('This purchase is already fully received.')
  const place = locate(state, existing.productId, existing.variantId)
  if (!place) return fail('This variant is no longer in the catalog.')

  const next = structuredClone(state)
  const purchase = next.purchases[purchaseIndex]
  const product = next.products[place.productIndex]
  const variant = product.variants[place.variantIndex]
  const previousStock = variant.currentStock
  const nextStock = previousStock + items
  const stockError = wholeNumber(nextStock, 'Stock', 0)
  if (stockError) return fail(stockError)

  variant.currentStock = nextStock
  product.updatedAt = now
  purchase.receivedItems += items
  purchase.status = purchaseStatus(purchase.orderedItems, purchase.receivedItems)
  purchase.updatedAt = now
  next.movements.unshift(
    stockMovement(
      product,
      variant,
      previousStock,
      nextStock,
      'receipt',
      cleanNote(note) || 'Stock received',
      now,
      purchase.id,
    ),
  )
  return success(next)
}
