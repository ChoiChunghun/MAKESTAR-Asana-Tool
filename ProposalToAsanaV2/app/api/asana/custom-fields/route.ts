import { NextResponse } from "next/server";
import { asanaRequest, validateToken } from "@/lib/asana/client";

export const runtime = "nodejs";

type EnumOption = { gid: string; name: string };
type RawField = {
  custom_field: {
    gid: string;
    name: string;
    resource_subtype: string;
    enum_options?: EnumOption[];
  };
};

export type CustomFieldInfo = {
  gid: string;
  name: string;
  type: string;
  enumOptions?: EnumOption[];
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const projectGid = url.searchParams.get("projectGid") || "";
    const token = request.headers.get("x-asana-token") || "";

    validateToken(token);
    if (!projectGid) return NextResponse.json({ message: "프로젝트 GID를 입력해주세요." }, { status: 400 });

    const settings = await asanaRequest<RawField[]>(
      "get",
      `/projects/${projectGid}/custom_field_settings?opt_fields=custom_field.gid,custom_field.name,custom_field.resource_subtype,custom_field.enum_options.gid,custom_field.enum_options.name`,
      token
    );

    const fields: CustomFieldInfo[] = (settings || []).map((s) => ({
      gid: s.custom_field.gid,
      name: s.custom_field.name,
      type: s.custom_field.resource_subtype,
      enumOptions: s.custom_field.enum_options
    }));

    return NextResponse.json({ fields });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "커스텀 필드 조회 중 오류가 발생했습니다.";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
