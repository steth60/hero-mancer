// Cache Management
export { CacheManager } from './cacheManagement.js';

// Document Handling
export { fetchDocuments, prepareDocuments } from './documents.js';

// Dropdown Handling
export { initializeDropdown, updateAbilityDropdowns, generateDropdownHTML } from './dropdowns.js';

// UI Manipulations
export { registerButton } from './htmlManipulations.js';
export {
  handleAbilitySelectionChange,
  addAbilitySelectionListeners,
  updateRemainingPointsDisplay,
  addPointBuyAbilityListeners,
  updatePointsColor,
  adjustScore,
  updatePlusButtonState,
  updateMinusButtonState
} from './listeners.js';

// Miscellaneous
export {
  statRoller,
  getStandardArrayDefault,
  validateAndSetCustomStandardArray,
  getStandardArray,
  getTotalPoints,
  getPointCost,
  calculatePointsSpent,
  calculateRemainingPoints
} from './statRoller.js';
