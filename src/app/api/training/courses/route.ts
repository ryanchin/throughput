import { NextResponse } from "next/server";

export async function GET() {
  // TODO: List training courses (role-gated)
  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}
