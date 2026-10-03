import logoAsset from "@/assets/blue-origin-logo.png.asset.json";
import blueMoonMark1 from "@/assets/blue-moon-mark-1.jpg.asset.json";
import blueMoonMark2 from "@/assets/blue-moon-mark-2.jpeg.asset.json";
import blueMoonPathfinder from "@/assets/blue-moon-pathfinder.jpeg.asset.json";
import newGlenn from "@/assets/new-glenn.jpeg.asset.json";
import blueRing from "@/assets/blue-ring.jpg.asset.json";
import newShepardCrew from "@/assets/new-shepard-crew.jpeg.asset.json";
import newShepardBooster from "@/assets/new-shepard-booster.jpeg.asset.json";
import newShepardCapsule from "@/assets/new-shepard-capsule.jpg.asset.json";
import orbitalFactory from "@/assets/orbital-factory.jpg.asset.json";

export const BRAND_NAME = "BLUE ORIGIN";
export const BRAND_LOGO = logoAsset.url;

const planImages = [
  orbitalFactory.url,
  newShepardCrew.url,
  newShepardBooster.url,
  blueRing.url,
  newGlenn.url,
  blueMoonMark1.url,
  blueMoonMark2.url,
  blueMoonPathfinder.url,
  blueRing.url,
  newGlenn.url,
  orbitalFactory.url,
] as const;

export function getPlanImage(index: number) {
  return planImages[Math.max(0, Math.min(planImages.length - 1, index - 1))];
}
