import { HM } from '../hero-mancer.js';
/**
 * Rolls stats based on a user-customizable formula.
 * Defaults to '4d6kh3' if the formula is invalid or empty.
 * Updates the input field of the specified ability block.
 *
 * @param {HTMLElement} form The form where the dice icon was clicked.
 * @returns {Promise<void>}
 */
export async function statRoller(form) {
  try {
    // Retrieve the roll formula from settings or default to '4d6kh3'
    let rollFormula = game.settings.get(HM.ID, 'customRollFormula');

    // If the formula is blank or invalid, reset it to the default
    if (!rollFormula || rollFormula.trim() === '') {
      rollFormula = '4d6kh3';
      await game.settings.set(HM.ID, 'customRollFormula', rollFormula); // Reset the setting to the default
      HM.log(3, 'Roll formula was empty. Resetting to default:', rollFormula);
    }

    // Perform the roll using the formula
    const roll = new Roll(rollFormula);
    await roll.evaluate();
    HM.log(3, 'Roll result:', roll.total);

    // Get the data-index from the clicked dice icon
    const index = form.getAttribute('data-index');
    HM.log(3, 'Dice icon clicked for index:', index);

    // Use the index to find the correct ability block by ID
    const abilityBlock = document.getElementById(`ability-block-${index}`);

    if (abilityBlock) {
      // Find the input field within the ability block
      const input = abilityBlock.querySelector('.ability-score');
      if (input) {
        // Update the input field with the rolled value
        input.value = roll.total;
        input.focus(); // Optionally focus the input after updating
        HM.log(3, `Updated input value for ability index ${index} with roll total:`, roll.total);
      } else {
        HM.log(3, `No input field found within ability-block for index ${index}.`, 'error');
      }
    } else {
      HM.log(3, `No ability-block found for index ${index}.`, 'error');
    }
  } catch (error) {
    HM.log(3, 'Error while rolling stat:', error, 'error');
  }
}

/**
 * Generates the default standard array for ability scores, adjusting for additional abilities if necessary.
 * Converts the array to a comma-separated string format for storage in settings.
 * @returns {string} - A comma-separated string representing the default standard array.
 */
export function getStandardArrayDefault() {
  const abilitiesCount = Object.keys(CONFIG.DND5E.abilities).length;
  const extraAbilities = abilitiesCount > 6 ? abilitiesCount - 6 : 0;
  return getStandardArray(extraAbilities).map(String).join(',');
}

/**
 * Validates and sets a custom standard array. Ensures the input format is correct, resets to default
 * if the provided array is too short, and sorts the array in descending order before saving it.
 * @param {string} value The custom standard array input as a comma-separated string.
 * @returns {void}
 */
export function validateAndSetCustomStandardArray(value) {
  // Retrieve the required number of ability scores
  const abilitiesCount = Object.keys(CONFIG.DND5E.abilities).length;

  // Ensure the input is valid: only numbers and commas allowed
  const isValid = /^(\d+,)*\d+$/.test(value);
  if (!isValid) {
    ui.notifications.warn(game.i18n.localize(`${HM.ABRV}.settings.custom-standard-array.invalid-format`));
    return;
  }

  // Parse the string into an array of numbers
  let customArray = value.split(',').map(Number);

  // If the array has fewer than the required ability count, set to default
  if (customArray.length < abilitiesCount) {
    customArray = HMUtils.getStandardArrayDefault().split(',').map(Number);
    ui.notifications.info(game.i18n.localize(`${HM.ABRV}.settings.custom-standard-array.reset-default`));
  }

  // Sort the array in descending order
  customArray.sort((a, b) => b - a);

  // Set the validated and sorted array back to the setting as a string
  game.settings.set(HM.ID, 'customStandardArray', customArray.join(','));
}

/**
 * Generates a standard array of ability scores for D&D 5E, adjusting for additional abilities
 * by appending '11' for each extra ability beyond the base six, and sorting in descending order.
 * @param {number} extraAbilities The count of extra abilities beyond the standard six.
 * @returns {number[]} - An array of ability scores in descending order.
 */
export function getStandardArray(extraAbilities) {
  const baseArray = [15, 14, 13, 12, 10, 8];
  for (let i = 0; i < extraAbilities; i++) {
    baseArray.push(11);
  }
  return baseArray.sort((a, b) => b - a);
}

/**
 * Calculate the total points available for point buy, factoring in any extra abilities.
 * For each additional ability beyond the sixth, add 3 extra points.
 * @returns {number} The total points available for point buy.
 */
export function getTotalPoints() {
  const abilitiesCount = Object.keys(CONFIG.DND5E.abilities).length;
  const basePoints = 27;
  const extraPoints = abilitiesCount > 6 ? (abilitiesCount - 6) * 3 : 0;
  return basePoints + extraPoints;
}

/**
 * Retrieve the point cost associated with a given ability score.
 * @param {number} score The ability score to evaluate (8-15).
 * @returns {number} The point cost associated with the given score.
 */
export function getPointCost(score) {
  const pointCosts = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
  return pointCosts[score] || 0;
}

/**
 * Calculate the total points spent based on the selected ability scores.
 * @param {number[]} selectedScores An array of ability scores selected by the user.
 * @returns {number} The total points spent based on selected scores.
 */
export function calculatePointsSpent(selectedScores) {
  return selectedScores.reduce((total, score) => total + getPointCost(score), 0);
}

/**
 * Calculate and return remaining points based on the current dropdown selections.
 * @param {NodeList} abilityDropdowns List of dropdown elements for abilities.
 * @returns {number} The remaining points after calculating points spent.
 */
export function calculateRemainingPoints(abilityDropdowns) {
  const selectedScores = Array.from(abilityDropdowns).map((dropdown) => parseInt(dropdown.value, 10) || 8);
  const pointsSpent = HMUtils.calculatePointsSpent(selectedScores);
  const totalPoints = HMUtils.getTotalPoints();
  return totalPoints - pointsSpent;
}
