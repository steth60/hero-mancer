import { CCreatorSettings } from './settings.js';

export class CCreator {
  static ID = 'character-creator';
  static TITLE = 'Character Creator';
  static ABRV = 'cc';
  static TEMPLATES = {
    SETTINGS: `modules/${this.ID}/templates/settings.hbs`,
    CREATOR: `modules/${this.ID}/templates/creator.hbs`,
    CREATORHEADER: `modules/${this.ID}/templates/creator_header.hbs`,
    CREATORFOOTER: `modules/${this.ID}/templates/creator_footer.hbs`,
    CREATORTABS: `modules/${this.ID}/templates/creator_tabs.hbs`,
  };
  static initialize() {
    this.charactorCreator = new CharacterCreator();
    CCreatorSettings.registerSettings();
  }
}

Hooks.on('init', () => {
  CCreator.initialize();
});

Hooks.once('changeSidebarTab', () => {
  if (!game.settings.get(CCreator.ID, CCreatorSettings.SETTINGS.ENABLE)) {
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
        title='${game.i18n.localize('CCreator.Creator.actortab-button.Hint')}'>
          <i class='fas fa-hammer' style='color: #ff144f'></i> 
        ${game.i18n.localize('CCreator.Creator.actortab-button.Name')}
      </button>`
    );

  const gameId = game.user.id;

  $(document).on('click', `.${CCreator.ABRV}-actortab-button`, (event) => {
    CCreator.charactorCreator.render(true, { gameId });
  });
});

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;
class CharacterCreator extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${CCreator.ID}`,
    tag: 'form',
    form: {
      handler: CharacterCreator.formHandler,
      closeOnSubmit: false, // do not close when submitted
      submitOnChange: true, // submit when any input changes
      submitOnClose: true, // submit on close
    },
    actions: {},
    position: {
      height: 'auto',
      width: 'auto',
    },
    window: {
      icon: 'fas fa-note-sticky',
      resizable: false,
    },
    classes: [`${CCreator.ABRV}`],
  };
  get title() {
    return `${CCreator.TITLE} | ${game.i18n.localize('CCreator.Creator.header-text')}: (${game.user.name})`;
  }
  static PARTS = {
    header: { template: CCreator.TEMPLATES.CREATORHEADER },
    form: {
      template: CCreator.TEMPLATES.CREATOR,
    },
  };
  _prepareContext(options) {
    // const reminders = ReminderData.getReminders(game.userId);
    // console.log('REMINDER DATA PREPARE CONTEXT: ', ReminderData.getRemindersForUser(game.userId));
    return {
      //Whatever data you need in handlebars must be here.
    };
  }
  static async formHandler(event, form, formData) {
    // Handling for whatever is done on the form.
  }
}
