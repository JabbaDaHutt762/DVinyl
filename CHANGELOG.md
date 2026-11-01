# Changelog — DVinyl Clemons fork

This is a community-maintained fork of [Kyonew/DVinyl](https://github.com/Kyonew/DVinyl).
Version numbers use the `-clemons.N` suffix to distinguish our work from official releases.

## 3.3.0-clemons.2 — November 1, 2026

**Album-grouping filter persistence fix.**

- Restores stable search defaults: Core Studio Albums, Artist Only, Non-live, Hide Compilations, Hide Singles/EPs, and US pressing preference.
- Preserves chosen catalog and artist modes when an album is selected, pressing filters change, or the user goes Back to Albums.
- Preserves multiple Discogs master IDs when refining a grouped album's pressings.
- Distinguishes intentionally unchecked exclusion controls from missing fields on form submissions.
- Makes Live Only / All Recordings switch to the broader Discogs catalog instead of silently ignoring the request.
- Adds regression tests covering default filters, grouped masters, studio classification, and round-trip navigation.

No database migration required.

## 3.3.0-clemons.1 — November 1, 2026

**Initial tracked fork release** (previous experimental images were only tagged `latest`).

### Improved album search

- Artist-first browsing and distinct album cards instead of individual pressings ([PR #1](https://github.com/JabbaDaHutt762/DVinyl/pull/1)).
- Optional non-live, compilation and singles/EP filters; US preferred for pressings ([PR #2](https://github.com/JabbaDaHutt762/DVinyl/pull/2)).
- Direct Configure Album screen with a pressing/edition dropdown and its barcode ([PR #3](https://github.com/JabbaDaHutt762/DVinyl/pull/3)).
- Strict artist matching and duplicate-master grouping ([PR #4](https://github.com/JabbaDaHutt762/DVinyl/pull/4)).
- MusicBrainz core-studio-album browsing, with Discogs for individual vinyl pressings ([PR #5](https://github.com/JabbaDaHutt762/DVinyl/pull/5)).

### Reliability fixes

- Resolve albums to linked Discogs masters when possible; tolerate title spelling differences such as `12 × 5` and `12 X 5`.
- Throttle and retry temporary Discogs/MusicBrainz API failures instead of failing instantly.
- Use alternate iTunes album covers when Cover Art Archive thumbnails are missing.
- Add regression tests for album matching, master links and cover fallback ([PR #6](https://github.com/JabbaDaHutt762/DVinyl/pull/6)).

### Known limitations

- Exact album categories depend on MusicBrainz curation.
- Broad searches may omit results beyond each provider's pagination limit.
- No database migration is required; keep the same MongoDB and appdata.

## Reusing these changes

You may pull the versioned image `ghcr.io/jabbadahutt762/dvinyl:3.3.0-clemons.1`
or selectively merge the linked PRs into your own fork. The original MIT
license and upstream acknowledgements remain in place.
