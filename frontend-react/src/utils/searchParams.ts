export const SEARCH_PAGE_SIZE = 20;
export const SEARCH_KEYWORD_MAX_LENGTH = 100;

export function normalizeKeyword(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/g, " ");
}

// A stable API key avoids fetching the same filters again when URL order changes.
export function normalizeSearchParams(input: URLSearchParams, fallbackCity = ""): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of ["city", "district", "search", "category", "suitable_for", "service_type"]) {
    const value = normalizeKeyword(input.get(key) || (key === "city" ? fallbackCity : ""));
    if (value) params.set(key, value);
  }
  for (const key of ["price", "space_level"]) {
    const value = Number(input.get(key));
    if (Number.isInteger(value) && value >= 1 && value <= 5) params.set(key, String(value));
  }
  const rating = Number(input.get("rating"));
  if (rating > 0 && rating <= 5) params.set("rating", String(rating));
  if (input.get("has_exclusive") === "true") params.set("has_exclusive", "true");

  const hasKeyword = params.has("search");
  const sort = input.get("sort_by");
  const allowedSorts = ["like_count", "rating", "created_at", ...(hasKeyword ? ["relevance"] : [])];
  params.set("sort_by", sort && allowedSorts.includes(sort) ? sort : hasKeyword ? "relevance" : "like_count");
  const offset = Number(input.get("offset"));
  params.set("offset", Number.isSafeInteger(offset) && offset > 0
    ? String(Math.floor(offset / SEARCH_PAGE_SIZE) * SEARCH_PAGE_SIZE)
    : "0");
  // One extra row tells us whether another page exists without a count or prefetch request.
  params.set("limit", String(SEARCH_PAGE_SIZE + 1));
  params.sort();
  return params;
}

export function updateSearchFilters(
  input: URLSearchParams,
  changes: Record<string, string | null>,
): URLSearchParams {
  const params = new URLSearchParams(input);
  for (const [key, value] of Object.entries(changes)) {
    const nextValue = value ? normalizeKeyword(value) : "";
    if (key === "city" && nextValue !== params.get("city")) params.delete("district");
    if (nextValue) params.set(key, nextValue);
    else params.delete(key);
  }
  params.delete("offset");
  params.delete("limit");
  return params;
}
