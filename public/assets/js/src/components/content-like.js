import { getImageKey } from '../images/likes.js';
import { element } from './dom.js';

export function createCoverLikeButton(item) {
  const imageKey = getImageKey(item?.cover_url);
  if (!imageKey) return null;
  return element(
    'button',
    {
      className: 'image-like-button image-like-button--inline library-like-button',
      attributes: {
        type: 'button',
        'data-image-like': '',
        'data-image-like-summary-keys': JSON.stringify([imageKey]),
        'aria-label': `点赞${item.title}`,
        'aria-pressed': 'false'
      }
    },
    [
      element('span', { text: '♡', attributes: { 'aria-hidden': 'true' } }),
      element('span', { className: 'sr-only', text: '点赞', attributes: { 'data-image-like-label': '' } }),
      element('strong', { className: 'card__like-count', text: '0', attributes: { 'data-image-like-count': '' } })
    ]
  );
}
