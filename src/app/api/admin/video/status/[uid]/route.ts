import { NextResponse } from "next/server";

export async function GET() {
  // TODO: Poll Cloudflare Stream transcoding status
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}
