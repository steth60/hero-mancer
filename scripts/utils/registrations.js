import { HM } from '../module.js';
import * as HMUtils from '../utils/index.js';

/* Register races to ensure proper enrichment and generate the dropdown HTML. */

export async function registerRaces() {
  // Fetch race documents from custom packs or all compendiums if none are set
  let raceData = await HMUtils.getDocuments('race');

  if (raceData) {
    let uniqueFolders = new Map(); // Handle race-specific folder logic

    /* Process each document within the raceData.documents array */
    raceData.documents.forEach(({ id, name, packName, packId, description, folderName }) => {
      // Log the structure of the document for debugging
      HM.log(3, `Processing document: ${name}`, { id, name, packName, packId, description, folderName });

      if (folderName) {
        // If the folder doesn't exist in the map, create a new entry
        if (!uniqueFolders.has(folderName)) {
          uniqueFolders.set(folderName, { folderName, docs: [], packName, packId });
        }

        // Add the document to the corresponding folder entry
        uniqueFolders.get(folderName).docs.push({
          id,
          name,
          description,
          packName,
          packId
        });
      } else {
        // Standalone document, no folder
        uniqueFolders.set(name, {
          folderName: null,
          docs: [
            {
              id,
              name,
              description,
              packName,
              packId
            }
          ]
        });
      }
    });

    /* Sort folders alphabetically */
    let sortedUniqueFolders = Array.from(uniqueFolders.values()).sort(
      (a, b) => a.folderName?.localeCompare(b.folderName) || a.docs[0].name.localeCompare(b.docs[0].name)
    );

    /* Handle optgroup creation */
    let dropdownHtml = '';

    sortedUniqueFolders.forEach((folder) => {
      if (folder.docs.length === 1 && !folder.folderName) {
        dropdownHtml += `<option value="${folder.docs[0].id}">${folder.docs[0].name}</option>`;
      } else if (folder.docs.length === 1) {
        dropdownHtml += `<option value="${folder.docs[0].id}">${folder.docs[0].name}</option>`;
      } else {
        dropdownHtml += `<optgroup label="${folder.folderName}">`;
        folder.docs.forEach((doc) => {
          dropdownHtml += `<option value="${doc.id}">${doc.name}</option>`;
        });
        dropdownHtml += '</optgroup>';
      }
    });

    HM.log(3, `Race registration complete: ${sortedUniqueFolders.length} documents registered.`);

    // Return both the race documents and the generated dropdown HTML
    return {
      races: sortedUniqueFolders, // Return the sorted folders and races
      dropdownHtml
    };
  }

  // In case there are no races
  HM.log(2, 'No races available for registration.');
  return {
    races: [],
    dropdownHtml: '<option value="">No races available</option>'
  };
}

export async function registerClasses() {
  let classData = await HMUtils.getDocuments('class');

  if (classData) {
    const uniquePacks = new Map(); // Map to handle pack-specific grouping

    // Process the documents and group them by packName
    classData.documents.forEach(({ id, name, description, packName, packId }) => {
      // Group documents by packName (use the full packName for the optgroup)
      if (!uniquePacks.has(packName)) {
        uniquePacks.set(packName, { packName, docs: [] });
      }

      // Add the document to the corresponding pack entry
      uniquePacks.get(packName).docs.push({
        id,
        name, // Use only the document name, no packName appended
        description,
        packId
      });
    });

    // Sort the unique packs alphabetically by pack name
    let sortedUniquePacks = Array.from(uniquePacks.values()).sort((a, b) => a.packName.localeCompare(b.packName));

    // Handle optgroup creation for the dropdown
    let dropdownHtml = '';
    sortedUniquePacks.forEach((pack) => {
      if (pack.docs.length === 1) {
        dropdownHtml += `<option value="${pack.docs[0].id}">${pack.docs[0].name}</option>`;
      } else {
        dropdownHtml += `<optgroup label="${pack.packName}">`; // Use full packName here
        pack.docs.forEach((doc) => {
          dropdownHtml += `<option value="${doc.id}">${doc.name}</option>`; // No packName appended
        });
        dropdownHtml += '</optgroup>';
      }
    });

    // Log the number of documents registered
    HM.log(3, `Class registration complete: ${sortedUniquePacks.length} packs registered.`);

    // Return both the classes and the generated dropdown HTML
    return {
      classes: sortedUniquePacks,
      dropdownHtml
    };
  }

  // If no class data is available, return an empty array
  HM.log(2, 'No class documents available for registration.');
  return {
    classes: [],
    dropdownHtml: '<option value="">No classes available</option>'
  };
}
/* Register backgrounds to ensure proper enrichment. */

export async function registerBackgrounds() {
  let backgroundData = await HMUtils.getDocuments('background');

  if (backgroundData) {
    const uniquePacks = new Map(); // Map to handle pack-specific grouping

    // Process each document in the backgroundData.documents array
    backgroundData.documents.forEach(({ id, name, description, packId, packName }) => {
      // Use full packName in optgroup and don't append the packName abbreviation to item names
      // If the pack doesn't exist in the map, create a new entry
      if (!uniquePacks.has(packName)) {
        uniquePacks.set(packName, { packName, docs: [] }); // Full packName
      }

      // Add the document to the corresponding pack entry
      uniquePacks.get(packName).docs.push({
        id,
        name, // Use only the document name, no abbreviation appended
        description,
        packId
      });
    });

    // Sort the unique packs alphabetically by pack name
    let sortedUniquePacks = Array.from(uniquePacks.values()).sort((a, b) => a.packName.localeCompare(b.packName));

    // Handle optgroup creation for the dropdown
    let dropdownHtml = '';

    sortedUniquePacks.forEach((pack) => {
      if (pack.docs.length === 1) {
        dropdownHtml += `<option value="${pack.docs[0].id}">${pack.docs[0].name}</option>`;
      } else {
        dropdownHtml += `<optgroup label="${pack.packName}">`; // Use full packName
        pack.docs.forEach((doc) => {
          dropdownHtml += `<option value="${doc.id}">${doc.name}</option>`; // No abbreviation in name
        });
        dropdownHtml += '</optgroup>';
      }
    });

    // Log the number of documents registered
    HM.log(3, `Background registration complete: ${sortedUniquePacks.length} packs registered.`);

    // Return both the background documents and the generated dropdown HTML
    return {
      backgrounds: sortedUniquePacks,
      dropdownHtml
    };
  }

  // Log if no background data is found
  HM.log(2, 'No background documents available for registration.');
  return {
    backgrounds: [],
    dropdownHtml: '<option value="">No backgrounds available</option>'
  };
}
