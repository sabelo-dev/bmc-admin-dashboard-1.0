import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(
  req: Request,
  { params }: { params: { storeId: string } }
) {
  const { productIds } = await req.json();

  if (!productIds || productIds.length === 0) {
    return new NextResponse("Product ids are required", { status: 400 });
  }

  const products = await prismadb.product.findMany({
    where: {
      id: {
        in: productIds
      }
    }
  });

  // Assuming you have a function to calculate the total price of products
  const totalPrice = products.reduce((total, product) => total + product.price, 0);

  // Create order in Prisma
  const order = await prismadb.order.create({
    data: {
      storeId: params.storeId,
      isPaid: false,
      orderItems: {
        create: productIds.map((productId: string) => ({
          product: {
            connect: {
              id: productId
            }
          }
        }))
      }
    }
  });

  // Construct response data with the URL to redirect to
  const responseData = {
    url: `${process.env.FRONTEND_STORE_URL}/cart?orderId=${order.id}`
  };

  const payFastUrl = `https://sandbox.payfast.co.za/eng/process?merchant_id=${process.env.PAYFAST_MERCHANT_ID}
    &merchant_key=${process.env.PAYFAST_MERCHANT_KEY}
    &amount=${totalPrice}
    &item_name=${encodeURIComponent('Order from Your Store')}
    &return_url=${encodeURIComponent(`${process.env.FRONTEND_STORE_URL}/cart?orderId=${order.id}&success=1`)}
    &cancel_url=${encodeURIComponent(`${process.env.FRONTEND_STORE_URL}/cart?canceled=1`)}`;

  // Return the response with the URL
  return NextResponse.json({ url: payFastUrl }, { headers: corsHeaders });
}
