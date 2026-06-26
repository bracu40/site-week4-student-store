# Student Store API

Express + Prisma + PostgreSQL backend for the Student Store. The full design
(data models, API contract, transactional flow, decision logs) lives in
[`planning.md`](./planning.md) — that is the source of truth.

## Stack
- **Express** — HTTP server / routing (`src/server.js`)
- **Prisma** — ORM + migrations (`prisma/schema.prisma`, `prisma/migrations/`)
- **PostgreSQL** — database
- Models: `src/models/{product,order,orderItem}.js`

## Endpoints

| Method | Path             | Description                                   |
|--------|------------------|-----------------------------------------------|
| GET    | `/`              | Health check                                  |
| GET    | `/products`      | List products (`?category=`, `?sort=`)        |
| GET    | `/products/:id`  | Get one product                               |
| POST   | `/products`      | Create a product                              |
| PUT    | `/products/:id`  | Update a product                              |
| DELETE | `/products/:id`  | Delete a product (cascades to OrderItems)     |
| GET    | `/orders`        | List orders (`?email=` filter)                |
| GET    | `/orders/:id`    | Get one order, with its items                 |
| POST   | `/orders`        | Create an order + items (transactional)       |
| PUT    | `/orders/:id`    | Update an order's metadata                    |
| DELETE | `/orders/:id`    | Delete an order (cascades to OrderItems)      |

`?sort=` accepts: `price`, `-price`, `name`, `-name`, `newest`.

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Database

Set `DATABASE_URL` in `.env` to point at a PostgreSQL instance, e.g.:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/student_store?schema=public"
PORT=3001
```

The database lives in **Postgres.app's own cluster**, so it shows up in the
Postgres.app window as `student_store`. You can start it from the Postgres.app
GUI, or use the helper script (which also ensures the `student_store` database
and the `postgres` login exist):

```bash
./scripts/db.sh start    # start Postgres.app cluster on 5432, ensure student_store exists
./scripts/db.sh stop     # stop it
./scripts/db.sh status   # check if it's running
```

### 3. Migrate + seed
```bash
npx prisma migrate dev    # apply migrations, generate client
npm run seed              # load data/products.json + data/orders.json
```

### 4. Run
```bash
npm run dev     # nodemon (auto-restart)
# or
npm start       # plain node
```

Server listens on `http://localhost:3001` (override with `PORT`).

## Notes
- CORS is enabled globally so the Vite frontend (`http://localhost:5173`) can call the API.
- Money is stored as `Float`; the `POST /orders` total is computed server-side from
  the products' current prices — clients send only `productId` + `quantity`.
