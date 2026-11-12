// Vercel server-side proxy for CollegeBasketballData.
// Keep CBBD_API_KEY in Vercel Environment Variables; never expose it to the browser.
const ALLOWED = {
  games: new Set(["season","seasonType","startDateRange","endDateRange","team","conference","status","tournament"]),
  "games/teams": new Set(["season","seasonType","startDateRange","endDateRange","team","conference","tournament"]),
  "ratings/adjusted": new Set(["season","team","conference"]),
  "lines": new Set(["season","team","conference","startDateRange","endDateRange"])
};

export default async function handler(req, res) {
  // Public basketball data is safe to edge-cache. This prevents repeated upstream
  // CBBD calls when multiple users/reloads request the same historical window.
  res.setHeader("Vary", "Accept");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const resource = String(req.query.resource || "");
  const allowedParams = ALLOWED[resource];
  if (!allowedParams) {
    return res.status(400).json({ error: "Unsupported resource. Allowed: games, games/teams, ratings/adjusted, lines." });
  }

  const apiKey = process.env.CBBD_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "CBBD_API_KEY is not configured on the server.",
      setup: "Add the existing CFBD/CBBD bearer key as a Vercel server-side environment variable named CBBD_API_KEY, then redeploy."
    });
  }

  const season = Number(req.query.season || 0);
  const currentSeason = new Date().getUTCFullYear() + (new Date().getUTCMonth() >= 9 ? 1 : 0);
  const isCurrentSeason = season === currentSeason;
  // Shared Vercel CDN cache: completed historical seasons are effectively immutable,
  // so every visitor can reuse the same response for up to a year. Current-season
  // scores are refreshed every 6 hours; lines are also shared for 6 hours.
  const cacheSeconds = resource === "lines" ? 21600 : (isCurrentSeason ? 21600 : 31536000);
  res.setHeader("Cache-Control", "public, s-maxage=" + cacheSeconds + ", stale-while-revalidate=" + (cacheSeconds * 7));

  const upstream = new URL("https://api.collegebasketballdata.com/" + resource);
  for (const [key, raw] of Object.entries(req.query)) {
    if (key === "resource" || !allowedParams.has(key)) continue;
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value !== undefined && value !== "") upstream.searchParams.set(key, String(value));
  }

  try {
    const response = await fetch(upstream, {
      headers: { Authorization: "Bearer " + apiKey, Accept: "application/json" }
    });
    const body = await response.text();
    res.setHeader("Content-Type", response.headers.get("content-type") || "application/json");
    res.setHeader("X-CBB-Data-Source", "CollegeBasketballData");
    return res.status(response.status).send(body);
  } catch (error) {
    return res.status(502).json({ error: "Unable to reach the basketball data provider." });
  }
}
