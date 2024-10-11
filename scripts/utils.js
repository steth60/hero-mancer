import { CCreator } from './module.js';

export class CCUtils {
  static async getDocuments(type) {
    if (typeof type !== 'string' || type.trim() === '') {
      throw new Error('Invalid argument: expected a non-empty string.');
    }

    const validPacks = new Set();
    const packs = game.packs.filter((i) => i.metadata.type === 'Item');

    for (const pack of packs) {
      try {
        const documents = await pack.getDocuments({ type: type });

        for (const doc of documents) {
          validPacks.add({
            doc,
            packName: pack.metadata.label, // Human-readable name of the compendium
            packId: pack.metadata.id // The compendium key like 'dnd5e.classes'
          });
        }
      } catch (error) {
        console.error(`Failed to retrieve documents from pack ${pack.metadata.label}:`, error);
      }
    }

    // Handle race-specific logic: always handle folders for races
    if (type === 'race') {
      const uniqueFolders = new Map();

      [...validPacks].forEach(({ doc, packName, packId }) => {
        const folder = doc.folder;
        const folderName = folder ? folder.name : null;

        if (folderName) {
          if (!uniqueFolders.has(folderName)) {
            uniqueFolders.set(folderName, { folderName, docs: [], packName, packId });
          }
          uniqueFolders.get(folderName).docs.push({
            id: doc.id,
            name: doc.name,
            packName,
            packId // Store the pack ID (compendium key) as well
          });
        }
      });

      // Sort uniqueFolders alphabetically by folder name
      const sortedUniqueFolders = Array.from(uniqueFolders.values()).sort((a, b) => a.folderName.localeCompare(b.folderName));

      return {
        uniqueFolders: sortedUniqueFolders, // Sorted folder array
        documents: [] // Empty for race (only folders are handled)
      };
    } else {
      // Handle class/background logic: no folders
      const sortedPackDocs = [...validPacks]
        .map(({ doc, packName, packId }) => ({
          id: doc.id,
          name: doc.name,
          folderName: null,
          packName,
          packId // Include pack ID (compendium key)
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return {
        documents: sortedPackDocs, // Sorted class/background docs
        uniqueFolders: [] // Empty for class/background
      };
    }
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
                dropdown.insertAdjacentHTML('afterend', `<hr><div class="${CCreator.ABRV}-creator-description">${descriptionHtml}</div>`);
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
