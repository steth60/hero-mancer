import { HM } from '../hero-mancer.js';

/**
 * Handles ability selection changes.
 *
 * @param {Event} event The change event triggered by the dropdown.
 * @param {NodeList} abilityDropdowns List of all ability dropdowns.
 * @param {Set} selectedAbilities Set of currently selected ability values.
 */
export function handleAbilitySelectionChange(event, abilityDropdowns, selectedAbilities) {
  const dropdown = event.target;
  const selectedValue = dropdown.value;
  const previousValue = dropdown.getAttribute('data-previous-value'); // Retrieve the previous value

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

  // Use the `updateAbilityDropdowns` function from dropdowns.js to update the state of the dropdowns
  updateAbilityDropdowns(abilityDropdowns, selectedAbilities);
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
