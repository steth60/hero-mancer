import { CustomCompendiums } from './app/CustomCompendiums.js';
import { HM } from './hero-mancer.js';
import { StatRoller } from './utils/index.js';

/**
 * Registers core module settings - enable/disable and logging settings.
 * These settings affect basic functionality and debug capabilities.
 * @function
 */
function registerCoreSettings() {
  game.settings.register(HM.CONFIG.ID, 'enable', {
    name: 'hm.settings.enable.name',
    hint: 'hm.settings.enable.hint',
    default: true,
    type: Boolean,
    scope: 'client',
    config: true,
    requiresReload: true
  });

  game.settings.register(HM.CONFIG.ID, 'loggingLevel', {
    name: 'hm.settings.logger.name',
    hint: 'hm.settings.logger.hint',
    scope: 'client',
    config: true,
    type: String,
    choices: {
      0: 'hm.settings.logger.choices.off',
      1: 'hm.settings.logger.choices.errors',
      2: 'hm.settings.logger.choices.warnings',
      3: 'hm.settings.logger.choices.verbose'
    },
    default: 2,
    onChange: (value) => {
      const logMessage = `hm.settings.logger.level.${value}`;
      if (value !== '0') {
        HM.log(3, logMessage);
      }
    }
  });

  game.settings.register(HM.CONFIG.ID, 'enableCustomization', {
    name: 'hm.settings.player-customization.name',
    hint: 'hm.settings.player-customization.hint',
    default: false,
    type: Boolean,
    scope: 'world',
    config: true,
    requiresReload: true
  });
}

/**
 * Registers world-level settings for character creation options.
 * Handles deities and alignment configurations available to all users.
 * @function
 */
function registerWorldSettings() {
  game.settings.register(HM.CONFIG.ID, 'deities', {
    name: 'Available Deities',
    hint: 'Comma-separated list of deities available for character creation',
    scope: 'world',
    config: true,
    type: String,
    default: 'None,Aphrodite,Apollo,Ares,Artemis,Athena,Demeter,Dionysus,Hades,Hecate,Hephaestus,Hera,Hercules,Hermes,Hestia,Nike,Pan,Poseidon,Tyche,Zeus',
    restricted: true
  });

  game.settings.register(HM.CONFIG.ID, 'alignments', {
    name: 'Available Alignments',
    hint: 'Comma-separated list of alignments available for character creation',
    scope: 'world',
    config: true,
    type: String,
    default: 'None, Lawful Good, Neutral Good, Chaotic Good, Lawful Neutral, True Neutral, Chaotic Neutral, Lawful Evil, Neutral Evil, Chaotic Evil',
    restricted: true
  });
}

/**
 * Registers dice rolling related settings.
 * Manages dice methods, formulas, and arrays for character ability scores.
 * @function
 */
function registerDiceSettings() {
  game.settings.register(HM.CONFIG.ID, 'diceRollingMethod', {
    name: 'hm.settings.dice-rolling-method.name',
    hint: 'hm.settings.dice-rolling-method.hint',
    scope: 'client',
    config: true,
    type: String,
    requiresReload: true,
    choices: {
      standardArray: game.i18n.localize('hm.settings.dice-rolling-method.standard-array'),
      pointBuy: game.i18n.localize('hm.settings.dice-rolling-method.point-buy'),
      manualFormula: game.i18n.localize('hm.settings.dice-rolling-method.manual-formula')
    },
    default: 'standardArray'
  });

  game.settings.register(HM.CONFIG.ID, 'customRollFormula', {
    name: 'hm.settings.custom-roll-formula.name',
    hint: 'hm.settings.custom-roll-formula.hint',
    scope: 'client',
    config: game.settings.get(HM.CONFIG.ID, 'diceRollingMethod') === 'manualFormula',
    type: String,
    restricted: true,
    default: '4d6kh3',
    onChange: (value) => {
      if (!value || value.trim() === '') {
        game.settings.set(HM.CONFIG.ID, 'customRollFormula', '4d6kh3');
        HM.log(3, 'Resetting Custom Roll Formula to default (4d6kh3)');
      }
    }
  });

  game.settings.register(HM.CONFIG.ID, 'chainedRolls', {
    name: 'hm.settings.chained-rolls.name',
    hint: 'hm.settings.chained-rolls.hint',
    scope: 'client',
    config: game.settings.get(HM.CONFIG.ID, 'diceRollingMethod') === 'manualFormula',
    type: Boolean,
    default: false
  });

  game.settings.register(HM.CONFIG.ID, 'rollDelay', {
    name: 'hm.settings.roll-delay.name',
    hint: 'hm.settings.roll-delay.hint',
    scope: 'client',
    config: game.settings.get(HM.CONFIG.ID, 'diceRollingMethod') === 'manualFormula',
    type: Number,
    range: {
      min: 100,
      max: 2000,
      step: 100
    },
    default: 500
  });

  game.settings.register(HM.CONFIG.ID, 'customStandardArray', {
    name: 'hm.settings.custom-standard-array.name',
    hint: 'hm.settings.custom-standard-array.hint',
    scope: 'world',
    config: game.settings.get(HM.CONFIG.ID, 'diceRollingMethod') === 'standardArray',
    type: String,
    restricted: true,
    default: '',
    onChange: (value) => {
      if (!value || value.trim() === '') {
        game.settings.set(HM.CONFIG.ID, 'customStandardArray', StatRoller.getStandardArrayDefault());
        HM.log(3, 'Custom Standard Array was reset to default values due to invalid length.');
      } else {
        StatRoller.validateAndSetCustomStandardArray(value);
      }
    }
  });
}

/**
 * Registers compendium-related settings and menus.
 * Controls which compendium packs are available for races, classes and backgrounds.
 * @function
 */
function registerCompendiumSettings() {
  game.settings.registerMenu(HM.CONFIG.ID, 'customCompendiumMenu', {
    name: 'hm.settings.custom-compendiums.menu.name',
    hint: 'hm.settings.custom-compendiums.menu.hint',
    icon: 'fa-solid fa-bars',
    type: CustomCompendiums,
    restricted: true,
    requiresReload: true
  });

  game.settings.register(HM.CONFIG.ID, 'classPacks', {
    name: 'hm.settings.class-packs.name',
    scope: 'world',
    config: false,
    type: Array,
    default: [],
    requiresReload: true
  });

  game.settings.register(HM.CONFIG.ID, 'racePacks', {
    name: 'hm.settings.race-packs.name',
    scope: 'world',
    config: false,
    type: Array,
    default: [],
    requiresReload: true
  });

  game.settings.register(HM.CONFIG.ID, 'backgroundPacks', {
    name: 'hm.settings.background-packs.name',
    scope: 'world',
    config: false,
    type: Array,
    default: [],
    requiresReload: true
  });

  game.settings.register(HM.CONFIG.ID, 'itemPacks', {
    name: 'hm.settings.item-packs.name',
    scope: 'world',
    config: false,
    type: Array,
    default: [],
    requiresReload: true
  });
}

/**
 * Main registration function that initializes all module settings.
 * Sets up core, world, dice, and compendium settings and handles
 * the ready hook for standard array initialization.
 * @function
 */
export function registerSettings() {
  registerCoreSettings();
  HM.log(3, 'Core settings registered.');
  registerWorldSettings();
  HM.log(3, 'World settings registered.');
  registerDiceSettings();
  HM.log(3, 'Dice settings registered.');
  registerCompendiumSettings();
  HM.log(3, 'Compendium settings registered.');

  Hooks.on('ready', async () => {
    const customArraySetting = game.settings.get(HM.CONFIG.ID, 'customStandardArray');
    if (!customArraySetting || customArraySetting.trim() === '') {
      await game.settings.set(HM.CONFIG.ID, 'customStandardArray', StatRoller.getStandardArrayDefault());
      HM.log(3, 'Custom Standard Array was reset to default values due to invalid length.');
    }
  });
}
