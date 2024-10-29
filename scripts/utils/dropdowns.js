import { HM } from '../hero-mancer.js';
import * as HMUtils from './index.js';

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
 * Updates dropdown options to disable selections that would exceed the remaining points.
 * @param {NodeList} abilityDropdowns List of all ability dropdown elements.
 * @param {Array<number>} selectedAbilities Array of currently selected ability scores.
 * @param {number} totalPoints The total points allowed for Point Buy.
 */
export function updateAbilityDropdowns(abilityDropdowns, selectedAbilities, totalPoints) {
  const pointsSpent = HMUtils.calculatePointsSpent(selectedAbilities);
  const remainingPoints = totalPoints - pointsSpent;

  abilityDropdowns.forEach((dropdown, index) => {
    const currentValue = parseInt(dropdown.value, 10) || 8;

    dropdown.querySelectorAll('option').forEach((option) => {
      const optionValue = parseInt(option.value, 10);
      const optionCost = HMUtils.getPointCost(optionValue);
      const canAffordOption = optionCost <= remainingPoints + HMUtils.getPointCost(currentValue);

      option.disabled = !canAffordOption && optionValue !== currentValue;
    });
  });

  // Update remaining points display
  HMUtils.updateRemainingPointsDisplay(remainingPoints);
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
