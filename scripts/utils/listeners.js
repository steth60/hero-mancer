import { HM } from '../hero-mancer.js';
import * as HMUtils from './index.js';
import { HeroMancer } from '../app/HeroMancer.js';

/**
 * Handles ability selection changes, including Point Buy calculations if enabled.
 *
 * @param {Event} event The change event triggered by the dropdown.
 * @param {NodeList} abilityDropdowns List of all ability dropdowns.
 * @param {Set} selectedAbilities Set of currently selected ability values.
 */
export function handleAbilitySelectionChange(event, abilityDropdowns, selectedAbilities) {
  const dropdown = event.target;
  const selectedValue = dropdown.value;
  const previousValue = dropdown.getAttribute('data-previous-value'); // Retrieve the previous value
  const diceRollMethod = game.settings.get(HM.ID, 'diceRollingMethod');

  HM.log(3, 'New selectedValue:', selectedValue);
  HM.log(3, 'PreviousValue:', previousValue);

  // Handle removal of the previously selected ability
  if (previousValue && selectedAbilities.has(previousValue)) {
    selectedAbilities.delete(previousValue);
    HM.log(3, 'Removed previousValue from selectedAbilities:', previousValue);
  }

  // Add the new selected ability to the set (unless it's "N/A" or empty)
  if (selectedValue) {
    selectedAbilities.add(selectedValue);
    HM.log(3, 'Added selectedValue to selectedAbilities:', selectedValue);
  }

  // Update the dropdown's previous value
  dropdown.setAttribute('data-previous-value', selectedValue);
  HM.log(3, 'Updated previousValue to:', selectedValue);

  // Update dropdown options to disable already-selected abilities
  HMUtils.updateAbilityDropdowns(abilityDropdowns, selectedAbilities);

  // Point Buy-specific logic
  if (diceRollMethod === 'pointBuy') {
    // Get current selections as an array of numeric values
    const selectedScores = Array.from(selectedAbilities, Number);

    // Calculate points spent and remaining points for Point Buy
    const pointsSpent = HMUtils.calculatePointsSpent(selectedScores);
    const totalPoints = HMUtils.getTotalPoints();
    const remainingPoints = totalPoints - pointsSpent;

    // Update the UI to display remaining points
    HMUtils.updateRemainingPointsDisplay(remainingPoints);
  }
}

/**
 * Registers ability selection change listeners.
 *
 * @param {HTMLElement} element The parent element containing the ability dropdowns.
 */
export function addAbilitySelectionListeners(element) {
  const abilityDropdowns = element.querySelectorAll('.ability-dropdown');
  const selectedAbilities = new Set();

  // Iterate over each dropdown and attach change listeners
  abilityDropdowns.forEach((dropdown, index) => {
    const previousValue = dropdown.value;
    dropdown.setAttribute('data-previous-value', previousValue); // Store the previous value in a data attribute

    HM.log(3, `Initial previousValue for dropdown ${index}:`, previousValue);

    // Attach the event listener and pass the handler
    dropdown.addEventListener('change', (event) =>
      handleAbilitySelectionChange(event, abilityDropdowns, selectedAbilities)
    );
  });
}

/**
 * Updates the display of remaining points.
 * @param {number} remainingPoints The calculated remaining points after each selection.
 */
export function updateRemainingPointsDisplay(remainingPoints) {
  // Check if the Abilities tab is currently active
  const abilitiesTab = document.querySelector(".tab[data-tab='abilities']");
  if (!abilitiesTab || !abilitiesTab.classList.contains('active')) return;

  // Get the remaining points element in the DOM
  const remainingPointsElement = document.getElementById('remaining-points');
  const totalPoints = HMUtils.getTotalPoints();

  if (remainingPointsElement) {
    remainingPointsElement.textContent = remainingPoints;
    updatePointsColor(remainingPoints, totalPoints);
  } else {
    console.warn('Remaining points element not found in the DOM.');
  }
}

/**
 * Adds event listeners to Point Buy ability dropdowns, updating remaining points dynamically.
 *
 * @param {NodeList} abilityDropdowns List of all ability dropdown elements.
 * @param {Array | Set} selectedAbilities The currently selected ability values.
 */
export function addPointBuyAbilityListeners(abilityDropdowns, selectedAbilities) {
  abilityDropdowns.forEach((dropdown, index) => {
    dropdown.addEventListener('change', (event) => {
      const newValue = parseInt(event.target.value, 10) || 8;
      selectedAbilities[index] = newValue;

      // Update remaining points based on the current selections
      const remainingPoints = HMUtils.updateRemainingPointsDisplay(selectedAbilities);
      HM.log(3, `Remaining points after change: ${remainingPoints}`);
    });
  });
}

export function updatePointsColor(remainingPoints, totalPoints) {
  const element = document.getElementById('remaining-points');
  if (!element) return;

  const percentage = (remainingPoints / totalPoints) * 100;

  // Define color stops for gradient effect
  let color;
  if (percentage > 75) {
    color = '#4caf50'; // Green
  } else if (percentage > 50) {
    color = '#ffeb3b'; // Yellow
  } else if (percentage > 25) {
    color = '#ff9800'; // Orange
  } else {
    color = '#f44336'; // Red
  }

  element.style.color = color;
}

export function adjustScore(index, change) {
  const abilityScoreElement = document.getElementById(`ability-score-${index}`);
  const currentScore = parseInt(abilityScoreElement.textContent, 10);
  const newScore = Math.min(15, Math.max(8, currentScore + change));

  // Get total points and selected abilities
  const totalPoints = HMUtils.getTotalPoints();
  const pointsSpent = HMUtils.calculatePointsSpent(HeroMancer.selectedAbilities);

  // Check if increasing the score would exceed remaining points
  if (change > 0 && pointsSpent + HMUtils.getPointCost(newScore) - HMUtils.getPointCost(currentScore) > totalPoints) {
    console.log('Not enough points remaining to increase this score.');
    return;
  }

  // Update score if it's a valid change
  if (newScore !== currentScore) {
    abilityScoreElement.textContent = newScore;
    HeroMancer.selectedAbilities[index] = newScore;

    // Update points spent and remaining points
    const updatedPointsSpent = HMUtils.calculatePointsSpent(HeroMancer.selectedAbilities);
    const remainingPoints = totalPoints - updatedPointsSpent;

    // Update UI display for remaining points and button states
    HMUtils.updateRemainingPointsDisplay(remainingPoints);
    updatePlusButtonState(remainingPoints);
    updateMinusButtonState(); // Update the minus button state as well
  }
}

/**
 * Updates the state of the plus buttons to disable them if remaining points are insufficient.
 * @param {number} remainingPoints The number of points left for allocation.
 */
export function updatePlusButtonState(remainingPoints) {
  document.querySelectorAll('.plus-button').forEach((button, index) => {
    const currentScore = HeroMancer.selectedAbilities[index];
    const pointCostForNextIncrease = HMUtils.getPointCost(currentScore + 1) - HMUtils.getPointCost(currentScore);
    button.disabled = currentScore >= 15 || remainingPoints < pointCostForNextIncrease;
  });
}

/**
 * Updates the state of the minus buttons to disable them if the score is at the minimum allowed value.
 */
export function updateMinusButtonState() {
  document.querySelectorAll('.minus-button').forEach((button, index) => {
    const currentScore = HeroMancer.selectedAbilities[index];
    button.disabled = currentScore <= 8;
  });
}
