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
    HM.log('Initializing Module.');
    registerSettings(); // Register the settings for the module
    // Initialize HeroMancer here
    this.heroMancer = new HeroMancer();
    // Once the settings are registered, we check if verbose logging is enabled
    HM.verboseLoggingEnabled = game.settings.get(HM.ID, 'enableVerboseLogging');
    HM.log(`Verbose logging is ${HM.verboseLoggingEnabled ? 'enabled' : 'disabled'}.`);
  }

  /* Utility function for logging based on the verbose setting */
  static log(...args) {
    if (HM.verboseLoggingEnabled) {
      console.log(`${HM.ID} |`, ...args);
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

  HM.log('Loaded classPacks:', CustomCompendiums.classPacks);
  HM.log('Loaded racePacks:', CustomCompendiums.racePacks);
  HM.log('Loaded backgroundPacks:', CustomCompendiums.backgroundPacks);
  // Button click event to render HeroMancer, scoped to actors-sidebar section
  $('section[class*="actors-sidebar"]').on('click', `.${HM.ABRV}-actortab-button`, (event) => {
    HM.heroMancer.render(true);
  });
});
Hooks.once('renderSettingConfig', () => {
  HM.customCompendiums = new CustomCompendiums();
});
