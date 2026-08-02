/**
 * Resolution fallback so TypeScript can type the import. Metro prefers
 * SkiaHost.native.tsx and SkiaHost.web.tsx over this file on their respective
 * platforms, so at runtime this is only reached in a plain Node context such
 * as jest. The native path is the correct behaviour there, since there is no
 * CanvasKit to wait for.
 */

export { default } from './SkiaHost.native';
