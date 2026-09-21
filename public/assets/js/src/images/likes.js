const IMAGE_KINDS = new Set(['banner', 'cover', 'detail']);

export function isImageTarget(target) {
  return Boolean(
    target &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(target.contentId || '') &&
    IMAGE_KINDS.has(target.kind) &&
    Number.isInteger(target.index) &&
    target.index >= 0
  );
}

export function imageTargetKey(target) {
  return `${target.contentId}:${target.kind}:${target.index}`;
}

export function mapImageLikeSummaries(rows = []) {
  return new Map(
    rows.map((row) => [
      imageTargetKey({ contentId: row.content_id, kind: row.image_kind, index: Number(row.image_index) }),
      { count: Number(row.like_count) || 0, liked: Boolean(row.liked) }
    ])
  );
}
