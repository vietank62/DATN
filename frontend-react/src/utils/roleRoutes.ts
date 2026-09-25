export function defaultRouteForRole(role?: string | null): string {
  if (role === "admin") return "/admin";
  if (role === "manager") return "/manager";
  return "/";
}
