# NOBI Mobile API contract

The Cloudflare Worker at `https://api.nobistudio.com` is **EXTERNAL WORKER** code. This repository cannot inspect its implementation. The contracts below are limited to production responses verified on 2026-09-27 and calls present in the Web client.

| Endpoint         | Method | Authentication | Request         | Proven response                                          | Pagination                       | Mobile usage                                                |
| ---------------- | ------ | -------------- | --------------- | -------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------- |
| `/`              | GET    | None           | None            | `{ SUPABASE_URL, ANON_KEY }` public client configuration | None                             | Bootstrap Supabase when build-time public values are absent |
| `/api/recommend` | GET    | None           | None            | Array of content records                                 | Not supported by proven contract | Anime list/home                                             |
| `/api/manga`     | GET    | None           | None            | Array of content records                                 | Not supported by proven contract | Manga list/home                                             |
| `/api/detail`    | GET    | None           | `category=anime | manga`, `slot=integer`                                   | One content record               | None                                                        | Anime/manga detail |

Verified content fields: `id` UUID, `category`, `slot_index`, nullable/empty `title`, `subtitle`, `theme_tags[]`, `cover_url`, `detail_urls[]`, `updated_at`. `year`, `rating`, `status`, `description`, `likes`, banner and chapter fields are **UNKNOWN / absent**. HTTP errors use status responses; the Worker error JSON schema is **UNKNOWN**.

The following operations are direct Supabase JS calls through the public URL returned above:

| Resource           | Proven operation                                                                               | Authentication                                                | Contract                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Auth               | `signInWithPassword`, `signUp`, `signOut`, `getSession`, `refreshSession`, `onAuthStateChange` | As defined by Supabase Auth                                   | Mobile authentication/session                                                            |
| `profiles`         | Select by `id`                                                                                 | Public read under repository migration                        | `{ id, created_at, nickname, avatar_url }`                                               |
| `posts`            | Select main posts/replies; insert post/reply                                                   | Public read; authenticated insert with `user_id = auth.uid()` | `{ id, user_id, created_at, content, nickname, avatar_url, title, category, parent_id }` |
| `post_likes`       | Select `post_id,user_id`                                                                       | Public read                                                   | Composite identity `(post_id,user_id)`                                                   |
| `toggle_post_like` | RPC `{ p_post_id, p_remove }`                                                                  | Authenticated                                                 | First row `{ liked, like_count }`; atomic and serialized per post                        |

The Web client proves five-item range pagination for community posts. Content API pagination, content search parameters, community images and nested replies beyond one `parent_id` level are not proven. Manga chapter/reader endpoints do not exist in the verified contract.
