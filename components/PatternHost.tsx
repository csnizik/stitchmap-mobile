/**
 * Resolution fallback so TypeScript can type the import. Metro prefers
 * PatternHost.native.tsx and PatternHost.web.tsx on their respective
 * platforms, so this is only reached in a plain Node context such as jest,
 * where rendering directly is the correct behaviour.
 */

export { default } from './PatternHost.native';
