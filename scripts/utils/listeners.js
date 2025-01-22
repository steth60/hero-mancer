import { StatRoller } from './index.js';
import { HeroMancer } from '../app/HeroMancer.js';
import { DropdownHandler } from './dropdownHandler.js';
import { EquipmentParser } from './equipmentParser.js';
import { HM } from '../hero-mancer.js';

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
  static initializeListeners(html, context, selectedAbilities) {
    this.initializeAbilityListeners(context, selectedAbilities);
    this.initializeEquipmentListeners();
    this.initializeCharacterListeners();
    this.initializeSummaryListeners();
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

    abilityDropdowns.forEach((dropdown, index) => {
      dropdown.addEventListener('change', (event) => {
        selectedValues[index] = event.target.value || '';
        DropdownHandler.updateAbilityDropdowns(abilityDropdowns, selectedValues, totalPoints, context.diceRollMethod === 'pointBuy' ? 'pointBuy' : 'manualFormula');
      });
    });

    this.updateRemainingPointsDisplay(context.remainingPoints);
    this.updatePlusButtonState(selectedAbilities, context.remainingPoints);
    this.updateMinusButtonState(selectedAbilities);
  }

  /**
   * Initializes equipment selection listeners and renders initial equipment choices
   */
  static initializeEquipmentListeners() {
    const equipmentContainer = document.querySelector('#equipment-container');
    const classDropdown = document.querySelector('#class-dropdown');
    const backgroundDropdown = document.querySelector('#background-dropdown');

    const equipment = new EquipmentParser(classDropdown?.value, backgroundDropdown?.value);

    if (equipmentContainer) {
      equipment
        .renderEquipmentChoices()
        .then((choices) => equipmentContainer.appendChild(choices))
        .catch((error) => HM.log(1, 'Error rendering equipment choices:', error));
    }

    classDropdown?.addEventListener('change', async (event) => {
      const selectedValue = event.target.value;
      HM.CONFIG.SELECT_STORAGE.class = {
        selectedValue,
        selectedId: selectedValue.split(' ')[0]
      };
      equipment.classId = HM.CONFIG.SELECT_STORAGE.class.selectedId;
      await this.updateEquipmentSection(equipment, equipmentContainer, 'class');
    });

    backgroundDropdown?.addEventListener('change', async (event) => {
      const selectedValue = event.target.value;
      HM.CONFIG.SELECT_STORAGE.background = {
        selectedValue,
        selectedId: selectedValue.split(' ')[0]
      };
      equipment.backgroundId = HM.CONFIG.SELECT_STORAGE.background.selectedId;
      await this.updateEquipmentSection(equipment, equipmentContainer, 'background');
      this.updateBackgroundSummary(event.target);
    });
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
      const updatedChoices = await equipment.renderEquipmentChoices(type);
      const sectionClass = `${type}-equipment-section`;
      const newSection = updatedChoices.querySelector(`.${sectionClass}`);
      const existingSection = container.querySelector(`.${sectionClass}`);

      if (existingSection) {
        existingSection.replaceWith(newSection);
      } else {
        container.appendChild(newSection);
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
    tokenArtCheckbox?.addEventListener('change', HeroMancer._toggleTokenArtRow);

    this.setupCharacterPortrait();
  }

  /**
   * Sets up character portrait updating functionality and initializes related listeners
   */
  static setupCharacterPortrait() {
    const updatePortrait = () => {
      const nameInput = document.querySelector('#character-name');
      const artInput = document.querySelector('#character-art-path');
      const portraitName = document.querySelector('.character-portrait h2');
      const portraitImg = document.querySelector('.character-portrait img');

      if (portraitName) {
        portraitName.textContent = nameInput?.value || game.user.name;
      }
      if (portraitImg && artInput) {
        portraitImg.src = artInput.value || '';
      }
    };

    const nameInput = document.querySelector('#character-name');
    const artInput = document.querySelector('#character-art-path');

    nameInput?.addEventListener('change', updatePortrait);
    artInput?.addEventListener('change', updatePortrait);
    updatePortrait();
  }

  /**
   * Initializes listeners for updating various summary sections
   */
  static initializeSummaryListeners() {
    const raceDropdown = document.querySelector('#race-dropdown');
    const classDropdown = document.querySelector('#class-dropdown');
    const equipmentContainer = document.querySelector('#equipment-container');

    raceDropdown?.addEventListener('change', () => this.updateClassRaceSummary());
    classDropdown?.addEventListener('change', () => this.updateClassRaceSummary());
    equipmentContainer?.addEventListener('change', () => this.updateEquipmentSummary());
  }

  /**
   * Updates the background summary text based on selected background
   * @param {HTMLSelectElement} backgroundSelect The background dropdown element
   */
  static updateBackgroundSummary(backgroundSelect) {
    const backgroundName = backgroundSelect.options[backgroundSelect.selectedIndex].text;
    const backgroundSummary = document.querySelector('.background-summary');
    if (backgroundSummary) {
      const article = /^[aeiou]/i.test(backgroundName) ? 'an' : 'a';
      backgroundSummary.textContent = `Starting as ${article} ${backgroundName}`;
    }
  }

  /**
   * Updates the class and race summary text
   */
  static updateClassRaceSummary() {
    const raceSelect = document.querySelector('#race-dropdown');
    const classSelect = document.querySelector('#class-dropdown');
    const summary = document.querySelector('.class-race-summary');

    if (summary && raceSelect && classSelect) {
      const raceName = raceSelect.options[raceSelect.selectedIndex].text;
      const className = classSelect.options[classSelect.selectedIndex].text;
      summary.innerHTML = `This <a href="#" data-tab="race">${raceName || 'unknown race'}</a> <a href="#" data-tab="class">${className || 'unknown class'}</a>`;
    }
  }

  /**
   * Updates the equipment summary text based on selected equipment
   */
  static updateEquipmentSummary() {
    const selectedEquipment = Array.from(document.querySelectorAll('#equipment-container select, #equipment-container input:checked'))
      .map((el) => el.options?.[el.selectedIndex]?.text || el.parentElement?.textContent?.trim())
      .filter(Boolean);

    const summary = document.querySelector('.equipment-summary');
    if (summary) {
      summary.textContent = selectedEquipment.length ? `They wield ${selectedEquipment.join(', ')} as their adventure begins` : 'They begin their adventure';
    }
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
      remainingPointsElement.textContent = remainingPoints;
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
    const currentScore = parseInt(abilityScoreElement.textContent, 10);
    const newScore = Math.min(15, Math.max(8, currentScore + change));

    const totalPoints = StatRoller.getTotalPoints();
    const pointsSpent = StatRoller.calculatePointsSpent(selectedAbilities);

    if (change > 0 && pointsSpent + StatRoller.getPointCost(newScore) - StatRoller.getPointCost(currentScore) > totalPoints) {
      HM.log(2, 'Not enough points remaining to increase this score.');
      return;
    }

    if (newScore !== currentScore) {
      abilityScoreElement.textContent = newScore;
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
}
