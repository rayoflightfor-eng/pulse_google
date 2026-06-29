/** Redirect target for Supabase email links (signup, email change, etc.). */
export function getAuthRedirectTo(nextPath = "/") {
  const url = new URL("/auth/callback", window.location.origin);
  if (nextPath && nextPath !== "/") {
    url.searchParams.set("next", nextPath);
  }
  return url.href;
}
