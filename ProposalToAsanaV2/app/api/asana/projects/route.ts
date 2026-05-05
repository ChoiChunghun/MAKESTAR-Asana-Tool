import { NextResponse } from "next/server";
import { getAvailableProjects } from "@/lib/asana/projects";
import { toApiResponse } from "@/lib/asana/errors";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const token = request.headers.get("x-asana-token") || "";
    if (!token || token.length < 10) {
      return NextResponse.json({ message: "Asana 토큰이 필요합니다." }, { status: 401 });
    }
    const projects = await getAvailableProjects(token);
    return NextResponse.json({ projects });
  } catch (error) {
    const { message, status } = toApiResponse(error);
    return NextResponse.json({ message }, { status });
  }
}
