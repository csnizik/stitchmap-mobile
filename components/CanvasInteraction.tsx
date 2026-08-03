/**
 * Resolution fallback so TypeScript can type the import. Metro prefers the
 * .native.tsx and .web.tsx variants on their respective platforms.
 */

export { default } from './CanvasInteraction.native';
