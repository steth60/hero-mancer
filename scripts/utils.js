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
          validPacks.add({ doc, packName: pack.metadata.label });
        }
      } catch (error) {
        console.error(`Failed to retrieve documents from pack ${pack.metadata.label}:`, error);
      }
    }

    // Handle race-specific logic: always handle folders for races
    if (type === 'race') {
      const uniqueFolders = new Map();

      [...validPacks].forEach(({ doc, packName }) => {
        const folder = doc.folder;
        const folderName = folder ? folder.name : null;

        if (folderName) {
          if (!uniqueFolders.has(folderName)) {
            uniqueFolders.set(folderName, { folderName, docs: [], packName });
          }
          uniqueFolders.get(folderName).docs.push({
            id: doc.id,
            name: doc.name,
            packName
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
        .map(({ doc, packName }) => ({
          id: doc.id,
          name: doc.name,
          folderName: null,
          packName
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
    const subcatDropdownContainer = html.querySelector(`#${type}-subcat-dropdown-container`);

    if (dropdown) {
      dropdown.addEventListener('change', (event) => {
        const selectedVal = event.target.value;

        // Clear any previous confirmation or sub-dropdown
        subcatDropdownContainer.innerHTML = '';

        // Access race data directly from CCreator
        const selectedFolder = CCreator[type].uniqueFolders.find((folder) => `folder-${folder.folderName}` === selectedVal);

        if (selectedFolder && selectedFolder.docs.length > 1) {
          // Create a second dropdown for races inside the selected folder
          const subcatDropdown = document.createElement('select');
          subcatDropdown.id = `${type}-subcategory-dropdown`;
          subcatDropdown.className = `${CCreator.ABRV}-creator-dropdown ${type}`;

          const defaultOption = document.createElement('option');
          defaultOption.value = '';
          defaultOption.textContent = game.i18n.localize(`cc.creator.${type}.selectsubcategory`);
          subcatDropdown.appendChild(defaultOption);

          const sortedDocs = selectedFolder.docs.sort((a, b) => a.name.localeCompare(b.name));
          sortedDocs.forEach((doc) => {
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${doc.name} (${doc.packName})`;
            subcatDropdown.appendChild(option);
          });

          subcatDropdownContainer.appendChild(subcatDropdown);

          // Add event listener for subcategory dropdown
          subcatDropdown.addEventListener('change', (e) => {
            const selectedDoc = sortedDocs.find((doc) => doc.id === e.target.value);
            const confirmText = document.createElement('div');
            confirmText.className = `${CCreator.ABRV}-select-container`;
            confirmText.textContent = `Selected ${type}: ${selectedDoc.name}`;
            subcatDropdownContainer.appendChild(confirmText);
          });
        } else if (selectedFolder && selectedFolder.docs.length === 1) {
          // If only one race exists in the folder, display it directly
          const confirmText = document.createElement('div');
          confirmText.className = `${CCreator.ABRV}-select-container`;
          confirmText.textContent = `Selected ${type}: ${selectedFolder.docs[0].name}`;
          subcatDropdownContainer.appendChild(confirmText);
        } else {
          // For class and background, directly show confirmation
          const selectedDoc = CCreator[type].documents.find((doc) => doc.id === selectedVal);
          if (selectedDoc) {
            const confirmText = document.createElement('div');
            confirmText.className = `${CCreator.ABRV}-select-container`;
            confirmText.textContent = `Selected ${type}: ${selectedDoc.name}`;
            subcatDropdownContainer.appendChild(confirmText);
          }
        }
      });
    }
  }
}
