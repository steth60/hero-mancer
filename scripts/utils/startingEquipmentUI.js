import * as HMUtils from './index.js';
import { HM } from '../hero-mancer.js';

export class StartingEquipmentUI {
  constructor() {
    this.equipmentData = null;
    this.classId = HMUtils.selectionStorage.class.selectedId;
    this.raceId = HMUtils.selectionStorage.race.selectedId;
    this.backgroundId = HMUtils.selectionStorage.background.selectedId;
    HM.log(3, 'StartingEquipmentUI initialized with:', {
      classId: this.classId,
      raceId: this.raceId,
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
   * Fetches starting equipment based on the selection stored in HMUtils for the specified type.
   * @param {string} type The type (class, race, background).
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
   * Fetches and combines equipment data for class, race, and background.
   */
  async fetchEquipmentData() {
    HM.log(3, 'Fetching equipment data for class, race, and background.');

    const classEquipment = await this.getStartingEquipment('class');
    const raceEquipment = await this.getStartingEquipment('race');
    const backgroundEquipment = await this.getStartingEquipment('background');

    // Organize equipment by type, keeping all three for testing
    this.equipmentData = {
      class: classEquipment || [],
      race: raceEquipment || [],
      background: backgroundEquipment || []
    };

    HM.log(3, 'Organized equipment data by type:', this.equipmentData);
  }


  /**
   * Renders the equipment choices based on the fetched equipment data.
   * @returns {Promise<HTMLElement>} - Container with equipment choices.
   */
  async renderEquipmentChoices() {
    HM.log(3, 'Rendering equipment choices for class, race, and background.');

    // Fetch updated equipment data
    await this.fetchEquipmentData();

    // Clear the container and reset rendered IDs
    const container = document.createElement('div');
    container.classList.add('equipment-choices');
    StartingEquipmentUI.renderedIds.clear();

    // Render each type of equipment (class, race, background) in separate sections
    Object.entries(this.equipmentData).forEach(([type, items]) => {
      const sectionContainer = document.createElement('div');
      sectionContainer.classList.add(`${type}-equipment-section`);

      // Add a header for the section
      const header = document.createElement('h3');
      header.textContent = `${type.charAt(0).toUpperCase() + type.slice(1)} Equipment`;
      sectionContainer.appendChild(header);

      // Create HTML elements for each item
      items.forEach((item) => {
        const itemDoc = fromUuidSync(item.key);
        item.name = itemDoc?.name || 'Unknown Item';

        HM.log(3, `Creating HTML element for item in ${type} equipment:`, item);
        const itemElement = this.createEquipmentElement(item);

        // Only append if itemElement is a valid Node
        if (itemElement) {
          sectionContainer.appendChild(itemElement);
        }
      });

      container.appendChild(sectionContainer);
    });

    HM.log(3, 'Finished rendering equipment choices.');
    return container;
  }


  /**
   * Creates an HTML element for a single equipment item.
   * @param {object} item Equipment item data.
   * @returns {HTMLElement} - HTML element for the item.
   */
  // Define a set to track already rendered item IDs
  static renderedIds = new Set();

  createEquipmentElement(item) {
    // Skip rendering if item has already been rendered
    if (StartingEquipmentUI.renderedIds.has(item._id)) {
      HM.log(3, `Skipping duplicate rendering for item: ${item._id}`);
      return null;
    }
    StartingEquipmentUI.renderedIds.add(item._id);

    const itemContainer = document.createElement('div');
    itemContainer.classList.add('equipment-item');
    HM.log(3, 'Creating element for equipment item:', item);

    // Check if this is the most parent element (no group)
    if (!item.group) {
      // Generate a label by combining all children labels
      const childrenLabels = item.children.map((child) => child.label).filter(Boolean);
      const combinedLabel = childrenLabels.join(', ');

      const labelElement = document.createElement('span');
      labelElement.classList.add('parent-label');
      labelElement.textContent = combinedLabel || 'No Items Available';
      itemContainer.appendChild(labelElement);
      HM.log(3, `Added descriptive label for parent item: ${combinedLabel}`);

      // Render children as separate elements within the parent container
      item.children.forEach((child) => {
        const childElement = this.createEquipmentElement(child);
        if (childElement) itemContainer.appendChild(childElement);
      });

    } else {
      // Use a switch statement for handling different item types
      switch (item.type) {
        case 'AND': {
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.id = item._id;
          checkbox.checked = true;
          itemContainer.appendChild(checkbox);

          const label = document.createElement('label');
          label.htmlFor = item._id;
          label.textContent = item.label || 'Unknown AND Item';
          itemContainer.appendChild(label);
          HM.log(3, 'Added AND type item with checkbox:', { id: item._id, name: item.label });

          // Render children within the same container
          item.children.forEach((child) => {
            const childElement = this.createEquipmentElement(child);
            if (childElement) itemContainer.appendChild(childElement);
          });
          break;
        }

        case 'OR': {
          const select = document.createElement('select');
          select.id = item._id;

          item.children.forEach((option) => {
            const optionElement = document.createElement('option');
            optionElement.value = option._id;
            optionElement.textContent = option.label || 'Unknown Option';
            select.appendChild(optionElement);

            // Mark child as rendered
            StartingEquipmentUI.renderedIds.add(option._id);
          });

          itemContainer.appendChild(select);
          HM.log(3, 'Added OR type item with dropdown:', {
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

        default:
          HM.log(3, `Unknown item type encountered: ${item.type}`);
      }
    }

    return itemContainer;
  }


}
