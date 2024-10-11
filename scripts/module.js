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
          <i class='fas fa-hammer' style='color: #ff144f'></i> 
        ${game.i18n.localize(`${CCreator.ABRV}.creator.actortab-button.name`)}
      </button>`
    );

  $(document).on('click', `.${CCreator.ABRV}-actortab-button`, (event) => {
    CCreator.charactorCreator.render(true);
  });
});

Hooks.once('ready', async function () {
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
});

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
      id: `${CCreator.ABRV}-creator-header`
    },
    nav: {
      template: `modules/${CCreator.ID}/templates/creator-nav.hbs`,
      id: `${CCreator.ABRV}-creator-nav`
    },
    welcome: {
      template: `modules/${CCreator.ID}/templates/creator-getting-started.hbs`,
      id: `${CCreator.ABRV}-creator-getting-started`
    },
    class: {
      template: `modules/${CCreator.ID}/templates/creator-class.hbs`,
      id: `${CCreator.ABRV}-creator-class`
    },
    background: {
      template: `modules/${CCreator.ID}/templates/creator-background.hbs`,
      id: `${CCreator.ABRV}-creator-background`
    },
    race: {
      template: `modules/${CCreator.ID}/templates/creator-race.hbs`,
      id: `${CCreator.ABRV}-creator-race`
    },
    abilities: {
      template: `modules/${CCreator.ID}/templates/creator-abilities.hbs`,
      id: `${CCreator.ABRV}-creator-abilities`
    },
    equipment: {
      template: `modules/${CCreator.ID}/templates/creator-equipment.hbs`,
      id: `${CCreator.ABRV}-creator-equipment`
    },
    finalize: {
      template: `modules/${CCreator.ID}/templates/creator-finalize.hbs`,
      id: `${CCreator.ABRV}-creator-finalize`
    },
    footer: {
      template: `modules/${CCreator.ID}/templates/creator-footer.hbs`,
      id: `${CCreator.ABRV}-creator-footer`
    }
  };

  async _prepareContext(options) {
    console.log('Preparing context...');
    return {
      race: CCreator.race ? CCreator.race.uniqueFolders : [],
      class: CCreator.class ? CCreator.class.noFolderItems : [],
      background: CCreator.background ? CCreator.background.noFolderItems : [],
      raceDocuments: CCreator.race ? CCreator.race.documents.concat(CCreator.race.noFolderItems) : [],
      classDocuments: CCreator.class ? CCreator.class.documents : [],
      backgroundDocuments: CCreator.background ? CCreator.background.documents : [],
      tabs: this.tabsData
    };
  }

  async _preparePartContext(partId, context) {
    //context = await super._preparePartContext(partId, context);
    context.partId = `${this.id}-${partId}`;
    return context;
  }

  _onRender(context, options) {
    CCUtils.handleDropdownChange('race', this.element);
    CCUtils.handleDropdownChange('class', this.element);
    CCUtils.handleDropdownChange('background', this.element);
  }

  get tabsData() {
    let tabsData = {
      welcome: {
        id: 'welcome',
        group: 'creator-tabs',
        icon: 'fa-solid fa-hammer',
        label: 'Getting Started',
        active: true,
        cssClass: 'active'
      },
      class: {
        id: 'class',
        group: 'creator-tabs',
        icon: 'fa-solid fa-dice-d20',
        label: 'Class',
        active: false,
        cssClass: ''
      },
      background: {
        id: 'background',
        group: 'creator-tabs',
        icon: 'fa-solid fa-globe',
        label: 'Background',
        active: false,
        cssClass: ''
      },
      race: {
        id: 'race',
        group: 'creator-tabs',
        icon: 'fa-solid fa-person',
        label: 'Race',
        active: false,
        cssClass: ''
      },
      abilities: {
        id: 'abilities',
        group: 'creator-tabs',
        icon: 'fa-solid fa-dice-d6',
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
        icon: 'fa-solid fa-clipboard-list',
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
