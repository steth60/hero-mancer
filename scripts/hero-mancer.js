import { HtmlManipulator } from './utils/index.js';
import { registerSettings } from './settings.js';
import { CustomCompendiums } from './app/CustomCompendiums.js';
import { HeroMancer } from './app/HeroMancer.js';

/* Main Hero Mancer class, define some statics that will be used everywhere in the module. */
export class HM {
  static ID = 'hero-mancer'; // Used to define folders, classes, file structures, foundry api, etc.

  static TITLE = 'Hero Mancer'; // Module title

  static ABRV = 'hm'; // Abbreviation for CSS classes and localization

  static TMPL = `modules/${HM.ID}/templates`; // Path to templates

  static logLevel = 0;

  /* Initialize the module */
  static initialize() {
    console.log('Initializing Module.');
    this.initializeSettings();
    this.initializeHeroMancer();
    this.logLevel = parseInt(game.settings.get(HM.ID, 'loggingLevel'));

    // Logging setup
    if (this.logLevel > 0) {
      const logMessage = `Logging level set to ${this.logLevel === 1 ? 'Errors' : this.logLevel === 2 ? 'Warnings' : 'Verbose'}`;
      HM.log(3, logMessage); // Log at verbose level
    }
  }

  /* Initialize HeroMancer */
  static initializeHeroMancer() {
    console.log('Initializing HeroMancer.');

    Hooks.on('ready', () => {
      if (!game.settings.get(HM.ID, 'enable')) return;

      // Initialize HeroMancer after everything is ready.
      this.heroMancer = new HeroMancer();

      // Load the saved compendium selections from the settings
      CustomCompendiums.classPacks = game.settings.get('hero-mancer', 'classPacks');
      CustomCompendiums.racePacks = game.settings.get('hero-mancer', 'racePacks');
      CustomCompendiums.backgroundPacks = game.settings.get('hero-mancer', 'backgroundPacks');

      HM.log(3, 'Loaded classPacks:', CustomCompendiums.classPacks);
      HM.log(3, 'Loaded racePacks:', CustomCompendiums.racePacks);
      HM.log(3, 'Loaded backgroundPacks:', CustomCompendiums.backgroundPacks);
    });
  }

  /* Register Settings */
  static initializeSettings() {
    console.log('Registering Module Settings.');
    registerSettings();

    Hooks.once('renderSettingConfig', () => {
      this.customCompendiums = new CustomCompendiums();
    });
  }

  /**
   * Custom logger.
   * @param {number} level 0-3 to define log level to catch. 0 = disabled.
   * @param {any} args Strings, variables to log to console.
   */
  static log(level, ...args) {
    if (this.logLevel > 0 && level <= this.logLevel) {
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
  // Register the hm-range helper to generate a range of numbers.
  Handlebars.registerHelper('hm-range', function (min, max) {
    const range = [];
    for (let i = min; i < max; i++) {
      range.push(i);
    }
    return range;
  });
});

/* Add button to ActorDirectory */
Hooks.on('renderActorDirectory', () => {
  HtmlManipulator.registerButton();
  HM.log(3, 'Injecting button into Actor Directory');
});
