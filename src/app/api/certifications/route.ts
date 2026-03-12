import { NextResponse } from "next/server";

export async function GET() {
  // TODO: List public certification tracks
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}
