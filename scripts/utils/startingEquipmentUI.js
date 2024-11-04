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

    this.equipmentData = [...classEquipment, ...raceEquipment, ...backgroundEquipment];
    HM.log(3, 'Combined equipment data:', this.equipmentData);
  }

  /**
   * Renders the equipment choices based on the fetched equipment data.
   * @returns {Promise<HTMLElement>} - Container with equipment choices.
   */
  async renderEquipmentChoices() {
    HM.log(3, 'Rendering equipment choices.');
    if (!this.equipmentData) {
      HM.log(3, 'Equipment data not found. Fetching equipment data.');
      await this.fetchEquipmentData();
    } else {
      await this.fetchEquipmentData(); // Fetch anyway? We want the latest version after each change.
      HM.log(3, 'Using cached equipment data.');
    }

    const container = document.createElement('div');
    container.classList.add('equipment-choices');

    this.equipmentData.forEach((item) => {
      HM.log(3, 'Creating HTML element for item:', item);
      const itemElement = this.createEquipmentElement(item);
      container.appendChild(itemElement);
    });

    HM.log(3, 'Finished rendering equipment choices.');
    return container;
  }

  /**
   * Creates an HTML element for a single equipment item.
   * @param {object} item Equipment item data.
   * @returns {HTMLElement} - HTML element for the item.
   */
  createEquipmentElement(item) {
    const itemContainer = document.createElement('div');
    itemContainer.classList.add('equipment-item');
    HM.log(3, 'Creating element for equipment item:', item);

    if (item.type === 'AND') {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = item.id;
      checkbox.checked = true;
      itemContainer.appendChild(checkbox);

      const label = document.createElement('label');
      label.htmlFor = item.id;
      label.textContent = item.name;
      itemContainer.appendChild(label);
      HM.log(3, 'Added AND type item with checkbox:', { id: item.id, name: item.name });

    } else if (item.type === 'OR') {
      const select = document.createElement('select');
      select.id = item.id;

      item.children.forEach((option) => {
        const optionElement = document.createElement('option');
        optionElement.value = option.id;
        optionElement.textContent = option.name;
        select.appendChild(optionElement);
      });

      itemContainer.appendChild(select);
      HM.log(3, 'Added OR type item with dropdown:', {
        id: item.id,
        options: item.children.map((opt) => ({ id: opt.id, name: opt.name }))
      });
    }

    return itemContainer;
  }
}
