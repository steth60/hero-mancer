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

      let result;
      if (type === 'race' || type === 'species') {
        result = this.#organizeRacesByTypeIdentifier(data.documents);
      } else {
        result = this.#getFlatDocuments(data.documents);
      }

      /**
       * A hook event that fires after documents have been fetched and organized but before they're returned.
       * This allows modules to filter or modify the documents that will be displayed in Hero Mancer.
       *
       * @event heroMancer.documentsReady
       * @param {string} type - The document type being prepared ('race', 'class', 'background', or 'species')
       * @param {Array} result - The processed document array that will be returned and displayed
       * @param {Promise[]} promises - An array to which Promises can be pushed; Hero Mancer will await all these promises before continuing
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
   * Formats race type identifier into proper display name
   * @param {string} identifier - Race type identifier
   * @returns {string} Formatted display name
   * @private
   */
  static #formatRaceTypeIdentifier(identifier) {
    // Input validation
    if (!identifier || typeof identifier !== 'string') {
      return 'Other';
    }

    try {
      return identifier
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    } catch (error) {
      HM.log(2, `Error formatting race type identifier "${identifier}":`, error);
      return 'Other';
    }
  }

  /**
   * Extracts race type identifier from document
   * @param {Object} doc - Document to extract type from
   * @returns {string} Type identifier
   * @private
   */
  static #extractRaceTypeIdentifier(doc) {
    if (!doc || !doc.system) {
      return 'other';
    }

    const possiblePaths = [doc.system?.type?.subtype, doc.system?.type?.value, doc.system?.traits?.type?.value, doc.system?.details?.race, doc.system?.details?.species];

    // Return the first non-empty value, or 'other' if none found
    return possiblePaths.find((path) => path) || 'other';
  }

  /**
   * Organizes races into groups based on their type identifier
   * @param {Array} documents - Race documents to organize
   * @returns {Array} Grouped race documents
   * @private
   */
  static #organizeRacesByTypeIdentifier(documents) {
    if (!documents || !Array.isArray(documents)) {
      HM.log(2, 'Invalid documents array for race organization');
      return [];
    }

    try {
      // Create type groups
      const typeGroups = this.#createRaceTypeGroups(documents);

      // Sort documents within each group
      this.#sortRaceGroupContents(typeGroups);

      // Convert map to sorted array
      return this.#convertRaceGroupsToSortedArray(typeGroups);
    } catch (error) {
      HM.log(1, 'Error organizing races by type:', error);
      return [];
    }
  }

  /**
   * Creates a map of race type groups from documents
   * @param {Array} documents - Race documents to organize
   * @returns {Map} Map of race type groups
   * @private
   */
  static #createRaceTypeGroups(documents) {
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
        description: doc.system?.description?.value || game.i18n.localize('hm.app.no-description')
      });
    });

    return typeGroups;
  }

  /**
   * Sorts documents within each race type group
   * @param {Map} typeGroups - Map of race type groups
   * @private
   */
  static #sortRaceGroupContents(typeGroups) {
    typeGroups.forEach((group) => {
      group.docs.sort((a, b) => a.name.localeCompare(b.name));
    });
  }

  /**
   * Converts a map of race type groups to a sorted array
   * @param {Map} typeGroups - Map of race type groups
   * @returns {Array} Sorted array of race type groups
   * @private
   */
  static #convertRaceGroupsToSortedArray(typeGroups) {
    return Array.from(typeGroups.values()).sort((a, b) => a.folderName.localeCompare(b.folderName));
  }

  /**
   * Gets flat list of documents with minimal processing
   * @param {Array} documents - Documents to process
   * @returns {Array} Processed documents
   * @private
   */
  static #getFlatDocuments(documents) {
    if (!documents || !Array.isArray(documents)) {
      return [];
    }

    try {
      return documents
        .map((doc) => ({
          id: doc.id,
          name: `${doc.name} (${doc.packName || 'Unknown'})`,
          description: doc.description,
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
   * @returns {Promise<{documents: Array}>}
   * @private
   */
  static async #fetchTypeDocumentsFromCompendiums(type) {
    // Validate type again for safety
    if (!['race', 'class', 'background', 'species'].includes(type)) {
      throw new Error(`Invalid document type: ${type}`);
    }

    const selectedPacks = game.settings.get(HM.ID, `${type}Packs`) || [];
    let packs;

    try {
      packs = selectedPacks.length > 0 ? game.packs.filter((pack) => selectedPacks.includes(pack.metadata.id)) : game.packs.filter((pack) => pack.metadata.type === 'Item');

      if (!packs.length) {
        HM.log(2, `No valid packs found for type ${type}`);
        ui.notifications.warn(game.i18n.format('hm.warnings.no-packs-found', { type: type }));
        return { documents: [] };
      }
    } catch (error) {
      HM.log(1, `Error filtering packs for type ${type}:`, error);
      return { documents: [] };
    }

    const validPacks = [];
    const failedPacks = [];
    const processingErrors = [];

    // Process each pack sequentially to better control execution
    for (const pack of packs) {
      if (!pack || !pack.metadata) {
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

        if (!documents || !documents.length) {
          HM.log(3, `No documents of type ${type} found in ${pack.metadata.label}`);
          continue;
        }

        // Process all documents in this pack with Promise.all for proper awaiting
        const packDocs = await Promise.all(
          documents.map(async (doc) => {
            if (!doc) return null;

            const packName = this.#determinePackName(pack.metadata.label, pack.metadata.id);
            const { description, journalPageId } = await this.#findDescription(doc);

            return {
              doc,
              packName,
              uuid: doc.uuid,
              packId: pack.metadata.id,
              description,
              journalPageId,
              folderName: doc.folder?.name || null,
              system: doc.system
            };
          })
        );

        // Filter out null values and add to validPacks
        validPacks.push(...packDocs.filter(Boolean));
      } catch (error) {
        HM.log(1, `Failed to retrieve documents from pack ${pack.metadata.label}:`, error);
        processingErrors.push(error.message);
        failedPacks.push(pack.metadata.label);
      }
    }

    // Report errors more comprehensively
    if (failedPacks.length > 0) {
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

    return {
      documents: this.#sortDocumentsByNameAndPack(validPacks)
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
    if (!label || typeof label !== 'string') {
      return id || 'Unknown Pack';
    }

    // Use a mapping object instead of if/else chain
    const packNameMap = {
      PHB: 'hm.app.document-service.phb',
      SRD: 'hm.app.document-service.srd',
      Forge: 'hm.app.document-service.forge',
      DDB: 'hm.app.document-service.dndbeyond-importer',
      Elkan: 'hm.app.document-service.elkan5e'
    };

    // Check for matches in the mapping object
    for (const [key, localizationKey] of Object.entries(packNameMap)) {
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
      return game.i18n.localize('hm.app.document-service.homebrew');
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
    if (!documents || !Array.isArray(documents)) {
      return [];
    }

    try {
      return documents
        .map(({ doc, packName, packId, description, journalPageId, folderName, uuid, system }) => ({
          id: doc.id,
          name: doc.name,
          // Extract description and journalPageId from the returned object
          description: description,
          journalPageId,
          folderName,
          packName,
          packId,
          uuid,
          system
        }))
        .sort((a, b) => {
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
   * @returns {Promise<string>} Complete description HTML
   * @private
   */
  static async #findDescription(doc) {
    if (!doc) return { description: game.i18n.localize('hm.app.no-description') };

    try {
      // First check if there's a journal page we can use
      const journalPageId = await this.#findRelatedJournalPage(doc);

      // Return object with journalPageId if found, otherwise include description
      if (journalPageId) {
        return {
          description: game.i18n.localize('hm.app.journal-description-placeholder'),
          journalPageId
        };
      }

      // Just return the basic description when no journal page exists
      return {
        description: doc.system?.description?.value || game.i18n.localize('hm.app.no-description')
      };
    } catch (error) {
      HM.log(1, `Error generating description for ${doc?.name}:`, error);
      return {
        description: doc.system?.description?.value || game.i18n.localize('hm.app.no-description')
      };
    }
  }

  /**
   * Finds a journal page related to the document
   * @param {Object} doc - The document to find a journal page for
   * @returns {Promise<string|null>} Journal page ID or null if none found
   * @private
   */
  static async #findRelatedJournalPage(doc) {
    if (!doc) return null;

    try {
      // Look for journals with names matching patterns like "Class: Fighter" or "Fighter Class"
      const docType = doc.type; // class, race, background
      const docName = doc.name;

      if (!docType || !docName) return null;

      // Define search patterns
      const patterns = [
        `${docName} ${docType}`,
        `${docType}: ${docName}`,
        `${docType} - ${docName}`,
        docName // Also try just the name by itself
      ];

      // Log what we're searching for
      HM.log(3, `Looking for journal page for ${docType} ${docName} with patterns:`, patterns);

      // Case-insensitive search
      const lowerPatterns = patterns.map((p) => p.toLowerCase());

      // PART 1: Search through world journals first
      HM.log(3, 'Searching world journals...');
      const worldJournalResult = this.#searchWorldJournals(lowerPatterns);
      if (worldJournalResult) {
        HM.log(2, `Found matching journal page in world: ${worldJournalResult}`);
        return worldJournalResult;
      }

      // PART 2: Search through compendium packs
      HM.log(3, 'Searching compendium packs...');

      // Extract module ID from document pack if available
      const docPackMatch = doc.pack?.match(/^([^.]+)\./);
      const docModuleId = docPackMatch ? docPackMatch[1] : null;

      if (docModuleId) {
        HM.log(3, `Document is from module: ${docModuleId}`);
      }

      // Get all journal entry packs
      const journalPacks = game.packs.filter((p) => p.metadata.type === 'JournalEntry');

      // First try packs from the same module as the document
      if (docModuleId) {
        const moduleJournalPacks = journalPacks.filter((p) => p.metadata.id.startsWith(docModuleId));
        HM.log(3, `Found ${moduleJournalPacks.length} journal packs from same module`);

        const packResult = await this.#searchJournalPacks(moduleJournalPacks, lowerPatterns, docName);
        if (packResult) {
          HM.log(2, `Found matching journal page in module pack: ${packResult}`);
          return packResult;
        }
      }

      // Then try all other packs as a fallback
      HM.log(3, `Searching all ${journalPacks.length} available journal packs`);
      const packResult = await this.#searchJournalPacks(journalPacks, lowerPatterns, docName);
      if (packResult) {
        HM.log(2, `Found matching journal page in compendium: ${packResult}`);
        return packResult;
      }

      HM.log(3, `No matching journal page found for ${docType} ${docName}`);
      return null;
    } catch (error) {
      HM.log(2, `Error finding journal page for ${doc?.name}:`, error);
      return null;
    }
  }

  /**
   * Search world journals for matching pages
   * @param {string[]} lowerPatterns - Lowercase name patterns to search for
   * @returns {string|null} Journal page ID or null if none found
   * @private
   */
  static #searchWorldJournals(lowerPatterns) {
    // Search through journal entries
    for (const journal of game.journal) {
      if (lowerPatterns.includes(journal.name.toLowerCase())) {
        // Return the first page if the journal has pages
        if (journal.pages.size > 0) {
          return journal.pages.contents[0].id;
        }
      }

      // Also check individual pages within journals that might match
      for (const page of journal.pages) {
        if (lowerPatterns.includes(page.name.toLowerCase())) {
          return page.id;
        }
      }
    }

    return null;
  }

  /**
   * Search journal packs for matching entries
   * @param {CompendiumCollection[]} packs - Journal packs to search through
   * @param {string[]} lowerPatterns - Lowercase name patterns to search for
   * @param {string} docName - Original document name for exact match attempts
   * @returns {Promise<string|null>} Journal page ID or null if none found
   * @private
   */
  static async #searchJournalPacks(packs, lowerPatterns, docName) {
    for (const pack of packs) {
      try {
        // Get the index first (faster than loading all documents)
        const index = await pack.getIndex();

        // Look for exact name matches first
        const exactMatches = Array.from(index).filter((entry) => lowerPatterns.includes(entry.name.toLowerCase()));

        if (exactMatches.length > 0) {
          // Load the first matching journal
          const journal = await pack.getDocument(exactMatches[0]._id);
          if (journal.pages.size > 0) {
            // Return pack ID + journal ID instead of just the page ID
            return `${pack.collection}.${journal.id}`;
          }
        }

        // Rest of method remains the same...
      } catch (error) {
        HM.log(2, `Error searching journal pack ${pack.metadata.label}:`, error);
        continue; // Try next pack
      }
    }

    return null;
  }
}
