import { registerSettings } from './settings.js';
import { CacheManager, CustomCompendiums, DiceRolling, DocumentService, EquipmentParser, HtmlManipulator } from './utils/index.js';

/**
 * Main Hero Mancer class, define some statics that will be used everywhere in the module.
 * @class
 */
export class HM {
  /* -------------------------------------------- */
  /*  Static Properties                           */
  /* -------------------------------------------- */

  static CONFIG = {
    ID: 'hero-mancer',
    TITLE: 'Hero Mancer',
    TEMPLATES: 'modules/hero-mancer/templates',
    DOCUMENTS: {
      race: null,
      class: null,
      background: null
    },
    COMPAT: {}
  };

  static logLevel = 0;

  /* -------------------------------------------- */
  /*  Static Public Methods                       */
  /* -------------------------------------------- */

  static init() {
    this.initSettings();
    this.logLevel = parseInt(game.settings.get(this.CONFIG.ID, 'loggingLevel'));
    this.CONFIG.DOCUMENTS = { ...this.CONFIG.DOCUMENTS }; // Clone default structure

    // Logging setup
    if (this.logLevel > 0) {
      const logMessage = `Logging level set to ${
        this.logLevel === 1 ? 'Errors'
        : this.logLevel === 2 ? 'Warnings'
        : 'Verbose'
      }`;
      HM.log(3, logMessage); // Log at verbose level
    }
  }

  /* Register Settings */
  static initSettings() {
    console.log(`${HM.CONFIG.ID} | Registering module settings.`);
    registerSettings();

    Hooks.once('renderSettingConfig', () => {
      this.customCompendiums = new CustomCompendiums();
      this.diceRolling = new DiceRolling();
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
          console.error(`${HM.CONFIG.ID} |`, ...args);
          break;
        case 2:
          console.warn(`${HM.CONFIG.ID} |`, ...args);
          break;
        case 3:
        default:
          console.log(`${HM.CONFIG.ID} |`, ...args);
          break;
      }
    }
  }

  /**
   * Prepares and caches game documents
   * @throws {Error} If document preparation fails
   * @async
   */
  static async prepareDocuments() {
    HM.log(3, 'Preparing documents for Hero Mancer');

    try {
      const [raceDocs, classDocs, backgroundDocs] = await Promise.all([DocumentService.prepDocs('race'), DocumentService.prepDocs('class'), DocumentService.prepDocs('background')]).then((results) =>
        results.map((r) => r.types)
      );

      this.documents = { race: raceDocs, class: classDocs, background: backgroundDocs };

      const allDocs = [...(raceDocs?.flatMap((folder) => folder.docs) || []), ...(classDocs?.flatMap((pack) => pack.docs) || []), ...(backgroundDocs?.flatMap((pack) => pack.docs) || [])];

      await Promise.all(
        allDocs.map(async (doc) => {
          if (doc?.description) {
            try {
              doc.enrichedDescription = await TextEditor.enrichHTML(doc.description);

              // Replace h3 with h2 tags for nicer styling.
              doc.enrichedDescription = doc.enrichedDescription
                .replace(/<h3/g, '<h2')
                .replace(/<\/h3/g, '</h2')
                .replace(/<\/ h3/g, '</ h2');
            } catch (error) {
              HM.log(1, `Failed to enrich description for '${doc.name}':`, error);
            }
          }
        })
      );

      const cacheManager = new CacheManager();
      cacheManager.cacheDocuments({ raceDocs, classDocs, backgroundDocs });
      HM.log(3, 'Document preparation complete');
    } catch (error) {
      HM.log(1, 'Failed to prepare documents:', error.message);
      throw error; // Re-throw to handle at caller level
    }
  }

  static updateSelection(type, selection) {
    this.CONFIG.SELECT_STORAGE[type] = selection;
  }
}

HM.CONFIG.SELECT_STORAGE = {
  class: { selectedValue: '', selectedId: '' },
  race: { selectedValue: '', selectedId: '' },
  background: { selectedValue: '', selectedId: '' }
};

/* -------------------------------------------- */
/*  Hooks                                       */
/* -------------------------------------------- */

Hooks.on('init', () => {
  HM.init();
  CONFIG.Item.compendiumIndexFields = ['system.type.value', 'system.properties', 'system.identifier', 'system.description.value', 'type', 'name', '_id', 'uuid', 'pack'];
});

Hooks.once('ready', async () => {
  if (!game.settings.get(HM.CONFIG.ID, 'enable')) return;
  for (const pack of game.packs.filter((p) => p.documentName === 'Item')) {
    await pack.getIndex();
  }
  if (game.modules.get('elkan5e')?.active && game.settings.get(HM.CONFIG.ID, 'elkanCompatibility')) {
    HM.COMPAT = { ELKAN: true };
    HM.log(3, 'Elkan Detected: Compatibility auto-enabled.');
  }
  await HM.prepareDocuments();

  // Load compendium selections
  CustomCompendiums.classPacks = game.settings.get('hero-mancer', 'classPacks');
  CustomCompendiums.racePacks = game.settings.get('hero-mancer', 'racePacks');
  CustomCompendiums.backgroundPacks = game.settings.get('hero-mancer', 'backgroundPacks');

  HM.log(3, {
    classPacks: CustomCompendiums.classPacks,
    racePacks: CustomCompendiums.racePacks,
    backgroundPacks: CustomCompendiums.backgroundPacks
  });

  await EquipmentParser.initializeLookupItems();

  const customArraySetting = game.settings.get(HM.CONFIG.ID, 'customStandardArray');
  if (!customArraySetting || customArraySetting.trim() === '') {
    await game.settings.set(HM.CONFIG.ID, 'customStandardArray', StatRoller.getStandardArrayDefault());
    HM.log(3, 'Custom Standard Array was reset to default values due to invalid length.');
  }
});

Hooks.on('renderActorDirectory', () => {
  HtmlManipulator.registerButton();
  HM.log(3, 'Injecting button into Actor Directory');
});

Hooks.on('error', (location, error, data) => {
  if (location !== 'TextEditor.enrichHTML') return;
  HM.log(2, 'HERO MANCER: HTML Enricher Error: This error is not game-breaking, it can be safely ignored for now.', error.message);
});
