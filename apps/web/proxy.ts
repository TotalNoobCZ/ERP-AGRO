import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Proxy (dříve middleware): obnovuje Supabase session (cookies) a hlídá přístup –
 * nepřihlášený uživatel smí jen na /login (a auth API).
 */
export default async function proxy(request: NextRequest) {
  // Srozumitelná hláška místo pádu, dokud nejsou na hostingu nastavené env proměnné.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return new NextResponse(
      "ERP AGRO: aplikace zatím není nakonfigurována – v nastavení hostingu chybí " +
        "NEXT_PUBLIC_SUPABASE_URL a NEXT_PUBLIC_SUPABASE_ANON_KEY (viz apps/web/.env.example).",
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  let response = NextResponse.next({ request });

  // „Zapamatovat přihlášení" = vypnuto → z auth cookies odstraníme trvalou
  // životnost, takže se stanou session cookies a po zavření prohlížeče zmizí.
  const rememberOff = request.cookies.get("erp_remember")?.value === "0";

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            const opts = rememberOff
              ? { ...options, maxAge: undefined, expires: undefined }
              : options;
            response.cookies.set(name, value, opts);
          });
        },
      },
    },
  );

  // Důležité: getUser() ověří token proti Supabase (ne jen z cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = pathname.startsWith("/login") || pathname.startsWith("/api/auth");

  // Přesměrování musí přenést cookies, které mohl getUser() obnovit (rotace
  // tokenů). Jinak by se do prohlížeče nedostaly nové tokeny a starý (už
  // spotřebovaný) refresh token by uživatele při dalším requestu odhlásil.
  function redirectTo(path: string): NextResponse {
    const url = request.nextUrl.clone();
    url.pathname = path;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  if (!user && !isPublic) {
    return redirectTo("/login");
  }

  if (user && pathname.startsWith("/login")) {
    return redirectTo("/");
  }

  return response;
}

export const config = {
  // Vše kromě statických souborů.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
