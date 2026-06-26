require("dotenv").config()

const express = require("express")
const cors = require("cors")

const Product = require("./models/product")
const Order = require("./models/order")
const OrderItem = require("./models/orderItem")

const app = express()

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------
app.use(cors()) // frontend (5173) and API (3001) are different origins — see planning.md
app.use(express.json()) // parse JSON request bodies into req.body

// Small helper: parse and validate an :id route param as a positive integer.
function parseId(raw) {
  const id = Number(raw)
  if (!Number.isInteger(id) || id <= 0) return null
  return id
}

// ---------------------------------------------------------------------------
// Health check — GET /
// ---------------------------------------------------------------------------
app.get("/", (req, res) => {
  res.json({ message: "Student Store API is running 🛍️", status: "ok" })
})

// ===========================================================================
// PRODUCTS
// ===========================================================================

// GET /products — list, with optional ?category= and ?sort= (Milestone 2)
app.get("/products", async (req, res) => {
  try {
    const { category, sort } = req.query
    const products = await Product.list({ category, sort })
    res.json({ products })
  } catch (err) {
    console.error("GET /products failed:", err)
    res.status(500).json({ error: "Failed to fetch products" })
  }
})

// GET /products/:id — fetch one
app.get("/products/:id", async (req, res) => {
  const id = parseId(req.params.id)
  if (id === null) return res.status(400).json({ error: "Product id must be a number" })

  try {
    const product = await Product.get(id)
    if (!product) return res.status(404).json({ error: `Product with id ${id} not found` })
    res.json({ product })
  } catch (err) {
    console.error(`GET /products/${id} failed:`, err)
    res.status(500).json({ error: "Failed to fetch product" })
  }
})

// POST /products — create
app.post("/products", async (req, res) => {
  const { name, price, description, imageUrl, category } = req.body || {}

  if (!name || typeof price !== "number" || Number.isNaN(price)) {
    return res.status(400).json({ error: "name and price are required" })
  }

  try {
    const product = await Product.create({ name, price, description, imageUrl, category })
    res.status(201).json({ product })
  } catch (err) {
    console.error("POST /products failed:", err)
    res.status(500).json({ error: "Failed to create product" })
  }
})

// PUT /products/:id — update
app.put("/products/:id", async (req, res) => {
  const id = parseId(req.params.id)
  if (id === null) return res.status(400).json({ error: "Product id must be a number" })

  // Only forward fields that were actually provided.
  const { name, price, description, imageUrl, category } = req.body || {}
  const data = {}
  if (name !== undefined) data.name = name
  if (price !== undefined) data.price = price
  if (description !== undefined) data.description = description
  if (imageUrl !== undefined) data.imageUrl = imageUrl
  if (category !== undefined) data.category = category

  try {
    const existing = await Product.get(id)
    if (!existing) return res.status(404).json({ error: `Product with id ${id} not found` })

    const product = await Product.update(id, data)
    res.json({ product })
  } catch (err) {
    console.error(`PUT /products/${id} failed:`, err)
    res.status(500).json({ error: "Failed to update product" })
  }
})

// DELETE /products/:id — delete (cascades to OrderItems)
app.delete("/products/:id", async (req, res) => {
  const id = parseId(req.params.id)
  if (id === null) return res.status(400).json({ error: "Product id must be a number" })

  try {
    const existing = await Product.get(id)
    if (!existing) return res.status(404).json({ error: `Product with id ${id} not found` })

    const product = await Product.remove(id)
    res.json({ product })
  } catch (err) {
    console.error(`DELETE /products/${id} failed:`, err)
    res.status(500).json({ error: "Failed to delete product" })
  }
})

// ===========================================================================
// ORDERS
// ===========================================================================

// GET /orders — list all orders, newest first. Optional ?email= filter (stretch).
app.get("/orders", async (req, res) => {
  try {
    const { email } = req.query
    const orders = await Order.list({ email })
    res.json({ orders })
  } catch (err) {
    console.error("GET /orders failed:", err)
    res.status(500).json({ error: "Failed to fetch orders" })
  }
})

// GET /order-items — fetch every order item in the DB (stretch).
app.get("/order-items", async (req, res) => {
  try {
    const orderItems = await OrderItem.listAll()
    res.json({ orderItems })
  } catch (err) {
    console.error("GET /order-items failed:", err)
    res.status(500).json({ error: "Failed to fetch order items" })
  }
})

// GET /orders/:id — fetch one order, including its items + their products.
app.get("/orders/:id", async (req, res) => {
  const id = parseId(req.params.id)
  if (id === null) return res.status(400).json({ error: "Order id must be a number" })

  try {
    const order = await Order.get(id)
    if (!order) return res.status(404).json({ error: `Order with id ${id} not found` })
    res.json({ order })
  } catch (err) {
    console.error(`GET /orders/${id} failed:`, err)
    res.status(500).json({ error: "Failed to fetch order" })
  }
})

// POST /orders — transactionally create an order and its items (see planning.md §3).
app.post("/orders", async (req, res) => {
  const { customer, email, status, items } = req.body || {}

  // 1. Validate the request shape (no DB writes yet).
  if (!customer || !email) {
    return res.status(400).json({ error: "customer and email are required" })
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "An order must contain at least one item" })
  }
  const everyItemValid = items.every(
    (item) =>
      item &&
      Number.isInteger(item.productId) &&
      item.productId > 0 &&
      Number.isInteger(item.quantity) &&
      item.quantity > 0
  )
  if (!everyItemValid) {
    return res.status(400).json({ error: "Each item needs a productId and a positive quantity" })
  }

  // 2. Create atomically; translate a missing-product error into a 404.
  try {
    const order = await Order.create({ customer, email, status, items })
    res.status(201).json({ order })
  } catch (err) {
    if (err.code === "PRODUCT_NOT_FOUND") {
      return res.status(404).json({ error: err.message })
    }
    // Backstop: a foreign-key violation inside the transaction (e.g. a product
    // deleted between the existence check and the write) also means a bad product.
    if (err.code === "P2003" || err.code === "P2025") {
      return res.status(404).json({ error: "One or more products do not exist" })
    }
    console.error("POST /orders failed:", err)
    res.status(500).json({ error: "Failed to create order" })
  }
})

// POST /orders/:order_id/items — add a line item to an existing order (stretch).
// Recomputes the order total atomically; client sends only productId + quantity.
app.post("/orders/:order_id/items", async (req, res) => {
  const orderId = parseId(req.params.order_id)
  if (orderId === null) return res.status(400).json({ error: "Order id must be a number" })

  const { productId, quantity } = req.body || {}
  if (
    !Number.isInteger(productId) ||
    productId <= 0 ||
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    return res.status(400).json({ error: "An item needs a productId and a positive quantity" })
  }

  try {
    const order = await Order.addItem(orderId, { productId, quantity })
    res.status(201).json({ order })
  } catch (err) {
    if (err.code === "ORDER_NOT_FOUND") {
      return res.status(404).json({ error: err.message })
    }
    if (err.code === "PRODUCT_NOT_FOUND" || err.code === "P2003" || err.code === "P2025") {
      return res.status(404).json({ error: err.message || "Product does not exist" })
    }
    console.error(`POST /orders/${orderId}/items failed:`, err)
    res.status(500).json({ error: "Failed to add item to order" })
  }
})

// PUT /orders/:id — update order metadata (status / customer / email).
app.put("/orders/:id", async (req, res) => {
  const id = parseId(req.params.id)
  if (id === null) return res.status(400).json({ error: "Order id must be a number" })

  const { status, customer, email } = req.body || {}
  const data = {}
  if (status !== undefined) data.status = status
  if (customer !== undefined) data.customer = customer
  if (email !== undefined) data.email = email

  try {
    const existing = await Order.get(id)
    if (!existing) return res.status(404).json({ error: `Order with id ${id} not found` })

    const order = await Order.update(id, data)
    res.json({ order })
  } catch (err) {
    console.error(`PUT /orders/${id} failed:`, err)
    res.status(500).json({ error: "Failed to update order" })
  }
})

// DELETE /orders/:id — delete an order (cascades to its OrderItems).
app.delete("/orders/:id", async (req, res) => {
  const id = parseId(req.params.id)
  if (id === null) return res.status(400).json({ error: "Order id must be a number" })

  try {
    const existing = await Order.get(id)
    if (!existing) return res.status(404).json({ error: `Order with id ${id} not found` })

    const order = await Order.remove(id)
    res.json({ order })
  } catch (err) {
    console.error(`DELETE /orders/${id} failed:`, err)
    res.status(500).json({ error: "Failed to delete order" })
  }
})

// ===========================================================================
// 404 fallback + server start
// ===========================================================================
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` })
})

const PORT = process.env.PORT || 3001
// Only listen when run directly (so tests/tools can import the app if needed).
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🛍️  Student Store API listening on http://localhost:${PORT}`)
  })
}

module.exports = app
