import { NextResponse } from "next/server";
import { toUserFriendlyAsanaError } from "@/lib/asana/errors";
import { getAvailableProjectOptions } from "@/lib/asana/projects";

export const runtime = "nodejs";

export async function GET() {
  try {
    const projects = await getAvailableProjectOptions();
    return NextResponse.json({ projects });
  } catch (error) {
    return NextResponse.json({ message: toUserFriendlyAsanaError(error) }, { status: 500 });
  }
}
