const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const MAPS_PAGE = "https://callofduty.fandom.com/wiki/Maps";
const FANDOM_API = "https://callofduty.fandom.com/api.php";

const GAME_META: Record<string, { label: string; aliases: string[]; headingIds: string[] }> = {
  BO7: {
    label: "Call of Duty: Black Ops 7",
    aliases: ["Call of Duty: Black Ops 7"],
    headingIds: ["Call_of_Duty:_Black_Ops_7"],
  },
  BO6: {
    label: "Call of Duty: Black Ops 6",
    aliases: ["Call of Duty: Black Ops 6"],
    headingIds: ["Call_of_Duty:_Black_Ops_6"],
  },
  MW3: {
    label: "Call of Duty: Modern Warfare III",
    aliases: ["Call of Duty: Modern Warfare III", "Modern Warfare III"],
    headingIds: ["Call_of_Duty:_Modern_Warfare_III"],
  },
  VG: {
    label: "Call of Duty: Vanguard",
    aliases: ["Call of Duty: Vanguard"],
    headingIds: ["Call_of_Duty:_Vanguard"],
  },
  CW: {
    label: "Call of Duty: Black Ops Cold War",
    aliases: ["Call of Duty: Black Ops Cold War", "Black Ops Cold War"],
    headingIds: ["Call_of_Duty:_Black_Ops_Cold_War"],
  },
  WW2: {
    label: "Call of Duty: WWII",
    aliases: ["Call of Duty: WWII", "Call of Duty: WW2"],
    headingIds: ["Call_of_Duty:_WWII"],
  },
  BO2: {
    label: "Call of Duty: Black Ops II",
    aliases: ["Call of Duty: Black Ops II", "Black Ops II"],
    headingIds: ["Call_of_Duty:_Black_Ops_II"],
  },
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

const MAP_ALIASES: Record<string, string[]> = {
  "Sainte Marie du Mont": ["Sainte Marie du Mont", "Saint Marie du Mont"],
  "6 Star": ["6 Star", "6Star"],
  "Sub Base": ["Sub Base", "SubBase"],
  "Red Card": ["Red Card", "RedCard"],
  "Firing Range": ["Firing Range", "FiringRange"],
  "USS Texas": ["USS Texas", "USS Texas 1945"],
};

let cachedMapsHtml = "";
let cachedAt = 0;
const MAPS_CACHE_MS = 10 * 60 * 1000;

const decodeHtml = (value: string) =>
  String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&#038;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");

const stripTags = (value: string) =>
  decodeHtml(String(value || "").replace(/<[^>]*>/g, " "));

const normalize = (value: string) =>
  stripTags(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const absoluteUrl = (value: string, base = MAPS_PAGE) => {
  try {
    return new URL(decodeHtml(value), base).toString();
  } catch {
    return "";
  }
};

const fetchMapsHtml = async () => {
  if (cachedMapsHtml && Date.now() - cachedAt < MAPS_CACHE_MS) {
    return cachedMapsHtml;
  }

  const params = new URLSearchParams({
    action: "parse",
    page: "Maps",
    prop: "text",
    format: "json",
    origin: "*",
  });

  const response = await fetch(`${FANDOM_API}?${params.toString()}`, {
    redirect: "follow",
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153 Safari/537.36",
      accept: "application/json,text/plain,*/*",
      "accept-language": "en-US,en;q=0.9",
      referer: MAPS_PAGE,
    },
  });

  if (!response.ok) return "";

  const data = await response.json().catch(() => ({}));
  const html = String(data?.parse?.text?.["*"] || "");
  if (!html) return "";

  cachedMapsHtml = html;
  cachedAt = Date.now();
  return html;
};

const findGameSection = (html: string, game: string) => {
  const meta = GAME_META[game];
  if (!meta || !html) return "";

  let headingIndex = -1;

  for (const id of meta.headingIds) {
    const patterns = [
      `id="${id}"`,
      `id='${id}'`,
      `id="${encodeURIComponent(id)}"`,
      `id='${encodeURIComponent(id)}'`,
    ];

    for (const pattern of patterns) {
      const index = html.indexOf(pattern);
      if (index >= 0) {
        headingIndex = index;
        break;
      }
    }

    if (headingIndex >= 0) break;
  }

  if (headingIndex < 0) {
    const headings = [...html.matchAll(/<h2\b[^>]*>[\s\S]*?<\/h2>/gi)];
    const match = headings.find((item) => {
      const text = normalize(item[0]);
      return meta.aliases.some((alias) => text.includes(normalize(alias)));
    });
    if (match?.index !== undefined) headingIndex = match.index;
  }

  if (headingIndex < 0) return "";

  const h2Start = html.lastIndexOf("<h2", headingIndex);
  const start = h2Start >= 0 ? h2Start : headingIndex;
  const nextH2 = html.indexOf("<h2", Math.max(start + 3, headingIndex + 1));
  const end = nextH2 >= 0 ? nextH2 : html.length;

  return html.slice(start, end);
};

const imageUrlFromTag = (tag: string) => {
  const attrs = ["data-src", "data-image-src", "src"];
  for (const attr of attrs) {
    const match = tag.match(new RegExp(`${attr}=["']([^"']+)["']`, "i"));
    const value = match?.[1] ? absoluteUrl(match[1]) : "";
    if (value && !value.startsWith("data:")) return value;
  }

  const srcset = tag.match(/(?:data-srcset|srcset)=["']([^"']+)["']/i)?.[1] || "";
  if (srcset) {
    const first = srcset.split(",")[0]?.trim().split(/\s+/)[0] || "";
    const value = absoluteUrl(first);
    if (value && !value.startsWith("data:")) return value;
  }

  return "";
};

const highResTileUrl = (url: string) => {
  if (!url) return "";
  return url.replace(
    /\/scale-to-width-down\/\d+/i,
    "/scale-to-width-down/1000"
  );
};

const usableImage = (url: string) => {
  if (!url) return false;
  const normalized = url.toLowerCase();
  if (!/^https?:\/\//.test(url)) return false;
  if (/(logo|wordmark|avatar|favicon|sprite|placeholder|blank|icon)/i.test(normalized)) return false;
  return (
    normalized.includes("wikia") ||
    normalized.includes("fandom") ||
    normalized.includes("nocookie.net")
  );
};

const findTileImage = (section: string, mapName: string) => {
  const aliases = MAP_ALIASES[mapName] || [mapName];
  const normalizedAliases = aliases.map(normalize).filter(Boolean);

  const items = [...section.matchAll(
    /<div\b[^>]*class=["'][^"']*wikia-gallery-item[^"']*["'][^>]*>[\s\S]*?<div\b[^>]*class=["'][^"']*lightbox-caption[^"']*["'][^>]*>[\s\S]*?<\/div><\/div>/gi
  )];

  for (const itemMatch of items) {
    const item = itemMatch[0];
    const captionMatch = item.match(
      /<div\b[^>]*class=["'][^"']*lightbox-caption[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
    );
    const captionText = normalize(captionMatch?.[1] || "");
    if (!captionText) continue;

    const matchesMap = normalizedAliases.some(
      (alias) => captionText === alias || captionText.startsWith(`${alias} `)
    );
    if (!matchesMap) continue;

    const imageTags = [...item.matchAll(/<img\b[^>]*>/gi)]
      .map((match) => imageUrlFromTag(match[0]))
      .filter(usableImage);

    if (imageTags[0]) return highResTileUrl(imageTags[0]);
  }

  return "";
};

const resolveFromMapsPage = async (game: string, mapName: string) => {
  const html = await fetchMapsHtml();
  if (!html) return null;

  const section = findGameSection(html, game);
  if (!section) return null;

  const imageUrl = findTileImage(section, mapName);
  if (!imageUrl) return null;

  return {
    imageUrl,
    referenceUrl: MAPS_PAGE,
    gameLabel: GAME_META[game]?.label || game,
  };
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
      return new Response("Unknown map", {
        status: 404,
        headers: { ...corsHeaders, "Cache-Control": "public, max-age=900" },
      });
    }

    const resolved = await resolveFromMapsPage(game, canonicalMap);

    if (!resolved?.imageUrl) {
      return new Response("Preview not found on Fandom Maps page", {
        status: 404,
        headers: {
          ...corsHeaders,
          "Cache-Control": "public, max-age=900",
          "X-Preview-Source": "callofduty.fandom.com/wiki/Maps",
        },
      });
    }

    const imageResponse = await fetch(resolved.imageUrl, {
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153 Safari/537.36",
        referer: MAPS_PAGE,
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    });

    const contentType = String(imageResponse.headers.get("content-type") || "");
    if (!imageResponse.ok || !contentType.toLowerCase().startsWith("image/")) {
      return new Response("Preview image unavailable", {
        status: 404,
        headers: {
          ...corsHeaders,
          "Cache-Control": "public, max-age=900",
          "X-Preview-Source": "callofduty.fandom.com/wiki/Maps",
        },
      });
    }

    return new Response(imageResponse.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "X-Preview-Source": "callofduty.fandom.com/wiki/Maps",
        "X-Preview-Reference": resolved.referenceUrl,
        "X-Preview-Game": resolved.gameLabel,
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
