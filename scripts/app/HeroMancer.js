/* eslint-disable indent */
import { HM } from '../hero-mancer.js';
import { CacheManager, DropdownHandler, EquipmentParser, Listeners, StatRoller, SavedOptions, SummaryManager } from '../utils/index.js';
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class HeroMancer extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
  }

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
      selectCharacterArt: this.selectCharacterArt,
      selectTokenArt: this.selectTokenArt,
      selectPlayerAvatar: this.selectPlayerAvatar,
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

  /* Getter to set the title of the application. */
  get title() {
    return `${HM.CONFIG.TITLE} | ${game.user.name}`;
  }

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

  /** @override */
  async _prepareContext(options) {
    const abilitiesCount = Object.keys(CONFIG.DND5E.abilities).length;
    HeroMancer.selectedAbilities = Array(abilitiesCount).fill(8);
    const extraAbilities = abilitiesCount > 6 ? abilitiesCount - 6 : 0;

    // Add available roll methods
    const rollMethods = {
      pointBuy: game.i18n.localize('hm.app.abilities.methods.pointBuy'),
      standardArray: game.i18n.localize('hm.app.abilities.methods.standardArray'),
      manualFormula: game.i18n.localize('hm.app.abilities.methods.manual')
    };

    const diceRollingMethod = game.settings.get(HM.CONFIG.ID, 'diceRollingMethod');
    const standardArray =
      diceRollingMethod === 'standardArray' ? game.settings.get(HM.CONFIG.ID, 'customStandardArray').split(',').map(Number) : StatRoller.getStandardArray(extraAbilities);

    const totalPoints = StatRoller.getTotalPoints();
    const remainingPoints = Listeners.updateRemainingPointsDisplay(HeroMancer.selectedAbilities);
    const abilities = Object.entries(CONFIG.DND5E.abilities).map(([key, value]) => ({
      key,
      abbreviation: value.abbreviation.toUpperCase(),
      fullKey: value.fullKey.toUpperCase(),
      currentScore: 8
    }));

    HM.log(3, 'ABILITIES:', abilities);

    const cacheManager = new CacheManager();

    if (HM.COMPAT?.ELKAN) {
      options.parts = options.parts.filter((part) => part !== 'equipment');
    }

    const trackedAttrs = TokenDocument.implementation._getConfiguredTrackedAttributes('character');
    const token = {
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

    // Check if cached data is available to avoid re-fetching
    if (cacheManager.isCacheValid()) {
      HM.log(3, 'Documents cached and descriptions enriched!');
      return {
        raceDocs: HM.documents.race || cacheManager.getCachedDocs('race'),
        classDocs: HM.documents.class || cacheManager.getCachedDocs('class'),
        backgroundDocs: HM.documents.background || cacheManager.getCachedDocs('background'),
        tabs: this._getTabs(options.parts),
        abilities,
        rollStat: this.rollStat,
        rollMethods,
        diceRollMethod: diceRollingMethod,
        allowedMethods: game.settings.get(HM.CONFIG.ID, 'allowedMethods'),
        standardArray: standardArray,
        selectedAbilities: HeroMancer.selectedAbilities,
        remainingPoints,
        totalPoints,
        playerCustomizationEnabled: game.settings.get(HM.CONFIG.ID, 'enablePlayerCustomization'),
        tokenCustomizationEnabled: game.settings.get(HM.CONFIG.ID, 'enableTokenCustomization'),
        token: token
      };
    }

    ui.notifications.info('hm.actortab-button.loading', { localize: true });

    const context = {
      raceDocs: HM.documents.race || cacheManager.getCachedRaceDocs(),
      classDocs: HM.documents.class || cacheManager.getCachedClassDocs(),
      backgroundDocs: HM.documents.background || cacheManager.getCachedBackgroundDocs(),
      tabs: this._getTabs(options.parts),
      abilities,
      rollStat: this.rollStat,
      rollMethods,
      diceRollMethod: diceRollingMethod,
      allowedMethods: game.settings.get(HM.CONFIG.ID, 'allowedMethods'),
      standardArray: standardArray,
      selectedAbilities: HeroMancer.selectedAbilities,
      remainingPoints,
      totalPoints,
      playerCustomizationEnabled: game.settings.get(HM.CONFIG.ID, 'enablePlayerCustomization'),
      tokenCustomizationEnabled: game.settings.get(HM.CONFIG.ID, 'enableTokenCustomization'),
      token: token
    };

    const allDocs = [
      ...(context.raceDocs?.flatMap((folder) => folder.docs) || []),
      ...(context.classDocs?.flatMap((pack) => pack.docs) || []),
      ...(context.backgroundDocs?.flatMap((pack) => pack.docs) || [])
    ];
    for (const doc of allDocs) {
      if (doc?.description) {
        try {
          // Enrich description
          HM.log(3, `Enriching description for '${doc.name}'...`, doc);
          doc.enrichedDescription = await TextEditor.enrichHTML(doc.description);
        } catch (error) {
          HM.log(1, `${HM.CONFIG.ID} | Error enriching description or processing starting equipment for '${doc.name}':`, error);
        }
      }
    }

    cacheManager.cacheDocuments({
      raceDocs: context.raceDocs,
      classDocs: context.classDocs,
      backgroundDocs: context.backgroundDocs
    });

    HM.log(3, 'Documents registered and enriched, caching results.');
    HM.log(3, 'Tabs Data:', this.tabsData);
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
        const totalPoints = StatRoller.getTotalPoints();
        const pointsSpent = StatRoller.calculatePointsSpent(HeroMancer.selectedAbilities);
        const remainingPoints = totalPoints - pointsSpent;
        context.totalPoints = totalPoints;
        context.remainingPoints = remainingPoints;
        break;
      case 'equipment':
        context.tab = context.tabs[partId];
        break;
      case 'finalize':
        context.tab = context.tabs[partId];
        context.alignments = game.settings
          .get(HM.CONFIG.ID, 'alignments')
          ?.split(',')
          .map((d) => d.trim()) || ['None'];
        context.deities = game.settings
          .get(HM.CONFIG.ID, 'deities')
          ?.split(',')
          .map((d) => d.trim()) || ['None'];
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
    const html = this.element;
    HM.log(3, 'RESTORE: Root element:', html);

    const savedOptions = await SavedOptions.loadOptions();

    // Initialize all UI components in sequence
    DropdownHandler.initializeDropdown({ type: 'class', html, context });
    DropdownHandler.initializeDropdown({ type: 'race', html, context });
    DropdownHandler.initializeDropdown({ type: 'background', html, context });

    // Initialize remaining listeners after dropdowns
    SummaryManager.initializeSummaryListeners();
    Listeners.initializeListeners(html, context, HeroMancer.selectedAbilities);

    // Handle saved options restoration
    if (Object.keys(savedOptions).length > 0) {
      for (const [key, value] of Object.entries(savedOptions)) {
        const selector = `[name="${key}"]`;
        HM.log(3, `RESTORE: Looking for selector "${selector}" in:`, html);
        const elem = html.querySelector(selector);
        HM.log(3, `RESTORE: Found element for ${key}:`, elem);

        if (!elem) continue;

        if (elem.type === 'checkbox') {
          elem.checked = value;
        } else if (elem.tagName === 'SELECT') {
          elem.value = value;
          elem.dispatchEvent(new Event('change'));
          SummaryManager.updateClassRaceSummary();
        } else {
          elem.value = value;
        }
      }
    }
  }

  _onClose() {
    HM.log(3, 'Closing application.');
    if (this._cleanup) {
      this._cleanup();
    }
    super._onClose();
  }

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

  /**
   * Action to open the FilePicker for selecting character art
   * TODO: Convert FilePicker to AppV2 for V13 release (https://github.com/foundryvtt/foundryvtt/issues/11348)
   * @param {PointerEvent} event The originating click event
   * @param {HTMLElement} target The element that triggered the event
   */
  static async selectCharacterArt(event, target) {
    const inputField = document.getElementById('character-art-path');
    const currentPath = inputField.value || '/';
    const portraitImg = document.querySelector('.character-portrait img');

    const filepicker = new FilePicker({
      type: 'image',
      current: currentPath,
      callback: (path) => {
        inputField.value = path;
        if (portraitImg) {
          portraitImg.src = path;
        }
        if (document.getElementById('link-token-art').checked) {
          document.getElementById('token-art-path').value = path;
        }
      }
    });
    filepicker.render(true);
  }

  static async selectTokenArt(event, target) {
    const inputField = document.getElementById('token-art-path');
    const currentPath = inputField.value || '/';

    const filepicker = new FilePicker({
      type: 'image',
      current: currentPath,
      callback: (path) => {
        inputField.value = path;
      }
    });
    filepicker.render(true);
  }

  static async selectPlayerAvatar(event, target) {
    const inputField = document.getElementById('player-avatar-path');
    const currentPath = inputField.value || '/';

    const filepicker = new FilePicker({
      type: 'image',
      current: currentPath,
      callback: (path) => {
        inputField.value = path;
      }
    });
    filepicker.render(true);
  }

  /** Method to toggle Token Art row based on checkbox state */
  static _toggleTokenArtRow() {
    HM.log(3, 'Starting toggle!');
    const tokenArtRow = document.getElementById('token-art-row');
    const isLinked = document.getElementById('link-token-art').checked;
    tokenArtRow.style.display = isLinked ? 'none' : 'flex';
    HM.log(3, 'Continuing toggle!');
    // Clear Token Art path if linking is enabled
    if (isLinked) {
      document.getElementById('token-art-path').value = document.getElementById('character-art-path').value;
      HM.log(3, 'Finishing toggle!');
    }
  }

  static async collectEquipmentSelections(event, options = { includeClass: true, includeBackground: true }) {
    const equipment = [];
    const equipmentContainer = event.srcElement.querySelector('#equipment-container');
    if (!equipmentContainer) return equipment;

    /**
     * Searches for an item in the game's compendium packs by its UUID.
     * @async
     * @function findItemInPacks
     * @param {string} itemId The UUID of the item to search for.
     * @returns {Promise<object | null>} A promise that resolves to the full item document if found, or `null` if not found.
     */
    async function findItemInPacks(itemId) {
      HM.log(3, `Searching for item ID: ${itemId}`);
      const indexItem = fromUuidSync(itemId);
      if (indexItem) {
        const packId = indexItem.pack;
        const pack = game.packs.get(packId);
        if (pack) {
          const fullItem = await pack.getDocument(indexItem._id);
          HM.log(3, `Found full item ${itemId}`);
          return fullItem;
        }
      }
      HM.log(3, `Could not find item ${itemId} in any pack`);
      return null;
    }

    /**
     * Processes a container item by retrieving its full data from a compendium pack,
     * populating it with its contents, and adding it to the equipment list.
     * @async
     * @function processContainerItem
     * @param {object} containerItem The container item object to process.
     * @param {string} containerItem.pack The ID of the compendium pack containing the container item.
     * @param {string} containerItem._id The unique identifier of the container item in the pack.
     * @param {number} quantity The quantity of the container item to set.
     * @returns {Promise<void>} A promise that resolves when the container item has been processed.
     *
     * @throws Will log an error if there is an issue processing the container or its contents.
     *
     */
    async function processContainerItem(containerItem, quantity) {
      const packId = containerItem.pack;
      const pack = game.packs.get(packId);

      if (pack) {
        const fullContainer = await pack.getDocument(containerItem._id);
        if (fullContainer) {
          /* Somewhere here, we should be setting fullContainer.system.contents to containerData */
          /* so that when the container is in the sheet it has contents === to the objects of the contents inside. */
          try {
            const containerData = await CONFIG.Item.documentClass.createWithContents([fullContainer], {
              keepId: true,
              transformAll: async (doc) => {
                const transformed = doc.toObject();
                if (doc.id === fullContainer.id) {
                  transformed.system = transformed.system || {};
                  transformed.system.quantity = quantity;
                  transformed.system.currency = fullContainer.system?.currency;
                  transformed.system.equipped = true;
                }
                return transformed;
              }
            });

            if (containerData?.length) {
              equipment.push(...containerData);
              HM.log(3, `Added container ${fullContainer.name} and its contents to equipment`);
            }
          } catch (error) {
            HM.log(1, `Error processing container ${fullContainer.name}:`, error);
          }
        }
      }
    }

    const equipmentSections = equipmentContainer.querySelectorAll('.equipment-choices > div');

    for (const section of equipmentSections) {
      // Check if we should process this section based on its class
      if (section.classList.contains('class-equipment-section') && !options.includeClass) {
        continue;
      }
      if (section.classList.contains('background-equipment-section') && !options.includeBackground) {
        continue;
      }

      HM.log(3, 'Processing new section');

      // Process dropdowns
      const dropdowns = section.querySelectorAll('select');
      HM.log(3, `Found ${dropdowns.length} dropdowns in section`);

      for (const dropdown of dropdowns) {
        const value = dropdown.value || document.getElementById(`${dropdown.id}-default`)?.value;
        HM.log(3, `Processing dropdown ${dropdown.id} with value: ${value}`);

        if (!value) {
          HM.log(3, `No value for dropdown ${dropdown.id}, skipping`);
          continue;
        }

        const item = await findItemInPacks(value);
        if (item) {
          const selectedOption = dropdown.querySelector(`option[value="${value}"]`);
          const optionText = selectedOption?.textContent || '';

          const startQuantityMatch = optionText.match(/^(\d+)\s+(.+)$/i);
          const endQuantityMatch = optionText.match(/(.+)\s+\((\d+)\)$/i);
          const midQuantityMatch = optionText.match(/(.+?)\s+x(\d+)/i);

          let quantity = 1;
          if (startQuantityMatch) quantity = parseInt(startQuantityMatch[1]);
          else if (endQuantityMatch) quantity = parseInt(endQuantityMatch[2]);
          else if (midQuantityMatch) quantity = parseInt(midQuantityMatch[2]);

          HM.log(3, `Detected quantity ${quantity} from option text: "${optionText}"`);

          const itemData = item.toObject();
          if (itemData.type === 'container') {
            await processContainerItem(item, quantity);
          } else {
            equipment.push({
              ...itemData,
              system: {
                ...itemData.system,
                quantity: quantity,
                equipped: true
              }
            });
          }
        }
      }

      // Process checkboxes
      const checkboxes = section.querySelectorAll('input[type="checkbox"]');
      HM.log(3, `Found checkboxes in section: ${checkboxes.length}`);

      for (const checkbox of checkboxes) {
        if (!checkbox.checked) continue;

        // Get the actual label text
        const labelElement = checkbox.parentElement;
        const fullLabel = labelElement.textContent.trim();
        HM.log(3, 'Processing checkbox with label:', fullLabel);

        const itemIds = checkbox.id.split(',');
        // Split on '+' and trim each part
        const entries = fullLabel.split('+').map((entry) => entry.trim());

        HM.log(3, 'Parsed label:', {
          fullLabel,
          entries
        });

        for (const itemId of itemIds) {
          if (!itemId) continue;
          HM.log(3, `Processing itemId: ${itemId}`);

          const item = await findItemInPacks(itemId);
          if (!item) {
            HM.log(2, `Could not find item for ID: ${itemId}`);
            continue;
          }

          HM.log(3, `Found item "${item.name}" (${itemId})`);

          // Search all entries for this item's quantity
          let quantity = 1;
          HM.log(3, 'Looking for quantity in entries:', {
            itemName: item.name,
            entries,
            entryTexts: entries.map((e) => `"${e}"`) // Show exact text with quotes
          });

          for (const entry of entries) {
            const itemPattern = new RegExp(`(\\d+)\\s+${item.name}`, 'i');
            const match = entry.match(itemPattern);
            HM.log(3, `Checking entry "${entry}" against pattern "${itemPattern}"`);

            if (match) {
              quantity = parseInt(match[1]);
              HM.log(3, `Found quantity ${quantity} for ${item.name}`);
              break;
            }
          }

          HM.log(3, 'Preparing to add item:', {
            name: item.name,
            quantity,
            type: item.type,
            entries
          });

          const itemData = item.toObject();
          if (itemData.type === 'container') {
            HM.log(3, `Processing container: ${item.name}`);
            await processContainerItem(item, quantity);
          } else {
            equipment.push({
              ...itemData,
              system: {
                ...itemData.system,
                quantity: quantity,
                equipped: true
              }
            });
            HM.log(3, `Added item to equipment: ${item.name} (qty: ${quantity})`);
          }
        }
      }
    }

    return equipment;
  }

  static _transformTokenData(formData) {
    try {
      HM.log(3, 'Transform Token Data - Input:', formData);

      const tokenData = {
        texture: {
          src: formData['token-art'] || formData['character-art'] || 'icons/svg/mystery-man.svg',
          scaleX: 1,
          scaleY: 1
        },
        displayName: parseInt(formData.displayName),
        displayBars: parseInt(formData.displayBars),
        bar1: {
          attribute: formData['bar1.attribute'] || null
        },
        bar2: {
          attribute: formData['bar2.attribute'] || null
        },
        ring: {
          enabled: formData['ring.enabled'] || false,
          colors: {
            ring: formData['ring.color'] || null,
            background: formData.backgroundColor || null
          },
          effects: this._calculateRingEffects(formData['ring.effects'])
        },
        sight: { enabled: true },
        disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
        actorLink: true
      };

      HM.log(3, 'Token Data Created:', tokenData);
      return tokenData;
    } catch (error) {
      HM.log(1, 'Error in _transformTokenData:', error);
      return CONFIG.Actor.documentClass.prototype.prototypeToken;
    }
  }

  static _calculateRingEffects(effectsArray) {
    const TRE = CONFIG.Token.ring.ringClass.effects;
    let effects = TRE.ENABLED;

    if (!effectsArray?.length) return TRE.DISABLED;

    effectsArray.forEach((effect) => {
      if (effect && TRE[effect]) effects |= TRE[effect];
    });

    return effects;
  }

  /* Function for handling form data collection, logging the results, and adding items to the actor. */
  static async formHandler(event, form, formData) {
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
    const classEquipment = !useStartingWealth
      ? await HeroMancer.collectEquipmentSelections(event, {
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

      const abilityMatch = key.match(/^abilities\[(\w+)\]\.score$/) || key.match(/^abilities\[(\w+)\]$/);
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
      prototypeToken: HeroMancer._transformTokenData(formData.object),
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
        game.user.update({
          color: formData.object['player-color'],
          pronouns: formData.object['player-pronouns'],
          avatar: formData.object['player-avatar']
        });
      }
      game.user.update({ character: actor.id });
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
         * @returns {void} Initiates the advancement process for the items.
         */
        function doAdvancement(itemIndex = 0) {
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

          Hooks.once('dnd5e.advancementManagerComplete', () => {
            HM.log(3, `Completed ${items[itemIndex].name}`);

            setTimeout(async () => {
              currentManager = null;

              if (itemIndex + 1 < items.length) {
                try {
                  currentManager = await createAdvancementManager(items[itemIndex + 1]);
                  currentManager.render(true);
                } catch (error) {
                  HM.log(1, `Error creating manager for ${items[itemIndex + 1].name}:`, error);
                  newActor.sheet.render(true);
                  return;
                }
              }
              doAdvancement(itemIndex + 1);
            }, HeroMancer.ADVANCEMENT_DELAY.transitionDelay);
          });

          if (itemIndex === 0) {
            currentManager.render(true);
          }
        }

        doAdvancement();
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
}
