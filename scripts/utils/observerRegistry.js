import { HM } from '../utils/index.js';

/**
 * Manages MutationObserver instances throughout the application
 * to ensure proper tracking and cleanup
 * @class
 */
export class MutationObserverRegistry {
  /* -------------------------------------------- */
  /*  Static Properties                           */
  /* -------------------------------------------- */

  /** @type {Map<string, MutationObserver>} */
  static #registry = new Map();

  /* -------------------------------------------- */
  /*  Static Public Methods                       */
  /* -------------------------------------------- */

  /**
   * Registers a new MutationObserver with a unique key
   * @param {string} key Unique identifier for this observer
   * @param {HTMLElement} element The DOM element to observe
   * @param {MutationObserverInit} config Observer configuration options
   * @param {MutationCallback} callback Callback function for mutations
   * @returns {MutationObserver} The created observer instance
   */
  static register(key, element, config, callback) {
    // Clean up existing observer with this key if it exists
    this.unregister(key);

    try {
      // Create and store the new observer
      const observer = new MutationObserver(callback);
      observer.observe(element, config);
      this.#registry.set(key, observer);

      HM.log(3, `Registered observer: ${key}`);
      return observer;
    } catch (error) {
      HM.log(1, `Error registering observer for ${key}:`, error);
      return null;
    }
  }

  /**
   * Unregisters and disconnects a specific observer
   * @param {string} key The key of the observer to unregister
   * @returns {boolean} Whether the observer was successfully unregistered
   */
  static unregister(key) {
    if (this.#registry.has(key)) {
      try {
        const observer = this.#registry.get(key);
        observer.disconnect();
        this.#registry.delete(key);

        HM.log(3, `Unregistered observer: ${key}`);
        return true;
      } catch (error) {
        HM.log(1, `Error unregistering observer ${key}:`, error);
      }
    }
    return false;
  }

  /**
   * Unregisters all observers matching a prefix
   * @param {string} prefix The prefix to match against observer keys
   * @returns {number} Number of observers unregistered
   */
  static unregisterByPrefix(prefix) {
    let count = 0;
    for (const key of this.#registry.keys()) {
      if (key.startsWith(prefix)) {
        if (this.unregister(key)) {
          count++;
        }
      }
    }

    if (count > 0) {
      HM.log(3, `Unregistered ${count} observers with prefix: ${prefix}`);
    }
    return count;
  }

  /**
   * Unregisters and disconnects all observers
   * @returns {number} Number of observers unregistered
   */
  static unregisterAll() {
    try {
      const count = this.#registry.size;

      const disconnectErrors = [];
      this.#registry.forEach((observer, key) => {
        try {
          observer.disconnect();
        } catch (error) {
          HM.log(1, `Error disconnecting observer ${key}:`, error);
          disconnectErrors.push(key);
        }
      });

      this.#registry.clear();

      if (disconnectErrors.length > 0) {
        HM.log(1, `Encountered errors disconnecting ${disconnectErrors.length} observers: ${disconnectErrors.join(', ')}`);
      }

      HM.log(3, `Unregistered all ${count} observers`);
      return count;
    } catch (error) {
      HM.log(1, 'Error unregistering all observers:', error);
      return 0;
    }
  }

  /**
   * Gets the observer instance by key
   * @param {string} key The key of the observer to get
   * @returns {MutationObserver|null} The observer instance or null if not found
   */
  static get(key) {
    return this.#registry.get(key) || null;
  }

  /**
   * Gets the total number of registered observers
   * @returns {number} Count of registered observers
   */
  static get count() {
    return this.#registry.size;
  }
}
