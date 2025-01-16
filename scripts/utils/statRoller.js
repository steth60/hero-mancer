import { HM } from '../hero-mancer.js';

const { DialogV2 } = foundry.applications.api;

export class StatRoller {
  static chainRollEnabled = false;
  /**
   * Rolls stats based on a user-customizable formula.
   * Defaults to '4d6kh3' if the formula is invalid or empty.
   * Updates the input field of the specified ability block.
   * @param {HTMLElement} form The form where the dice icon was clicked.
   * @returns {Promise<void>}
   */

  static async roller(form) {
    try {
      let rollFormula = game.settings.get(HM.ID, 'customRollFormula');
      const chainedRolls = game.settings.get(HM.ID, 'chainedRolls');
      const index = form.getAttribute('data-index');
      const abilityBlock = document.getElementById(`ability-block-${index}`);
      const input = abilityBlock?.querySelector('.ability-score');

      if (!rollFormula || rollFormula.trim() === '') {
        rollFormula = '4d6kh3';
        await game.settings.set(HM.ID, 'customRollFormula', rollFormula);
        HM.log(3, 'Roll formula was empty. Resetting to default:', rollFormula);
      }

      // Check if any ability scores already have values
      const hasExistingValues = Array.from(document.querySelectorAll('.ability-score')).some((input) => input.value && input.value.trim() !== '');

      // If there are existing values, show confirmation dialog
      if (hasExistingValues) {
        const dialogContent = `
          <form class="dialog-form">
            <p>${game.i18n.localize(`${HM.ABRV}.dialogs.reroll.content`)}</p>
            <div class="form-group">
              <label class="checkbox">
                <input type="checkbox" name="chainRoll" ${StatRoller.chainRollEnabled ? 'checked' : ''}>
                ${game.i18n.localize(`${HM.ABRV}.dialogs.reroll.chain-roll-label`)}
              </label>
            </div>
          </form>
        `;

        new DialogV2({
          window: {
            title: game.i18n.localize(`${HM.ABRV}.dialogs.reroll.title`),
            icon: 'fas fa-dice-d6'
          },
          content: dialogContent,
          classes: ['hm-reroll-dialog'],
          buttons: [
            {
              action: 'confirm',
              label: game.i18n.localize(`${HM.ABRV}.dialogs.reroll.confirm`),
              icon: 'fas fa-check',
              default: true,
              async callback(event, button, dialog) {
                const chainRollCheckbox = button.form.elements.chainRoll;
                if (!chainRollCheckbox) {
                  HM.log(2, 'Chain roll checkbox not found in dialog');
                  StatRoller.chainRollEnabled = false;
                } else {
                  StatRoller.chainRollEnabled = chainRollCheckbox.checked;
                  HM.log(3, `Chain roll ${StatRoller.chainRollEnabled ? 'enabled' : 'disabled'}`);
                }
                dialog.close();
                if (StatRoller.chainRollEnabled && chainedRolls) {
                  await StatRoller.rollAllStats(rollFormula);
                } else {
                  await StatRoller.performSingleRoll(rollFormula, index, input);
                }
              }
            },
            {
              action: 'cancel',
              label: game.i18n.localize(`${HM.ABRV}.dialogs.reroll.cancel`),
              icon: 'fas fa-times'
            }
          ],
          rejectClose: false,
          modal: true,
          position: { width: 400 }
        }).render(true);
      } else {
        // First time rolling, check if chained rolls are enabled
        if (chainedRolls) {
          await StatRoller.rollAllStats(rollFormula);
          return;
        }

        await StatRoller.performSingleRoll(rollFormula, index, input);
      }
    } catch (error) {
      HM.log(3, 'Error while rolling stat:', error, 'error');
      StatRoller.isRolling = false;
    }
  }

  static async performSingleRoll(rollFormula, index, input) {
    const roll = new Roll(rollFormula);
    await roll.evaluate();
    HM.log(3, 'Roll result:', roll.total);

    if (input) {
      input.value = roll.total;
      input.focus();
      HM.log(3, `Updated input value for ability index ${index} with roll total:`, roll.total);
    } else {
      HM.log(3, `No input field found for ability index ${index}.`, 'error');
    }
  }

  static async rollAllStats(rollFormula) {
    const abilityBlocks = document.querySelectorAll('.ability-block');
    const delay = game.settings.get(HM.ID, 'rollDelay') || 500;
    StatRoller.isRolling = true;

    for (let i = 0; i < abilityBlocks.length; i++) {
      const block = abilityBlocks[i];
      const roll = new Roll(rollFormula);
      await roll.evaluate();

      const input = block.querySelector('.ability-score');
      if (input) {
        input.value = roll.total;
        input.focus();
        HM.log(3, `Updated input value for ability index ${i} with roll total:`, roll.total);

        // Add visual feedback for the current roll
        const diceIcon = block.querySelector('.fa-dice-d6');
        if (diceIcon) {
          diceIcon.classList.add('rolling');
          setTimeout(() => diceIcon.classList.remove('rolling'), delay - 100);
        }
      }

      // Wait for the specified delay before the next roll
      if (i < abilityBlocks.length - 1) {
        await new Promise((resolve) => {
          setTimeout(resolve, delay);
        });
      }
    }

    StatRoller.isRolling = false;
  }

  /**
   * Generates the default standard array for ability scores, adjusting for additional abilities if necessary.
   * Converts the array to a comma-separated string format for storage in settings.
   * @returns {string} - A comma-separated string representing the default standard array.
   */
  static getStandardArrayDefault() {
    const abilitiesCount = Object.keys(CONFIG.DND5E.abilities).length;
    const extraAbilities = abilitiesCount > 6 ? abilitiesCount - 6 : 0;
    return this.getStandardArray(extraAbilities).map(String).join(',');
  }

  /**
   * Validates and sets a custom standard array. Ensures the input format is correct, resets to default
   * if the provided array is too short, and sorts the array in descending order before saving it.
   * @param {string} value The custom standard array input as a comma-separated string.
   */
  static validateAndSetCustomStandardArray(value) {
    const abilitiesCount = Object.keys(CONFIG.DND5E.abilities).length;

    const isValid = /^(\d+,)*\d+$/.test(value);
    if (!isValid) {
      ui.notifications.warn(game.i18n.localize('hm.settings.custom-standard-array.invalid-format'));
      return;
    }

    let customArray = value.split(',').map(Number);

    if (customArray.length < abilitiesCount) {
      customArray = this.getStandardArrayDefault().split(',').map(Number);
      ui.notifications.info(game.i18n.localize('hm.settings.custom-standard-array.reset-default'));
    }

    customArray.sort((a, b) => b - a);
    game.settings.set(HM.ID, 'customStandardArray', customArray.join(','));
  }

  /**
   * Generates a standard array of ability scores for D&D 5E, adjusting for additional abilities
   * by appending '11' for each extra ability beyond the base six, and sorting in descending order.
   * @param {number} extraAbilities The count of extra abilities beyond the standard six.
   * @returns {number[]} - An array of ability scores in descending order.
   */
  static getStandardArray(extraAbilities) {
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
  static getTotalPoints() {
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
  static getPointCost(score) {
    const pointCosts = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
    return pointCosts[score] || 0;
  }

  /**
   * Calculate the total points spent based on the selected ability scores.
   * @param {number[]} selectedScores An array of ability scores selected by the user.
   * @returns {number} The total points spent based on selected scores.
   */
  static calculatePointsSpent(selectedScores) {
    return selectedScores.reduce((total, score) => total + this.getPointCost(score), 0);
  }
}
