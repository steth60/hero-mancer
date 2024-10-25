# Change Log

## Code Review: Phase 1

- Increase modularity in file structure and CSS class definition to improve readability, tracing, etc.
- Remove all nasty CSS hacks (no more !important here).
- Make several changes to CSS to support light mode, change font-sizes to use Foundry's built-in variables so text
  scaling works as intended.
- Changed logging setup for flexibility of info, warn, error, verbosity. Default: Warnings & Errors.

## Code Review: Phase 2

- Refactor module.js (renamed to hero-mancer.js).
- Renamed module.css to hero-mancer.css to comply with FoundryVTT conventions.
- Refactor settings.js and sort various settings into registration functions, not needed currently but preps for future
  expansion. Also fix scope of compendiums to world, etc.
- Refactor CustomCompendiums.js to clean up logic, improve documentation and error handling.
- Refactor HeroMancer.js to clean up logic, made new listeners.js and cleaned up language.
- New setting to allow custom roll formula as long as it is valid dice notation it will work.
- Refactor rollStat logic into statRoller.js file to allow for cleaner code in HeroMancer.js.
- Add more error handling in documents.js.
- Refactor dropdowns.js to simplify logic and remove duplicate logic.
- Refactor htmlManipulations.js to remove jQuery, add comments so this makes sense to me a year from now.
- Add comments to index.js.
- Refactor registrations.js to reuse code, better error handling.
- Added missing JSDoc to all files as a practice for external APIs usage.
