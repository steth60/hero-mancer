import { HM } from './index.js';

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
   * @static
   */
  static async prepareDocumentsByType(type) {
    try {
      const data = await this.#fetchTypeDocumentsFromCompendiums(type);

      if (type === 'race' || type === 'species') {
        return this.#organizeRacesByTypeIdentifier(data.documents);
      } else {
        return this.#getFlatDocuments(data.documents);
      }
    } catch (error) {
      return [];
    }
  }

  /* -------------------------------------------- */
  /*  Static Private Methods                      */
  /* -------------------------------------------- */

  /**
   * Formats race type identifier into proper display name
   * @param {string} identifier - Race type identifier
   * @returns {string} Formatted display name
   * @private
   */
  static #formatRaceTypeIdentifier(identifier) {
    if (!identifier) return 'Other';
    return identifier
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Extracts race type identifier from document
   * @param {Object} doc - Document to extract type from
   * @returns {string} Type identifier
   * @private
   */
  static #extractRaceTypeIdentifier(doc) {
    return doc.system?.type?.subtype || doc.system?.type?.value || doc.system?.traits?.type?.value || doc.system?.details?.race || doc.system?.details?.species || 'other';
  }

  /**
   * Organizes races into groups based on their type identifier
   * @param {Array} documents - Race documents to organize
   * @returns {Array} Grouped race documents
   * @private
   */
  static #organizeRacesByTypeIdentifier(documents) {
    const typeGroups = new Map();

    documents.forEach((doc) => {
      const typeId = this.#extractRaceTypeIdentifier(doc);
      const typeName = this.#formatRaceTypeIdentifier(typeId);

      if (!typeGroups.has(typeName)) {
        typeGroups.set(typeName, {
          folderName: typeName,
          docs: []
        });
      }

      typeGroups.get(typeName).docs.push({
        id: doc.id,
        name: doc.name,
        packName: doc.packName,
        packId: doc.packId,
        uuid: doc.uuid,
        description: doc.system.description?.value || game.i18n.localize('hm.app.no-description')
      });
    });

    typeGroups.forEach((group) => {
      group.docs.sort((a, b) => a.name.localeCompare(b.name));
    });

    return Array.from(typeGroups.values()).sort((a, b) => a.folderName.localeCompare(b.folderName));
  }

  static #getFlatDocuments(documents) {
    return documents
      .map((doc) => ({
        id: doc.id,
        name: `${doc.name} (${doc.packName || 'Unknown'})`,
        description: doc.description,
        packName: doc.packName,
        packId: doc.packId,
        uuid: doc.uuid
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Fetches documents from compendiums based on type
   * @param {'race'|'class'|'background'|'species'} type - Document type
   * @returns {Promise<{documents: Array}>}
   * @private
   */
  static async #fetchTypeDocumentsFromCompendiums(type) {
    if (!['race', 'class', 'background', 'species'].includes(type)) {
      throw new Error('Invalid document type');
    }

    const selectedPacks = game.settings.get(HM.ID, `${type}Packs`) || [];
    const packs = selectedPacks.length > 0 ? game.packs.filter((pack) => selectedPacks.includes(pack.metadata.id)) : game.packs.filter((pack) => pack.metadata.type === 'Item');

    const validPacks = new Set();
    const failedPacks = [];

    await Promise.all(
      packs.map(async (pack) => {
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
              folderName: doc.folder?.name || null,
              system: doc.system
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
      documents: this.#sortDocumentsByNameAndPack([...validPacks])
    };
  }

  /**
   * Determines pack name based on id/label
   * @param {string} label - Pack label
   * @param {string} id - Pack id
   * @returns {string} Formatted pack name
   * @private
   */
  static #determinePackName(label, id) {
    if (label.includes('PHB')) return game.i18n.localize('hm.app.document-service.phb');
    if (label.includes('SRD')) return game.i18n.localize('hm.app.document-service.srd');
    if (id.includes('Forge')) return game.i18n.localize('hm.app.document-service.forge');
    if (label.includes('DDB')) return game.i18n.localize('hm.app.document-service.dndbeyond-importer');
    if (/[./_-]home[\s_-]?brew[./_-]/i.test(label)) return game.i18n.localize('hm.app.document-service.homebrew');
    if (game.modules.get('elkan5e')?.active) {
      if (label.includes('Elkan')) return game.i18n.localize('hm.app.document-service.elkan5e');
    }
    return label;
  }

  /**
   * Sorts document array by name and pack
   * @param {Array} documents - Documents to sort
   * @returns {Array} Sorted documents
   * @private
   */
  static #sortDocumentsByNameAndPack(documents) {
    return documents
      .map(({ doc, packName, packId, description, folderName, uuid, system }) => ({
        id: doc.id,
        name: doc.name,
        description,
        folderName,
        packName,
        packId,
        uuid,
        system
      }))
      .sort((a, b) => {
        const nameCompare = a.name.localeCompare(b.name);
        return nameCompare || a.packName.localeCompare(b.packName);
      });
  }
}
