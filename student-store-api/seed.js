const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const fs = require('fs')
const path = require('path')

async function seed() {
  try {
    console.log('🌱 Seeding database...\n')

    // Clear existing data (in order due to relations)
    await prisma.orderItem.deleteMany()
    await prisma.order.deleteMany()
    await prisma.product.deleteMany()

    // Load JSON data (data/ lives alongside this seed file)
    const productsData = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'data/products.json'), 'utf8')
    )

    const ordersData = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'data/orders.json'), 'utf8')
    )

    // Seed products. Use the explicit ids from the JSON so the orders' product
    // references line up. (Without this, the SERIAL sequence could hand out
    // different ids and the order seeding would hit a foreign-key error.)
    for (const product of productsData.products) {
      await prisma.product.create({
        data: {
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          imageUrl: product.image_url,
          category: product.category,
        },
      })
    }

    // Because we inserted explicit ids, advance the id sequence past the max so
    // future auto-increment inserts (e.g. POST /products) don't collide.
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"Product"', 'id'), (SELECT MAX(id) FROM "Product"))`
    )

    // Seed orders and items. The sample data only has a numeric customer_id, so
    // synthesize the customer name + email the schema requires from it.
    for (const order of ordersData.orders) {
      const createdOrder = await prisma.order.create({
        data: {
          customer: `Student ${order.customer_id}`,
          email: `student${order.customer_id}@college.edu`,
          totalPrice: order.total_price,
          status: order.status,
          createdAt: new Date(order.created_at),
          orderItems: {
            create: order.items.map((item) => ({
              productId: item.product_id,
              quantity: item.quantity,
              price: item.price,
            })),
          },
        },
      })

      console.log(`✅ Created order #${createdOrder.id}`)
    }

    console.log('\n🎉 Seeding complete!')
  } catch (err) {
    console.error('❌ Error seeding:', err)
  } finally {
    await prisma.$disconnect()
  }
}

seed()
