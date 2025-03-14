import { HM, SummaryManager } from './index.js';

const { DialogV2 } = foundry.applications.api;

/**
 * Handles ability score rolling functionality for character creation
 * @class
 */
export class StatRoller {
  /* -------------------------------------------- */
  /*  Static Properties                           */
  /* -------------------------------------------- */

  static chainRollEnabled = false;

  static isRolling = false;

  /* -------------------------------------------- */
  /*  Static Public Methods                       */
  /* -------------------------------------------- */

  /**
   * Initiates the stat rolling process
   * @param {HTMLElement} form - The form containing the ability score input
   * @returns {Promise<void>}
   * @throws {Error} If form validation fails or rolling encounters an error
   * @static
   */
  static async rollAbilityScore(form) {
    if (this.isRolling) {
      HM.log(2, 'Rolling already in progress, please wait');
      return;
    }

    try {
      const rollFormula = await this.getAbilityScoreRollFormula();
      const chainedRolls = await game.settings.get(HM.CONFIG.ID, 'chainedRolls');
      const index = form.getAttribute('data-index');
      const input = this.getAbilityInput(index);
      const hasExistingValue = !this.chainRollEnabled && input?.value?.trim() !== '';

      if (hasExistingValue) {
        await this.#promptForAbilityScoreReroll(rollFormula, chainedRolls, index, input);
      } else if (chainedRolls) {
        await this.rollAllStats(rollFormula);
      } else {
        await this.rollSingleAbilityScore(rollFormula, index, input);
      }
    } catch (error) {
      HM.log(1, 'Error while rolling stat:', error);
      ui.notifications.error('hm.errors.roll-failed', { localize: true });
      this.isRolling = false;
    }
  }

  /**
   * Gets the roll formula from settings or sets default
   * @returns {Promise<string>} The roll formula to use
   * @static
   */
  static async getAbilityScoreRollFormula() {
    let formula = game.settings.get(HM.CONFIG.ID, 'customRollFormula');
    if (!formula?.trim()) {
      formula = '4d6kh3';
      await game.settings.set(HM.CONFIG.ID, 'customRollFormula', formula);
      HM.log(2, 'Roll formula was empty. Resetting to default:', formula);
    }
    return formula;
  }

  /**
   * Gets the ability score input element
   * @param {string} index - The ability block index
   * @returns {HTMLElement|null} The input element or null if not found
   * @static
   */
  static getAbilityInput(index) {
    const block = document.getElementById(`ability-block-${index}`);
    return block?.querySelector('.ability-score');
  }

  /**
   * Checks if any ability scores have existing values
   * @returns {boolean} True if any ability scores have values
   * @static
   */
  static hasExistingValues() {
    return Array.from(document.querySelectorAll('.ability-score')).some((input) => input.value?.trim() !== '');
  }

  /**
   * Performs a single ability score roll
   * @param {string} rollFormula - The formula to use for rolling
   * @param {string} index - The ability block index
   * @param {HTMLElement} input - The ability score input element
   * @returns {Promise<void>}
   * @static
   */
  static async rollSingleAbilityScore(rollFormula, index, input) {
    try {
      const roll = new Roll(rollFormula);
      await roll.evaluate();
      HM.log(3, 'Roll result:', roll.total);

      if (input) {
        input.value = roll.total;
        input.focus();
      } else {
        HM.log(2, `No input field found for ability index ${index}.`);
      }
      this.chainRollEnabled = false;
    } catch (error) {
      HM.log(1, `Failed to roll ${rollFormula}:`, error);
      ui.notifications.error('hm.errors.roll-failed', { localize: true });
    }
  }

  /**
   * Rolls all ability scores in sequence
   * @param {string} rollFormula - The formula to use for rolling
   * @returns {Promise<void>}
   * @static
   */
  static async rollAllStats(rollFormula) {
    const blocks = document.querySelectorAll('.ability-block');
    const delay = game.settings.get(HM.CONFIG.ID, 'rollDelay') || 500;
    this.isRolling = true;

    try {
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        try {
          const roll = new Roll(rollFormula);
          await roll.evaluate();

          const input = block.querySelector('.ability-score');
          if (input) {
            input.value = roll.total;
            input.focus();

            const diceIcon = block.querySelector('.fa-dice-d6');
            if (diceIcon) {
              diceIcon.classList.add('rolling');
              setTimeout(() => diceIcon.classList.remove('rolling'), delay - 100);
            }
          }

          if (i < blocks.length - 1) {
            await new Promise((resolve) => {
              setTimeout(resolve, delay);
            });
          }
        } catch (error) {
          HM.log(1, `Error rolling for ability ${i}:`, error);
          // Continue with the next ability
        }
      }
      SummaryManager.updateAbilitiesSummary();
    } catch (error) {
      HM.log(1, 'Error in chain rolling:', error);
      ui.notifications.error('hm.errors.roll-failed', { localize: true });
    } finally {
      this.isRolling = false;
      this.chainRollEnabled = false;
    }
  }

  /**
   * Gets the default standard array for ability scores
   * @returns {string} Comma-separated string of ability scores
   * @static
   */
  static getStandardArrayDefault() {
    const abilitiesCount = Object.keys(CONFIG.DND5E.abilities).length;
    const extraAbilities = Math.max(0, abilitiesCount - 6);
    return this.getStandardArray(extraAbilities).map(String).join(',');
  }

  /**
   * Validates and sets a custom standard array
   * @param {string} value - Comma-separated string of ability scores
   * @static
   */
  static validateAndSetCustomStandardArray(value) {
    const abilitiesCount = Object.keys(CONFIG.DND5E.abilities).length;

    if (!/^(\d+,)*\d+$/.test(value)) {
      ui.notifications.warn('hm.settings.custom-standard-array.invalid-format', { localize: true });
      return;
    }

    let scores = value.split(',').map(Number);
    if (scores.length < abilitiesCount) {
      scores = this.getStandardArrayDefault().split(',').map(Number);
      ui.notifications.info('hm.settings.custom-standard-array.reset-default', { localize: true });
    }

    game.settings.set(HM.CONFIG.ID, 'customStandardArray', scores.sort((a, b) => b - a).join(','));
  }

  /**
   * Generates a standard array of ability scores
   * @param {number} extraAbilities - Number of additional abilities beyond the base six
   * @returns {number[]} Array of ability scores in descending order
   * @static
   */
  static getStandardArray(extraAbilities) {
    const scores = [15, 14, 13, 12, 10, 8, ...Array(extraAbilities).fill(11)];
    return scores.sort((a, b) => b - a);
  }

  /**
   * Calculates total points available for point buy
   * @returns {number} Total points available
   * @static
   */
  static getTotalPoints() {
    const customTotal = game.settings.get(HM.CONFIG.ID, 'customPointBuyTotal');
    const abilitiesCount = Object.keys(CONFIG.DND5E.abilities).length;
    const extraPoints = Math.max(0, abilitiesCount - 6) * 3;
    const defaultTotal = 27 + extraPoints;

    // Only use customTotal if it's greater than 0 (indicating it was set)
    // and different from the default calculation
    if (customTotal > 0 && customTotal !== defaultTotal) {
      return customTotal;
    }

    return defaultTotal;
  }

  /**
   * Gets the point cost for a given ability score
   * @param {number} score - The ability score (8-15)
   * @returns {number} Point cost for the score
   * @static
   */
  static getPointBuyCostForScore(score) {
    const costs = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
    return costs[score] ?? 0;
  }

  /**
   * Calculates total points spent on ability scores
   * @param {number[]} scores - Array of selected ability scores
   * @returns {number} Total points spent
   * @static
   */
  static calculateTotalPointsSpent(scores) {
    return scores.reduce((total, score) => total + this.getPointBuyCostForScore(score), 0);
  }

  /* -------------------------------------------- */
  /*  Static Private Methods                      */
  /* -------------------------------------------- */

  /**
   * Shows the reroll confirmation dialog
   * @param {string} rollFormula - The formula to use for rolling
   * @param {boolean} chainedRolls - Whether chained rolls are enabled
   * @param {string} index - The ability block index
   * @param {HTMLElement} input - The ability score input element
   * @returns {Promise<void>}
   * @private
   * @static
   */
  static async #promptForAbilityScoreReroll(rollFormula, chainedRolls, index, input) {
    const dialog = new DialogV2({
      window: {
        title: game.i18n.localize('hm.dialogs.reroll.title'),
        icon: 'fas fa-dice-d6'
      },
      content: this.#getRerollDialogContent(),
      classes: ['hm-reroll-dialog'],
      buttons: this.#getRerollDialogButtons(rollFormula, chainedRolls, index, input),
      rejectClose: false,
      modal: true,
      position: { width: 400 }
    });

    dialog.render(true);
  }

  /**
   * Gets the content for the reroll dialog
   * @returns {string} The HTML content for the dialog
   * @private
   * @static
   */
  static #getRerollDialogContent() {
    // Only show the chain roll checkbox if chain rolls are enabled in settings
    const chainedRolls = game.settings.get(HM.CONFIG.ID, 'chainedRolls');
    const chainRollCheckbox =
      chainedRolls ?
        `
    <div class="form-group">
      <label class="checkbox">
        <input type="checkbox" name="chainRoll" ${this.chainRollEnabled ? 'checked' : ''}>
        ${game.i18n.localize('hm.dialogs.reroll.chain-roll-label')}
      </label>
    </div>
  `
      : '';

    return `
    <form class="dialog-form">
      <p>${game.i18n.localize('hm.dialogs.reroll.content')}</p>
      ${chainRollCheckbox}
    </form>
  `;
  }

  /**
   * Gets the button configuration for the reroll dialog
   * @param {string} rollFormula - The formula to use for rolling
   * @param {boolean} chainedRolls - Whether chained rolls are enabled
   * @param {string} index - The ability block index
   * @param {HTMLElement} input - The ability score input element
   * @returns {object[]} The button configurations
   * @private
   * @static
   */
  static #getRerollDialogButtons(rollFormula, chainedRolls, index, input) {
    return [
      {
        action: 'confirm',
        label: game.i18n.localize('hm.dialogs.reroll.confirm'),
        icon: 'fas fa-check',
        default: true,
        async callback(event, button, dialog) {
          const chainRollCheckbox = button.form.elements.chainRoll;
          StatRoller.chainRollEnabled = chainRollCheckbox?.checked ?? false;

          dialog.close();

          if (StatRoller.chainRollEnabled && chainedRolls) {
            await StatRoller.rollAllStats(rollFormula);
          } else {
            await StatRoller.rollSingleAbilityScore(rollFormula, index, input);
          }
        }
      },
      {
        action: 'cancel',
        label: game.i18n.localize('hm.dialogs.reroll.cancel'),
        icon: 'fas fa-times'
      }
    ];
  }
}
