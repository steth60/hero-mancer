import { HM } from '../module.js';

export function registerButton() {
  // Cache the DOM element in a variable
  const headerActions = $(
    'section[class*="actors-sidebar"] header[class*="directory-header"] div[class*="header-actions"]'
  );

  // Cache the localized button text and hint
  const buttonHint = game.i18n.localize(`${HM.ABRV}.actortab-button.hint`);
  const buttonName = game.i18n.localize(`${HM.ABRV}.actortab-button.name`);

  // Define the button HTML with improved accessibility
  const buttonHTML = `
    <button 
      type="button" 
      class="${HM.ABRV}-actortab-button" 
      title="${buttonHint}" 
      aria-label="${buttonName}" 
      aria-describedby="${HM.ABRV}-button-hint" 
      role="button"
    >
      <i class="fa-solid fa-egg" style="color: #ff144f"></i> ${buttonName}
    </button>
  `;

  // Insert the button before the 'create-folder' button
  headerActions.find('button[class*="create-folder"]').before(buttonHTML);

  // Append the hidden span for screen readers after the button
  const hiddenHintHTML = `<span id="${HM.ABRV}-button-hint" class="sr-only">${buttonHint}</span>`;
  headerActions.find(`.${HM.ABRV}-actortab-button`).after(hiddenHintHTML);
}
