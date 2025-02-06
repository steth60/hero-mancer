import { HtmlManipulator, DocumentService, CacheManager, EquipmentParser } from './utils/index.js';
import { registerSettings } from './settings.js';
import { CustomCompendiums } from './app/CustomCompendiums.js';
import { DiceRolling } from './app/DiceRolling.js';
import { HeroMancer } from './app/HeroMancer.js';

/* Main Hero Mancer class, define some statics that will be used everywhere in the module. */
export class HM {
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

  static init() {
    this.initSettings();
    this.logLevel = parseInt(game.settings.get(this.CONFIG.ID, 'loggingLevel'));
    this.CONFIG.DOCUMENTS = { ...this.CONFIG.DOCUMENTS }; // Clone default structure

    // Logging setup
    if (this.logLevel > 0) {
      const logMessage = `Logging level set to ${this.logLevel === 1 ? 'Errors' : this.logLevel === 2 ? 'Warnings' : 'Verbose'}`;
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
      const [raceDocs, classDocs, backgroundDocs] = await Promise.all([
        DocumentService.prepDocs('race'),
        DocumentService.prepDocs('class'),
        DocumentService.prepDocs('background')
      ]).then((results) => results.map((r) => r.types));

      this.documents = { race: raceDocs, class: classDocs, background: backgroundDocs };

      const allDocs = [
        ...(raceDocs?.flatMap((folder) => folder.docs) || []),
        ...(classDocs?.flatMap((pack) => pack.docs) || []),
        ...(backgroundDocs?.flatMap((pack) => pack.docs) || [])
      ];

      await Promise.all(
        allDocs.map(async (doc) => {
          if (doc?.description) {
            try {
              doc.enrichedDescription = await TextEditor.enrichHTML(doc.description);
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

// Add SELECT_STORAGE after class definition
HM.CONFIG.SELECT_STORAGE = {
  class: { selectedValue: '', selectedId: '' },
  race: { selectedValue: '', selectedId: '' },
  background: { selectedValue: '', selectedId: '' }
};

Hooks.on('init', () => {
  HM.init();
  CONFIG.Item.compendiumIndexFields = ['system.type.value', 'system.properties', 'system.identifier', 'system.description.value', 'type', 'name', '_id', 'uuid', 'pack'];
});

/* Hooks.once('setup', () => {
  if (!game.dnd5e?.applications?.CompendiumBrowser) return;

  const originalFetch = game.dnd5e.applications.CompendiumBrowser.fetch;
  game.dnd5e.applications.CompendiumBrowser.fetch = async function (documentClass, options = {}) {
    options.filters = Array.isArray(options.filters) ? options.filters : [];

    const enabledPrefixes = new Set();
    ['classPacks', 'racePacks', 'backgroundPacks'].forEach((setting) => {
      const packs = game.settings.get(HM.CONFIG.ID, setting);
      const packList = Array.isArray(packs) ? packs : [packs];
      packList.forEach((pack) => {
        if (pack) {
          const prefix = pack.split('.')[0];
          enabledPrefixes.add(prefix);
        }
      });
    });

    options.filters.additional = {
      source: Object.fromEntries(
        [...game.packs].map((pack) => {
          const prefix = pack.collection.split('.')[0];
          return [pack.collection, enabledPrefixes.has(prefix) ? 1 : -1];
        })
      )
    };

    return originalFetch.call(this, documentClass, options);
  };
}); */

Hooks.once('ready', async () => {
  if (!game.settings.get(HM.CONFIG.ID, 'enable')) return;
  for (const pack of game.packs.filter((p) => p.documentName === 'Item')) {
    await pack.getIndex();
  }
  if (game.modules.get('elkan5e').active && game.settings.get(HM.CONFIG.ID, 'elkanCompatibility')) {
    HM.COMPAT = { ELKAN: true };
    HM.log(3, 'Elkan Detected: Compatibility auto-enabled.');
  }
  await HM.prepareDocuments();

  // Initialize HeroMancer
  HM.heroMancer = new HeroMancer();

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
});

Hooks.on('renderActorDirectory', () => {
  HtmlManipulator.registerButton();
  HM.log(3, 'Injecting button into Actor Directory');
});
