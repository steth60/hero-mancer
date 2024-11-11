import { HM } from '../hero-mancer.js';
import { DropdownHandler } from './index.js';

export class DocumentService {
  /**
   * Fetches and prepares documents based on the specified type for dropdown use.
   * @async
   * @param {string} type The type of document to register (e.g., 'race', 'class', 'background').
   * @returns {Promise<object>} - Object containing processed documents and HTML for the dropdown.
   */
  static async prepDocs(type) {
    try {
      HM.log(3, `Starting prepDocs for type: ${type}`);

      // Fetch documents based on type
      let data = await this.#fetchDocuments(type);
      HM.log(3, `Fetched data for type ${type}:`, data);

      // Determine the grouping field based on the document type
      const groupingField = type === 'race' ? 'folderName' : 'packName';
      HM.log(3, `Grouping field for type ${type}: ${groupingField}`);

      // Group and sort the documents based on the grouping field
      const sortedUniqueFolders = this.#groupAndSortDocuments(data.documents, groupingField);
      HM.log(3, `Grouped and sorted documents for type ${type}:`, sortedUniqueFolders);

      // Generate dropdown HTML based on the sorted folders
      const dropdownHtml = DropdownHandler.generateDropdownHTML(sortedUniqueFolders, groupingField);
      HM.log(3, `Generated dropdown HTML for type ${type}:`, dropdownHtml);

      HM.log(3, `prepDocs complete for type: ${type}`);
      return { types: sortedUniqueFolders, dropdownHtml };
    } catch (error) {
      HM.log(1, `Error: Failed to register ${type} documents. No ${type} data available.`, error);
      return {
        types: [],
        dropdownHtml: `<option value="">${game.i18n.localize(`hm.no-${type}-available`)}</option>`
      };
    }
  }

  /**
   * Private method to fetch and process documents from compendiums based on the provided type.
   * @async
   * @param {string} type The type of documents to fetch (e.g., 'race', 'class', 'background').
   * @returns {Promise<object>} An object containing the sorted documents and additional metadata.
   * @throws Will throw an error if the type is invalid or if document retrieval fails.
   */
  static async #fetchDocuments(type) {
    if (typeof type !== 'string' || type.trim() === '') {
      throw new Error('Invalid argument: expected a non-empty string.');
    }

    let typeNice = type.charAt(0).toUpperCase() + type.slice(1);
    let validPacks = new Set();

    let selectedPacks = [];
    if (type === 'class') {
      selectedPacks = game.settings.get('hero-mancer', 'classPacks') || [];
    } else if (type === 'race') {
      selectedPacks = game.settings.get('hero-mancer', 'racePacks') || [];
    } else if (type === 'background') {
      selectedPacks = game.settings.get('hero-mancer', 'backgroundPacks') || [];
    }

    let packs =
      selectedPacks.length > 0 ? game.packs.filter((pack) => selectedPacks.includes(pack.metadata.id)) : game.packs.filter((i) => i.metadata.type === 'Item');

    HM.log(3, `Fetching documents for type: ${typeNice}`);

    for (const pack of packs) {
      try {
        let documents = await pack.getDocuments({ type: type });
        HM.log(3, `Retrieved documents from pack: ${pack.metadata.label}`, documents);

        for (const doc of documents) {
          if (doc) {
            let packName = pack.metadata.label.includes('SRD') ? 'SRD' : pack.metadata.label.includes('DDB') ? 'DDB' : pack.metadata.label;
            validPacks.add({
              doc,
              packName,
              packId: pack.metadata.id,
              description: doc.system.description?.value || `${game.i18n.localize(`${HM.ABRV}.app.no-description`)}`,
              folderName: doc.folder?.name || null
            });
          }
        }
      } catch (error) {
        HM.log(1, `Failed to retrieve documents from pack ${pack.metadata.label}: ${error}`, 'error');
        ui.notifications.error(`Failed to retrieve documents from compendium pack: ${pack.metadata.label}.`);
      }
    }

    HM.log(3, `${typeNice} collection complete: ${validPacks.size} documents collected.`);

    let sortedPackDocs = [...validPacks]
      .map(({ doc, packName, packId, description, folderName }) => ({
        id: doc.id,
        name: doc.name,
        description,
        folderName,
        packName,
        packId
      }))
      .sort((a, b) => {
        let nameCompare = a.name.localeCompare(b.name);
        return nameCompare === 0 ? a.packName.localeCompare(b.packName) : nameCompare;
      });

    HM.log(3, 'Sorted Pack Docs:', sortedPackDocs);

    return { documents: sortedPackDocs, uniqueFolders: [] };
  }

  /**
   * Private method to group and sort documents by the specified key.
   * @param {Array} documents Array of documents to process.
   * @param {string} key The key to group by ('folderName' for races, 'packName' for classes/backgrounds).
   * @returns {Array} Sorted array of grouped documents.
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
