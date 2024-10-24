import { CustomCompendiums } from './app/CustomCompendiums.js';
import { HM } from './module.js';

/**
 * Registers module settings for the game, including toggle options and custom settings.
 * @function registerSettings
 **/
export function registerSettings() {
  game.settings.register(HM.ID, 'enable', {
    name: `${HM.ABRV}.settings.enable.name`,
    default: true,
    type: Boolean,
    scope: 'client',
    config: true,
    hint: `${HM.ABRV}.settings.enable.hint`,
    requiresReload: true
  });

  // New setting for enabling verbose logging
  game.settings.register(HM.ID, 'loggingLevel', {
    name: `${HM.ABRV}.settings.logger.name`,
    hint: `${HM.ABRV}.settings.logger.hint`,
    scope: 'client',
    config: true,
    type: String,
    choices: {
      0: 'Off',
      1: 'Errors',
      2: 'Warnings',
      3: 'Verbose'
    },
    default: 2,
    onChange: (value) => {
      const logMessage = `Logging level set to ${
        value === '0' ? 'Off'
        : value === '1' ? 'Errors'
        : value === '2' ? 'Warnings'
        : 'Verbose'
      }`;
      if (value !== '0') {
        HM.log(3, logMessage); // Log the current logging level unless it's Off
      }
    }
  });

  // Menu for custom compendium chooser
  game.settings.registerMenu(HM.ID, 'customCompendiumMenu', {
    name: `${HM.ABRV}.settings.customcompendiums.menu.name`,
    hint: `${HM.ABRV}.settings.customcompendiums.menu.hint`,
    label: `${HM.ABRV}.settings.customcompendiums.menu.label`,
    icon: 'fa-solid fa-bars',
    type: CustomCompendiums,
    restricted: false
  });

  // Register settings for classPacks, racePacks, and backgroundPacks
  game.settings.register(HM.ID, 'classPacks', {
    name: 'Class Compendiums',
    scope: 'world',
    config: false,
    type: Array,
    default: []
  });

  game.settings.register(HM.ID, 'racePacks', {
    name: 'Race Compendiums',
    scope: 'world',
    config: false,
    type: Array,
    default: []
  });

  game.settings.register(HM.ID, 'backgroundPacks', {
    name: 'Background Compendiums',
    scope: 'world',
    config: false,
    type: Array,
    default: []
  });
}
