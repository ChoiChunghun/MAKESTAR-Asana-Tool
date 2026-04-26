import { NextResponse } from "next/server";
import type { AsanaCreateTasksRequest } from "@/types/asana";
import { createTasksFromPreview } from "@/lib/asana/tasks";
import { toUserFriendlyAsanaError } from "@/lib/asana/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AsanaCreateTasksRequest;
    const result = await createTasksFromPreview(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ message: toUserFriendlyAsanaError(error) }, { status: 500 });
  }
}
