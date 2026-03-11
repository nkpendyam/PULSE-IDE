import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    name: "Kyro IDE",
    version: "0.2.0",
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
}