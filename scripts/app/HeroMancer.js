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

  static ORIGINAL_PLAYER_COLORS = new Map();

  /** @override */
  static DEFAULT_OPTIONS = {
    id: `${HM.ID}-app`,
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
      nosubmit: HeroMancer.noSubmit
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
    header: { template: 'modules/hero-mancer/templates/app-header.hbs', classes: ['hm-app-header'] },
    tabs: { template: 'modules/hero-mancer/templates/app-nav.hbs', classes: ['hm-app-nav'] },
    start: { template: 'modules/hero-mancer/templates/tab-start.hbs', classes: ['hm-app-tab-content'] },
    background: { template: 'modules/hero-mancer/templates/tab-background.hbs', classes: ['hm-app-tab-content'] },
    race: { template: 'modules/hero-mancer/templates/tab-race.hbs', classes: ['hm-app-tab-content'] },
    class: { template: 'modules/hero-mancer/templates/tab-class.hbs', classes: ['hm-app-tab-content'] },
    abilities: { template: 'modules/hero-mancer/templates/tab-abilities.hbs', classes: ['hm-app-tab-content'] },
    equipment: { template: 'modules/hero-mancer/templates/tab-equipment.hbs', classes: ['hm-app-tab-content'] },
    finalize: { template: 'modules/hero-mancer/templates/tab-finalize.hbs', classes: ['hm-app-tab-content'] },
    footer: { template: 'modules/hero-mancer/templates/app-footer.hbs', classes: ['hm-app-footer'] }
  };

  static ADVANCEMENT_DELAY = { transitionDelay: 1000, renderTimeout: 5000, retryAttempts: 3 };

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
    return `${HM.NAME} | ${game.user.name}`;
  }

  /* -------------------------------------------- */
  /*  Protected Methods                           */
  /* -------------------------------------------- */

  /**
   * Prepares the main context data for the character creation application
   * Initializes abilities, processes compatibility settings, and prepares all tab data
   * @async
   * @param {object} options - Application render options
   * @returns {Promise<object>} Complete context for character creation rendering
   * @protected
   * @override
   */
  async _prepareContext(options) {
    if (!HM.documents.race || !HM.documents.class || !HM.documents.background) {
      ui.notifications.info('hm.actortab-button.loading', { localize: true });
    }

    game.users.forEach((user) => {
      HeroMancer.ORIGINAL_PLAYER_COLORS.set(user.id, user.color.css);
    });

    // Initialize abilities and related data
    const abilitiesCount = Object.keys(CONFIG.DND5E.abilities).length;
    HeroMancer.selectedAbilities = Array(abilitiesCount).fill(HM.ABILITY_SCORES.DEFAULT);

    // Handle ELKAN compatibility
    if (HM.COMPAT?.ELKAN) {
      options.parts = options.parts.filter((part) => part !== 'equipment');
    }

    // Get dice rolling method once and reuse it
    const diceRollMethod = this.#getDiceRollingMethod();

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
      allowedMethods: game.settings.get(HM.ID, 'allowedMethods'),
      standardArray: this.#getStandardArrayValues(diceRollMethod),
      selectedAbilities: HeroMancer.selectedAbilities,
      remainingPoints: Listeners.updateRemainingPointsDisplay(HeroMancer.selectedAbilities),
      totalPoints: StatRoller.getTotalPoints(),
      playerCustomizationEnabled: game.settings.get(HM.ID, 'enablePlayerCustomization'),
      tokenCustomizationEnabled: game.settings.get(HM.ID, 'enableTokenCustomization'),
      token: this.#getTokenConfig(),
      mandatoryFields: game.settings.get(HM.ID, 'mandatoryFields'),
      isGM: game.user.isGM,
      players: game.users.map((user) => ({
        id: user.id,
        name: user.name,
        color: user.color.css
      })),
      chainedRolls: game.settings.get(HM.ID, 'chainedRolls')
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
              .get(HM.ID, 'alignments')
              .split(',')
              .map((d) => d.trim()) || [];
          context.deities =
            game.settings
              .get(HM.ID, 'deities')
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

      Listeners.initializeListeners(this.element, context, HeroMancer.selectedAbilities);

      // Initial check of mandatory fields
      await MandatoryFields.checkMandatoryFields(this.element);

      // Now initialize form validation listeners after the initial check
      Listeners.initializeFormValidationListeners(this.element);

      // Store original colors
      const playerElement = this.element?.querySelector('#player-assignment');

      // Add player dropdown change handler for GMs
      if (game.user.isGM && playerElement) {
        playerElement.addEventListener('change', (event) => {
          const playerId = event.currentTarget.value;
          const targetUser = HeroMancer.#getTargetUser(playerId);

          // Update color picker with the selected user's color
          const colorPicker = this.element.querySelector('#player-color');
          if (colorPicker) {
            // Use the original color for the user instead of generating a new one
            colorPicker.value = HeroMancer.ORIGINAL_PLAYER_COLORS.get(playerId);
          }
        });
      }
      SummaryManager.initializeSummaryListeners();
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
    this.completionPercentage = ProgressBar.calculateAndUpdateProgress(this.element, form);
  }

  /**
   * Actions to perform when the application is closed
   * Cleans up resources and references
   * @returns {Promise<void>}
   * @protected
   * @override
   */
  _onClose() {
    HM.log(3, 'Closing application.');
    HeroMancer.cleanupEventListeners(this);
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
      currentScore: HM.ABILITY_SCORES.DEFAULT
    }));
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
    let diceRollingMethod = game.settings.get(HM.ID, 'diceRollingMethod');
    HM.log(3, 'Initial dice rolling method:', diceRollingMethod);

    // Get the allowed methods configuration
    const allowedMethods = game.settings.get(HM.ID, 'allowedMethods');

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
      const previousMethod = diceRollingMethod || 'none';
      diceRollingMethod = validMethods[0];
      HM.log(3, `Invalid dice rolling method '${previousMethod}' - falling back to '${diceRollingMethod}'`);
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
    const { MIN, MAX } = HM.ABILITY_SCORES;

    // Use provided method or get it if not provided
    const method = diceRollingMethod || this.#getDiceRollingMethod();

    if (method === 'standardArray') {
      const customArray = game.settings.get(HM.ID, 'customStandardArray');
      if (customArray) {
        const parsedArray = customArray.split(',').map(Number);
        // Check if the custom array has enough values for all abilities
        if (parsedArray.length >= abilitiesCount) {
          // Ensure all values are within min/max
          return parsedArray.map((val) => Math.max(MIN, Math.min(MAX, val)));
        }
      }
    }

    const standardArray = StatRoller.getStandardArray(extraAbilities);
    // Ensure all values are within min/max
    return standardArray.map((val) => Math.max(MIN, Math.min(MAX, val)));
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
    await game.user.setFlag(HM.ID, SavedOptions.FLAG, null);

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

  /**
   * Rolls an ability score using the configured dice rolling method
   * @param {Event} _event - The triggering event
   * @param {HTMLElement} form - The form element containing ability score data
   * @returns {Promise<void>}
   * @static
   */
  static async rollStat(_event, form) {
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
  static cleanupEventListeners(instance) {
    try {
      const html = instance.element;
      if (!html) {
        return;
      }

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
        }
      } catch (error) {
        HM.log(1, 'Error cleaning up ability blocks:', error);
        cleanupIssues.push('ability blocks');
      }

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

  static async noSubmit(event, options) {
    for (const [userId, originalColor] of HeroMancer.ORIGINAL_PLAYER_COLORS.entries()) {
      const user = game.users.get(userId);
      if (user) {
        await user.update({
          color: originalColor
        });
      }
    }
    // Clear the map for next time
    HeroMancer.ORIGINAL_PLAYER_COLORS.clear();
    if (event.target.className === 'hm-app-footer-cancel') {
      await this.close('Closing via noSubmit', options);
    }
  }

  async close(message = '', options = {}) {
    if (message) HM.log(2, message);
    return super.close(options);
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
    const targetUserId = game.user.isGM ? formData.object.player : null;
    const targetUser = HeroMancer.#getTargetUser(targetUserId);

    // Process "Save for Later" action
    if (event.submitter?.dataset.action === 'saveOptions') {
      try {
        await HeroMancer.noSubmit(event);
        await SavedOptions.saveOptions(formData.object);
        ui.notifications.info('hm.app.optionsSaved', { localize: true });
      } catch (error) {
        HM.log(1, 'Error saving options:', error);
        ui.notifications.error('hm.errors.save-options-failed', { localize: true });
      }
      return;
    }
    try {
      const mandatoryFields = game.settings.get(HM.ID, 'mandatoryFields') || [];

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

      // Check if using starting wealth
      const useClassWealth = formData.object['use-starting-wealth-class'];
      const useBackgroundWealth = formData.object['use-starting-wealth-background'];
      const useStartingWealth = useClassWealth || useBackgroundWealth;

      HM.log(3, 'Starting wealth checks:', { class: useClassWealth, background: useBackgroundWealth });

      const startingWealth = useStartingWealth ? await EquipmentParser.convertWealthStringToCurrency(formData.object) : null;
      HM.log(3, 'The starting wealth amount is:', startingWealth);

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
            HM.log(3, `Missing field: ${property}`);
          }
        }
      } catch (err) {
        HM.log(1, err);
      }

      // Extract itemId and packId from the formData
      const extractIds = (itemString) => {
        // Extract the ID (everything before first space or bracket)
        const idMatch = itemString.match(/^([^\s[]+)/);
        const itemId = idMatch ? idMatch[1] : null;

        // Extract the UUID (content inside square brackets)
        const uuidMatch = itemString.match(/\[(.*?)]/);
        const uuid = uuidMatch ? uuidMatch[1] : null;

        // Extract packId from parentheses if available, or from UUID
        let packId = null;
        const packMatch = itemString.match(/\(([^)]+)\)/);
        if (packMatch) {
          packId = packMatch[1];
        } else if (uuid && uuid.startsWith('Compendium.')) {
          // Extract packId between "Compendium." and ".Item"
          const parts = uuid.split('.');
          if (parts.length >= 4 && parts[3] === 'Item') {
            packId = `${parts[1]}.${parts[2]}`;
          }
        }

        HM.log(3, { itemString, itemId, packId, uuid });
        return itemId ? { itemId, packId, uuid } : null;
      };

      const backgroundData = extractIds(formData.object.background);
      const raceData = extractIds(formData.object.race);
      const classData = extractIds(formData.object.class);

      let abilities = {};

      for (const key in formData.object) {
        const abilityMatch = key.match(/^abilities\[(\w+)]\.score$/) || key.match(/^abilities\[(\w+)]$/);
        if (abilityMatch) {
          const abilityKey = abilityMatch[1];
          abilities[abilityKey] = formData.object[key] || 10;
        }
      }

      // Create the new actor
      let actorName = formData.object.name || targetUser.name;
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

      // Set ownership appropriately when character is created by GM
      if (game.user.isGM && targetUserId) {
        actorData.ownership = {
          default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE,
          [game.user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
          [targetUserId]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
        };
      }

      ui.notifications.info('hm.actortab-button.creating', { localize: true });
      let actor = await Actor.create(actorData);
      HM.log(3, 'Created Actor:', actor);

      // Declare the items outside the try block
      let backgroundItem, raceItem, classItem;

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

      try {
        // Fetch documents after confirming all selections are valid
        backgroundItem = await game.packs.get(backgroundData.packId)?.getDocument(backgroundData.itemId);
        raceItem = await game.packs.get(raceData.packId)?.getDocument(raceData.itemId);
        classItem = await game.packs.get(classData.packId)?.getDocument(classData.itemId);

        // Show specific errors for missing documents
        if (!backgroundItem) {
          ui.notifications.error('hm.errors.no-background', { localize: true });
          return;
        }
        if (!raceItem) {
          ui.notifications.error('hm.errors.no-race', { localize: true });
          return;
        }
        if (!classItem) {
          ui.notifications.error('hm.errors.no-class', { localize: true });
          return;
        }
      } catch (error) {
        // This now only catches actual exceptions in the API calls
        HM.log(1, error);
        ui.notifications.error('hm.errors.fetch-fail', { localize: true });
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
        let createdItems = [];
        if (equipmentItems.length) {
          createdItems = await actor.createEmbeddedDocuments('Item', equipmentItems, { keepId: true });
        }

        // Process favorites
        try {
          HM.log(3, 'Starting favorites processing');

          // Find all favorited checkboxes
          const favoriteCheckboxes = event.target.querySelectorAll('.equipment-favorite-checkbox:checked');
          HM.log(3, `Found ${favoriteCheckboxes.length} favorited checkboxes`);

          if (favoriteCheckboxes.length > 0) {
            // Get current actor favorites
            const currentActorFavorites = actor.system.favorites || [];
            const newFavorites = [];

            for (const checkbox of favoriteCheckboxes) {
              const itemName = checkbox.dataset.itemName;
              let itemUuids = [];

              // Get UUIDs from the appropriate attribute
              if (checkbox.dataset.itemUuids) {
                itemUuids = checkbox.dataset.itemUuids.split(',');
              } else if (checkbox.id && checkbox.id.includes(',')) {
                // For combined items that have comma-separated UUIDs in ID
                itemUuids = checkbox.id.split(',');
              } else if (checkbox.dataset.itemId) {
                // Legacy approach
                itemUuids = [checkbox.dataset.itemId];
              } else {
                HM.log(2, `No UUIDs or itemId found for "${itemName}"`);
                continue;
              }

              let processedAnyItem = false;

              // Process each UUID
              for (const uuid of itemUuids) {
                try {
                  // For full UUIDs, look up the item directly
                  if (uuid.startsWith('Compendium.')) {
                    const sourceItem = await fromUuid(uuid);
                    if (!sourceItem) {
                      HM.log(3, `Could not resolve UUID: ${uuid}`);
                      continue;
                    }

                    // Find the created item in the actor's inventory
                    const matchedItem = createdItems.find(
                      (item) =>
                        // Match by name
                        item.name === sourceItem.name ||
                        // Match by source ID if available
                        (item.flags?.core?.sourceId && item.flags.core.sourceId.includes(sourceItem.id))
                    );

                    if (matchedItem) {
                      const favoriteEntry = {
                        type: 'item',
                        id: `.Item.${matchedItem.id}`,
                        sort: 100000 + newFavorites.length
                      };

                      newFavorites.push(favoriteEntry);
                      processedAnyItem = true;
                    } else {
                      HM.log(2, `Could not find created item for ${sourceItem.name}`);
                    }
                  }
                  // For legacy itemId, try to match directly
                  else {
                    const itemId = uuid;

                    // Try to find by item name match (for combined items)
                    let matchedItems = [];

                    if (itemName.includes('Dagger')) {
                      matchedItems = createdItems.filter((item) => item.name === 'Dagger');
                    } else if (itemName.includes('Pouch')) {
                      matchedItems = createdItems.filter((item) => item.name === 'Pouch');
                    } else {
                      // Try direct match
                      matchedItems = createdItems.filter((item) => item.id === itemId || (item.flags?.core?.sourceId && item.flags.core.sourceId.includes(itemId)));
                    }

                    for (const matchedItem of matchedItems) {
                      const favoriteEntry = {
                        type: 'item',
                        id: `.Item.${matchedItem.id}`,
                        sort: 100000 + newFavorites.length
                      };

                      newFavorites.push(favoriteEntry);
                      processedAnyItem = true;
                    }
                  }
                } catch (error) {
                  HM.log(2, `Error processing UUID ${uuid}:`, error);
                }
              }

              if (!processedAnyItem) {
                HM.log(2, `Could not process any items for "${itemName}"`);
              }
            }

            if (newFavorites.length > 0) {
              // Combine with existing favorites (avoiding duplicates)
              const combinedFavorites = [...currentActorFavorites];

              for (const newFav of newFavorites) {
                if (!combinedFavorites.some((fav) => fav.id === newFav.id)) {
                  combinedFavorites.push(newFav);
                }
              }

              // Update actor's favorites
              await actor.update({
                'system.favorites': combinedFavorites
              });

              HM.log(3, 'Successfully updated actor favorites');
            }
          }
        } catch (error) {
          HM.log(1, 'Error processing favorites:', error);
        }

        if (startingWealth) {
          await actor.update({
            system: {
              currency: startingWealth
            }
          });
        }

        // Then let advancement manager handle race/background
        await processAdvancements([classItem, raceItem, backgroundItem], actor);
        if (game.user.isGM && formData.object.player && formData.object.player !== game.user.id) {
          try {
            await game.users.get(formData.object.player).update({ character: actor.id });
            HM.log(3, `Character assigned to player: ${game.users.get(formData.object.player).name}`);
          } catch (error) {
            HM.log(1, 'Error assigning character to player:', error);
          }
        } else {
          // Set as active character for the target user
          await targetUser.update({ character: actor.id });
        }
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

        // Process items with and without advancements differently
        const itemsWithoutAdvancements = [];
        const itemsWithAdvancements = [];

        // Sort items based on whether they have advancements
        for (const item of items) {
          const hasAdvancements = item.advancement?.byId && Object.keys(item.advancement.byId).length > 0;
          if (hasAdvancements) {
            itemsWithAdvancements.push(item);
          } else {
            itemsWithoutAdvancements.push(item);
            HM.log(3, `Adding ${item.name} directly - no advancements needed`);
          }
        }

        // If no items with advancements, we're done
        if (!itemsWithAdvancements.length) {
          HM.log(2, 'No items with advancements to process');
          newActor.sheet.render(true);
          return;
        }

        // Process items with advancements - rest of your existing code
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
          currentManager = await createAdvancementManager(itemsWithAdvancements[0]);

          /**
           * Recursively processes advancements for each item in the list.
           * @function doAdvancement
           * @param {number} [itemIndex=0] The index of the current item being processed.
           * @returns {Promise<void>} A promise that resolves when processing is complete.
           */
          async function doAdvancement(itemIndex = 0) {
            HM.log(3, itemsWithAdvancements);
            if (itemIndex >= itemsWithAdvancements.length) {
              try {
                if (currentManager) await currentManager.close();
              } catch (error) {
                HM.log(1, 'Error closing manager:', error);
              }

              newActor.sheet.render(true);
              return;
            }

            HM.log(3, `Processing ${itemsWithAdvancements[itemIndex].name}`);

            return new Promise((resolve) => {
              Hooks.once('dnd5e.advancementManagerComplete', async () => {
                HM.log(3, `Completed ${itemsWithAdvancements[itemIndex].name}`);

                await new Promise((resolve) => {
                  setTimeout(() => {
                    resolve();
                  }, HeroMancer.ADVANCEMENT_DELAY.transitionDelay);
                });

                currentManager = null;

                if (itemIndex + 1 < itemsWithAdvancements.length) {
                  try {
                    currentManager = await createAdvancementManager(itemsWithAdvancements[itemIndex + 1]);
                    currentManager.render(true);
                    await doAdvancement(itemIndex + 1);
                    resolve();
                  } catch (error) {
                    HM.log(1, `Error creating manager for ${itemsWithAdvancements[itemIndex + 1].name}:`, error);
                    ui.notifications.warn(
                      game.i18n.format('hm.warnings.advancement-failed', {
                        item: itemsWithAdvancements[itemIndex + 1].name
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
          // Create items without advancements directly
          if (itemsWithoutAdvancements.length > 0) {
            try {
              HM.log(
                2,
                `Attempting to add ${itemsWithoutAdvancements.length} items without advancements:`,
                itemsWithoutAdvancements.map((item) => item.name)
              );

              const itemData = itemsWithoutAdvancements.map((item) => {
                const obj = item.toObject();
                HM.log(3, `Item data for ${item.name}:`, obj);
                return obj;
              });

              const created = await newActor.createEmbeddedDocuments('Item', itemData);
              HM.log(
                2,
                `Successfully added ${created.length} items:`,
                created.map((i) => i)
              );
            } catch (error) {
              HM.log(1, 'Error adding items without advancements:', error);
              ui.notifications.error(`Failed to add items: ${error.message}`);
            }
          }
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

    if (game.settings.get(HM.ID, 'enablePlayerCustomization')) {
      try {
        await targetUser.update({
          color: formData.object['player-color'],
          pronouns: formData.object['player-pronouns'],
          avatar: formData.object['player-avatar']
        });

        // Restore colors for all other users in ORIGINAL_PLAYER_COLORS
        for (const [userId, originalColor] of HeroMancer.ORIGINAL_PLAYER_COLORS.entries()) {
          if (userId !== targetUser.id) {
            const user = game.users.get(userId);
            if (user) {
              await user.update({
                color: originalColor
              });
            }
          }
        }
      } catch (error) {
        HM.log(1, `Error updating user ${targetUser.name}:`, error);
      }
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
      if (game.settings.get(HM.ID, 'enableTokenCustomization')) {
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
   * Gets a user by ID from the form data or defaults to current user
   * @param {string|null} userId - User ID to get
   * @returns {User} The target user object
   * @static
   */
  static #getTargetUser(userId = null) {
    const targetUser = game.user.isGM && userId && game.users.has(userId) ? game.users.get(userId) : game.user;
    return targetUser;
  }
}
