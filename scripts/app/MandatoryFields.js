import { HM } from '../utils/index.js';

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

export class MandatoryFields extends HandlebarsApplicationMixin(ApplicationV2) {
  /* -------------------------------------------- */
  /*  Static Properties                           */
  /* -------------------------------------------- */

  static DEFAULT_OPTIONS = {
    id: 'hero-mancer-settings-mandatory-fields',
    classes: ['hm-app'],
    tag: 'form',
    form: {
      handler: MandatoryFields.formHandler,
      closeOnSubmit: true,
      submitOnChange: false
    },
    position: {
      height: 'auto',
      width: '400'
    },
    window: {
      icon: 'fa-solid fa-list-check',
      resizable: false
    }
  };

  static PARTS = {
    form: {
      template: 'modules/hero-mancer/templates/settings/mandatory-fields.hbs',
      id: 'body',
      classes: ['hm-mandatory-fields-popup']
    },
    footer: {
      template: 'modules/hero-mancer/templates/settings/settings-footer.hbs',
      id: 'footer',
      classes: ['hm-mandatory-footer']
    }
  };

  /* -------------------------------------------- */
  /*  Getters                                     */
  /* -------------------------------------------- */

  get title() {
    return `${HM.CONFIG.TITLE} | ${game.i18n.localize('hm.settings.mandatory-fields.menu.name')}`;
  }

  /* -------------------------------------------- */
  /*  Protected Methods                           */
  /* -------------------------------------------- */

  /**
   * Prepares context data for the mandatory fields configuration
   * Loads current field settings and organizes them by category
   * @param {object} _options - Application render options
   * @returns {Promise<object>} Context data for template rendering
   * @protected
   * @override
   */
  async _prepareContext(_options) {
    // Get all valid form fields
    const fieldCategories = await this.getAllFormFields();

    // Get currently selected mandatory fields
    const mandatoryFields = game.settings.get(HM.CONFIG.ID, 'mandatoryFields') || [];

    HM.log(3, 'Loading mandatory fields:', mandatoryFields);

    // Process each category to add mandatory status
    const processedFields = {};
    for (const [category, fields] of Object.entries(fieldCategories)) {
      processedFields[category] = fields.map((field) => {
        // If there are saved mandatory fields, use those
        // Otherwise, use the default values
        const isInitialSetup = mandatoryFields.length === 0;
        return {
          key: field.key,
          label: field.label,
          mandatory: isInitialSetup ? field.default : mandatoryFields.includes(field.key)
        };
      });
    }

    HM.log(3, 'Processed fields:', processedFields);

    return {
      fields: processedFields,
      playerCustomizationEnabled: game.settings.get(HM.CONFIG.ID, 'enablePlayerCustomization'),
      tokenCustomizationEnabled: game.settings.get(HM.CONFIG.ID, 'enableTokenCustomization')
    };
  }

  /* -------------------------------------------- */
  /*  Public Methods                              */
  /* -------------------------------------------- */

  /**
   * Retrieves all configurable form fields organized by category
   * @returns {Promise<object>} Object containing categorized form fields
   */
  async getAllFormFields() {
    const abilityFields = Object.entries(CONFIG.DND5E.abilities).map(([key, ability]) => ({
      key: `abilities[${key}]`,
      label: game.i18n.format('DND5E.ABILITY.SECTIONS.Score', { ability: ability.label }),
      default: false
    }));

    return {
      basic: [
        { key: 'name', label: `${game.i18n.localize('hm.app.start.name-label')}`, default: true },
        { key: 'character-art', label: `${game.i18n.localize('hm.app.start.character-art-label')}`, default: false },
        { key: 'token-art', label: `${game.i18n.localize('hm.app.start.token-art-label')}`, default: false }
      ],
      player:
        game.settings.get(HM.CONFIG.ID, 'enablePlayerCustomization') ?
          [
            { key: 'player-color', label: `${game.i18n.localize('hm.app.start.player-color')}`, default: false },
            { key: 'player-pronouns', label: `${game.i18n.localize('hm.app.start.player-pronouns')}`, default: false },
            { key: 'player-avatar', label: `${game.i18n.localize('hm.app.start.player-avatar')}`, default: false }
          ]
        : [],
      token:
        game.settings.get(HM.CONFIG.ID, 'enableTokenCustomization') ?
          [
            { key: 'displayName', label: `${game.i18n.localize('TOKEN.CharShowNameplate')}`, default: false },
            { key: 'displayBars', label: `${game.i18n.localize('TOKEN.ResourceDisplay')}`, default: false },
            { key: 'bar1.attribute', label: `${game.i18n.localize('TOKEN.ResourceBar1A')}`, default: false },
            { key: 'bar2.attribute', label: `${game.i18n.localize('TOKEN.ResourceBar2A')}`, default: false },
            { key: 'ring.enabled', label: `${game.i18n.localize('TOKEN.FIELDS.ring.enabled.label')}`, default: false },
            { key: 'ring.color', label: `${game.i18n.localize('TOKEN.FIELDS.ring.colors.ring.label')}`, default: false },
            { key: 'backgroundColor', label: `${game.i18n.localize('DND5E.TokenRings.BackgroundColor')}`, default: false },
            { key: 'ring.effects', label: `${game.i18n.localize('TOKEN.FIELDS.ring.effects.label')}`, default: false }
          ]
        : [],
      core: [
        { key: 'background', label: `${game.i18n.localize('hm.app.background.select-label')}`, default: true },
        { key: 'race', label: `${game.i18n.localize('hm.app.race.select-label')}`, default: true },
        { key: 'class', label: `${game.i18n.localize('hm.app.class.select-label')}`, default: true }
      ],
      abilities: abilityFields,
      details: [
        { key: 'alignment', label: `${game.i18n.localize('DND5E.Alignment')}`, default: false },
        { key: 'faith', label: `${game.i18n.localize('DND5E.Faith')}`, default: false }
      ],
      physical: [
        { key: 'eyes', label: `${game.i18n.localize('DND5E.Eyes')}`, default: false },
        { key: 'hair', label: `${game.i18n.localize('DND5E.Hair')}`, default: false },
        { key: 'skin', label: `${game.i18n.localize('DND5E.Skin')}`, default: false },
        { key: 'height', label: `${game.i18n.localize('DND5E.Height')}`, default: false },
        { key: 'weight', label: `${game.i18n.localize('DND5E.Weight')}`, default: false },
        { key: 'age', label: `${game.i18n.localize('DND5E.Age')}`, default: false },
        { key: 'gender', label: `${game.i18n.localize('DND5E.Gender')}`, default: false },
        { key: 'appearance', label: `${game.i18n.localize('hm.app.finalize.physical-description')}`, default: false }
      ],
      personality: [
        { key: 'traits', label: `${game.i18n.localize('hm.app.finalize.personality-traits')}`, default: false },
        { key: 'ideals', label: `${game.i18n.localize('DND5E.Ideals')}`, default: false },
        { key: 'bonds', label: `${game.i18n.localize('DND5E.Bonds')}`, default: false },
        { key: 'flaws', label: `${game.i18n.localize('DND5E.Flaws')}`, default: false },
        { key: 'backstory', label: `${game.i18n.localize('hm.app.finalize.backstory')}`, default: false }
      ]
    };
  }

  /* -------------------------------------------- */
  /*  Static Public Methods                       */
  /* -------------------------------------------- */

  /**
   * Processes form submission for mandatory field settings
   * @param {Event} _event - The form submission event
   * @param {HTMLFormElement} form - The form element
   * @param {FormDataExtended} formData - The processed form data
   * @returns {Promise<void>}
   * @static
   */
  static async formHandler(_event, form, formData) {
    const requiresWorldReload = true; // Settings changes require world reload
    try {
      HM.log(3, 'Raw form data:', formData);

      // Get all checkboxes from the form
      const checkboxes = form.querySelectorAll('input[type="checkbox"]');
      const mandatoryFields = Array.from(checkboxes)
        .filter((checkbox) => checkbox.checked)
        .map((checkbox) => checkbox.name);

      HM.log(3, 'Selected mandatory fields:', mandatoryFields);

      // Save to settings
      await game.settings.set(HM.CONFIG.ID, 'mandatoryFields', mandatoryFields);

      this.constructor.reloadConfirm({ world: requiresWorldReload });

      ui.notifications.info('hm.settings.mandatory-fields.saved', { localize: true });
    } catch (error) {
      HM.log(1, 'Error in MandatoryFields formHandler:', error);
      ui.notifications.error('hm.settings.mandatory-fields.error-saving', { localize: true });
    }
  }

  /**
   * Validates the form against mandatory field requirements
   * Updates UI to indicate incomplete fields and controls submit button state
   * @param {HTMLElement} form - The form element to check
   * @returns {Promise<boolean>} True if all mandatory fields are valid
   * @static
   */
  static async checkMandatoryFields(form) {
    const mandatoryFields = game.settings.get(HM.CONFIG.ID, 'mandatoryFields') || [];
    const submitButton = form.querySelector('.hm-app-footer-submit');

    if (!submitButton || !mandatoryFields.length) return true;

    // Collect all DOM updates
    const mandatoryIndicatorUpdates = [];
    const fieldCompletionUpdates = [];

    // First pass: collect all field elements and mark as mandatory
    const fieldElements = new Map();
    mandatoryFields.forEach((field) => {
      const element = form.querySelector(`[name="${field}"]`);
      if (!element) return;

      fieldElements.set(field, element);

      // Add mandatory class if not already present
      if (!element.classList.contains('mandatory-field')) {
        mandatoryIndicatorUpdates.push(() => element.classList.add('mandatory-field'));
      }

      // Setup indicator on label
      if (field.startsWith('abilities[')) {
        const abilityBlock = element.closest('.ability-block');
        const label = abilityBlock?.querySelector('.ability-label') || abilityBlock?.querySelector('label');
        if (label) {
          mandatoryIndicatorUpdates.push(() => this.addIndicator(label, false));
        }
      } else {
        const label = this.findAssociatedLabel(element);
        if (label) {
          mandatoryIndicatorUpdates.push(() => this.addIndicator(label, false));
        }
      }
    });

    // Apply initial mandatory field marking
    if (mandatoryIndicatorUpdates.length > 0) {
      requestAnimationFrame(() => {
        mandatoryIndicatorUpdates.forEach((update) => update());
      });
    }

    // Second pass: check field completion status
    const missingFields = [];
    fieldElements.forEach((element, field) => {
      let isComplete = false;

      if (field.startsWith('abilities[')) {
        const abilityBlock = element.closest('.ability-block');
        isComplete = this.isAbilityFieldComplete(element, abilityBlock);

        const label = abilityBlock.querySelector('.ability-label') || abilityBlock.querySelector('label');
        if (label) {
          fieldCompletionUpdates.push(() => this.addIndicator(label, isComplete));
        }
      } else {
        isComplete = this.isFormFieldComplete(element);
        const label = this.findAssociatedLabel(element);
        if (label) {
          fieldCompletionUpdates.push(() => this.addIndicator(label, isComplete));
        }
      }

      fieldCompletionUpdates.push(() => element.classList.toggle('complete', isComplete));

      if (!isComplete) {
        missingFields.push(field);
      }
    });

    // Apply all field completion updates at once
    requestAnimationFrame(() => {
      fieldCompletionUpdates.forEach((update) => update());

      // Update submit button state
      const isValid = missingFields.length === 0;
      submitButton.disabled = !isValid;

      if (!isValid) {
        submitButton['data-tooltip'] = game.i18n.format('hm.errors.missing-mandatory-fields', {
          fields: missingFields.join(', ')
        });
      } else {
        submitButton.title = game.i18n.localize('hm.app.save-description');
      }
    });

    return missingFields.length === 0;
  }

  /**
   * Checks if an ability score field is complete based on the current roll method
   * @param {HTMLElement} element - The ability input element
   * @param {HTMLElement} abilityBlock - The parent ability block element
   * @returns {boolean} Whether the field is complete
   * @static
   */
  static isAbilityFieldComplete(element, abilityBlock) {
    if (!abilityBlock) return false;

    // Standard Array - single dropdown
    if (element.classList.contains('ability-dropdown') && !abilityBlock.classList.contains('point-buy')) {
      return element.value && element.value !== '';
    }
    // Point Buy - hidden input with control buttons
    else if (element.type === 'hidden' && abilityBlock.classList.contains('point-buy')) {
      const score = parseInt(element.value);
      return !isNaN(score) && score >= 8;
    }
    // Manual - dropdown + number input
    else {
      const dropdown = abilityBlock.querySelector('.ability-dropdown');
      const scoreInput = abilityBlock.querySelector('.ability-score');
      return dropdown?.value && scoreInput?.value && dropdown.value !== '' && scoreInput.value !== '';
    }
  }

  /**
   * Checks if a form field contains valid content
   * @param {HTMLElement} element - The form field to check
   * @returns {boolean} Whether the field has valid content
   * @static
   */
  static isFormFieldComplete(element) {
    if (!element) return false;

    const type = element?.localName || element?.type || '';
    const value = element?.value;
    const checked = element?.checked;
    const emptyStates = ['', '<p></p>', '<p><br></p>', '<p><br class="ProseMirror-trailingBreak"></p>'];
    const proseMirrorValue = value || '';
    const editorContent = element.querySelector('.editor-content.ProseMirror')?.innerHTML || '';
    const isComplete = !emptyStates.includes(proseMirrorValue) && proseMirrorValue.trim() !== '' && !emptyStates.includes(editorContent) && editorContent.trim() !== '';

    // HM.log(3, 'Checking mandatory fields:', { element: element, type: type, value: value, checked: checked });

    switch (type) {
      case 'checkbox':
        return checked;
      case 'text':
      case 'textarea':
        return value && value.trim() !== '';
      case 'color-picker':
        return value && value !== '#000000';
      case 'select-one':
        return value && value !== '';
      case 'prose-mirror':
        HM.log(3, 'Checking prose-mirror content:', {
          value: proseMirrorValue,
          editorContent: editorContent,
          isComplete: isComplete
        });
        return isComplete;
      default:
        return value && value.trim() !== '';
    }
  }

  /**
   * Finds the label element associated with a form field
   * Handles special cases like ProseMirror editors and various form layouts
   * @param {HTMLElement} element - The form element to find a label for
   * @returns {HTMLElement|null} The associated label element or null if not found
   * @static
   */
  static findAssociatedLabel(element) {
    // HM.log(3, 'PROSE MIRROR SEARCH:', { element: element });
    if (element.localName === 'prose-mirror') {
      HM.log(3, 'Finding label for ProseMirror element:', { element: element });
      let h3Element = element.closest('.notes-section')?.querySelector('h3');
      HM.log(3, 'Found h3 element:', { h3Element: h3Element });
      return h3Element;
    }

    return element
      .closest('.form-row, .art-selection-row, .customization-row, .ability-block, .form-group, .trait-group, .personality-group, .description-group, .notes-group')
      ?.querySelector('label, span.ability-label');
  }

  /**
   * Adds a visual indicator to show field completion status
   * Creates or updates an icon prepended to the label
   * @param {HTMLElement} labelElement - The label element to modify
   * @param {boolean} [isComplete=false] - Whether the associated field is complete
   * @static
   */
  static addIndicator(labelElement, isComplete = false) {
    // Remove existing indicator if any
    const existingIcon = labelElement.querySelector('.mandatory-indicator');
    if (existingIcon) {
      // Only remove if the state changed
      const currentIsComplete = existingIcon.classList.contains('fa-circle-check');
      if (currentIsComplete === isComplete) {
        return; // No change needed
      }
      existingIcon.remove();
    }

    // Create new indicator
    const icon = document.createElement('i');
    if (isComplete) {
      icon.className = 'fa-duotone fa-solid fa-circle-check mandatory-indicator';
      icon.style.color = 'hsl(122deg 39% 49%)';
      icon.style.textShadow = '0 0 8px hsla(122deg, 39%, 49%, 50%)';
    } else {
      icon.className = 'fa-duotone fa-solid fa-diamond-exclamation mandatory-indicator';
      icon.style.color = 'hsl(0deg 100% 71%)';
      icon.style.textShadow = '0 0 8px hsla(0deg, 100%, 71%, 50%)';
    }
    labelElement.prepend(icon);
  }

  /**
   * Shows a confirmation dialog for reloading the world/application
   * @param {object} options - Configuration options
   * @param {boolean} options.world - Whether to reload the entire world
   * @returns {Promise<void>}
   * @static
   */
  static async reloadConfirm({ world = false } = {}) {
    const reload = await DialogV2.confirm({
      id: 'reload-world-confirm',
      modal: true,
      rejectClose: false,
      window: { title: 'SETTINGS.ReloadPromptTitle' },
      position: { width: 400 },
      content: `<p>${game.i18n.localize('SETTINGS.ReloadPromptBody')}</p>`
    });
    if (!reload) return;
    if (world && game.user.can('SETTINGS_MODIFY')) game.socket.emit('reload');
    foundry.utils.debouncedReload();
  }
}
