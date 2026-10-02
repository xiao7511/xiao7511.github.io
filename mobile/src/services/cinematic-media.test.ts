import { describe, expect, test } from 'vitest';
import { publicVideoUrl } from './cinematic-media';

describe('mobile hero video URLs', () => {
  test('uses only public HTTPS MP4/WebM media', () => {
    expect(publicVideoUrl('https://cdn.example.test/hero.webm')).toBe('https://cdn.example.test/hero.webm');
    expect(publicVideoUrl('http://cdn.example.test/hero.mp4')).toBe('');
    expect(publicVideoUrl('https://user:secret@cdn.example.test/hero.mp4')).toBe('');
    expect(publicVideoUrl('https://cdn.example.test/hero.mp4?token=secret')).toBe('');
    expect(publicVideoUrl(undefined)).toBe('');
  });
});
