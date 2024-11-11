import { HM } from '../hero-mancer.js';
import { Listeners, StatRoller } from './index.js';

export class DropdownHandler {
  // Static selectionStorage that is shared across the entire application
  static selectionStorage = {
    class: { selectedValue: '', selectedId: '' },
    race: { selectedValue: '', selectedId: '' },
    background: { selectedValue: '', selectedId: '' }
  };

  /**
   * Initializes a dropdown with a change event listener and handles description updates.
   * @param {object} config Configuration object for initializing dropdown
   * @param {string} config.type Type of dropdown (e.g., 'class', 'race', 'background')
   * @param {HTMLElement} config.html The HTML element containing the dropdown
   * @param {object} config.context Context object containing document data
   */
  static async initializeDropdown({ type, html, context }) {
    const dropdown = html.querySelector(`#${type}-dropdown`);

    if (!dropdown) {
      HM.log(1, `Dropdown for ${type} not found.`);
      return;
    }

    dropdown.addEventListener('change', async (event) => {
      const selectedValue = event.target.value;
      const selectedId = selectedValue.replace(/\s?\(.*?\)/, '');

      // Store the selected value and ID for the dropdown type
      this.selectionStorage[type] = { selectedValue, selectedId };

      const documentsKey = `${type}Docs`;
      const docs = context[documentsKey].flatMap((folder) => folder.docs || folder);
      const selectedDoc = docs.find((doc) => doc.id === selectedId);
      const descriptionElement = html.querySelector(`#${type}-description`);

      if (!context[documentsKey] || !Array.isArray(context[documentsKey])) {
        HM.log(1, `${HM.ID} | No documents found for type: ${type}`);
        return;
      }
      if (descriptionElement) {
        descriptionElement.innerHTML = selectedDoc?.enrichedDescription || game.i18n.localize(`${HM.ABRV}.app.no-description`);
      }
    });
  }

  /**
   * Updates dropdown options to disable selections based on the selected mode.
   * @param {NodeList} abilityDropdowns List of all ability dropdown elements.
   * @param {Array<number>} selectedAbilities Array of currently selected ability scores.
   * @param {number} totalPoints The total points allowed for Point Buy.
   * @param {string} mode The dice rolling method (e.g., 'pointBuy', 'manualFormula').
   */
  static updateAbilityDropdowns(abilityDropdowns, selectedAbilities, totalPoints, mode) {
    HM.log(3, 'Mode:', mode);
    HM.log(3, 'Selected Abilities:', selectedAbilities);
    HM.log(3, 'Total Points:', totalPoints);

    if (mode === 'pointBuy') {
      const pointsSpent = StatRoller.calculatePointsSpent(selectedAbilities);
      const remainingPoints = totalPoints - pointsSpent;

      HM.log(3, 'Points Spent:', pointsSpent);
      HM.log(3, 'Remaining Points:', remainingPoints);

      abilityDropdowns.forEach((dropdown, index) => {
        const currentValue = parseInt(dropdown.value, 10) || 8;
        HM.log(3, `Dropdown ${index} - Current Value:`, currentValue);

        dropdown.querySelectorAll('option').forEach((option) => {
          const optionValue = parseInt(option.value, 10);
          const optionCost = StatRoller.getPointCost(optionValue);
          const canAffordOption = optionCost <= remainingPoints + StatRoller.getPointCost(currentValue);

          HM.log(3, `Option Value: ${optionValue}, Option Cost: ${optionCost}, Can Afford: ${canAffordOption}`);
          option.disabled = !canAffordOption && optionValue !== currentValue;
        });
      });

      Listeners.updateRemainingPointsDisplay(remainingPoints);
    } else if (mode === 'manualFormula') {
      const selectedValues = new Set(selectedAbilities);

      abilityDropdowns.forEach((dropdown) => {
        const currentValue = dropdown.value;

        dropdown.querySelectorAll('option').forEach((option) => {
          const optionValue = option.value;
          option.disabled = selectedValues.has(optionValue) && optionValue !== currentValue;
        });
      });
    }
  }

  /**
   * Generates dropdown HTML from structured data.
   * @param {Array} items The grouped data for races, classes, or backgrounds.
   * @param {string} groupKey The key for group labeling (e.g., folderName, packName).
   * @returns {string} - The HTML string for the dropdown options.
   */
  static generateDropdownHTML(items, groupKey) {
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
}
