import { HM, Listeners, StatRoller } from './index.js';

/**
 * Constants for ability score limits and validations
 * @constant {object}
 */
const ABILITY_SCORES = {
  DEFAULT: 8,
  MIN: 8,
  MAX: 15
};

/**
 * Constants for dropdown modes
 * @constant {object}
 */
const MODES = {
  POINT_BUY: 'pointBuy',
  MANUAL_FORMULA: 'manualFormula',
  STANDARD_ARRAY: 'standardArray'
};

/**
 * Event bus for pub/sub pattern
 * @namespace
 */
export const EventDispatcher = {
  /* -------------------------------------------- */
  /*  Static Properties                           */
  /* -------------------------------------------- */

  listeners: new Map(),

  listenerSources: new Map(),

  /* -------------------------------------------- */
  /*  Static Public Methods                       */
  /* -------------------------------------------- */

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @param {object} source - Source object for callback
   */
  on(event, callback, source) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
      this.listenerSources.set(event, new Map());
    }
    this.listeners.get(event).add(callback);
    this.listenerSources.get(event).set(callback, source);
  },

  /**
   * Emit an event with data
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((callback) => callback(data));
    }
  },

  /**
   * Unsubscribe from an event
   * @param {string} event - Event name
   * @param {Function} callback - Callback function to remove
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
      this.listenerSources.get(event)?.delete(callback);
    }
  },

  /**
   * Remove all listeners from a specific source
   * @param {object} source - Source object to remove listeners from
   */
  removeAllFromSource(source) {
    this.listenerSources.forEach((sourceMap, event) => {
      sourceMap.forEach((listenerSource, callback) => {
        if (listenerSource === source) {
          this.listeners.get(event)?.delete(callback);
          sourceMap.delete(callback);
        }
      });
    });
  },

  /**
   * Clear all listeners and sources
   */
  clearAll() {
    try {
      const totalEvents = this.listeners.size;
      const totalListeners = Array.from(this.listeners.values()).reduce((sum, listeners) => sum + listeners.size, 0);

      HM.log(3, `Clearing ${totalListeners} listeners from ${totalEvents} events`);

      this.listeners.clear();
      this.listenerSources.clear();
    } catch (error) {
      HM.log(1, 'Error clearing event bus:', error);
    }
  }
};

/**
 * Cache implementation for document storage
 * @class
 */
class DocumentCache {
  /* -------------------------------------------- */
  /*  Static Properties                           */
  /* -------------------------------------------- */

  /** @type {Map<string, Array>} */
  static cache = new Map();

  /* -------------------------------------------- */
  /*  Static Public Methods                       */
  /* -------------------------------------------- */

  /**
   * Generate cache key from context and documents key
   * @param {object} context - Application context
   * @param {string} documentsKey - Document collection key
   * @returns {string} Cache key
   * @static
   */
  static getKey(context, documentsKey) {
    return `${context.id}-${documentsKey}`;
  }

  /**
   * Retrieve documents from cache
   * @param {object} context - Application context
   * @param {string} documentsKey - Document collection key
   * @returns {Array|undefined} Cached documents
   * @static
   */
  static get(context, documentsKey) {
    const result = this.cache.get(this.getKey(context, documentsKey));
    return result;
  }

  /**
   * Store documents in cache
   * @param {object} context - Application context
   * @param {string} documentsKey - Document collection key
   * @param {Array} docs - Documents to cache
   * @static
   */
  static set(context, documentsKey, docs) {
    this.cache.set(this.getKey(context, documentsKey), docs);
  }

  /**
   * Check if documents exist in cache
   * @param {object} context - Application context
   * @param {string} documentsKey - Document collection key
   * @returns {boolean} Whether documents are cached
   * @static
   */
  static has(context, documentsKey) {
    return this.cache.has(this.getKey(context, documentsKey));
  }
}

/**
 * Handles dropdown interactions and updates throughout the application
 * @class
 */
export class DropdownHandler {
  /**
   * Initializes a dropdown with event listeners and description updates
   * @param {DropdownConfig} config - Configuration object for dropdown initialization
   * @returns {Promise<void>}
   * @static
   */
  static async initializeDropdown({ type, html, context }) {
    const dropdown = this.findDropdownElementByType(html, type);
    if (!dropdown) {
      HM.log(1, `Dropdown for ${type} not found.`);
      return;
    }
    try {
      // Clean up existing listeners
      if (dropdown._descriptionUpdateHandler) {
        EventDispatcher.off('description-update', dropdown._descriptionUpdateHandler);
      }
      if (dropdown._changeHandler) {
        dropdown.removeEventListener('change', dropdown._changeHandler);
      }

      dropdown._descriptionUpdateHandler = function ({ elementId, content }) {
        try {
          const element = html.querySelector(elementId);
          if (element) {
            element.innerHTML = content;
          }
        } catch (error) {
          HM.log(1, `Error updating description for ${elementId}:`, error);
        }
      };

      dropdown._changeHandler = this.handleDropdownChange.bind(this, type, html, context);

      // Add new listeners
      EventDispatcher.on('description-update', dropdown._descriptionUpdateHandler);
      dropdown.addEventListener('change', (event) => {
        try {
          requestAnimationFrame(() => dropdown._changeHandler(event));
        } catch (error) {
          HM.log(1, `Error in dropdown change handler for ${type}:`, error);
        }
      });
    } catch (error) {
      HM.log(1, `Failed to initialize dropdown for ${type}:`, error);
    }
  }

  /**
   * Retrieves dropdown element from DOM
   * @param {HTMLElement} html - Parent element
   * @param {string} type - Dropdown type
   * @returns {HTMLElement|null} Dropdown element if found
   * @static
   */
  static findDropdownElementByType(html, type) {
    const dropdown = html.querySelector(`#${type}-dropdown`);
    if (!dropdown) {
      HM.log(1, `Dropdown for ${type} not found.`);
    }
    return dropdown;
  }

  /**
   * Handles dropdown change events
   * @param {string} type - Dropdown type
   * @param {HTMLElement} html - Parent element
   * @param {object} context - Application context
   * @param {Event} event - Change event
   * @returns {Promise<void>}
   * @static
   */
  static async handleDropdownChange(type, html, context, event) {
    try {
      const selectedValue = event.target.value;

      // Extract the ID (everything before the first space)
      const selectedId = selectedValue.split(' ')[0].trim();

      // Extract the UUID (content inside square brackets)
      const selectedUUID = selectedValue.match(/\[(.*?)]/)?.[1] || '';

      HM.CONFIG.SELECT_STORAGE[type] = { selectedValue, selectedId, selectedUUID };
      await this.updateDescription(type, selectedId, context);
    } catch (error) {
      HM.log(1, `Error handling dropdown change for ${type}:`, error);

      // Clear description area on error
      const descriptionElement = html.querySelector(`#${type}-description`);
      if (descriptionElement) {
        descriptionElement.innerHTML = game.i18n.localize('hm.app.no-description');
      }
    }
  }

  /**
   * Updates description based on selected item
   * @param {string} type - Dropdown type
   * @param {string} selectedId - Selected item ID
   * @param {object} context - Application context
   * @returns {Promise<void>}
   * @static
   */
  static async updateDescription(type, selectedId, context) {
    try {
      const docs = this.getDocumentsFromCacheOrContext(context, `${type}Docs`);
      if (!docs) {
        HM.log(2, `No ${type} documents found for description update`);
        return;
      }

      const selectedDoc = docs.find((doc) => doc.id === selectedId);
      const content = selectedDoc?.enrichedDescription || '';

      EventDispatcher.emit('description-update', {
        elementId: `#${type}-description`,
        content: content || game.i18n.localize('hm.app.no-description')
      });
    } catch (error) {
      HM.log(1, `Error updating description for ${type}:`, error);

      // Emit a fallback error message
      EventDispatcher.emit('description-update', {
        elementId: `#${type}-description`,
        content: game.i18n.localize('hm.app.no-description')
      });
    }
  }

  /**
   * Retrieves documents from cache or context
   * @param {object} context - Application context
   * @param {string} documentsKey - Key for document collection
   * @returns {Array|null} Array of documents if found
   * @static
   */
  static getDocumentsFromCacheOrContext(context, documentsKey) {
    if (DocumentCache.has(context, documentsKey)) {
      return DocumentCache.get(context, documentsKey);
    }

    if (!context[documentsKey] || !Array.isArray(context[documentsKey])) {
      HM.log(1, `${HM.CONFIG.ID} | No documents found for type: ${documentsKey}`);
      return null;
    }

    const docs = context[documentsKey].flatMap((folder) => folder.docs || folder);
    DocumentCache.set(context, documentsKey, docs);
    return docs;
  }

  /**
   * Updates ability score dropdowns based on mode and selections
   * @param {NodeList} abilityDropdowns - List of ability dropdown elements
   * @param {number[]} selectedAbilities - Currently selected ability scores
   * @param {number} totalPoints - Total points allowed for Point Buy
   * @param {string} mode - Dice rolling method ('pointBuy', 'manualFormula')
   * @param {number[]} standardArray - Array of standard ability scores
   * @static
   */
  static refreshAbilityDropdownsState(abilityDropdowns, selectedAbilities, totalPoints, mode, standardArray) {
    try {
      if (!Array.isArray(selectedAbilities) || !Number.isInteger(totalPoints)) {
        throw new Error('Invalid input parameters');
      }

      // Collect all dropdown updates first, then apply them in a batch
      const dropdownUpdates = [];
      const selectedValues = Array.from(abilityDropdowns).map((dropdown) => dropdown.value);

      switch (mode) {
        case MODES.POINT_BUY:
          this.processPointBuyDropdownUpdates(abilityDropdowns, selectedAbilities, totalPoints, dropdownUpdates);
          break;
        case MODES.MANUAL_FORMULA:
          this.handleManualFormulaMode(abilityDropdowns, selectedAbilities, dropdownUpdates);
          break;
        case MODES.STANDARD_ARRAY:
          // Create an array of current dropdown values

          this.handleStandardArrayMode(abilityDropdowns, selectedValues);
          break;
        default:
          throw new Error(`Unsupported mode: ${mode}`);
      }

      // Apply all updates in one batch
      requestAnimationFrame(() => {
        dropdownUpdates.forEach((update) => update());

        if (mode === MODES.POINT_BUY) {
          const pointsSpent = StatRoller.calculateTotalPointsSpent(selectedAbilities);
          const remainingPoints = totalPoints - pointsSpent;
          EventDispatcher.emit('points-update', remainingPoints);
          Listeners.updateRemainingPointsDisplay(remainingPoints);
        }
      });
    } catch (error) {
      HM.log(1, `Error in refreshAbilityDropdownsState: ${error.message}`);
    }
  }

  /**
   * Handles point buy mode updates
   * @param {NodeList} abilityDropdowns - Ability dropdown elements
   * @param {number[]} selectedAbilities - Selected ability scores
   * @param {number} totalPoints - Total available points
   * @static
   */
  static processPointBuyDropdownUpdates(abilityDropdowns, selectedAbilities, totalPoints, dropdownUpdates) {
    const pointsSpent = StatRoller.calculateTotalPointsSpent(selectedAbilities);
    const remainingPoints = totalPoints - pointsSpent;

    abilityDropdowns.forEach((dropdown) => {
      const currentValue = parseInt(dropdown.value, 10) || ABILITY_SCORES.DEFAULT;

      // Add the update to our batch rather than executing immediately
      dropdownUpdates.push(() => {
        this.updateDropdownSelectionAvailability(dropdown, currentValue, remainingPoints);
      });
    });
  }

  /**
   * Handles standard array mode dropdown updates
   * @param {NodeList} abilityDropdowns - Ability dropdown elements
   * @param {string[]} selectedValues - Currently selected values
   * @static
   */
  static handleStandardArrayMode(abilityDropdowns, selectedValues) {
    // Get the standard array from the first dropdown's options
    const valueOccurrences = {};
    const firstDropdown = abilityDropdowns[0];
    const availableOptions = Array.from(firstDropdown.options).filter((opt) => opt.value && opt.value !== '');

    // Count occurrences of each value in the standard array
    availableOptions.forEach((option) => {
      const value = option.value;
      if (value) valueOccurrences[value] = (valueOccurrences[value] || 0) + 1;
    });

    // Count current selections
    const selectedCounts = {};
    selectedValues.forEach((value) => {
      if (value) selectedCounts[value] = (selectedCounts[value] || 0) + 1;
    });

    // Update each dropdown
    abilityDropdowns.forEach((dropdown, index) => {
      const currentValue = selectedValues[index];
      const valuesToDisable = {};

      // For each selected value, determine how many instances to disable
      Object.entries(selectedCounts).forEach(([value, count]) => {
        valuesToDisable[value] = count;
        // Don't disable the current selection
        if (value === currentValue) {
          valuesToDisable[value]--;
        }
      });

      // Apply disabling to options
      Array.from(dropdown.options).forEach((option) => {
        const optionValue = option.value;
        if (!optionValue) return; // Skip empty option

        if (valuesToDisable[optionValue] > 0) {
          option.disabled = true;
          valuesToDisable[optionValue]--;
        } else {
          option.disabled = false;
        }
      });
    });
  }

  /**
   * Updates dropdown options based on point cost
   * @param {HTMLElement} dropdown - Dropdown element
   * @param {number} currentValue - Current selected value
   * @param {number} remainingPoints - Remaining points
   * @static
   */
  static updateDropdownSelectionAvailability(dropdown, currentValue, remainingPoints) {
    dropdown.querySelectorAll('option').forEach((option) => {
      const optionValue = parseInt(option.value, 10);
      if (optionValue < ABILITY_SCORES.MIN || optionValue > ABILITY_SCORES.MAX) return;

      const optionCost = StatRoller.getPointBuyCostForScore(optionValue);
      const canAffordOption = optionCost <= remainingPoints + StatRoller.getPointBuyCostForScore(currentValue);

      option.disabled = !canAffordOption && optionValue !== currentValue;
    });
  }

  /**
   * Handles manual formula mode updates
   * @param {NodeList} abilityDropdowns Ability dropdown elements
   * @param {number[]} selectedAbilities Selected ability scores
   */
  static handleManualFormulaMode(abilityDropdowns, selectedAbilities, dropdownUpdates) {
    const selectedValues = new Set(selectedAbilities);

    abilityDropdowns.forEach((dropdown) => {
      const currentValue = dropdown.value;

      // Add the update to our batch rather than executing immediately
      dropdownUpdates.push(() => {
        dropdown.querySelectorAll('option').forEach((option) => {
          const optionValue = option.value;
          option.disabled = selectedValues.has(optionValue) && optionValue !== currentValue && parseInt(optionValue, 10) >= ABILITY_SCORES.MIN;
        });
      });
    });
  }

  /**
   * Generates HTML for dropdown options
   * @param {Array} items - Grouped data for races, classes, or backgrounds
   * @param {string} groupKey - Key for group labeling
   * @returns {string} HTML string for dropdown options
   * @static
   */
  static generateDropdownHTML(items, groupKey) {
    return items
      .map((group) => {
        if (group.docs.length === 1) {
          return this.createOptionHTML(group.docs[0]);
        }

        return `
        <optgroup label="${group[groupKey]}">
          ${group.docs.map((doc) => this.createOptionHTML(doc)).join('')}
        </optgroup>
      `;
      })
      .join('');
  }

  /**
   * Creates HTML for individual option
   * @param {object} doc - Document object containing id and name
   * @returns {string} HTML string for option
   * @static
   */
  static createOptionHTML(doc) {
    return `<option value="${doc.id}">${doc.name}</option>`;
  }
}
