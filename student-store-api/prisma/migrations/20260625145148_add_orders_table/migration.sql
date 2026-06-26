-- CreateTable
CREATE TABLE "Order" (
    "id" SERIAL NOT NULL,
    "customer" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);
