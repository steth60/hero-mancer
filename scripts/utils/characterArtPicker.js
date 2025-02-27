import { HM } from '../hero-mancer.js';

export class CharacterArtPicker {
  /* -------------------------------------------- */
  /*  Static Public Methods                       */
  /* -------------------------------------------- */

  static getRootDirectory() {
    return game.settings.get(HM.CONFIG.ID, 'artPickerRoot');
  }

  static setRootDirectory(path) {
    HM.log(3, `CharacterArtPicker.setRootDirectory called with path: ${path}`);
    if (!path) {
      HM.log(2, 'Attempted to set ROOT_DIRECTORY to empty path');
      return;
    }
    // Update the game setting instead of a static property
    game.settings.set(HM.CONFIG.ID, 'artPickerRoot', path);
    HM.log(3, `ROOT_DIRECTORY setting updated to: ${path}`);
  }

  static async selectCharacterArt(event, target) {
    const rootDir = CharacterArtPicker.getRootDirectory();
    HM.log(3, `CharacterArtPicker.selectCharacterArt using ROOT_DIRECTORY: ${rootDir}`);

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
        HM.log(3, `FilePicker callback with path: ${path}`);
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

    HM.log(3, 'FilePicker final config:', pickerConfig);
    const filepicker = new FilePicker(pickerConfig);
    filepicker.render(true);
  }

  static async selectTokenArt(event, target) {
    const rootDir = CharacterArtPicker.getRootDirectory();
    HM.log(3, `CharacterArtPicker.selectTokenArt using ROOT_DIRECTORY: ${rootDir}`);

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
        HM.log(3, `FilePicker callback with path: ${path}`);
        inputField.value = path;
        inputField.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };

    HM.log(3, 'FilePicker final config:', pickerConfig);
    const filepicker = new FilePicker(pickerConfig);
    filepicker.render(true);
  }

  static async selectPlayerAvatar(event, target) {
    const rootDir = CharacterArtPicker.getRootDirectory();
    HM.log(3, `CharacterArtPicker.selectPlayerAvatar using ROOT_DIRECTORY: ${rootDir}`);

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
        HM.log(3, `FilePicker callback with path: ${path}`);
        inputField.value = path;
        inputField.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };

    HM.log(3, 'FilePicker final config:', pickerConfig);
    const filepicker = new FilePicker(pickerConfig);
    filepicker.render(true);
  }

  /* -------------------------------------------- */
  /*  Static Private Methods                      */
  /* -------------------------------------------- */

  static _toggleTokenArtRow() {
    HM.log(3, 'Toggle token art row');
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
