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
    const result = await game.user.setFlag(HM.CONFIG.ID, this.FLAG, data);
    return result;
  }

  /**
   * Loads saved options from user flags
   * @returns {Promise<object>} The saved options or empty object if none
   * @static
   */
  static async loadOptions() {
    HM.log(3, 'Loading saved options');
    const data = await game.user.getFlag(HM.CONFIG.ID, this.FLAG);
    HM.log(3, 'Loaded flag data:', data);
    return data || {};
  }

  /**
   * Resets saved options by clearing the flag
   * @returns {Promise<object>} Result of clearing the flag
   * @static
   */
  static async resetOptions() {
    return game.user.setFlag(HM.CONFIG.ID, this.FLAG, null);
  }
}
