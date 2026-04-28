import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser, validateToken } from "@/lib/asana/client";
import { findSectionByProductCode } from "@/lib/asana/sections";
import { isValidGid } from "@/lib/parser/utils";

export const runtime = "nodejs";

function detectSuffix(userName: string): "_CN" | "_NAEU" | "" {
  if (userName.includes("중국사업팀")) return "_CN";
  if (userName.includes("북미유럽사업팀")) return "_NAEU";
  return "";
}

/**
 * GET /api/asana/check-derivative?projectGid=...&productCode=...
 * 파생 모드 여부를 판단:
 *   - 해당 프로젝트에 동일 상품코드 섹션이 존재하고
 *   - 현재 Asana 사용자가 중국사업팀 또는 북미유럽사업팀인 경우 → isDerivative: true
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("x-asana-token") || "";
    const projectGid = req.nextUrl.searchParams.get("projectGid") || "";
    const productCode = req.nextUrl.searchParams.get("productCode") || "";

    if (!token || !projectGid || !productCode) {
      return NextResponse.json({ isDerivative: false, suffix: "", sectionGid: null, sectionName: null });
    }
    // GID 포맷 검증 (숫자 10자리 이상)
    if (!isValidGid(projectGid)) {
      return NextResponse.json({ isDerivative: false, suffix: "", sectionGid: null, sectionName: null });
    }
    // 상품코드 길이 제한
    if (productCode.trim().length > 100) {
      return NextResponse.json({ isDerivative: false, suffix: "", sectionGid: null, sectionName: null });
    }

    validateToken(token);

    const [user, section] = await Promise.all([
      getCurrentUser(token),
      findSectionByProductCode(projectGid, productCode, token)
    ]);

    const suffix = detectSuffix(user.name);
    const isDerivative = !!section && suffix !== "";

    return NextResponse.json({
      isDerivative,
      suffix,
      sectionGid: section?.gid ?? null,
      sectionName: section?.name ?? null
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "파생 모드 확인 중 오류";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
