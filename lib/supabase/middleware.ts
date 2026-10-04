import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/dashboard", "/client", "/expert", "/tasks", "/orders", "/notifications", "/settings"];

const under = (path: string, base: string) => path === base || path.startsWith(base + "/");

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const loginRedirect = (role?: string) => {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?${role ? `role=${role}&` : ""}next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(login);
  };

  // Admin area: checked here, before anything renders, so nothing leaks to non-admins.
  if (under(path, "/admin")) {
    if (!user) return loginRedirect("admin");
    const { data } = await supabase.from("users").select("role, is_banned").eq("id", user.id).maybeSingle();
    if (data?.role !== "admin" || data?.is_banned) {
      const hidden = request.nextUrl.clone();
      hidden.pathname = "/__not-found";
      const res = NextResponse.rewrite(hidden, { request });
      response.cookies.getAll().forEach((c) => res.cookies.set(c));
      return res;
    }
    return response;
  }

  if (!user && PROTECTED.some((p) => under(path, p))) {
    return loginRedirect(under(path, "/expert") ? "expert" : undefined);
  }
  return response;
}
