import { HM } from './module.js';

/* Define HMUtils class for various utlities. */
export class HMUtils {
  static async getDocuments(type) {
    // Check for invalid argument
    if (typeof type !== 'string' || type.trim() === '') {
      throw new Error('Invalid argument: expected a non-empty string.');
    }

    // Capitalize the first letter of the type
    let typeNice = type.charAt(0).toUpperCase() + type.slice(1);

    // Initialize a set to hold valid document packs
    let validPacks = new Set();

    // Filter for packs of type 'Item'
    let packs = game.packs.filter((i) => i.metadata.type === 'Item');

    // Log the start of document fetching
    HM.log(`Fetching documents for type: ${typeNice}`);

    // Collect documents from the packs
    for (const pack of packs) {
      try {
        let documents = await pack.getDocuments({ type: type });

        // Log the pack and retrieved documents
        HM.log(`Retrieved documents from pack: ${pack.metadata.label}`, documents);

        // Iterate through the documents in the pack
        for (const doc of documents) {
          if (!doc) {
            HM.log(`Document is undefined in pack: ${pack.metadata.label}`, 'error');
          } else {
            // Process the pack name based on conditions
            let packName = pack.metadata.label;
            if (packName.includes('SRD')) {
              packName = 'SRD'; // Only keep 'SRD'
            } else if (packName.includes('DDB')) {
              packName = 'DDB'; // Only keep 'DDB'
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
        HM.log(`Failed to retrieve documents from pack ${pack.metadata.label}: ${error}`, 'error');
      }
    }

    // Log the completion of document collection
    HM.log(`${typeNice} collection complete: ${validPacks.size} documents collected.`);

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
    HM.log('Sorted Pack Docs:', sortedPackDocs);

    return {
      documents: sortedPackDocs,
      uniqueFolders: [] // No folder logic here; that can be handled separately for specific cases like races
    };
  }

  /* Register races to ensure proper enrichment and generate the dropdown HTML. */
  static async registerRaces() {
    let raceData = await HMUtils.getDocuments('race');

    if (raceData) {
      // eslint-disable-next-line capitalized-comments
      // let races = [];
      let uniqueFolders = new Map(); // Handle race-specific folder logic

      /* Process each document within the raceData.documents array */
      raceData.documents.forEach(({ id, name, packName, packId, description, folderName }) => {
        // Log the structure of the document for debugging
        HM.log(`Processing document: ${name}`, { id, name, packName, packId, description, folderName });

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
      let sortedUniqueFolders = Array
        .from(uniqueFolders
          .values())
        .sort((a, b) => a.folderName?.localeCompare(b.folderName)
          || a.docs[0].name.localeCompare(b.docs[0].name));

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

      HM.log(`Race registration complete: ${sortedUniqueFolders.length} documents registered.`);

      // Return both the race documents and the generated dropdown HTML
      return {
        races: sortedUniqueFolders, // Return the sorted folders and races
        dropdownHtml
      };
    }

    // In case there are no races
    HM.log('No races available for registration.');
    return {
      races: [],
      dropdownHtml: '<option value="">No races available</option>'
    };
  }

  /* Register classes to ensure proper enrichment. */
  /**
   * Description placeholder
   * @author Tyler
   *
   * @static
   * @async
   * @returns {unknown}
   */
  static async registerClasses() {
    let classData = await HMUtils.getDocuments('class');

    if (classData) {
      let classes = [];
      let nameCount = new Map(); // Track occurrences of each class name

      // First, count how many times each class name appears
      classData.documents.forEach(({ name }) => {
        nameCount.set(name, (nameCount.get(name) || 0) + 1);
      });

      // Process the documents, appending the compendium name if there are duplicates
      classData.documents.forEach(({ id, name, packName, description, packId }) => {
        let displayName = name;

        // If there are multiple entries with the same name, append the packName
        if (nameCount.get(name) > 1) {
          displayName = `${name} (${packName})`;
        }

        // Push the class data to the array
        classes.push({
          id,
          name: displayName, // Use the modified name if there are duplicates
          description,
          packName,
          packId
        });
      });

      HM.log(`Class registration complete: ${classes.length} documents registered.`);

      // Return the modified class data
      return classes;
    }

    // If no class data is available, return an empty array
    HM.log('No class documents available for registration.');
    return [];
  }

  /* Register backgrounds to ensure proper enrichment. */
  /**
   * Description placeholder
   * @author Tyler
   *
   * @static
   * @async
   * @returns {unknown}
   */
  static async registerBackgrounds() {
    let backgroundData = await HMUtils.getDocuments('background');

    if (backgroundData) {
      const backgrounds = backgroundData.documents.map((doc) => ({
        id: doc.id,
        name: doc.name,
        description: doc.description,
        packId: doc.packId
      }));

      // Log the number of documents registered
      HM.log(`Background registration complete: ${backgrounds.length} documents registered.`);

      // Return the mapped background documents
      return backgrounds;
    }

    // Log if no background data is found
    HM.log('No background documents available for registration.');
    return [];
  }

  /* Loads the correct data on Dropdown Change. */
  /**
   * Description placeholder
   * @author Tyler
   *
   * @static
   * @async
   * @param {*} type
   * @param {*} html
   * @returns {*}
   */
  static async handleDropdownChange(type, html) {
    let dropdown = html.querySelector(`#${type}-dropdown`);

    if (dropdown) {
      dropdown.addEventListener('change', (event) => {
        let selectedVal = event.target.value;

        /* Access document data from HM[type]. */
        let selectedDoc = HM[type].documents.find((doc) => doc.id === selectedVal);
        HM.log('Selected Document: ', selectedDoc);

        if (selectedDoc) {
          const packId = selectedDoc.packId;
          const docId = selectedDoc.id;

          HM.log(`Pack ID: ${packId}`);
          HM.log(`Document ID: ${docId}`);

          const compendium = game.packs.get(packId);
          HM.log('Compendium: ', compendium);

          if (compendium) {
            compendium
              .getDocument(docId)
              .then((doc) => {
                HM.log('Document: ', doc);
                HM.log('Document System: ', doc.system);
                HM.log('Document Description: ', doc.system.description);

                let descriptionHtml = doc.system.description?.value || 'No description available.';
                HM.log('Description HTML: ', descriptionHtml);

                /* Remove any existing description and <hr> */
                const existingHr = html.querySelector(`#${type}-dropdown + hr`);
                const existingDescription = html.querySelector(`#${type}-dropdown + .${HM.ABRV}-creator-description`);
                if (existingHr) existingHr.remove();
                if (existingDescription) existingDescription.remove();

                // Update the description for the dropdown
                dropdown.insertAdjacentHTML('afterend', `<hr />${descriptionHtml}`);
              })
              .catch((error) => {
                HM.log('Error Fetching Document for Dropdown Change: ', error, 'error');
              });
          }
        }
      });
    }
  }
}
