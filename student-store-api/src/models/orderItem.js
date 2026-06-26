const prisma = require("../db/db")

/**
 * OrderItem model — direct access to the join table.
 *
 * In normal operation OrderItems are created as part of the POST /orders nested
 * write (see models/order.js), so the heavy lifting lives there. This class
 * exists for completeness (Milestone 4) and to support fetching items directly.
 */
class OrderItem {
  /**
   * Create a single order item. `price` is the unit price snapshot; if it is not
   * supplied, fall back to the product's current price.
   */
  static async create({ orderId, productId, quantity = 1, price }) {
    let unitPrice = price
    if (unitPrice === undefined || unitPrice === null) {
      const product = await prisma.product.findUnique({ where: { id: productId } })
      if (!product) {
        const err = new Error(`Product with id ${productId} does not exist`)
        err.code = "PRODUCT_NOT_FOUND"
        err.productId = productId
        throw err
      }
      unitPrice = product.price
    }

    return prisma.orderItem.create({
      data: { orderId, productId, quantity, price: unitPrice },
      include: { product: true },
    })
  }

  /**
   * Fetch every order item in the database, including each item's product
   * (stretch: GET /order-items).
   */
  static async listAll() {
    return prisma.orderItem.findMany({
      include: { product: true },
      orderBy: { id: "asc" },
    })
  }

  /**
   * Fetch all items for a given order, including each item's product.
   */
  static async listForOrder(orderId) {
    return prisma.orderItem.findMany({
      where: { orderId },
      include: { product: true },
    })
  }

  /**
   * Fetch a single order item by id, including its product.
   */
  static async get(id) {
    return prisma.orderItem.findUnique({
      where: { id },
      include: { product: true },
    })
  }
}

module.exports = OrderItem
