/**
 * Manages document caching with singleton pattern
 * @class
 */
export class CacheManager {
  static #instance;

  #raceDocs;

  #classDocs;

  #backgroundDocs;

  constructor() {
    if (CacheManager.#instance) {
      return CacheManager.#instance;
    }
    CacheManager.#instance = this;
  }

  /**
   * Stores documents in cache
   * @param {object} params Document parameters
   * @param {Array} params.raceDocs Race documents
   * @param {Array} params.classDocs Class documents
   * @param {Array} params.backgroundDocs Background documents
   * @throws {Error} If documents are invalid
   */
  cacheDocuments({ raceDocs, classDocs, backgroundDocs }) {
    if (!Array.isArray(raceDocs) || !Array.isArray(classDocs) || !Array.isArray(backgroundDocs)) {
      throw new Error('All documents must be arrays');
    }

    if (!raceDocs.length || !classDocs.length || !backgroundDocs.length) {
      throw new Error('Document arrays cannot be empty');
    }

    this.#raceDocs = raceDocs;
    this.#classDocs = classDocs;
    this.#backgroundDocs = backgroundDocs;
  }

  /**
   * Checks if cache contains valid documents
   * @returns {boolean}
   */
  isCacheValid() {
    return Boolean(this.#raceDocs && this.#classDocs && this.#backgroundDocs);
  }

  /**
   * Retrieves cached documents based on type
   * @param {'race'|'class'|'background'} type Type of documents to retrieve
   * @returns {Array|null} Requested cached documents
   * @throws {Error} If invalid type is provided
   */
  getCachedDocs(type) {
    switch (type) {
      case 'race':
        return this.#raceDocs;
      case 'class':
        return this.#classDocs;
      case 'background':
        return this.#backgroundDocs;
      default:
        throw new Error('Invalid document type. Must be "race", "class", or "background"');
    }
  }

  /**
   * Resets all cached documents
   */
  resetCache() {
    this.#raceDocs = null;
    this.#classDocs = null;
    this.#backgroundDocs = null;
  }
}
