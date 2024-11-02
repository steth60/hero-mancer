import { HM } from '../hero-mancer.js';
import { selectionStorage } from './index.js';

export class EquipmentParser {
  constructor() {
    this.parsedData = { class: { OR: [], AND: [] }, race: { OR: [], AND: [] }, background: { OR: [], AND: [] } };
    this.items = [];
    this.lookupItems = {};
    this.focusTexts = []; // Holds focus types as plain text
    this.selections = selectionStorage;
    HM.log(3, 'EquipmentParser initialized with selections:', this.selections);
  }

  // Helper function to retrieve document by searching across all item-type compendiums
  async findItemInCompendiums(itemId) {
    for (const pack of game.packs.filter((pack) => pack.documentName === 'Item')) {
      const item = await pack.getDocument(itemId);
      if (item) {
        HM.log(3, `Item ${itemId} found in pack ${pack.metadata.label}`);
        return item;
      }
    }
    console.warn(`Item ${itemId} not found in any 'Item' compendiums.`);
    return null;
  }

  // Fetches starting equipment from a selected document
  async getStartingEquipment(type, selectedValue) {
    HM.log(3, `Fetching starting equipment for type: ${type}, selectedValue: ${selectedValue}`);
    const itemId = selectedValue.split(' ')[0]; // Extract itemId from "itemId (packId)" format
    const doc = await this.findItemInCompendiums(itemId);
    return doc?.system.startingEquipment || [];
  }

  // Categorizes equipment into OR and AND groups for a specific type
  async parseEquipment(type, startingEquipment) {
    HM.log(3, `Parsing equipment for type: ${type}, starting equipment:`, startingEquipment);
    let currentGroup = null;

    for (let item of startingEquipment) {
      if (item.type === 'OR' || item.type === 'AND') {
        currentGroup = { type: item.type, items: [] };
        this.parsedData[type][item.type].push(currentGroup);
        HM.log(3, `New group created: ${item.type}, current parsedData:`, this.parsedData[type]);
      } else if (item.type === 'focus') {
        // Handle focus type as plain text
        this.focusTexts.push(item.key);
        HM.log(3, `Focus type detected and stored: ${item.key}`);
      } else if (currentGroup) {
        const processedItem = await this.processKey(item.key);
        currentGroup.items.push(processedItem);
        HM.log(3, `Added item to group ${item.type}:`, processedItem);
      }
    }
  }

  // Checks if key refers to an item in a compendium; otherwise, collects items by lookupKey
  async processKey(key) {
    HM.log(3, `Processing key: ${key}`);
    const itemId = key.includes('Compendium') ? key.split('.').pop() : key;
    const item = await this.findItemInCompendiums(itemId);

    if (item) {
      this.items.push(item);
      HM.log(3, 'Item found and added:', item);
      return item;
    } else {
      if (!this.lookupItems[key]) {
        this.lookupItems[key] = this.collectLookupItems(key);
        HM.log(3, `Lookup key items collected for ${key}:`, this.lookupItems[key]);
      }
      return this.lookupItems[key];
    }
  }

  async collectLookupItems(lookupKey) {
    HM.log(3, `Collecting non-magic lookup items for key: ${lookupKey}`);
    const nonMagicItems = [];

    // Iterate over all compendiums with document type 'Item'
    for (const pack of game.packs.filter((pack) => pack.documentName === 'Item')) {
      HM.log(3, `Checking pack ${pack.metadata.label} for weapons and armor`);

      // Use getDocuments to fetch only items of type 'weapon' or 'armor'
      const items = await pack.getDocuments({ type__in: ['weapon', 'armor'] });

      // Filter items by lookupKey and exclude magic items
      items.forEach((item) => {
        const itemType = item.system?.type?.value;
        const isMagic = item.system?.properties instanceof Set && item.system.properties.has('mgc');

        if (itemType === lookupKey && !isMagic) {
          HM.log(3, `Non-magic item found: ${item.name} (ID: ${item._id}) in pack ${pack.metadata.label}`);
          nonMagicItems.push(item);
        }
      });
    }

    HM.log(3, `All non-magic items found for lookupKey '${lookupKey}':`, nonMagicItems);
    return nonMagicItems;
  }

  // Parses and categorizes equipment based on selectionStorage data
  async buildEquipmentTabContent() {
    HM.log(3, 'Building equipment tab content with selections from selectionStorage:', this.selections);

    if (!this.selections || Object.keys(this.selections).length === 0) {
      console.warn('No selections available to build equipment data.');
      return { class: { OR: [], AND: [] }, race: { OR: [], AND: [] }, background: { OR: [], AND: [] } };
    }

    // Clear existing parsed data
    this.parsedData = { class: { OR: [], AND: [] }, race: { OR: [], AND: [] }, background: { OR: [], AND: [] } };

    // Process each type based on the selectionStorage data
    for (const type in this.selections) {
      const selectedValue = this.selections[type]?.selectedValue;
      if (!selectedValue) continue;

      const startingEquipment = await this.getStartingEquipment(type, selectedValue);
      await this.parseEquipment(type, startingEquipment);
    }

    HM.log(3, 'Final parsedData after build:', this.parsedData);
    return this.parsedData;
  }

  // Additional getters for debugging
  getOrGroups() {
    return this.parsedData.OR;
  }

  getAndGroups() {
    return this.parsedData.AND;
  }

  getItems() {
    return this.items;
  }

  getLookupItems() {
    return this.lookupItems;
  }

  getFocusTexts() {
    return this.focusTexts;
  }
}
