# ADR-001: Styling with NativeWind

- **Status:** Accepted
- **Date:** 2026-06-04
- **Deciders:** Engineering, UX
- **Sprint:** 1 (Story 5)

## Context

StitchMap Mobile ships from a single Expo codebase to iOS, Android, and web. We need
a styling approach that:

- Works consistently across all three platforms from one source of truth.
- Keeps styling co-located with components so contributors can move quickly.
- Supports a shared, tokenized design system that UX can own and evolve.
- Adds minimal runtime overhead and integrates cleanly with Expo SDK 56, the New
  Architecture, and Hermes.

## Decision

Use **NativeWind v4** (Tailwind CSS utility classes via the `className` prop) as the
primary styling layer.

Configuration:

- `tailwind.config.js` registers the `nativewind/preset`, scans the `app/` (and
  `components/`) directories, and defines a baseline set of placeholder design tokens
  (colors, spacing, typography). The finalized palette is owned by UX in a later sprint.
- `babel.config.js` enables `jsxImportSource: "nativewind"` on `babel-preset-expo` and
  adds the `nativewind/babel` preset.
- `metro.config.js` wraps the default Expo Metro config with `withNativeWind`, using
  `global.css` (the Tailwind entry point) as input.
- `nativewind-env.d.ts` references `nativewind/types` so the `className` prop type-checks.

## Alternatives Considered

- **React Native `StyleSheet` (status quo).** Built in, zero dependencies, and already
  used in the scaffold. Rejected as the primary approach because it offers no design-token
  system, encourages verbose per-component style objects, and provides no shared utility
  vocabulary across the team. (It remains available for one-off cases where utilities are
  awkward.)
- **Tamagui.** Powerful theming, an optimizing compiler, and strong performance. Rejected
  for now due to a heavier configuration surface and steeper learning curve than the team
  needs at this stage; revisit if advanced theming/animation demands grow.
- **Shopify Restyle.** Type-safe, theme-driven styling with a clean API. Rejected because
  it is React Native only (no first-class web story) and relies on per-component style
  props rather than a portable utility vocabulary.

## Consequences

- Positive: one styling vocabulary across iOS, Android, and web; tokens centralized in
  `tailwind.config.js`; fast iteration with co-located `className`s; large, well-documented
  Tailwind ecosystem.
- Positive: design tokens can evolve in one place without touching components.
- Negative: adds NativeWind, Tailwind, and (transitively) `react-native-reanimated`
  dependencies plus Babel/Metro configuration that must stay aligned with Expo SDK upgrades.
- Negative: contributors must learn Tailwind utility conventions.
- Neutral: the placeholder token set in this ADR is intentionally minimal; UX finalizes the
  palette, spacing scale, and type ramp in a later sprint.
