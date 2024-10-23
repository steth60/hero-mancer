# TODO

This file highlights areas that appear incomplete or could be improved based on the screenshots provided.

## 1. General UI Consistency

- **Text Alignment**: Ensure text and dropdowns are uniformly aligned across all tabs.
- **Color and Icon Usage**: Review icon sizes and the visual balance of text vs. icons for consistent styling (e.g.,
  tabs in the nav bar).

## 2. Start Tab

- **Placeholder Text**: The section contains "Lorem ipsum, etc. etc." placeholders. Replace these with actual
  descriptive text for each section.
- **Character Name Field**: The character name field should have clearer placeholder text. Instead of "Name your
  character!", consider "Enter your character's name."

## 3. Race Tab

- **Dropdown Placeholder**: The race dropdown has the placeholder "Pick your race!" followed by the actual race names.
  Ensure this placeholder disappears when a selection is made, or review if it's necessary.
- **Incomplete Descriptions**: The section also contains a placeholder for race descriptions ("Lorem ipsum, etc. etc.").

## 4. Class Tab

- **Dropdown Placeholder**: Similar to the race tab, the class dropdown shows the placeholder "Pick your class!" but
  keeps it once a class is selected. Consider removing this placeholder once a selection is made.
- **Class Advancement**: Ensure that advancement tables for each class are fully populated with data.
- **Text Styling**: Some text elements, such as "Hit Points" and "Sorcerer Advancement," seem a bit off-center or
  inconsistent in terms of font size compared to other elements.

## 5. Background Tab

- **Placeholder Text**: The background section contains "Lorem ipsum, etc. etc." placeholders in the descriptive areas.
  Replace these with proper background descriptions.
- **Dropdown and Descriptions**: Ensure the background dropdown and associated enriched descriptions are fully populated
  and functional.

## 6. Abilities Tab

- **Instructions**: Add brief instructions explaining how the user should interact with the dice rolling system. For
  example: "Click the dice icon to roll for each stat."
- **Stat Rolling**: Confirm that the stat rolling system (4d6kh3) is functioning correctly for each ability score.
- **Auto-Save Feature**: Implement an auto-save feature after each stat roll to avoid loss of data if the user navigates
  to another tab.

## 7. Equipment Tab

- **Placeholder Text**: Ensure the equipment section doesn’t have incomplete placeholder text like "Lorem ipsum, etc.
  etc."
- **Item Selection**: Provide more detailed item descriptions for selected equipment.

## 8. Finalization Tab

- **Instructions**: Add more detailed guidance on what happens once the character is finalized (e.g., "Review all
  selections before finalizing your character. Once finalized, your character will be ready for play.")
- **Form Validation**: Add form validation before the final submission to ensure all fields are filled out correctly.
- **Placeholder Text**: Placeholder text "This is the Finalize tab!" should be replaced with a description of what this
  tab does.

## 9. Additional Considerations

- **Accessibility**: Ensure that the module is fully keyboard navigable and that any pop-up messages or actions can be
  easily interacted with via keyboard shortcuts.
- **Localization Support**: Review localization to ensure that any hard-coded text is translatable.
- **Tooltips**: Consider adding tooltips for key buttons (e.g., "Submit" and "Cancel" buttons) to give users more
  context about what actions each button performs.
