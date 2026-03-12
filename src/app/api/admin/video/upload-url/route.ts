import { NextResponse } from "next/server";

export async function POST() {
  // TODO: Get Direct Creator Upload URL from Cloudflare Stream
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}
