import type {
  CustomerOrder,
  Movement,
  Offer,
  OrderStatus,
  PaymentMethod,
  PurchaseStatus,
  RecordedOffer,
  SellerProfile,
  State,
} from './types'

export type ProductRow = {
  id: string
  name: string
  image: string
  note: string
  createdAt: string
  updatedAt: string
  position: number
}

export type VariantRow = {
  id: string
  productId: string
  name: string
  sku: string
  itemsPerBox: number
  price: number
  buyingPrice: number
  purchaseUnit: 'box' | 'item'
  currentStock: number
  minimumStock: number
  desiredStock: number
  position: number
}

export type PurchaseRow = {
  id: string
  productId: string
  variantId: string
  productName: string
  variantName: string
  sku: string
  itemsPerBox: number
  boxes: number
  orderedItems: number
  receivedItems: number
  status: PurchaseStatus
  note: string
  createdAt: string
  updatedAt: string
  position: number
}

export type MovementRow = {
  id: string
  type: Movement['type']
  productId: string
  variantId: string
  productName: string
  variantName: string
  sku: string
  delta: number
  previousStock: number
  newStock: number
  note: string
  createdAt: string
  purchaseId: string | null
  position: number
}

export type BuyerRow = {
  id: string
  name: string
  phone: string
  address: string
  note: string
  createdAt: string
  updatedAt: string
  position: number
}

export type OrderRow = {
  id: string
  number: string
  buyerId: string
  buyerName: string
  status: OrderStatus
  subtotal: number
  total: number
  paid: number
  paymentMethod: PaymentMethod
  comment: string
  offerKind: 'discount' | 'gift' | null
  offerId: string | null
  offerName: string | null
  offerPercent: number | null
  offerAmount: number | null
  createdAt: string
  updatedAt: string
  position: number
}

export type LineRow = {
  orderId: string
  position: number
  productId: string
  variantId: string
  productName: string
  variantName: string
  sku: string
  quantity: number
  unitPrice: number
}

export type GiftRow = {
  orderId: string
  position: number
  productId: string
  variantId: string
  productName: string
  variantName: string
  sku: string
  quantity: number
}

export type OfferRow = {
  id: string
  name: string
  minimumAmount: number
  reward: Offer['reward']
  percent: number
  productId: string
  variantId: string
  quantity: number
  position: number
}

export type SellerRow = {
  name: string
  address: string
  gst: string
  businessName: string
  profileImage: string
  logo: string
  facebook: string
  instagram: string
  youtube: string
  whatsapp: string
}

export type DbRows = {
  products: ProductRow[]
  variants: VariantRow[]
  purchases: PurchaseRow[]
  movements: MovementRow[]
  buyers: BuyerRow[]
  orders: OrderRow[]
  lines: LineRow[]
  gifts: GiftRow[]
  offers: OfferRow[]
  seller: SellerRow | null
}

function ordered<T extends { position: number }>(rows: T[]) {
  return [...rows].sort((left, right) => left.position - right.position)
}

function grouped<T extends { orderId: string; position: number }>(rows: T[]) {
  const groups = new Map<string, T[]>()
  for (const row of ordered(rows)) {
    const list = groups.get(row.orderId)
    if (list) list.push(row)
    else groups.set(row.orderId, [row])
  }
  return groups
}

function sellerRow(state: State): SellerRow {
  return {
    name: state.seller?.name ?? '',
    address: state.seller?.address ?? '',
    gst: state.seller?.gst ?? '',
    businessName: state.seller?.businessName ?? '',
    profileImage: state.seller?.profileImage ?? '',
    logo: state.seller?.logo ?? '',
    facebook: state.seller?.facebook ?? '',
    instagram: state.seller?.instagram ?? '',
    youtube: state.seller?.youtube ?? '',
    whatsapp: state.seller?.whatsapp ?? '',
  }
}

function sellerFrom(row: SellerRow | null): SellerProfile | undefined {
  if (!row) return undefined
  const seller: SellerProfile = {
    name: row.name,
    address: row.address,
    gst: row.gst,
    businessName: row.businessName,
    ...(row.profileImage ? { profileImage: row.profileImage } : {}),
    ...(row.logo ? { logo: row.logo } : {}),
    facebook: row.facebook,
    instagram: row.instagram,
    youtube: row.youtube,
    whatsapp: row.whatsapp,
  }
  const filled = [
    seller.name,
    seller.address,
    seller.gst,
    seller.businessName,
    seller.profileImage,
    seller.logo,
    seller.facebook,
    seller.instagram,
    seller.youtube,
    seller.whatsapp,
  ].some(Boolean)
  return filled ? seller : undefined
}

export function toRows(state: State): DbRows {
  const products: ProductRow[] = []
  const variants: VariantRow[] = []
  state.products.forEach((product, position) => {
    products.push({
      id: product.id,
      name: product.name,
      image: product.image ?? '',
      note: product.note ?? '',
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      position,
    })
    product.variants.forEach((variant, variantPosition) => {
      variants.push({
        id: variant.id,
        productId: product.id,
        name: variant.name,
        sku: variant.sku,
        itemsPerBox: variant.itemsPerBox,
        price: variant.price,
        buyingPrice: variant.buyingPrice ?? 0,
        purchaseUnit: variant.purchaseUnit ?? 'box',
        currentStock: variant.currentStock,
        minimumStock: variant.minimumStock,
        desiredStock: variant.desiredStock,
        position: variantPosition,
      })
    })
  })

  const lines: LineRow[] = []
  const gifts: GiftRow[] = []
  const orders: OrderRow[] = state.orders.map((order, position) => {
    order.lines.forEach((line, linePosition) => {
      lines.push({
        orderId: order.id,
        position: linePosition,
        productId: line.productId,
        variantId: line.variantId,
        productName: line.productName,
        variantName: line.variantName,
        sku: line.sku,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })
    })
    if (order.offer?.kind === 'gift') {
      order.offer.items.forEach((item, giftPosition) => {
        gifts.push({
          orderId: order.id,
          position: giftPosition,
          productId: item.productId,
          variantId: item.variantId,
          productName: item.productName,
          variantName: item.variantName,
          sku: item.sku,
          quantity: item.quantity,
        })
      })
    }
    return {
      id: order.id,
      number: order.number,
      buyerId: order.buyerId,
      buyerName: order.buyerName,
      status: order.status,
      subtotal: order.subtotal,
      total: order.total,
      paid: order.paid,
      paymentMethod: order.paymentMethod,
      comment: order.comment,
      offerKind: order.offer?.kind ?? null,
      offerId: order.offer?.offerId ?? null,
      offerName: order.offer?.offerName ?? null,
      offerPercent: order.offer?.kind === 'discount' ? order.offer.percent : null,
      offerAmount: order.offer?.kind === 'discount' ? order.offer.amount : null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      position,
    }
  })

  return {
    products,
    variants,
    purchases: state.purchases.map((purchase, position) => ({ ...purchase, position })),
    movements: state.movements.map((movement, position) => ({
      id: movement.id,
      type: movement.type,
      productId: movement.productId,
      variantId: movement.variantId,
      productName: movement.productName,
      variantName: movement.variantName,
      sku: movement.sku,
      delta: movement.delta,
      previousStock: movement.previousStock,
      newStock: movement.newStock,
      note: movement.note,
      createdAt: movement.createdAt,
      purchaseId: movement.purchaseId ?? null,
      position,
    })),
    buyers: state.buyers.map((buyer, position) => ({ ...buyer, position })),
    orders,
    lines,
    gifts,
    offers: state.offers.map((offer, position) => ({ ...offer, position })),
    seller: sellerRow(state),
  }
}

function offerFrom(row: OrderRow, gifts: GiftRow[]): RecordedOffer | null {
  if (row.offerKind === 'discount') {
    return {
      kind: 'discount',
      offerId: row.offerId ?? '',
      offerName: row.offerName ?? '',
      percent: row.offerPercent ?? 0,
      amount: row.offerAmount ?? 0,
    }
  }
  if (row.offerKind === 'gift') {
    return {
      kind: 'gift',
      offerId: row.offerId ?? '',
      offerName: row.offerName ?? '',
      items: gifts.map((gift) => ({
        productId: gift.productId,
        variantId: gift.variantId,
        productName: gift.productName,
        variantName: gift.variantName,
        sku: gift.sku,
        quantity: gift.quantity,
      })),
    }
  }
  return null
}

export function fromRows(rows: DbRows): State {
  const variantsByProduct = new Map<string, VariantRow[]>()
  for (const variant of ordered(rows.variants)) {
    const list = variantsByProduct.get(variant.productId)
    if (list) list.push(variant)
    else variantsByProduct.set(variant.productId, [variant])
  }
  const linesByOrder = grouped(rows.lines)
  const giftsByOrder = grouped(rows.gifts)

  const orders: CustomerOrder[] = ordered(rows.orders).map((order) => ({
    id: order.id,
    number: order.number,
    buyerId: order.buyerId,
    buyerName: order.buyerName,
    status: order.status,
    lines: (linesByOrder.get(order.id) ?? []).map((line) => ({
      productId: line.productId,
      variantId: line.variantId,
      productName: line.productName,
      variantName: line.variantName,
      sku: line.sku,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    })),
    subtotal: order.subtotal,
    offer: offerFrom(order, giftsByOrder.get(order.id) ?? []),
    total: order.total,
    paid: order.paid,
    paymentMethod: order.paymentMethod,
    comment: order.comment,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  }))

  const sellerProfile = sellerFrom(rows.seller)

  return {
    products: ordered(rows.products).map((product) => ({
      id: product.id,
      name: product.name,
      ...(product.image ? { image: product.image } : {}),
      ...(product.note ? { note: product.note } : {}),
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      variants: (variantsByProduct.get(product.id) ?? []).map((variant) => ({
        id: variant.id,
        name: variant.name,
        sku: variant.sku,
        itemsPerBox: variant.itemsPerBox,
        price: variant.price,
        ...(variant.buyingPrice ? { buyingPrice: variant.buyingPrice } : {}),
        purchaseUnit: variant.purchaseUnit,
        currentStock: variant.currentStock,
        minimumStock: variant.minimumStock,
        desiredStock: variant.desiredStock,
      })),
    })),
    purchases: ordered(rows.purchases).map(({ position: _position, ...purchase }) => purchase),
    movements: ordered(rows.movements).map((movement) => {
      const next: Movement = {
        id: movement.id,
        type: movement.type,
        productId: movement.productId,
        variantId: movement.variantId,
        productName: movement.productName,
        variantName: movement.variantName,
        sku: movement.sku,
        delta: movement.delta,
        previousStock: movement.previousStock,
        newStock: movement.newStock,
        note: movement.note,
        createdAt: movement.createdAt,
      }
      if (movement.purchaseId) next.purchaseId = movement.purchaseId
      return next
    }),
    buyers: ordered(rows.buyers).map(({ position: _position, ...buyer }) => buyer),
    orders,
    offers: ordered(rows.offers).map(({ position: _position, ...offer }) => offer),
    ...(sellerProfile ? { seller: sellerProfile } : {}),
  }
}
