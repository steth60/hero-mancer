import { CCreator } from './module.js';

export class CCUtils {
  static async getDocuments(type) {
    if (typeof type !== 'string' || type.trim() === '') {
      throw new Error('Invalid argument: expected a non-empty string.');
    }

    const validPacks = new Set();
    const packs = game.packs.filter((i) => i.metadata.type === 'Item');

    // Collect documents from the packs
    for (const pack of packs) {
      try {
        const documents = await pack.getDocuments({ type: type });

        for (const doc of documents) {
          validPacks.add({
            doc,
            packName: pack.metadata.label, // Human-readable name of the compendium
            packId: pack.metadata.id, // The compendium key like 'dnd5e.classes'
            description: doc.system.description?.value || 'No description available' // Add the description
          });
        }
      } catch (error) {
        console.error(`Failed to retrieve documents from pack ${pack.metadata.label}:`, error);
      }
    }

    // Log the total number of documents collected
    console.info(`${CCreator.ID} | ${type} collection complete: ${validPacks.size} documents collected.`);

    // Handle race-specific logic: always handle folders for races
    if (type === 'race') {
      const uniqueFolders = new Map();

      [...validPacks].forEach(({ doc, packName, packId, description }) => {
        const folder = doc.folder;
        const folderName = folder ? folder.name : null;

        if (folderName) {
          if (!uniqueFolders.has(folderName)) {
            uniqueFolders.set(folderName, { folderName, docs: [], packName, packId });
          }
          uniqueFolders.get(folderName).docs.push({
            id: doc.id,
            name: doc.name,
            description, // Include the description
            packName,
            packId // Store the pack ID (compendium key) as well
          });
        }
      });

      // Sort uniqueFolders alphabetically by folder name
      const sortedUniqueFolders = Array.from(uniqueFolders.values()).sort((a, b) => a.folderName.localeCompare(b.folderName));

      console.info(`${CCreator.ID} | race folder collection complete: ${sortedUniqueFolders.length} folders collected.`);

      return {
        uniqueFolders: sortedUniqueFolders, // Sorted folder array
        documents: [] // Empty for race (only folders are handled)
      };
    } else {
      // Handle class/background logic: no folders
      const sortedPackDocs = [...validPacks]
        .map(({ doc, packName, packId, description }) => ({
          id: doc.id,
          name: doc.name,
          description, // Include the description
          folderName: null,
          packName,
          packId // Include pack ID (compendium key)
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      console.info(`${CCreator.ID} | ${type} collection complete: ${sortedPackDocs.length} documents sorted and collected.`);

      return {
        documents: sortedPackDocs, // Sorted class/background docs
        uniqueFolders: [] // Empty for class/background
      };
    }
  }

  static async registerRaces() {
    let raceData = await CCUtils.getDocuments('race');

    if (raceData) {
      const races = [];

      raceData.uniqueFolders.forEach((folder) => {
        folder.docs.forEach((doc) => {
          races.push({
            id: doc.id,
            name: `${folder.folderName} ${doc.name}`,
            folderName: folder.folderName,
            itemName: doc.name,
            description: doc.description,
            packId: doc.packId
          });
        });
      });
      console.info(`${CCreator.ID} | Race registration complete: ${races.length} documents registered.`);
      return races;
    }
    return [];
  }

  static async registerClasses() {
    let classData = await CCUtils.getDocuments('class');

    if (classData) {
      return classData.documents.map((doc) => ({
        id: doc.id,
        name: doc.name,
        description: doc.description,
        packId: doc.packId
      }));
    }
    console.info(`${CCreator.ID} | Class registration complete: ${documents.length} documents registered.`);
    return [];
  }

  static async registerBackgrounds() {
    let backgroundData = await CCUtils.getDocuments('background');

    if (backgroundData) {
      return backgroundData.documents.map((doc) => ({
        id: doc.id,
        name: doc.name,
        description: doc.description,
        packId: doc.packId
      }));
    }
    console.info(`${CCreator.ID} | Background registration complete: ${documents.length} documents registered.`);
    return [];
  }
  static async handleDropdownChange(type, html) {
    const dropdown = html.querySelector(`#${type}-dropdown`);

    if (dropdown) {
      dropdown.addEventListener('change', (event) => {
        const selectedVal = event.target.value;

        // Access document data from CCreator[type]
        const selectedDoc = CCreator[type].documents.find((doc) => doc.id === selectedVal);
        console.log(`${CCreator.ID} selectedDoc | `, selectedDoc);

        if (selectedDoc) {
          const packId = selectedDoc.packId;
          const docId = selectedDoc.id;

          console.log(`${CCreator.ID} packId | `, packId);
          console.log(`${CCreator.ID} docId | `, docId);

          const compendium = game.packs.get(packId);
          console.log(`${CCreator.ID} compendium | `, compendium);

          if (compendium) {
            compendium
              .getDocument(docId)
              .then((doc) => {
                console.log(`${CCreator.ID} doc | `, doc);
                console.log(`${CCreator.ID} doc.system | `, doc.system);
                console.log(`${CCreator.ID} doc.system.description | `, doc.system.description);

                const descriptionHtml = doc.system.description?.value || 'No description available.';
                console.log(`${CCreator.ID} descriptionHtml | `, descriptionHtml);

                // Remove any existing description and <hr>
                const existingHr = html.querySelector(`#${type}-dropdown + hr`);
                const existingDescription = html.querySelector(`#${type}-dropdown + .${CCreator.ABRV}-creator-description`);
                if (existingHr) existingHr.remove();
                if (existingDescription) existingDescription.remove();

                // Append the <hr> and description HTML after the dropdown
                //dropdown.insertAdjacentHTML('afterend', `<hr><div class="${CCreator.ABRV}-creator-description">${descriptionHtml}</div>`);
                dropdown.insertAdjacentHTML('afterend', `<hr />${descriptionHtml}`);
              })
              .catch((error) => {
                console.error(`${CCreator.ID} handleDropdownChange | Error Fetching Document: `, error);
              });
          }
        }
      });
    }
  }
}
