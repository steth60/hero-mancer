import { DropdownHandler } from './index.js';
import { HM } from '../hero-mancer.js';

export class EquipmentParser {
  // Static sets for item collections
  static simpleM = new Set();

  static simpleR = new Set();

  static martialM = new Set();

  static martialR = new Set();

  static music = new Set();

  static shield = new Set();

  static armor = new Set();

  constructor() {
    this.equipmentData = null;
    this.classId = DropdownHandler.selectionStorage.class.selectedId;
    this.backgroundId = DropdownHandler.selectionStorage.background.selectedId;
    this.proficiencies = new Set();
    this.combinedItemIds = new Set();

    HM.log(3, 'EquipmentParser initialized with:', {
      classId: this.classId,
      backgroundId: this.backgroundId
    });
  }

  /**
   * Helper function to retrieve a document by searching across all item-type compendiums.
   * @param {string} itemId The ID of the item to search for.
   * @returns {Promise<object | null>} - The found item or null if not found.
   */
  async findItemInCompendiums(itemId) {
    HM.log(3, `Searching for item ${itemId} in all 'Item' compendiums.`);
    for (const pack of game.packs.filter((pack) => pack.documentName === 'Item')) {
      const item = await pack.getDocument(itemId);
      if (item) {
        HM.log(3, `Item ${itemId} found in pack ${pack.metadata.label}`, item);
        return item;
      }
    }
    HM.log(3, `Item ${itemId} not found in any 'Item' compendiums.`);
    return null;
  }

  /**
   * Fetches starting equipment based on the selection for the specified type.
   * Also retrieves and updates proficiencies for the current selection.
   * @param {string} type The type (class, background).
   * @returns {Promise<Array>} - The starting equipment array.
   */
  async getStartingEquipment(type) {
    const { selectedId } = DropdownHandler.selectionStorage[type] || {};
    HM.log(3, `Fetching starting equipment for type: ${type}, selectedId: ${selectedId}`);

    if (!selectedId) {
      HM.log(3, `No selection found for type: ${type}`);
      return [];
    }

    const doc = await this.findItemInCompendiums(selectedId);

    if (doc) {
      HM.log(3, `Starting equipment found for type ${type}:`, doc.system.startingEquipment);
      this.proficiencies = await this.getProficiencies(doc.system.advancement || []);
    } else {
      HM.log(3, `No document found for type ${type} with selectedId ${selectedId}`);
    }

    return doc?.system.startingEquipment || [];
  }

  /**
   * Retrieves all granted proficiencies based on the provided advancements.
   * @param {Array} advancements The advancement data containing proficiency grants.
   * @returns {Promise<Set>} - A set of granted proficiencies.
   */
  async getProficiencies(advancements) {
    const proficiencies = new Set();

    for (const advancement of advancements) {
      if (advancement.configuration && advancement.configuration.grants) {
        for (const grant of advancement.configuration.grants) {
          proficiencies.add(grant);
        }
      }
    }
    HM.log(3, 'Collected proficiencies:', Array.from(proficiencies));
    return proficiencies;
  }

  /**
   * Fetches and combines equipment data for class and background.
   */
  async fetchEquipmentData() {
    HM.log(3, 'Fetching equipment data for class, and background.');

    const classEquipment = await this.getStartingEquipment('class');
    const backgroundEquipment = await this.getStartingEquipment('background');

    this.equipmentData = {
      class: classEquipment || [],
      background: backgroundEquipment || []
    };

    HM.log(3, 'Organized equipment data by type:', this.equipmentData);
  }

  async renderEquipmentChoices(type = null) {
    // Reset rendered flags for all items in lookupItems
    if (EquipmentParser.lookupItems) {
      Object.values(EquipmentParser.lookupItems).forEach((itemSet) => {
        itemSet.forEach((item) => {
          delete item.rendered;
          delete item.isSpecialCase;
          delete item.specialGrouping; // Maybe?
        });
      });
    }

    await EquipmentParser.initializeLookupItems();
    HM.log(3, EquipmentParser.lookupItems);
    HM.log(3, `Rendering equipment choices for ${type || 'all types'}.`);
    this.combinedItemIds.clear();

    await this.fetchEquipmentData();

    // Get or create the main equipment-choices container
    let container = document.querySelector('.equipment-choices');
    if (!container) {
      container = document.createElement('div');
      container.classList.add('equipment-choices');
    }

    // Determine which types to render (either specific type or all)
    const typesToRender = type ? [type] : Object.keys(this.equipmentData);

    for (const currentType of typesToRender) {
      const items = this.equipmentData[currentType] || [];

      // Check if the section for this type already exists, otherwise create it
      let sectionContainer = container.querySelector(`.${currentType}-equipment-section`);
      if (sectionContainer) {
        HM.log(3, `${currentType}-equipment-section already exists. Clearing and reusing.`);
        sectionContainer.innerHTML = ''; // Clear existing content if section exists
      } else {
        sectionContainer = document.createElement('div');
        sectionContainer.classList.add(`${currentType}-equipment-section`);
        container.appendChild(sectionContainer);
      }

      // Get the localized placeholder text for the current type
      const placeholderText = game.i18n.localize(`hm.app.${currentType}.select-placeholder`);

      // Get the current text of the selected option for the dropdown (e.g., Wizard, Acolyte)
      const dropdown = document.querySelector(`#${currentType}-dropdown`);
      const dropdownText = dropdown.selectedOptions[0].textContent;

      // Determine if the selected text matches the localized placeholder
      const isPlaceholder = dropdownText === placeholderText;

      // Add a header for the section based on whether it's a placeholder
      const header = document.createElement('h3');
      header.textContent = isPlaceholder ? `${currentType.charAt(0).toUpperCase() + currentType.slice(1)} Equipment` : `${dropdownText} Equipment`;
      sectionContainer.appendChild(header);

      // Render each item within the current section
      for (const item of items) {
        const itemDoc = await fromUuidSync(item.key);
        item.name = itemDoc?.name || item.key;

        HM.log(3, `Creating HTML element for item in ${currentType} equipment:`, item);
        const itemElement = await this.createEquipmentElement(item);

        if (itemElement) {
          sectionContainer.appendChild(itemElement);
        }
      }
    }

    HM.log(3, `Finished rendering equipment choices for ${type || 'all types'}.`);
    return container;
  }

  async createEquipmentElement(item) {
    // Skip rendering if the item is already rendered
    if (item.rendered) {
      HM.log(3, `Skipping already rendered item: ${item._id}`);
      return null;
    }

    // Mark as rendered
    item.rendered = true;
    HM.log(3, `Rendering item: ${item._id}`, {
      group: item.group,
      sort: item.sort,
      key: item.key
    });

    // Log the special case check for debugging
    HM.log(3, `Checking if item meets special multi-option case criteria: ${item._id}`, item);

    // Helper function to detect if the item meets the special multi-option case criteria
    const isSpecialMultiOptionCase = (item) => {
      return (
        item.type === 'OR' &&
        item.children.some((child) => child.type === 'AND' && child.children.length > 1) &&
        item.children.some((entry) => entry.count && entry.count > 1)
      );
    };

    // Special case handling for items with multi-option dropdown requirements
    if (isSpecialMultiOptionCase(item)) {
      HM.log(3, 'Special MultiOptionCase identified:', item);

      // Create container for special case items
      const itemContainer = document.createElement('div');
      itemContainer.classList.add('equipment-item');

      // Create and append a unified label for combined dropdown options
      const labelElement = document.createElement('h4');
      labelElement.classList.add('parent-label');
      labelElement.textContent = item.label;
      itemContainer.appendChild(labelElement);

      const markAsRendered = (entry) => {
        // Mark entry as rendered and set any other required properties directly
        entry.rendered = true;
        entry.group = item.group;
        entry.sort = item.sort;
        entry.isSpecialCase = true;

        HM.log(3, 'Marked as special case-rendered:', entry);
      };

      // Dropdown 1: Options from the AND group with multiple choices (e.g., martial melee + shield)
      const dropdown1 = document.createElement('select');
      const andGroup = item.children.find((child) => child.type === 'AND' && child.children.length > 1);

      if (andGroup) {
        try {
          andGroup.children.forEach((andChild) => {
            const lookupOptions = Array.from(EquipmentParser.lookupItems[andChild.key] || []);
            lookupOptions.sort((a, b) => a.name.localeCompare(b.name));

            lookupOptions.forEach((option) => {
              const optionElement = document.createElement('option');
              optionElement.value = option._id;
              optionElement.textContent = option.name;
              dropdown1.appendChild(optionElement);
            });

            // Mark each AND group child as rendered in the special case
            markAsRendered(andChild);
          });
        } catch (error) {
          HM.log(1, `Error in processing AND group for dropdown1 in special case: ${item._id}`, error);
        }
      }

      // Dropdown 2: Options from entries with `count > 1` (e.g., two martial melee weapons)
      const dropdown2 = document.createElement('select');
      const multiCountEntry = item.children.find((entry) => entry.count && entry.count > 1);

      if (multiCountEntry) {
        try {
          const lookupOptions = Array.from(EquipmentParser.lookupItems[multiCountEntry.key] || []);
          lookupOptions.sort((a, b) => a.name.localeCompare(b.name));

          lookupOptions.forEach((option) => {
            const optionElement = document.createElement('option');
            optionElement.value = option._id;
            optionElement.textContent = option.name;
            dropdown2.appendChild(optionElement);
          });

          // Mark the multi-count entry as rendered in the special case
          markAsRendered(multiCountEntry);
        } catch (error) {
          HM.log(1, `Error in processing multi-count entry for dropdown2 in special case: ${item._id}`, error);
        }
      }

      // Append the dropdowns in order after the label
      itemContainer.appendChild(dropdown1);
      itemContainer.appendChild(dropdown2);

      HM.log(3, 'Completed special multi-option case rendering for item:', item._id);
      return itemContainer;
    } else {
      // Check if the item has already been rendered in a special case
      if (item.rendered && item.isSpecialCase) {
        HM.log(3, `Skipping special case-rendered item: ${item._id}`);
        return null;
      }

      const itemContainer = document.createElement('div');
      itemContainer.classList.add('equipment-item');
      HM.log(3, 'Creating element for equipment item:', { id: item._id, type: item.type, label: item.label });
      // Track unique items to avoid duplicates
      const renderedItemNames = new Set();
      if (item.type === 'OR') {
        HM.log(3, `Processing OR block with ID: ${item._id} and label: ${item.label || 'Choose one of the following'}`);

        // Create label element for the OR group
        const labelElement = document.createElement('h4');
        labelElement.classList.add('parent-label');
        labelElement.textContent = item.label || 'Choose one of the following';
        itemContainer.appendChild(labelElement);

        // Initialize select element for OR choices
        const select = document.createElement('select');
        select.id = item._id;
        itemContainer.appendChild(select);

        let focusInput = null; // Placeholder for custom focus input if needed

        // Iterate over children within the OR group
        for (const child of item.children) {
          // Skip rendering if the child item has already been rendered with the same group and sort
          if (child.rendered && child.sort === item.sort && child.group === item.group) {
            HM.log(3, `Skipping already rendered child: ${child._id} with sort: ${child.sort} and group: ${child.group}`);
            continue;
          }

          // Mark this child as rendered and set group, sort, and key properties directly on the child
          child.rendered = true;
          child.group = item.group;
          child.sort = item.sort;

          HM.log(3, `Rendering new child item for OR block: ${child._id} with group: ${child.group} and sort: ${child.sort}`);

          // Process AND groups for combined items (e.g., multiple items in one choice)
          if (child.type === 'AND') {
            let combinedLabel = '';
            const combinedIds = [];

            for (const subChild of child.children) {
              try {
                const subChildItem = await fromUuidSync(subChild.key);
                if (!subChildItem) throw new Error(`Item not found for UUID: ${subChild.key}`);

                // Construct combined label and ID list
                if (combinedLabel) combinedLabel += ' + ';
                combinedLabel += `${subChild.count || ''} ${subChildItem.name}`.trim();
                combinedIds.push(subChild._id);

                this.combinedItemIds.add(subChild._id);
              } catch (error) {
                HM.log(1, `Error processing sub-child in AND group for child ${child._id}: ${error.message}`);
                continue;
              }
            }

            if (combinedLabel && !renderedItemNames.has(combinedLabel)) {
              renderedItemNames.add(combinedLabel);

              // Create option element for combined AND items
              const optionElement = document.createElement('option');
              optionElement.value = combinedIds.join(',');
              optionElement.textContent = combinedLabel;
              select.appendChild(optionElement);

              HM.log(3, 'Added combined AND group item to OR dropdown:', { label: combinedLabel, ids: combinedIds });
            }
            continue;
          }

          // Handle individual items or lookup options
          const trueName = child.label.replace(/\s*\(.*?\)\s*/g, '').trim();

          // Handle linked type items
          if (child.type === 'linked') {
            // Skip if the item name is already in renderedItemNames or if it's part of a combined item
            if (renderedItemNames.has(trueName) || this.combinedItemIds.has(child._id)) {
              HM.log(3, `Skipping duplicate or combined linked item: ${trueName} (${child._id})`);
              return;
            }
            renderedItemNames.add(trueName);

            // Create and configure the option element for linked items
            const optionElement = document.createElement('option');
            optionElement.value = child._id;
            optionElement.textContent = trueName;

            // Check if item requires proficiency and mark it as disabled if not met
            if (child.requiresProficiency) {
              const requiredProficiency = `${child.type}:${child.key}`;
              if (!this.proficiencies.has(requiredProficiency)) {
                optionElement.disabled = true;
                optionElement.textContent = `${trueName} (${game.i18n.localize('hm.app.equipment.lacks-proficiency')})`;
              }
            }

            select.appendChild(optionElement);
            HM.log(3, 'Added linked item to OR dropdown:', { id: child._id, name: trueName });

            // Handle 'focus' type items (e.g., 'arcane' focus)
          } else if (child.type === 'focus' && child.key === 'arcane') {
            renderedItemNames.add('Any Arcane Focus');
            const optionElement = document.createElement('option');
            optionElement.value = 'arcaneFocus';
            optionElement.textContent = 'Any Arcane Focus';
            select.appendChild(optionElement);

            // Create input field for custom arcane focus (hidden initially)
            focusInput = document.createElement('input');
            focusInput.type = 'text';
            focusInput.placeholder = 'Enter your arcane focus...';
            focusInput.classList.add('arcane-focus-input');
            focusInput.style.display = 'none';
            HM.log(3, 'Added Any Arcane Focus option with input field support');

            // Handle equipment items like weapons, armor, tools, and shields
          } else if (['weapon', 'armor', 'tool', 'shield'].includes(child.type)) {
            try {
              // Retrieve and sort lookup options for the child key
              const lookupOptions = Array.from(EquipmentParser.lookupItems[child.key] || []);
              lookupOptions.sort((a, b) => a.name.localeCompare(b.name));

              lookupOptions.forEach((option) => {
                // Skip if this option is already in renderedItemNames to prevent duplicates
                if (renderedItemNames.has(option.name)) {
                  HM.log(3, `Skipping duplicate item: ${option.name}`);
                  return;
                }

                // Skip if this option is already rendered in the same group and sort
                if (option.rendered && option.sort === child.sort && option.group === child.group) {
                  HM.log(3, `Skipping already rendered option: ${option.name} (${option._id}) in group: ${child.group}`);
                  return;
                }

                // Mark the option as rendered and set group/sort details
                option.rendered = true;
                option.group = child.group;
                option.sort = child.sort;
                option.key = child.key;

                // Add the option name to renderedItemNames to track its uniqueness
                renderedItemNames.add(option.name);

                // Create and configure the option element
                const optionElement = document.createElement('option');
                optionElement.value = option._id;
                optionElement.textContent = option.name;

                // Check proficiency requirements if applicable
                if (child.requiresProficiency) {
                  const requiredProficiency = `${child.type}:${child.key}`;
                  if (!this.proficiencies.has(requiredProficiency)) {
                    optionElement.disabled = true;
                    optionElement.textContent = `${option.name} (${game.i18n.localize('hm.app.equipment.lacks-proficiency')})`;
                  }
                }

                // Append the option element to the dropdown
                select.appendChild(optionElement);
                HM.log(3, `Added ${child.type} item to OR dropdown:`, { id: option._id, name: option.name });
              });
            } catch (error) {
              HM.log(1, `Error retrieving lookup options for ${child.key}: ${error.message}`);
            }
          }
        }

        // Event listener to toggle visibility of custom focus input for 'arcaneFocus' selection
        select.addEventListener('change', (event) => {
          if (focusInput) {
            const isArcaneFocus = event.target.value === 'arcaneFocus';
            focusInput.style.display = isArcaneFocus ? 'block' : 'none';

            // Clear input if switching to any other option
            if (!isArcaneFocus) {
              focusInput.value = '';
              HM.log(3, 'Cleared focus input for non-arcane focus selection');
            }
          }
        });

        // Append the dropdown first, followed by the optional focus input field
        itemContainer.appendChild(select);
        if (focusInput) {
          itemContainer.appendChild(focusInput);
          HM.log(3, 'Appended custom focus input field');
        }

        // Log the final addition of the OR dropdown
        HM.log(3, 'Added OR type item with dropdown for top-level OR group:', {
          id: item._id,
          options: Array.from(renderedItemNames),
          hasFocusInput: !!focusInput
        });
      } else {
        // Handle AND and linked items not part of an OR dropdown
        switch (item.type) {
          case 'AND': {
            // Check if this is a standalone AND group (no parent OR group)
            if (item.group) {
              HM.log(3, `Skipping label for AND group with parent group: ${item.group}`);
            } else {
              const andLabelElement = document.createElement('h4');
              andLabelElement.classList.add('parent-label');
              andLabelElement.textContent = item.label || 'All of the following:';
              itemContainer.appendChild(andLabelElement);
              HM.log(3, 'Added label for standalone AND group:', { label: andLabelElement.textContent, id: item._id });
            }

            // Track item types in the group
            let hasWeapon = false;
            let hasContainer = false;
            let hasConsumable = false;
            const combinedIds = [];
            let combinedLabel = '';

            // First pass: Check if we have exactly one of each required type
            for (const child of item.children) {
              const childDoc = await fromUuidSync(child.key);
              if (!childDoc) continue;

              if (childDoc.type === 'weapon') hasWeapon = true;
              else if (childDoc.type === 'container') hasContainer = true;
              else if (childDoc.type === 'consumable') hasConsumable = true;

              // Add each child to the combined label and ID list for later use
              if (combinedLabel) combinedLabel += ' + ';
              combinedLabel += `${child.count || ''} ${childDoc.name}`.trim();
              combinedIds.push(child._id);
            }

            // If we have one of each type (weapon, container, consumable), render as a single combined checkbox
            if (hasWeapon && hasContainer && hasConsumable && combinedIds.length === 3) {
              if (!renderedItemNames.has(combinedLabel)) {
                renderedItemNames.add(combinedLabel);

                // Mark each child item in the combined group
                for (const child of item.children) {
                  child.specialGrouping = true;
                  child.rendered = true;
                }

                const combinedCheckbox = document.createElement('input');
                combinedCheckbox.type = 'checkbox';
                combinedCheckbox.id = combinedIds.join(',');
                combinedCheckbox.checked = true;
                itemContainer.appendChild(combinedCheckbox);

                const combinedLabelElement = document.createElement('label');
                combinedLabelElement.htmlFor = combinedCheckbox.id;
                combinedLabelElement.textContent = combinedLabel;
                itemContainer.appendChild(combinedLabelElement);

                HM.log(3, 'Added combined AND group with checkbox:', { groupId: item._id, combinedLabel });
              }
            } else {
              // Otherwise, render each child as an individual checkbox
              for (const child of item.children) {
                try {
                  const childElement = await this.createEquipmentElement(child);
                  if (childElement) {
                    itemContainer.appendChild(childElement);
                    HM.log(3, 'Rendered child element in AND group:', { parentId: item._id, childId: child._id });
                  }
                } catch (error) {
                  HM.log(1, 'Error rendering child in AND group:', { parentId: item._id, childId: child._id, error });
                }
              }
            }
            break;
          }

          case 'linked': {
            // Check for previously rendered combined items
            if (this.combinedItemIds.has(item._id) /*  || item.specialGrouping */) {
              HM.log(3, `Skipping already combined linked item: ${item._id}`);
              return null;
            }

            // Create and configure checkbox for linked items
            const linkedCheckbox = document.createElement('input');
            linkedCheckbox.type = 'checkbox';
            linkedCheckbox.id = item._id;
            linkedCheckbox.checked = true;
            itemContainer.appendChild(linkedCheckbox);

            const linkedLabel = document.createElement('label');
            linkedLabel.htmlFor = item._id;
            linkedLabel.textContent = item.label || 'Unknown Linked Item';
            itemContainer.appendChild(linkedLabel);

            HM.log(3, 'Added linked type item with checkbox:', { id: item._id, label: linkedLabel.textContent });
            break;
          }

          case 'focus': {
            // Create and configure input for custom focus
            const focusLabel = document.createElement('label');
            focusLabel.htmlFor = item._id;
            focusLabel.textContent = item.label || 'Custom Focus';
            itemContainer.appendChild(focusLabel);

            const input = document.createElement('input');
            input.type = 'text';
            input.id = item._id;
            input.value = `${item.key} ${item.type}`;
            itemContainer.appendChild(input);

            HM.log(3, 'Added focus item with input field:', { id: item._id, defaultValue: input.value });
            break;
          }

          default:
            HM.log(2, `Unknown item type encountered in switch statement: ${item.type}`, { itemId: item._id });
        }
      }

      HM.log(3, 'ITEM CONTAINER: ', itemContainer);
      return itemContainer;
    }
  }

  static async initializeLookupItems() {
    if (EquipmentParser.lookupItemsInitialized) {
      HM.log(3, 'Lookup items already initialized. Skipping reinitialization.');
      return;
    }
    EquipmentParser.lookupItemsInitialized = true;
    HM.log(3, 'Starting initialization of lookup items...');

    try {
      // Populate individual sets and log each upon successful initialization
      EquipmentParser.simpleM = new Set(await EquipmentParser.collectLookupItems('simpleM'));
      HM.log(3, `simpleM initialized with ${EquipmentParser.simpleM.size} items.`);

      EquipmentParser.simpleR = new Set(await EquipmentParser.collectLookupItems('simpleR'));
      HM.log(3, `simpleR initialized with ${EquipmentParser.simpleR.size} items.`);

      EquipmentParser.martialM = new Set(await EquipmentParser.collectLookupItems('martialM'));
      HM.log(3, `martialM initialized with ${EquipmentParser.martialM.size} items.`);

      EquipmentParser.martialR = new Set(await EquipmentParser.collectLookupItems('martialR'));
      HM.log(3, `martialR initialized with ${EquipmentParser.martialR.size} items.`);

      EquipmentParser.music = new Set(await EquipmentParser.collectLookupItems('music'));
      HM.log(3, `music initialized with ${EquipmentParser.music.size} items.`);

      EquipmentParser.shield = new Set(await EquipmentParser.collectLookupItems('shield'));
      HM.log(3, `shield initialized with ${EquipmentParser.shield.size} items.`);

      EquipmentParser.armor = new Set(await EquipmentParser.collectLookupItems('armor'));
      HM.log(3, `armor initialized with ${EquipmentParser.armor.size} items.`);

      // Dynamically create the lookupItems object with combined sets and log summary
      EquipmentParser.lookupItems = {
        sim: new Set([...EquipmentParser.simpleM, ...EquipmentParser.simpleR]),
        simpleM: EquipmentParser.simpleM,
        simpleR: EquipmentParser.simpleR,
        mar: new Set([...EquipmentParser.martialM, ...EquipmentParser.martialR]),
        martialM: EquipmentParser.martialM,
        martialR: EquipmentParser.martialR,
        music: EquipmentParser.music,
        shield: EquipmentParser.shield,
        armor: EquipmentParser.armor
      };

      HM.log(3, `Combined sim set initialized with ${EquipmentParser.lookupItems.sim.size} items.`);
      HM.log(3, `Combined mar set initialized with ${EquipmentParser.lookupItems.mar.size} items.`);
    } catch (error) {
      HM.log(1, 'Error initializing lookup items:', error);
    }

    HM.log(3, 'EquipmentParser lookup items fully initialized:', EquipmentParser.lookupItems);
  }

  static async collectLookupItems(lookupKey) {
    HM.log(3, `Starting collection of items for lookupKey: ${lookupKey}`);
    const items = [];
    const typesToFetch = ['weapon', 'armor', 'tool', 'equipment', 'gear', 'consumable', 'shield'];

    try {
      // Loop through each pack containing Items and filter based on `typesToFetch`
      for (const pack of game.packs.filter((pack) => pack.documentName === 'Item')) {
        HM.log(3, `Checking pack: ${pack.metadata.label} for items matching ${lookupKey}`);

        // Attempt to retrieve documents of specified types from each pack
        const documents = await pack.getDocuments({ type__in: typesToFetch });

        // Filter and process each item
        documents.forEach((item) => {
          const itemType = item.system?.type?.value || item.type;
          const isMagic = item.system?.properties instanceof Set && item.system.properties.has('mgc');

          // Skip items that are magical or "Unarmed Strike"
          if (item.name === 'Unarmed Strike' || isMagic) {
            HM.log(3, `Skipping item: ${item.name} due to exclusion criteria.`);
            return;
          }

          // Conditional filtering based on the `lookupKey`
          if (
            (lookupKey === 'sim' && (itemType === 'simpleM' || itemType === 'simpleR')) ||
            (lookupKey === 'simpleM' && itemType === 'simpleM') ||
            (lookupKey === 'simpleR' && itemType === 'simpleR') ||
            (lookupKey === 'mar' && (itemType === 'martialM' || itemType === 'martialR')) ||
            (lookupKey === 'martialM' && itemType === 'martialM') ||
            (lookupKey === 'martialR' && itemType === 'martialR') ||
            (lookupKey === 'music' && itemType === 'music') ||
            (lookupKey === 'shield' && itemType === 'shield') ||
            (lookupKey === 'armor' && itemType === 'armor') ||
            itemType === lookupKey
          ) {
            items.push(item);
            HM.log(3, `Added item: ${item.name} with ID: ${item._id} to ${lookupKey} collection.`);
          }
        });
      }

      HM.log(3, `Collected ${items.length} items for lookupKey: ${lookupKey}`);
    } catch (error) {
      HM.log(1, `Error collecting items for lookupKey: ${lookupKey}`, error);
    }

    return items;
  }
}
