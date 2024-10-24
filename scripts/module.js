import * as HMUtils from './utils/index.js';
import { registerSettings } from './settings.js';
import { CustomCompendiums } from './app/CustomCompendiums.js';
import { HeroMancer } from './app/HeroMancer.js';

/* Main Hero Mancer class, define some statics that will be used everywhere in the module. */
export class HM {
  static ID = 'hero-mancer'; // Used to define folders, classes, file structures, foundry api, etc.

  static TITLE = 'Hero Mancer'; // Module title

  static ABRV = 'hm'; // Abbreviation for CSS classes and localization

  static TMPL = `modules/${HM.ID}/templates`; // Path to templates

  static verboseLoggingEnabled = false; // Default setting for logging

  /* Initialize the module */
  static initialize() {
    console.log('Initializing Module.');
    registerSettings();
    this.heroMancer = new HeroMancer();
    const currentLogLevel = parseInt(game.settings.get(HM.ID, 'loggingLevel'));

    if (currentLogLevel > 0) {
      const logMessage = `Logging level set to ${
        currentLogLevel === 1 ? 'Errors'
        : currentLogLevel === 2 ? 'Warnings'
        : 'Verbose'
      }`;
      HM.log(3, logMessage); // Log at verbose level
    }
  }

  /* Utility function for logging based on the logging level setting */
  static log(level, ...args) {
    const currentLogLevel = parseInt(game.settings.get(HM.ID, 'loggingLevel')); // Ensure numeric comparison

    // Only log if logging level is greater than 0 (Off)
    if (currentLogLevel > 0 && level <= currentLogLevel) {
      switch (level) {
        case 1:
          console.error(`${HM.ID} |`, ...args);
          break;
        case 2:
          console.warn(`${HM.ID} |`, ...args);
          break;
        case 3:
        default:
          console.log(`${HM.ID} |`, ...args);
          break;
      }
    }
  }
}

/* Register the initialization hook */
Hooks.on('init', () => {
  HM.initialize(); // Initialize the module and register settings
});

Hooks.on('ready', () => {
  if (!game.settings.get(HM.ID, 'enable')) return;

  // Initialize HeroMancer after everything is ready.
  HM.heroMancer = new HeroMancer();
  HMUtils.registerButton();
  // Load the saved compendium selections from the settings
  CustomCompendiums.classPacks = game.settings.get('hero-mancer', 'classPacks');
  CustomCompendiums.racePacks = game.settings.get('hero-mancer', 'racePacks');
  CustomCompendiums.backgroundPacks = game.settings.get('hero-mancer', 'backgroundPacks');

  HM.log(3, 'Loaded classPacks:', CustomCompendiums.classPacks);
  HM.log(3, 'Loaded racePacks:', CustomCompendiums.racePacks);
  HM.log(3, 'Loaded backgroundPacks:', CustomCompendiums.backgroundPacks);
  // Button click event to render HeroMancer, scoped to actors-sidebar section
  $('section[class*="actors-sidebar"]').on('click', `.${HM.ABRV}-actortab-button`, (event) => {
    HM.heroMancer.render(true);
  });
});
Hooks.once('renderSettingConfig', () => {
  HM.customCompendiums = new CustomCompendiums();
});
