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
        journalPageId: doc.journalPageId,
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
      const docType = doc.type; // class, race, background
      const docName = doc.name;
      const docUuid = doc.uuid;

      if (!docType || !docName) return null;

      // Extract module ID from document pack or UUID
      let moduleId = null;
      if (doc.pack) {
        const packMatch = doc.pack.match(/^([^.]+)\./);
        if (packMatch) moduleId = packMatch[1];
      } else if (docUuid) {
        const uuidMatch = docUuid.match(/^Compendium\.([^.]+)\./);
        if (uuidMatch) moduleId = uuidMatch[1];
      }

      // Early return for SRD backgrounds and races - they don't have journal pages
      if (moduleId === 'dnd5e' && ['background', 'race', 'species'].includes(docType)) {
        return null;
      }

      const journalPacks = game.packs.filter((p) => p.metadata.type === 'JournalEntry');

      // Skip world journals entirely and focus on compendium search
      return await this.#searchCompendiumsForPage(journalPacks, docName, docType, docUuid);
    } catch (error) {
      HM.log(2, `Error finding journal page for ${doc?.name}:`, error);
      return null;
    }
  }

  /**
   * Search compendiums for matching journal page
   * @param {CompendiumCollection[]} packs - Journal packs to search through
   * @param {string} itemName - Item name to find
   * @param {string} itemType - Item type (race, class, background)
   * @param {string} [itemUuid] - Optional UUID of the original item for module matching
   * @returns {Promise<string|null>} - Journal page UUID or null
   * @private
   */
  static async #searchCompendiumsForPage(packs, itemName, itemType, itemUuid) {
    const normalizedItemName = itemName.toLowerCase();
    const specialRaces = ['elf', 'gnome', 'tiefling']; // Races that need special handling
    const isSpecialRace = specialRaces.some((race) => normalizedItemName.includes(race.toLowerCase()));

    // Determine if we need to check for base race name
    const baseRaceName = isSpecialRace ? this.#getBaseRaceName(itemName) : null;

    // Extract module prefix from item UUID if available
    let modulePrefix = null;
    if (itemUuid) {
      const uuidMatch = itemUuid.match(/^Compendium\.([^.]+)\./);
      if (uuidMatch && uuidMatch[1]) {
        modulePrefix = uuidMatch[1];
      }
    }

    // Prioritize packs by module prefix and filter out irrelevant ones
    let prioritizedPacks = [...packs];

    // Filter out irrelevant packs for better performance
    if (modulePrefix) {
      // First prioritize exact module matches
      const exactMatches = prioritizedPacks.filter((p) => p.collection.startsWith(modulePrefix));

      // If we have exact matches, only use those
      if (exactMatches.length > 0) {
        prioritizedPacks = exactMatches;
      } else {
        // Otherwise, sort with preference to PHB packs which are likely to have content
        prioritizedPacks.sort((a, b) => {
          const aIsPHB = a.collection.includes('dnd-players-handbook');
          const bIsPHB = b.collection.includes('dnd-players-handbook');
          if (aIsPHB && !bIsPHB) return -1;
          if (!aIsPHB && bIsPHB) return 1;
          return 0;
        });
      }
    }

    for (const pack of prioritizedPacks) {
      try {
        await pack.getIndex();

        // Load all journals in the pack, excluding art handouts
        for (const entry of pack.index) {
          try {
            // Skip art handouts
            if (entry.name.toLowerCase().includes('art') || entry.name.toLowerCase().includes('handout')) {
              continue;
            }

            const journal = await pack.getDocument(entry._id);
            if (!journal?.pages?.size) continue;

            // First try exact name match
            const exactMatch = journal.pages.find((p) => p.name.toLowerCase() === normalizedItemName);

            if (exactMatch) {
              const result = `${pack.collection}.${journal.id}.JournalEntryPage.${exactMatch.id}`;
              HM.log(3, `${itemType} "${itemName}" matches page "${exactMatch.name}" in journal "${journal.name}"`);
              return result;
            }

            // If this is a special race, try matching the base race name
            if (baseRaceName) {
              const baseMatch = journal.pages.find((p) => p.name.toLowerCase() === baseRaceName.toLowerCase());

              if (baseMatch) {
                const result = `${pack.collection}.${journal.id}.JournalEntryPage.${baseMatch.id}`;
                HM.log(3, `${itemType} "${itemName}" matches base race page "${baseMatch.name}" in journal "${journal.name}"`);
                return result;
              }
            }
          } catch (err) {
            continue; // Skip any problematic journals
          }
        }
      } catch (error) {
        HM.log(2, `Error searching journal pack ${pack.metadata.label}:`, error);
        continue; // Try next pack
      }
    }

    HM.log(2, `No matching journal page found for ${itemType} "${itemName}" after searching all packs`);
    return null;
  }

  /**
   * Get the base race name for special races
   * @param {string} raceName - Full race name
   * @returns {string|null} - Base race name or null
   * @private
   */
  static #getBaseRaceName(raceName) {
    if (!raceName) return null;

    // Handle comma format: "Elf, High" -> "Elf"
    if (raceName.includes(',')) {
      return raceName.split(',')[0].trim();
    }

    // Handle space format
    const lowerName = raceName.toLowerCase();

    if (lowerName.includes('elf') && raceName.includes(' ')) {
      return 'Elf';
    }

    if (lowerName.includes('gnome') && raceName.includes(' ')) {
      return 'Gnome';
    }

    if (lowerName.includes('tiefling') && raceName.includes(' ')) {
      return 'Tiefling';
    }

    return null;
  }
}
