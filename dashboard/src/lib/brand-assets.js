import brandAssets from "./brand-assets.json";

export function brandAssetUrl(filename) {
  const url = brandAssets[filename];
  if (!url) throw new Error(`Missing generated brand asset URL: ${filename}`);
  return url;
}
