import axios from "axios";
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

  // Calculate the total price of products
  const totalPrice = products.reduce((total: number, product) => total + product.price.toNumber(), 0);

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

  // Generate payment URL
  const payFastUrl = `https://sandbox.payfast.co.za/eng/process?merchant_id=${process.env.PAYFAST_MERCHANT_ID}
    &merchant_key=${process.env.PAYFAST_MERCHANT_KEY}
    &amount=${totalPrice}
    &item_name=${encodeURIComponent('Order from Your Store')}
    &return_url=${encodeURIComponent(`${process.env.FRONTEND_STORE_URL}/cart?orderId=${order.id}&success=1`)}
    &cancel_url=${encodeURIComponent(`${process.env.FRONTEND_STORE_URL}/cart?canceled=1`)}`;

      // Return the response with the URL
     return NextResponse.json({ url: payFastUrl }, { headers: corsHeaders });

  try {
    // Make the payment request to the payment gateway
    const response = await axios.post(payFastUrl);

    // Check if the payment was successful based on the response from the payment gateway
    if (response.data.success === true) {
      // Update the order status to indicate that the payment was successful
      await prismadb.order.update({
        where: { id: order.id },
        data: { isPaid: true }
      });

      // Return a success response to the client
      return NextResponse.json(
        { message: "Payment successful", url: response.data.redirectUrl },
        { headers: corsHeaders }
      );
    } else {
      // Handle unsuccessful payment (optional)
      return NextResponse.json(
        { message: "Payment failed", error: response.data.error },
        { status: 400, headers: corsHeaders }
      );
    }
  } catch (error: any) {
    // Handle errors during payment processing
    console.error("Payment failed:", error);
    return NextResponse.json(
      { message: "Payment failed", error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }

}
