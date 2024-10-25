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
