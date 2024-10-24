import { HM } from '../module.js';

export async function handleDropdownChange(type, html) {
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
