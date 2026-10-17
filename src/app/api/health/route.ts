import { NextResponse } from "next/server";

// Instant, dependency-free liveness check for the platform's health probe, so a
// slow page render can never fail it.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok" }, { status: 200 });
}
