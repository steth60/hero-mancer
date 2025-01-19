import { HtmlManipulator, DocumentService, CacheManager } from './utils/index.js';
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

  static documents = null;

  /* Initialize the module */
  static initialize() {
    console.log('Initializing Module.');
    this.initializeSettings();
    this.initializeHeroMancer();
    this.logLevel = parseInt(game.settings.get(HM.ID, 'loggingLevel'));

    // Initialize documents object
    this.documents = {
      race: null,
      class: null,
      background: null
    };

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

  static async prepareDocuments() {
    HM.log(3, 'Preparing documents for Hero Mancer');
    try {
      const { types: raceDocs } = await DocumentService.prepDocs('race');
      const { types: classDocs } = await DocumentService.prepDocs('class');
      const { types: backgroundDocs } = await DocumentService.prepDocs('background');

      this.documents.race = raceDocs;
      this.documents.class = classDocs;
      this.documents.background = backgroundDocs;

      // Enrich descriptions after document preparation
      const allDocs = [
        ...(raceDocs?.flatMap((folder) => folder.docs) || []),
        ...(classDocs?.flatMap((pack) => pack.docs) || []),
        ...(backgroundDocs?.flatMap((pack) => pack.docs) || [])
      ];

      for (const doc of allDocs) {
        if (doc?.description) {
          try {
            doc.enrichedDescription = await TextEditor.enrichHTML(doc.description);
          } catch (error) {
            HM.log(1, `Error enriching description for '${doc.name}':`, error);
          }
        }
      }

      CacheManager.cacheDocuments({
        raceDocs,
        classDocs,
        backgroundDocs
      });

      HM.log(3, 'Document preparation complete');
    } catch (error) {
      HM.log(1, 'Error preparing documents:', error);
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

Hooks.on('ready', async () => {
  await HM.prepareDocuments();
});
