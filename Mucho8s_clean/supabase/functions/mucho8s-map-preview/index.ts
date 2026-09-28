const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const GAME_META: Record<string, { slug: string; label: string }> = {
  BO7: { slug: "black-ops-7", label: "Black Ops 7" },
  BO6: { slug: "black-ops-6", label: "Black Ops 6" },
  MW3: { slug: "modern-warfare-iii", label: "Modern Warfare III" },
  VG: { slug: "vanguard", label: "Vanguard" },
  CW: { slug: "black-ops-cold-war", label: "Black Ops Cold War" },
  WW2: { slug: "world-war-2", label: "World War 2" },
  BO2: { slug: "black-ops-2", label: "Black Ops 2" },
};

const ALLOWED_MAPS: Record<string, string[]> = {
  BO7: ["Den", "Frequency", "Gridlock", "Raid", "Scar", "Standoff", "Hacienda", "Colossus"],
  BO6: ["Protocol", "Rewind", "Skyline", "Vault", "Hacienda", "Firing Range", "Fringe", "Red Card"],
  MW3: ["Highrise", "Invasion", "Karachi", "Rio", "6 Star", "Scrapyard", "Sub Base", "Vista"],
  VG: ["Tuscan", "Berlin", "Bocage", "USS Texas", "Demyansk", "Gavutu"],
  CW: ["Checkmate", "Moscow", "Raid", "Express", "Standoff", "Miami", "Apocalypse", "Garrison"],
  WW2: ["Ardennes Forest", "Gibraltar", "London Docks", "Sainte Marie du Mont", "USS Texas"],
  BO2: ["Cargo", "Express", "Raid", "Slums", "Standoff", "Meltdown", "Yemen"],
};

const PAGE_OVERRIDES: Record<string, Record<string, string[]>> = {
  MW3: {
    Highrise: ["highrise-2", "highrise"],
    Invasion: ["invasion-2", "invasion"],
    Karachi: ["karachi-2", "karachi"],
    Scrapyard: ["scrapyard-2", "scrapyard"],
    "Sub Base": ["sub-base-2", "sub-base"],
  },
  VG: {
    "USS Texas": ["uss-texas-1945", "uss-texas"],
  },
  CW: {
    Standoff: ["stand-off", "standoff"],
  },
  WW2: {
    "Sainte Marie du Mont": ["sainte-marie-du-mont", "saint-marie-du-mont"],
  },
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const slugify = (value: string) =>
  normalize(value)
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "");

const decodeHtml = (value: string) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&#038;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');

const absoluteUrl = (value: string, base: string) => {
  try {
    return new URL(decodeHtml(value), base).toString();
  } catch {
    return "";
  }
};

const fetchHtml = async (url: string) => {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.9",
      referer: "https://callofdutymaps.com/",
    },
  });

  if (!response.ok) return null;
  const type = String(response.headers.get("content-type") || "").toLowerCase();
  if (!type.includes("text/html")) return null;

  return {
    url: response.url || url,
    html: await response.text(),
  };
};

const extractMetaImage = (html: string, pageUrl: string) => {
  const metaPatterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["'][^>]*>/i,
  ];

  for (const pattern of metaPatterns) {
    const match = html.match(pattern);
    const resolved = match?.[1] ? absoluteUrl(match[1], pageUrl) : "";
    if (resolved) return resolved;
  }

  const images = [...html.matchAll(/<img\b[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => absoluteUrl(match[1], pageUrl))
    .filter((url) => /\/wp-content\/uploads\//i.test(url))
    .filter((url) => !/(logo|icon|avatar|rating|prestige|blank)/i.test(url));

  return images[0] || "";
};

const sameMap = (candidateUrl: string, gameSlug: string, mapName: string) => {
  try {
    const url = new URL(candidateUrl);
    if (url.hostname !== "callofdutymaps.com" && !url.hostname.endsWith(".callofdutymaps.com")) return false;

    const path = normalize(url.pathname);
    const gameTokens = normalize(gameSlug).split(" ").filter(Boolean);
    const mapTokens = normalize(mapName).split(" ").filter(Boolean);

    const gameScore = gameTokens.filter((token) => path.includes(token)).length;
    const mapScore = mapTokens.filter((token) => path.includes(token)).length;

    return gameScore >= Math.max(1, gameTokens.length - 1) && mapScore >= Math.max(1, mapTokens.length - 1);
  } catch {
    return false;
  }
};

const searchReferencePage = async (gameSlug: string, gameLabel: string, mapName: string) => {
  const query = encodeURIComponent(`${mapName} ${gameLabel}`);
  const result = await fetchHtml(`https://callofdutymaps.com/?s=${query}`);
  if (!result) return "";

  const hrefs = [...result.html.matchAll(/<a\b[^>]+href=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => absoluteUrl(match[1], result.url))
    .filter(Boolean);

  return hrefs.find((href) => sameMap(href, gameSlug, mapName)) || "";
};

const resolveReference = async (game: string, mapName: string) => {
  const gameMeta = GAME_META[game];
  if (!gameMeta) return null;

  const overrides = PAGE_OVERRIDES?.[game]?.[mapName] || [];
  const slugs = [...new Set([...overrides, slugify(mapName)])];

  for (const slug of slugs) {
    const pageUrl = `https://callofdutymaps.com/${gameMeta.slug}/${slug}/`;
    const page = await fetchHtml(pageUrl);
    if (!page) continue;

    const imageUrl = extractMetaImage(page.html, page.url);
    if (imageUrl) return { pageUrl: page.url, imageUrl };
  }

  const searchedPage = await searchReferencePage(gameMeta.slug, gameMeta.label, mapName);
  if (!searchedPage) return null;

  const page = await fetchHtml(searchedPage);
  if (!page) return null;

  const imageUrl = extractMetaImage(page.html, page.url);
  if (!imageUrl) return null;

  return { pageUrl: page.url, imageUrl };
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const game = String(url.searchParams.get("game") || "").trim().toUpperCase();
    const mapName = String(url.searchParams.get("map") || "").trim();

    const allowed = ALLOWED_MAPS[game] || [];
    const canonicalMap = allowed.find((name) => normalize(name) === normalize(mapName));
    if (!canonicalMap) {
      return new Response("Unknown map", { status: 404, headers: corsHeaders });
    }

    const resolved = await resolveReference(game, canonicalMap);
    if (!resolved?.imageUrl) {
      return new Response("Preview not found", {
        status: 404,
        headers: { ...corsHeaders, "Cache-Control": "public, max-age=900" },
      });
    }

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: resolved.imageUrl,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "X-Preview-Source": "callofdutymaps.com",
        "X-Preview-Reference": resolved.pageUrl,
      },
    });
  } catch (error) {
    console.error(error);
    return new Response("Preview unavailable", {
      status: 500,
      headers: { ...corsHeaders, "Cache-Control": "no-store" },
    });
  }
});
