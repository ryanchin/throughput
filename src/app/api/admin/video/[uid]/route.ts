import { NextResponse } from "next/server";

export async function DELETE() {
  // TODO: Delete video from Cloudflare Stream (admin only)
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}
