import { NextResponse, type NextRequest } from "next/server";
import { checkAccess } from "./server/access";

export function proxy(request: NextRequest) {
  return checkAccess(request) || NextResponse.next();
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico).*)"],
};
