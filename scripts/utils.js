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
}
