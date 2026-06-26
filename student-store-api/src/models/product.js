const prisma = require("../db/db")

/**
 * Product model — all database access for the Product table goes through here.
 * See planning.md > Section 1 (Product) and Section 2 (endpoints 2–6).
 */
class Product {
  /**
   * List products with optional filtering and sorting (Milestone 2).
   *
   * @param {Object} opts
   * @param {string} [opts.category] - exact-match category filter.
   * @param {string} [opts.sort]     - one of: price, -price, name, -name, newest.
   * @returns {Promise<Product[]>}
   */
  static async list({ category, sort } = {}) {
    // Build the `where` clause only when a category was provided.
    const where = {}
    if (category) {
      where.category = category
    }

    return prisma.product.findMany({
      where,
      orderBy: Product.#buildOrderBy(sort),
    })
  }

  /**
   * Translate a `sort` query param into a Prisma `orderBy` clause.
   * Default (unknown / missing): order by id ascending.
   */
  static #buildOrderBy(sort) {
    switch (sort) {
      case "price":
        return { price: "asc" }
      case "-price":
        return { price: "desc" }
      case "name":
        return { name: "asc" }
      case "-name":
        return { name: "desc" }
      case "newest":
        return { createdAt: "desc" }
      default:
        return { id: "asc" }
    }
  }

  /**
   * Fetch a single product by id.
   * @returns {Promise<Product|null>} null when not found.
   */
  static async get(id) {
    return prisma.product.findUnique({ where: { id } })
  }

  /**
   * Create a product. Caller is responsible for validation.
   */
  static async create({ name, price, description, imageUrl, category }) {
    return prisma.product.create({
      data: { name, price, description, imageUrl, category },
    })
  }

  /**
   * Update a product. `data` may contain any subset of the editable fields.
   */
  static async update(id, data) {
    return prisma.product.update({
      where: { id },
      data,
    })
  }

  /**
   * Delete a product. Cascades to its OrderItem rows (see schema onDelete).
   */
  static async remove(id) {
    return prisma.product.delete({ where: { id } })
  }
}

module.exports = Product
