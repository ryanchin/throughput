/**
 * Generate a URL-friendly slug from a title.
 * - Lowercase
 * - Replace spaces and special chars with hyphens
 * - Remove consecutive hyphens
 * - Trim leading/trailing hyphens
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')   // Remove special chars (keep word chars, spaces, hyphens)
    .replace(/[\s_]+/g, '-')    // Replace spaces and underscores with hyphens
    .replace(/-+/g, '-')        // Collapse consecutive hyphens
    .replace(/^-+|-+$/g, '')    // Trim leading/trailing hyphens
}
