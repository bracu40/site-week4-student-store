const prisma = require("../db/db")

// When we return an order, we always include its line items and each item's
// product, so the frontend can render a full receipt in one round-trip.
const ORDER_INCLUDE = {
  orderItems: {
    include: { product: true },
  },
}

/**
 * Order model — all database access for the Order table.
 * See planning.md > Section 1 (Order), Section 2 (endpoints 7–11),
 * and Section 3 (transactional POST /orders).
 */
class Order {
  /**
   * List orders, newest first. Optionally filter by customer email
   * (case-insensitive substring match) — stretch feature.
   *
   * @param {Object} opts
   * @param {string} [opts.email]
   * @returns {Promise<Order[]>}
   */
  static async list({ email } = {}) {
    const where = {}
    if (email) {
      where.email = { contains: email, mode: "insensitive" }
    }

    return prisma.order.findMany({
      where,
      include: ORDER_INCLUDE,
      orderBy: { createdAt: "desc" },
    })
  }

  /**
   * Fetch a single order by id, including its items and their products.
   * @returns {Promise<Order|null>} null when not found.
   */
  static async get(id) {
    return prisma.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    })
  }

  /**
   * Transactionally create an order and all of its line items, and store the
   * computed total. See planning.md > Section 3 for the full flow.
   *
   * @param {Object} input
   * @param {string} input.customer
   * @param {string} input.email
   * @param {string} [input.status]
   * @param {Array<{productId:number, quantity:number}>} input.items
   * @returns {Promise<Order>} the created order, with items + products included.
   * @throws {Error} with .code "PRODUCT_NOT_FOUND" and .productId if any
   *                 productId does not exist (nothing is written in that case).
   */
  static async create({ customer, email, status, items }) {
    // 1. Resolve products referenced by the items (single query).
    const ids = [...new Set(items.map((item) => item.productId))]
    const products = await prisma.product.findMany({ where: { id: { in: ids } } })
    const priceById = new Map(products.map((p) => [p.id, p.price]))

    // 2. Fail fast if any referenced product does not exist — before any write.
    const missingId = ids.find((id) => !priceById.has(id))
    if (missingId !== undefined) {
      const err = new Error(`Product with id ${missingId} does not exist`)
      err.code = "PRODUCT_NOT_FOUND"
      err.productId = missingId
      throw err
    }

    // 3. Build the line items with a price snapshot, and compute the total.
    let totalPrice = 0
    const lineItems = items.map((item) => {
      const price = priceById.get(item.productId)
      totalPrice += price * item.quantity
      return { productId: item.productId, quantity: item.quantity, price }
    })
    totalPrice = Math.round(totalPrice * 100) / 100 // 2-decimal money

    // 4. Single atomic nested write: Order + all OrderItems together, or neither.
    //    Prisma runs a nested create in one transaction, so a failure on any
    //    item rolls the whole thing back (no partial order).
    return prisma.order.create({
      data: {
        customer,
        email,
        status: status || "pending",
        totalPrice,
        orderItems: { create: lineItems },
      },
      include: ORDER_INCLUDE,
    })
  }

  /**
   * Update an order's metadata (status / customer / email). Line items are not
   * edited here. Returns the updated order with items included.
   */
  static async update(id, data) {
    return prisma.order.update({
      where: { id },
      data,
      include: ORDER_INCLUDE,
    })
  }

  /**
   * Add a single line item to an existing order and recompute the order total,
   * atomically (stretch: POST /orders/:order_id/items).
   *
   * Mirrors the safety rules of create(): the client sends only productId +
   * quantity; the server snapshots the product's current price. If the order or
   * product does not exist, nothing is written.
   *
   * @param {number} orderId
   * @param {{productId:number, quantity:number}} item
   * @returns {Promise<Order>} the updated order with all items included.
   * @throws {Error} code "ORDER_NOT_FOUND" or "PRODUCT_NOT_FOUND".
   */
  static async addItem(orderId, { productId, quantity }) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } })
      if (!order) {
        const err = new Error(`Order with id ${orderId} not found`)
        err.code = "ORDER_NOT_FOUND"
        throw err
      }

      const product = await tx.product.findUnique({ where: { id: productId } })
      if (!product) {
        const err = new Error(`Product with id ${productId} does not exist`)
        err.code = "PRODUCT_NOT_FOUND"
        err.productId = productId
        throw err
      }

      await tx.orderItem.create({
        data: { orderId, productId, quantity, price: product.price },
      })

      const newTotal = Math.round((order.totalPrice + product.price * quantity) * 100) / 100
      return tx.order.update({
        where: { id: orderId },
        data: { totalPrice: newTotal },
        include: ORDER_INCLUDE,
      })
    })
  }

  /**
   * Delete an order. Cascades to its OrderItem rows (see schema onDelete).
   */
  static async remove(id) {
    return prisma.order.delete({
      where: { id },
      include: ORDER_INCLUDE,
    })
  }
}

module.exports = Order
