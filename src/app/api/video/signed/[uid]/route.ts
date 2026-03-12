import { NextResponse } from "next/server";

export async function GET() {
  // TODO: Generate signed playback URL (authenticated users only)
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}
