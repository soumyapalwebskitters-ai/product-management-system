import {
  fromRows,
  toRows,
  type BuyerRow,
  type DbRows,
  type GiftRow,
  type LineRow,
  type MovementRow,
  type OfferRow,
  type OrderRow,
  type ProductRow,
  type PurchaseRow,
  type SellerRow,
  type VariantRow,
} from './records'
import type { Sql, SqlStatement, SqlValue } from './sql'
import type { State } from './types'

function statement(sql: string, params: SqlValue[] = []): SqlStatement {
  return { sql, params }
}

export async function readShop(db: Sql): Promise<{ revision: number; state: State } | null> {
  const shop = await db.first<{ revision: number }>('SELECT revision FROM shop WHERE id = 1')
  if (!shop) return null

  const products = await db.all<ProductRow>(
    `SELECT id, name, image, note, created_at AS createdAt, updated_at AS updatedAt, position FROM products`,
  )
  const variants = await db.all<VariantRow>(
    `SELECT id, product_id AS productId, name, sku, items_per_box AS itemsPerBox, price,
            buying_price AS buyingPrice, purchase_unit AS purchaseUnit,
            current_stock AS currentStock, minimum_stock AS minimumStock, desired_stock AS desiredStock,
            position
     FROM variants`,
  )
  const purchases = await db.all<PurchaseRow>(
    `SELECT id, product_id AS productId, variant_id AS variantId, product_name AS productName,
            variant_name AS variantName, sku, items_per_box AS itemsPerBox, boxes,
            ordered_items AS orderedItems, received_items AS receivedItems, status, note,
            created_at AS createdAt, updated_at AS updatedAt, position
     FROM purchases`,
  )
  const movements = await db.all<MovementRow>(
    `SELECT id, type, product_id AS productId, variant_id AS variantId, product_name AS productName,
            variant_name AS variantName, sku, delta, previous_stock AS previousStock, new_stock AS newStock,
            note, created_at AS createdAt, purchase_id AS purchaseId, position
     FROM movements`,
  )
  const buyers = await db.all<BuyerRow>(
    `SELECT id, name, phone, address, note, created_at AS createdAt, updated_at AS updatedAt, position
     FROM buyers`,
  )
  const orders = await db.all<OrderRow>(
    `SELECT id, number, buyer_id AS buyerId, buyer_name AS buyerName, status, subtotal, total, paid,
            payment_method AS paymentMethod, comment, offer_kind AS offerKind, offer_id AS offerId,
            offer_name AS offerName, offer_percent AS offerPercent, offer_amount AS offerAmount,
            created_at AS createdAt, updated_at AS updatedAt, position
     FROM orders`,
  )
  const lines = await db.all<LineRow>(
    `SELECT order_id AS orderId, position, product_id AS productId, variant_id AS variantId,
            product_name AS productName, variant_name AS variantName, sku, quantity, unit_price AS unitPrice
     FROM order_lines`,
  )
  const gifts = await db.all<GiftRow>(
    `SELECT order_id AS orderId, position, product_id AS productId, variant_id AS variantId,
            product_name AS productName, variant_name AS variantName, sku, quantity
     FROM order_gifts`,
  )
  const offers = await db.all<OfferRow>(
    `SELECT id, name, minimum_amount AS minimumAmount, reward, percent, product_id AS productId,
            variant_id AS variantId, quantity, position
     FROM offers`,
  )
  const seller = await db.first<SellerRow>(
    `SELECT name, address, gst, business_name AS businessName, profile_image AS profileImage, logo,
            facebook, instagram, youtube, whatsapp
     FROM seller WHERE id = 1`,
  )

  const tables: DbRows = { products, variants, purchases, movements, buyers, orders, lines, gifts, offers, seller }
  return { revision: shop.revision, state: fromRows(tables) }
}

export async function writeShop(db: Sql, state: State, revision: number) {
  const tables = toRows(state)
  const statements: SqlStatement[] = [
    statement('DELETE FROM order_gifts'),
    statement('DELETE FROM order_lines'),
    statement('DELETE FROM orders'),
    statement('DELETE FROM movements'),
    statement('DELETE FROM purchases'),
    statement('DELETE FROM variants'),
    statement('DELETE FROM products'),
    statement('DELETE FROM offers'),
    statement('DELETE FROM buyers'),
    statement('DELETE FROM seller'),
  ]

  for (const product of tables.products) {
    statements.push(
      statement('INSERT INTO products (id, name, image, note, created_at, updated_at, position) VALUES (?, ?, ?, ?, ?, ?, ?)', [
        product.id,
        product.name,
        product.image,
        product.note,
        product.createdAt,
        product.updatedAt,
        product.position,
      ]),
    )
  }
  for (const variant of tables.variants) {
    statements.push(
      statement(
        `INSERT INTO variants (
           id, product_id, name, sku, items_per_box, price, buying_price, purchase_unit, current_stock, minimum_stock, desired_stock, position
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          variant.id,
          variant.productId,
          variant.name,
          variant.sku,
          variant.itemsPerBox,
          variant.price,
          variant.buyingPrice,
          variant.purchaseUnit,
          variant.currentStock,
          variant.minimumStock,
          variant.desiredStock,
          variant.position,
        ],
      ),
    )
  }
  for (const purchase of tables.purchases) {
    statements.push(
      statement(
        `INSERT INTO purchases (
           id, product_id, variant_id, product_name, variant_name, sku, items_per_box, boxes,
           ordered_items, received_items, status, note, created_at, updated_at, position
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          purchase.id,
          purchase.productId,
          purchase.variantId,
          purchase.productName,
          purchase.variantName,
          purchase.sku,
          purchase.itemsPerBox,
          purchase.boxes,
          purchase.orderedItems,
          purchase.receivedItems,
          purchase.status,
          purchase.note,
          purchase.createdAt,
          purchase.updatedAt,
          purchase.position,
        ],
      ),
    )
  }
  for (const movement of tables.movements) {
    statements.push(
      statement(
        `INSERT INTO movements (
           id, type, product_id, variant_id, product_name, variant_name, sku, delta, previous_stock,
           new_stock, note, created_at, purchase_id, position
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          movement.id,
          movement.type,
          movement.productId,
          movement.variantId,
          movement.productName,
          movement.variantName,
          movement.sku,
          movement.delta,
          movement.previousStock,
          movement.newStock,
          movement.note,
          movement.createdAt,
          movement.purchaseId,
          movement.position,
        ],
      ),
    )
  }
  for (const buyer of tables.buyers) {
    statements.push(
      statement(
        `INSERT INTO buyers (id, name, phone, address, note, created_at, updated_at, position)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [buyer.id, buyer.name, buyer.phone, buyer.address, buyer.note, buyer.createdAt, buyer.updatedAt, buyer.position],
      ),
    )
  }
  for (const order of tables.orders) {
    statements.push(
      statement(
        `INSERT INTO orders (
           id, number, buyer_id, buyer_name, status, subtotal, total, paid, payment_method, comment,
           offer_kind, offer_id, offer_name, offer_percent, offer_amount, created_at, updated_at, position
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          order.id,
          order.number,
          order.buyerId,
          order.buyerName,
          order.status,
          order.subtotal,
          order.total,
          order.paid,
          order.paymentMethod,
          order.comment,
          order.offerKind,
          order.offerId,
          order.offerName,
          order.offerPercent,
          order.offerAmount,
          order.createdAt,
          order.updatedAt,
          order.position,
        ],
      ),
    )
  }
  for (const line of tables.lines) {
    statements.push(
      statement(
        `INSERT INTO order_lines (
           order_id, position, product_id, variant_id, product_name, variant_name, sku, quantity, unit_price
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          line.orderId,
          line.position,
          line.productId,
          line.variantId,
          line.productName,
          line.variantName,
          line.sku,
          line.quantity,
          line.unitPrice,
        ],
      ),
    )
  }
  for (const gift of tables.gifts) {
    statements.push(
      statement(
        `INSERT INTO order_gifts (
           order_id, position, product_id, variant_id, product_name, variant_name, sku, quantity
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          gift.orderId,
          gift.position,
          gift.productId,
          gift.variantId,
          gift.productName,
          gift.variantName,
          gift.sku,
          gift.quantity,
        ],
      ),
    )
  }
  for (const offer of tables.offers) {
    statements.push(
      statement(
        `INSERT INTO offers (
           id, name, minimum_amount, reward, percent, product_id, variant_id, quantity, position
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          offer.id,
          offer.name,
          offer.minimumAmount,
          offer.reward,
          offer.percent,
          offer.productId,
          offer.variantId,
          offer.quantity,
          offer.position,
        ],
      ),
    )
  }
  statements.push(
    statement(
      `INSERT INTO seller (
         id, name, address, gst, business_name, profile_image, logo, facebook, instagram, youtube, whatsapp
       ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      tables.seller
        ? [
            tables.seller.name,
            tables.seller.address,
            tables.seller.gst,
            tables.seller.businessName,
            tables.seller.profileImage,
            tables.seller.logo,
            tables.seller.facebook,
            tables.seller.instagram,
            tables.seller.youtube,
            tables.seller.whatsapp,
          ]
        : ['', '', '', '', '', '', '', '', '', ''],
    ),
  )
  statements.push(
    statement(
      `INSERT INTO shop (id, revision) VALUES (1, ?)
       ON CONFLICT(id) DO UPDATE SET revision = excluded.revision`,
      [revision],
    ),
  )

  await db.batch(statements)
}
