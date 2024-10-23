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
    HM.log(`Fetching documents for type: ${typeNice}`);

    // Collect documents from the selected or default packs
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
    // Fetch race documents from custom packs or all compendiums if none are set
    let raceData = await HMUtils.getDocuments('race');

    if (raceData) {
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

  static async registerClasses() {
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
      HM.log(`Class registration complete: ${sortedUniquePacks.length} packs registered.`);

      // Return both the classes and the generated dropdown HTML
      return {
        classes: sortedUniquePacks,
        dropdownHtml
      };
    }

    // If no class data is available, return an empty array
    HM.log('No class documents available for registration.');
    return {
      classes: [],
      dropdownHtml: '<option value="">No classes available</option>'
    };
  }

  /* Register backgrounds to ensure proper enrichment. */
  static async registerBackgrounds() {
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
      HM.log(`Background registration complete: ${sortedUniquePacks.length} packs registered.`);

      // Return both the background documents and the generated dropdown HTML
      return {
        backgrounds: sortedUniquePacks,
        dropdownHtml
      };
    }

    // Log if no background data is found
    HM.log('No background documents available for registration.');
    return {
      backgrounds: [],
      dropdownHtml: '<option value="">No backgrounds available</option>'
    };
  }

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

  static registerButton() {
    // Cache the DOM element in a variable
    const headerActions = $(
      'section[class*="actors-sidebar"] header[class*="directory-header"] div[class*="header-actions"]'
    );

    // Cache the localized button text and hint
    const buttonHint = game.i18n.localize(`${HM.ABRV}.actortab-button.hint`);
    const buttonName = game.i18n.localize(`${HM.ABRV}.actortab-button.name`);

    // Define the button HTML
    const buttonHTML = `
    <button type='button' class='${HM.ABRV}-actortab-button' title='${buttonHint}'>
      <i class='fa-solid fa-egg' style='color: #ff144f'></i>
      ${buttonName}
    </button>`;

    // Insert the button before the 'create-folder' button
    headerActions.find('button[class*="create-folder"]').before(buttonHTML);
  }
}
