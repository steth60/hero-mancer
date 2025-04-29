import { HM, JournalPageFinder } from './index.js';

/**
 * Service for managing game document preparation and processing
 * @class
 */
export class DocumentService {
  /* -------------------------------------------- */
  /*  Static Public Methods                       */
  /* -------------------------------------------- */

  /**
   * Initialize document preparation and caching for races, classes, and backgrounds
   * @static
   * @async
   * @returns {Promise<void>}
   * @throws {Error} If document preparation or enrichment fails
   */
  static async loadAndInitializeDocuments() {
    HM.log(3, 'Preparing documents for Hero Mancer');

    try {
      // Define document types to prepare
      const documentTypes = ['race', 'class', 'background'];

      // Fetch all document types in parallel
      const results = await Promise.all(documentTypes.map((type) => DocumentService.prepareDocumentsByType(type)));

      // Create documents object with results
      HM.documents = Object.fromEntries(documentTypes.map((type, index) => [type, results[index]]));

      // Log warnings for any missing document types
      documentTypes.forEach((type) => {
        if (!HM.documents[type]?.length) {
          HM.log(2, `No ${type} documents were loaded. Character creation may be limited.`);
        }
      });

      HM.log(3, 'Document preparation complete');
    } catch (error) {
      HM.log(1, 'Failed to prepare documents:', error.message);
    }
  }

  /**
   * Fetches and prepares documents based on the specified type for dropdown use
   * @param {'race'|'class'|'background'|'species'} type - Document type to register
   * @returns {Promise<{types: Array, dropdownHtml: string}>}
   * @static
   */
  static async prepareDocumentsByType(type) {
    try {
      // Validate input type
      if (!type || !['race', 'class', 'background', 'species'].includes(type)) {
        HM.log(2, `Invalid document type: ${type}`);
        ui.notifications.error('hm.errors.invalid-document-type', { localize: true });
        return { types: [], dropdownHtml: '' };
      }

      const data = await this.#fetchTypeDocumentsFromCompendiums(type);

      if (!data.documents || !Array.isArray(data.documents)) {
        HM.log(2, 'No documents found or invalid document data');
        return { types: [], dropdownHtml: '' };
      }

      // Process the documents based on type
      const result = type === 'race' || type === 'species' ? this.#organizeRacesByFolderName(data.documents) : this.#getFlatDocuments(data.documents);

      /**
       * A hook event that fires after documents have been fetched and organized.
       * This allows modules to filter or modify the documents that will be displayed.
       *
       * @event heroMancer.documentsReady
       * @param {string} type - The document type being prepared
       * @param {Array} result - The processed document array
       * @param {Promise[]} promises - An array of Promises to await before continuing
       */
      const promises = [];
      Hooks.callAll('heroMancer.documentsReady', type, result, promises);
      await Promise.all(promises);

      return result;
    } catch (error) {
      HM.log(1, `Error preparing documents of type ${type}:`, error);
      ui.notifications.error(
        game.i18n.format('hm.errors.document-preparation-failed', {
          type: type,
          error: error.message
        })
      );
      return { types: [], dropdownHtml: '' };
    }
  }

  /* -------------------------------------------- */
  /*  Static Private Methods                      */
  /* -------------------------------------------- */

  /**
   * Organizes races into groups based on their folder name
   * @param {Array} documents - Race documents to organize
   * @returns {Array} Grouped race documents
   * @private
   */
  static #organizeRacesByFolderName(documents) {
    if (!documents?.length) {
      HM.log(2, 'Invalid or empty documents array for race organization');
      return [];
    }

    try {
      // Organize races into type groups
      const typeGroups = new Map();

      // First pass: create groups and assign documents
      for (const doc of documents) {
        // Extract base race name (everything before the first comma)
        const baseName = doc.name.split(',')[0].trim();

        // Create group if it doesn't exist yet
        if (!typeGroups.has(baseName)) {
          typeGroups.set(baseName, {
            folderName: baseName,
            docs: []
          });
        }

        // Add document to its group
        typeGroups.get(baseName).docs.push({
          id: doc.id,
          name: doc.name,
          packName: doc.packName,
          packId: doc.packId,
          journalPageId: doc.journalPageId,
          uuid: doc.uuid,
          description: doc.system?.description?.value || game.i18n.localize('hm.app.no-description'),
          enrichedDescription: doc.enrichedDescription
        });
      }

      // Second pass: sort documents within each group
      for (const group of typeGroups.values()) {
        group.docs.sort((a, b) => a.name.localeCompare(b.name));
      }

      // Convert map to sorted array
      return Array.from(typeGroups.values()).sort((a, b) => a.folderName.localeCompare(b.folderName));
    } catch (error) {
      HM.log(1, 'Error organizing races by type:', error);
      return [];
    }
  }

  /**
   * Gets flat list of documents with minimal processing
   * @param {Array} documents - Documents to process
   * @returns {Array} Processed documents
   * @private
   */
  static #getFlatDocuments(documents) {
    if (!documents?.length) {
      return [];
    }

    try {
      return documents
        .map((doc) => ({
          id: doc.id,
          name: `${doc.name} (${doc.packName || 'Unknown'})`,
          description: doc.description,
          enrichedDescription: doc.enrichedDescription,
          journalPageId: doc.journalPageId,
          packName: doc.packName,
          packId: doc.packId,
          uuid: doc.uuid
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      HM.log(1, 'Error processing flat documents:', error);
      return [];
    }
  }

  /**
   * Fetches documents from compendiums based on type
   * @param {'race'|'class'|'background'|'species'} type - Document type
   * @returns {Promise<{documents: Array}>} Array of processed documents
   * @private
   */
  static async #fetchTypeDocumentsFromCompendiums(type) {
    // Validate type for safety
    if (!['race', 'class', 'background', 'species'].includes(type)) {
      throw new Error(`Invalid document type: ${type}`);
    }

    // Get user-selected packs or fall back to all item packs
    const selectedPacks = game.settings.get(HM.ID, `${type}Packs`) || [];
    let packs = this.#getValidPacks(selectedPacks, type);

    if (!packs.length) {
      HM.log(2, `No valid packs found for type ${type}`);
      ui.notifications.warn(game.i18n.format('hm.warnings.no-packs-found', { type: type }));
      return { documents: [] };
    }

    // Process packs to extract documents
    const results = await this.#processAllPacks(packs, type);

    return {
      documents: this.#sortDocumentsByNameAndPack(results.validPacks)
    };
  }

  /**
   * Get valid packs based on user selection or defaults
   * @param {string[]} selectedPacks - User-selected pack IDs
   * @param {string} type - Document type
   * @returns {CompendiumCollection[]} - Array of valid packs
   * @private
   */
  static #getValidPacks(selectedPacks, type) {
    try {
      // If user selected specific packs, validate and filter them
      if (selectedPacks.length > 0) {
        const validPacks = [];
        const invalidPackIds = [];

        // Check each selected pack to see if it exists and is available
        for (const packId of selectedPacks) {
          const pack = game.packs.get(packId);
          if (pack && pack.metadata.type === 'Item') {
            validPacks.push(pack);
          } else {
            invalidPackIds.push(packId);
            HM.log(2, `Pack ${packId} is either missing or not an Item pack. It will be skipped.`);
          }
        }

        // If we found invalid packs, update the settings to remove them
        if (invalidPackIds.length > 0) {
          const updatedPacks = selectedPacks.filter((id) => !invalidPackIds.includes(id));
          HM.log(2, `Removing ${invalidPackIds.length} invalid packs from ${type}Packs setting.`);

          // Update the setting (wrapped in try/catch as this might fail if user lacks permissions)
          try {
            game.settings.set(HM.ID, `${type}Packs`, updatedPacks);
          } catch (e) {
            HM.log(1, `Failed to update ${type}Packs setting: ${e.message}`);
          }
        }

        // If we have valid packs, return them
        if (validPacks.length > 0) {
          return validPacks;
        }

        // Otherwise log a warning that we're using fallback
        HM.log(2, `No valid packs found in ${type}Packs settings. Falling back to all available Item packs.`);
      }

      // Fall back to all Item packs if no valid selected packs
      return game.packs.filter((pack) => pack.metadata.type === 'Item');
    } catch (error) {
      HM.log(1, `Error filtering packs for type ${type}:`, error);
      return [];
    }
  }

  /**
   * Process all packs to extract documents of specified type
   * @param {CompendiumCollection[]} packs - Packs to process
   * @param {string} type - Document type to filter
   * @returns {Promise<{validPacks: Array, failedPacks: Array, processingErrors: Array}>}
   * @private
   */
  static async #processAllPacks(packs, type) {
    const validPacks = [];
    const failedPacks = [];
    const processingErrors = [];

    // Process each pack sequentially for better control
    for (const pack of packs) {
      if (!pack?.metadata) {
        HM.log(2, 'Invalid pack encountered during processing');
        continue;
      }

      try {
        // Track fetch start time for performance monitoring
        const startTime = performance.now();
        const documents = await pack.getDocuments({ type });
        const endTime = performance.now();

        if (endTime - startTime > 1000) {
          HM.log(2, `Pack retrieval slow for ${pack.metadata.label}: ${Math.round(endTime - startTime)}ms`);
        }

        if (!documents?.length) {
          HM.log(3, `No documents of type ${type} found in ${pack.metadata.label}`);
          continue;
        }

        // Process all documents in this pack
        const packDocuments = await this.#processPackDocuments(pack, documents);
        validPacks.push(...packDocuments.filter(Boolean));
      } catch (error) {
        HM.log(1, `Failed to retrieve documents from pack ${pack.metadata.label}:`, error);
        processingErrors.push(error.message);
        failedPacks.push(pack.metadata.label);
      }
    }

    // Report errors if any packs failed
    this.#reportPackProcessingErrors(failedPacks, processingErrors);

    return { validPacks, failedPacks, processingErrors };
  }

  /**
   * Process documents from a single pack
   * @param {CompendiumCollection} pack - The pack being processed
   * @param {Document[]} documents - Documents to process
   * @returns {Promise<Array>} Processed documents
   * @private
   */
  static async #processPackDocuments(pack, documents) {
    // Process all documents in this pack with Promise.all
    return await Promise.all(
      documents.map(async (doc) => {
        if (!doc) return null;

        const packName = this.#determinePackName(pack.metadata.label, pack.metadata.id);
        const { description, enrichedDescription, journalPageId } = await this.#findDescription(doc);

        return {
          doc,
          packName,
          uuid: doc.uuid,
          packId: pack.metadata.id,
          description,
          enrichedDescription,
          journalPageId,
          folderName: doc.folder?.name || null,
          system: doc.system
        };
      })
    );
  }

  /**
   * Report errors for failed pack processing
   * @param {string[]} failedPacks - Names of packs that failed
   * @param {string[]} processingErrors - Error messages
   * @private
   */
  static #reportPackProcessingErrors(failedPacks, processingErrors) {
    if (failedPacks.length === 0) return;

    const errorDetails = processingErrors.length ? ` (Errors: ${processingErrors.join(', ')})` : '';

    ui.notifications.error(
      game.i18n.format('hm.errors.failed-compendium-retrieval', {
        type: failedPacks.join(', '),
        details: errorDetails
      })
    );

    HM.log(1, 'Failed pack retrieval details:', {
      failedPacks,
      processingErrors
    });
  }

  /**
   * Determines pack name based on id/label
   * @param {string} label - Pack label
   * @param {string} id - Pack id
   * @returns {string} Formatted pack name
   * @private
   */
  static #determinePackName(label, id) {
    if (!label || typeof label !== 'string') {
      return id || 'Unknown Pack';
    }

    // Use a mapping object for a more maintainable approach
    const packNameMap = {
      PHB: 'hm.app.document-service.common-labels.phb',
      SRD: 'hm.app.document-service.common-labels.srd',
      Forge: 'hm.app.document-service.common-labels.forge',
      DDB: 'hm.app.document-service.common-labels.dndbeyond-importer',
      Elkan: 'hm.app.document-service.common-labels.elkan5e'
    };

    // Check for matches in the mapping object
    for (const [key, localizationKey] of Object.entries(packNameMap)) {
      // Special case for Forge which might be in the ID instead of label
      if ((key === 'Forge' && id?.includes(key)) || label.includes(key)) {
        // Extra check for Elkan5e module
        if (key === 'Elkan' && !game.modules.get('elkan5e')?.active) {
          continue;
        }
        return game.i18n.localize(localizationKey);
      }
    }

    // Special case for homebrew
    if (/[./_-]home[\s_-]?brew[./_-]/i.test(label)) {
      return game.i18n.localize('hm.app.document-service.common-labels.homebrew');
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
    if (!documents?.length) {
      return [];
    }

    try {
      return documents
        .map(({ doc, packName, packId, description, enrichedDescription, journalPageId, folderName, uuid, system }) => ({
          id: doc.id,
          name: doc.name,
          description,
          enrichedDescription,
          journalPageId,
          folderName,
          packName,
          packId,
          uuid,
          system
        }))
        .sort((a, b) => {
          // Sort by name first, then by pack name if names are identical
          const nameCompare = a.name.localeCompare(b.name);
          return nameCompare || (a.packName || '').localeCompare(b.packName || '');
        });
    } catch (error) {
      HM.log(1, 'Error sorting documents:', error);
      return documents;
    }
  }

  /**
   * Finds and retrieves comprehensive description for a document by generating formatted content
   * @param {Object} doc - The document to find a description for
   * @returns {Promise<{description: string, journalPageId?: string}>} Description and optional journal page ID
   * @private
   */
  static async #findDescription(doc) {
    if (!doc) return;

    try {
      // Use JournalPageFinder from descriptionBuilder.js to find a journal page
      const journalPageId = await JournalPageFinder.findRelatedJournalPage(doc);

      // If we found a journal page, return its ID
      if (journalPageId) {
        return {
          description: game.i18n.localize('hm.app.journal-description-placeholder'),
          journalPageId
        };
      }

      // Get the raw description
      const rawDescription = doc.system?.description?.value || game.i18n.localize('hm.app.no-description');

      // Enrich the description HTML
      let enrichedDescription = await TextEditor.enrichHTML(rawDescription, { async: true });

      // Apply the h3->h2 transformations
      enrichedDescription = enrichedDescription
        .replace(/<h3/g, '<h2')
        .replace(/<\/h3/g, '</h2')
        .replace(/<\/ h3/g, '</ h2');

      // Return both raw and enriched descriptions
      return {
        description: rawDescription,
        enrichedDescription: enrichedDescription
      };
    } catch (error) {
      HM.log(1, `Error generating description for ${doc?.name}:`, error);

      // Return basic description even on error
      const rawDescription = doc.system?.description?.value || game.i18n.localize('hm.app.no-description');
      return {
        description: rawDescription
      };
    }
  }
}
