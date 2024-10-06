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
    const packs = game.packs.filter((i) => i.metadata.type === "Item");

    for (const pack of packs) {
      try {
        const documents = await pack.getDocuments({ type: type });

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

    const uniqueFolders = new Map();

    const sortedPackDocs = [...validPacks].map((doc) => {
      const folder = doc.folder;
      const folderName = folder ? folder.name : null;

      // Get the pack name from the game's packs collection
      const packKey = doc.pack; // This should give you the key (e.g., "some.pack.id")
      const packMetadata = game.packs.get(packKey);
      const packName = packMetadata
        ? packMetadata.metadata.label
        : `${game.i18n.localize("CCreator.Creator.unknown-pack")}`; // Retrieve the label

      if (folderName) {
        uniqueFolders.set(folderName, folderName); // Only store unique folder names
      }

      return {
        id: doc.id,
        name: doc.name,
        folderName, // Include folder name for further reference
        packName, // Include pack name in the returned structure
      };
    });

    // Sort the folder names alphabetically
    const uniqueFolderArray = Array.from(uniqueFolders.values()).sort((a, b) =>
      a.localeCompare(b)
    );

    return { documents: sortedPackDocs, uniqueFolders: uniqueFolderArray };
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
    return `${CCreator.TITLE} | ${game.user.name}`;
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
      template: "templates/generic/form-footer.hbs",
    },
    //footer: { template: CCreator.TEMPLATES.CREATORFOOTER, id: `${CCreator.ABRV}-CharacterCreator-footer` },
  };
  _prepareContext(options) {
    const { documents, uniqueFolders } = CCreator.race; // Ensure this is awaited if it's async

    return {
      race: uniqueFolders, // Use unique folder names directly for the dropdown
      documents, // Full document list for later use
      abrv: CCreator.ABRV,
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    const raceDropdown = this.element.querySelector("#race-dropdown");
    if (raceDropdown) {
      raceDropdown.addEventListener("change", (event) => {
        const selectedValue = event.target.value;

        const selectedFolderDocs = context.documents.filter(
          (doc) => doc.folderName === selectedValue
        );
        const subcategoryDropdownContainer = this.element.querySelector(
          "#race-subcategory-dropdown-container"
        );
        subcategoryDropdownContainer.innerHTML = ""; // Clear previous content
        const confirmationText = document.createElement("div"); // Create a div for confirmation

        if (selectedFolderDocs.length > 0) {
          const subcategoryDropdown = document.createElement("select");
          subcategoryDropdown.id = "race-subcategory-dropdown";
          subcategoryDropdown.className = `${CCreator.ABRV}-creator-dropdown race`;

          const defaultOption = document.createElement("option");
          defaultOption.value = "";
          defaultOption.textContent = game.i18n.localize(
            "CCreator.Creator.SelectRaceSubcategory"
          );
          subcategoryDropdown.appendChild(defaultOption);

          // Sort the documents alphabetically before adding to the dropdown
          const sortedFolderDocs = selectedFolderDocs.sort((a, b) =>
            a.name.localeCompare(b.name)
          );

          // Set the pack name for the tooltip
          const packName = sortedFolderDocs[0].packName; // Get the pack name from the first document
          subcategoryDropdown.title = `${game.i18n.localize(
            "CCreator.Creator.source-pack"
          )}: ${packName}`; // Set the tooltip

          sortedFolderDocs.forEach((doc) => {
            const option = document.createElement("option");
            option.value = doc.id;
            option.textContent = doc.name; // Use document name
            subcategoryDropdown.appendChild(option);
          });

          // Check if there's only one document
          if (sortedFolderDocs.length === 1) {
            /*             const singleDocDisplay = document.createElement('div');
            singleDocDisplay.textContent = `Selected: ${sortedFolderDocs[0].name}`; // Display selected value
            singleDocDisplay.title = `Source Pack: ${packName}`; // Set tooltip
            subcategoryDropdownContainer.appendChild(singleDocDisplay); // Add display element */

            // Set confirmation text only once
            confirmationText.textContent = `${game.i18n.localize(
              "CCreator.Creator.SelectedRace"
            )}: ${sortedFolderDocs[0].name}`; // Confirm selection
            confirmationText.title = `Source Pack: ${packName}`; // Set tooltip for confirmation
            subcategoryDropdownContainer.appendChild(confirmationText); // Add confirmation text
          } else {
            subcategoryDropdownContainer.appendChild(subcategoryDropdown); // Append dropdown normally

            // Add an event listener to the subcategory dropdown
            subcategoryDropdown.addEventListener("change", (e) => {
              const selectedDoc = sortedFolderDocs.find(
                (doc) => doc.id === e.target.value
              );
              confirmationText.textContent = `${game.i18n.localize(
                "CCreator.Creator.SelectedRace"
              )}: ${selectedDoc.name}`; // Confirm selection
              confirmationText.title = `${game.i18n.localize(
                "CCreator.Creator.source-pack"
              )}: ${packName}`; // Set tooltip for confirmation
              subcategoryDropdownContainer.appendChild(confirmationText); // Add confirmation text
            });
          }
        }
      });
    }
  }

  static async formHandler(event, form, formData) {
    // Handling for whatever is done on the form.
  }
}
