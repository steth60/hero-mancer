import { HM } from '../hero-mancer.js';
import * as HMUtils from '../utils/index.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api; // Define some variables we'll use often, pulling from the foundry API.
// const { AdvancementManager } = dnd5e.applications.advancement;
export class HeroMancer extends HandlebarsApplicationMixin(ApplicationV2) {
  static selectedAbilities = [];

  static DEFAULT_OPTIONS = {
    id: `${HM.ID}-app`,
    tag: 'form',
    form: {
      handler: HeroMancer.formHandler,
      closeOnSubmit: true, // Close application upon hitting the submit button.
      submitOnChange: false // Dont submit data to the formHandler until the submit button is pressed.
    },
    actions: {
      rollStat: HeroMancer.rollStat, // Register rollStat action
      decreaseScore: HeroMancer.decreaseScore,
      increaseScore: HeroMancer.increaseScore
    },
    classes: [`${HM.ABRV}-app`], // CSS class that applies to the entire application (ie the root class)
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

  /* Define the PARTS of the application, in our case: header, nav, footer, and each tab */
  static PARTS = {
    header: {
      template: `${HM.TMPL}/app-header.hbs`,
      id: 'header',
      classes: [`${HM.ABRV}-app-header`]
    },
    nav: {
      template: `${HM.TMPL}/app-nav.hbs`,
      id: 'nav',
      classes: [`${HM.ABRV}-app-nav`]
    },
    start: {
      template: `${HM.TMPL}/tab-start.hbs`,
      id: 'start',
      classes: [`${HM.ABRV}-app-tab-content`]
    },
    background: {
      template: `${HM.TMPL}/tab-background.hbs`,
      id: 'background',
      classes: [`${HM.ABRV}-app-tab-content`]
    },
    race: {
      template: `${HM.TMPL}/tab-race.hbs`,
      id: 'race',
      classes: [`${HM.ABRV}-app-tab-content`]
    },
    class: {
      template: `${HM.TMPL}/tab-class.hbs`,
      id: 'class',
      classes: [`${HM.ABRV}-app-tab-content`]
    },
    abilities: {
      template: `${HM.TMPL}/tab-abilities.hbs`,
      id: 'abilities',
      classes: [`${HM.ABRV}-app-tab-content`]
    },
    equipment: {
      template: `${HM.TMPL}/tab-equipment.hbs`,
      id: 'equipment',
      classes: [`${HM.ABRV}-app-tab-content`]
    },
    finalize: {
      template: `${HM.TMPL}/tab-finalize.hbs`,
      id: 'finalize',
      classes: [`${HM.ABRV}-app-tab-content`]
    },
    footer: {
      template: `${HM.TMPL}/app-footer.hbs`,
      id: 'footer',
      classes: [`${HM.ABRV}-app-footer`]
    }
  };

  /* AppV2 Prepare Context: This function is executed when the application is opened. */
  /* It prepares the data sent to the Handlebars template to display the forms, HTML, CSS, etc. */
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
    const selectedAbilities = Array(abilitiesCount).fill(8);
    const totalPoints = HMUtils.getTotalPoints();
    const remainingPoints = HMUtils.updateRemainingPointsDisplay(HeroMancer.selectedAbilities);

    // Check if cached data is available to avoid re-fetching
    if (HMUtils.CacheManager.isCacheValid()) {
      HM.log(3, 'Documents cached and descriptions enriched!');
      return {
        raceDocs: HMUtils.CacheManager.getCachedRaceDocs(),
        raceDropdownHtml: HMUtils.CacheManager.getCachedRaceDropdownHtml(),
        classDocs: HMUtils.CacheManager.getCachedClassDocs(),
        classDropdownHtml: HMUtils.CacheManager.getCachedClassDropdownHtml(),
        backgroundDocs: HMUtils.CacheManager.getCachedBackgroundDocs(),
        backgroundDropdownHtml: HMUtils.CacheManager.getCachedBackgroundDropdownHtml(),
        tabs: this.tabsData,
        rollStat: this.rollStat,
        diceRollMethod: game.settings.get(HM.ID, 'diceRollingMethod'),
        standardArray: standardArray,
        selectedAbilities: HeroMancer.selectedAbilities,
        remainingPoints: remainingPoints,
        totalPoints: totalPoints
      };
    }

    // Notify the user that loading is in progress
    ui.notifications.info('hm.actortab-button.loading', { localize: true });

    // Fetch race, class, and background documents
    HM.log(3, 'Fetching race, class, and background documents...');
    const { types: raceDocs, dropdownHtml: raceDropdownHtml } = await HMUtils.prepareDocuments('race');
    const { types: classDocs, dropdownHtml: classDropdownHtml } = await HMUtils.prepareDocuments('class');
    const { types: backgroundDocs, dropdownHtml: backgroundDropdownHtml } =
      await HMUtils.prepareDocuments('background');

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
      raceDropdownHtml,
      classDocs,
      classDropdownHtml, // Generated dropdown HTML for classes
      backgroundDocs,
      backgroundDropdownHtml, // Generated dropdown HTML for backgrounds
      tabs: this.tabsData,
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

    // Cache the documents and enriched descriptions for future use
    HMUtils.CacheManager.cacheDocuments({
      raceDocs,
      raceDropdownHtml,
      classDocs,
      classDropdownHtml,
      backgroundDocs,
      backgroundDropdownHtml,
      abilities
    });

    HM.log(3, 'Documents registered and enriched, caching results.');
    return context;
  }

  /* Dynamic rendering of the application, triggers events and updates. */
  _onRender(context, options) {
    HM.log(3, 'Rendering application with context and options.');
    const html = this.element;

    // Initialize dropdowns for race, class, and background
    HMUtils.initializeDropdown({ type: 'class', html, context });
    HMUtils.initializeDropdown({ type: 'race', html, context });
    HMUtils.initializeDropdown({ type: 'background', html, context });

    const abilityDropdowns = html.querySelectorAll('.ability-dropdown');
    const selectedAbilities = Array.from(abilityDropdowns).map((dropdown) => parseInt(dropdown.value, 10) || 8);
    const totalPoints = HMUtils.getTotalPoints();

    abilityDropdowns.forEach((dropdown, index) => {
      dropdown.addEventListener('change', (event) => {
        selectedAbilities[index] = parseInt(event.target.value, 10) || 8;
        HMUtils.updateAbilityDropdowns(abilityDropdowns, selectedAbilities, totalPoints);
      });
    });

    // Initial update on render
    HMUtils.updateAbilityDropdowns(abilityDropdowns, selectedAbilities, totalPoints);
    HMUtils.updatePlusButtonState(context.remainingPoints);
    HMUtils.updateMinusButtonState();
  }

  /* Getter to setup tabs with builtin foundry functionality. */
  get tabsData() {
    let tabsData = {
      start: {
        id: 'start',
        group: 'hero-mancer-tabs',
        icon: 'fa-solid fa-play-circle',
        label: `${game.i18n.localize(`${HM.ABRV}.app.tab-names.start`)}`,
        active: true,
        cssClass: 'active'
      },
      background: {
        id: 'background',
        group: 'hero-mancer-tabs',
        icon: 'fa-solid fa-scroll',
        label: `${game.i18n.localize(`${HM.ABRV}.app.tab-names.background`)}`,
        active: false,
        cssClass: ''
      },
      race: {
        id: 'race',
        group: 'hero-mancer-tabs',
        icon: 'fa-solid fa-feather-alt',
        label: `${game.i18n.localize(`${HM.ABRV}.app.tab-names.race`)}`,
        active: false,
        cssClass: ''
      },
      class: {
        id: 'class',
        group: 'hero-mancer-tabs',
        icon: 'fa-solid fa-chess-rook',
        label: `${game.i18n.localize(`${HM.ABRV}.app.tab-names.class`)}`,
        active: false,
        cssClass: ''
      },
      abilities: {
        id: 'abilities',
        group: 'hero-mancer-tabs',
        icon: 'fa-solid fa-fist-raised',
        label: `${game.i18n.localize(`${HM.ABRV}.app.tab-names.abilities`)}`,
        active: false,
        cssClass: ''
      }
      // equipment: {
      //   id: 'equipment',
      //   group: 'hero-mancer-tabs',
      //   icon: 'fa-solid fa-shield-halved',
      //   label: `${game.i18n.localize(`${HM.ABRV}.app.tab-names.equipment`)}`,
      //   active: false,
      //   cssClass: ''
      // },
      // finalize: {
      //   id: 'finalize',
      //   group: 'hero-mancer-tabs',
      //   icon: 'fa-solid fa-check-circle',
      //   label: `${game.i18n.localize(`${HM.ABRV}.app.tab-names.finalize`)}`,
      //   active: false,
      //   cssClass: ''
      // }
    };
    return tabsData;
  }

  /* Logic for changing tabs. */
  changeTab(...args) {
    HM.log(3, 'Changing tabs with args:', args);

    // Set position to auto to adapt to the new tab's height
    let autoPos = { ...this.position, height: 'auto' };
    this.setPosition(autoPos);
    super.changeTab(...args);

    // After tab is changed, recalculate and set the new height
    let newPos = { ...this.position, height: this.element.scrollHeight };
    this.setPosition(newPos);

    HM.log(3, 'Tab changed. New position set:', newPos);
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
