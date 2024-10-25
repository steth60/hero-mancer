export class CacheManager {
  static cachedRaceDocs = null;

  static cachedClassDocs = null;

  static cachedBackgroundDocs = null;

  static cachedRaceDropdownHtml = null;

  static cachedClassDropdownHtml = null;

  static cachedBackgroundDropdownHtml = null;

  static enrichedCache = false;

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
    this.enrichedCache = true;
  }

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

  static getCachedRaceDocs() {
    return this.cachedRaceDocs;
  }

  static getCachedClassDocs() {
    return this.cachedClassDocs;
  }

  static getCachedBackgroundDocs() {
    return this.cachedBackgroundDocs;
  }

  static getCachedRaceDropdownHtml() {
    return this.cachedRaceDropdownHtml;
  }

  static getCachedClassDropdownHtml() {
    return this.cachedClassDropdownHtml;
  }

  static getCachedBackgroundDropdownHtml() {
    return this.cachedBackgroundDropdownHtml;
  }

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
