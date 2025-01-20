import { StatRoller } from './index.js';
import { HeroMancer } from '../app/HeroMancer.js';

export class Listeners {
  /**
   * Updates the display of remaining points in the abilities tab.
   * @param {number} remainingPoints The calculated remaining points after each selection.
   */
  static updateRemainingPointsDisplay(remainingPoints) {
    const abilitiesTab = document.querySelector(".tab[data-tab='abilities']");
    if (!abilitiesTab || !abilitiesTab.classList.contains('active')) return;

    const remainingPointsElement = document.getElementById('remaining-points');
    const totalPoints = StatRoller.getTotalPoints();

    if (remainingPointsElement) {
      remainingPointsElement.textContent = remainingPoints;
      this.#updatePointsColor(remainingPoints, totalPoints);
    } else {
      console.warn('Remaining points element not found in the DOM.');
    }
  }

  /**
   * Private method to update the color of the "remaining-points" element based on the percentage
   * of remaining points compared to total points, applying a gradient color effect.
   * @param {number} remainingPoints The number of points currently remaining.
   * @param {number} totalPoints The total number of points available.
   */
  static #updatePointsColor(remainingPoints, totalPoints) {
    const element = document.getElementById('remaining-points');
    if (!element) return;

    const percentage = (remainingPoints / totalPoints) * 100;

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
   * Updates UI to reflect changes and ensures point limits are not exceeded.
   * @param {number} index The index of the ability score to adjust.
   * @param {number} change The amount to change the score by (positive to increase, negative to decrease).
   */
  static adjustScore(index, change) {
    const abilityScoreElement = document.getElementById(`ability-score-${index}`);
    const currentScore = parseInt(abilityScoreElement.textContent, 10);
    const newScore = Math.min(15, Math.max(8, currentScore + change));

    const totalPoints = StatRoller.getTotalPoints();
    const pointsSpent = StatRoller.calculatePointsSpent(HeroMancer.selectedAbilities);

    if (change > 0 && pointsSpent + StatRoller.getPointCost(newScore) - StatRoller.getPointCost(currentScore) > totalPoints) {
      HM.log(2, 'Not enough points remaining to increase this score.');
      return;
    }

    if (newScore !== currentScore) {
      abilityScoreElement.textContent = newScore;
      HeroMancer.selectedAbilities[index] = newScore;

      const updatedPointsSpent = StatRoller.calculatePointsSpent(HeroMancer.selectedAbilities);
      const remainingPoints = totalPoints - updatedPointsSpent;

      this.updateRemainingPointsDisplay(remainingPoints);
      this.updatePlusButtonState(remainingPoints);
      this.updateMinusButtonState();
    }
  }

  /**
   * Updates the state of the plus buttons to disable them if remaining points are insufficient.
   * Also updates the hidden input values for formData.
   * @param {number} remainingPoints The number of points left for allocation.
   */
  static updatePlusButtonState(remainingPoints) {
    document.querySelectorAll('.plus-button').forEach((button, index) => {
      const currentScore = HeroMancer.selectedAbilities[index];
      const pointCostForNextIncrease = StatRoller.getPointCost(currentScore + 1) - StatRoller.getPointCost(currentScore);

      // Update button state
      button.disabled = currentScore >= 15 || remainingPoints < pointCostForNextIncrease;

      // Update hidden input for formData
      const inputElement = document.getElementById(`ability-${index}-input`);
      if (inputElement) {
        inputElement.value = currentScore;
      }
    });
  }

  /**
   * Updates the state of the minus buttons to disable them if the score is at the minimum allowed value.
   * Also updates the hidden input values for formData.
   */
  static updateMinusButtonState() {
    document.querySelectorAll('.minus-button').forEach((button, index) => {
      const currentScore = HeroMancer.selectedAbilities[index];

      // Update button state
      button.disabled = currentScore <= 8;

      // Update hidden input for formData
      const inputElement = document.getElementById(`ability-${index}-input`);
      if (inputElement) {
        inputElement.value = currentScore;
      }
    });
  }
}
