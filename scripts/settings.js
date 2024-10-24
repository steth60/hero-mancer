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
  game.settings.register(HM.ID, 'enableVerboseLogging', {
    name: `${HM.ABRV}.settings.logger.name`,
    hint: `${HM.ABRV}.settings.logger.hint`,
    scope: 'client',
    config: true,
    type: Boolean,
    default: false, // Set to false by default
    onChange: (value) => {
      HM.log(`${HM.ID} | logging set to ${value}`);
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
