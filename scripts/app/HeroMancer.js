import { HM } from '../hero-mancer.js';
import * as HMUtils from '../utils/index.js';
import { StartingEquipmentUI } from '../utils/StartingEquipmentUI.js';
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
// const { AdvancementManager } = dnd5e.applications.advancement;

/**
 * AppV2-based sheet for Hero Mancer application
 */
export class HeroMancer extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
  }

  static selectedAbilities = [];

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
      increaseScore: HeroMancer.increaseScore
    },
    classes: [`${HM.ABRV}-app`],
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
    return `${HM.TITLE} | ${game.user.name}`;
  }

  /** @override */
  static PARTS = {
    header: {
      template: `${HM.TMPL}/app-header.hbs`,
      classes: [`${HM.ABRV}-app-header`]
    },
    tabs: {
      template: `${HM.TMPL}/app-nav.hbs`,
      classes: [`${HM.ABRV}-app-nav`]
    },
    start: {
      template: `${HM.TMPL}/tab-start.hbs`,
      classes: [`${HM.ABRV}-app-tab-content`]
    },
    background: {
      template: `${HM.TMPL}/tab-background.hbs`,
      classes: [`${HM.ABRV}-app-tab-content`]
    },
    race: {
      template: `${HM.TMPL}/tab-race.hbs`,
      classes: [`${HM.ABRV}-app-tab-content`]
    },
    class: {
      template: `${HM.TMPL}/tab-class.hbs`,
      classes: [`${HM.ABRV}-app-tab-content`]
    },
    abilities: {
      template: `${HM.TMPL}/tab-abilities.hbs`,
      classes: [`${HM.ABRV}-app-tab-content`]
    },
    equipment: {
      template: `${HM.TMPL}/tab-equipment.hbs`,
      classes: [`${HM.ABRV}-app-tab-content`]
    },
    finalize: {
      template: `${HM.TMPL}/tab-finalize.hbs`,
      classes: [`${HM.ABRV}-app-tab-content`]
    },
    footer: {
      template: `${HM.TMPL}/app-footer.hbs`,
      classes: [`${HM.ABRV}-app-footer`]
    }
  };

  /** @override */
  async _prepareContext(options) {
    HM.log(3, 'Preparing context.');
    const abilitiesCount = Object.keys(CONFIG.DND5E.abilities).length;
    HeroMancer.selectedAbilities = Array(abilitiesCount).fill(8);
    const extraAbilities = abilitiesCount > 6 ? abilitiesCount - 6 : 0;
    const diceRollingMethod = game.settings.get(HM.ID, 'diceRollingMethod');
    const standardArray =
      diceRollingMethod === 'standardArray'
        ? game.settings.get(HM.ID, 'customStandardArray').split(',').map(Number)
        : HMUtils.getStandardArray(extraAbilities);
    const totalPoints = HMUtils.getTotalPoints();
    const remainingPoints = HMUtils.updateRemainingPointsDisplay(HeroMancer.selectedAbilities);

    // Check if cached data is available to avoid re-fetching
    if (HMUtils.CacheManager.isCacheValid()) {
      HM.log(3, 'Documents cached and descriptions enriched!');
      return {
        raceDocs: HMUtils.CacheManager.getCachedRaceDocs(),
        classDocs: HMUtils.CacheManager.getCachedClassDocs(),
        backgroundDocs: HMUtils.CacheManager.getCachedBackgroundDocs()
      };
    }

    ui.notifications.info('hm.actortab-button.loading', { localize: true });

    const { types: raceDocs } = await HMUtils.prepareDocuments('race');
    const { types: classDocs } = await HMUtils.prepareDocuments('class');
    const { types: backgroundDocs } = await HMUtils.prepareDocuments('background');

    const abilities = Object.entries(CONFIG.DND5E.abilities).map(([key, value]) => ({
      key,
      abbreviation: value.abbreviation.toUpperCase(),
      currentScore: 8
    }));

    const context = {
      raceDocs,
      classDocs,
      backgroundDocs,
      tabs: this._getTabs(options.parts),
      abilities,
      rollStat: this.rollStat,
      diceRollMethod: diceRollingMethod,
      standardArray: standardArray,
      selectedAbilities: HeroMancer.selectedAbilities,
      remainingPoints: remainingPoints,
      totalPoints: totalPoints
      // equipmentData: {} // Include parsed equipment data for later use
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
          doc.enrichedDescription = await TextEditor.enrichHTML(doc.description);
        } catch (error) {
          HM.log(
            1,
            `${HM.ID} | Error enriching description or processing starting equipment for '${doc.name}':`,
            error
          );
        }
      }
    }

    HMUtils.CacheManager.cacheDocuments({
      raceDocs,
      classDocs,
      backgroundDocs,
      abilities
    });

    HM.log(3, 'Documents registered and enriched, caching results.');
    HM.log(3, 'Tabs Data:', this.tabsData);
    return context;
  }

  /** @override */
  _preparePartContext(partId, context) {
    HM.log(3, `Preparing part context for: ${{ partId }}`);

    switch (partId) {
      case 'start':
      case 'background':
      case 'race':
      case 'class':
        context.tab = context.tabs[partId];
        break;
      case 'abilities':
        context.tab = context.tabs[partId];
        const totalPoints = HMUtils.getTotalPoints();
        const pointsSpent = HMUtils.calculatePointsSpent(HeroMancer.selectedAbilities);
        const remainingPoints = totalPoints - pointsSpent;
        context.totalPoints = totalPoints;
        context.remainingPoints = remainingPoints;
        break;
      case 'equipment':
        context.tab = context.tabs[partId];
        break;
      case 'finalize':
        context.tab = context.tabs[partId];
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
    this.tabGroups[tabGroup] = 'start'; // Default active tab

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
          tab.label = `${game.i18n.localize(`${HM.ABRV}.app.tab-names.start`)}`;
          tab.icon = 'fa-solid fa-play-circle';
          break;
        case 'background':
          tab.id = 'background';
          tab.label = `${game.i18n.localize(`${HM.ABRV}.app.tab-names.background`)}`;
          tab.icon = 'fa-solid fa-scroll';
          break;
        case 'race':
          tab.id = 'race';
          tab.label = `${game.i18n.localize(`${HM.ABRV}.app.tab-names.race`)}`;
          tab.icon = 'fa-solid fa-feather-alt';
          break;
        case 'class':
          tab.id = 'class';
          tab.label = `${game.i18n.localize(`${HM.ABRV}.app.tab-names.class`)}`;
          tab.icon = 'fa-solid fa-chess-rook';
          break;
        case 'abilities':
          tab.id = 'abilities';
          tab.label = `${game.i18n.localize(`${HM.ABRV}.app.tab-names.abilities`)}`;
          tab.icon = 'fa-solid fa-fist-raised';
          break;
        case 'equipment':
          tab.id = 'equipment';
          tab.label = `${game.i18n.localize(`${HM.ABRV}.app.tab-names.equipment`)}`;
          tab.icon = 'fa-solid fa-shield-halved';
          break;
        case 'finalize':
          tab.id = 'finalize';
          tab.label = `${game.i18n.localize(`${HM.ABRV}.app.tab-names.finalize`)}`;
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
  _onRender(context, options) {
    HM.log(3, 'Rendering application with context and options.');
    const html = this.element;

    // Initialize dropdowns for race, class, and background
    HMUtils.initializeDropdown({ type: 'class', html, context });
    HMUtils.initializeDropdown({ type: 'race', html, context });
    HMUtils.initializeDropdown({ type: 'background', html, context });

    const abilityDropdowns = html.querySelectorAll('.ability-dropdown');
    const selectedAbilities = Array.from(abilityDropdowns).map(() => ''); // Initialize with empty strings

    const totalPoints = HMUtils.getTotalPoints();

    // Set up event listeners and initial dropdown state based on mode
    abilityDropdowns.forEach((dropdown, index) => {
      dropdown.addEventListener('change', (event) => {
        selectedAbilities[index] = event.target.value || ''; // Store selected ability name/abbreviation
        HMUtils.updateAbilityDropdowns(
          abilityDropdowns,
          selectedAbilities,
          totalPoints,
          context.diceRollMethod === 'pointBuy' ? 'pointBuy' : 'manualFormula'
        );
      });
    });

    // Initial update on render
    HMUtils.updateAbilityDropdowns(
      abilityDropdowns,
      selectedAbilities,
      totalPoints,
      context.diceRollMethod === 'pointBuy' ? 'pointBuy' : 'manualFormula'
    );
    HMUtils.updatePlusButtonState(context.remainingPoints);
    HMUtils.updateMinusButtonState();

    // Assuming dropdown elements have IDs #classDropdown, #raceDropdown, and #backgroundDropdown
    const classId = document.querySelector('#class-dropdown').value;
    const backgroundId = document.querySelector('#background-dropdown').value;

    // Create StartingEquipmentUI instance with the selected dropdown values
    const startingEquipmentUI = new StartingEquipmentUI(classId, backgroundId);

    // Target container where equipment choices will be appended
    const equipmentContainer = document.querySelector('#equipment-container');
    equipmentContainer.innerHTML = ''; // Clear previous content

    // Initial render of equipment choices
    startingEquipmentUI.renderEquipmentChoices().then((equipmentChoices) => {
      equipmentContainer.appendChild(equipmentChoices);
    }).catch((error) => {
      console.error('Error rendering equipment choices:', error);
    });

    // Store dropdown selections and update equipment choices on change
    const dropdowns = html.querySelectorAll('#class-dropdown, #background-dropdown');
    dropdowns.forEach((dropdown) => {
      dropdown.addEventListener('change', async (event) => {
        const selectedValue = event.target.value;
        const type = event.target.id.replace('-dropdown', '');
        HMUtils.selectionStorage[type] = {
          selectedValue,
          selectedId: selectedValue.split(' ')[0] // Extract the item ID
        };
        HM.log(3, 'SELECTION STORAGE UPDATED:', HMUtils.selectionStorage);

        // Update StartingEquipmentUI instance with the new selections
        startingEquipmentUI.classId = HMUtils.selectionStorage.class.selectedId;
        startingEquipmentUI.backgroundId = HMUtils.selectionStorage.background.selectedId;

        // Clear previous content and render updated equipment choices
        equipmentContainer.innerHTML = '';
        try {
          const updatedChoices = await startingEquipmentUI.renderEquipmentChoices();
          equipmentContainer.appendChild(updatedChoices);
        } catch (error) {
          console.error('Error updating equipment choices:', error);
        }
      });
    });
  }


  /* Logic for rolling stats and updating input fields */
  static async rollStat(event, form) {
    HM.log(3, 'Rolling stats using user-defined formula.');
    await HMUtils.statRoller(form); // Use the utility function
  }

  static increaseScore(event, form) {
    const index = parseInt(form.getAttribute('data-ability-index'), 10);
    HMUtils.adjustScore(index, 1);
  }

  static decreaseScore(event, form) {
    const index = parseInt(form.getAttribute('data-ability-index'), 10);
    HMUtils.adjustScore(index, -1);
  }

  /* Function for handling form data collection, logging the results, and adding items to the actor. */
  static async formHandler(event, form, formData) {
    HM.log(3, 'Processing form data...');
    try {
      const validProperties = Object.keys(formData.object);

      for (const property of validProperties) {
        const value = formData.object[property];
        if (value === null || value === undefined || value === '') {
          throw new Error(`Missing required field: ${property}`);
        }
      }
    } catch (err) {
      console.error(err);
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

    // Extract abilities from formData
    let abilities = {};
    for (const key in formData.object) {
      const abilityMatch = key.match(/^abilities\[(\w+)\]\.score$/);
      if (abilityMatch) {
        const abilityKey = abilityMatch[1];
        abilities[abilityKey] = formData.object[key];
      }
    }

    HM.log(3, 'Abilities extracted:', abilities);

    // Create the new actor
    let actorName = formData.object.name || game.user.name; // Handling for blank hero name.
    let actorData = {
      name: actorName,
      type: 'character',
      system: {
        abilities: Object.fromEntries(Object.entries(abilities).map(([key, value]) => [key, { value }]))
      }
    };

    let actor = await Actor.create(actorData);
    let newActor = game.actors.getName(actorName);
    HM.log(3, newActor);
    HM.log(3, 'Created Actor:', actor);

    // Declare the items outside the try block
    let backgroundItem, raceItem, classItem;

    try {
      // Check if each required item is selected before fetching
      if (!backgroundData?.packId || !backgroundData?.itemId) {
        ui.notifications.warn(game.i18n.localize('hm.errors.select-background'));
        return;
      }
      if (!raceData?.packId || !raceData?.itemId) {
        ui.notifications.warn(game.i18n.localize('hm.errors.select-race'));
        return;
      }
      if (!classData?.packId || !classData?.itemId) {
        ui.notifications.warn(game.i18n.localize('hm.errors.select-class'));
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
      // Log error to the console and notify the user
      console.error(error);
      ui.notifications.error(game.i18n.localize('hm.errors.fetch-fail'));
    }

    if (!backgroundItem || !raceItem || !classItem) {
      HM.log(1, 'Error: One or more items could not be fetched.');
      return;
    }

    // Add the items to the actor
    const items = [backgroundItem.toObject(), raceItem.toObject(), classItem.toObject()];
    await actor.createEmbeddedDocuments('Item', items);
    // Await newActor.createEmbeddedDocuments('Item', raceItem.toObject());
    // await Item.create(items[1], { parent: newActor });
    HM.log(3, 'Items added to actor:', items);

    // Ensure the items are fully added and the actor is updated
    await actor.update({});

    // Trigger advancements for all added items
    /*     for (const item of items) {
      // Log the actor and the current levels
      HM.log(3,`Current levels for item ${item.name}:`, item.system.levels);
      HM.log(3,'Actor details for advancement:', newActor);

      let manager = dnd5e.applications.advancement.AdvancementManager;
      const cls = newActor.itemTypes.class.find((c) => c.identifier === item.system.identifier);
      // Check if the item is a class and handle differently
      if (item.type === 'class') {
        if (cls) {
          manager.forModifyChoices(newActor, cls.id, 1);
          if (manager.steps.length) {
            manager.render(true);
          }
        }
      } else {
        // Use the standard advancement manager for other items
        manager.forNewItem(newActor, item);
        HM.log(3,`Standard Advancement Manager initialized for item: ${item.name}`, manager);
        if (manager.steps.length) {
          manager.render(true);
        }
      }
    } */

    // Delay opening the sheet until after advancements are triggered
    setTimeout(() => {
      actor.sheet.render(true);
      HM.log(3, 'Opened character sheet for:', actor.name);
    }, 1000); // 1 second delay to ensure everything is processed
  }
}
