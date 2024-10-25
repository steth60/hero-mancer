import { HM } from '../hero-mancer.js';

/**
 * Fetch and process documents from compendiums based on the provided type.
 * @async
 * @param {string} type The type of documents to fetch (e.g., 'race', 'class', 'background').
 * @returns {Promise<object>} An object containing the sorted documents and additional metadata.
 * @throws Will throw an error if the type is invalid or if document retrieval fails.
 * @throws Will display a UI error notification if a compendium pack retrieval fails.
 */
export async function getDocuments(type) {
  // Check for invalid argument
  if (typeof type !== 'string' || type.trim() === '') {
    throw new Error('Invalid argument: expected a non-empty string.');
  }

  // Capitalize the first letter of the type
  let typeNice = type.charAt(0).toUpperCase() + type.slice(1);

  // Initialize a set to hold valid document packs
  let validPacks = new Set();

  // Fetch custom compendiums from settings based on the type
  let selectedPacks = [];
  if (type === 'class') {
    selectedPacks = game.settings.get('hero-mancer', 'classPacks') || [];
  } else if (type === 'race') {
    selectedPacks = game.settings.get('hero-mancer', 'racePacks') || [];
  } else if (type === 'background') {
    selectedPacks = game.settings.get('hero-mancer', 'backgroundPacks') || [];
  }

  // If custom packs are selected, filter for those. Otherwise, get all 'Item' type packs
  let packs;
  if (selectedPacks.length > 0) {
    packs = game.packs.filter((pack) => selectedPacks.includes(pack.metadata.id));
  } else {
    packs = game.packs.filter((i) => i.metadata.type === 'Item');
  }

  // Log the start of document fetching
  HM.log(3, `Fetching documents for type: ${typeNice}`);

  // Collect documents from the selected or default packs
  for (const pack of packs) {
    try {
      let documents = await pack.getDocuments({ type: type });

      // Log the pack and retrieved documents
      HM.log(3, `Retrieved documents from pack: ${pack.metadata.label}`, documents);

      // Iterate through the documents in the pack
      for (const doc of documents) {
        if (!doc) {
          HM.log(3, `Document is undefined in pack: ${pack.metadata.label}`, 'error');
        } else {
          // Process the pack name based on conditions
          let packName = pack.metadata.label;
          if (packName.includes('SRD')) {
            packName = 'SRD'; // Only keep 'SRD' as a shorthand for the SRD items.
          } else if (packName.includes('DDB')) {
            packName = 'DDB'; // Only keep 'DDB' added default support for DDB Importer
          }

          // Add the document to the validPacks set
          validPacks.add({
            doc,
            packName, // Use the modified packName
            packId: pack.metadata.id, // Compendium key for lookup
            description: doc.system.description?.value || `${game.i18n.localize(`${HM.ABRV}.app.no-description`)}`,
            folderName: doc.folder?.name || null // Extract folder name, set to null if not in a folder
          });
        }
      }
    } catch (error) {
      HM.log(1, `Failed to retrieve documents from pack ${pack.metadata.label}: ${error}`, 'error');
      ui.notifications.error(
        `Failed to retrieve documents from compendium pack: ${pack.metadata.label}. Please check if the pack is valid.`
      );
    }
  }

  // Log the completion of document collection
  HM.log(3, `${typeNice} collection complete: ${validPacks.size} documents collected.`);

  // Sort the documents by name, and if names match, sort by packName to prioritize 'DDB' over 'SRD'
  let sortedPackDocs = [...validPacks]
    .map(({ doc, packName, packId, description, folderName }) => ({
      id: doc.id,
      name: doc.name,
      description,
      folderName, // Includes the folder name if available
      packName, // Includes the shorthand 'SRD' or 'DDB' if applicable
      packId
    }))
    .sort((a, b) => {
      let nameCompare = a.name.localeCompare(b.name);
      return nameCompare === 0 ? a.packName.localeCompare(b.packName) : nameCompare;
    });

  // Log the sorted document structure for verification
  HM.log(3, 'Sorted Pack Docs:', sortedPackDocs);

  return {
    documents: sortedPackDocs,
    uniqueFolders: [] // No folder logic here; that can be handled separately for specific cases like races
  };
}
/**
 * Finds the selected document from the dropdown based on its type (race, class, background).
 * @param {Array} documents The array of documents (flattened or grouped).
 * @param {string} selectedId The ID of the selected document.
 * @param {string} type The type of the document (race, class, background).
 * @returns {object|null} The selected document or null if not found.
 */
export function findSelectedDocument(documents, selectedId, type) {
  let selectedDoc = null;

  switch (type) {
    case 'race':
      selectedDoc = documents.flatMap((folder) => folder.docs).find((doc) => doc.id === selectedId);
      break;
    case 'background':
    case 'class':
      selectedDoc = documents.flatMap((pack) => pack.docs).find((doc) => doc.id === selectedId);
      break;
    default:
      selectedDoc = documents.find((doc) => doc.id === selectedId);
      break;
  }

  return selectedDoc || null;
}
