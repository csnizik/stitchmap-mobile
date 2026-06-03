# StitchMap Mobile

A universal cross-stitch pattern and progress-tracking app for iOS, Android, and web, built from a single Expo codebase.

## Stack

- Expo SDK 56 · React Native 0.85 · React 19.2
- New Architecture + Hermes
- TypeScript (strict mode)

## Prerequisites

- Node.js 20+ (developed on 22)
- npm
- iOS: Xcode + simulator (macOS only), or Expo Go on a device
- Android: Android Studio + emulator, or Expo Go on a device

## Install

```bash
npm install
```

## Run

```bash
npm run start     # Expo dev server — pick a platform from the CLI
npm run ios       # iOS simulator (macOS)
npm run android   # Android emulator
npm run web       # Web browser
```

## Project Conventions

The team operating model, role definitions, sprint cadence, and contribution rules live in [`.github/AGENTS.md`](.github/AGENTS.md). Sprint artifacts are in [`docs/sprints/`](docs/sprints/); architecture decisions in [`docs/decisions/`](docs/decisions/).

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/). Branch from `develop`; pull requests target `develop`. `main` is release-only.
