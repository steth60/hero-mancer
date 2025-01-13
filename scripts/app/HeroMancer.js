import { HM } from '../hero-mancer.js';
import { CacheManager, DocumentService, DropdownHandler, EquipmentParser, Listeners, StatRoller } from '../utils/index.js';
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
// const { AdvancementManager } = dnd5e.applications.advancement;

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
      increaseScore: HeroMancer.increaseScore,
      selectCharacterArt: this.selectCharacterArt,
      selectTokenArt: this.selectTokenArt
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
      diceRollingMethod === 'standardArray'
        ? game.settings.get(HM.ID, 'customStandardArray').split(',').map(Number)
        : StatRoller.getStandardArray(extraAbilities);
    const totalPoints = StatRoller.getTotalPoints();
    const remainingPoints = Listeners.updateRemainingPointsDisplay(HeroMancer.selectedAbilities);

    // Check if cached data is available to avoid re-fetching
    if (CacheManager.isCacheValid()) {
      HM.log(3, 'Documents cached and descriptions enriched!');
      return {
        raceDocs: CacheManager.getCachedRaceDocs(),
        classDocs: CacheManager.getCachedClassDocs(),
        backgroundDocs: CacheManager.getCachedBackgroundDocs()
      };
    }

    ui.notifications.info('hm.actortab-button.loading', { localize: true });

    const { types: raceDocs } = await DocumentService.prepDocs('race');
    const { types: classDocs } = await DocumentService.prepDocs('class');
    const { types: backgroundDocs } = await DocumentService.prepDocs('background');

    const abilities = Object.entries(CONFIG.DND5E.abilities).map(([key, value]) => ({
      key,
      abbreviation: value.abbreviation.toUpperCase(),
      currentScore: 8
    }));

    const context = {
      raceDocs,
      classDocs,
      backgroundDocs,
      tabs: this._getTabs(options.parts),
      abilities,
      rollStat: this.rollStat,
      diceRollMethod: diceRollingMethod,
      standardArray: standardArray,
      selectedAbilities: HeroMancer.selectedAbilities,
      remainingPoints: remainingPoints,
      totalPoints: totalPoints
      // equipmentData: {} // Include parsed equipment data for later use
    };

    const allDocs = [
      ...(context.raceDocs?.flatMap((folder) => folder.docs) || []),
      ...(context.classDocs?.flatMap((pack) => pack.docs) || []),
      ...(context.backgroundDocs?.flatMap((pack) => pack.docs) || [])
    ];
    for (const doc of allDocs) {
      if (doc?.description) {
        try {
          // Enrich description
          doc.enrichedDescription = await TextEditor.enrichHTML(doc.description);
        } catch (error) {
          HM.log(1, `${HM.ID} | Error enriching description or processing starting equipment for '${doc.name}':`, error);
        }
      }
    }

    CacheManager.cacheDocuments({
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
      case 'background':
      case 'race':
      case 'class':
        context.tab = context.tabs[partId];
        break;
      case 'abilities':
        context.tab = context.tabs[partId];
        const totalPoints = StatRoller.getTotalPoints();
        const pointsSpent = StatRoller.calculatePointsSpent(HeroMancer.selectedAbilities);
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
    DropdownHandler.initializeDropdown({ type: 'class', html, context });
    DropdownHandler.initializeDropdown({ type: 'race', html, context });
    DropdownHandler.initializeDropdown({ type: 'background', html, context });

    const abilityDropdowns = html.querySelectorAll('.ability-dropdown');
    const selectedAbilities = Array.from(abilityDropdowns).map(() => ''); // Initialize with empty strings

    const totalPoints = StatRoller.getTotalPoints();

    // Set up event listeners and initial dropdown state based on mode
    abilityDropdowns.forEach((dropdown, index) => {
      dropdown.addEventListener('change', (event) => {
        selectedAbilities[index] = event.target.value || ''; // Store selected ability name/abbreviation
        DropdownHandler.updateAbilityDropdowns(
          abilityDropdowns,
          selectedAbilities,
          totalPoints,
          context.diceRollMethod === 'pointBuy' ? 'pointBuy' : 'manualFormula'
        );
      });
    });

    // Initial update on render
    DropdownHandler.updateAbilityDropdowns(
      abilityDropdowns,
      selectedAbilities,
      totalPoints,
      context.diceRollMethod === 'pointBuy' ? 'pointBuy' : 'manualFormula'
    );
    Listeners.updatePlusButtonState(context.remainingPoints);
    Listeners.updateMinusButtonState();

    // Assuming dropdown elements have IDs #classDropdown, #raceDropdown, and #backgroundDropdown
    const classId = document.querySelector('#class-dropdown').value;
    const backgroundId = document.querySelector('#background-dropdown').value;

    // Target container where equipment choices will be appended
    const equipmentContainer = document.querySelector('#equipment-container');

    // Initial render of equipment choices (renders both class and background)
    const equipment = new EquipmentParser(classId, backgroundId);
    equipment
      .renderEquipmentChoices()
      .then((equipmentChoices) => {
        equipmentContainer.appendChild(equipmentChoices);
      })
      .catch((error) => {
        console.error('Error rendering initial equipment choices:', error);
      });

    // Separate event listeners for class and background dropdowns
    document.querySelector('#class-dropdown').addEventListener('change', async (event) => {
      const selectedValue = event.target.value;
      DropdownHandler.selectionStorage.class = {
        selectedValue,
        selectedId: selectedValue.split(' ')[0] // Extract the item ID
      };
      equipment.classId = DropdownHandler.selectionStorage.class.selectedId;
      HM.log(3, 'SELECTION STORAGE UPDATED (class):', DropdownHandler.selectionStorage);

      // Render only the class equipment section
      try {
        const updatedChoices = await equipment.renderEquipmentChoices('class');
        const classSection = updatedChoices.querySelector('.class-equipment-section');
        const existingClassSection = equipmentContainer.querySelector('.class-equipment-section');

        if (existingClassSection) {
          existingClassSection.replaceWith(classSection);
        } else {
          equipmentContainer.appendChild(classSection);
        }
      } catch (error) {
        console.error('Error updating class equipment choices:', error);
      }
    });

    document.querySelector('#background-dropdown').addEventListener('change', async (event) => {
      const selectedValue = event.target.value;
      DropdownHandler.selectionStorage.background = {
        selectedValue,
        selectedId: selectedValue.split(' ')[0] // Extract the item ID
      };
      equipment.backgroundId = DropdownHandler.selectionStorage.background.selectedId;
      HM.log(3, 'SELECTION STORAGE UPDATED (background):', DropdownHandler.selectionStorage);

      // Render only the background equipment section
      try {
        const updatedChoices = await equipment.renderEquipmentChoices('background');
        const backgroundSection = updatedChoices.querySelector('.background-equipment-section');
        const existingBackgroundSection = equipmentContainer.querySelector('.background-equipment-section');

        if (existingBackgroundSection) {
          existingBackgroundSection.replaceWith(backgroundSection);
        } else {
          equipmentContainer.appendChild(backgroundSection);
        }
      } catch (error) {
        console.error('Error updating background equipment choices:', error);
      }
    });

    document.getElementById('link-token-art').addEventListener('change', HeroMancer._toggleTokenArtRow);
  }

  /* Logic for rolling stats and updating input fields */
  static async rollStat(event, form) {
    HM.log(3, 'Rolling stats using user-defined formula.');
    await StatRoller.roller(form); // Use the utility function
  }

  static increaseScore(event, form) {
    const index = parseInt(form.getAttribute('data-ability-index'), 10);
    Listeners.adjustScore(index, 1);
  }

  static decreaseScore(event, form) {
    const index = parseInt(form.getAttribute('data-ability-index'), 10);
    Listeners.adjustScore(index, -1);
  }

  /**
   * Action to open the FilePicker for selecting character art
   * @param {PointerEvent} event The originating click event
   * @param {HTMLElement} target The element that triggered the event
   */
  static async selectCharacterArt(event, target) {
    const inputField = document.getElementById('character-art-path');
    const currentPath = inputField.value || '/';

    const filepicker = new FilePicker({
      type: 'image',
      current: currentPath,
      callback: (path) => {
        inputField.value = path;
        // If the checkbox is checked, update Token Art to match Character Art
        if (document.getElementById('link-token-art').checked) {
          document.getElementById('token-art-path').value = path;
        }
      }
    });
    filepicker.render(true);
  }

  static async selectTokenArt(event, target) {
    const inputField = document.getElementById('token-art-path');
    const currentPath = inputField.value || '/';

    const filepicker = new FilePicker({
      type: 'image',
      current: currentPath,
      callback: (path) => {
        inputField.value = path;
      }
    });
    filepicker.render(true);
  }

  /** Method to toggle Token Art row based on checkbox state */
  static _toggleTokenArtRow() {
    HM.log(3, 'Starting toggle!');
    const tokenArtRow = document.getElementById('token-art-row');
    const isLinked = document.getElementById('link-token-art').checked;
    tokenArtRow.style.display = isLinked ? 'none' : 'flex';
    HM.log(3, 'Continuing toggle!');
    // Clear Token Art path if linking is enabled
    if (isLinked) {
      document.getElementById('token-art-path').value = document.getElementById('character-art-path').value;
      HM.log(3, 'Finishing toggle!');
    }
  }

  static async collectEquipmentSelections(event) {
    const equipment = [];
    const equipmentContainer = event.srcElement.querySelector('#equipment-container');
    if (!equipmentContainer) return equipment;

    // Helper function to find item in packs
    async function findItemInPacks(itemId) {
      HM.log(3, `Searching for item ID: ${itemId}`);
      const item = fromUuidSync(itemId);
      if (item) {
        HM.log(3, `Found item ${itemId}`);
        return item;
      }
      HM.log(3, `Could not find item ${itemId} in any pack`);
      return null;
    }

    async function processContainerContents(containerItem) {
      const contents = [];
      HM.log(3, '=== CONTAINER PROCESSING START ===');
      HM.log(3, `Processing container: ${containerItem.name}`, containerItem);

      try {
        // Get the pack and document for the container
        const pack = game.packs.get(containerItem._stats?.compendiumSource?.split('.').slice(0, 2).join('.'));
        if (pack) {
          HM.log(3, 'Getting contents from compendium pack:', pack.collection);
          // Get documents that are contained within this item
          const containedItems = await pack.getDocuments({ system: { container: containerItem._id } });

          for (const containedItem of containedItems) {
            const contentEntry = {
              item: containedItem,
              quantity: containedItem.system.quantity || 1,
              equipped: false
            };

            // Recursively process nested containers
            if (containedItem.system?.type?.value === 'container') {
              HM.log(3, `Found nested container: ${containedItem.name}`);
              const nestedContents = await processContainerContents(containedItem);
              contents.push(...nestedContents);
            }

            contents.push(contentEntry);
            HM.log(3, `Added content item: ${containedItem.name} (x${contentEntry.quantity})`);
          }
        }
      } catch (error) {
        HM.log(1, `Error processing container contents for ${containerItem.name}:`, error);
      }

      HM.log(3, `=== CONTAINER PROCESSING END (${containerItem.name}) ===`);
      HM.log(
        3,
        `Total contents found: ${contents.length} items:`,
        contents.map((c) => `${c.item.name} (x${c.quantity})`)
      );
      return contents;
    }

    const equipmentSections = equipmentContainer.querySelectorAll('.equipment-choices > div');

    for (const section of equipmentSections) {
      HM.log(3, 'Processing new section');

      // Process dropdowns
      const dropdowns = section.querySelectorAll('select');
      HM.log(3, `Found ${dropdowns.length} dropdowns in section`);

      for (const dropdown of dropdowns) {
        const value = dropdown.value || document.getElementById(`${dropdown.id}-default`)?.value;
        HM.log(3, `Processing dropdown ${dropdown.id} with value: ${value}`);

        if (!value) {
          HM.log(3, `No value for dropdown ${dropdown.id}, skipping`);
          continue;
        }

        const item = await findItemInPacks(value);
        if (item) {
          // Get the selected option to check for quantity
          const selectedOption = dropdown.querySelector(`option[value="${value}"]`);
          const optionText = selectedOption?.textContent || '';

          // Try different quantity patterns
          const startQuantityMatch = optionText.match(/^(\d+)\s+(.+)$/i); // "2 Handaxe"
          const endQuantityMatch = optionText.match(/(.+)\s+\((\d+)\)$/i); // "Javelin (4)"
          const midQuantityMatch = optionText.match(/(.+?)\s+x(\d+)/i); // "Javelin x4"

          let quantity = 1;
          if (startQuantityMatch) quantity = parseInt(startQuantityMatch[1]);
          else if (endQuantityMatch) quantity = parseInt(endQuantityMatch[2]);
          else if (midQuantityMatch) quantity = parseInt(midQuantityMatch[2]);

          HM.log(3, `Detected quantity ${quantity} from option text: "${optionText}"`);

          // Add the container item itself
          equipment.push({
            item: item,
            quantity: quantity,
            equipped: true
          });
          HM.log(3, `Successfully added dropdown item to equipment: ${item.name} (x${quantity})`);

          HM.log(3, 'DROPDOWN ITEM ', item);
          if (item?.type === 'container') {
            HM.log(3, '>>> STARTING CONTENTS PROCESSING <<<');
            HM.log(3, 'Parent item:', item.name);
            HM.log(3, 'Compendium source:', item.pack);
            const pack = game.packs.get(item.pack);
            HM.log(3, 'PACK:', pack);
            HM.log(3, 'ITEM', item._id);
            const itemIds = pack.index.filter((i) => i.system?.container === item._id).map((i) => i._id);
            HM.log(3, 'ITEM IDS:', itemIds);
            const contents = await pack.getDocuments({ _id__in: itemIds });
            HM.log(3, 'CONTENTS:', contents);
            if (contents.length > 0) {
              for (const content of contents) {
                equipment.push({
                  item: content,
                  quantity: content.system.quantity || 1,
                  container: content.system.container
                });
              }

              HM.log(3, `Added ${contents.length} items from container ${item.name}`);
            }
            // This code above must also push system.contents a collection of contents entries so the items match.
          }
        }
      }

      // Process checkboxes
      const checkboxes = section.querySelectorAll('input[type="checkbox"]');
      HM.log(3, `Found ${checkboxes.length} checkboxes in section`);

      for (const checkbox of checkboxes) {
        if (!checkbox.checked) {
          HM.log(3, `Checkbox ${checkbox.id} not checked, skipping`);
          continue;
        }

        HM.log(3, `Processing checked checkbox ${checkbox.id}`);
        const itemIds = checkbox.id.split(',');
        const label = checkbox.nextElementSibling?.textContent || '';
        HM.log(3, `Checkbox items to process: ${itemIds.length}`, itemIds);
        HM.log(3, `Checkbox label: "${label}"`);

        for (const itemId of itemIds) {
          if (!itemId) continue;

          const item = await findItemInPacks(itemId);
          if (item) {
            const itemName = item.name.toLowerCase();

            // Split label into individual item entries
            const entries = label.split('+').map((entry) => entry.trim());

            // Find the entry that matches this item
            const matchingEntry = entries.find((entry) => {
              const itemPattern = new RegExp(`\\d*\\s*${itemName}`, 'i');
              return itemPattern.test(entry);
            });

            if (matchingEntry) {
              // Extract quantity for this specific item
              const quantityMatch = matchingEntry.match(/^(\d+)\s+/);
              const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;

              equipment.push({
                item: item,
                quantity,
                equipped: true
              });
              HM.log(3, `Successfully added checkbox item to equipment: ${item.name} (x${quantity})`);

              HM.log(3, 'CHECKBOX ITEM ', item);
              if (item?.type === 'container') {
                HM.log(3, '>>> STARTING CONTENTS PROCESSING <<<');
                HM.log(3, 'Parent item:', item.name);
                HM.log(3, 'Compendium source:', item.pack);
                const pack = game.packs.get(item.pack);
                HM.log(3, 'PACK:', pack);
                HM.log(3, 'ITEM', item._id);
                const itemIds = pack.index.filter((i) => i.system?.container === item._id).map((i) => i._id);
                HM.log(3, 'ITEM IDS:', itemIds);
                const contents = await pack.getDocuments({ _id__in: itemIds });
                HM.log(3, 'CONTENTS:', contents);

                if (contents.length > 0) {
                  item.system.contents = contents.map((content) => ({
                    item: content._id
                  }));

                  for (const content of contents) {
                    equipment.push({
                      item: content,
                      quantity: content.system.quantity || 1,
                      container: content.system.container
                    });
                  }

                  HM.log(3, `Added ${contents.length} items from container ${item.name}`);
                }
              }
            }
          }
        }
      }
    }

    HM.log(3, 'Final equipment collection:', equipment);
    return equipment;
  }

  /* Function for handling form data collection, logging the results, and adding items to the actor. */
  static async formHandler(event, form, formData) {
    HM.log(3, 'Processing form data...');
    HM.log(3, formData);

    // Collect equipment selections early to ensure they're ready when needed
    HM.log(3, 'Calling collectEquipmentSelections...');
    const equipmentSelections = await HeroMancer.collectEquipmentSelections(event);
    HM.log(3, 'Equipment selections:', equipmentSelections);

    try {
      const validProperties = Object.keys(formData.object);
      for (const property of validProperties) {
        const value = formData.object[property];
        if (value === null || value === undefined || value === '') {
          throw new Error(`Missing required field: ${property}`);
        }
      }
    } catch (err) {
      console.error(err);
    }

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
    let actorName = formData.object.name || game.user.name; // Handling for blank hero name.
    let actorData = {
      name: actorName,
      type: 'character',
      system: {
        abilities: Object.fromEntries(Object.entries(abilities).map(([key, value]) => [key, { value }]))
      }
    };

    let actor = await Actor.create(actorData);
    let newActor = game.actors.getName(actorName);
    HM.log(3, newActor);
    HM.log(3, 'Created Actor:', actor);

    // Declare the items outside the try block
    let backgroundItem, raceItem, classItem;

    try {
      // Check if each required item is selected before fetching
      if (!backgroundData?.packId || !backgroundData?.itemId) {
        ui.notifications.warn(game.i18n.localize('hm.errors.select-background'));
        return;
      }
      if (!raceData?.packId || !raceData?.itemId) {
        ui.notifications.warn(game.i18n.localize('hm.errors.select-race'));
        return;
      }
      if (!classData?.packId || !classData?.itemId) {
        ui.notifications.warn(game.i18n.localize('hm.errors.select-class'));
        return;
      }

      // Fetch documents after confirming all selections are valid
      backgroundItem = await game.packs.get(backgroundData.packId)?.getDocument(backgroundData.itemId);
      raceItem = await game.packs.get(raceData.packId)?.getDocument(raceData.itemId);
      classItem = await game.packs.get(classData.packId)?.getDocument(classData.itemId);

      // If any document fetch fails (e.g., item was removed from the compendium)
      if (!backgroundItem) throw new Error(game.i18n.localize('hm.errors.no-background'));
      if (!raceItem) throw new Error(game.i18n.localize('hm.errors.no-race'));
      if (!classItem) throw new Error(game.i18n.localize('hm.errors.no-class'));
    } catch (error) {
      // Log error to the console and notify the user
      console.error(error);
      ui.notifications.error(game.i18n.localize('hm.errors.fetch-fail'));
    }

    if (!backgroundItem || !raceItem || !classItem) {
      HM.log(1, 'Error: One or more items could not be fetched.');
      return;
    }

    // Combine base items with equipment selections
    const baseItems = [backgroundItem.toObject(), raceItem.toObject(), classItem.toObject()];
    const equipmentItems = equipmentSelections.map(({ item, quantity }) => ({
      ...item,
      system: {
        ...(item.system || {}),
        quantity: quantity
      }
    }));

    // Add all items to the actor
    const allItems = [...baseItems, ...equipmentItems];
    await actor.createEmbeddedDocuments('Item', allItems);
    HM.log(3, 'All items added to actor:', allItems);

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
