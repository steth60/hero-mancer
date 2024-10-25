import { HM } from '../hero-mancer.js';

/**
 * Fetch and process documents from compendiums based on the provided type.
 * @async
 * @param {string} type The type of documents to fetch (e.g., 'race', 'class', 'background').
 * @returns {Promise<object>} An object containing the sorted documents and additional metadata.
 * @throws Will throw an error if the type is invalid or if document retrieval fails.
 * @throws Will display a UI error notification if a compendium pack retrieval fails.
 */
export async function fetchDocuments(type) {
  // Check for invalid argument
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
    selectedPacks.length > 0 ?
      game.packs.filter((pack) => selectedPacks.includes(pack.metadata.id))
    : game.packs.filter((i) => i.metadata.type === 'Item');

  HM.log(3, `Fetching documents for type: ${typeNice}`);

  for (const pack of packs) {
    try {
      let documents = await pack.getDocuments({ type: type });

      HM.log(3, `Retrieved documents from pack: ${pack.metadata.label}`, documents);

      for (const doc of documents) {
        if (!doc) {
          HM.log(3, `Document is undefined in pack: ${pack.metadata.label}`, 'error');
        } else {
          let packName = pack.metadata.label;
          if (packName.includes('SRD')) packName = 'SRD';
          if (packName.includes('DDB')) packName = 'DDB';

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
 * Fetches and prepares documents based on the specified type for dropdown use.
 * @param {string} type The type of document to register (e.g., 'race', 'class', 'background').
 * @returns {Promise<object>} - Object containing processed documents and HTML for the dropdown.
 */
export async function prepareDocuments(type) {
  try {
    let data = await fetchDocuments(type);
    if (!data) throw new Error(`no-${type}-data`);

    const groupingField = type === 'race' ? 'folderName' : 'packName';
    const sortedUniqueFolders = groupAndSortDocuments(data.documents, groupingField);

    const dropdownHtml = HMUtils.generateDropdownHTML(sortedUniqueFolders, groupingField);

    return { types: sortedUniqueFolders, dropdownHtml };
  } catch (error) {
    HM.log(1, `Error: Failed to register ${type} documents. No ${type} data available.`);
    return {
      types: [],
      dropdownHtml: `<option value="">${game.i18n.localize(`hm.no-${type}-available`)}</option>`
    };
  }
}

/**
 * Groups and sorts documents by a given key.
 * @param {Array} documents Array of documents to process.
 * @param {string} key The key to use for grouping and sorting.
 * @returns {Array} Sorted array of grouped documents.
 */
function groupAndSortDocuments(documents, key) {
  const uniqueMap = new Map();

  documents.forEach(({ id, name, description, packName, packId, folderName }) => {
    const groupKey = folderName || name;

    if (!uniqueMap.has(groupKey)) {
      uniqueMap.set(groupKey, { folderName: folderName || null, docs: [], packName, packId });
    }

    uniqueMap.get(groupKey).docs.push({ id, name, description, packName, packId });
  });

  return Array.from(uniqueMap.values()).sort(
    (a, b) => a[key]?.localeCompare(b[key]) || a.docs[0].name.localeCompare(b.docs[0].name)
  );
}
