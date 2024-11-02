export class CacheManager {
  static cachedRaceDocs = null;

  static cachedClassDocs = null;

  static cachedBackgroundDocs = null;

  static enrichedCache = false;

  static cacheDocuments({ raceDocs, classDocs, backgroundDocs }) {
    this.cachedRaceDocs = raceDocs;
    this.cachedClassDocs = classDocs;
    this.cachedBackgroundDocs = backgroundDocs;
    this.enrichedCache = true;
  }

  static isCacheValid() {
    return this.cachedRaceDocs && this.cachedClassDocs && this.cachedBackgroundDocs && this.enrichedCache;
  }

  static getCachedRaceDocs() {
    return this.cachedRaceDocs;
  }

  static getCachedClassDocs() {
    return this.cachedClassDocs;
  }

  static getCachedBackgroundDocs() {
    return this.cachedBackgroundDocs;
  }

  static resetCache() {
    this.cachedRaceDocs = null;
    this.cachedClassDocs = null;
    this.cachedBackgroundDocs = null;
    this.enrichedCache = false;
  }
}
