const IMAGE_KINDS = new Set(['banner', 'cover', 'detail']);
const IMAGE_KEY_PATTERN = /^[^/?#]+\/.+$/;
const STORAGE_PUBLIC_URL_PATTERN = /^https?:\/\/[^/]+\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/i;

export function getImageKey(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const normalizedUrl = raw.split('#', 1)[0].split('?', 1)[0];
  const match = normalizedUrl.match(STORAGE_PUBLIC_URL_PATTERN);
  if (!match) return null;
  const bucket = match[1].toLowerCase();
  const objectPath = match[2].replace(/^\/+|\/+$/g, '');
  if (!bucket || !objectPath) return null;
  const imageKey = `${bucket}/${objectPath}`;
  return imageKey.length <= 2048 ? imageKey : null;
}

export function isImageTarget(target) {
  return Boolean(
    target &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(target.contentId || '') &&
    IMAGE_KINDS.has(target.kind) &&
    Number.isInteger(target.index) &&
    target.index >= 0 &&
    typeof target.imageKey === 'string' &&
    target.imageKey.length <= 2048 &&
    IMAGE_KEY_PATTERN.test(target.imageKey)
  );
}

export function imageTargetKey(target) {
  return target.imageKey;
}

export function mapImageLikeSummaries(rows = []) {
  return new Map(rows.map((row) => [row.image_key, { count: Number(row.like_count) || 0, liked: Boolean(row.liked) }]));
}

export function sumImageLikeCounts(summaries, imageKeys = []) {
  return [...new Set(imageKeys)].reduce((total, imageKey) => total + (summaries.get(imageKey)?.count || 0), 0);
}
