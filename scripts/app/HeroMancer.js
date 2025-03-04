/* eslint-disable indent */

import {
  CharacterArtPicker,
  DropdownHandler,
  EquipmentParser,
  EventDispatcher,
  HM,
  HtmlManipulator,
  Listeners,
  MandatoryFields,
  MutationObserverRegistry,
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
      top: '100'
    },
    window: {
      icon: 'fa-solid fa-egg',
      resizable: false,
      minimizable: true
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

  /**
   * Prepares the main context data for the character creation application
   * Initializes abilities, processes compatibility settings, and prepares all tab data
   * @param {object} options - Application render options
   * @returns {Promise<object>} Complete context for character creation rendering
   * @protected
   * @override
   */
  async _prepareContext(options) {
    if (!HM.documents.race || !HM.documents.class || !HM.documents.background) {
      ui.notifications.info('hm.actortab-button.loading', { localize: true });
    }

    // Initialize abilities and related data
    const abilitiesCount = Object.keys(CONFIG.DND5E.abilities).length;
    HeroMancer.selectedAbilities = Array(abilitiesCount).fill(8);

    // Handle ELKAN compatibility
    if (HM.COMPAT?.ELKAN) {
      options.parts = options.parts.filter((part) => part !== 'equipment');
    }

    // Get dice rolling method once and reuse it
    const diceRollMethod = this.#getDiceRollingMethod();
    HM.log(3, 'Dice Roll Method in _prepareContext:', diceRollMethod);

    // Prepare context with all required data
    return {
      raceDocs: HM.documents.race || [],
      classDocs: HM.documents.class || [],
      backgroundDocs: HM.documents.background || [],
      tabs: this._getTabs(options.parts),
      abilities: this.#buildAbilitiesContext(),
      rollStat: this.rollStat,
      rollMethods: this.#getRollMethods(),
      diceRollMethod: diceRollMethod,
      allowedMethods: game.settings.get(HM.CONFIG.ID, 'allowedMethods'),
      standardArray: this.#getStandardArrayValues(diceRollMethod),
      selectedAbilities: HeroMancer.selectedAbilities,
      remainingPoints: Listeners.updateRemainingPointsDisplay(HeroMancer.selectedAbilities),
      totalPoints: StatRoller.getTotalPoints(),
      playerCustomizationEnabled: game.settings.get(HM.CONFIG.ID, 'enablePlayerCustomization'),
      tokenCustomizationEnabled: game.settings.get(HM.CONFIG.ID, 'enableTokenCustomization'),
      token: this.#getTokenConfig(),
      mandatoryFields: game.settings.get(HM.CONFIG.ID, 'mandatoryFields'),
      randomSafeColor: HeroMancer.#randomSafeColor()
    };
  }

  /**
   * Prepares context data for a specific part/tab of the application
   * Handles specific logic for each tab section (start, race, class, etc.)
   * @param {string} partId - ID of the template part being rendered
   * @param {object} context - Shared context from _prepareContext
   * @returns {object} Modified context for the specific part
   * @protected
   * @override
   */
  _preparePartContext(partId, context) {
    try {
      HM.log(3, 'Preparing part context', { partId, context });

      switch (partId) {
        case 'header':
        case 'tabs':
        case 'footer':
          break;
        case 'start':
        case 'background':
        case 'race':
        case 'class':
          context.tab = context.tabs[partId];
          break;
        case 'abilities':
          context.tab = context.tabs[partId];
          context.totalPoints = StatRoller.getTotalPoints();
          context.pointsSpent = StatRoller.calculateTotalPointsSpent(HeroMancer.selectedAbilities);
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
        default:
          HM.log(2, `Unknown part ID: ${partId}`);
          break;
      }

      return context;
    } catch (error) {
      HM.log(1, `Error preparing context for part ${partId}:`, error);

      // Return original context as fallback
      if (context.tabs && context.tabs[partId]) {
        context.tab = context.tabs[partId];
      }

      return context;
    }
  }

  /**
   * Generate the data for tab navigation using the ApplicationV2 structure.
   * @param {string[]} parts An array of parts that correspond to tabs
   * @returns {Record<string, Partial<ApplicationTab>>}
   * @protected
   * @override
   */
  _getTabs(parts) {
    try {
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

        try {
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
            default:
              HM.log(2, `Unknown part ID: ${partId}`);
              return tabs;
          }
        } catch (error) {
          HM.log(1, `Error processing tab ${partId}:`, error);
        }

        if (this.tabGroups[tabGroup] === tab.id) tab.cssClass = 'active';
        if (tab.id) tabs[partId] = tab;
        return tabs;
      }, {});
    } catch (error) {
      HM.log(1, 'Error generating tabs:', error);

      // Return minimal tabs as fallback
      return {
        start: {
          id: 'start',
          label: game.i18n.localize('hm.app.tab-names.start'),
          group: 'hero-mancer-tabs',
          cssClass: 'active',
          icon: 'fa-solid fa-play-circle'
        }
      };
    }
  }

  /**
   * Actions performed after any render of the Application.
   * Post-render steps are not awaited by the render process.
   * @param {ApplicationRenderContext} context Prepared context data
   * @param {RenderOptions} _options Provided render options
   * @protected
   * @override
   */
  async _onRender(context, _options) {
    if (this.#isRendering) return;

    try {
      this.#isRendering = true;
      await HeroMancer.cleanupEventListeners(this);
      EventDispatcher.clearAll();

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

  /**
   * Processes form changes and updates completion progress
   * @param {object} formConfig - Form configuration
   * @param {Event} event - Change event
   * @protected
   * @override
   */
  _onChangeForm(formConfig, event) {
    super._onChangeForm(formConfig, event);

    const form = event.currentTarget;
    if (!form) return;
    // HM.log(3, 'All form elements:', form.elements);
    this.completionPercentage = ProgressBar.calculateAndUpdateProgress(this.element, form);
  }

  /**
   * Actions to perform when the application is closed
   * Cleans up resources and references
   * @returns {Promise<void>}
   * @protected
   * @override
   */
  async _onClose() {
    HM.log(3, 'Closing application.');
    await HeroMancer.cleanupEventListeners(this);
    EventDispatcher.clearAll();
    HtmlManipulator.registerButton(); // Clears and recreates button listener
    HM.heroMancer = null; // Clear the instance
    super._onClose();
  }

  /* -------------------------------------------- */
  /*  Private Instance Methods                    */
  /* -------------------------------------------- */

  /**
   * Prepares ability scores data for the context
   * @returns {Array<object>} Array of ability data objects
   * @private
   */
  #buildAbilitiesContext() {
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
    HM.log(3, 'Initial dice rolling method:', diceRollingMethod);

    // Get the allowed methods configuration
    const allowedMethods = game.settings.get(HM.CONFIG.ID, 'allowedMethods');

    // Map from setting keys to method names
    const methodMapping = {
      standardArray: 'standardArray',
      pointBuy: 'pointBuy',
      manual: 'manualFormula'
    };

    // Create array of allowed method names
    const validMethods = Object.entries(allowedMethods)
      .filter(([key, enabled]) => enabled)
      .map(([key]) => methodMapping[key])
      .filter(Boolean);

    // If the current method isn't valid or isn't allowed, select the first allowed method
    if (!diceRollingMethod || !validMethods.includes(diceRollingMethod)) {
      diceRollingMethod = validMethods[0];
      HM.log(3, `Selected ${diceRollingMethod} as the default dice rolling method`);
    }

    return diceRollingMethod;
  }

  /**
   * Gets the standard array for ability scores
   * @param {string} [diceRollingMethod] - Optional pre-validated dice rolling method
   * @returns {Array} Array of ability score values
   * @private
   */
  #getStandardArrayValues(diceRollingMethod) {
    const abilitiesCount = Object.keys(CONFIG.DND5E.abilities).length;
    const extraAbilities = abilitiesCount > 6 ? abilitiesCount - 6 : 0;

    // Use provided method or get it if not provided
    const method = diceRollingMethod || this.#getDiceRollingMethod();

    if (method === 'standardArray') {
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

  /**
   * Resets all form options to their default values and clears user-saved flags
   * @param {Event} event - The triggering event
   * @param {HTMLElement} target - The DOM element that triggered the reset
   * @returns {Promise<void>}
   * @static
   */
  static async resetOptions(event, target) {
    HM.log(3, 'Resetting options.', { event: event, target: target });
    await game.user.setFlag(HM.CONFIG.ID, SavedOptions.FLAG, null);

    const form = target.ownerDocument.getElementById('hero-mancer-app');
    if (!form) return;

    form.querySelectorAll('select, input').forEach((elem) => {
      if (elem.parentElement.localName === 'color-picker') {
        elem.value = HeroMancer.#randomSafeColor();
        elem.parentElement.value = HeroMancer.#randomSafeColor();
      } else if (elem.type === 'checkbox') {
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

  /**
   * Handles tab switching in the HeroMancer interface
   * Updates the active tab and re-renders the application
   * @param {Event} _event - The click event
   * @param {HTMLElement} target - The clicked element with data-tab attribute
   * @returns {void}
   * @static
   */
  static switchToTab(_event, target) {
    try {
      const tabId = target.dataset.tab;
      HM.log(3, 'TAB ID:', tabId);

      if (!tabId) {
        HM.log(2, 'No tab ID found in target');
        return;
      }

      const app = HM.heroMancer;
      if (!app) {
        HM.log(2, 'No active Hero Mancer instance found');
        return;
      }

      app.tabGroups['hero-mancer-tabs'] = tabId;
      app.render(false);
    } catch (error) {
      HM.log(1, 'Error switching tab:', error);
    }
  }

  /**
   * Rolls an ability score using the configured dice rolling method
   * @param {Event} _event - The triggering event
   * @param {HTMLElement} form - The form element containing ability score data
   * @returns {Promise<void>}
   * @static
   */
  static async rollStat(_event, form) {
    HM.log(3, 'Rolling stats using user-defined formula.');
    await StatRoller.rollAbilityScore(form); // Use the utility function
  }

  /**
   * Increases an ability score by 1 point
   * @param {Event} _event - The triggering event
   * @param {HTMLElement} form - The form element with the data-ability-index attribute
   * @returns {void}
   * @static
   */
  static increaseScore(_event, form) {
    const index = parseInt(form.getAttribute('data-ability-index'), 10);
    Listeners.changeAbilityScoreValue(index, 1, HeroMancer.selectedAbilities);
  }

  /**
   * Decreases an ability score by 1 point
   * @param {Event} _event - The triggering event
   * @param {HTMLElement} form - The form element with the data-ability-index attribute
   * @returns {void}
   * @static
   */
  static decreaseScore(_event, form) {
    const index = parseInt(form.getAttribute('data-ability-index'), 10);
    Listeners.changeAbilityScoreValue(index, -1, HeroMancer.selectedAbilities);
  }

  /**
   * Cleans up all event handlers and observers when a HeroMancer instance is closed
   * @param {object} instance The HeroMancer instance being closed
   * @returns {Promise<void>}
   * @static
   */
  static async cleanupEventListeners(instance) {
    try {
      const html = instance.element;
      if (!html) {
        HM.log(3, 'No HTML element to clean up');
        return;
      }

      HM.log(3, 'Starting comprehensive cleanup of HeroMancer instance');

      // Track items that had cleanup issues
      const cleanupIssues = [];

      // Clean up dropdown handlers
      ['class', 'race', 'background'].forEach((type) => {
        try {
          const dropdown = html?.querySelector(`#${type}-dropdown`);
          if (dropdown) {
            // Clean up description handlers
            if (dropdown._descriptionUpdateHandler) {
              EventDispatcher.off('description-update', dropdown._descriptionUpdateHandler);
              dropdown._descriptionUpdateHandler = null;
            }

            // Clean up change handlers
            if (dropdown._changeHandler) {
              dropdown.removeEventListener('change', dropdown._changeHandler);
              dropdown._changeHandler = null;
            }

            // Clean up equipment handlers
            if (dropdown._equipmentChangeHandler) {
              dropdown.removeEventListener('change', dropdown._equipmentChangeHandler);
              dropdown._equipmentChangeHandler = null;
            }

            // Clean up summary handlers
            if (dropdown._summaryChangeHandler) {
              dropdown.removeEventListener('change', dropdown._summaryChangeHandler);
              dropdown._summaryChangeHandler = null;
            }

            HM.log(3, `Cleaned up handlers for ${type} dropdown`);
          }
        } catch (error) {
          HM.log(1, `Error cleaning up ${type} dropdown:`, error);
          cleanupIssues.push(`${type} dropdown`);
        }
      });

      // Clean up ability blocks
      try {
        const abilityBlocks = html.querySelectorAll('.ability-block');
        if (abilityBlocks && abilityBlocks.length > 0) {
          abilityBlocks.forEach((block, index) => {
            try {
              // Clean up dropdown handlers
              const dropdown = block.querySelector('.ability-dropdown');
              if (dropdown && dropdown._abilityChangeHandler) {
                dropdown.removeEventListener('change', dropdown._abilityChangeHandler);
                dropdown._abilityChangeHandler = null;
              }

              // Clean up score input handlers
              const scoreInput = block.querySelector('.ability-score');
              if (scoreInput && scoreInput._abilityChangeHandler) {
                scoreInput.removeEventListener('change', scoreInput._abilityChangeHandler);
                scoreInput._abilityChangeHandler = null;
              }

              // Clean up any observers
              const currentScore = block.querySelector('.current-score');
              if (currentScore && currentScore._summaryObserver) {
                currentScore._summaryObserver.disconnect();
                currentScore._summaryObserver = null;
              }
            } catch (error) {
              HM.log(1, `Error cleaning up ability block ${index}:`, error);
              cleanupIssues.push(`ability block ${index}`);
            }
          });

          HM.log(3, 'Cleaned up ability block handlers and observers');
        }
      } catch (error) {
        HM.log(1, 'Error cleaning up ability blocks:', error);
        cleanupIssues.push('ability blocks');
      }

      // Check mandatory fields
      const missingFields = mandatoryFields.filter((field) => {
        const value = formData.object[field];
        return value === undefined || value === null || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);
      });

      // Clean up equipment container
      try {
        const equipmentContainer = html.querySelector('#equipment-container');
        if (equipmentContainer) {
          if (equipmentContainer._summaryChangeHandler) {
            equipmentContainer.removeEventListener('change', equipmentContainer._summaryChangeHandler);
            equipmentContainer._summaryChangeHandler = null;
          }

          if (equipmentContainer._summaryObserver) {
            equipmentContainer._summaryObserver.disconnect();
            equipmentContainer._summaryObserver = null;
          }

          HM.log(3, 'Cleaned up equipment container handlers and observers');
        }
      } catch (error) {
        HM.log(1, 'Error cleaning up equipment container:', error);
        cleanupIssues.push('equipment container');
      }

      // Clean up prose mirror elements
      try {
        const proseMirrorElements = html.querySelectorAll('prose-mirror');
        if (proseMirrorElements && proseMirrorElements.length > 0) {
          proseMirrorElements.forEach((element, index) => {
            try {
              if (element._summaryObserver) {
                element._summaryObserver.disconnect();
                element._summaryObserver = null;
              }

              if (element._observer) {
                element._observer.disconnect();
                element._observer = null;
              }
            } catch (error) {
              HM.log(1, `Error cleaning up prose-mirror element ${index}:`, error);
              cleanupIssues.push(`prose-mirror ${index}`);
            }
          });

          HM.log(3, 'Cleaned up prose-mirror observers');
        }
      } catch (error) {
        HM.log(1, 'Error cleaning up prose-mirror elements:', error);
        cleanupIssues.push('prose-mirror elements');
      }

      // Clean up roll buttons
      try {
        const rollButtons = html.querySelectorAll('.roll-btn');
        if (rollButtons && rollButtons.length > 0) {
          rollButtons.forEach((button, index) => {
            try {
              if (button._clickHandler) {
                button.removeEventListener('click', button._clickHandler);
                button._clickHandler = null;
              }
            } catch (error) {
              HM.log(1, `Error cleaning up roll button ${index}:`, error);
              cleanupIssues.push(`roll button ${index}`);
            }
          });

          HM.log(3, 'Cleaned up roll button handlers');
        }
      } catch (error) {
        HM.log(1, 'Error cleaning up roll buttons:', error);
        cleanupIssues.push('roll buttons');
      }

      // Clean up form validation handlers
      try {
        const formElements = html.querySelectorAll('input, select, textarea');
        formElements.forEach((element, index) => {
          try {
            if (element._mandatoryFieldChangeHandler) {
              element.removeEventListener('change', element._mandatoryFieldChangeHandler);
              element._mandatoryFieldChangeHandler = null;
            }
            if (element._mandatoryFieldInputHandler) {
              element.removeEventListener('input', element._mandatoryFieldInputHandler);
              element._mandatoryFieldInputHandler = null;
            }
          } catch (error) {
            HM.log(1, `Error cleaning up form element ${index}:`, error);
            cleanupIssues.push(`form element ${index}`);
          }
        });

        HM.log(3, 'Cleaned up form validation handlers');
      } catch (error) {
        HM.log(1, 'Error cleaning up form validation handlers:', error);
        cleanupIssues.push('form validation handlers');
      }

      try {
        SummaryManager.cleanup();
      } catch (error) {
        HM.log(1, 'Error cleaning up SummaryManager:', error);
        cleanupIssues.push('SummaryManager');
      }

      try {
        MutationObserverRegistry.unregisterByPrefix('heromancer-');
      } catch (error) {
        HM.log(1, 'Error unregistering observers:', error);
        cleanupIssues.push('MutationObserverRegistry');
      }

      try {
        EventDispatcher.clearAll();
      } catch (error) {
        HM.log(1, 'Error clearing EventDispatcher:', error);
        cleanupIssues.push('EventDispatcher');
      }

      if (cleanupIssues.length > 0) {
        HM.log(1, `HeroMancer cleanup completed with issues in: ${cleanupIssues.join(', ')}`);
      } else {
        HM.log(3, 'HeroMancer cleanup completed successfully');
      }
    } catch (error) {
      HM.log(1, 'Critical error during HeroMancer cleanup:', error);
    }
  }

  /**
   * Collects equipment selections from the form inputs
   * Delegates to EquipmentParser.collectEquipmentSelections for processing
   * @param {Event} event - The form submission event
   * @param {object} options - Collection options
   * @param {boolean} [options.includeClass=true] - Whether to include class equipment
   * @param {boolean} [options.includeBackground=true] - Whether to include background equipment
   * @returns {Promise<Array<object>>} Array of equipment item data ready for creation
   * @static
   */
  static async collectEquipmentSelections(event, options = { includeClass: true, includeBackground: true }) {
    return EquipmentParser.collectEquipmentSelections(event, options);
  }

  /**
   * Main form submission handler for character creation
   * Validates input, creates actor, and applies advancements
   * @param {Event} event - The form submission event
   * @param {HTMLFormElement} form - The form element
   * @param {FormDataExtended} formData - The processed form data
   * @returns {Promise<void>}
   * @static
   */
  static async formHandler(event, form, formData) {
    try {
      const mandatoryFields = game.settings.get(HM.CONFIG.ID, 'mandatoryFields') || [];

      // Check mandatory fields
      const missingFields = mandatoryFields.filter((field) => {
        const value = formData.object[field];
        return !value || value.trim() === '';
      });

      if (missingFields.length > 0) {
        ui.notifications.error(
          game.i18n.format('hm.errors.missing-mandatory-fields', {
            fields: missingFields.join(', ')
          })
        );
        return;
      }

      HM.log(3, 'FORMHANDLER:', { event: event, form: form, formData: formData });

      // Process "Save for Later" action
      if (event.submitter?.dataset.action === 'saveOptions') {
        try {
          await SavedOptions.saveOptions(formData.object);
          ui.notifications.info('hm.app.optionsSaved', { localize: true });
        } catch (error) {
          HM.log(1, 'Error saving options:', error);
          ui.notifications.error('hm.errors.save-options-failed', { localize: true });
        }
        return;
      }

      HM.log(3, 'Processing form data...');
      HM.log(3, formData);

      // Check if using starting wealth
      const useStartingWealth = formData.object['use-starting-wealth'];
      const startingWealth = useStartingWealth ? await EquipmentParser.convertWealthStringToCurrency(formData.object) : null;

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

              try {
                if (currentManager) await currentManager.close();
              } catch (error) {
                HM.log(1, 'Error closing manager:', error);
              }

              newActor.sheet.render(true);
              return;
            }

            HM.log(3, `Processing ${items[itemIndex].name}`);

            return new Promise((resolve) => {
              // Set up a timeout to handle stuck advancement process
              const timeoutId = setTimeout(() => {
                HM.log(1, `Advancement process timeout for ${items[itemIndex].name}`);
                ui.notifications.warn(
                  game.i18n.format('hm.warnings.advancement-timeout', {
                    item: items[itemIndex].name
                  })
                );

                // Try to move to next item
                if (currentManager) {
                  try {
                    currentManager.close().catch((err) => HM.log(1, 'Error closing timed out manager:', err));
                  } catch (error) {
                    HM.log(1, 'Error closing timed out manager:', error);
                  }
                  currentManager = null;
                }

                if (itemIndex + 1 < items.length) {
                  createAdvancementManager(items[itemIndex + 1])
                    .then((manager) => {
                      currentManager = manager;
                      manager.render(true);
                      doAdvancement(itemIndex + 1).then(resolve);
                    })
                    .catch((error) => {
                      HM.log(1, `Error creating manager after timeout for ${items[itemIndex + 1].name}:`, error);
                      newActor.sheet.render(true);
                      resolve();
                    });
                } else {
                  newActor.sheet.render(true);
                  resolve();
                }
              }, HeroMancer.ADVANCEMENT_DELAY.renderTimeout * 2);

              Hooks.once('dnd5e.advancementManagerComplete', async () => {
                clearTimeout(timeoutId);
                HM.log(3, `Completed ${items[itemIndex].name}`);

                await new Promise((resolve) => {
                  setTimeout(() => {
                    resolve();
                  }, HeroMancer.ADVANCEMENT_DELAY.transitionDelay);
                });

                currentManager = null;

                if (itemIndex + 1 < items.length) {
                  try {
                    currentManager = await createAdvancementManager(items[itemIndex + 1]);
                    currentManager.render(true);
                    await doAdvancement(itemIndex + 1);
                    resolve();
                  } catch (error) {
                    HM.log(1, `Error creating manager for ${items[itemIndex + 1].name}:`, error);
                    ui.notifications.warn(
                      game.i18n.format('hm.warnings.advancement-failed', {
                        item: items[itemIndex + 1].name
                      })
                    );
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
          ui.notifications.error(game.i18n.localize('hm.errors.advancement-process'));
          if (currentManager) {
            try {
              await currentManager.close();
            } catch (closeError) {
              HM.log(1, 'Error closing manager after error:', closeError);
            }
          }
          newActor.sheet.render(true);
        }

        try {
          await ChatMessage.create({
            speaker: ChatMessage.getSpeaker(),
            content: SummaryManager.generateCharacterSummaryChatMessage(),
            flags: {
              'hero-mancer': {
                type: 'character-summary'
              }
            }
          });
        } catch (error) {
          HM.log(1, 'Error creating summary chat message:', error);
        }
      }
    } catch (error) {
      HM.log(1, 'Error in form submission:', error);
      ui.notifications.error('hm.errors.form-submission', { localize: true });
    }
  }

  /* -------------------------------------------- */
  /*  Static Private Methods                      */
  /* -------------------------------------------- */

  /**
   * Transforms form data into a token configuration object
   * @param {object} formData - The form data containing token configuration settings
   * @returns {object} A token data object compatible with Foundry VTT's token system
   * @private
   * @static
   */
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
        // Display settings
        if (formData.displayName) tokenData.displayName = parseInt(formData.displayName);
        if (formData.displayBars) tokenData.displayBars = parseInt(formData.displayBars);

        // Bar settings
        tokenData.bar1 = { attribute: formData['bar1.attribute'] || null };
        tokenData.bar2 = { attribute: formData['bar2.attribute'] || null };

        // Ring settings
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

  /**
   * Calculates token ring effects based on selected effect options
   * @param {string[]} effectsArray - Array of effect names to be applied
   * @returns {number} A bitwise flag representing the combined effects
   * @private
   * @static
   */
  static #calculateRingEffects(effectsArray) {
    const TRE = CONFIG.Token.ring.ringClass.effects;
    let effects = TRE.ENABLED;

    if (!effectsArray?.length) return TRE.DISABLED;

    effectsArray.forEach((effect) => {
      if (effect && TRE[effect]) effects |= TRE[effect];
    });

    return effects;
  }

  /**
   * Generates a random color from a predefined list of visually distinct, easy-to-see colors
   * @returns {string} A hex color code string (e.g. '#FF5733')
   * @private
   * @static
   */
  static #randomSafeColor() {
    // Pre-defined list of visually distinct, easy-to-see colors
    const safeColorList = [
      '#FF5733', // Bright orange-red
      '#33FF57', // Bright green
      '#3357FF', // Bright blue
      '#FF33F5', // Bright pink
      '#F5FF33', // Bright yellow
      '#33FFF5', // Bright cyan
      '#9D33FF', // Bright purple
      '#FF9D33' // Bright amber
    ];

    // Randomly select a color from the list
    return safeColorList[Math.floor(Math.random() * safeColorList.length)];
  }
}
