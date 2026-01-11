# OpenGraph Image Creation Guide

**Status:** ⚠️ OG image needs to be created  
**Required Size:** 1200x630px  
**Format:** PNG or JPG  
**Filename:** `og-image.png`

## Why This Matters

OpenGraph images appear when your app is shared on:
- Twitter/X (Twitter Cards)
- Discord (link previews)
- LinkedIn (social sharing)
- Slack (link unfurling)
- Facebook (shared links)

**Impact:** A good OG image increases click-through rates by 2-3x.

## Design Specifications

### Dimensions
- **Width:** 1200px
- **Height:** 630px
- **Aspect Ratio:** 1.91:1
- **Safe Zone:** Keep important content in the center 1000x500px (some platforms crop)

### Content Requirements

**Must Include:**
1. **Vaultfire Logo** - Shield + flame icon
2. **Headline:** "The Trust Layer for Base"
3. **Subheadline:** "Verify any claim with zero-knowledge proofs"
4. **Key Metrics:**
   - ~61k gas per verification
   - <2s proof generation
   - Post-quantum secure
5. **Call-to-Action:** "Production SDK for Base"

### Brand Colors (from design system)

```
Background: #000000 (black) with gradient
Primary: #0052FF (Base blue)
Accent: #8B5CF6 (Vaultfire purple)
Success: #10B981 (Vaultfire green)
Text: #FFFFFF (white)
```

### Typography

- **Headline Font:** Bold, 72-80px
- **Subheadline Font:** Medium, 32-36px
- **Metrics Font:** Regular, 24-28px
- **Font Family:** System fonts (Inter, SF Pro, or similar)

## Design Tools

### Option 1: Figma (Recommended)
1. Create 1200x630px frame
2. Use Vaultfire colors and logo
3. Export as PNG (2x for retina)

### Option 2: Canva (Easiest)
1. Use "Twitter Header" template (1500x500)
2. Resize to 1200x630px
3. Upload Vaultfire logo
4. Add text with brand colors

### Option 3: Code-Based (OG Image Generation)
```typescript
// Use @vercel/og for dynamic OG images
import { ImageResponse } from '@vercel/og';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          background: 'linear-gradient(135deg, #000 0%, #0052FF 100%)',
          width: '100%',
          height: '100%',
          // Add Vaultfire content here
        }}
      >
        {/* OG image content */}
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
```

## Example Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo]                                                     │
│                                                             │
│  The Trust Layer for Base                                  │
│  Verify any claim with zero-knowledge proofs               │
│                                                             │
│  ~61k gas  |  <2s proofs  |  Post-quantum secure           │
│                                                             │
│  Production SDK for Base                                   │
└─────────────────────────────────────────────────────────────┘
```

## Quick Mockup (ASCII Art)

```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║    🔥                                                         ║
║    [Shield+Flame Logo]                                       ║
║                                                               ║
║    THE TRUST LAYER FOR BASE                                  ║
║    Verify any claim with zero-knowledge proofs               ║
║                                                               ║
║    ┌─────────┬───────────┬──────────────────┐               ║
║    │ ~61k gas│ <2s proofs│ Post-quantum     │               ║
║    └─────────┴───────────┴──────────────────┘               ║
║                                                               ║
║    Production SDK for Base                                   ║
║    vaultfire.base.org                                        ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

## Checklist

Before finalizing your OG image:

- [ ] Image is exactly 1200x630px
- [ ] Logo is clearly visible
- [ ] Text is readable at small sizes (400px wide preview)
- [ ] Colors match Vaultfire brand (#0052FF blue, #8B5CF6 purple)
- [ ] Important content is in safe zone (center 1000x500px)
- [ ] No text is cut off at edges
- [ ] File size is under 1MB (ideally under 300KB)
- [ ] Saved as `og-image.png` in `/public/` directory
- [ ] Tested on [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- [ ] Tested on [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)

## Quick Test

Once you create `og-image.png`:

1. Place file in `/public/og-image.png`
2. Deploy to Vercel
3. Test at: https://www.opengraph.xyz/url/YOUR-URL
4. Verify preview looks good on Twitter/Discord

## Placeholder Solution (Temporary)

If you need to deploy immediately without a custom image, you can use a text-based fallback:

```html
<!-- In layout.tsx (already configured) -->
<meta property="og:image" content="/og-image.png" />
```

Create a simple placeholder:
1. Black background
2. White text: "Vaultfire - Trust Layer for Base"
3. Save as og-image.png

**Better than nothing!** But aim to create a professional image soon.

## Professional Design Services

If you want a professional OG image:
- **Fiverr:** $20-50 (search "OpenGraph image design")
- **Upwork:** $50-200 (hire graphic designer)
- **99designs:** $200-500 (design contest)

## Resources

- [OG Image Playground](https://og-playground.vercel.app/)
- [Vaultfire Logo SVG](../components/VaultfireLogo.tsx)
- [Brand Colors](../app/globals.css)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)

---

**Current Status:** ⚠️ Using placeholder reference, needs actual image creation

**Priority:** High (improves social sharing CTR by 2-3x)

**Estimated Time:** 30-60 minutes (DIY) or $20-50 (outsource)
