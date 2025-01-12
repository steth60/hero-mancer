import { DropdownHandler } from './index.js';
import { HM } from '../hero-mancer.js';

export class EquipmentParser {
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
          if (item.child) {
            delete item.child.rendered;
            delete item.child.isSpecialCase;
            delete item.child.specialGrouping;
          }
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
        HM.log(3, 'Existing container:', sectionContainer);
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
    if (this.isItemRendered(item)) return null;

    item.rendered = true;
    HM.log(3, `Rendering item: ${item._source.key}`, { group: item.group, sort: item.sort, key: item.key });

    const itemContainer = document.createElement('div');
    itemContainer.classList.add('equipment-item');

    if (!item.group) {
      const labelElement = document.createElement('h4');
      labelElement.classList.add('parent-label');

      let shouldAddLabel = false;

      // Only try to get item name if the item has a key
      if (item.key) {
        try {
          const itemDoc = await fromUuidSync(item.key);
          if (itemDoc) {
            const label = item.count ? `${item.count}x ${itemDoc.name}` : itemDoc.name;
            labelElement.textContent = label;
            shouldAddLabel = true;
          } else {
            HM.log(2, `No document found for item key: ${item.key}`);
            labelElement.textContent = item.label || 'Unknown Item';
            shouldAddLabel = true;
          }
        } catch (error) {
          HM.log(2, `Error getting label for item ${item._source.key}: ${error.message}`);
          labelElement.textContent = item.label || 'Unknown Item';
          shouldAddLabel = true;
        }
      }

      // Only append the label if we should
      if (shouldAddLabel) {
        itemContainer.appendChild(labelElement);
      }
    }

    // First check if this is part of an OR choice
    if (item.group) {
      const parentItem = this.equipmentData.class.find((p) => p._id === item.group) || this.equipmentData.background.find((p) => p._id === item.group);
      if (parentItem?.type === 'OR') {
        return null; // Skip individual rendering for items that will be in a dropdown
      }
    }

    switch (item.type) {
      case 'OR':
        return this.renderOrBlock(item, itemContainer);
      case 'AND':
        // Only render AND block if it's not part of an OR choice
        if (!item.group || this.isStandaloneAndBlock(item)) {
          return this.renderAndBlock(item, itemContainer);
        }
        return null;
      case 'linked':
        return this.renderLinkedItem(item, itemContainer);
      case 'focus':
        return this.renderFocusItem(item, itemContainer);
      default:
        HM.log(2, `Unknown item type encountered: ${item.type}`, { itemId: item._id });
        return null;
    }
  }

  isStandaloneAndBlock(item) {
    return (
      !this.equipmentData.class.some((p) => p._id === item.group && p.type === 'OR') &&
      !this.equipmentData.background.some((p) => p._id === item.group && p.type === 'OR')
    );
  }

  isItemRendered(item) {
    if (item.key && item.rendered) {
      HM.log(3, `Skipping already rendered item: ${item._id}`);
      return true;
    } else if (item.child && item.child.rendered) {
      HM.log(3, `Skipping already rendered parent item: ${item._id}`);
      return true;
    }
    return false;
  }

  isSpecialMultiOptionCase(item) {
    return (
      item.type === 'OR' &&
      item.children.some((child) => child.type === 'AND' && child.children.length > 1) &&
      item.children.some((entry) => entry.count && entry.count > 1)
    );
  }

  async renderSpecialMultiOptionCase(item) {
    HM.log(3, 'Special MultiOptionCase identified:', item);
    const itemContainer = document.createElement('div');
    itemContainer.classList.add('equipment-item');

    const labelElement = document.createElement('h4');
    labelElement.classList.add('parent-label');
    labelElement.textContent = item.label;
    itemContainer.appendChild(labelElement);

    const dropdown1 = await this.createDropdown(item, 'AND');
    const dropdown2 = await this.createDropdown(item, 'multiCount');

    itemContainer.appendChild(dropdown1);
    itemContainer.appendChild(dropdown2);

    HM.log(3, 'Completed special multi-option case rendering for item:', item._id);
    return itemContainer;
  }

  async createDropdown(item, type) {
    const dropdown = document.createElement('select');
    const group = item.children.find((child) => child.type === type && child.children.length > 1);

    if (group) {
      try {
        group.children.forEach((child) => {
          const lookupOptions = Array.from(EquipmentParser.lookupItems[child.key] || []);
          lookupOptions.sort((a, b) => a.name.localeCompare(b.name));

          lookupOptions.forEach((option) => {
            const optionElement = document.createElement('option');
            optionElement.value = option._id;
            optionElement.textContent = option.name;
            dropdown.appendChild(optionElement);
          });

          this.markAsRendered(child);
        });
      } catch (error) {
        HM.log(1, `Error in processing ${type} group for dropdown in special case: ${item._id}`, error);
      }
    }
    return dropdown;
  }

  markAsRendered(entry) {
    entry.rendered = true;
    entry.group = entry.group;
    entry.sort = entry.sort;
    entry.isSpecialCase = true;
    HM.log(3, 'Marked as special case-rendered:', entry);
  }

  async renderOrBlock(item, itemContainer) {
    const labelElement = document.createElement('h4');
    labelElement.classList.add('parent-label');
    labelElement.textContent = item.label || 'Choose one of the following';
    itemContainer.appendChild(labelElement);

    const select = document.createElement('select');
    select.id = item._source.key;

    // Add a hidden field to store the default selection
    const defaultSelection = document.createElement('input');
    defaultSelection.type = 'hidden';
    defaultSelection.id = `${item._source.key}-default`;
    itemContainer.appendChild(defaultSelection);

    // Create an event handler to track selections
    select.addEventListener('change', (event) => {
      defaultSelection.value = event.target.value;
    });

    itemContainer.appendChild(select);

    // Check for different types of specialized choices
    const isMultiQuantityChoice = this.isMultiQuantityChoice(item);
    const weaponTypeChild = this.findWeaponTypeChild(item);
    const hasFocusOption = item.children.some((child) => child.type === 'focus');
    const isWeaponShieldChoice = this.isWeaponShieldChoice(item);
    const hasDualWeaponOption = item.children.some((child) => child.type === 'weapon' && child.count === 2);
    let secondSelect = null;

    // Handle weapon-shield choice pattern
    if (isWeaponShieldChoice && hasDualWeaponOption) {
      const dropdownContainer = document.createElement('div');
      dropdownContainer.classList.add('dual-weapon-selection');

      secondSelect = document.createElement('select');

      secondSelect.id = `${item._source.key}-second`;

      const secondLabel = document.createElement('label');
      secondLabel.htmlFor = secondSelect.id;
      secondLabel.textContent = 'Choose second option';
      secondLabel.classList.add('second-weapon-label');

      dropdownContainer.appendChild(secondLabel);
      dropdownContainer.appendChild(secondSelect);
      itemContainer.appendChild(dropdownContainer);

      // Find the weapon child to determine which lookup key to use
      const andGroup = item.children.find((child) => child.type === 'AND');
      const weaponChild = andGroup.children.find((child) => child.type === 'weapon' && ['martialM', 'mar', 'simpleM', 'sim'].includes(child.key));
      const weaponLookupKey = weaponChild.key;

      // Populate first dropdown with weapons
      const weaponOptions = Array.from(EquipmentParser.lookupItems[weaponLookupKey] || []);
      weaponOptions.sort((a, b) => a.name.localeCompare(b.name));

      // Add initial empty option to first dropdown
      const emptyOption = document.createElement('option');
      emptyOption.value = '';
      emptyOption.textContent = 'Select a weapon';
      select.appendChild(emptyOption);

      weaponOptions.forEach((weapon) => {
        const option = document.createElement('option');

        option.value = weapon._source.key;
        option.textContent = weapon.name;
        select.appendChild(option);
      });

      // Function to populate second dropdown
      const populateSecondDropdown = () => {
        secondSelect.innerHTML = '<option value="">Select second option</option>';

        // Add weapon options
        weaponOptions.forEach((weapon) => {
          const option = document.createElement('option');

          option.value = weapon._source.key;
          option.textContent = weapon.name;
          secondSelect.appendChild(option);
        });

        // Add shield options
        const shieldOptions = Array.from(EquipmentParser.lookupItems['shield'] || []);
        shieldOptions.sort((a, b) => a.name.localeCompare(b.name));

        shieldOptions.forEach((shield) => {
          const option = document.createElement('option');
          option.value = shield._source.key;
          option.textContent = shield.name;
          secondSelect.appendChild(option);
        });
      };

      populateSecondDropdown();
      select.addEventListener('change', populateSecondDropdown);

      return itemContainer;
    }
    // Handle regular weapon quantity choices
    else if (isMultiQuantityChoice && weaponTypeChild) {
      const dropdownContainer = document.createElement('div');
      dropdownContainer.classList.add('dual-weapon-selection');

      const secondSelect = document.createElement('select');
      secondSelect.id = `${item._source.key}-second`;
      secondSelect.style.display = 'none';

      const secondLabel = document.createElement('label');
      secondLabel.htmlFor = secondSelect.id;
      secondLabel.textContent = 'Choose second weapon';
      secondLabel.style.display = 'none';
      secondLabel.classList.add('second-weapon-label');

      dropdownContainer.appendChild(secondLabel);
      dropdownContainer.appendChild(secondSelect);
      itemContainer.appendChild(dropdownContainer);

      select.addEventListener('change', async (event) => {
        const isWeaponSelection = event.target.value !== this.findLinkedItemId(item);
        secondLabel.style.display = isWeaponSelection ? 'block' : 'none';
        secondSelect.style.display = isWeaponSelection ? 'block' : 'none';

        if (isWeaponSelection) {
          secondSelect.innerHTML = '<option value="">Select a weapon</option>';
          const lookupOptions = Array.from(EquipmentParser.lookupItems[weaponTypeChild.key] || []);
          lookupOptions.sort((a, b) => a.name.localeCompare(b.name));

          lookupOptions.forEach((option) => {
            const optionElement = document.createElement('option');
            const itemQuantityMatch = child.label?.match(/^(\d+)\s+(.+)$/i);
            if (itemQuantityMatch) {
              optionElement.dataset.quantity = itemQuantityMatch[1];
              optionElement.textContent = child.label;
            } else {
              optionElement.dataset.quantity = child.count || 1;
              optionElement.textContent = child.count > 1 ? `${child.count} ${option.name}` : option.name;
            }
            optionElement.value = option._source.key;
            optionElement.textContent = option.name;
            secondSelect.appendChild(optionElement);
          });
        }
      });
    }

    // Handle regular items and focus items separately
    const renderedItemNames = new Set();
    const nonFocusItems = item.children.filter((child) => child.type !== 'focus');

    // Render non-focus items first
    for (const child of nonFocusItems) {
      if (child.type === 'AND') {
        await this.renderAndGroup(child, select, renderedItemNames);
      } else if (['linked', 'weapon', 'tool', 'armor'].includes(child.type)) {
        await this.renderIndividualItem(child, select, renderedItemNames);
      }
    }

    // Handle focus option if present
    if (hasFocusOption) {
      const option = document.createElement('option');
      option.value = 'arcane-focus';
      option.textContent = 'Any Arcane Focus';
      select.appendChild(option);

      const inputField = document.createElement('input');
      inputField.type = 'text';
      inputField.id = `${select.id}-focus-input`;
      inputField.placeholder = 'Enter your arcane focus...';
      inputField.style.display = 'none';
      inputField.classList.add('arcane-focus-input');

      select.insertAdjacentElement('afterend', inputField);

      select.addEventListener('change', (event) => {
        const focusInput = document.getElementById(`${select.id}-focus-input`);
        if (focusInput) {
          focusInput.style.display = event.target.value === 'arcane-focus' ? 'block' : 'none';
          if (event.target.value !== 'arcane-focus') {
            focusInput.value = '';
          }
        }
      });
    }

    return itemContainer;
  }

  isWeaponShieldChoice(item) {
    const andGroup = item.children.find((child) => child.type === 'AND');
    if (!andGroup) return false;

    const hasWeapon = andGroup.children?.some((child) => child.type === 'weapon' && ['martialM', 'mar', 'simpleM', 'sim'].includes(child.key));
    const hasShield = andGroup.children?.some((child) => child.type === 'armor' && child._source?.key?.includes('shield'));

    return hasWeapon && hasShield;
  }

  shouldRenderAsDropdown(item) {
    // Check for items that are part of an OR block
    if (item.group) {
      const parentItem =
        this.equipmentData.class.find((p) => p._source.key === item.group) || this.equipmentData.background.find((p) => p._source.key === item.group);
      return parentItem?.type === 'OR';
    }

    // Check for combined items that should be rendered in a dropdown
    if (item.type === 'AND' && item.children?.length > 1) {
      const parent =
        this.equipmentData.class.find((p) => p._source.key === item.group) || this.equipmentData.background.find((p) => p._source.key === item.group);
      if (parent?.type === 'OR') {
        return true;
      }
    }

    // Check if item is already part of a combined selection
    if (this.combinedItemIds.has(item._source.key)) {
      return true;
    }

    // Top-level OR blocks should be dropdowns
    return item.type === 'OR';
  }

  isMultiQuantityChoice(item) {
    let quantityChoices = 0;
    for (const child of item.children) {
      if (child.count && child.count > 1) {
        quantityChoices++;
      }
    }
    return quantityChoices > 1;
  }

  findWeaponTypeChild(item) {
    return item.children.find((child) => child.type === 'weapon' && child.key === 'simpleM');
  }

  findLinkedItemId(item) {
    const linkedItem = item.children.find((child) => child.type === 'linked');
    return linkedItem ? linkedItem._source.key : null;
  }

  async renderAndGroup(child, select, renderedItemNames) {
    let combinedLabel = '';
    const combinedIds = [];
    const lookupKeys = ['sim', 'mar', 'simpleM', 'simpleR', 'martialM', 'martialR', 'shield'];

    for (const subChild of child.children) {
      try {
        // Check if this is a lookup key
        if (lookupKeys.includes(subChild.key)) {
          if (combinedLabel) combinedLabel += ' + ';
          // Create a descriptive label based on the key
          const lookupLabel = this.getLookupKeyLabel(subChild.key);
          combinedLabel += `${subChild.count || ''} ${lookupLabel}`.trim();
          combinedIds.push(subChild._id);
          continue;
        }

        // Handle normal linked items
        const subChildItem = await fromUuidSync(subChild.key);
        if (!subChildItem) throw new Error(`Item not found for UUID: ${subChild.key}`);

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
      const optionElement = document.createElement('option');
      optionElement.value = combinedIds.join(',');
      optionElement.textContent = combinedLabel;
      select.appendChild(optionElement);
    }
  }

  getLookupKeyLabel(key) {
    const labels = {
      sim: 'Simple Weapon',
      mar: 'Martial Weapon',
      simpleM: 'Simple Melee Weapon',
      simpleR: 'Simple Ranged Weapon',
      martialM: 'Martial Melee Weapon',
      martialR: 'Martial Ranged Weapon',
      shield: 'Shield'
    };
    return labels[key] || key;
  }

  async renderIndividualItem(child, select, renderedItemNames, focusInput) {
    if (child.type === 'linked') {
      const trueName = child.label.replace(/\s*\(.*?\)\s*/g, '').trim();
      if (renderedItemNames.has(trueName) || this.combinedItemIds.has(child._source.key)) return;
      renderedItemNames.add(trueName);

      const optionElement = document.createElement('option');
      optionElement.value = child._source.key;
      optionElement.textContent = trueName;

      if (child.requiresProficiency) {
        const requiredProficiency = `${child.type}:${child.key}`;
        if (!this.proficiencies.has(requiredProficiency)) {
          optionElement.disabled = true;
          optionElement.textContent = `${trueName} (${game.i18n.localize('hm.app.equipment.lacks-proficiency')})`;
        }
      }

      select.appendChild(optionElement);
    } else if (child.type === 'focus' && child.key === 'arcane') {
      if (!renderedItemNames.has('Any Arcane Focus')) {
        renderedItemNames.add('Any Arcane Focus');
        const optionElement = document.createElement('option');
        optionElement.value = 'arcane-focus';
        optionElement.textContent = 'Any Arcane Focus';
        select.appendChild(optionElement);

        const inputField = document.createElement('input');
        inputField.type = 'text';
        inputField.id = `${select.id}-focus-input`;
        inputField.placeholder = 'Enter your arcane focus...';
        inputField.style.display = 'none';
        inputField.classList.add('arcane-focus-input');

        select.insertAdjacentElement('afterend', inputField);

        select.addEventListener('change', (event) => {
          inputField.style.display = event.target.value === 'arcane-focus' ? 'block' : 'none';
          if (event.target.value !== 'arcane-focus') {
            inputField.value = '';
          }
        });
      }
    } else if (['weapon', 'armor', 'tool', 'shield'].includes(child.type)) {
      await this.renderLookupOptions(child, select, renderedItemNames);
    }
  }

  async renderLookupOptions(child, select, renderedItemNames) {
    try {
      const lookupOptions = Array.from(EquipmentParser.lookupItems[child.key] || []);
      lookupOptions.sort((a, b) => a.name.localeCompare(b.name));

      // Add a hidden field to store the default selection if it doesn't exist
      let defaultSelection = select.parentElement.querySelector(`#${select.id}-default`);
      if (!defaultSelection) {
        defaultSelection = document.createElement('input');
        defaultSelection.type = 'hidden';
        defaultSelection.id = `${select.id}-default`;
        select.parentElement.appendChild(defaultSelection);
      }

      let isFirstEnabledOption = true;
      lookupOptions.forEach((option) => {
        if (renderedItemNames.has(option.name)) return;
        if (option.rendered && option.sort === child.sort && option.group === child.group) return;

        option.rendered = true;
        option.group = child.group;
        option.sort = child.sort;
        option.key = child.key;

        renderedItemNames.add(option.name);

        const optionElement = document.createElement('option');

        optionElement.value = option._source.key;
        optionElement.textContent = option.name;

        let isEnabled = true;
        if (child.requiresProficiency) {
          const requiredProficiency = `${child.type}:${child.key}`;
          if (!this.proficiencies.has(requiredProficiency)) {
            optionElement.disabled = true;
            optionElement.textContent = `${option.name} (${game.i18n.localize('hm.app.equipment.lacks-proficiency')})`;
            isEnabled = false;
          }
        }

        // If this is the first enabled option, select it and set it as default
        if (isFirstEnabledOption && isEnabled) {
          optionElement.selected = true;
          defaultSelection.value = option._source.key;
          select.value = option._source.key;
          isFirstEnabledOption = false;
        }

        select.appendChild(optionElement);
      });
    } catch (error) {
      HM.log(1, `Error retrieving lookup options for ${child.key}: ${error.message}`);
    }
  }

  async renderAndBlock(item, itemContainer) {
    if (item.group) {
      HM.log(3, `Skipping label for AND group with parent group: ${item.group}`);
    } else {
      const andLabelElement = document.createElement('h4');
      andLabelElement.classList.add('parent-label');
      andLabelElement.textContent = item.label || 'All of the following:';
      itemContainer.appendChild(andLabelElement);
    }

    const lookupItems = item.children.filter(
      (child) =>
        child.type === 'weapon' &&
        (child.key === 'sim' ||
          child.key === 'mar' ||
          child.key === 'simpleM' ||
          child.key === 'simpleR' ||
          child.key === 'martialM' ||
          child.key === 'martialR')
    );
    const linkedItems = item.children.filter((child) => child.type === 'linked');

    const renderedItemNames = new Set();
    const combinedIds = [];
    let combinedLabel = '';

    for (const child of linkedItems) {
      if (!child._source?.key) continue;

      // Get the actual item using fromUuidSync to get its name
      const linkedItem = await fromUuidSync(child._source.key);
      if (!linkedItem) continue;

      const count = child._source.count || 1;
      combinedIds.push(child._source.key);

      if (combinedLabel) combinedLabel += ' + ';
      combinedLabel += `${count || ''} ${linkedItem.name}`.trim();
    }

    // Render linked items checkbox if there are any
    if (combinedLabel && !renderedItemNames.has(combinedLabel)) {
      renderedItemNames.add(combinedLabel);

      for (const child of linkedItems) {
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
    }

    // Render lookup items as dropdowns
    for (const lookupItem of lookupItems) {
      const select = document.createElement('select');
      select.id = lookupItem._source.key;
      await this.renderLookupOptions(lookupItem, select, new Set());
      itemContainer.appendChild(select);
    }

    return itemContainer;
  }

  renderLinkedItem(item, itemContainer) {
    if (this.combinedItemIds.has(item._source.key)) return null;
    if (this.shouldRenderAsDropdown(item)) return null;

    const linkedCheckbox = document.createElement('input');
    linkedCheckbox.type = 'checkbox';
    linkedCheckbox.id = item._source.key;
    linkedCheckbox.checked = true;
    itemContainer.appendChild(linkedCheckbox);

    const linkedLabel = document.createElement('label');
    linkedLabel.htmlFor = item._source.key;
    // Consider using item.count from _source if available
    const count = item._source.count ? `${item._source.count} ` : '';
    linkedLabel.textContent = `${count}${item.label || 'Unknown Linked Item'}`;
    itemContainer.appendChild(linkedLabel);

    return itemContainer;
  }

  renderFocusItem(item, itemContainer) {
    if (this.shouldRenderAsDropdown(item)) return null;

    const focusLabel = document.createElement('label');
    focusLabel.htmlFor = item._source.key;
    focusLabel.textContent = item.label || 'Custom Focus';
    itemContainer.appendChild(focusLabel);

    const input = document.createElement('input');
    input.type = 'text';
    input.id = item._source.key;
    input.value = `${item.key} ${item.type}`;
    itemContainer.appendChild(input);

    return itemContainer;
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
      for (const pack of game.packs.filter((pack) => pack.documentName === 'Item')) {
        const documents = await pack.getDocuments({ type__in: typesToFetch });

        documents.forEach((item) => {
          const itemType = item.system?.type?.value || item.type;
          const isMagic = item.system?.properties instanceof Set && item.system.properties.has('mgc');

          if (item.name === 'Unarmed Strike' || isMagic) return;

          if (
            (lookupKey === 'sim' && (itemType === 'simpleM' || itemType === 'simpleR')) ||
            (lookupKey === 'simpleM' && itemType === 'simpleM') ||
            (lookupKey === 'simpleR' && itemType === 'simpleR') ||
            (lookupKey === 'mar' && (itemType === 'martialM' || itemType === 'martialR')) ||
            (lookupKey === 'martialM' && itemType === 'martialM') ||
            (lookupKey === 'martialR' && itemType === 'martialR') ||
            (lookupKey === 'music' && itemType === 'music') ||
            (lookupKey === 'shield' && itemType === 'shield') ||
            (lookupKey === 'armor' && (itemType === 'medium' || itemType === 'light' || itemType === 'heavy')) ||
            itemType === lookupKey
          ) {
            items.push(item);
            HM.log(3, `Added item: ${item.name} with ID: ${item._id} to ${lookupKey} collection.`);
          }
        });
      }
    } catch (error) {
      HM.log(1, `Error collecting items for lookupKey: ${lookupKey}`, error);
    }

    return items;
  }
}
