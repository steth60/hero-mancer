# Change Log

## Code Review: Phase 1

- Increase modularity in file structure and CSS class definition to improve readability, tracing, etc.
- Remove all nasty CSS hacks (no more !important here).
- Make several changes to CSS to support light mode, change font-sizes to use Foundry's built-in variables so text
  scaling works as intended.
- Changed logging setup for flexibility of info, warn, error, verbosity. Default: Warnings & Errors.
