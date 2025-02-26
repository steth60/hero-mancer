import { HM } from '../hero-mancer.js';
import { CharacterArtPicker, DropdownHandler, EquipmentParser, HeroMancer, MandatoryFields, SavedOptions, StatRoller, SummaryManager } from './index.js';

/**
 * Manages event listeners and UI updates for the HeroMancer application.
 * Handles ability scores, equipment selection, character details, and UI summaries.
 * @class
 */
export class Listeners {
  /**
   * Initializes all listeners for the application
   * @param {HTMLElement} html The root element to attach listeners to
   * @param {object} context The application context
   * @param {number[]} selectedAbilities Array of selected ability scores
   */
  static async initializeListeners(html, context, selectedAbilities) {
    this.initializeAbilityListeners(context, selectedAbilities);
    this.initializeEquipmentListeners();
    this.initializeCharacterListeners();
    this.initializeRollMethodListener(html);
    this.initializeTokenCustomizationListeners();
    this.initializePlayerCustomizationListeners();
    this.restoreFormOptions(html);
  }

  /**
   * Initializes ability score related listeners and UI updates
   * @param {object} context The application context
   * @param {number[]} selectedAbilities Array of selected ability scores
   */
  static initializeAbilityListeners(context, selectedAbilities) {
    const abilityDropdowns = document.querySelectorAll('.ability-dropdown');
    const selectedValues = Array.from(abilityDropdowns).map(() => '');
    const totalPoints = StatRoller.getTotalPoints();
    const diceRollingMethod = game.settings.get(HM.CONFIG.ID, 'diceRollingMethod');

    abilityDropdowns.forEach((dropdown, index) => {
      dropdown.addEventListener('change', (event) => {
        if (diceRollingMethod === 'manualFormula') {
          const selectedValue = event.target.value;
          selectedValues[index] = selectedValue;
          const scoreInput = event.target.parentElement.querySelector('.ability-score');

          // Both dropdown and input should reference the selected ability
          event.target.setAttribute('name', `abilities[${selectedValue}]`);
          scoreInput.setAttribute('name', `abilities[${selectedValue}].score`);

          // Existing code for disabling options
          abilityDropdowns.forEach((otherDropdown, otherIndex) => {
            Array.from(otherDropdown.options).forEach((option) => {
              if (option.value && option.value !== '') {
                option.disabled = selectedValues.includes(option.value) && selectedValues[otherIndex] !== option.value;
              }
            });
          });
        } else {
          // Handle point buy/standard array cases
          selectedValues[index] = event.target.value || '';
          DropdownHandler.updateAbilityDropdowns(abilityDropdowns, selectedValues, totalPoints, diceRollingMethod === 'pointBuy' ? 'pointBuy' : 'manualFormula');
        }
      });
    });

    if (diceRollingMethod === 'pointBuy') {
      this.updateRemainingPointsDisplay(context.remainingPoints);
      this.updatePlusButtonState(selectedAbilities, context.remainingPoints);
      this.updateMinusButtonState(selectedAbilities);
    }
  }

  /**
   * Initializes equipment selection listeners and renders initial equipment choices
   */
  static initializeEquipmentListeners() {
    const equipmentContainer = document.querySelector('#equipment-container');
    const classDropdown = document.querySelector('#class-dropdown');
    const backgroundDropdown = document.querySelector('#background-dropdown');

    // Create a new instance for this render cycle
    const equipment = new EquipmentParser(classDropdown?.value, backgroundDropdown?.value);

    // First remove any existing listeners to prevent duplicates
    if (classDropdown?._equipmentChangeHandler) {
      classDropdown.removeEventListener('change', classDropdown._equipmentChangeHandler);
    }

    if (backgroundDropdown?._equipmentChangeHandler) {
      backgroundDropdown.removeEventListener('change', backgroundDropdown._equipmentChangeHandler);
    }

    if (equipmentContainer) {
      // Clear any existing content
      equipmentContainer.innerHTML = '';

      equipment
        .renderEquipmentChoices()
        .then((choices) => equipmentContainer.appendChild(choices))
        .catch((error) => HM.log(1, 'Error rendering equipment choices:', error));
    }

    // Create and store new handler functions
    if (classDropdown) {
      classDropdown._equipmentChangeHandler = async (event) => {
        const selectedValue = event.target.value;
        HM.CONFIG.SELECT_STORAGE.class = {
          selectedValue,
          selectedId: selectedValue.split(' ')[0]
        };

        // Create a new parser for this update
        const updateEquipment = new EquipmentParser(HM.CONFIG.SELECT_STORAGE.class.selectedId, HM.CONFIG.SELECT_STORAGE.background.selectedId);

        await this.updateEquipmentSection(updateEquipment, equipmentContainer, 'class');
      };

      classDropdown.addEventListener('change', classDropdown._equipmentChangeHandler);
    }

    if (backgroundDropdown) {
      backgroundDropdown._equipmentChangeHandler = async (event) => {
        const selectedValue = event.target.value;
        HM.CONFIG.SELECT_STORAGE.background = {
          selectedValue,
          selectedId: selectedValue.split(' ')[0]
        };

        // Create a new parser for this update
        const updateEquipment = new EquipmentParser(HM.CONFIG.SELECT_STORAGE.class.selectedId, HM.CONFIG.SELECT_STORAGE.background.selectedId);

        await this.updateEquipmentSection(updateEquipment, equipmentContainer, 'background');
        SummaryManager.updateBackgroundSummary(event.target);
        await SummaryManager.handleBackgroundChange(HM.CONFIG.SELECT_STORAGE.background);
      };

      backgroundDropdown.addEventListener('change', backgroundDropdown._equipmentChangeHandler);
    }
  }

  /**
   * Updates equipment section UI based on class or background changes
   * @param {EquipmentParser} equipment The equipment parser instance
   * @param {HTMLElement} container The container element for equipment choices
   * @param {'class'|'background'} type The type of equipment section to update
   * @returns {Promise<void>}
   */
  static async updateEquipmentSection(equipment, container, type) {
    try {
      // Reset rendered flags on all items before updating
      if (EquipmentParser.lookupItems) {
        Object.values(EquipmentParser.lookupItems).forEach((itemSet) => {
          itemSet.forEach((item) => {
            delete item.rendered;
            delete item.isSpecialCase;
            delete item.specialGrouping;
          });
        });
      }

      const updatedChoices = await equipment.renderEquipmentChoices(type);
      const sectionClass = `${type}-equipment-section`;
      const existingSection = container.querySelector(`.${sectionClass}`);

      if (existingSection) {
        existingSection.replaceWith(updatedChoices.querySelector(`.${sectionClass}`));
      } else {
        container.appendChild(updatedChoices.querySelector(`.${sectionClass}`));
      }
    } catch (error) {
      HM.log(1, `Error updating ${type} equipment choices:`, error);
    }
  }

  /**
   * Initializes character-related listeners including token art and portrait updates
   */
  static initializeCharacterListeners() {
    const tokenArtCheckbox = document.querySelector('#link-token-art');
    tokenArtCheckbox?.addEventListener('change', CharacterArtPicker._toggleTokenArtRow);
  }

  /**
   * Updates the display of remaining points in the abilities tab
   * @param {number} remainingPoints The number of points remaining to spend
   */
  static updateRemainingPointsDisplay(remainingPoints) {
    const abilitiesTab = document.querySelector(".tab[data-tab='abilities']");
    if (!abilitiesTab?.classList.contains('active')) return;

    const remainingPointsElement = document.getElementById('remaining-points');
    const totalPoints = StatRoller.getTotalPoints();

    if (remainingPointsElement) {
      remainingPointsElement.innerHTML = remainingPoints;
      this.#updatePointsColor(remainingPointsElement, remainingPoints, totalPoints);
    }
  }

  /**
   * Updates the color of the remaining points display based on percentage remaining
   * @param {HTMLElement} element The element to update
   * @param {number} remainingPoints Current remaining points
   * @param {number} totalPoints Total available points
   * @private
   */
  static #updatePointsColor(element, remainingPoints, totalPoints) {
    if (!element) return;

    const percentage = (remainingPoints / totalPoints) * 100;
    const hue = Math.max(0, Math.min(120, (percentage * 120) / 100));
    element.style.color = `hsl(${hue}, 100%, 35%)`;
  }

  /**
   * Adjusts ability score up or down within valid range and point limits
   * @param {number} index The index of the ability score to adjust
   * @param {number} change The amount to change the score by (positive or negative)
   * @param {number[]} selectedAbilities Array of current ability scores
   */
  static adjustScore(index, change, selectedAbilities) {
    if (!Array.isArray(selectedAbilities)) {
      HM.log(2, 'selectedAbilities must be an array');
      return;
    }
    const abilityScoreElement = document.getElementById(`ability-score-${index}`);
    const currentScore = parseInt(abilityScoreElement.innerHTML, 10);
    const newScore = Math.min(15, Math.max(8, currentScore + change));

    const totalPoints = StatRoller.getTotalPoints();
    const pointsSpent = StatRoller.calculatePointsSpent(selectedAbilities);

    if (change > 0 && pointsSpent + StatRoller.getPointCost(newScore) - StatRoller.getPointCost(currentScore) > totalPoints) {
      HM.log(2, 'Not enough points remaining to increase this score.');
      return;
    }

    if (newScore !== currentScore) {
      abilityScoreElement.innerHTML = newScore;
      selectedAbilities[index] = newScore;

      const updatedPointsSpent = StatRoller.calculatePointsSpent(selectedAbilities);
      const remainingPoints = totalPoints - updatedPointsSpent;

      this.updateRemainingPointsDisplay(remainingPoints);
      this.updatePlusButtonState(selectedAbilities, remainingPoints);
      this.updateMinusButtonState(selectedAbilities);
    }
  }

  /**
   * Updates the state of plus buttons based on available points and maximum scores
   * @param {number[]} selectedAbilities Array of current ability scores
   * @param {number} remainingPoints Points available to spend
   */
  static updatePlusButtonState(selectedAbilities, remainingPoints) {
    document.querySelectorAll('.plus-button').forEach((button, index) => {
      const currentScore = selectedAbilities[index];
      const pointCostForNextIncrease = StatRoller.getPointCost(currentScore + 1) - StatRoller.getPointCost(currentScore);

      button.disabled = currentScore >= 15 || remainingPoints < pointCostForNextIncrease;

      const inputElement = document.getElementById(`ability-${index}-input`);
      if (inputElement) {
        inputElement.value = currentScore;
      }
    });
  }

  /**
   * Updates the state of minus buttons based on minimum allowed scores
   * @param {number[]} selectedAbilities Array of current ability scores
   */
  static updateMinusButtonState(selectedAbilities) {
    document.querySelectorAll('.minus-button').forEach((button, index) => {
      const currentScore = selectedAbilities[index];
      button.disabled = currentScore <= 8;

      const inputElement = document.getElementById(`ability-${index}-input`);
      if (inputElement) {
        inputElement.value = currentScore;
      }
    });
  }

  static initializeRollMethodListener(html) {
    HM.log(3, 'Initializing roll method listener');
    if (!html) {
      HM.log(3, 'HTML element is undefined');
      return;
    }

    const rollSelect = document.getElementById('roll-method');
    if (!rollSelect) {
      HM.log(3, 'Roll method select element not found');
      return;
    }

    rollSelect.addEventListener('change', async (event) => {
      const method = event.target.value;
      HM.log(3, `Roll method changed to: ${method}`);

      await game.settings.set(HM.CONFIG.ID, 'diceRollingMethod', method);
      HM.log(3, 'Updated diceRollingMethod setting');

      HeroMancer.selectedAbilities = Array(Object.keys(CONFIG.DND5E.abilities).length).fill(8);
      HM.log(3, 'Reset abilities array:', HeroMancer.selectedAbilities);

      this.initializeAbilityListeners(
        {
          remainingPoints: StatRoller.getTotalPoints()
        },
        HeroMancer.selectedAbilities
      );
      HM.log(3, 'Reinitialized ability listeners');

      const app = HM.heroMancer;
      if (app) {
        HM.log(3, 'Triggering re-render');
        app.render({ parts: ['abilities'] });
      } else {
        HM.log(3, 'App instance not found for re-render');
      }
    });
  }

  static initializeTokenCustomizationListeners() {
    const ringEnabled = document.querySelector('input[name="ring.enabled"]');
    const ringOptions = document.querySelectorAll(
      ['.customization-row:has(color-picker[name="ring.color"])', '.customization-row:has(color-picker[name="backgroundColor"])', '.customization-row.ring-effects'].join(', ')
    );

    if (!ringEnabled || !ringOptions.length) {
      HM.log(2, 'Token customization elements not found');
      return;
    }

    // Initial state
    HM.log(3, 'Setting initial token ring states');
    ringOptions.forEach((option) => {
      option.style.display = ringEnabled.checked ? 'flex' : 'none';
    });

    // Reset and toggle on change
    ringEnabled.addEventListener('change', (event) => {
      HM.log(3, 'Ring enabled changed:', event.currentTarget.checked);

      if (!event.currentTarget.checked) {
        // Reset color pickers
        document.querySelectorAll('color-picker[name="ring.color"], color-picker[name="backgroundColor"]').forEach((picker) => {
          picker.value = '';
          picker.dispatchEvent(new Event('change', { bubbles: true }));
        });

        // Reset ring effect checkboxes
        document.querySelectorAll('input[name="ring.effects"]').forEach((checkbox) => {
          checkbox.checked = false;
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        });
      }

      // Toggle visibility
      ringOptions.forEach((option) => {
        option.style.display = event.currentTarget.checked ? 'flex' : 'none';
      });
    });
  }

  static initializePlayerCustomizationListeners() {
    const colorInput = document.querySelector('color-picker[name="player-color"]');
    if (!colorInput) return;

    colorInput.addEventListener('change', (e) => {
      const newColor = e.currentTarget.value || '#000000';

      game.user.update({
        color: newColor
      });

      const colorElements = document.querySelectorAll('.hm-player-color');
      colorElements.forEach((el) => {
        el.style.color = newColor;
      });
    });
  }

  static async restoreFormOptions(html) {
    const savedOptions = await SavedOptions.loadOptions();
    if (Object.keys(savedOptions).length === 0) return;

    for (const [key, value] of Object.entries(savedOptions)) {
      const elem = html.querySelector(`[name="${key}"]`);
      if (!elem) continue;

      if (elem.type === 'checkbox') {
        elem.checked = value;
      } else if (elem.tagName === 'SELECT') {
        elem.value = value;
      } else {
        elem.value = value;
      }
    }

    // Update summaries after restoring options
    requestAnimationFrame(() => {
      SummaryManager.updateClassRaceSummary();
    });
  }

  /**
   * Initialize form validation listeners for mandatory fields
   * @param {HTMLElement} html The root element containing form fields
   */
  static initializeFormValidationListeners(html) {
    // Add change listeners for all relevant input types
    const formElements = html.querySelectorAll('input, select, textarea, color-picker');
    formElements.forEach((element) => {
      // Remove previous listeners to avoid duplication
      if (element._mandatoryFieldChangeHandler) {
        element.removeEventListener('change', element._mandatoryFieldChangeHandler);
      }
      if (element._mandatoryFieldInputHandler) {
        element.removeEventListener('input', element._mandatoryFieldInputHandler);
      }

      // Create and store the handler references
      element._mandatoryFieldChangeHandler = async (event) => {
        HM.log(3, `Field changed: ${element.name || element.id}`, {
          type: element.type || element.tagName.toLowerCase(),
          value: element.value,
          checked: element.checked
        });
        await MandatoryFields.checkMandatoryFields(html);
      };

      element.addEventListener('change', element._mandatoryFieldChangeHandler);

      // Add input listener for real-time validation
      if (element.tagName.toLowerCase() === 'input' || element.tagName.toLowerCase() === 'textarea') {
        element._mandatoryFieldInputHandler = async (event) => {
          HM.log(3, `Field input: ${element.name || element.id}`, {
            type: element.type || element.tagName.toLowerCase(),
            value: element.value
          });
          await MandatoryFields.checkMandatoryFields(html);
        };
        element.addEventListener('input', element._mandatoryFieldInputHandler);
      }
    });

    // Handle ProseMirror elements separately
    const proseMirrorElements = html.querySelectorAll('prose-mirror');
    proseMirrorElements.forEach((element) => {
      // Clean up previous observer if exists
      if (element._observer) {
        element._observer.disconnect();
      }

      // Create handler for content changes
      const changeHandler = async () => {
        HM.log(3, `ProseMirror content changed: ${element.name || element.id}`);
        await MandatoryFields.checkMandatoryFields(html);
      };

      // Use MutationObserver to detect content changes
      element._observer = new MutationObserver(changeHandler);
      const editorContent = element.querySelector('.editor-content.ProseMirror');
      if (editorContent) {
        element._observer.observe(editorContent, {
          childList: true,
          characterData: true,
          subtree: true
        });
      }
    });
  }
}
