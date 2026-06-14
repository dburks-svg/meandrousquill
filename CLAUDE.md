# Psalms of the Dragon - meandrousquill.com

## What This Is

A memorial website for Deborah Burks' high fantasy novel "Dragon's Eggs and Spirit Stones." Deborah spent 12 years writing this book by hand, drew maps, took writing classes, and built an entire world with zero AI assistance. She passed away from COPD and hypertension. Her husband Dana is sharing her life's work freely at meandrousquill.com. "Meandrous Quill" was Deborah's writing handle across all her writing forums.

## The Book

- **Title**: Dragon's Eggs and Spirit Stones
- **Author**: Deborah Burks
- **Length**: ~114,600 words, 48 chapters, 276 pages of content
- **Genre**: High fantasy with deep worldbuilding
- **Source**: Single PDF at `D:\Psalms of the Dragon\Dragon's Eggs and Spirit Stones.pdf`
- **Key characters**: Marley Stonebender (runesmith), Drogan Thane (bard/prince), Jayf (dragonkin), Kestrel (young woman), Glyf (dragon hatchling), Chayse (Al'Far heritage)
- **World elements**: Runestones, essence-weaving, Dragon Paths, Al'Far, Echoing Note guild, blood-locked messages, elementals, moons Raisha and Kalyani

## Technical Stack

- Pure HTML/CSS/JS, no frameworks
- Hosted on Cloudflare Pages (project: `meandrousquill`)
- Domain: meandrousquill.com (Cloudflare, purchased for 2 years)
- GitHub repo: https://github.com/dburks-svg/meandrousquill
- Deploy: `npx wrangler pages deploy . --project-name meandrousquill --branch master`

## Project Structure

- `index.html` - Cinematic landing page with particle effects and staggered reveal animation
- `chapters/chapter-01.html` through `chapter-48.html` - One HTML file per chapter
- `css/style.css` - Dark fantasy theme (warm browns, gold accents, Cinzel + Crimson Text fonts)
- `js/reader.js` - Bookmark system, scroll position tracking, reading progress, keyboard nav, font toggle
- `table-of-contents.html` - Chapter listing with progress/bookmark indicators
- `dedication.html` - Memorial dedication (needs Dana's personal text)
- `about.html` - About Deborah / Meandrous Quill (needs Dana's personal text)
- `map.html` - Placeholder for Deborah's hand-drawn map (pen and pencil on a large board)
- `tools/` - Python scripts for PDF extraction and chapter modification (not deployed, in .gitignore)

## Key Behaviors

- Never alter Deborah's text. The words are hers.
- The site is completely free. No ads, no paywalls, no accounts, no tracking.
- Reader data (bookmarks, scroll position, progress) is stored in browser localStorage only.
- The visual design draws from the book's own world: runestones, firelight, essence-weaving, Dragon Paths.
- `prefers-reduced-motion` is respected throughout. All content works without JS.

## Pending Work

- Dana needs to write the dedication and about-the-author pages
- Deborah's hand-drawn map needs to be photographed and added to `images/map.jpg`
- ElevenLabs Audio Native integration (Dana has a subscription; script at `tools/add-audio-native.py`)
- Page-turn reading mode for desktop/tablet (planned dual mode: page-turn + scroll)
- The CNAME file can be removed (was for GitHub Pages, now using Cloudflare Pages)

## Deployment

```
npx wrangler pages deploy . --project-name meandrousquill --branch master
```

Always commit and push to GitHub first, then deploy to Cloudflare Pages.
