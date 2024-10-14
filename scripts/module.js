import { CCUtils } from './utils.js';
import { registerSettings } from './settings.js';

export class CCreator {
  static ID = 'character-creator';
  static TITLE = 'Character Creator';
  static ABRV = 'cc';

  static initialize() {
    this.charactorCreator = new CharacterCreator();
    console.info(`${CCreator.ID} | Initializing Module`);
    registerSettings();
    console.info(`${CCreator.ID} | Registering Settings`);
  }
}

Hooks.on('init', () => {
  CCreator.initialize();
});

Hooks.once('changeSidebarTab', () => {
  if (!game.settings.get(CCreator.ID, 'enable')) {
    return;
  }
  /* Find the create folder button and inject CCreator button before it */
  $('section[class*="actors-sidebar"]')
    .find('header[class*="directory-header"]')
    .find('div[class*="header-actions"]')
    .find('button[class*="create-folder"]')
    .before(
      `<button
        type='button'
        class='${CCreator.ABRV}-actortab-button'
        title='${game.i18n.localize(`${CCreator.ABRV}.creator.actortab-button.hint`)}'>
          <i class='fa-solid fa-egg' style='color: #ff144f'></i> 
        ${game.i18n.localize(`${CCreator.ABRV}.creator.actortab-button.name`)}
      </button>`
    );

  $(document).on('click', `.${CCreator.ABRV}-actortab-button`, (event) => {
    CCreator.charactorCreator.render(true);
  });
});

/* Hooks.once('ready', async function () {
  try {
    // Fetch races, classes, and backgrounds and store in CCreator
    CCreator.race = await CCUtils.getDocuments('race');
    CCreator.class = await CCUtils.getDocuments('class');
    CCreator.background = await CCUtils.getDocuments('background');

    console.log(`${CCreator.ID} | Race Data:`, CCreator.race);
    console.log(`${CCreator.ID} | Class Data:`, CCreator.class);
    console.log(`${CCreator.ID} | Background Data:`, CCreator.background);
  } catch (error) {
    console.error(`${CCreator.ID} | Error fetching documents:`, error);
  }
}); */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
class CharacterCreator extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${CCreator.ID}`,
    tag: 'form',
    form: {
      handler: CharacterCreator.formHandler,
      closeOnSubmit: true, // do not close when submitted
      submitOnChange: false // submit when any input changes
    },
    actions: {},
    classes: ['cc-creator'],
    position: {
      height: 'auto',
      width: 'auto'
    },
    window: {
      icon: 'fa-solid fa-hammer',
      resizable: false
    }
  };

  get title() {
    return `${CCreator.TITLE} | ${game.user.name}`;
  }
  static PARTS = {
    header: {
      template: `modules/${CCreator.ID}/templates/creator-header.hbs`,
      id: `header`,
      classes: ['cc-creator-header']
    },
    nav: {
      template: `modules/${CCreator.ID}/templates/creator-nav.hbs`,
      id: `nav`,
      classes: ['cc-creator-nav']
    },
    welcome: {
      template: `modules/${CCreator.ID}/templates/creator-getting-started.hbs`,
      id: `getting-started`
    },
    race: {
      template: `modules/${CCreator.ID}/templates/creator-race.hbs`,
      id: `race`
    },
    class: {
      template: `modules/${CCreator.ID}/templates/creator-class.hbs`,
      id: `class`
    },
    background: {
      template: `modules/${CCreator.ID}/templates/creator-background.hbs`,
      id: `background`
    },

    abilities: {
      template: `modules/${CCreator.ID}/templates/creator-abilities.hbs`,
      id: `abilities`
    },
    equipment: {
      template: `modules/${CCreator.ID}/templates/creator-equipment.hbs`,
      id: `equipment`
    },
    finalize: {
      template: `modules/${CCreator.ID}/templates/creator-finalize.hbs`,
      id: `finalize`
    },
    footer: {
      template: `modules/${CCreator.ID}/templates/creator-footer.hbs`,
      id: `footer`,
      classes: ['cc-creator-footer']
    }
  };

  async _prepareContext(options) {
    console.info(`${CCreator.ID} | Preparing context...`);

    // Use the new CCUtils methods to register races, classes, and backgrounds
    const raceDocuments = await CCUtils.registerRaces();
    const classDocuments = await CCUtils.registerClasses();
    const backgroundDocuments = await CCUtils.registerBackgrounds();

    const context = {
      raceDocuments: raceDocuments,
      classDocuments: classDocuments,
      backgroundDocuments: backgroundDocuments,
      tabs: this.tabsData
    };
    //console.log('Context Before Enrichment:', context);
    const allDocuments = [...context.raceDocuments, ...context.classDocuments, ...context.backgroundDocuments];
    // Enrich all descriptions
    for (const doc of allDocuments) {
      if (doc && doc.description) {
        try {
          const enrichedDescription = await TextEditor.enrichHTML(doc.description);
          doc.enrichedDescription = enrichedDescription; // Add the enriched description
          console.info(`${CCreator.ID} | Enriched description for ${doc.name}`);
        } catch (error) {
          console.error(`Failed to enrich description for document ${doc.name}:`, error);
        }
      } else {
        console.warn(`No description found for document ${doc ? doc.name : 'undefined'}`);
      }
    }
    //console.log('Context After Enrichment:', context);
    return context;
  }

  async _preparePartContext(partId, context) {
    //context = await super._preparePartContext(partId, context);
    context.partId = `${this.id}-${partId}`;
    return context;
  }

  _onRender(context, options) {
    //console.log('Context in _onRender:', context); // Log the context to ensure it contains classDocuments

    this._addDescriptionUpdateListeners(context, 'class');
    this._addDescriptionUpdateListeners(context, 'race');
    this._addDescriptionUpdateListeners(context, 'background');
  }

  _addDescriptionUpdateListeners(context, type) {
    const dropdown = this.element.querySelector(`#${type}-dropdown`);

    if (dropdown) {
      dropdown.addEventListener('change', async (event) => {
        const selectedId = event.target.value;

        if (!selectedId) {
          const descriptionElement = this.element.querySelector(`#${type}-description`);
          if (descriptionElement) descriptionElement.innerHTML = '';
          return;
        }

        // Find the selected document in the context
        const documentsKey = `${type}Documents`;
        const selectedDoc = context[documentsKey].find((doc) => doc.id === selectedId);

        if (selectedDoc && selectedDoc.enrichedDescription) {
          const descriptionElement = this.element.querySelector(`#${type}-description`);
          descriptionElement.innerHTML = selectedDoc.enrichedDescription;
        } else {
          const descriptionElement = this.element.querySelector(`#${type}-description`);
          if (descriptionElement) descriptionElement.innerHTML = 'No description available';
        }
      });
    }
  }

  get tabsData() {
    let tabsData = {
      welcome: {
        id: 'welcome',
        group: 'creator-tabs',
        icon: 'fa-solid fa-play-circle',
        label: 'Getting Started',
        active: true,
        cssClass: 'active'
      },
      race: {
        id: 'race',
        group: 'creator-tabs',
        icon: 'fa-solid fa-feather-alt',
        label: 'Race',
        active: false,
        cssClass: ''
      },
      class: {
        id: 'class',
        group: 'creator-tabs',
        icon: 'fa-solid fa-chess-rook',
        label: 'Class',
        active: false,
        cssClass: ''
      },
      background: {
        id: 'background',
        group: 'creator-tabs',
        icon: 'fa-solid fa-scroll',
        label: 'Background',
        active: false,
        cssClass: ''
      },
      abilities: {
        id: 'abilities',
        group: 'creator-tabs',
        icon: 'fa-solid fa-fist-raised',
        label: 'Abilities',
        active: false,
        cssClass: ''
      },
      equipment: {
        id: 'equipment',
        group: 'creator-tabs',
        icon: 'fa-solid fa-shield-halved',
        label: 'Equipment',
        active: false,
        cssClass: ''
      },
      finalize: {
        id: 'finalize',
        group: 'creator-tabs',
        icon: 'fa-solid fa-check-circle',
        label: 'Finalize',
        active: false,
        cssClass: ''
      }
    };
    console.log(`Tabs Data:`, tabsData);
    return tabsData;
  }
  changeTab(...args) {
    let autoPos = { ...this.position, height: 'auto' };
    this.setPosition(autoPos);
    super.changeTab(...args);
    let newPos = { ...this.position, height: this.element.scrollHeight };
    this.setPosition(newPos);
  }
  static async formHandler(event, form, formData) {
    console.log('Form handler triggered.');
    // Handling for whatever is done on the form.
  }
}
