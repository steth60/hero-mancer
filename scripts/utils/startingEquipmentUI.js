import * as HMUtils from './index.js';
import { HM } from '../hero-mancer.js';

export class StartingEquipmentUI {
  constructor() {
    this.equipmentData = null;
    this.classId = HMUtils.selectionStorage.class.selectedId;
    this.backgroundId = HMUtils.selectionStorage.background.selectedId;
    HM.log(3, 'StartingEquipmentUI initialized with:', {
      classId: this.classId,
      backgroundId: this.backgroundId
    });
  }

  static renderedIds = new Set();


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
   * Fetches starting equipment based on the selection stored in HMUtils for the specified type.
   * @param {string} type The type (class, background).
   * @returns {Promise<Array>} - The starting equipment array.
   */
  async getStartingEquipment(type) {
    const { selectedId } = HMUtils.selectionStorage[type] || {};
    HM.log(3, `Fetching starting equipment for type: ${type}, selectedId: ${selectedId}`);
    if (!selectedId) {
      HM.log(3, `No selection found for type: ${type}`);
      return [];
    }

    const doc = await this.findItemInCompendiums(selectedId);
    if (doc) {
      HM.log(3, `Starting equipment found for type ${type}:`, doc.system.startingEquipment);
    } else {
      HM.log(3, `No document found for type ${type} with selectedId ${selectedId}`);
    }
    return doc?.system.startingEquipment || [];
  }

  /**
   * Fetches and combines equipment data for class, and background.
   */
  async fetchEquipmentData() {
    HM.log(3, 'Fetching equipment data for class, and background.');

    const classEquipment = await this.getStartingEquipment('class');
    const backgroundEquipment = await this.getStartingEquipment('background');

    // Organize equipment by type, keeping all three for testing
    this.equipmentData = {
      class: classEquipment || [],
      background: backgroundEquipment || []
    };

    HM.log(3, 'Organized equipment data by type:', this.equipmentData);
  }


  async renderEquipmentChoices() {
    HM.log(3, 'Rendering equipment choices for class, and background.');
    StartingEquipmentUI.renderedIds.clear();

    // Fetch updated equipment data
    await this.fetchEquipmentData();

    const container = document.createElement('div');
    container.classList.add('equipment-choices');
    StartingEquipmentUI.renderedIds.clear();

    // Render each type of equipment (class, background) in separate sections
    for (const [type, items] of Object.entries(this.equipmentData)) {
      const sectionContainer = document.createElement('div');
      sectionContainer.classList.add(`${type}-equipment-section`);

      const header = document.createElement('h3');
      header.textContent = `${type.charAt(0).toUpperCase() + type.slice(1)} Equipment`;
      sectionContainer.appendChild(header);

      for (const item of items) {
        const itemDoc = await fromUuidSync(item.key);
        item.name = itemDoc?.name || 'Unknown Item';

        HM.log(3, `Creating HTML element for item in ${type} equipment:`, item);
        const itemElement = await this.createEquipmentElement(item);

        if (itemElement) {
          sectionContainer.appendChild(itemElement);
        }
      }

      container.appendChild(sectionContainer);
    }

    HM.log(3, 'Finished rendering equipment choices.');
    return container;
  }

  async createEquipmentElement(item) {
    if (StartingEquipmentUI.renderedIds.has(item._id)) {
      HM.log(3, `Skipping duplicate rendering for item: ${item._id}`);
      return null;
    }
    StartingEquipmentUI.renderedIds.add(item._id);

    const itemContainer = document.createElement('div');
    itemContainer.classList.add('equipment-item');
    HM.log(3, 'Creating element for equipment item:', { id: item._id, type: item.type, label: item.label });

    if (!item.group && item.type === 'OR') {
      // Handle top-level OR groups with dropdown
      const labelElement = document.createElement('h4');
      labelElement.classList.add('parent-label');
      labelElement.textContent = item.label || 'Choose one of the following';
      itemContainer.appendChild(labelElement);

      const select = document.createElement('select');
      select.id = item._id;

      for (const child of item.children) {
        if (StartingEquipmentUI.renderedIds.has(child._id)) continue;
        StartingEquipmentUI.renderedIds.add(child._id);

        if (child.type === 'linked') {
          const optionElement = document.createElement('option');
          optionElement.value = child._id;
          optionElement.textContent = child.label || 'Unknown Linked Option';
          select.appendChild(optionElement);
          HM.log(3, 'Added linked item to OR dropdown:', { id: child._id, label: child.label });
        } else if (child.type === 'weapon') {
          const weaponOptions = await this.collectLookupItems(child.key);
          weaponOptions.sort((a, b) => a.name.localeCompare(b.name));
          weaponOptions.forEach((weapon) => {
            if (StartingEquipmentUI.renderedIds.has(weapon._id)) return;
            StartingEquipmentUI.renderedIds.add(weapon._id);

            const weaponOption = document.createElement('option');
            weaponOption.value = weapon._id;
            weaponOption.textContent = weapon.name;
            select.appendChild(weaponOption);
            HM.log(3, 'Added weapon item to OR dropdown:', { id: weapon._id, name: weapon.name });
          });
        }
      }

      itemContainer.appendChild(select);
      HM.log(3, 'Added OR type item with dropdown for top-level OR:', {
        id: item._id,
        options: item.children.map((opt) => ({ id: opt._id, name: opt.label || 'Unknown Option' }))
      });

    } else {
      switch (item.type) {
        case 'AND': {
          // Render parent AND as a label, not a checkbox
          const labelElement = document.createElement('h4');
          labelElement.classList.add('parent-label');
          labelElement.textContent = item.label || 'All of the following:';
          itemContainer.appendChild(labelElement);
          HM.log(3, 'Added AND group label for parent item:', item.label);

          // Process each child individually within the AND group
          for (const child of item.children) {
            const childElement = await this.createEquipmentElement(child);
            if (childElement) itemContainer.appendChild(childElement);
          }
          break;
        }

        case 'OR': {
          // Process nested OR groups for dropdowns
          const labelElement = document.createElement('h4');
          labelElement.classList.add('parent-label');
          labelElement.textContent = item.label || 'Choose one of the following';
          itemContainer.appendChild(labelElement);

          const select = document.createElement('select');
          select.id = item._id;

          for (const child of item.children) {
            if (StartingEquipmentUI.renderedIds.has(child._id)) continue;
            StartingEquipmentUI.renderedIds.add(child._id);

            if (child.type === 'linked') {
              const optionElement = document.createElement('option');
              optionElement.value = child._id;
              optionElement.textContent = child.label || 'Unknown Linked Option';
              select.appendChild(optionElement);
              HM.log(3, 'Added linked item to OR dropdown:', { id: child._id, label: child.label });
            } else if (child.type === 'weapon') {
              const weaponOptions = await this.collectLookupItems(child.key);
              weaponOptions.sort((a, b) => a.name.localeCompare(b.name));
              weaponOptions.forEach((weapon) => {
                if (StartingEquipmentUI.renderedIds.has(weapon._id)) return;
                StartingEquipmentUI.renderedIds.add(weapon._id);

                const weaponOption = document.createElement('option');
                weaponOption.value = weapon._id;
                weaponOption.textContent = weapon.name;
                select.appendChild(weaponOption);
                HM.log(3, 'Added weapon item to OR dropdown:', { id: weapon._id, name: weapon.name });
              });
            }
          }
          itemContainer.appendChild(select);
          HM.log(3, 'Added OR type item with dropdown for top-level OR:', {
            id: item._id,
            options: item.children.map((opt) => ({ id: opt._id, name: opt.label || 'Unknown Option' }))
          });

          break;
        }

        case 'linked': {
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.id = item._id;
          checkbox.checked = true;
          itemContainer.appendChild(checkbox);

          const label = document.createElement('label');
          label.htmlFor = item._id;
          label.textContent = item.label || 'Unknown Linked Item';
          itemContainer.appendChild(label);
          HM.log(3, 'Added linked type item with checkbox:', { id: item._id, name: item.label });
          break;
        }

        case 'focus': {
          HM.log(3, `Processing focus type item with ID: ${item._id}`);

          // Create a container for the input field
          const inputContainer = document.createElement('div');
          inputContainer.classList.add('equipment-item');

          // Add a label for the input field
          const label = document.createElement('label');
          label.htmlFor = item._id;
          label.textContent = item.label || 'Custom Focus';
          inputContainer.appendChild(label);

          // Create the input text box with a default entry
          const input = document.createElement('input');
          input.type = 'text';
          input.id = item._id;
          input.value = `${item.key} ${item.type}`; // Default value as "item.key item.type"
          inputContainer.appendChild(input);

          HM.log(3, 'Added focus item with input field:', { id: item._id, defaultValue: input.value });

          // Return the container so it can be appended to the main item container
          return inputContainer;
        }


        default:
          HM.log(3, `Unknown item type encountered: ${item.type}`);
      }
    }

    return itemContainer;
  }


  async collectLookupItems(lookupKey) {
    HM.log(3, `Collecting non-magic lookup items for key: ${lookupKey}`);
    const nonMagicItems = [];

    // Iterate over all compendiums with document type 'Item'
    for (const pack of game.packs.filter((pack) => pack.documentName === 'Item')) {
      HM.log(3, `Checking pack ${pack.metadata.label} for items`);

      // Use getDocuments to fetch only items of type 'weapon' or 'armor'
      const items = await pack.getDocuments({ type__in: ['weapon', 'armor'] });

      items.forEach((item) => {
        const itemType = item.system?.type?.value;
        const isMagic = item.system?.properties instanceof Set && item.system.properties.has('mgc');

        // Check for 'sim' as either 'simpleM' or 'simpleR' and exclude magic items
        if (
          (!isMagic && (
            (lookupKey === 'sim' && (itemType === 'simpleM' || itemType === 'simpleR')) ||
            itemType === lookupKey
          ))
        ) {
          HM.log(3, `Non-magic item found: ${item.name} (ID: ${item._id}) in pack ${pack.metadata.label}`);
          nonMagicItems.push(item);
        }
      });
    }

    HM.log(3, `All non-magic items found for lookupKey '${lookupKey}':`, nonMagicItems);
    return nonMagicItems;  // Always returns an array, even if empty
  }

}
