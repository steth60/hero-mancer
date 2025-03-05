import { DropdownHandler, HM } from './index.js';

/**
 * Service for managing game document preparation and processing
 * @class
 */
export class DocumentService {
  /* -------------------------------------------- */
  /*  Static Public Methods                       */
  /* -------------------------------------------- */

  /**
   * Fetches and prepares documents based on the specified type for dropdown use
   * @param {'race'|'class'|'background'|'species'} type - Document type to register
   * @returns {Promise<{types: Array, dropdownHtml: string}>}
   * @throws {Error} If type is invalid or document retrieval fails
   * @static
   */
  static async prepareDocumentsByType(type) {
    try {
      HM.log(3, `Starting prepDocs for type: ${type}`);

      const data = await this.#fetchTypeDocumentsFromCompendiums(type);
      const groupingField = type === 'race' ? 'folderName' : 'packName';
      const sortedUniqueFolders = this.#organizeDocumentsIntoGroups(data.documents, groupingField);
      const dropdownHtml = DropdownHandler.generateDropdownHTML(sortedUniqueFolders, groupingField);

      return { types: sortedUniqueFolders, dropdownHtml };
    } catch (error) {
      HM.log(1, `Error: Failed to register ${type} documents`, error);

      return {
        types: [],
        dropdownHtml: `<option value="">${game.i18n.localize(`hm.app.${type}.none`)}</option>`
      };
    }
  }

  /* -------------------------------------------- */
  /*  Static Private Methods                      */
  /* -------------------------------------------- */

  /**
   * Fetches documents from compendiums based on type
   * @param {'race'|'class'|'background'|'species'} type - Document type
   * @returns {Promise<{documents: Array, uniqueFolders: Array}>}
   * @throws {Error} If type is invalid or retrieval fails
   * @private
   * @static
   */
  static async #fetchTypeDocumentsFromCompendiums(type) {
    if (!['race', 'class', 'background', 'species'].includes(type)) {
      throw new Error('Invalid document type');
    }

    const selectedPacks = game.settings.get('hero-mancer', `${type === 'species' ? 'race' : type}Packs`) || [];
    const packs = selectedPacks.length > 0 ? game.packs.filter((pack) => selectedPacks.includes(pack.metadata.id)) : game.packs.filter((pack) => pack.metadata.type === 'Item');

    const validPacks = new Set();
    const failedPacks = [];

    // Process all packs in parallel for better performance
    await Promise.all(
      packs.map(async (pack) => {
        HM.log(3, 'Fetching documents from pack:', pack);
        try {
          const documents = await pack.getDocuments({ type });

          documents.forEach((doc) => {
            if (!doc) return;

            const packName = this.#determinePackName(pack.metadata.label, pack.metadata.id);
            validPacks.add({
              doc,
              packName,
              uuid: doc.uuid,
              packId: pack.metadata.id,
              description: doc.system.description?.value || game.i18n.localize('hm.app.no-description'),
              folderName: doc.folder?.name || null
            });
          });
        } catch (error) {
          HM.log(1, `Failed to retrieve documents from pack ${pack.metadata.label}:`, error);
          failedPacks.push(pack.metadata.label);
        }
      })
    );

    if (failedPacks.length > 0) {
      ui.notifications.error(
        game.i18n.format('hm.errors.failed-compendium-retrieval', {
          type: failedPacks.join(', ')
        })
      );
    }

    return {
      documents: this.#sortDocumentsByNameAndPack([...validPacks]),
      uniqueFolders: []
    };
  }

  /**
   * Determines pack name based on id/label
   * @param {string} label - Pack label
   * @param {string} id - Pack id
   * @returns {string} Formatted pack name
   * @private
   * @static
   */
  static #determinePackName(label, id) {
    if (label.includes('PHB')) return game.i18n.localize('hm.app.document-service.phb'); // Shorthand for 2024 PHB
    if (label.includes('SRD')) return game.i18n.localize('hm.app.document-service.srd'); // Shorthand for SRD
    if (id.includes('Forge')) return game.i18n.localize('hm.app.document-service.forge'); // Shorthand for Forge
    if (label.includes('DDB')) return game.i18n.localize('hm.app.document-service.dndbeyond-importer'); // Shorthand for DDB
    if (/[./_-]home[\s_-]?brew[./_-]/i.test(label)) return game.i18n.localize('hm.app.document-service.homebrew'); // Shorthand for Homebrew
    if (game.modules.get('elkan5e')?.active) {
      if (label.includes('Elkan')) return game.i18n.localize('hm.app.document-service.elkan5e'); // Shorthand for Elkan 5e
    }
    return label;
  }

  /**
   * Sorts document array by name and pack
   * @param {Array} documents - Documents to sort
   * @returns {Array} Sorted documents
   * @private
   * @static
   */
  static #sortDocumentsByNameAndPack(documents) {
    return documents
      .map(({ doc, packName, packId, description, folderName, uuid }) => ({
        id: doc.id,
        name: doc.name,
        description,
        folderName,
        packName,
        packId,
        uuid
      }))
      .sort((a, b) => {
        const nameCompare = a.name.localeCompare(b.name);
        return nameCompare || a.packName.localeCompare(b.packName);
      });
  }

  /**
   * Groups and sorts documents by specified key
   * @param {Array} documents - Documents to process
   * @param {'folderName'|'packName'} key - Key to group by
   * @returns {Array} Sorted array of grouped documents
   * @private
   * @static
   */
  static #organizeDocumentsIntoGroups(documents, key) {
    const uniqueMap = new Map();

    documents.forEach(({ id, name, description, packName, packId, folderName, uuid }) => {
      const groupKey = key === 'folderName' ? folderName || name : packName;

      if (!uniqueMap.has(groupKey)) {
        uniqueMap.set(groupKey, {
          groupKey,
          docs: [],
          packName,
          packId,
          uuid,
          ...(folderName && { folderName })
        });
      }
      uniqueMap.get(groupKey).docs.push({ id, name, description, packName, packId, uuid });
    });

    return Array.from(uniqueMap.values())
      .sort((a, b) => a.groupKey.localeCompare(b.groupKey))
      .map((group) => ({
        ...group,
        docs: group.docs.sort((a, b) => a.name.localeCompare(b.name))
      }));
  }
}
