import { HM } from '../module.js';

export function registerButton() {
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
