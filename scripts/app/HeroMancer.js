/* eslint-disable indent */
import { HM } from '../hero-mancer.js';
import {
  CacheManager,
  CharacterArtPicker,
  DropdownHandler,
  EquipmentParser,
  EventBus,
  HtmlManipulator,
  Listeners,
  MandatoryFields,
  ProgressBar,
  SavedOptions,
  StatRoller,
  SummaryManager
} from '../utils/index.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class HeroMancer extends HandlebarsApplicationMixin(ApplicationV2) {
  /* -------------------------------------------- */
  /*  Static Properties                           */
  /* -------------------------------------------- */

  static selectedAbilities = [];

  /** @override */
  static DEFAULT_OPTIONS = {
    id: `${HM.CONFIG.ID}-app`,
    tag: 'form',
    form: {
      handler: HeroMancer.formHandler,
      closeOnSubmit: true,
      submitOnChange: false
    },
    actions: {
      rollStat: HeroMancer.rollStat,
      decreaseScore: HeroMancer.decreaseScore,
      increaseScore: HeroMancer.increaseScore,
      selectCharacterArt: CharacterArtPicker.selectCharacterArt,
      selectTokenArt: CharacterArtPicker.selectTokenArt,
      selectPlayerAvatar: CharacterArtPicker.selectPlayerAvatar,
      resetOptions: HeroMancer.resetOptions,
      switchToTab: HeroMancer.switchToTab
    },
    classes: ['hm-app'],
    position: {
      height: 'auto',
      width: 'auto',
      top: '150'
    },
    window: {
      icon: 'fa-solid fa-egg',
      resizable: false
    }
  };

  /** @override */
  static PARTS = {
    header: {
      template: `${HM.CONFIG.TEMPLATES}/app-header.hbs`,
      classes: ['hm-app-header']
    },
    tabs: {
      template: `${HM.CONFIG.TEMPLATES}/app-nav.hbs`,
      classes: ['hm-app-nav']
    },
    start: {
      template: `${HM.CONFIG.TEMPLATES}/tab-start.hbs`,
      classes: ['hm-app-tab-content']
    },
    background: {
      template: `${HM.CONFIG.TEMPLATES}/tab-background.hbs`,
      classes: ['hm-app-tab-content']
    },
    race: {
      template: `${HM.CONFIG.TEMPLATES}/tab-race.hbs`,
      classes: ['hm-app-tab-content']
    },
    class: {
      template: `${HM.CONFIG.TEMPLATES}/tab-class.hbs`,
      classes: ['hm-app-tab-content']
    },
    abilities: {
      template: `${HM.CONFIG.TEMPLATES}/tab-abilities.hbs`,
      classes: ['hm-app-tab-content']
    },
    equipment: {
      template: `${HM.CONFIG.TEMPLATES}/tab-equipment.hbs`,
      classes: ['hm-app-tab-content']
    },
    finalize: {
      template: `${HM.CONFIG.TEMPLATES}/tab-finalize.hbs`,
      classes: ['hm-app-tab-content']
    },
    footer: {
      template: `${HM.CONFIG.TEMPLATES}/app-footer.hbs`,
      classes: ['hm-app-footer']
    }
  };

  static ADVANCEMENT_DELAY = {
    transitionDelay: 1000, // Time between advancements in ms
    renderTimeout: 5000, // Max time to wait for render
    retryAttempts: 3 // Number of retry attempts for failed managers
  };

  /* -------------------------------------------- */
  /*  Instance Properties                         */
  /* -------------------------------------------- */

  #isRendering;

  /* -------------------------------------------- */
  /*  Constructor                                 */
  /* -------------------------------------------- */

  constructor(options = {}) {
    super(options);
  }

  /* -------------------------------------------- */
  /*  Getters & Setters                           */
  /* -------------------------------------------- */

  get title() {
    return `${HM.CONFIG.TITLE} | ${game.user.name}`;
  }

  /* -------------------------------------------- */
  /*  Protected Methods                           */
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const cacheManager = new CacheManager();

    // Check if cached data is available first - early return if valid
    if (cacheManager.isCacheValid()) {
      HM.log(3, 'Using cached documents and enriched descriptions');
      const abilitiesCount = Object.keys(CONFIG.DND5E.abilities).length;
      HeroMancer.selectedAbilities = Array(abilitiesCount).fill(8);

      // Handle ELKAN compatibility
      if (HM.COMPAT?.ELKAN) {
        options.parts = options.parts.filter((part) => part !== 'equipment');
      }

      return {
        raceDocs: HM.documents.race || cacheManager.getCachedDocs('race'),
        classDocs: HM.documents.class || cacheManager.getCachedDocs('class'),
        backgroundDocs: HM.documents.background || cacheManager.getCachedDocs('background'),
        tabs: this._getTabs(options.parts),
        abilities: this.#prepareAbilities(),
        rollStat: this.rollStat,
        rollMethods: this.#getRollMethods(),
        diceRollMethod: this.#getDiceRollingMethod(),
        allowedMethods: game.settings.get(HM.CONFIG.ID, 'allowedMethods'),
        standardArray: this.#getStandardArray(),
        selectedAbilities: HeroMancer.selectedAbilities,
        remainingPoints: Listeners.updateRemainingPointsDisplay(HeroMancer.selectedAbilities),
        totalPoints: StatRoller.getTotalPoints(),
        playerCustomizationEnabled: game.settings.get(HM.CONFIG.ID, 'enablePlayerCustomization'),
        tokenCustomizationEnabled: game.settings.get(HM.CONFIG.ID, 'enableTokenCustomization'),
        token: this.#getTokenConfig(),
        mandatoryFields: game.settings.get(HM.CONFIG.ID, 'mandatoryFields')
      };
    }

    // Inform user that data is loading
    ui.notifications.info('hm.actortab-button.loading', { localize: true });

    // Initialize abilities and related data
    const abilitiesCount = Object.keys(CONFIG.DND5E.abilities).length;
    HeroMancer.selectedAbilities = Array(abilitiesCount).fill(8);

    // Handle ELKAN compatibility
    if (HM.COMPAT?.ELKAN) {
      options.parts = options.parts.filter((part) => part !== 'equipment');
    }

    // Prepare context with all required data
    const context = {
      raceDocs: HM.documents.race || cacheManager.getCachedDocs('race'),
      classDocs: HM.documents.class || cacheManager.getCachedDocs('class'),
      backgroundDocs: HM.documents.background || cacheManager.getCachedDocs('background'),
      tabs: this._getTabs(options.parts),
      abilities: this.#prepareAbilities(),
      rollStat: this.rollStat,
      rollMethods: this.#getRollMethods(),
      diceRollMethod: this.#getDiceRollingMethod(),
      allowedMethods: game.settings.get(HM.CONFIG.ID, 'allowedMethods'),
      standardArray: this.#getStandardArray(),
      selectedAbilities: HeroMancer.selectedAbilities,
      remainingPoints: Listeners.updateRemainingPointsDisplay(HeroMancer.selectedAbilities),
      totalPoints: StatRoller.getTotalPoints(),
      playerCustomizationEnabled: game.settings.get(HM.CONFIG.ID, 'enablePlayerCustomization'),
      tokenCustomizationEnabled: game.settings.get(HM.CONFIG.ID, 'enableTokenCustomization'),
      token: this.#getTokenConfig(),
      mandatoryFields: game.settings.get(HM.CONFIG.ID, 'mandatoryFields')
    };

    // Cache the documents for future use
    cacheManager.cacheDocuments({
      raceDocs: context.raceDocs,
      classDocs: context.classDocs,
      backgroundDocs: context.backgroundDocs
    });

    HM.log(3, 'Documents registered and enriched, caching results');
    return context;
  }

  /** @override */
  _preparePartContext(partId, context) {
    HM.log(3, 'Preparing part context', { partId, context });

    switch (partId) {
      case 'start':
      case 'background':
      case 'race':
      case 'class':
        context.tab = context.tabs[partId];
        break;
      case 'abilities':
        context.tab = context.tabs[partId];
        context.totalPoints = StatRoller.getTotalPoints();
        context.pointsSpent = StatRoller.calculatePointsSpent(HeroMancer.selectedAbilities);
        context.remainingPoints = context.totalPoints - context.pointsSpent;
        break;
      case 'equipment':
        context.tab = context.tabs[partId];
        break;
      case 'finalize':
        context.tab = context.tabs[partId];
        context.alignments =
          game.settings
            .get(HM.CONFIG.ID, 'alignments')
            .split(',')
            .map((d) => d.trim()) || [];
        context.deities =
          game.settings
            .get(HM.CONFIG.ID, 'deities')
            .split(',')
            .map((d) => d.trim()) || [];
        break;
    }
    return context;
  }

  /**
   * Generate the data for tab navigation using the ApplicationV2 structure.
   * @param {string[]} parts An array of parts that correspond to tabs
   * @returns {Record<string, Partial<ApplicationTab>>}
   * @protected
   */
  _getTabs(parts) {
    const tabGroup = 'hero-mancer-tabs';
    if (!this.tabGroups[tabGroup]) {
      this.tabGroups[tabGroup] = 'start';
    }

    return parts.reduce((tabs, partId) => {
      const tab = {
        id: '',
        label: `hm.app.tab-names.${partId}`,
        group: tabGroup,
        cssClass: '',
        icon: ''
      };
      switch (partId) {
        case 'header':
        case 'tabs':
          return tabs;
        case 'start':
          tab.id = 'start';
          tab.label = `${game.i18n.localize('hm.app.tab-names.start')}`;
          tab.icon = 'fa-solid fa-play-circle';
          break;
        case 'background':
          tab.id = 'background';
          tab.label = `${game.i18n.localize('hm.app.tab-names.background')}`;
          tab.icon = 'fa-solid fa-scroll';
          break;
        case 'race':
          tab.id = 'race';
          tab.label = `${game.i18n.localize('hm.app.tab-names.race')}`;
          tab.icon = 'fa-solid fa-feather-alt';
          break;
        case 'class':
          tab.id = 'class';
          tab.label = `${game.i18n.localize('hm.app.tab-names.class')}`;
          tab.icon = 'fa-solid fa-chess-rook';
          break;
        case 'abilities':
          tab.id = 'abilities';
          tab.label = `${game.i18n.localize('hm.app.tab-names.abilities')}`;
          tab.icon = 'fa-solid fa-fist-raised';
          break;
        case 'equipment':
          if (HM.COMPAT?.ELKAN) break;
          tab.id = 'equipment';
          tab.label = `${game.i18n.localize('hm.app.tab-names.equipment')}`;
          tab.icon = 'fa-solid fa-shield-halved';
          break;
        case 'finalize':
          tab.id = 'finalize';
          tab.label = `${game.i18n.localize('hm.app.tab-names.finalize')}`;
          tab.icon = 'fa-solid fa-check-circle';
          break;
        case 'footer':
          return tabs;
      }
      if (this.tabGroups[tabGroup] === tab.id) tab.cssClass = 'active';
      tabs[partId] = tab;
      return tabs;
    }, {});
  }

  /**
   * Actions performed after any render of the Application.
   * Post-render steps are not awaited by the render process.
   * @param {ApplicationRenderContext} context Prepared context data
   * @param {RenderOptions} options Provided render options
   * @protected
   */
  async _onRender(context, options) {
    if (this.#isRendering) return;

    try {
      this.#isRendering = true;
      await HeroMancer.cleanup(this);
      EventBus.clearAll();

      // Initialize UI components
      DropdownHandler.initializeDropdown({ type: 'class', html: this.element, context });
      DropdownHandler.initializeDropdown({ type: 'race', html: this.element, context });
      DropdownHandler.initializeDropdown({ type: 'background', html: this.element, context });

      // Initialize non-validation listeners and summaries
      SummaryManager.initializeSummaryListeners();
      Listeners.initializeListeners(this.element, context, HeroMancer.selectedAbilities);

      // Initial check of mandatory fields
      HM.log(3, 'Performing initial mandatory field check');
      await MandatoryFields.checkMandatoryFields(this.element);

      // Now initialize form validation listeners after the initial check
      Listeners.initializeFormValidationListeners(this.element);
    } finally {
      this.#isRendering = false;
    }
  }

  _onChangeForm(formConfig, event) {
    super._onChangeForm(formConfig, event);

    const form = event.currentTarget;
    if (!form) return;
    // HM.log(3, 'All form elements:', form.elements);
    this.completionPercentage = ProgressBar.updateProgress(this.element, form);
  }

  async _onClose() {
    HM.log(3, 'Closing application.');
    await HeroMancer.cleanup(this);
    EventBus.clearAll();
    HtmlManipulator.cleanup();
    HM.heroMancer = null; // Clear the instance
    super._onClose();
  }

  /* -------------------------------------------- */
  /*  Private Instance Methods                    */
  /* -------------------------------------------- */

  /**
   * Prepares ability scores data for the context
   * @returns {Array} Array of ability data objects
   * @private
   */
  #prepareAbilities() {
    const abilities = Object.entries(CONFIG.DND5E.abilities).map(([key, value]) => ({
      key,
      abbreviation: value.abbreviation.toUpperCase(),
      fullKey: value.fullKey.toUpperCase(),
      currentScore: 8
    }));

    HM.log(3, 'ABILITIES:', abilities);
    return abilities;
  }

  /**
   * Gets available roll methods
   * @returns {Object} Object with roll method localizations
   * @private
   */
  #getRollMethods() {
    return {
      pointBuy: game.i18n.localize('hm.app.abilities.methods.pointBuy'),
      standardArray: game.i18n.localize('hm.app.abilities.methods.standardArray'),
      manualFormula: game.i18n.localize('hm.app.abilities.methods.manual')
    };
  }

  /**
   * Gets and validates the current dice rolling method
   * @returns {string} The validated dice rolling method
   * @private
   */
  #getDiceRollingMethod() {
    let diceRollingMethod = game.settings.get(HM.CONFIG.ID, 'diceRollingMethod');
    HM.log(3, 'Dice Rolling Method:', diceRollingMethod);

    if (!['standardArray', 'pointBuy', 'manualFormula'].includes(diceRollingMethod)) {
      diceRollingMethod = 'standardArray'; // Default fallback
      HM.log(2, 'Invalid dice rolling method, defaulting to standardArray');
    }

    return diceRollingMethod;
  }

  /**
   * Gets the standard array for ability scores
   * @returns {Array} Array of ability score values
   * @private
   */
  #getStandardArray() {
    const abilitiesCount = Object.keys(CONFIG.DND5E.abilities).length;
    const extraAbilities = abilitiesCount > 6 ? abilitiesCount - 6 : 0;
    const diceRollingMethod = this.#getDiceRollingMethod();

    if (diceRollingMethod === 'standardArray') {
      const customArray = game.settings.get(HM.CONFIG.ID, 'customStandardArray');
      if (customArray) {
        const parsedArray = customArray.split(',').map(Number);
        // Check if the custom array has enough values for all abilities
        if (parsedArray.length >= abilitiesCount) {
          return parsedArray;
        }
      }
    }

    return StatRoller.getStandardArray(extraAbilities);
  }

  /**
   * Gets token configuration data
   * @returns {Object} Token configuration object
   * @private
   */
  #getTokenConfig() {
    const trackedAttrs = TokenDocument.implementation._getConfiguredTrackedAttributes('character');

    return {
      displayModes: Object.entries(CONST.TOKEN_DISPLAY_MODES).reduce((obj, e) => {
        obj[e[1]] = game.i18n.localize(`TOKEN.DISPLAY_${e[0]}`);
        return obj;
      }, {}),
      barModes: Object.entries(CONST.TOKEN_DISPLAY_MODES).reduce((obj, e) => {
        obj[e[1]] = game.i18n.localize(`TOKEN.DISPLAY_${e[0]}`);
        return obj;
      }, {}),
      barAttributes: {
        '': `${game.i18n.localize('None')}`,
        ...trackedAttrs.bar.reduce((obj, path) => {
          obj[path.join('.')] = path.join('.');
          return obj;
        }, {})
      },
      ring: {
        effects: Object.entries(CONFIG.Token.ring.ringClass.effects).reduce((obj, [name, value]) => {
          const loc = CONFIG.Token.ring.effects[name];
          if (name === 'DISABLED' || name === 'ENABLED' || !loc) return obj;
          obj[name] = game.i18n.localize(loc);
          return obj;
        }, {})
      }
    };
  }

  /* -------------------------------------------- */
  /*  Static Public Methods                       */
  /* -------------------------------------------- */

  static async resetOptions(event, target) {
    HM.log(3, 'Resetting options.', { event: event, target: target });
    await game.user.setFlag(HM.CONFIG.ID, SavedOptions.FLAG, null);

    const form = target.ownerDocument.getElementById('hero-mancer-app');
    if (!form) return;

    form.querySelectorAll('select, input').forEach((elem) => {
      if (elem.type === 'checkbox') {
        elem.checked = false;
        elem.dispatchEvent(new Event('change'));
      } else if (elem.tagName === 'SELECT') {
        elem.value = '';
        elem.dispatchEvent(new Event('change'));
      } else {
        elem.value = '';
        elem.dispatchEvent(new Event('change'));
      }
    });
    SummaryManager.updateClassRaceSummary();
    this.render(true);
    ui.notifications.info('hm.app.optionsReset', { localize: true });
  }

  static switchToTab(event, target) {
    const tabId = target.dataset.tab;
    HM.log(3, 'TAB ID:', tabId);
    if (!tabId) return;
    const app = HM.heroMancer;
    if (!app) return;
    app.tabGroups['hero-mancer-tabs'] = tabId;
    app.render(false);
  }

  /* Logic for rolling stats and updating input fields */
  static async rollStat(event, form) {
    HM.log(3, 'Rolling stats using user-defined formula.');
    await StatRoller.roller(form); // Use the utility function
  }

  static increaseScore(event, form) {
    const index = parseInt(form.getAttribute('data-ability-index'), 10);
    Listeners.adjustScore(index, 1, HeroMancer.selectedAbilities);
  }

  static decreaseScore(event, form) {
    const index = parseInt(form.getAttribute('data-ability-index'), 10);
    Listeners.adjustScore(index, -1, HeroMancer.selectedAbilities);
  }

  static async cleanup(instance) {
    const html = instance.element;
    ['class', 'race', 'background'].forEach((type) => {
      const dropdown = html?.querySelector(`#${type}-dropdown`);
      if (dropdown) {
        if (dropdown._descriptionUpdateHandler) {
          EventBus.off('description-update', dropdown._descriptionUpdateHandler);
        }
        if (dropdown._changeHandler) {
          dropdown.removeEventListener('change', dropdown._changeHandler);
        }
        dropdown._descriptionUpdateHandler = null;
        dropdown._changeHandler = null;
      }
    });
  }

  static async collectEquipmentSelections(event, options = { includeClass: true, includeBackground: true }) {
    return EquipmentParser.collectEquipmentSelections(event, options);
  }

  /* Function for handling form data collection, logging the results, and adding items to the actor. */
  static async formHandler(event, form, formData) {
    const mandatoryFields = game.settings.get(HM.CONFIG.ID, 'mandatoryFields') || [];

    // Check mandatory fields
    const missingFields = mandatoryFields.filter((field) => {
      const value = formData.object[field];
      return !value || value.trim() === '';
    });

    if (missingFields.length > 0) {
      ui.notifications.error(`Required fields missing: ${missingFields.join(', ')}`);
      return;
    }
    HM.log(3, 'FORMHANDLER:', { event: event, form: form, formData: formData });
    if (event.submitter?.dataset.action === 'saveOptions') {
      await SavedOptions.saveOptions(formData.object);
      ui.notifications.info('hm.app.optionsSaved', { localize: true });
      return;
    }
    HM.log(3, 'Processing form data...');
    HM.log(3, formData);

    // Check if using starting wealth
    const useStartingWealth = formData.object['use-starting-wealth'];
    const startingWealth = useStartingWealth ? await EquipmentParser.processStartingWealth(formData.object) : null;

    // Get background equipment (always collected)
    const backgroundEquipment = await HeroMancer.collectEquipmentSelections(event, {
      includeClass: false,
      includeBackground: true
    });

    // Get class equipment (only if not using starting wealth)
    const classEquipment =
      !useStartingWealth ?
        await HeroMancer.collectEquipmentSelections(event, {
          includeClass: true,
          includeBackground: false
        })
      : [];

    // Combine all equipment
    const equipmentSelections = [...backgroundEquipment, ...classEquipment];
    HM.log(3, 'Equipment selections:', equipmentSelections);

    try {
      const validProperties = Object.keys(formData.object);
      for (const property of validProperties) {
        const value = formData.object[property];
        if (value === null || value === undefined || value === '') {
          HM.log(2, `Missing required field: ${property}`);
        }
      }
    } catch (err) {
      HM.log(1, err);
    }

    // Extract itemId and packId from the formData
    const extractIds = (itemString) => {
      const regex = /^(.+?)\s\((.+)\)$/;
      const match = itemString.match(regex);
      return match ? { itemId: match[1], packId: match[2] } : null;
    };

    const backgroundData = extractIds(formData.object.background);
    const raceData = extractIds(formData.object.race);
    const classData = extractIds(formData.object.class);

    HM.log(3, 'Extracted Item Data:', { backgroundData, raceData, classData });

    // Extract abilities from formData with default 10
    HM.log(3, 'ABILITIES: Initializing abilities object');
    let abilities = {};

    HM.log(3, 'ABILITIES: Starting to iterate over formData.object keys');
    for (const key in formData.object) {
      HM.log(3, `ABILITIES: Inspecting key: ${key}`);

      const abilityMatch = key.match(/^abilities\[(\w+)]\.score$/) || key.match(/^abilities\[(\w+)]$/);
      if (abilityMatch) {
        HM.log(3, `ABILITIES: Key matches abilities pattern: ${key}`);

        const abilityKey = abilityMatch[1];
        HM.log(3, `ABILITIES: Extracted abilityKey: ${abilityKey}`);

        abilities[abilityKey] = formData.object[key] || 10;
        HM.log(3, `ABILITIES: Set abilities[${abilityKey}] to ${abilities[abilityKey]}`);
      } else {
        HM.log(3, `ABILITIES: Key does not match abilities pattern: ${key}`);
      }
    }
    HM.log(3, 'ABILITIES: Finished processing formData.object keys');

    HM.log(3, 'ABILITIES: Abilities extracted:', abilities);

    // Create the new actor
    let actorName = formData.object.name || game.user.name; // Handling for blank hero name.
    let actorData = {
      name: actorName,
      img: formData.object['character-art'],
      prototypeToken: HeroMancer.#transformTokenData(formData.object),
      type: 'character',
      system: {
        abilities: Object.fromEntries(Object.entries(abilities).map(([key, value]) => [key, { value }])),
        details: {
          age: formData.object.age || '',
          alignment: formData.object.alignment || '',
          appearance: formData.object.appearance || '',
          bond: formData.object.bonds || '',
          eyes: formData.object.eyes || '',
          faith: formData.object.faith || '',
          flaw: formData.object.flaws || '',
          gender: formData.object.gender || '',
          hair: formData.object.hair || '',
          height: formData.object.height || '',
          ideal: formData.object.ideals || '',
          skin: formData.object.skin || '',
          trait: formData.object.traits || '',
          weight: formData.object.weight || '',
          biography: {
            value: formData.object.backstory || ''
          }
        }
      }
    };
    ui.notifications.info('hm.actortab-button.creating', { localize: true });
    let actor = await Actor.create(actorData);
    let newActor = game.actors.getName(actorName);
    HM.log(3, newActor);
    HM.log(3, 'Created Actor:', actor);

    // Declare the items outside the try block
    let backgroundItem, raceItem, classItem;

    try {
      // Check if each required item is selected before fetching
      if (!backgroundData?.packId || !backgroundData?.itemId) {
        ui.notifications.warn('hm.errors.select-background', { localize: true });
        return;
      }
      if (!raceData?.packId || !raceData?.itemId) {
        ui.notifications.warn('hm.errors.select-race', { localize: true });
        return;
      }
      if (!classData?.packId || !classData?.itemId) {
        ui.notifications.warn('hm.errors.select-class', { localize: true });
        return;
      }

      // Fetch documents after confirming all selections are valid
      backgroundItem = await game.packs.get(backgroundData.packId)?.getDocument(backgroundData.itemId);
      raceItem = await game.packs.get(raceData.packId)?.getDocument(raceData.itemId);
      classItem = await game.packs.get(classData.packId)?.getDocument(classData.itemId);

      // If any document fetch fails (e.g., item was removed from the compendium)
      if (!backgroundItem) throw new Error(game.i18n.localize('hm.errors.no-background'));
      if (!raceItem) throw new Error(game.i18n.localize('hm.errors.no-race'));
      if (!classItem) throw new Error(game.i18n.localize('hm.errors.no-class'));
    } catch (error) {
      HM.log(1, error);
      ui.notifications.error('hm.errors.fetch-fail', { localize: true });
    }

    if (!backgroundItem || !raceItem || !classItem) {
      HM.log(1, 'Error: One or more items could not be fetched.');
      return;
    }

    const equipmentItems = equipmentSelections.map((item) => {
      // Item should already be in the correct format from collectEquipmentSelections
      return {
        ...item,
        system: {
          ...item.system,
          // Preserve container reference if it exists
          ...(item.container ? { container: item.container } : {})
        }
      };
    });

    try {
      // First handle equipment and wealth
      if (equipmentItems.length) {
        await actor.createEmbeddedDocuments('Item', equipmentItems, { keepId: true });
      }

      if (startingWealth) {
        await actor.update({
          system: {
            ...actor.system,
            currency: startingWealth
          }
        });
      }

      // Then let advancement manager handle race/background
      await processAdvancements([classItem, raceItem, backgroundItem], actor);

      // Update some user stuff
      if (game.settings.get(HM.CONFIG.ID, 'enablePlayerCustomization')) {
        await game.user.update({
          color: formData.object['player-color'],
          pronouns: formData.object['player-pronouns'],
          avatar: formData.object['player-avatar']
        });
      }
      await game.user.update({ character: actor.id });
    } catch (error) {
      HM.log(1, 'Error during character creation:', error);
    }

    /**
     * Processes a list of items for advancement for a given actor.
     * @async
     * @function processAdvancements
     * @param {Array<object>} items The items to be processed for advancement.
     * @param {object} newActor The actor to which the advancements are applied.
     * @returns {Promise<void>} Resolves when the advancement process is complete.
     */
    async function processAdvancements(items, newActor) {
      if (!Array.isArray(items) || !items.length) {
        HM.log(2, 'No items provided for advancement');
        return;
      }

      HM.log(3, 'Creating advancement manager');
      let currentManager;

      /**
       * Creates an advancement manager for a specific item with retries.
       * @async
       * @function createAdvancementManager
       * @param {object} item The item for which the advancement manager is created.
       * @param {number} [retryCount=0] The current retry attempt count.
       * @returns {Promise<object>} Resolves with the created advancement manager.
       * @throws {Error} If the manager creation fails after the allowed retries.
       */
      async function createAdvancementManager(item, retryCount = 0) {
        try {
          const manager = await Promise.race([
            dnd5e.applications.advancement.AdvancementManager.forNewItem(newActor, item.toObject()),
            new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Manager creation timed out')), HeroMancer.ADVANCEMENT_DELAY.renderTimeout);
            })
          ]);
          if (!manager) throw new Error('Failed to create manager');
          return manager;
        } catch (error) {
          if (retryCount < HeroMancer.ADVANCEMENT_DELAY.retryAttempts - 1) {
            HM.log(2, `Retry ${retryCount + 1}/${HeroMancer.ADVANCEMENT_DELAY.retryAttempts} for ${item.name}`);
            return createAdvancementManager(item, retryCount + 1);
          }
          throw error;
        }
      }

      try {
        currentManager = await createAdvancementManager(items[0]);
        HM.log(
          3,
          'Initial clone items:',
          currentManager?.clone?.items?.contents?.map((i) => i.name)
        );

        /**
         * Recursively processes advancements for each item in the list.
         * @function doAdvancement
         * @param {number} [itemIndex=0] The index of the current item being processed.
         * @returns {Promise<void>} A promise that resolves when processing is complete.
         */
        async function doAdvancement(itemIndex = 0) {
          if (itemIndex >= items.length) {
            HM.log(
              3,
              'Final actor items:',
              newActor.items.contents.map((i) => i.name)
            );
            currentManager?.close();
            newActor.sheet.render(true);
            return;
          }

          HM.log(3, `Processing ${items[itemIndex].name}`);

          return new Promise((resolve) => {
            Hooks.once('dnd5e.advancementManagerComplete', async () => {
              HM.log(3, `Completed ${items[itemIndex].name}`);

              // Use await with Promise-based setTimeout instead of mixing
              await new Promise((resolve) => setTimeout(resolve, HeroMancer.ADVANCEMENT_DELAY.transitionDelay));

              currentManager = null;

              if (itemIndex + 1 < items.length) {
                try {
                  currentManager = await createAdvancementManager(items[itemIndex + 1]);
                  currentManager.render(true);
                  await doAdvancement(itemIndex + 1);
                  resolve();
                } catch (error) {
                  HM.log(1, `Error creating manager for ${items[itemIndex + 1].name}:`, error);
                  newActor.sheet.render(true);
                  resolve();
                }
              } else {
                newActor.sheet.render(true);
                resolve();
              }
            });

            if (itemIndex === 0) {
              currentManager.render(true);
            }
          });
        }

        await doAdvancement();
      } catch (error) {
        HM.log(1, 'Error in advancement process:', error);
        if (currentManager) await currentManager.close();
        newActor.sheet.render(true);
      }

      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker(),
        content: SummaryManager.getSummaryForChat(),
        flags: {
          'hero-mancer': {
            type: 'character-summary'
          }
        }
      });
    }
  }

  /* -------------------------------------------- */
  /*  Static Private Methods                      */
  /* -------------------------------------------- */

  static #transformTokenData(formData) {
    try {
      HM.log(3, 'Transform Token Data - Input:', formData);

      const tokenData = {
        texture: {
          src: formData['token-art'] || formData['character-art'] || 'icons/svg/mystery-man.svg',
          scaleX: 1,
          scaleY: 1
        },
        sight: { enabled: true },
        disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
        actorLink: true
      };

      // Only add token customization properties if enabled
      if (game.settings.get(HM.CONFIG.ID, 'enableTokenCustomization')) {
        tokenData.displayName = parseInt(formData.displayName);
        tokenData.displayBars = parseInt(formData.displayBars);
        tokenData.bar1 = {
          attribute: formData['bar1.attribute'] || null
        };
        tokenData.bar2 = {
          attribute: formData['bar2.attribute'] || null
        };
        tokenData.ring = {
          enabled: formData['ring.enabled'] || false,
          colors: {
            ring: formData['ring.color'] || null,
            background: formData.backgroundColor || null
          },
          effects: this.#calculateRingEffects(formData['ring.effects'])
        };
      }

      HM.log(3, 'Token Data Created:', tokenData);
      return tokenData;
    } catch (error) {
      HM.log(1, 'Error in #transformTokenData:', error);
      return CONFIG.Actor.documentClass.prototype.prototypeToken;
    }
  }

  static #calculateRingEffects(effectsArray) {
    const TRE = CONFIG.Token.ring.ringClass.effects;
    let effects = TRE.ENABLED;

    if (!effectsArray?.length) return TRE.DISABLED;

    effectsArray.forEach((effect) => {
      if (effect && TRE[effect]) effects |= TRE[effect];
    });

    return effects;
  }
}
