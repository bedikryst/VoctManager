/**
 * @file formatters.ts
 * @description Utility functions for data and string manipulation within the Project boundary.
 * Extracts pure, stateless transformation logic away from UI components.
 * The `getSpotifyEmbedUrl` implements a deterministic URL parser that intercepts 
 * standard Spotify share links and upgrades them to generator-enforced embed URLs.
 * @module panel/projects/ProjectCard/utils/formatters
 */

/**
 * Transforms a standard Spotify URL into a generator-forced embed URL.
 * @param {string} [url] - The raw Spotify URL (playlist, album, or track).
 * @returns {string | null} The formatted embed URL or null if invalid.
 */
export const getSpotifyEmbedUrl = (url?: string): string | null => {
    if (!url) return null;
    
    if (url.includes('/embed/')) {
        return url.includes('?') ? url : `${url}?utm_source=generator`;
    }
    
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname.includes('spotify.com')) {
            const pathParts = urlObj.pathname.split('/').filter(Boolean); 
            if (pathParts.length >= 2) {
                return `https://open.spotify.com/embed/${pathParts[0]}/${pathParts[1]}?utm_source=generator`;
            }
        }
        return url;
    } catch (e) { 
        return null; 
    }
};