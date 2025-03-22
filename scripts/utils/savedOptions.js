import { HM } from '../utils/index.js';

/**
 * Manages saved character creation data across sessions
 * @class
 */
export class SavedOptions {
  /**
   * Flag name used for storing options
   * @static
   */
  static FLAG = 'saved-options';

  /**
   * Saves form data to user flags
   * @param {object} formData - Form data to save
   * @returns {Promise<object>} Result of setting the flag
   * @static
   */
  static async saveOptions(formData) {
    HM.log(3, 'Saving form data:', formData);
    const data = { ...formData };
    const result = await game.user.setFlag(HM.ID, this.FLAG, data);
    return result;
  }

  /**
   * Loads saved options from user flags
   * @returns {Promise<object>} The saved options or empty object if none
   * @static
   */
  static async loadOptions() {
    HM.log(3, 'Loading saved options');
    const data = await game.user.getFlag(HM.ID, this.FLAG);
    HM.log(3, 'Loaded flag data:', data);
    return data || {};
  }

  /**
   * Resets saved options and optionally resets form elements
   * @param {HTMLElement} [formElement] - Optional form element to reset
   * @returns {Promise<boolean>} Success status
   * @static
   */
  static async resetOptions(formElement = null) {
    try {
      // Clear saved flags
      await game.user.setFlag(HM.ID, this.FLAG, null);

      // If no form element provided, just clear flags
      if (!formElement) return true;

      // Reset all form elements
      formElement.querySelectorAll('select, input').forEach((elem) => {
        if (elem.type === 'checkbox') {
          elem.checked = false;
        } else {
          elem.value = '';
        }

        // Dispatch change event
        elem.dispatchEvent(new Event('change', { bubbles: true }));
      });

      return true;
    } catch (error) {
      HM.log(1, 'Error resetting options:', error);
      return false;
    }
  }
}
