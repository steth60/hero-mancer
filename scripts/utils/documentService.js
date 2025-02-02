import { HM } from '../hero-mancer.js';
import { DropdownHandler } from './index.js';

/**
 * Service for managing game document preparation and processing
 * @class
 */
export class DocumentService {
  /**
   * Fetches and prepares documents based on the specified type for dropdown use
   * @async
   * @param {'race'|'class'|'background'|'species'} type Document type to register
   * @throws {Error} If type is invalid or document retrieval fails
   * @returns {Promise<{types: Array, dropdownHtml: string}>}
   */
  static async prepDocs(type) {
    try {
      HM.log(3, `Starting prepDocs for type: ${type}`);

      const data = await this.#fetchDocuments(type);
      const groupingField = type === 'race' ? 'folderName' : 'packName';
      const sortedUniqueFolders = this.#groupAndSortDocuments(data.documents, groupingField);
      const dropdownHtml = DropdownHandler.generateDropdownHTML(sortedUniqueFolders, groupingField);

      return { types: sortedUniqueFolders, dropdownHtml };
    } catch (error) {
      HM.log(1, `Error: Failed to register ${type} documents`, error);
      return {
        types: [],
        dropdownHtml: `<option value="">${game.i18n.localize(`hm.no-${type}-available`)}</option>`
      };
    }
  }

  /**
   * Fetches documents from compendiums based on type
   * @private
   * @async
   * @param {'race'|'class'|'background'|'species'} type Document type
   * @throws {Error} If type is invalid or retrieval fails
   * @returns {Promise<{documents: Array, uniqueFolders: Array}>}
   */
  static async #fetchDocuments(type) {
    if (!['race', 'class', 'background', 'species'].includes(type)) {
      throw new Error('Invalid document type');
    }

    const selectedPacks = game.settings.get('hero-mancer', `${type === 'species' ? 'race' : type}Packs`) || [];
    const packs = selectedPacks.length > 0 ? game.packs.filter((pack) => selectedPacks.includes(pack.metadata.id)) : game.packs.filter((pack) => pack.metadata.type === 'Item');

    const validPacks = new Set();

    for (const pack of packs) {
      HM.log(3, 'Fetching documents from pack:', pack);
      try {
        const documents = await pack.getDocuments({ type });

        documents.forEach((doc) => {
          if (!doc) return;

          const packName = this.#determinePackName(pack.metadata.id);
          validPacks.add({
            doc,
            packName,
            packId: pack.metadata.id,
            description: doc.system.description?.value || game.i18n.localize(`hm.app.no-description`),
            folderName: doc.folder?.name || null
          });
        });
      } catch (error) {
        HM.log(1, `Failed to retrieve documents from pack ${pack.metadata.label}:`, error);
        ui.notifications.error(game.i18n.format('hm.errors.failed-compendium-retrieval', { type: pack.metadata.label }));
      }
    }

    return {
      documents: this.#sortDocuments([...validPacks]),
      uniqueFolders: []
    };
  }

  /**
   * Determines pack name based on id
   * @private
   * @param {string} id Pack id
   * @returns {string}
   */
  static #determinePackName(id) {
    if (id.includes('players-handbook')) return 'PHB'; // Shorthand for 2024 PHB
    if (id.includes('dnd5e')) return 'SRD'; // Shorthand for SRD
    if (id.includes('dd')) return 'DDB'; // Shorthand for DDB
    return id;
  }

  /**
   * Sorts document array by name and pack
   * @private
   * @param {Array} documents Documents to sort
   * @returns {Array}
   */
  static #sortDocuments(documents) {
    return documents
      .map(({ doc, packName, packId, description, folderName }) => ({
        id: doc.id,
        name: doc.name,
        description,
        folderName,
        packName,
        packId
      }))
      .sort((a, b) => {
        const nameCompare = a.name.localeCompare(b.name);
        return nameCompare || a.packName.localeCompare(b.packName);
      });
  }

  /**
   * Groups and sorts documents by specified key
   * @private
   * @param {Array} documents Documents to process
   * @param {'folderName'|'packName'} key Key to group by
   * @returns {Array} Sorted array of grouped documents
   */
  static #groupAndSortDocuments(documents, key) {
    const uniqueMap = new Map();

    documents.forEach(({ id, name, description, packName, packId, folderName }) => {
      const groupKey = key === 'folderName' ? folderName || name : packName;

      if (!uniqueMap.has(groupKey)) {
        uniqueMap.set(groupKey, {
          groupKey,
          docs: [],
          packName,
          packId,
          ...(folderName && { folderName })
        });
      }
      uniqueMap.get(groupKey).docs.push({ id, name, description, packName, packId });
    });

    return Array.from(uniqueMap.values())
      .sort((a, b) => a.groupKey.localeCompare(b.groupKey))
      .map((group) => ({
        ...group,
        docs: group.docs.sort((a, b) => a.name.localeCompare(b.name))
      }));
  }
}
