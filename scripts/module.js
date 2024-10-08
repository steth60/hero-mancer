import { CCUtils } from './utils.js';
import { registerSettings } from './settings.js';

export class CCreator {
  static ID = 'character-creator';
  static TITLE = 'Character Creator';
  static ABRV = 'cc';
  static TEMPLATES = {
    SETTINGS: `modules/${this.ID}/templates/settings.hbs`,
    CREATOR: `modules/${this.ID}/templates/creator.hbs`,
    CREATORHEADER: `modules/${this.ID}/templates/creator_header.hbs`,
    CREATORFOOTER: `modules/${this.ID}/templates/creator_footer.hbs`,
    CREATORTABS: `modules/${this.ID}/templates/creator_tabs.hbs`
  };
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
    position: {
      height: 'auto',
      width: 'auto'
    },
    window: {
      icon: 'fa-solid fa-hammer',
      resizable: true
    }
  };
  get title() {
    return `${CCreator.TITLE} | ${game.user.name}`;
  }
  static PARTS = {
    header: {
      template: CCreator.TEMPLATES.CREATORHEADER,
      id: `${CCreator.ABRV}-creator-header`
    },
    form: {
      template: CCreator.TEMPLATES.CREATOR,
      id: `${CCreator.ABRV}-creator-form`,
      scrollable: ['']
    },
    footer: { template: CCreator.TEMPLATES.CREATORFOOTER, id: `${CCreator.ABRV}-creator-footer` }
  };
  _prepareContext(options) {
    return {
      race: CCreator.race ? CCreator.race.uniqueFolders : [],
      class: CCreator.class ? CCreator.class.noFolderItems : [],
      background: CCreator.background ? CCreator.background.noFolderItems : [],
      raceDocuments: CCreator.race ? CCreator.race.documents.concat(CCreator.race.noFolderItems) : [],
      classDocuments: CCreator.class ? CCreator.class.documents : [],
      backgroundDocuments: CCreator.background ? CCreator.background.documents : []
    };
  }

  _onRender(context, options) {
    const handleDropdownChange = (type) => {
      const dropdown = this.element.querySelector(`#${type}-dropdown`);
      const subcatDropdownContainer = this.element.querySelector(`#${type}-subcat-dropdown-container`);

      if (dropdown) {
        dropdown.addEventListener('change', (event) => {
          const selectedVal = event.target.value;

          // Clear any previous confirmation or sub-dropdown
          subcatDropdownContainer.innerHTML = '';

          // Access race data directly from CCreator
          const selectedFolder = CCreator[type].uniqueFolders.find((folder) => `folder-${folder.folderName}` === selectedVal);

          if (selectedFolder && selectedFolder.docs.length > 1) {
            // Create a second dropdown for races inside the selected folder
            const subcatDropdown = document.createElement('select');
            subcatDropdown.id = `${type}-subcategory-dropdown`;
            subcatDropdown.className = `${CCreator.ABRV}-creator-dropdown ${type}`;

            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = game.i18n.localize(`cc.creator.${type}.selectsubcategory`);
            subcatDropdown.appendChild(defaultOption);

            const sortedDocs = selectedFolder.docs.sort((a, b) => a.name.localeCompare(b.name));
            sortedDocs.forEach((doc) => {
              const option = document.createElement('option');
              option.value = doc.id;
              option.textContent = `${doc.name} (${doc.packName})`;
              subcatDropdown.appendChild(option);
            });

            subcatDropdownContainer.appendChild(subcatDropdown);

            // Add event listener for subcategory dropdown
            subcatDropdown.addEventListener('change', (e) => {
              const selectedDoc = sortedDocs.find((doc) => doc.id === e.target.value);
              const confirmText = document.createElement('div');
              confirmText.className = `${CCreator.ABRV}-select-container`; // Added class
              confirmText.textContent = `Selected ${type}: ${selectedDoc.name}`;
              subcatDropdownContainer.appendChild(confirmText); // Append confirmation text
            });
          } else if (selectedFolder && selectedFolder.docs.length === 1) {
            // If only one race exists in the folder, display it directly
            const confirmText = document.createElement('div');
            confirmText.className = `${CCreator.ABRV}-select-container`; // Added class
            confirmText.textContent = `Selected ${type}: ${selectedFolder.docs[0].name}`;
            subcatDropdownContainer.appendChild(confirmText);
          } else {
            // For class and background, directly show confirmation
            const selectedDoc = CCreator[type].documents.find((doc) => doc.id === selectedVal);
            if (selectedDoc) {
              const confirmText = document.createElement('div');
              confirmText.className = `${CCreator.ABRV}-select-container`; // Added class
              confirmText.textContent = `Selected ${type}: ${selectedDoc.name}`;
              subcatDropdownContainer.appendChild(confirmText);
            }
          }
        });
      }
    };

    // Call the handler for race, class, and background
    handleDropdownChange('race');
    handleDropdownChange('class');
    handleDropdownChange('background');
  }

  static async formHandler(event, form, formData) {
    // Handling for whatever is done on the form.
  }
}
