import { NextResponse } from "next/server";

export async function GET() {
  // TODO: Return Open Badges 3.0 JSON-LD assertion
  // Content-Type: application/ld+json
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}
