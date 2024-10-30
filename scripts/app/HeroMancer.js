import { HM } from '../hero-mancer.js';
import * as HMUtils from '../utils/index.js';
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { AdvancementManager } = dnd5e.applications.advancement;

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
      diceRollingMethod === 'standardArray' ?
        game.settings.get(HM.ID, 'customStandardArray').split(',').map(Number)
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

    // Notify the user that loading is in progress
    ui.notifications.info('hm.actortab-button.loading', { localize: true });

    // Fetch race, class, and background documents without caching dropdown HTML
    HM.log(3, 'Fetching race, class, and background documents...');
    const { types: raceDocs } = await HMUtils.prepareDocuments('race');
    const { types: classDocs } = await HMUtils.prepareDocuments('class');
    const { types: backgroundDocs } = await HMUtils.prepareDocuments('background');

    // Log fetched documents
    HM.log(3, 'Race Docs:', raceDocs);
    HM.log(3, 'Class Docs:', classDocs);
    HM.log(3, 'Background Docs:', backgroundDocs);

    // Extract abilities from the system configuration and convert to uppercase abbreviations
    const abilities = Object.entries(CONFIG.DND5E.abilities).map(([key, value]) => ({
      key,
      abbreviation: value.abbreviation.toUpperCase(),
      currentScore: 8
    }));

    HM.log(3, 'Abilities extracted:', abilities);

    // Prepare the context for the template
    const context = {
      raceDocs,
      classDocs,
      backgroundDocs,
      tabs: this._getTabs(options.parts),
      abilities, // Pass the abilities data
      rollStat: this.rollStat, // Roll stat handler
      diceRollMethod: diceRollingMethod,
      standardArray: standardArray,
      selectedAbilities: HeroMancer.selectedAbilities,
      remainingPoints: remainingPoints,
      totalPoints: totalPoints
    };

    HM.log(3, 'Prepared context:', context);

    // Flatten race, class, and background documents for enrichment
    const allDocs = [
      ...(context.raceDocs?.flatMap((folder) => folder.docs) || []), // Flatten race docs inside folders
      ...(context.classDocs?.flatMap((pack) => pack.docs) || []), // Flatten class docs inside packs
      ...(context.backgroundDocs?.flatMap((pack) => pack.docs) || []) // Flatten background docs inside packs
    ];

    HM.log(3, 'All documents to be enriched:', allDocs);

    // Enrich descriptions for each document if available
    for (const doc of allDocs) {
      if (doc && doc.description) {
        try {
          const enrichedDescription = await TextEditor.enrichHTML(doc.description);
          doc.enrichedDescription = enrichedDescription; // Attach enriched description
          HM.log(3, `Enriched description for ${doc.name}`);
        } catch (error) {
          HM.log(1, `${HM.ID} | Failed to enrich description for document '${doc.name}':`, error);
        }
      } else {
        HM.log(2, `${HM.ID} | No description found for document ${doc ? doc.name : 'undefined'}`);
      }
    }

    // Cache the documents and enriched descriptions for future use, but skip dropdown HTML
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
        context.tab = context.tabs[partId];
        break;
      case 'background':
        context.tab = context.tabs[partId];
        break;
      case 'race':
        context.tab = context.tabs[partId];
        break;
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
    // HM.log(3, context);
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
    let actorData = {
      name: formData.object.name,
      type: 'character',
      system: {
        abilities: Object.fromEntries(Object.entries(abilities).map(([key, value]) => [key, { value }])),
        details: {
          equipment: formData.object.equipment
        }
      }
    };

    let actor = await Actor.create(actorData);
    let newActor = game.actors.getName(formData.object.name);
    HM.log(3, newActor);
    HM.log(3, 'Created Actor:', actor);

    // Fetch the items from compendiums
    const backgroundItem = await game.packs.get(backgroundData.packId)?.getDocument(backgroundData.itemId);
    const raceItem = await game.packs.get(raceData.packId)?.getDocument(raceData.itemId);
    const classItem = await game.packs.get(classData.packId)?.getDocument(classData.itemId);

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
