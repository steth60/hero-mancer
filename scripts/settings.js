import { CustomCompendiums } from './app/CustomCompendiums.js';
import { HM } from './hero-mancer.js';

/**
 * Registers all the settings for the Hero Mancer module.
 * This function is the entry point for setting registration,
 * calling both module-specific and application-specific settings.
 */
export function registerSettings() {
  registerModuleSettings(); // Register HeroMancer-specific settings
  registerApplicationSettings(); // Register compendium-specific settings
}

/**
 * Registers module-specific settings for Hero Mancer.
 * These settings include enabling or disabling the module and setting logging levels.
 * All settings are client-scoped and configurable per user.
 */
function registerModuleSettings() {
  // Client-scoped: Enable or disable the module for individual users
  game.settings.register(HM.ID, 'enable', {
    name: `${HM.ABRV}.settings.enable.name`,
    default: true,
    type: Boolean,
    scope: 'client',
    config: true,
    hint: `${HM.ABRV}.settings.enable.hint`,
    requiresReload: true
  });

  // Client-scoped: Set the logging level for individual users
  game.settings.register(HM.ID, 'loggingLevel', {
    name: `${HM.ABRV}.settings.logger.name`,
    hint: `${HM.ABRV}.settings.logger.hint`,
    scope: 'client',
    config: true,
    type: String,
    choices: {
      0: `${HM.ABRV}.settings.logger.choices.off`,
      1: `${HM.ABRV}.settings.logger.choices.errors`,
      2: `${HM.ABRV}.settings.logger.choices.warnings`,
      3: `${HM.ABRV}.settings.logger.choices.verbose`
    },
    default: 2,
    onChange: (value) => {
      const logMessage = `${HM.ABRV}.settings.logger.level.${value}`;
      if (value !== '0') {
        HM.log(3, logMessage); // Log the current logging level unless it's Off
      }
    }
  });
}

/**
 * Registers application-specific settings for Hero Mancer.
 * These settings include custom compendium selection,
 * and GM-restricted settings for managing compendiums and custom roll formulas.
 * All settings are world-scoped, shared across all players in the world.
 */
function registerApplicationSettings() {
  // Restricted to GM: Menu for custom compendium chooser
  game.settings.registerMenu(HM.ID, 'customCompendiumMenu', {
    name: `${HM.ABRV}.settings.custom-compendiums.menu.name`,
    hint: `${HM.ABRV}.settings.custom-compendiums.menu.hint`,
    label: `${HM.ABRV}.settings.custom-compendiums.menu.label`,
    icon: 'fa-solid fa-bars',
    type: CustomCompendiums,
    restricted: true
  });

  // World-scoped: Save selected class compendium packs (shared across all players)
  game.settings.register(HM.ID, 'classPacks', {
    name: `${HM.ABRV}.settings.class-packs.name`,
    scope: 'world',
    config: false,
    type: Array,
    default: []
  });

  // World-scoped: Save selected race compendium packs (shared across all players)
  game.settings.register(HM.ID, 'racePacks', {
    name: `${HM.ABRV}.settings.race-packs.name`,
    scope: 'world',
    config: false,
    type: Array,
    default: []
  });

  // World-scoped: Save selected background compendium packs (shared across all players)
  game.settings.register(HM.ID, 'backgroundPacks', {
    name: `${HM.ABRV}.settings.background-packs.name`,
    scope: 'world',
    config: false,
    type: Array,
    default: []
  });

  // Add the custom roll formula setting restricted to GM
  game.settings.register(HM.ID, 'customRollFormula', {
    name: `${HM.ABRV}.settings.custom-roll-formula.name`,
    hint: `${HM.ABRV}.settings.custom-roll-formula.hint`,
    scope: 'world', // Restricted to the world (GM control)
    config: true, // Show this setting in the configuration UI
    type: String,
    restricted: true, // GM-only setting
    default: '4d6kh3', // Default formula
    onChange: (value) => {
      if (!value || value.trim() === '') {
        game.settings.set(HM.ID, 'customRollFormula', '4d6kh3'); // Reset to default if empty
        console.log(game.i18n.localize(`${HM.ABRV}.settings.custom-roll-formula.reset`));
      }
    }
  });
}
