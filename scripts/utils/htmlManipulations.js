import { HM } from '../hero-mancer.js';

/**
 * Registers the HeroMancer button in the Actors tab header.
 *
 * This function creates an accessible button that allows users to open the HeroMancer app directly from the Actors tab.
 * The button is inserted before the "create-folder" button in the header actionsand includes localization for the label
 * and hint. Accessibility features include `aria-label`, `aria-describedby`, and a visually hidden hint span
 * for screen readers.
 *
 * @function registerButton
 * @returns {void} No return value.
 */
export function registerButton() {
  // Locate the header actions section
  const headerActions = document.querySelector(
    'section[class*="actors-sidebar"] header[class*="directory-header"] div[class*="header-actions"]'
  );

  if (headerActions) {
    // Cache localized button text and hint
    const buttonHint = game.i18n.localize(`${HM.ABRV}.actortab-button.hint`);
    const buttonName = game.i18n.localize(`${HM.ABRV}.actortab-button.name`);

    // Create button with label, icon, and accessibility attributes
    const button = document.createElement('button');
    button.type = 'button';
    button.classList.add(`${HM.ABRV}-actortab-button`);
    button.setAttribute('title', buttonHint);
    button.setAttribute('aria-label', buttonName);
    button.setAttribute('aria-describedby', `${HM.ABRV}-button-hint`);
    button.setAttribute('role', 'button');
    button.innerHTML = `<i class="fa-solid fa-egg" style="color: #ff144f"></i> ${buttonName}`;

    // Insert the button before the 'create-folder' button in the header actions
    const createFolderButton = headerActions.querySelector('button[class*="create-folder"]');
    headerActions.insertBefore(button, createFolderButton);

    // Create a hidden span for screen readers and append it to header actions
    const hiddenHint = document.createElement('span');
    hiddenHint.id = `${HM.ABRV}-button-hint`;
    hiddenHint.classList.add('sr-only');
    hiddenHint.textContent = buttonHint;
    headerActions.appendChild(hiddenHint);

    // Add click event listener to render HeroMancer app
    button.addEventListener('click', () => {
      HM.heroMancer.render(true);
    });
  }
}
