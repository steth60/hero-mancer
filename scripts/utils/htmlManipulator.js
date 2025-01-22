import { HM } from '../hero-mancer.js';

/**
 * Handles DOM manipulation for the HeroMancer UI elements
 * @class
 */
export class HtmlManipulator {
  /** @type {HTMLButtonElement|null} Reference to the created button */
  static button = null;

  /**
   * Registers the HeroMancer button in the Actors tab header
   * @throws {Error} If required DOM elements are not found
   */
  static registerButton() {
    const headerActions = document.querySelector('section[class*="actors-sidebar"] header[class*="directory-header"] div[class*="header-actions"]');
    if (!headerActions) {
      throw new Error('Header actions element not found');
    }

    this.button = this.createButton();
    const createFolderButton = headerActions.querySelector('button[class*="create-folder"]');
    headerActions.insertBefore(this.button, createFolderButton);

    const hiddenHint = this.createHiddenHint();
    headerActions.appendChild(hiddenHint);

    this.addButtonListener();
  }

  /**
   * Creates the HeroMancer button element
   * @returns {HTMLButtonElement} The created button
   * @private
   */
  static createButton() {
    const buttonHint = game.i18n.localize(`${HM.CONFIG.ABRV}.actortab-button.hint`);
    const buttonName = game.i18n.localize(`${HM.CONFIG.ABRV}.actortab-button.name`);

    const button = document.createElement('button');
    button.type = 'button';
    button.classList.add(`${HM.CONFIG.ABRV}-actortab-button`);
    button.setAttribute('title', buttonHint);
    button.setAttribute('aria-label', buttonName);
    button.setAttribute('aria-describedby', `${HM.CONFIG.ABRV}-button-hint`);
    button.setAttribute('role', 'button');
    button.innerHTML = `<i class="fa-solid fa-egg" style="color: var(--user-color)"></i> ${buttonName}`;

    return button;
  }

  /**
   * Creates the hidden hint element for screen readers
   * @returns {HTMLSpanElement} The created hint element
   * @private
   */
  static createHiddenHint() {
    const buttonHint = game.i18n.localize(`${HM.CONFIG.ABRV}.actortab-button.hint`);
    const hiddenHint = document.createElement('span');
    hiddenHint.id = `${HM.CONFIG.ABRV}-button-hint`;
    hiddenHint.classList.add('sr-only');
    hiddenHint.textContent = buttonHint;
    return hiddenHint;
  }

  /**
   * Adds click event listener to the button
   * @private
   */
  static addButtonListener() {
    const clickHandler = () => HM.heroMancer.render(true);
    this.button?.addEventListener('click', clickHandler);

    // Store the handler for potential cleanup
    this.button.clickHandler = clickHandler;
  }
}
