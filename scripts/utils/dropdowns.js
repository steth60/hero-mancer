import { HM } from '../hero-mancer.js';

/**
 * Initializes a dropdown with a change event listener and handles description updates.
 * @param {object} config Configuration object for initializing dropdown
 * @param {string} config.type Type of dropdown (e.g., 'class', 'race', 'background')
 * @param {HTMLElement} config.html The HTML element containing the dropdown
 * @param {object} config.context Context object containing document data
 * @param {Function} [config.customHandler] Optional custom handler for specific dropdown logic
 */
export async function initializeDropdown({ type, html, context, customHandler }) {
  const dropdown = html.querySelector(`#${type}-dropdown`);

  if (!dropdown) {
    HM.log(1, `Dropdown for ${type} not found.`);
    return;
  }

  dropdown.addEventListener('change', async (event) => {
    const selectedValue = event.target.value;
    const selectedId = selectedValue.replace(/\s?\(.*?\)/, '');

    if (customHandler) {
      customHandler(selectedId, html, context);
      return;
    }

    const documentsKey = `${type}Docs`;
    if (!context[documentsKey] || !Array.isArray(context[documentsKey])) {
      HM.log(1, `${HM.ID} | No documents found for type: ${type}`);
      return;
    }

    const docs = context[documentsKey].flatMap((folder) => folder.docs || folder);
    const selectedDoc = docs.find((doc) => doc.id === selectedId);

    const descriptionElement = html.querySelector(`#${type}-description`);
    if (descriptionElement) {
      descriptionElement.innerHTML =
        selectedDoc?.enrichedDescription || game.i18n.localize(`${HM.ABRV}.app.no-description`);
    }
  });
}

/**
 * Updates dropdown options to disable already-selected abilities.
 * @param {NodeList} abilityDropdowns List of all ability dropdowns.
 * @param {Set} selectedAbilities Set of currently selected ability values.
 */
export function updateAbilityDropdowns(abilityDropdowns, selectedAbilities) {
  abilityDropdowns.forEach((dropdown) => {
    const currentValue = dropdown.value;

    dropdown.querySelectorAll('option').forEach((option) => {
      option.disabled = selectedAbilities.has(option.value) && option.value !== currentValue;
    });
  });
}

/**
 * Generates dropdown HTML from structured data.
 * @param {Array} items The grouped data for races, classes, or backgrounds.
 * @param {string} groupKey The key for group labeling (e.g., folderName, packName).
 * @returns {string} - The HTML string for the dropdown options.
 */
export function generateDropdownHTML(items, groupKey) {
  let dropdownHtml = '';
  items.forEach((group) => {
    if (group.docs.length === 1 && !group[groupKey]) {
      dropdownHtml += `<option value="${group.docs[0].id}">${group.docs[0].name}</option>`;
    } else if (group.docs.length === 1) {
      dropdownHtml += `<option value="${group.docs[0].id}">${group.docs[0].name}</option>`;
    } else {
      dropdownHtml += `<optgroup label="${group[groupKey]}">`;
      group.docs.forEach((doc) => {
        dropdownHtml += `<option value="${doc.id}">${doc.name}</option>`;
      });
      dropdownHtml += '</optgroup>';
    }
  });
  return dropdownHtml;
}
