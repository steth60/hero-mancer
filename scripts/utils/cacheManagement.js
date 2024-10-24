export class CacheManager {
  // Static properties to hold cached documents
  static cachedRaceDocs = null;

  static cachedClassDocs = null;

  static cachedBackgroundDocs = null;

  static cachedRaceDropdownHtml = null;

  static cachedClassDropdownHtml = null;

  static cachedBackgroundDropdownHtml = null;

  static enrichedCache = false;

  // Method to cache documents (you can pass all necessary document types here)
  static cacheDocuments({
    raceDocs,
    raceDropdownHtml,
    classDocs,
    classDropdownHtml,
    backgroundDocs,
    backgroundDropdownHtml
  }) {
    this.cachedRaceDocs = raceDocs;
    this.cachedRaceDropdownHtml = raceDropdownHtml;
    this.cachedClassDocs = classDocs;
    this.cachedClassDropdownHtml = classDropdownHtml;
    this.cachedBackgroundDocs = backgroundDocs;
    this.cachedBackgroundDropdownHtml = backgroundDropdownHtml;
    this.enrichedCache = true; // Flag to indicate cache is enriched
  }

  // Method to check if the cache is valid and enriched
  static isCacheValid() {
    return (
      this.cachedRaceDocs &&
      this.cachedClassDocs &&
      this.cachedBackgroundDocs &&
      this.cachedRaceDropdownHtml &&
      this.cachedClassDropdownHtml &&
      this.cachedBackgroundDropdownHtml &&
      this.enrichedCache
    );
  }

  // Method to retrieve cached documents
  static getCachedRaceDocs() {
    return this.cachedRaceDocs;
  }

  static getCachedClassDocs() {
    return this.cachedClassDocs;
  }

  static getCachedBackgroundDocs() {
    return this.cachedBackgroundDocs;
  }

  // Methods to retrieve cached dropdown HTML
  static getCachedRaceDropdownHtml() {
    return this.cachedRaceDropdownHtml;
  }

  static getCachedClassDropdownHtml() {
    return this.cachedClassDropdownHtml;
  }

  static getCachedBackgroundDropdownHtml() {
    return this.cachedBackgroundDropdownHtml;
  }

  // Method to reset the cache (if needed, e.g., when documents update)
  static resetCache() {
    this.cachedRaceDocs = null;
    this.cachedRaceDropdownHtml = null;
    this.cachedClassDocs = null;
    this.cachedClassDropdownHtml = null;
    this.cachedBackgroundDocs = null;
    this.cachedBackgroundDropdownHtml = null;
    this.enrichedCache = false;
  }
}
