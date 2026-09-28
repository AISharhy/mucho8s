import iron from "@/assets/ranks/iron.webp";
import bronze from "@/assets/ranks/bronze.webp";
import silver from "@/assets/ranks/silver.webp";
import gold from "@/assets/ranks/gold.webp";
import platinum from "@/assets/ranks/platinum.webp";
import diamond from "@/assets/ranks/diamond.webp";
import masters from "@/assets/ranks/masters.webp";

export const RANK_ARTWORK = {
  iron,
  bronze,
  silver,
  gold,
  platinum,
  diamond,
  masters,
};

export const rankFamilyFromId = (rankId = "") => {
  const id = String(rankId || "").toLowerCase();
  if (id.startsWith("iron")) return "iron";
  if (id.startsWith("bronze")) return "bronze";
  if (id.startsWith("silver")) return "silver";
  if (id.startsWith("gold")) return "gold";
  if (id.startsWith("platinum")) return "platinum";
  if (id.startsWith("diamond")) return "diamond";
  if (id.startsWith("masters")) return "masters";
  return "iron";
};

export const rankArtworkFor = (rankOrId) => {
  const id = typeof rankOrId === "string" ? rankOrId : rankOrId?.id;
  return RANK_ARTWORK[rankFamilyFromId(id)] || RANK_ARTWORK.iron;
};
