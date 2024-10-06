import { registerSettings } from "./settings.js";

export class CCreator {
  static ID = "character-creator";
  static TITLE = "Character Creator";
  static ABRV = "cc";
  static TEMPLATES = {
    SETTINGS: `modules/${this.ID}/templates/settings.hbs`,
    CREATOR: `modules/${this.ID}/templates/creator.hbs`,
    CREATORHEADER: `modules/${this.ID}/templates/creator_header.hbs`,
    CREATORFOOTER: `modules/${this.ID}/templates/creator_footer.hbs`,
    CREATORTABS: `modules/${this.ID}/templates/creator_tabs.hbs`,
  };
  static initialize() {
    this.charactorCreator = new CharacterCreator();
    console.info(`${CCreator.ID} | Initializing Module`);
    registerSettings();
    console.info(`${CCreator.ID} | Registering Settings`);
  }
}

Hooks.on("init", () => {
  CCreator.initialize();
});

Hooks.once("changeSidebarTab", () => {
  if (!game.settings.get(CCreator.ID, "enable")) {
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
        title='${game.i18n.localize("CCreator.Creator.actortab-button.Hint")}'>
          <i class='fas fa-hammer' style='color: #ff144f'></i> 
        ${game.i18n.localize("CCreator.Creator.actortab-button.Name")}
      </button>`
    );

  $(document).on("click", `.${CCreator.ABRV}-actortab-button`, (event) => {
    CCreator.charactorCreator.render(true);
  });
});

Hooks.once("ready", async function () {
  try {
    CCreator.race = await CCUtils.getDocuments("race");
    CCreator.class = await CCUtils.getDocuments("class");
    CCreator.background = await CCUtils.getDocuments("background");
  } catch (error) {
    console.error(error.message);
  }
});

class CCUtils {
  static async getDocuments(type) {
    if (typeof type !== "string" || type.trim() === "") {
      throw new Error("Invalid argument: expected a non-empty string.");
    }
    console.log("Valid document type:", type);

    const validPacks = new Set();

    // Filter for packs of type 'Item' (adjust this if you're looking for a different type)
    const packs = game.packs.filter((i) => i.metadata.type === "Item");

    for (const pack of packs) {
      try {
        // Fetch documents of type 'class'
        const documents = await pack.getDocuments({ type: type });

        // Add each document to the Set to ensure uniqueness
        for (const doc of documents) {
          validPacks.add(doc);
        }
      } catch (error) {
        console.error(
          `Failed to retrieve documents from pack ${pack.metadata.label}:`,
          error
        );
      }
    }

    const sortedPackDocs = [...validPacks].sort((a, b) => {
      return a.name.localeCompare(b.name);
    });

    return sortedPackDocs;
  }
}

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
class CharacterCreator extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${CCreator.ID}`,
    tag: "form",
    form: {
      handler: CharacterCreator.formHandler,
      closeOnSubmit: true, // do not close when submitted
      submitOnChange: false, // submit when any input changes
    },
    actions: {},
    position: {
      height: "auto",
      width: "auto",
    },
    window: {
      icon: "fas fa-hammer",
      resizable: false,
    },
  };
  get title() {
    return `${CCreator.TITLE} | ${game.i18n.localize(
      "CCreator.Creator.header-title"
    )}: ${game.user.name}`;
  }
  static PARTS = {
    header: { template: CCreator.TEMPLATES.CREATORHEADER, id: `${CCreator.ABRV}-CharacterCreator-header` },
    form: { template: CCreator.TEMPLATES.CREATOR, id: `${CCreator.ABRV}-CharacterCreator-form`, scrollable: [''] },
    //footer: { template: CCreator.TEMPLATES.CREATORFOOTER, id: `${CCreator.ABRV}-CharacterCreator-footer` },
  };
  _prepareContext(options) {
    // const reminders = ReminderData.getReminders(game.userId);
    // console.log('REMINDER DATA PREPARE CONTEXT: ', ReminderData.getRemindersForUser(game.userId));
    return {
      race: CCreator.race,
      class: CCreator.class,
      background: CCreator.background
    };
  }
  static async formHandler(event, form, formData) {
    // Handling for whatever is done on the form.
  }
}
