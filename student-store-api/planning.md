# Student Store API — System Spec (`planning.md`)

This document is the source of truth for the Student Store backend. It is written
**before** the schema, models, and routes so that implementation is a translation
of the spec rather than an exploration. Sections 1–3 are the design; the
**Decisions Log** and **Spec Reconciliation** sections at the bottom are filled in
as each milestone is completed.

---

## Section 1: Data Models

Three models: **Product**, **Order**, **OrderItem**. `OrderItem` is a join/line-item
table that sits at the intersection of `Order` and `Product`.

Conventions:
- All primary keys are `Int`, `@id`, `@default(autoincrement())`.
- Money is stored as `Float` (maps cleanly to PostgreSQL `double precision`; fine for
  this project — a production system would use `Decimal`).
- Every model carries `createdAt` and `updatedAt` timestamps for auditing / cache
  invalidation on the frontend.

### Product

| Field       | Prisma type | Required? | Default               | Notes                                  |
|-------------|-------------|-----------|-----------------------|----------------------------------------|
| `id`        | `Int`       | required  | `autoincrement()`     | Primary key.                           |
| `name`      | `String`    | required  | —                     | Display name.                          |
| `description`| `String`   | optional  | —                     | Long-form description.                 |
| `price`     | `Float`     | required  | —                     | Unit price in USD.                     |
| `imageUrl`  | `String`    | optional  | —                     | Maps `image_url` from the seed JSON.   |
| `category`  | `String`    | optional  | —                     | e.g. `Apparel`, `Books`, `Snacks`.     |
| `createdAt` | `DateTime`  | required  | `now()`               | Auto-populated on create.              |
| `updatedAt` | `DateTime`  | required  | `@updatedAt`          | Auto-updated on every write.           |
| `orderItems`| `OrderItem[]`| relation | —                     | Back-relation: line items referencing this product. |

**Primary key:** `id`, auto-increments.
**Relationships:** one Product → many OrderItems (back-relation only; the FK lives on `OrderItem`).

### Order

| Field        | Prisma type   | Required? | Default        | Notes                                            |
|--------------|---------------|-----------|----------------|--------------------------------------------------|
| `id`         | `Int`         | required  | `autoincrement()` | Primary key.                                  |
| `customer`   | `String`      | required  | —              | Name of the person who placed the order.         |
| `email`      | `String`      | required  | —              | Customer email — used by the order email filter (stretch). |
| `totalPrice` | `Float`       | required  | `0`            | Computed server-side from the line items.        |
| `status`     | `String`      | required  | `"pending"`    | Free-form status string (`pending`, `completed`, …). |
| `createdAt`  | `DateTime`    | required  | `now()`        | Auto-populated on create.                        |
| `updatedAt`  | `DateTime`    | required  | `@updatedAt`   | Auto-updated on every write.                     |
| `orderItems` | `OrderItem[]` | relation  | —              | The line items belonging to this order.          |

**Primary key:** `id`, auto-increments.
**Relationships:** one Order → many OrderItems.

### OrderItem

The join table. Each row is one product line on one order, capturing the quantity
and the **price at the time of purchase** (so historical orders are unaffected by
later product price changes).

| Field       | Prisma type | Required? | Default           | Notes                                          |
|-------------|-------------|-----------|-------------------|------------------------------------------------|
| `id`        | `Int`       | required  | `autoincrement()` | Primary key.                                   |
| `orderId`   | `Int`       | required  | —                 | FK → `Order.id`.                               |
| `productId` | `Int`       | required  | —                 | FK → `Product.id`.                             |
| `quantity`  | `Int`       | required  | `1`               | Number of units of this product.               |
| `price`     | `Float`     | required  | —                 | Unit price **at time of purchase** (snapshot). |
| `order`     | `Order`     | relation  | —                 | `@relation(fields: [orderId], references: [id], onDelete: Cascade)`   |
| `product`   | `Product`   | relation  | —                 | `@relation(fields: [productId], references: [id], onDelete: Cascade)` |

**Primary key:** `id`, auto-increments.
**Relationships:** many OrderItems → one Order, and many OrderItems → one Product.

### Cascade rules (the most important part of this section)

Stated in plain language, before any Prisma annotation:

1. **Deleting a Product deletes every OrderItem that references it.**
   The dependency points from `OrderItem.productId` → `Product.id`. When a Product is
   removed, any line item that named it has a dangling FK, so those line items are
   removed too. Implemented with `onDelete: Cascade` on the `product` relation in
   `OrderItem`.

2. **Deleting an Order deletes every OrderItem that references it.**
   The dependency points from `OrderItem.orderId` → `Order.id`. An order's line items
   have no meaning without their parent order, so they are removed with it.
   Implemented with `onDelete: Cascade` on the `order` relation in `OrderItem`.

Dependency chain: `OrderItem` is the dependent on **both** sides. Deleting either
parent (Order or Product) cascades down into `OrderItem`. We do **not** cascade in the
other direction — deleting an OrderItem never deletes its Order or Product.

> ⚠️ Note: because deleting a **Product** cascades into `OrderItem`, deleting a product
> that appears in a historical order will silently shrink that order. That is the
> behavior the assignment requires; a production system would more likely soft-delete
> products to preserve order history. Documented here as a conscious trade-off.

---

## Section 2: API Contract

### Global conventions

- **Base URL:** `http://localhost:3001`
- **Content type:** `application/json` for all request and response bodies.
- **Success response shape:** resources are returned wrapped under a named key, e.g.
  `{ "products": [...] }`, `{ "product": {...} }`, `{ "order": {...} }`,
  `{ "orders": [...] }`. Wrapping keeps responses self-describing and forward-compatible.
- **Error response shape (entire API):**
  ```json
  { "error": "human-readable message" }
  ```
  Status codes used: `400` (bad request / validation), `404` (not found),
  `500` (unexpected server error).

### Endpoint summary

| # | Method | Path             | Purpose                                    |
|---|--------|------------------|--------------------------------------------|
| 1 | GET    | `/`              | Health check / root route.                 |
| 2 | GET    | `/products`      | List products (supports filter + sort).    |
| 3 | GET    | `/products/:id`  | Fetch one product.                         |
| 4 | POST   | `/products`      | Create a product.                          |
| 5 | PUT    | `/products/:id`  | Update a product.                          |
| 6 | DELETE | `/products/:id`  | Delete a product (cascades to OrderItems). |
| 7 | GET    | `/orders`        | List orders (supports `?email=` filter).   |
| 8 | GET    | `/orders/:id`    | Fetch one order **with its items**.        |
| 9 | POST   | `/orders`        | **Transactionally** create an order + items.|
| 10| PUT    | `/orders/:id`    | Update an order's metadata (status, etc.). |
| 11| DELETE | `/orders/:id`    | Delete an order (cascades to OrderItems).  |
| 12| GET    | `/order-items`   | List every order item (stretch).           |
| 13| POST   | `/orders/:order_id/items` | Add an item to an existing order, recompute total (stretch). |

---

### 1. `GET /` — health check
- **Response 200:** `{ "message": "Student Store API is running 🛍️", "status": "ok" }`

---

### 2. `GET /products`
- **Query params (see Milestone 2):**
  - `category` (string, optional) — exact-match category filter, e.g. `?category=Apparel`.
  - `sort` (string, optional) — one of `price`, `-price`, `name`, `-name`, `newest`.
    A leading `-` (or `_desc`) means descending. Unknown values are ignored.
  - **Default (no params):** all products, ordered by `id` ascending.
- **Response 200:** `{ "products": [ Product, ... ] }`
- **Error 500:** `{ "error": "..." }` on an unexpected DB failure.

#### Query Parameters (added in Milestone 2)
| Param      | Example            | Behavior                                              |
|------------|--------------------|-------------------------------------------------------|
| `category` | `?category=Books`  | Returns only products whose `category` matches exactly. An unknown category is **not an error** — it returns `{ "products": [] }`. |
| `sort`     | `?sort=price`      | Ascending by price. `?sort=-price` descending.        |
| `sort`     | `?sort=name`       | Ascending by name (`-name` descending).               |
| `sort`     | `?sort=newest`     | Newest first (`createdAt` descending).                |
| (combined) | `?category=Snacks&sort=price` | Filter, then sort.                         |
| (none)     | `/products`        | All products, ordered by `id` ascending.              |

---

### 3. `GET /products/:id`
- **Route param:** `id` (integer).
- **Response 200:** `{ "product": Product }`
- **Error 400:** non-numeric id → `{ "error": "Product id must be a number" }`
- **Error 404:** no such product → `{ "error": "Product with id <id> not found" }`

---

### 4. `POST /products`
- **Body:**
  ```json
  {
    "name": "College Hoodie",        // required, string
    "price": 29.99,                  // required, number
    "description": "Cozy hoodie",    // optional, string
    "imageUrl": "https://...",       // optional, string
    "category": "Apparel"            // optional, string
  }
  ```
- **Response 201:** `{ "product": Product }`
- **Error 400:** missing `name` or `price`, or `price` not a number →
  `{ "error": "name and price are required" }`

---

### 5. `PUT /products/:id`
- **Route param:** `id` (integer).
- **Body:** any subset of the createable fields; only provided fields are updated.
- **Response 200:** `{ "product": Product }`  (the updated product)
- **Error 400:** non-numeric id.
- **Error 404:** no such product.

---

### 6. `DELETE /products/:id`
- **Route param:** `id` (integer).
- **Behavior:** deletes the product; **cascades** to its `OrderItem` rows.
- **Response 200:** `{ "product": Product }` (the deleted product).
- **Error 400:** non-numeric id.
- **Error 404:** no such product.

---

### 7. `GET /orders`  *(stretch: list + email filter)*
- **Query params:**
  - `email` (string, optional) — case-insensitive substring filter on `Order.email`.
- **Response 200:** `{ "orders": [ Order(with orderItems → product), ... ] }`, newest first.
- **Error 500:** `{ "error": "..." }`

---

### 8. `GET /orders/:id`
- **Route param:** `id` (integer).
- **Response 200:** `{ "order": Order }` **including** `orderItems`, and each item's
  `product`.
- **Error 400:** non-numeric id.
- **Error 404:** no such order → `{ "error": "Order with id <id> not found" }`

---

### 9. `POST /orders` — transactional create (see Section 3)
- **Body:**
  ```json
  {
    "customer": "Jane Doe",          // required, string
    "email": "jane@college.edu",     // required, string
    "status": "pending",             // optional, string (defaults to "pending")
    "items": [                       // required, non-empty array
      { "productId": 1, "quantity": 2 },
      { "productId": 4, "quantity": 1 }
    ]
  }
  ```
  Note: the client sends only `productId` + `quantity`. The server looks up the
  authoritative unit price from the database — the client never sets prices.
- **Response 201:**
  ```json
  {
    "order": {
      "id": 3,
      "customer": "Jane Doe",
      "email": "jane@college.edu",
      "totalPrice": 61.97,
      "status": "pending",
      "createdAt": "2026-06-25T...Z",
      "updatedAt": "2026-06-25T...Z",
      "orderItems": [
        { "id": 5, "orderId": 3, "productId": 1, "quantity": 2, "price": 29.99,
          "product": { ...Product } },
        { "id": 6, "orderId": 3, "productId": 4, "quantity": 1, "price": 1.99,
          "product": { ...Product } }
      ]
    }
  }
  ```
- **Error 400 (validation):**
  - missing `customer`/`email` → `{ "error": "customer and email are required" }`
  - empty/missing `items` → `{ "error": "An order must contain at least one item" }`
  - malformed item → `{ "error": "Each item needs a productId and a positive quantity" }`
- **Error 404 (nonexistent product):** if any `productId` is not in the DB →
  `{ "error": "Product with id <id> does not exist" }`, and **no order or items are
  created** (the whole transaction rolls back).

---

### 10. `PUT /orders/:id`
- **Route param:** `id` (integer).
- **Body:** updatable order metadata — `status`, `customer`, `email`. (Line items are
  not edited here.)
- **Response 200:** `{ "order": Order(with orderItems) }`
- **Error 400 / 404:** as elsewhere.

---

### 11. `DELETE /orders/:id`
- **Route param:** `id` (integer).
- **Behavior:** deletes the order; **cascades** to its `OrderItem` rows.
- **Response 200:** `{ "order": Order }` (the deleted order).
- **Error 400 / 404:** as elsewhere.

---

### 12. `GET /order-items`  *(stretch)*
- **Response 200:** `{ "orderItems": [ OrderItem(with product), ... ] }`, ordered by id.
- **Error 500:** `{ "error": "..." }`

---

### 13. `POST /orders/:order_id/items`  *(stretch)*
Add a single line item to an existing order and **recompute the order total
atomically**. Like `POST /orders`, the client sends only `productId` + `quantity`;
the server snapshots the product's current price.
- **Route param:** `order_id` (integer).
- **Body:** `{ "productId": 1, "quantity": 2 }`
- **Response 201:** `{ "order": Order(with orderItems → product) }` — the updated order,
  with the new item included and `totalPrice` increased by `price × quantity`.
- **Error 400:** non-numeric id, or missing/invalid `productId`/`quantity` →
  `{ "error": "An item needs a productId and a positive quantity" }`
- **Error 404:** order not found → `{ "error": "Order with id <id> not found" }`;
  product not found → `{ "error": "Product with id <id> does not exist" }`.
  In both cases the transaction rolls back — no item is added.

---

## Section 3: Transactional Flow — `POST /orders`

This is the most architecturally significant endpoint. It must create an Order and
N OrderItems and compute the total **atomically**: either everything persists or
nothing does.

### What the request body looks like
```json
{
  "customer": "Jane Doe",
  "email": "jane@college.edu",
  "status": "pending",
  "items": [
    { "productId": 1, "quantity": 2 },
    { "productId": 4, "quantity": 1 }
  ]
}
```

### Step-by-step at the data layer

1. **Validate the shape (no DB writes yet).**
   - `customer` and `email` are non-empty strings → else `400`.
   - `items` is a non-empty array → else `400`.
   - every item has an integer `productId` and an integer `quantity >= 1` → else `400`.

2. **Resolve products & detect nonexistent ids (read).**
   - Collect the unique `productId`s from `items`.
   - `prisma.product.findMany({ where: { id: { in: ids } } })`.
   - If the number of products found < number of unique ids requested, at least one
     `productId` is bogus → respond `404` *"Product with id <id> does not exist"* and
     **stop before opening the transaction**. (Fail fast; nothing was written.)

3. **Compute line prices and the order total (in memory).**
   - For each item, look up its product's current `price` → that becomes the
     OrderItem `price` snapshot, and `lineTotal = price * quantity`.
   - `totalPrice = Σ lineTotal`, rounded to 2 decimals.

4. **Open a transaction and write atomically** using `prisma.$transaction`.
   We use the **nested-write** form, which Prisma already runs in a single
   transaction: create the `Order` with its `orderItems` created inline via
   `orderItems: { create: [...] }`, and return it with `include: { orderItems: { include: { product } } }`.
   This guarantees the Order and **all** its items are inserted together or not at all.

   ```js
   const order = await prisma.order.create({
     data: {
       customer, email, status,
       totalPrice,
       orderItems: { create: lineItems }, // [{ productId, quantity, price }, ...]
     },
     include: { orderItems: { include: { product: true } } },
   });
   ```

5. **Respond `201`** with `{ "order": order }` — the order plus its items (and each
   item's product), matching the contract above.

### What happens if one item references a nonexistent product?

Two layers of protection:
- **Primary (fast path):** Step 2 catches it before any write — we return `404` and
  the DB is untouched.
- **Backstop (race / FK):** if a product were deleted between Step 2 and Step 4, the
  inline `create` would violate the `productId` foreign key and Prisma throws *inside*
  the atomic create. Because the Order and its items are one nested write, the failure
  rolls the **entire** operation back — no partial order, no orphan items. We catch the
  Prisma error and return `404`/`400`.

> Why nested-write instead of a manual `$transaction([...])` array? The order's `id`
> isn't known until it's inserted, and every OrderItem needs that `orderId`. The nested
> `create` lets Prisma insert the parent, thread the new id into the children, and wrap
> it all in one transaction — exactly the atomicity we need, with less ceremony than
> manually sequencing `order.create` then `orderItem.createMany` inside a transaction
> closure. The interactive `$transaction(async (tx) => …)` form would be used if we
> needed conditional logic mid-transaction; here the nested write is sufficient and
> clearer.

---

## Decisions Log — Product Model

- **Schema translation that went smoothly:** `price` as `Float` — Prisma's `Float`
  maps cleanly to PostgreSQL `double precision`, which is adequate for displaying
  currency in this project. (A production store would use `Decimal` to avoid binary
  floating-point rounding.)
- **Field decision made during implementation that wasn't in the original spec:** added
  `createdAt`/`updatedAt` (`@default(now())` / `@updatedAt`) to every model. They cost
  nothing, give the frontend a `newest` sort option, and make debugging seed/insert
  order trivial.
- **Route behavior that needed a spec update:** confirmed `PUT /products/:id` returns
  `200` with the updated product (not `204`), and `DELETE` returns `200` with the
  deleted product rather than an empty `204`, so the client can confirm what changed.
  No spec change needed beyond writing it down — done above.

---

## Decisions Log — Order Creation Transaction

- **What my Transactional Flow spec got right:** the order of operations — validate →
  resolve products / fail fast on bad ids → compute total in memory → single atomic
  write → respond with the included items — was accurate and implemented as written.
- **What the spec missed that I discovered during implementation:** the empty-`items`
  case. An order with zero items is meaningless, so I added an explicit `400`
  *"An order must contain at least one item"* check and documented it in the contract.
  I also decided the **server**, not the client, is the source of truth for unit price
  (the client only sends `productId` + `quantity`), which prevents a client from
  spoofing prices.
- **How the transaction error handling works (in my own words):** `prisma.$transaction`
  (and the equivalent nested `create`) runs all of its writes inside one database
  transaction. If any statement throws — e.g. a foreign-key violation because a
  `productId` doesn't exist — Prisma issues a `ROLLBACK`, so every write in that batch
  is undone. The call rejects with an error instead of returning, and control jumps to
  my `catch`, where I translate it into the right HTTP status. The net effect: callers
  either get a fully-formed order back, or they get an error and the database looks
  exactly as it did before the request.
- **One thing I'd design differently if starting over:** I'd store money as `Decimal`
  (or integer cents) from day one to avoid float rounding, and I'd consider decrementing
  a product `stock`/inventory count inside the same transaction so overselling is
  impossible — a natural next feature that the atomic write already makes safe.

---

## Spec Reconciliation — Milestone 4 (Schema Audit)

### Schema vs. spec gaps found
- No structural gaps: `Product`, `Order`, and `OrderItem` and their fields match
  Section 1 exactly.
- Clarified in a schema comment that `OrderItem.price` is the *price at time of
  purchase* (a snapshot), not a live reference to `Product.price` — the type (`Float`)
  was already correct.
- Confirmed both `@relation`s on `OrderItem` carry `onDelete: Cascade`, matching the
  two cascade rules in Section 1.

### Cascade delete verification
- Deleting a Product removes associated OrderItems: ✅ tested (delete a product that
  appears in a seeded order; the order's item count drops, no orphan rows remain).
- Deleting an Order removes associated OrderItems: ✅ tested (delete an order; its
  `OrderItem` rows are gone, the referenced products remain).

---

## Final Spec Reconciliation: Project Complete

### Full-system audit result
- All 11 endpoints in the contract are implemented in `server.js` and behave as
  documented (verified with curl/Postman-style requests against the running server).
- Found: the contract did not originally document **CORS**. The frontend runs on
  `http://localhost:5173` and the API on `http://localhost:3001`; cross-origin requests
  require the `cors` middleware. Added `app.use(cors())` and noted it here.

### Gaps resolved during frontend integration
- **Image field name:** the frontend's `ProductCard`/`ProductDetail` read
  `product.image_url` (snake_case) while the API/DB use `imageUrl` (camelCase). Resolved
  by updating those two components to read `product.imageUrl`, keeping the API
  consistently camelCase. Documented rather than special-casing the API response.
- **Checkout request shape:** the frontend's `handleOnCheckout` was an empty stub. It
  now builds the documented `POST /orders` body (`customer`, `email`, `items` of
  `{ productId, quantity }`) from the cart and user info, posts it, and renders the
  returned order into the `CheckoutSuccess` receipt shape
  (`order.purchase.receipt.lines`).
- **Product fetching:** `App.jsx` and `ProductDetail.jsx` had no data fetching. They now
  call `GET /products` and `GET /products/:id` respectively and read `response.data.products`
  / `response.data.product`.

### What the spec enabled during this project
- Writing the cascade rules and the transactional flow in plain language *first* meant
  the schema annotations and the `POST /orders` handler were a near-direct transcription
  — no mid-implementation redesign. When the frontend field-name mismatch surfaced, the
  contract made it obvious which side was "right" and the fix was a two-line, documented
  change rather than a guess.

---

## Stretch Features (implemented)

- **`GET /orders`** — fetch all orders (with items), newest first.
- **`GET /orders/:id`** — fetch a single order with its items.
- **Filter orders by email** — `GET /orders?email=<substring>` (case-insensitive).
- **Past Orders UI** — `/orders` list page + `/orders/:id` detail page in the frontend,
  with an email filter input on the list page.
