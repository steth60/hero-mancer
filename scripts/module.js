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
    console.log(`${CCreator.ID} | RACES: ${CCreator.race}`)
    //CCreator.class = await CCUtils.getDocuments("class");
    //CCreator.background = await CCUtils.getDocuments("background");
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
    console.log("Valid Packs:", validPacks);
    // Filter for packs of type 'Item' (adjust this if you're looking for a different type)
    const packs = game.packs.filter((i) => i.metadata.type === "Item");
    console.log("Packs:", packs);
    for (const pack of packs) {
      try {
        // Fetch documents of type 'class'
        const documents = await pack.getDocuments({ type: type });
        console.log("Documents:", documents);
        // Add each document to the Set to ensure uniqueness
        for (const doc of documents) {
          console.log("Doc:", doc);
          validPacks.add(doc);
          console.log("ValidPacks.Add:", validPacks);
        }
      } catch (error) {
        console.error(
          `Failed to retrieve documents from pack ${pack.metadata.label}:`,
          error
        );
      }
    }

    const sortedPackDocs = [...validPacks].map((doc) => {
      const folder = doc.folder;
      console.log("Folder", folder);
      const folderDocs = folder ? folder.contents : [];
      console.log("Folder Docs:", folderDocs);
      const folderName = folder && folderDocs.length > 1 ? `${folder.name}:` : "";
      console.log("Folder Name:", folderName);
      return { name: folderName + doc.name, doc };
    });

    sortedPackDocs.sort((a, b) => a.name.localeCompare(b.name));
    console.log("Sorted Pack Docs:", sortedPackDocs);

    return sortedPackDocs.map((entry) => entry.doc);
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
    header: {
      template: CCreator.TEMPLATES.CREATORHEADER,
      id: `${CCreator.ABRV}-CharacterCreator-header`,
    },
    form: {
      template: CCreator.TEMPLATES.CREATOR,
      id: `${CCreator.ABRV}-CharacterCreator-form`,
      scrollable: [""],
    },
    footer: {
      template: "templates/generic/form-footer.hbs"
    }
    //footer: { template: CCreator.TEMPLATES.CREATORFOOTER, id: `${CCreator.ABRV}-CharacterCreator-footer` },
  };
  _prepareContext(options) {
    function prepareDataWithFolder(documents) {
      const folderMap = new Map();
  
      documents.forEach((doc) => {
        const folderName = doc.folder?.name || "Uncategorized"; // No prefix added here
        if (!folderMap.has(folderName)) {
          folderMap.set(folderName, []);
        }
        folderMap.get(folderName).push(doc);
      });
  
      return Array.from(folderMap.entries()).map(([folderName, items]) => ({
        folderName, // Keep this clean
        items,
        hasMultipleItems: items.length > 1,
      }));
    }
    buttons: [
      { type: "submit", icon: "fa-solid fa-save", label: "SETTINGS.Save" },
      { type: "cancel", icon: "fa-solid fa-cancel", label: "SETTINGS.Cancel"}
  ]
  
    return {
      race: prepareDataWithFolder(CCreator.race),
      class: prepareDataWithFolder(CCreator.class),
      background: prepareDataWithFolder(CCreator.background),
      abrv: CCreator.ABRV,
    };
  }
  
  _onRender(context, options) {
    // Call the parent class's _onRender if necessary
    super._onRender(context, options);

    // Race dropdown listener
    const raceDropdown = this.element.querySelector("#race-dropdown");
    console.log("Race Dropdown:", raceDropdown);
    if (raceDropdown) {
      raceDropdown.addEventListener("change", (event) => {
        const selectedValue = event.target.value;
        console.log("Selected value:", selectedValue); // Log the selected value
      
        // Check if a folder was selected (i.e., value starts with 'folder-')
        if (selectedValue.startsWith("folder-")) {
          const folderName = selectedValue.split("folder-")[1]; // Extract folder name cleanly
          console.log("Selected folder:", folderName); // Log the folder name
          console.log("Available Folders:", CCreator.race.map(f => f.folderName)); // Log all folder names

          // Find the corresponding folder items in the race data
          const selectedFolder = CCreator.race.find(f => f.folderName === folderName);
          console.log("Selected Folder:", selectedFolder)
          if (selectedFolder) {
            console.log("Folder items:", selectedFolder.items); // Log folder items
            const subcategoryDropdownContainer = this.element.querySelector("#race-subcategory-dropdown-container");
            console.log("Subcategory Dropdown Container:", subcategoryDropdownContainer);
            
            // Populate the subcategory dropdown
            subcategoryDropdownContainer.innerHTML = `
              <select id="race-subcategory-dropdown" class="${CCreator.ABRV}-creator-dropdown race">
                <option value="">${game.i18n.localize("CCreator.Creator.SelectRaceSubcategory")}</option>
                ${selectedFolder.items.map(item => `<option value="${item.id}">${item.name}</option>`).join('')}
              </select>
            `;
            //this.render();
          }
        } else {
          // If not a folder, clear the subcategory dropdown
          const subcategoryDropdownContainer = this.element.querySelector("#race-subcategory-dropdown-container");
          subcategoryDropdownContainer.innerHTML = "";
        }
      });
      
    }

    // Repeat the same for class-dropdown and background-dropdown if needed
  }

  static async formHandler(event, form, formData) {
    // Handling for whatever is done on the form.
  }
}
