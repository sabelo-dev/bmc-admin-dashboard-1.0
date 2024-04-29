import { NextResponse } from "next/server";
import axios from "axios";

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

  const products = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/products`, {
    productIds
  });

  const orderData = {
    merchant_id: process.env.PAYFAST_MERCHANT_ID,
    merchant_key: process.env.PAYFAST_MERCHANT_KEY,
    amount: products.data.totalPrice * 100, // PayFast requires the amount in cents
    item_name: products.data.itemName,
    return_url: `${process.env.FRONTEND_STORE_URL}/cart?success=1`,
    cancel_url: `${process.env.FRONTEND_STORE_URL}/cart?canceled=1`,
    // Additional fields as needed by PayFast
  };

  // Redirect the user to PayFast checkout page
  return NextResponse.redirect(`https://sandbox.payfast.co.za/eng/process?${new URLSearchParams(orderData).toString()}`);
}
