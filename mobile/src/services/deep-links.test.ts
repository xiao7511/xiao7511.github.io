import { describe, expect, test } from 'vitest';
import { deepLinkRoute } from './deep-links';

describe('iOS universal link route mapping', () => {
  test('maps supported NOBI content routes', () => {
    expect(deepLinkRoute('https://www.nobistudio.com/anime/cd38c3bd-1094-4f66-8f9d-f983df0c2984')).toBe(
      '/anime/cd38c3bd-1094-4f66-8f9d-f983df0c2984'
    );
    expect(deepLinkRoute('https://nobistudio.com/manga/1197c273-dcb5-4af4-9c97-790c9e022b14/')).toBe(
      '/manga/1197c273-dcb5-4af4-9c97-790c9e022b14'
    );
    expect(deepLinkRoute('https://www.nobistudio.com/community/38')).toBe('/community/38');
  });

  test('rejects unknown hosts, schemes and unsupported routes', () => {
    expect(deepLinkRoute('https://evil.example/community/38')).toBeNull();
    expect(deepLinkRoute('http://www.nobistudio.com/community/38')).toBeNull();
    expect(deepLinkRoute('https://www.nobistudio.com/community/new')).toBeNull();
    expect(deepLinkRoute('not a URL')).toBeNull();
  });
});
