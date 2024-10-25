import { HM } from '../hero-mancer.js';
import * as HMUtils from '../utils/index.js';

/**
 * Process and sort documents by a given key.
 * @param {Array} documents Array of documents to process.
 * @param {string} key The key to use for grouping and sorting.
 * @returns {Array} Sorted array of grouped documents.
 */
function processDocuments(documents, key) {
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

/**
 * Register races and generate dropdown HTML.
 * @returns {object} Object containing races and generated dropdown HTML.
 */
export async function registerRaces() {
  try {
    let raceData = await HMUtils.getDocuments('race');
    if (!raceData) throw new Error('no-race-data');

    const sortedUniqueFolders = processDocuments(raceData.documents, 'folderName');
    const dropdownHtml = HMUtils.generateDropdownHTML(sortedUniqueFolders, 'folderName');

    return { races: sortedUniqueFolders, dropdownHtml };
  } catch (error) {
    HM.log(1, 'Error: Failed to register races. No race data available.');
    return {
      races: [],
      dropdownHtml: `<option value="">${game.i18n.localize('hm.no-races-available')}</option>`
    };
  }
}

/**
 * Register classes and generate dropdown HTML.
 * @returns {object} Object containing classes and generated dropdown HTML.
 */
export async function registerClasses() {
  try {
    let classData = await HMUtils.getDocuments('class');
    if (!classData) throw new Error('no-class-data');

    const sortedUniquePacks = processDocuments(classData.documents, 'packName');
    const dropdownHtml = HMUtils.generateDropdownHTML(sortedUniquePacks, 'packName');

    return { classes: sortedUniquePacks, dropdownHtml };
  } catch (error) {
    HM.log(1, 'Error: Failed to register classes. No class data available.');
    return {
      classes: [],
      dropdownHtml: `<option value="">${game.i18n.localize('hm.no-classes-available')}</option>`
    };
  }
}

/**
 * Register backgrounds and generate dropdown HTML.
 * @returns {object} Object containing backgrounds and generated dropdown HTML.
 */
export async function registerBackgrounds() {
  try {
    let backgroundData = await HMUtils.getDocuments('background');
    if (!backgroundData) throw new Error('no-background-data');

    const sortedUniquePacks = processDocuments(backgroundData.documents, 'packName');
    const dropdownHtml = HMUtils.generateDropdownHTML(sortedUniquePacks, 'packName');

    return { backgrounds: sortedUniquePacks, dropdownHtml };
  } catch (error) {
    HM.log(1, 'Error: Failed to register backgrounds. No background data available.');
    return {
      backgrounds: [],
      dropdownHtml: `<option value="">${game.i18n.localize('hm.no-backgrounds-available')}</option>`
    };
  }
}
