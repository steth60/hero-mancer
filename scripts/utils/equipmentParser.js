import { HM } from '../hero-mancer.js';

export class EquipmentParser {
  static simpleM = new Set();

  static simpleR = new Set();

  static martialM = new Set();

  static martialR = new Set();

  static music = new Set();

  static shield = new Set();

  static armor = new Set();

  static focus = new Set();

  static contentCache = new Map();

  static renderedItems = new Set();

  static combinedItemIds = new Set();

  static async initializeContentCache() {
    HM.log(3, 'Initializing content cache...');
    const packs = game.packs.filter((p) => p.documentName === 'Item');
    await Promise.all(packs.map((p) => p.getIndex({ fields: ['system.contents', 'uuid'] })));
    HM.log(3, `Content cache initialized with ${this.contentCache.size} entries`);
  }

  constructor() {
    this.equipmentData = null;
    this.classId = HM.CONFIG.SELECT_STORAGE.class.selectedId;
    this.backgroundId = HM.CONFIG.SELECT_STORAGE.background.selectedId;
    this.proficiencies = new Set();

    EquipmentParser.initializeContentCache();

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
    const { selectedId } = HM.CONFIG.SELECT_STORAGE[type] || {};
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
    EquipmentParser.renderedItems = new Set();
    EquipmentParser.combinedItemIds = new Set();
    this.equipmentData = null;

    await EquipmentParser.initializeLookupItems();
    HM.log(3, EquipmentParser.lookupItems);
    HM.log(3, `Rendering equipment choices for ${type || 'all types'}.`);

    await this.fetchEquipmentData();

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
      const dropdown = document.querySelector(`#${currentType}-dropdown`);
      const dropdownText = dropdown.selectedOptions[0].textContent;
      const isPlaceholder = dropdownText === placeholderText;

      // Add a header for the section based on whether it's a placeholder
      const header = document.createElement('h3');
      header.textContent = isPlaceholder ? `${currentType.charAt(0).toUpperCase() + currentType.slice(1)} Equipment` : `${dropdownText} Equipment`;
      sectionContainer.appendChild(header);
      if (currentType === 'class' && this.classId) {
        await this.renderClassWealthOption(this.classId, sectionContainer);
      }
      // Render each item within the current section
      for (const item of items) {
        const itemDoc = await fromUuidSync(item.key);
        HM.log(3, 'PROCESSING ITEM DEBUG:', item, itemDoc);
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
    if (this.isItemRendered(item)) {
      HM.log(3, `RENDER DEBUG: Skipping already rendered item: ${item._source.key}`, item);
      return null;
    }

    HM.log(3, `RENDER DEBUG: Rendering item: ${item?.name || item._source?.key || item.type}`, item);

    const itemContainer = document.createElement('div');
    itemContainer.classList.add('equipment-item');

    if (!item.group) {
      const labelElement = document.createElement('h4');
      labelElement.classList.add('parent-label');

      let shouldAddLabel = false;

      if (item.key) {
        try {
          const itemDoc = await fromUuidSync(item.key);
          if (itemDoc) {
            labelElement.innerHTML = item.label || `${item.count || ''} ${itemDoc.name}`;
            HM.log(3, `RENDER DEBUG: Adding label: ${labelElement.innerHTML} for item key: ${item.key}`, item, labelElement);
            shouldAddLabel = true;
          } else {
            HM.log(2, `No document found for item key: ${item.key}`, item, labelElement);
            labelElement.innerHTML = item.label || game.i18n.localize('hm.app.equipment.choose-one');
            HM.log(3, `RENDER DEBUG: Fallback label added: ${labelElement.innerHTML}`, item, labelElement);
            shouldAddLabel = true;
          }
        } catch (error) {
          HM.log(2, `Error getting label for item ${item._source.key}: ${error.message}`, item, labelElement);
          labelElement.innerHTML = item.label || game.i18n.localize('hm.app.equipment.choose-one');
          HM.log(3, `RENDER DEBUG: Error fallback label added: ${labelElement.innerHTML}`, item, labelElement);
          shouldAddLabel = true;
        }
      }
      if (shouldAddLabel) {
        HM.log(3, `RENDER DEBUG: Appending label element to item container: ${labelElement.outerHTML}`, item, labelElement);
        itemContainer.appendChild(labelElement);
      }
    }

    // First check if this is part of an OR choice
    if (item.group) {
      const parentItem = this.equipmentData.class.find((p) => p._id === item.group) || this.equipmentData.background.find((p) => p._id === item.group);
      if (parentItem?.type === 'OR') {
        HM.log(3, `RENDER DEBUG: Skipping rendering for item in OR choice group: ${item._source.key}`, item, parentItem);
        return null;
      }
    }

    let result;
    switch (item.type) {
      case 'OR':
        HM.log(3, `RENDER DEBUG: Rendering OR block for item: ${item._source.key}`, item);
        result = await this.renderOrBlock(item, itemContainer);
        break;
      case 'AND':
        if (!item.group || this.isStandaloneAndBlock(item)) {
          HM.log(3, `RENDER DEBUG: Rendering AND block for item: ${item._source?.key || item.type}`, item);
          result = await this.renderAndBlock(item, itemContainer);
        }
        break;
      case 'linked':
        HM.log(3, `RENDER DEBUG: Rendering linked item: ${item._source.key}`, item);
        result = await this.renderLinkedItem(item, itemContainer);
        break;
      case 'focus':
        HM.log(3, `RENDER DEBUG: Rendering focus item: ${item._source.key}`, item);
        result = await this.renderFocusItem(item, itemContainer);
        break;
      default:
        HM.log(2, `Unknown item type encountered: ${item.type}`, { itemId: item._id }, item);
        return null;
    }

    if (result) {
      EquipmentParser.renderedItems.add(item._id);
    }

    return result;
  }

  isStandaloneAndBlock(item) {
    return !this.equipmentData.class.some((p) => p._id === item.group && p.type === 'OR') && !this.equipmentData.background.some((p) => p._id === item.group && p.type === 'OR');
  }

  isItemRendered(item) {
    return EquipmentParser.renderedItems.has(item._id);
  }

  isSpecialMultiOptionCase(item) {
    return item.type === 'OR' && item.children.some((child) => child.type === 'AND' && child.children.length > 1) && item.children.some((entry) => entry.count && entry.count > 1);
  }

  async renderSpecialMultiOptionCase(item) {
    HM.log(3, 'Special MultiOptionCase identified:', item);
    const itemContainer = document.createElement('div');
    itemContainer.classList.add('equipment-item');

    const labelElement = document.createElement('h4');
    labelElement.classList.add('parent-label');
    labelElement.innerHTML = item.label;
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
    entry.isSpecialCase = true;
    HM.log(3, 'Marked as special case-rendered:', entry);
  }

  async renderOrBlock(item, itemContainer) {
    HM.log(3, 'renderOrBlock received item:', {
      id: item._id,
      sourceKey: item._source?.key,
      type: item.type,
      children: item.children?.map((c) => ({
        id: c._id,
        sourceKey: c._source?.key,
        type: c.type,
        key: c.key
      }))
    });
    const labelElement = document.createElement('h4');
    labelElement.classList.add('parent-label');
    labelElement.innerHTML = item.label || game.i18n.localize('hm.app.equipment.choose-one');
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
      dropdownContainer.appendChild(secondSelect);
      itemContainer.appendChild(dropdownContainer);

      // Find the weapon child to determine which lookup key to use
      const andGroup = item.children.find((child) => child.type === 'AND');
      const weaponChild = andGroup.children.find((child) => child.type === 'weapon' && ['martialM', 'mar', 'simpleM', 'sim'].includes(child.key));
      const weaponLookupKey = weaponChild.key;

      // Populate first dropdown with weapons
      const weaponOptions = Array.from(EquipmentParser.lookupItems[weaponLookupKey] || []);
      weaponOptions.sort((a, b) => a.name.localeCompare(b.name));

      // Add weapons to first dropdown and select the first one
      weaponOptions.forEach((weapon, index) => {
        const option = document.createElement('option');
        option.value = weapon._source.key;
        option.innerHTML = weapon.name;
        if (index === 0) option.selected = true; // Select first weapon
        select.appendChild(option);
      });

      const populateSecondDropdown = () => {
        secondSelect.innerHTML = '';
        weaponOptions.forEach((weapon, index) => {
          const option = document.createElement('option');
          option.value = weapon._source.key;
          option.innerHTML = weapon.name;
          if (index === 0) option.selected = true; // Select first weapon
          secondSelect.appendChild(option);
        });

        // Add shield options
        const shieldOptions = Array.from(EquipmentParser.lookupItems.shield || []);
        shieldOptions.sort((a, b) => a.name.localeCompare(b.name));

        shieldOptions.forEach((shield) => {
          const option = document.createElement('option');
          option.value = shield._source.key;
          option.innerHTML = shield.name;
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
      secondLabel.textContent = game.i18n.localize('hm.app.equipment.choose-second-weapon');
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
          secondSelect.innerHTML = `<option value="">${game.i18n.localize('hm.app.equipment.select-weapon')}</option>`;
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
    const focusItem = item.children.find((child) => child.type === 'focus');

    // Handle focus option if present
    if (hasFocusOption && focusItem) {
      const focusType = focusItem.key;
      const focusConfig = CONFIG.DND5E.focusTypes[focusType];

      if (focusConfig) {
        const pouchItem = nonFocusItems.find((child) => child.type === 'linked' && child.label?.toLowerCase().includes('component pouch'));
        if (pouchItem) {
          pouchItem.rendered = true;
          renderedItemNames.add('Component Pouch');

          const pouchOption = document.createElement('option');
          pouchOption.value = pouchItem._source.key;
          pouchOption.textContent = pouchItem.label || pouchItem.name;
          pouchOption.selected = true;
          select.appendChild(pouchOption);
          defaultSelection.value = pouchItem._source.key;
        }

        // Add focus options
        Object.entries(focusConfig.itemIds).forEach(([focusName, itemId]) => {
          const option = document.createElement('option');
          option.value = itemId;
          option.textContent = focusName.charAt(0).toUpperCase() + focusName.slice(1);
          select.appendChild(option);
        });
      } else {
        HM.log(2, `No focus configuration found for type: ${focusType}`);
      }
    }

    for (const child of nonFocusItems) {
      if (child.type === 'AND') {
        await this.renderAndGroup(child, select, renderedItemNames);
      } else if (['linked', 'weapon', 'tool', 'armor'].includes(child.type)) {
        await this.renderIndividualItem(child, select, renderedItemNames);
      }
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
      const parentItem = this.equipmentData.class.find((p) => p._source.key === item.group) || this.equipmentData.background.find((p) => p._source.key === item.group);
      return parentItem?.type === 'OR';
    }

    // Check for combined items that should be rendered in a dropdown
    if (item.type === 'AND' && item.children?.length > 1) {
      const parent = this.equipmentData.class.find((p) => p._source.key === item.group) || this.equipmentData.background.find((p) => p._source.key === item.group);
      if (parent?.type === 'OR') {
        return true;
      }
    }

    // Check if item is already part of a combined selection
    if (EquipmentParser.combinedItemIds.has(item._source.key)) {
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
    const processedIds = new Set();

    // Mark all children as rendered if this is part of an OR choice
    const isPartOfOrChoice =
      (child.group && this.equipmentData.class.some((p) => p._id === child.group && p.type === 'OR')) ||
      this.equipmentData.background.some((p) => p._id === child.group && p.type === 'OR');

    for (const subChild of child.children) {
      try {
        if (processedIds.has(subChild._id)) continue;
        processedIds.add(subChild._id);
        // Check if this is a lookup key
        if (lookupKeys.includes(subChild.key)) {
          if (combinedLabel) combinedLabel += ' + ';
          // Create a descriptive label based on the key
          const lookupLabel = this.getLookupKeyLabel(subChild.key);
          combinedLabel += `${subChild.count > 1 || subChild.count !== null ? subChild.count : ''} ${lookupLabel}`.trim();
          combinedIds.push(subChild._id);

          if (isPartOfOrChoice) {
            subChild.rendered = true;
            subChild.isSpecialCase = true;
          }
          continue;
        }

        // Handle normal linked items
        const subChildItem = await fromUuidSync(subChild.key);
        if (!subChildItem) throw new Error(`Item not found for UUID: ${subChild.key}`);

        if (combinedLabel) combinedLabel += ' + ';
        // Create proper HTML link
        combinedLabel +=
          `${subChild.count > 1 || subChild.count !== null ? subChild.count : ''} <a class="content-link" draggable="true" data-uuid="${subChild.key}">${subChildItem.name}</a>`.trim();
        combinedIds.push(subChild._id);

        if (isPartOfOrChoice) {
          subChild.rendered = true;
          subChild.isSpecialCase = true;
        }
        EquipmentParser.combinedItemIds.add(subChild._id);
      } catch (error) {
        HM.log(1, `Error processing sub-child in AND group for child ${child._id}: ${error.message}`);
        continue;
      }
    }

    if (combinedLabel && !renderedItemNames.has(combinedLabel)) {
      renderedItemNames.add(combinedLabel);
      const optionElement = document.createElement('option');
      optionElement.value = combinedIds.join(',');
      optionElement.innerHTML = combinedLabel;
      select.appendChild(optionElement);

      // Mark all items in the combination as rendered
      combinedIds.forEach((id) => {
        EquipmentParser.renderedItems.add(id);
        EquipmentParser.combinedItemIds.add(id);
      });

      if (isPartOfOrChoice) {
        child.rendered = true;
        child.isSpecialCase = true;
      }
    }
  }

  /* TODO: Get this data from CONFIG.DND5E instead. */
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

  async renderIndividualItem(child, select, renderedItemNames) {
    if (child.type === 'linked') {
      if (EquipmentParser.combinedItemIds.has(child._source.key)) return;
      const label = child.label.trim();
      const [, count, name] = label.match(/^(\d+)\s*(.+)$/) || [null, null, label];
      const displayName = name || label.replace(/\s*\(.*?\)\s*/g, '');

      if (renderedItemNames.has(displayName) || EquipmentParser.combinedItemIds.has(child._source.key)) return;
      renderedItemNames.add(displayName);

      const optionElement = document.createElement('option');
      optionElement.value = child._source.key;
      optionElement.innerHTML = count > 1 || count !== null ? `${count} ${displayName}` : displayName;

      if (select.options.length === 0) {
        optionElement.selected = true;
        const defaultSelection = select.parentElement.querySelector(`#${select.id}-default`);
        if (defaultSelection) {
          defaultSelection.value = child._source.key;
        }
      }

      if (child.requiresProficiency) {
        const requiredProficiency = `${child.type}:${child.key}`;
        if (!this.proficiencies.has(requiredProficiency)) {
          optionElement.disabled = true;
          optionElement.innerHTML = `${optionElement.innerHTML} (${game.i18n.localize('hm.app.equipment.lacks-proficiency')})`;
        }
      }

      select.appendChild(optionElement);
    } else if (['weapon', 'armor', 'tool', 'shield'].includes(child.type)) {
      await this.renderLookupOptions(child, select, renderedItemNames);
    }
  }

  async renderLookupOptions(child, select, renderedItemNames) {
    try {
      const lookupOptions = Array.from(EquipmentParser.lookupItems[child.key] || []);
      lookupOptions.sort((a, b) => a.name.localeCompare(b.name));

      let defaultSelection = select.parentElement.querySelector(`#${select.id}-default`);
      if (!defaultSelection) {
        defaultSelection = document.createElement('input');
        defaultSelection.type = 'hidden';
        defaultSelection.id = `${select.id}-default`;
        select.parentElement.appendChild(defaultSelection);
      }

      let shouldSelectFirst = select.options.length === 0;
      let isFirstEnabledOption = true;

      lookupOptions.forEach((option) => {
        if (renderedItemNames.has(option.name)) return;
        if (option.rendered && option.sort === child.sort && option.group === child.group) return;

        const uuid = option.uuid;
        if (!uuid) {
          HM.log(2, `No UUID found for item ${option.id}`, option);
          return;
        }

        option.rendered = true;
        option.group = child.group;
        option.sort = child.sort;
        option.key = child.key;

        renderedItemNames.add(option.name);

        const optionElement = document.createElement('option');
        optionElement.value = uuid;
        optionElement.innerHTML = option.name;
        let isEnabled = true;
        if (child.requiresProficiency) {
          const requiredProficiency = `${child.type}:${child.key}`;
          if (!this.proficiencies.has(requiredProficiency)) {
            optionElement.disabled = true;
            optionElement.innerHTML = `${option.name} (${game.i18n.localize('hm.app.equipment.lacks-proficiency')})`;
            isEnabled = false;
          }
        }

        // Only set as selected if this is the first enabled option AND we should select first
        if (shouldSelectFirst && isFirstEnabledOption && !optionElement.disabled && isEnabled) {
          optionElement.selected = true;
          defaultSelection.value = uuid;
          select.value = uuid;
          isFirstEnabledOption = false;
        }

        select.appendChild(optionElement);
      });
    } catch (error) {
      HM.log(1, `Error retrieving lookup options for ${child.key}: ${error.message}`);
    }
  }

  async renderAndBlock(item, itemContainer) {
    const processedIds = new Set();
    if (item.group) {
      const andLabelElement = document.createElement('h4');
      andLabelElement.classList.add('parent-label');
      andLabelElement.innerHTML = item.label || game.i18n.localize('hm.app.equipment.choose-all');
      itemContainer.appendChild(andLabelElement);
    }

    const hasWeaponAmmoContainer = async (items) => {
      const itemDocs = await Promise.all(
        items.map(async (item) => {
          const doc = await fromUuidSync(item._source?.key);
          HM.log(3, 'Got item doc:', doc);
          return doc;
        })
      );

      HM.log(3, 'Checking entire group:', itemDocs);

      const hasWeapon = itemDocs.some((doc) => doc?.type === 'weapon' || (doc?.system?.properties && Array.from(doc.system.properties).includes('amm')));
      const hasAmmo = itemDocs.some((doc) => doc?.system?.type?.value === 'ammo');
      const hasContainer = itemDocs.some((doc) => doc?.type === 'container');

      const shouldGroup = hasWeapon || hasAmmo || hasContainer;
      HM.log(3, 'Group check result:', { hasWeapon, hasAmmo, hasContainer, shouldGroup });
      return shouldGroup;
    };

    const lookupItems = item.children.filter((child) => child.type === 'weapon' && ['sim', 'mar', 'simpleM', 'simpleR', 'martialM', 'martialR'].includes(child.key));

    const linkedItems = await Promise.all(
      item.children
        .filter((child) => child.type === 'linked')
        .map(async (child) => {
          const shouldGroup = await hasWeaponAmmoContainer([child]);
          HM.log(3, 'GROUPING CHECK:', {
            child,
            key: child._source?.key,
            type: child.type,
            shouldGroup
          });
          return shouldGroup ? child : null;
        })
    );

    const filteredLinkedItems = linkedItems.filter((item) => item !== null);
    HM.log(
      3,
      'FILTERED ITEMS:',
      filteredLinkedItems.map((i) => i._source?.key)
    );

    const groupedItems = [];
    const processedItems = new Set();

    for (const child of filteredLinkedItems) {
      if (processedItems.has(child._source?.key)) continue;

      const relatedItems = await Promise.all(
        filteredLinkedItems.map(async (item) => {
          if (processedItems.has(item._source?.key) || item._source?.key === child._source?.key) return null;
          const result = await hasWeaponAmmoContainer([child, item]);
          return result ? item : null;
        })
      );

      const validRelatedItems = relatedItems.filter((item) => item !== null);
      HM.log(3, 'Valid related items:', validRelatedItems);

      if (validRelatedItems.length > 0) {
        groupedItems.push([child, ...validRelatedItems]);
        validRelatedItems.forEach((item) => processedItems.add(item._source?.key));
        processedItems.add(child._source?.key);
      } else if (!processedItems.has(child._source?.key)) {
        groupedItems.push([child]);
        processedItems.add(child._source?.key);
      }
    }

    HM.log(
      3,
      'FINAL GROUPS:',
      groupedItems.map((g) => g.map((i) => i._source?.key))
    );

    for (const group of groupedItems) {
      let combinedLabel = '';
      const combinedIds = [];

      for (const child of group) {
        if (processedIds.has(child._source?.key)) continue;
        processedIds.add(child._source?.key);

        const linkedItem = await fromUuidSync(child._source?.key);
        HM.log(3, 'Got linked item:', linkedItem);
        if (!linkedItem) continue;

        const count = child._source?.count > 1 || child._source?.count !== null ? child._source?.count : '';
        combinedIds.push(child._source?.key);

        if (combinedLabel) combinedLabel += ' + ';
        combinedLabel += `${count ? `${count} ` : ''}${linkedItem.name}`.trim();

        // Add to tracking sets immediately
        EquipmentParser.renderedItems.add(child._id);
        EquipmentParser.combinedItemIds.add(child._source?.key);

        child.specialGrouping = true;
        child.rendered = true;
      }

      HM.log(3, 'Creating combined label:', {
        groupLength: group.length,
        combinedLabel,
        combinedIds,
        group: group.map((g) => ({
          key: g._source?.key,
          count: g._source?.count,
          name: g.name
        }))
      });

      if (combinedLabel && group.length > 1) {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = combinedIds.join(',');
        checkbox.checked = true;
        label.innerHTML = combinedLabel;
        label.prepend(checkbox);
        itemContainer.appendChild(label);
      } else {
        for (const child of group) {
          child.rendered = false;
          child.specialGrouping = false;
          // Also remove from tracking sets if ungrouping
          EquipmentParser.renderedItems.delete(child._id);
          EquipmentParser.combinedItemIds.delete(child._source?.key);
        }
      }
    }

    // Render lookup items as dropdowns
    for (const lookupItem of lookupItems) {
      const select = document.createElement('select');
      select.id = lookupItem._source.key;

      const lookupKey = lookupItem.key === 'sim' ? 'sim' : lookupItem.key === 'simpleM' ? 'simpleM' : lookupItem.key === 'simpleR' ? 'simpleR' : lookupItem.key;

      const lookupOptions = Array.from(EquipmentParser.lookupItems[lookupKey] || []);
      lookupOptions.sort((a, b) => a.name.localeCompare(b.name));

      lookupOptions.forEach((weapon) => {
        const option = document.createElement('option');
        option.value = weapon._source.key;
        option.innerHTML = weapon.name;
        select.appendChild(option);
      });

      itemContainer.appendChild(select);
    }

    return itemContainer;
  }

  renderLinkedItem(item, itemContainer) {
    if (item.group) {
      const parentItem = this.equipmentData.class.find((p) => p._id === item.group) || this.equipmentData.background.find((p) => p._id === item.group);
      if (parentItem?.type === 'OR') {
        return null;
      }
    }
    // Don't mark as rendered until we confirm the item should be displayed
    if (EquipmentParser.combinedItemIds.has(item._source.key)) {
      HM.log(3, 'Skipping item in combinedItems:', item._source.key);
      return null;
    }
    if (this.shouldRenderAsDropdown(item)) {
      HM.log(3, 'Skipping item that should be dropdown:', item._source.key);
      return null;
    }

    // Only check renderedItems if we've confirmed it's not part of a combination
    if (EquipmentParser.renderedItems.has(item._id)) {
      HM.log(3, 'Skipping previously rendered item:', item._id);
      return null;
    }

    // Create elements
    const labelElement = document.createElement('label');
    const linkedCheckbox = document.createElement('input');
    linkedCheckbox.type = 'checkbox';
    linkedCheckbox.id = item._source.key;
    linkedCheckbox.value = item._source.key;
    linkedCheckbox.checked = true;

    // Process display label
    let displayLabel = item.label;
    let displayCount = '';

    if (item.label?.includes('<a class')) {
      const countMatch = item.label.match(/^(\d+)&times;/);
      if (countMatch) {
        displayCount = countMatch[1];
        displayLabel = item.label.replace(/^\d+&times;\s*/, '').replace('</i>', `</i>${displayCount} `);
      }
    } else {
      displayCount = item._source.count > 1 || item._source.count !== null ? item._source.count : '';
    }

    labelElement.innerHTML = `${displayLabel?.trim() || game.i18n.localize('hm.app.equipment.unknown-choice')}`;
    labelElement.prepend(linkedCheckbox);
    itemContainer.appendChild(labelElement);

    // Only mark as rendered after successful creation
    EquipmentParser.renderedItems.add(item._id);

    // Rest of the event listener code...
    linkedCheckbox.addEventListener('change', (event) => {
      HM.log(3, 'Linked checkbox changed:', {
        checked: event.target.checked,
        id: event.target.id,
        value: event.target.value,
        itemKey: item.key
      });
    });

    return itemContainer;
  }

  renderFocusItem(item, itemContainer) {
    if (this.shouldRenderAsDropdown(item)) return null;

    const focusType = item.key;
    const focusConfig = CONFIG.DND5E.focusTypes[focusType];

    if (!focusConfig) {
      HM.log(2, `No focus configuration found for type: ${focusType}`);
      return null;
    }

    const select = document.createElement('select');
    select.id = `${item.key}-focus`;

    Object.entries(focusConfig.itemIds).forEach(([focusName, itemId]) => {
      const uuid = itemId.uuid || EquipmentParser.itemUuidMap.get(itemId);
      if (!uuid) {
        HM.log(2, `No UUID mapping found for focus item: ${itemId}`);
        return;
      }

      const option = document.createElement('option');
      option.value = uuid;
      option.textContent = focusName.charAt(0).toUpperCase() + focusName.slice(1);

      if (select.options.length === 0) {
        option.selected = true;
      }

      select.appendChild(option);
    });

    const label = document.createElement('h4');
    label.htmlFor = select.id;
    label.innerHTML = focusConfig.label;

    itemContainer.appendChild(label);
    itemContainer.appendChild(select);

    return itemContainer;
  }

  static async processStartingWealth(formData) {
    const useStartingWealth = formData['use-starting-wealth'];
    if (!useStartingWealth) return null;

    const wealthAmount = formData['starting-wealth-amount'];
    if (!wealthAmount) return null;

    const currencies = {
      pp: 0,
      gp: 0,
      ep: 0,
      sp: 0,
      cp: 0
    };

    // Match amounts with currency type: e.g. "25 gp", "30 sp"
    const matches = wealthAmount.match(/(\d+)\s*([a-z]{2})/gi);

    if (!matches) return null;

    matches.forEach((match) => {
      const [amount, currency] = match.toLowerCase().split(/\s+/);
      const value = parseInt(amount);

      if (!isNaN(value)) {
        switch (currency) {
          case 'pp':
            currencies.pp = value;
            break;
          case 'gp':
            currencies.gp = value;
            break;
          case 'ep':
            currencies.ep = value;
            break;
          case 'sp':
            currencies.sp = value;
            break;
          case 'cp':
            currencies.cp = value;
            break;
          default:
            currencies.gp = value; // Default to gold if currency not recognized
        }
      }
    });

    return currencies;
  }

  async renderClassWealthOption(classId, sectionContainer) {
    try {
      // Get class document to check for wealth formula
      const classDoc = await this.findItemInCompendiums(classId);
      if (!classDoc || !classDoc.system.wealth) return;

      // Create wealth option container
      const wealthContainer = document.createElement('div');
      wealthContainer.classList.add('wealth-option-container');

      // Create checkbox for toggling wealth option
      const wealthCheckbox = document.createElement('input');
      wealthCheckbox.type = 'checkbox';
      wealthCheckbox.id = 'use-starting-wealth';
      wealthCheckbox.name = 'use-starting-wealth';

      // Create label for checkbox
      const wealthLabel = document.createElement('label');
      wealthLabel.htmlFor = 'use-starting-wealth';
      wealthLabel.innerHTML = game.i18n.localize('hm.app.equipment.use-starting-wealth');

      // Create container for wealth rolling
      const wealthRollContainer = document.createElement('div');
      wealthRollContainer.classList.add('wealth-roll-container');
      wealthRollContainer.style.display = 'none';

      // Create input for wealth amount
      const wealthInput = document.createElement('input');
      wealthInput.type = 'text';
      wealthInput.id = 'starting-wealth-amount';
      wealthInput.name = 'starting-wealth-amount';
      wealthInput.readOnly = true;
      wealthInput.placeholder = game.i18n.localize('hm.app.equipment.wealth-placeholder');

      // Create roll button
      const rollButton = document.createElement('button');
      rollButton.type = 'button';
      rollButton.textContent = game.i18n.localize('hm.app.equipment.roll-wealth');
      rollButton.classList.add('wealth-roll-button');

      // Add roll handler
      rollButton.addEventListener('click', async () => {
        const formula = classDoc.system.wealth;
        const roll = new Roll(formula);
        await roll.evaluate();
        wealthInput.value = `${roll.total} gp`;
      });

      // Add checkbox handler
      wealthCheckbox.addEventListener('change', (event) => {
        const equipmentElements = sectionContainer.querySelectorAll('.equipment-item');
        equipmentElements.forEach((el) => {
          if (event.target.checked) {
            el.classList.add('disabled');
            el.querySelectorAll('select, input[type="checkbox"], label').forEach((input) => {
              input.disabled = true;
            });
          } else {
            el.classList.remove('disabled');
            el.querySelectorAll('select, input[type="checkbox"], label').forEach((input) => {
              input.disabled = false;
            });
          }
        });
        wealthRollContainer.style.display = event.target.checked ? 'flex' : 'none';
        if (!event.target.checked) {
          wealthInput.value = '';
        }
      });

      // Assemble the components
      wealthContainer.appendChild(wealthCheckbox);
      wealthContainer.appendChild(wealthLabel);
      wealthRollContainer.appendChild(wealthInput);
      wealthRollContainer.appendChild(rollButton);
      wealthContainer.appendChild(wealthRollContainer);

      // Add to section container
      sectionContainer.appendChild(wealthContainer);
    } catch (error) {
      HM.log(1, 'Error rendering wealth option:', error);
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

      EquipmentParser.focus = new Set(await EquipmentParser.collectLookupItems('focus'));
      HM.log(3, `focus initialized with ${EquipmentParser.focus.size} items.`);

      EquipmentParser.lookupItems = {
        sim: new Set([...EquipmentParser.simpleM, ...EquipmentParser.simpleR]),
        simpleM: EquipmentParser.simpleM,
        simpleR: EquipmentParser.simpleR,
        mar: new Set([...EquipmentParser.martialM, ...EquipmentParser.martialR]),
        martialM: EquipmentParser.martialM,
        martialR: EquipmentParser.martialR,
        music: EquipmentParser.music,
        shield: EquipmentParser.shield,
        armor: EquipmentParser.armor,
        focus: EquipmentParser.focus
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
    this.itemUuidMap = new Map();

    // Handle focus items separately
    if (lookupKey === 'focus') {
      return this.collectFocusItems();
    }

    const typesToFetch = ['weapon', 'armor', 'tool', 'equipment', 'gear', 'consumable', 'shield'];

    try {
      for (const pack of game.packs.filter((pack) => pack.documentName === 'Item')) {
        const documents = await pack.getDocuments({ type__in: typesToFetch });

        for (const item of documents) {
          const itemType = item.system?.type?.value || item.type;
          const isMagic = item.system?.properties instanceof Set && item.system.properties.has('mgc');

          this.itemUuidMap.set(item.id, item.uuid);
          /* TODO: This probably doesn't work with localization. */
          if (item.name === 'Unarmed Strike' || isMagic) continue;

          if ((lookupKey === 'sim' && (itemType === 'simpleM' || itemType === 'simpleR')) || itemType === lookupKey) {
            items.push(item);
            HM.log(3, `Added item: ${item.name} with ID: ${item._id} to ${lookupKey} collection.`);
          }
        }
      }
    } catch (error) {
      HM.log(1, `Error collecting items for lookupKey: ${lookupKey}`, error);
    }

    return items;
  }

  static async collectFocusItems() {
    HM.log(3, 'Starting collectFocusItems');
    const focusItems = [];
    HM.log(3, 'CONFIG.DND5E:', CONFIG.DND5E);
    HM.log(3, 'focusTypes:', CONFIG.DND5E.focusTypes);

    for (const [key, config] of Object.entries(CONFIG.DND5E.focusTypes)) {
      HM.log(3, `Processing focus type: ${key}`, config);
      if (!config?.itemIds) {
        HM.log(2, `No itemIds for config ${key}:`, config);
        continue;
      }

      for (const itemId of Object.values(config.itemIds)) {
        HM.log(3, `Processing itemId: ${itemId}`);
        for (const pack of game.packs.filter((p) => p.documentName === 'Item')) {
          const item = await pack.getDocument(itemId);
          if (item) {
            HM.log(3, `Found item: ${item.name} (${item.uuid})`);
            this.itemUuidMap.set(itemId, item.uuid);
            focusItems.push(item);
            break;
          }
        }
      }
    }
    return focusItems;
  }
}
