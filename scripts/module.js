import { HMUtils } from './utils.js';
import { registerSettings } from './settings.js';

/* Main Hero Mancer class, define some statics that will be used everywhere in the module. */
export class HM {
  static ID = 'hero-mancer'; // Used to define folders, classes, file structures, foundry api, etc.
  static TITLE = 'Hero Mancer'; // Module title
  static ABRV = 'hm'; // Abbreviation for CSS classes and localization
  static TMPL = `modules/${HM.ID}/templates`; // Path to templates
  static verboseLoggingEnabled = false; // Default setting for logging

  /* Initialize the module */
  static initialize() {
    HM.log(`Initializing Module.`);
    registerSettings(); // Register the settings for the module
    this.heroMancer = new HeroMancer();
    // Once the settings are registered, we check if verbose logging is enabled
    HM.verboseLoggingEnabled = game.settings.get(HM.ID, 'enableVerboseLogging');
    HM.log(`Verbose logging is ${HM.verboseLoggingEnabled ? 'enabled' : 'disabled'}.`);
  }

  /* Utility function for logging based on the verbose setting */
  static log(...args) {
    if (HM.verboseLoggingEnabled) {
      console.log(`${HM.ID} |`, ...args);
    }
  }
}

/* Register the initialization hook */
Hooks.on('init', () => {
  HM.initialize(); // Initialize the module and register settings
});

Hooks.once('ready', () => {
  if (!game.settings.get(HM.ID, 'enable')) return;

  // Inject HeroMancer button in the actor tab
  $('section[class*="actors-sidebar"]')
    .find('header[class*="directory-header"]')
    .find('div[class*="header-actions"]')
    .find('button[class*="create-folder"]')
    .before(
      `<button type='button' class='${HM.ABRV}-actortab-button' title='${game.i18n.localize(`${HM.ABRV}.actortab-button.hint`)}'>
        <i class='fa-solid fa-egg' style='color: #ff144f'></i>
        ${game.i18n.localize(`${HM.ABRV}.actortab-button.name`)}
      </button>`
    );

  // Button click event to render HeroMancer
  $(document).on('click', `.${HM.ABRV}-actortab-button`, (event) => {
    HM.heroMancer.render(true);
  });
});

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api; // Define some variables we'll use often, pulling from the foundry API.
class HeroMancer extends HandlebarsApplicationMixin(ApplicationV2) {
  static cachedRaceDocs = null; // Used to cache all valid race documents we'll find for mancing.
  static cachedClassDocs = null; // Used to cache all valid class documents we'll find for mancing.
  static cachedBackgroundDocs = null; // Used to cache all valid background documents we'll find for mancing.
  static enrichedCache = false; // Boolean to check if we need to build the cache for the above variables.

  static DEFAULT_OPTIONS = {
    id: `${HM.ID}`,
    tag: 'form',
    form: {
      handler: HeroMancer.formHandler,
      closeOnSubmit: true, // Close application upon hitting the submit button.
      submitOnChange: false // Dont submit data to the formHandler until the submit button is pressed.
    },
    actions: {
      rollStat: HeroMancer.rollStat // Register rollStat action
    },
    classes: [`${HM.ABRV}-app`], // CSS class that applies to the entire application (ie the root class)
    position: {
      height: 'auto',
      width: 'auto',
      top: '100'
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
      id: `start`,
      classes: [`${HM.ABRV}-app-tab-content`]
    },
    background: {
      template: `${HM.TMPL}/tab-background.hbs`,
      id: `background`,
      classes: [`${HM.ABRV}-app-tab-content`]
    },
    race: {
      template: `${HM.TMPL}/tab-race.hbs`,
      id: `race`,
      classes: [`${HM.ABRV}-app-tab-content`]
    },
    class: {
      template: `${HM.TMPL}/tab-class.hbs`,
      id: `class`,
      classes: [`${HM.ABRV}-app-tab-content`]
    },
    abilities: {
      template: `${HM.TMPL}/tab-abilities.hbs`,
      id: `abilities`,
      classes: [`${HM.ABRV}-app-tab-content`]
    },
    equipment: {
      template: `${HM.TMPL}/tab-equipment.hbs`,
      id: `equipment`,
      classes: [`${HM.ABRV}-app-tab-content`]
    },
    finalize: {
      template: `${HM.TMPL}/tab-finalize.hbs`,
      id: `finalize`,
      classes: [`${HM.ABRV}-app-tab-content`]
    },
    footer: {
      template: `${HM.TMPL}/app-footer.hbs`,
      id: `footer`,
      classes: [`${HM.ABRV}-app-footer`]
    }
  };

  /* AppV2 Prepare Context: This function is executed when the application is opened. It prepares the data sent to the Handlebars template to display the forms, HTML, CSS, etc. */
  async _prepareContext(options) {
    HM.log(`Preparing context.`);

    // Check if cached data is available to avoid re-fetching
    if (HeroMancer.cachedRaceDocs && HeroMancer.cachedClassDocs && HeroMancer.cachedBackgroundDocs && HeroMancer.enrichedCache) {
      HM.log(`Documents cached and descriptions enriched!`);
      return {
        raceDocs: HeroMancer.cachedRaceDocs,
        classDocs: HeroMancer.cachedClassDocs,
        backgroundDocs: HeroMancer.cachedBackgroundDocs,
        dropdownHtml: HeroMancer.cachedDropdownHtml, // Cached dropdown HTML
        tabs: this.tabsData,
        abilities: HeroMancer.cachedAbilities, // Cached abilities data
        rollStat: this.rollStat // Roll stat handler
      };
    }

    // Notify the user that loading is in progress
    ui.notifications.info('hm.actortab-button.loading', { localize: true });

    // Fetch race, class, and background documents
    const { races: raceDocs, dropdownHtml } = await HMUtils.registerRaces();
    const classDocs = await HMUtils.registerClasses();
    const backgroundDocs = await HMUtils.registerBackgrounds();

    // Extract abilities from the system configuration and convert to uppercase abbreviations
    const abilities = Object.entries(CONFIG.DND5E.abilities).map(([key, value]) => ({
      key,
      abbreviation: value.abbreviation.toUpperCase()
    }));

    HM.log(`Abilities extracted:`, abilities);

    // Prepare the context for the template
    const context = {
      raceDocs,
      classDocs,
      backgroundDocs,
      dropdownHtml, // Generated dropdown HTML
      tabs: this.tabsData,
      abilities, // Pass the abilities data
      rollStat: this.rollStat // Roll stat handler
    };

    // Flatten race, class, and background documents for enrichment
    const allDocs = [
      ...context.raceDocs.flatMap((folder) => folder.docs), // Flatten race docs inside folders
      ...context.classDocs,
      ...context.backgroundDocs
    ];

    // Enrich descriptions for each document if available
    for (const doc of allDocs) {
      if (doc && doc.description) {
        try {
          const enrichedDescription = await TextEditor.enrichHTML(doc.description);
          doc.enrichedDescription = enrichedDescription; // Attach enriched description
          HM.log(`Enriched description for ${doc.name}`);
        } catch (error) {
          console.error(`${HM.ID} | Failed to enrich description for document '${doc.name}':`, error);
        }
      } else {
        console.warn(`${HM.ID} | No description found for document ${doc ? doc.name : 'undefined'}`);
      }
    }

    // Cache the documents and enriched descriptions for future use
    HeroMancer.cachedRaceDocs = raceDocs;
    HeroMancer.cachedClassDocs = classDocs;
    HeroMancer.cachedBackgroundDocs = backgroundDocs;
    HeroMancer.cachedDropdownHtml = dropdownHtml;
    HeroMancer.cachedAbilities = abilities;
    HeroMancer.enrichedCache = true;

    HM.log(`Documents registered and enriched, caching results.`);
    return context;
  }

  /* Prepare partial context for specific parts of the application. Reference: https://foundryvtt.wiki/en/development/api/applicationv2 */
  async _preparePartContext(partId, context) {
    HM.log(`Preparing part context for: ${partId}`);

    context.partId = `${this.id}-${partId}`;
    return context;
  }

  /* Dynamic rendering of the application, triggers events and updates. */
  _onRender(context, options) {
    HM.log(`Rendering application with context and options.`);

    // Add description listeners for class, race, and background dropdowns
    this._addDescriptionUpdateListeners(context, 'class');
    this._addDescriptionUpdateListeners(context, 'race');
    this._addDescriptionUpdateListeners(context, 'background');

    // Add ability selection listeners for the ability dropdowns
    this._addAbilitySelectionListeners();
  }

  _addDescriptionUpdateListeners(context, type) {
    HM.log(`Adding description update listeners for ${type}.`);

    const dropdown = this.element.querySelector(`#${type}-dropdown`);

    if (dropdown) {
      dropdown.addEventListener('change', async (event) => {
        const selectedValue = event.target.value;

        // Use regular expression to strip parentheses and content inside them
        const selectedId = selectedValue.replace(/\s?\(.*?\)/, '');

        if (!selectedId) {
          const descriptionElement = this.element.querySelector(`#${type}-description`);
          if (descriptionElement) descriptionElement.innerHTML = '';
          return;
        }

        /* Check if the context contains the correct documentsKey */
        const documentsKey = `${type}Docs`;
        HM.log(`Documents Key: ${documentsKey}`, context[documentsKey]);

        if (!context[documentsKey] || !Array.isArray(context[documentsKey])) {
          console.error(`${HM.ID} | No documents found for type: ${type}`);
          return;
        }

        let selectedDoc;

        /* Handle race-specific logic with folder structure */
        if (type === 'race') {
          // Flatten race docs to access documents inside folders
          const raceDocs = context[documentsKey].flatMap((folder) => folder.docs);
          HM.log(`Flattened Race Docs:`, raceDocs);

          // Find the selected document in the flattened raceDocs array
          selectedDoc = raceDocs.find((doc) => doc.id === selectedId);
          HM.log(`Selected Race Document:`, selectedDoc);
        } else {
          // Find the selected document for class or background
          selectedDoc = context[documentsKey].find((doc) => doc.id === selectedId);
          HM.log(`Selected Document:`, selectedDoc);
        }

        // Ensure the selectedDoc exists and has an enriched description
        const descriptionElement = this.element.querySelector(`#${type}-description`);
        if (selectedDoc && selectedDoc.enrichedDescription) {
          HM.log(`Displaying enriched description:`, selectedDoc.enrichedDescription);
          descriptionElement.innerHTML = selectedDoc.enrichedDescription;
        } else {
          console.warn(`${HM.ID} | No enriched description found, using default.`);
          descriptionElement.innerHTML = `${game.i18n.localize(`${HM.ABRV}.app.no-description`)}`;
        }
      });
    } else {
      HM.log(`No dropdown found for ${type}.`);
    }
  }

  _addAbilitySelectionListeners() {
    const abilityDropdowns = this.element.querySelectorAll('.ability-dropdown');
    const selectedAbilities = new Set();

    // Iterate over each dropdown and attach change listeners
    abilityDropdowns.forEach((dropdown, index) => {
      let previousValue = dropdown.value; // Store the previously selected value

      HM.log(`Initial previousValue for dropdown ${index}:`, previousValue);

      dropdown.addEventListener('change', (event) => {
        const selectedValue = event.target.value;
        HM.log(`New selectedValue for dropdown ${index}:`, selectedValue);

        // Handle removal of the previously selected ability
        if (previousValue && selectedAbilities.has(previousValue)) {
          selectedAbilities.delete(previousValue);
          HM.log(`Removed previousValue from selectedAbilities:`, previousValue);
        }

        // Add the new selected ability to the set (unless it's "N/A" or empty)
        if (selectedValue) {
          selectedAbilities.add(selectedValue);
          HM.log(`Added selectedValue to selectedAbilities:`, selectedValue);
        }

        // Update the dropdown's previous value
        previousValue = selectedValue;
        HM.log(`Updated previousValue for dropdown ${index}:`, previousValue);

        // Update all dropdowns to disable or enable options based on selected abilities
        abilityDropdowns.forEach((dropdown, idx) => {
          const currentValue = dropdown.value;
          HM.log(`Current value for dropdown ${idx}:`, currentValue);

          dropdown.querySelectorAll('option').forEach((option) => {
            if (selectedAbilities.has(option.value) && option.value !== currentValue) {
              option.disabled = true; // Disable options that are already selected in other dropdowns
              HM.log(`Disabled option:`, option.value);
            } else {
              option.disabled = false; // Re-enable options that haven't been selected
              HM.log(`Enabled option:`, option.value);
            }
          });
        });
      });
    });
  }

  /* Getter to setup tabs with builtin foundry functionality. */
  get tabsData() {
    let tabsData = {
      start: {
        id: 'start',
        group: 'hero-mancer-tabs',
        icon: 'fa-solid fa-play-circle fa-2xs',
        label: `${game.i18n.localize(`${HM.ABRV}.app.tab-names.start`)}`,
        active: true,
        cssClass: 'active'
      },
      background: {
        id: 'background',
        group: 'hero-mancer-tabs',
        icon: 'fa-solid fa-scroll fa-2xs',
        label: `${game.i18n.localize(`${HM.ABRV}.app.tab-names.background`)}`,
        active: false,
        cssClass: ''
      },
      race: {
        id: 'race',
        group: 'hero-mancer-tabs',
        icon: 'fa-solid fa-feather-alt fa-2xs',
        label: `${game.i18n.localize(`${HM.ABRV}.app.tab-names.race`)}`,
        active: false,
        cssClass: ''
      },
      class: {
        id: 'class',
        group: 'hero-mancer-tabs',
        icon: 'fa-solid fa-chess-rook fa-2xs',
        label: `${game.i18n.localize(`${HM.ABRV}.app.tab-names.class`)}`,
        active: false,
        cssClass: ''
      },
      abilities: {
        id: 'abilities',
        group: 'hero-mancer-tabs',
        icon: 'fa-solid fa-fist-raised fa-2xs',
        label: `${game.i18n.localize(`${HM.ABRV}.app.tab-names.abilities`)}`,
        active: false,
        cssClass: ''
      },
      equipment: {
        id: 'equipment',
        group: 'hero-mancer-tabs',
        icon: 'fa-solid fa-shield-halved fa-2xs',
        label: `${game.i18n.localize(`${HM.ABRV}.app.tab-names.equipment`)}`,
        active: false,
        cssClass: ''
      },
      finalize: {
        id: 'finalize',
        group: 'hero-mancer-tabs',
        icon: 'fa-solid fa-check-circle fa-2xs',
        label: `${game.i18n.localize(`${HM.ABRV}.app.tab-names.finalize`)}`,
        active: false,
        cssClass: ''
      }
    };
    return tabsData;
  }

  /* Logic for changing tabs. */
  changeTab(...args) {
    HM.log(`Changing tabs with args:`, args);

    // Set position to auto to adapt to the new tab's height
    let autoPos = { ...this.position, height: 'auto' };
    this.setPosition(autoPos);
    super.changeTab(...args);

    // After tab is changed, recalculate and set the new height
    let newPos = { ...this.position, height: this.element.scrollHeight };
    this.setPosition(newPos);

    HM.log(`Tab changed. New position set:`, newPos);
  }

  /* Logic for rolling stats and updating input fields. */
  static async rollStat(event, form) {
    HM.log(`Rolling stats for 4d6kh3.`);

    try {
      // Roll formula: 4d6kh3 (roll 4d6 and keep highest 3)
      const roll = new Roll('4d6kh3');
      await roll.evaluate({ async: true });

      HM.log(`Roll result:`, roll.total);

      // Get the clicked dice icon from the form
      const diceIcon = form;

      // Get the data-index from the clicked dice icon
      const index = diceIcon.getAttribute('data-index');
      HM.log(`Dice icon clicked for index:`, index);

      // Use the index to find the correct ability block by ID
      const abilityBlock = document.getElementById(`ability-block-${index}`);

      if (abilityBlock) {
        // Find the input field within the ability block
        const input = abilityBlock.querySelector('.ability-score');

        if (input) {
          // Set the rolled total as the value of the input field
          input.value = roll.total;
          input.focus(); // Optionally focus the input after updating
          HM.log(`Updated input value for ability index ${index} with roll total:`, roll.total);
        } else {
          HM.log(`No input field found within ability-block for index ${index}.`, 'error');
        }
      } else {
        HM.log(`No ability-block found for index ${index}.`, 'error');
      }
    } catch (error) {
      HM.log(`Error while rolling stat:`, error, 'error');
    }
  }

  /* Function for handling form data collection and logging the results. */
  static async formHandler(event, form, formData) {
    HM.log(`Processing form data...`);

    // Log the full formData object
    HM.log(`FORMDATA:`, [formData.object]);

    // Log individual form values
    HM.log(`NAME:`, formData.object.name);
    HM.log(`BACKGROUND:`, formData.object.background);
    HM.log(`RACE:`, formData.object.race);
    HM.log(`CLASS:`, formData.object.class);
    HM.log(`EQUIPMENT:`, formData.object.equipment);

    // Initialize an object to store abilities
    let abilities = {};

    // Iterate over formData to find and collect ability scores
    for (const key in formData.object) {
      if (formData.object.hasOwnProperty(key)) {
        // Match keys in the format abilities[abilityKey].score
        const abilityMatch = key.match(/^abilities\[(\w+)\]\.score$/);

        if (abilityMatch) {
          const abilityKey = abilityMatch[1]; // Extract ability key (e.g., "str", "dex")
          abilities[abilityKey] = formData.object[key]; // Assign the score to the ability key
          HM.log(`Collected ability score for ${abilityKey}:`, formData.object[key]);
        }
      }
    }

    // Log the simplified abilities object with scores
    HM.log(`EXTRACTED ABILITIES:`, abilities);

    // Further processing or validation of abilities (if necessary)
    for (const abilityKey in abilities) {
      if (abilities.hasOwnProperty(abilityKey)) {
        const score = abilities[abilityKey];
        HM.log(`Ability: ${abilityKey}, Score: ${score}`);
      }
    }
  }
}
