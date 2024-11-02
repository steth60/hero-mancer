# Change Log

## Code Review: Phase 1 (0.0.3)

- Increase modularity in file structure and CSS class definition to improve readability, tracing, etc.
- Remove all nasty CSS hacks (no more !important here).
- Make several changes to CSS to support light mode, change font-sizes to use Foundry's built-in variables so text
  scaling works as intended.
- Changed logging setup for flexibility of info, warn, error, verbosity. Default: Warnings & Errors.

## Code Review: Phase 2 (0.0.3)

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

## Code Review: Phase 2.1 (0.0.3)

- Tweak documents.js/registrations.js to simplify the document retrieval and building process.

## Code Review: Phase 2.2 (0.0.3)

- Organize module.json and en.json alphabetically because I'm a loser.
- Organize module.css files by set standard for easy organization of declarations.
- Minor comment/consistency cleanup in hero-mancer.js & documents.js.

## Minor Bug Fixes (0.0.4)

- Cleanup github workflow so files are in 1 places.
- Declare 4.0.X support (it worked once it must work forever?)
- Fix broken HMUtils calls in HeroMancer application and listeners utils.

## New Feature: Standard Array (0.1.0)

- Add standard array setting and functionality. Scales as per DMG rules for having more than 6 ability scores.
- Minor cleanup of discord workflow.
- Max height of application will not center it vertically.

## Feature Enhancement: Custom Standard Array (0.1.1)

- Allow GM to input a custom array, error handling to make sure it's as least as many numbers as there are valid ability
  scores.

## Bug Fixes & Clean-up (0.1.2)

- Fix bad reference in github workflow so module.json contains the correct information, and no longer points to previous
  module name.
- Fixed localization strings in Compendium picker settings application.
- Clean up and expanded on instructions on the abilities tab based on which roll method is enabled.
- Clarified that equipment and finalization tabs are not yet functional, same with point buy.

## New Feature: Point Buy (0.2.0)

- Added support for point buy, including if there are more than 6 abilities to choose from.
- Custom CSS to make sure -/+ buttons looks reasonable, please suggest improvements.
- Added a ton of new functions to allow pointbuy to work... I probably need to clean these up.
- Temporarily disabled Equipment and Finalization tabs since these are not being used. You can still submit the form and
  create a character.
- Updated workflow to point towards the correct module.json/module.zip

## Bug Fixes (0.2.1)

- Fixed some bad localization strings.
- Removed caching for dropdowns and HTML; this is potentially temporary but in the mean time fixes the issue with
  re-opening the application.
- Fixed console warning when user wasn't on the abilities tab.
- Miscellaneous tooltip fixes in footer and abilities tab.

## Bug Fixes & Refactor (0.2.2)

- Fixed long-standing bug with manual roll mode dropdowns.
- Refactors tabs to render content more accurately and fix dropdowns getting sticky. (future refactor may load data when
  clicking on a tab instead of when clicking on Hero Mancer button for improved streamlining.)

## Started: Equipment Selection! (0.3.0)

- First pass of implementing equipment selection, not yet ready for use.
- Clean up some unused code.
- Fix cache management.
- Repost with proper build info.

## Build fix (0.3.1)

- No new changes.
