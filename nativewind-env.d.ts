/// <reference types="nativewind/types" />

// Allow side-effect imports of the Tailwind entry point (`global.css`). Metro
// transforms this via NativeWind; the declaration keeps `tsc` happy without it.
declare module '*.css';
