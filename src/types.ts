export type Variant = {
  id: string
  name: string
  sku: string
  itemsPerBox: number
  price: number
  /** What the shop pays for one item. */
  buyingPrice?: number
  currentStock: number
  minimumStock: number
  desiredStock: number
}

export type Product = {
  id: string
  name: string
  /** Cropped product photo, as a JPEG data URL. */
  image?: string
  note?: string
  variants: Variant[]
  createdAt: string
  updatedAt: string
}

export type VariantInput = {
  id?: string
  name: string
  sku: string
  itemsPerBox: number
  price?: number
  buyingPrice?: number
  currentStock: number
  minimumStock: number
  desiredStock: number
}

export type ProductInput = {
  name: string
  image?: string
  note?: string
  variants: VariantInput[]
}

export type PurchaseStatus = 'ordered' | 'partial' | 'received'

export type Purchase = {
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
}

export type MovementType = 'sale' | 'adjustment' | 'receipt' | 'purchase'

export type Movement = {
  id: string
  type: MovementType
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
  purchaseId?: string
}

export type PurchaseInput = {
  productId: string
  variantId: string
  boxes: number
  items: number
  receiveNow: boolean
  note: string
}

export type Buyer = {
  id: string
  name: string
  phone: string
  address: string
  note: string
  createdAt: string
  updatedAt: string
}

export type OrderStatus = 'placed' | 'delivered' | 'cancelled'

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'bank'

export type OrderLine = {
  productId: string
  variantId: string
  productName: string
  variantName: string
  sku: string
  quantity: number
  unitPrice: number
}

export type GiftLine = {
  productId: string
  variantId: string
  productName: string
  variantName: string
  sku: string
  quantity: number
}

export type RecordedOffer =
  | {
      kind: 'discount'
      offerId: string
      offerName: string
      percent: number
      amount: number
    }
  | {
      kind: 'gift'
      offerId: string
      offerName: string
      items: GiftLine[]
    }

export type CustomerOrder = {
  id: string
  /** Short unique bill number, such as ORD-1004. */
  number: string
  buyerId: string
  buyerName: string
  status: OrderStatus
  lines: OrderLine[]
  subtotal: number
  offer: RecordedOffer | null
  total: number
  /** Rupees already received toward this bill. */
  paid: number
  paymentMethod: PaymentMethod
  comment: string
  createdAt: string
  updatedAt: string
}

export type Offer = {
  id: string
  name: string
  minimumAmount: number
  reward: 'discount' | 'gift'
  percent: number
  productId: string
  variantId: string
  quantity: number
}

export type SellerProfile = {
  name: string
  address: string
  gst: string
  businessName: string
  profileImage?: string
  logo?: string
  facebook: string
  instagram: string
  youtube: string
  whatsapp: string
}

export type State = {
  products: Product[]
  purchases: Purchase[]
  movements: Movement[]
  buyers: Buyer[]
  orders: CustomerOrder[]
  offers: Offer[]
  seller?: SellerProfile
}
