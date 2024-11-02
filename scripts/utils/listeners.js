import * as HMUtils from './index.js';
import { HeroMancer } from '../app/HeroMancer.js';

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
 * Updates the color of the "remaining-points" element based on the percentage
 * of remaining points compared to total points, applying a gradient color effect.
 *
 * @param {number} remainingPoints The number of points currently remaining.
 * @param {number} totalPoints The total number of points available.
 * @returns {void} - Does not return a value; directly modifies the element's color style.
 */
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

/**
 * Adjusts the specified ability score by a given change value, ensuring it remains within the range 8–15.
 * This function also checks that point limits are not exceeded and updates the UI to reflect changes.
 * @param {number} index The index of the ability score to adjust.
 * @param {number} change The amount to change the score by (positive to increase, negative to decrease).
 * @returns {void} No return value; directly updates UI elements for ability score and remaining points.
 * @throws {Error} Logs a message to the console if there are insufficient points remaining to increase the score.
 */
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
