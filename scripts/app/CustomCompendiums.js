import { HM } from '../hero-mancer.js';
import * as HMUtils from '../utils/index.js';

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

export class CustomCompendiums extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'hero-mancer-settings-custom-compendiums',
    classes: ['hm-app'],
    tag: 'form',
    form: {
      handler: CustomCompendiums.formHandler,
      closeOnSubmit: true,
      submitOnChange: false
    },
    actions: {
      classes: () => CustomCompendiums.manageCompendium('class'),
      races: () => CustomCompendiums.manageCompendium('race'),
      backgrounds: () => CustomCompendiums.manageCompendium('background')
    },
    position: {
      height: 'auto',
      width: '400'
    },
    window: {
      icon: 'fa-solid fa-egg',
      resizable: false
    }
  };

  get title() {
    return `${HM.TITLE} | ${game.i18n.localize('hm.settings.custom-compendiums.menu.name')}`;
  }

  static PARTS = {
    form: {
      template: 'modules/hero-mancer/templates/settings/custom-compendiums.hbs',
      id: 'body',
      classes: ['hm-compendiums-popup']
    },
    footer: {
      template: 'modules/hero-mancer/templates/settings/settings-footer.hbs',
      id: 'footer',
      classes: ['hm-compendiums-footer']
    }
  };

  /**
   * Manages the compendium selection and handles validation.
   * @param {string} type The type of compendium to manage (class, race, or background)
   */
  static async manageCompendium(type) {
    let validPacks = new Set();

    // Iterate over all compendiums and collect valid packs of the correct type
    for (const pack of game.packs) {
      try {
        let documents = await pack.getDocuments({ type: type });

        if (documents.length > 0) {
          HM.log(3, `Retrieved ${documents.length} documents from pack: ${pack.metadata.label}`);
          let packName = pack.metadata.label;

          validPacks.add({
            packName,
            packId: pack.metadata.id,
            type: pack.metadata.type
          });
        }
      } catch (error) {
        HM.log(1, `Failed to retrieve documents from pack ${pack.metadata.label}: ${error}`, 'error');
        ui.notifications.error(game.i18n.format('hm.settings.custom-compendiums.error', { pack: pack.metadata.label }));
      }
    }
    // Check if no valid packs were found and notify the user
    if (validPacks.size === 0) {
      ui.notifications.warn(game.i18n.localize('hm.settings.custom-compendiums.no-valid-packs'));
      return; // Exit early to prevent rendering an empty dialog
    }
    // Ensure the selected packs are properly awaited
    let selectedPacks = await CustomCompendiums.getSelectedPacksByType(type);

    // Validate that the selected packs still exist in the validPacks set
    selectedPacks = selectedPacks.filter((packId) => {
      const packExists = Array.from(validPacks).some((pack) => pack.packId === packId);
      if (!packExists) {
        HM.log(2, `Invalid ${type} compendium pack: ${packId} (no longer exists)`);

        // Feedback to the user
        ui.notifications.error(game.i18n.localize('hm.settings.custom-compendiums.invalid-pack'));
      }
      return packExists; // Keep only valid packs
    });

    // Create the multi-select input field for valid packs
    const inputConfig = {
      name: 'compendiumMultiSelect',
      type: 'checkboxes',
      options: Array.from(validPacks).map((pack) => ({
        value: pack.packId,
        label: pack.packName,
        selected: selectedPacks.includes(pack.packId)
      }))
    };

    const multiSelectInput = foundry.applications.fields.createMultiSelectInput(inputConfig);
    const content = `${multiSelectInput.outerHTML}`;
    const callback = async (event, button, dialog) => {
      const selectedValues = button.form.elements.compendiumMultiSelect.value;
      await CustomCompendiums.setSelectedPacksByType(type, selectedValues);
      HM.log(3, `Selected ${type} compendiums:`, selectedValues);
      ui.notifications.info(
        game.i18n.format('hm.settings.custom-compendiums.saved', {
          type: game.i18n.localize(`hm.settings.custom-compendiums.${type}`)
        })
      );
    };
    // Render dialog with validated packs
    new DialogV2({
      window: { title: `${game.i18n.format('hm.settings.custom-compendiums.title', { type: type })}` },
      content: content,
      classes: ['hm-compendiums-popup-dialog'],
      buttons: [
        {
          action: 'ok',
          label: `${game.i18n.localize('hm.app.done')}`,
          icon: 'fas fa-check',
          default: 'true',
          callback: callback
        }
      ],
      rejectClose: false,
      modal: false,
      position: { width: 400 },
      submit: (result) => {
        HM.log(3, 'Dialog submitted with result:', result);
      }
    }).render(true);
  }

  /**
   * Retrieves the selected packs for the given type (class, race, background).
   * @param {string} type The type of compendium.
   * @returns {Array} Array of selected pack IDs.
   */
  static async getSelectedPacksByType(type) {
    const selectedPacks = await game.settings.get('hero-mancer', `${type}Packs`);
    return selectedPacks || []; // Return an empty array if no packs are selected
  }

  /**
   * Saves the selected packs for the given type.
   * @param {string} type The type of compendium.
   * @param {Array} selectedValues Array of selected pack IDs.
   */
  static async setSelectedPacksByType(type, selectedValues) {
    await game.settings.set('hero-mancer', `${type}Packs`, selectedValues);
  }

  async _prepareContext(options) {
    HM.log(3, options);
    HM.log(3, 'Context prepared!');
    return context;
  }

  _onRender(context, options) {
    HM.log(3, 'Rendering application with context and options.');
  }

  static async formHandler(event, form, formData) {
    await game.settings.set('hero-mancer', 'classPacks', await CustomCompendiums.getSelectedPacksByType('class'));
    await game.settings.set('hero-mancer', 'racePacks', await CustomCompendiums.getSelectedPacksByType('race'));
    await game.settings.set(
      'hero-mancer',
      'backgroundPacks',
      await CustomCompendiums.getSelectedPacksByType('background')
    );
    HMUtils.CacheManager.resetCache();
    ui.notifications.info(game.i18n.localize('hm.settings.custom-compendiums.form-saved'));
    HM.log(3, 'Form submitted and settings saved');
  }
}
