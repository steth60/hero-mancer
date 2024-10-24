export class CacheManager {
  // Static properties to hold cached documents
  static cachedRaceDocs = null;

  static cachedClassDocs = null;

  static cachedBackgroundDocs = null;

  static enrichedCache = false;

  // Method to cache documents (you can pass all necessary document types here)
  static cacheDocuments({ raceDocs, classDocs, backgroundDocs }) {
    this.cachedRaceDocs = raceDocs;
    this.cachedClassDocs = classDocs;
    this.cachedBackgroundDocs = backgroundDocs;
    this.enrichedCache = true; // Flag to indicate cache is enriched
  }

  // Method to check if the cache is valid and enriched
  static isCacheValid() {
    return this.cachedRaceDocs && this.cachedClassDocs && this.cachedBackgroundDocs && this.enrichedCache;
  }

  // Method to retrieve cached documents (returns null if not available)
  static getCachedRaceDocs() {
    return this.cachedRaceDocs;
  }

  static getCachedClassDocs() {
    return this.cachedClassDocs;
  }

  static getCachedBackgroundDocs() {
    return this.cachedBackgroundDocs;
  }

  // Method to reset the cache (if needed, e.g., when documents update)
  static resetCache() {
    this.cachedRaceDocs = null;
    this.cachedClassDocs = null;
    this.cachedBackgroundDocs = null;
    this.enrichedCache = false;
  }
}
