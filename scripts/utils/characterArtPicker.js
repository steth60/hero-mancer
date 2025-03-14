import { HM } from '../utils/index.js';

/**
 * Handles image selection for character, token, and player art
 * @class
 */
export class CharacterArtPicker {
  /* -------------------------------------------- */
  /*  Static Getters & Setters                    */
  /* -------------------------------------------- */

  /**
   * Gets the root directory for art selection
   * @returns {string} The configured root directory path
   * @static
   */
  static get rootDirectory() {
    return game.settings.get(HM.CONFIG.ID, 'artPickerRoot');
  }

  /**
   * Sets the root directory for art selection
   * @param {string} path - The path to set as root directory
   * @static
   */
  static set rootDirectory(path) {
    if (!path) {
      HM.log(2, 'Attempted to set rootDirectory to empty path');
      return;
    }
    // Update the game setting instead of a static property
    game.settings.set(HM.CONFIG.ID, 'artPickerRoot', path);
    HM.log(3, `rootDirectory setting updated to: ${path}`);
  }

  /* -------------------------------------------- */
  /*  Static Public Methods                       */
  /* -------------------------------------------- */

  /**
   * Opens a file picker to select character portrait art
   * @param {Event} _event - The triggering event
   * @param {HTMLElement} _target - The element that triggered the event
   * @returns {Promise<void>}
   * @static
   */
  static async selectCharacterArt(_event, _target) {
    const rootDir = CharacterArtPicker.rootDirectory;
    const inputField = document.getElementById('character-art-path');
    const currentPath = inputField.value || rootDir;

    HM.log(3, 'Creating FilePicker with paths:', {
      currentPath,
      rootDir
    });

    const pickerConfig = {
      type: 'image',
      current: currentPath,
      root: rootDir,
      callback: (path) => {
        inputField.value = path;
        inputField.dispatchEvent(new Event('change', { bubbles: true }));
        const portraitImg = document.querySelector('.character-portrait img');
        if (portraitImg) {
          portraitImg.src = path;
        }
        if (document.getElementById('link-token-art').checked) {
          document.getElementById('token-art-path').value = path;
          document.getElementById('token-art-path').dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    };

    const filepicker = new FilePicker(pickerConfig);
    filepicker.render(true);
  }

  /**
   * Opens a file picker to select token art
   * @param {Event} _event - The triggering event
   * @param {HTMLElement} _target - The element that triggered the event
   * @returns {Promise<void>}
   * @static
   */
  static async selectTokenArt(_event, _target) {
    const rootDir = CharacterArtPicker.rootDirectory;
    const inputField = document.getElementById('token-art-path');
    const currentPath = inputField.value || rootDir;

    HM.log(3, 'Creating FilePicker with paths:', {
      currentPath,
      rootDir
    });

    const pickerConfig = {
      type: 'image',
      current: currentPath,
      root: rootDir,
      callback: (path) => {
        inputField.value = path;
        inputField.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };
    const filepicker = new FilePicker(pickerConfig);
    filepicker.render(true);
  }

  /**
   * Opens a file picker to select player avatar art
   * @param {Event} _event - The triggering event
   * @param {HTMLElement} _target - The element that triggered the event
   * @returns {Promise<void>}
   * @static
   */
  static async selectPlayerAvatar(_event, _target) {
    const rootDir = CharacterArtPicker.rootDirectory;
    const inputField = document.getElementById('player-avatar-path');
    const currentPath = inputField.value || rootDir;

    HM.log(3, 'Creating FilePicker with paths:', {
      currentPath,
      rootDir
    });

    const pickerConfig = {
      type: 'image',
      current: currentPath,
      root: rootDir,
      callback: (path) => {
        inputField.value = path;
        inputField.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };

    const filepicker = new FilePicker(pickerConfig);
    filepicker.render(true);
  }

  /* -------------------------------------------- */
  /*  Static Protected Methods                    */
  /* -------------------------------------------- */

  /**
   * Toggles visibility of token art row based on checkbox state
   * @returns {void}
   * @protected
   * @static
   */
  static _toggleTokenArtRowVisibility() {
    const tokenArtRow = document.getElementById('token-art-row');
    const isLinked = document.getElementById('link-token-art').checked;
    tokenArtRow.style.display = isLinked ? 'none' : 'flex';

    if (isLinked) {
      const tokenInput = document.getElementById('token-art-path');
      tokenInput.value = document.getElementById('character-art-path').value;
      tokenInput.dispatchEvent(new Event('change', { bubbles: true }));
      HM.log(3, 'Token art path updated due to linking');
    }
  }
}
