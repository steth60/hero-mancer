import { HM } from '../hero-mancer.js';
import { Listeners, StatRoller } from './index.js';

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
  MANUAL_FORMULA: 'manualFormula'
};

/**
 * Event bus for pub/sub pattern
 * @namespace
 */
const EventBus = {
  /** @type {Map<string, Set<Function>>} */
  listeners: new Map(),

  /**
   * Subscribe to an event
   * @param {string} event Event name
   * @param {Function} callback Callback function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  },

  /**
   * Emit an event with data
   * @param {string} event Event name
   * @param {*} data Event data
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((callback) => callback(data));
    }
  },

  /**
   * Unsubscribe from an event
   * @param {string} event Event name
   * @param {Function} callback Callback function to remove
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }
};

/**
 * Cache implementation for document storage
 * @class
 */
class DocumentCache {
  /** @type {Map<string, Array>} */
  static cache = new Map();

  /**
   * Generate cache key from context and documents key
   * @param {object} context Application context
   * @param {string} documentsKey Document collection key
   * @returns {string} Cache key
   */
  static getKey(context, documentsKey) {
    return `${context.id}-${documentsKey}`;
  }

  /**
   * Retrieve documents from cache
   * @param {object} context Application context
   * @param {string} documentsKey Document collection key
   * @returns {Array|undefined} Cached documents
   */
  static get(context, documentsKey) {
    const result = this.cache.get(this.getKey(context, documentsKey));
    HM.log(3, 'Cache hit:', !!result);
    return result;
  }

  /**
   * Store documents in cache
   * @param {object} context Application context
   * @param {string} documentsKey Document collection key
   * @param {Array} docs Documents to cache
   */
  static set(context, documentsKey, docs) {
    this.cache.set(this.getKey(context, documentsKey), docs);
  }

  /**
   * Check if documents exist in cache
   * @param {object} context Application context
   * @param {string} documentsKey Document collection key
   * @returns {boolean} Whether documents are cached
   */
  static has(context, documentsKey) {
    return this.cache.has(this.getKey(context, documentsKey));
  }
}

/**
 * @typedef {object} DropdownConfig
 * @property {string} type - Type of dropdown ('class', 'race', 'background')
 * @property {HTMLElement} html - The HTML element containing the dropdown
 * @property {object} context - Context object containing document data
 */

/**
 * Handles dropdown interactions and updates throughout the application
 * @class
 */
export class DropdownHandler {
  /**
   * Initializes a dropdown with event listeners and description updates
   * @param {DropdownConfig} config Configuration object for dropdown initialization
   * @returns {Promise<void>}
   */
  static async initializeDropdown({ type, html, context }) {
    const dropdown = this.getDropdownElement(html, type);
    if (!dropdown) return;

    EventBus.on('description-update', ({ elementId, content }) => {
      const element = html.querySelector(elementId);
      if (element) {
        element.innerHTML = content;
      }
    });

    dropdown.addEventListener('change', (event) => this.handleDropdownChange(event, type, html, context));
  }

  /**
   * Retrieves dropdown element from DOM
   * @param {HTMLElement} html Parent element
   * @param {string} type Dropdown type
   * @returns {HTMLElement|null} Dropdown element if found
   */
  static getDropdownElement(html, type) {
    const dropdown = html.querySelector(`#${type}-dropdown`);
    if (!dropdown) {
      HM.log(1, `Dropdown for ${type} not found.`);
    }
    return dropdown;
  }

  /**
   * Handles dropdown change events
   * @param {Event} event Change event
   * @param {string} type Dropdown type
   * @param {HTMLElement} html Parent element
   * @param {object} context Application context
   */
  static async handleDropdownChange(event, type, html, context) {
    const selectedValue = event.target.value;
    const selectedId = selectedValue.replace(/\s?\(.*?\)/, '');

    HM.CONFIG.SELECT_STORAGE[type] = { selectedValue, selectedId };
    await this.updateDescription(type, selectedId, html, context);
  }

  /**
   * Updates description based on selected item
   * @param {string} type Dropdown type
   * @param {string} selectedId Selected item ID
   * @param {HTMLElement} html Parent element
   * @param {object} context Application context
   */
  static async updateDescription(type, selectedId, html, context) {
    const docs = this.getDocuments(context, `${type}Docs`);
    if (!docs) return;

    const selectedDoc = docs.find((doc) => doc.id === selectedId);
    const content = selectedDoc?.enrichedDescription || '';

    EventBus.emit('description-update', {
      elementId: `#${type}-description`,
      content
    });
  }

  /**
   * Retrieves documents from cache or context
   * @param {object} context Application context
   * @param {string} documentsKey Key for document collection
   * @returns {Array|null} Array of documents if found
   */
  static getDocuments(context, documentsKey) {
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
   * @param {NodeList} abilityDropdowns List of ability dropdown elements
   * @param {number[]} selectedAbilities Currently selected ability scores
   * @param {number} totalPoints Total points allowed for Point Buy
   * @param {string} mode Dice rolling method ('pointBuy', 'manualFormula')
   */
  static updateAbilityDropdowns(abilityDropdowns, selectedAbilities, totalPoints, mode) {
    try {
      if (!Array.isArray(selectedAbilities) || !Number.isInteger(totalPoints)) {
        throw new Error('Invalid input parameters');
      }

      switch (mode) {
        case MODES.POINT_BUY:
          this.handlePointBuyMode(abilityDropdowns, selectedAbilities, totalPoints);
          break;
        case MODES.MANUAL_FORMULA:
          this.handleManualFormulaMode(abilityDropdowns, selectedAbilities);
          break;
        default:
          throw new Error(`Unsupported mode: ${mode}`);
      }
    } catch (error) {
      HM.log(1, `Error in updateAbilityDropdowns: ${error.message}`);
    }
  }

  /**
   * Handles point buy mode updates
   * @param {NodeList} abilityDropdowns Ability dropdown elements
   * @param {number[]} selectedAbilities Selected ability scores
   * @param {number} totalPoints Total available points
   */
  static handlePointBuyMode(abilityDropdowns, selectedAbilities, totalPoints) {
    const pointsSpent = StatRoller.calculatePointsSpent(selectedAbilities);
    const remainingPoints = totalPoints - pointsSpent;

    abilityDropdowns.forEach((dropdown) => {
      const currentValue = parseInt(dropdown.value, 10) || ABILITY_SCORES.DEFAULT;
      this.updateDropdownOptions(dropdown, currentValue, remainingPoints);
    });

    EventBus.emit('points-update', remainingPoints);
    Listeners.updateRemainingPointsDisplay(remainingPoints);
  }

  /**
   * Updates individual dropdown options
   * @param {HTMLElement} dropdown Dropdown element
   * @param {number} currentValue Current selected value
   * @param {number} remainingPoints Remaining points
   */
  static updateDropdownOptions(dropdown, currentValue, remainingPoints) {
    dropdown.querySelectorAll('option').forEach((option) => {
      const optionValue = parseInt(option.value, 10);
      if (optionValue < ABILITY_SCORES.MIN || optionValue > ABILITY_SCORES.MAX) return;

      const optionCost = StatRoller.getPointCost(optionValue);
      const canAffordOption = optionCost <= remainingPoints + StatRoller.getPointCost(currentValue);

      option.disabled = !canAffordOption && optionValue !== currentValue;
    });
  }

  /**
   * Handles manual formula mode updates
   * @param {NodeList} abilityDropdowns Ability dropdown elements
   * @param {number[]} selectedAbilities Selected ability scores
   */
  static handleManualFormulaMode(abilityDropdowns, selectedAbilities) {
    const selectedValues = new Set(selectedAbilities);

    abilityDropdowns.forEach((dropdown) => {
      const currentValue = dropdown.value;
      dropdown.querySelectorAll('option').forEach((option) => {
        const optionValue = option.value;
        option.disabled = selectedValues.has(optionValue) && optionValue !== currentValue && parseInt(optionValue, 10) >= ABILITY_SCORES.MIN;
      });
    });
  }

  /**
   * Generates HTML for dropdown options
   * @param {Array} items Grouped data for races, classes, or backgrounds
   * @param {string} groupKey Key for group labeling
   * @returns {string} HTML string for dropdown options
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
   * @param {object} doc Document object containing id and name
   * @returns {string} HTML string for option
   */
  static createOptionHTML(doc) {
    return `<option value="${doc.id}">${doc.name}</option>`;
  }
}
