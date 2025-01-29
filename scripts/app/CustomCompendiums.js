import { HM } from '../hero-mancer.js';
import { CacheManager } from '../utils/cacheManagement.js';

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

  static #validPacksCache = new Map();

  get title() {
    return `${HM.CONFIG.TITLE} | ${game.i18n.localize('hm.settings.custom-compendiums.menu.name')}`;
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
   * Collects valid packs of a specified type from available compendiums.
   * @param {string} type The type of documents to collect
   * @param {boolean} useCache Whether to use cached results
   * @returns {Promise<Set>} A set of valid pack objects
   */
  static async #collectValidPacks(type, useCache = true) {
    if (useCache && this.#validPacksCache.has(type)) {
      return this.#validPacksCache.get(type);
    }

    const validPacks = new Set();
    const indexPromises = game.packs.map(async (pack) => {
      try {
        const index = await pack.getIndex();
        const hasTypeDocuments = index.some((doc) => doc.type === type);

        if (hasTypeDocuments) {
          validPacks.add({
            packName: pack.metadata.label,
            packId: pack.metadata.id,
            type: pack.metadata.type
          });
          HM.log(3, `Found documents of type ${type} in pack: ${pack.metadata.label}`);
        }
      } catch (error) {
        HM.log(2, `Failed to retrieve index from pack ${pack.metadata.label}: ${error}`);
      }
    });

    await Promise.all(indexPromises);

    if (useCache) {
      this.#validPacksCache.set(type, validPacks);
    }

    return validPacks;
  }

  /**
   * Manages the compendium selection and handles validation.
   * @param {string} type The type of compendium to manage (class, race, or background)
   */
  static async manageCompendium(type) {
    const validPacks = await this.#collectValidPacks(type);

    if (validPacks.size === 0) {
      ui.notifications.warn(game.i18n.localize('hm.settings.custom-compendiums.no-valid-packs'));
      return;
    }

    const selectedPacks = await this.getSelectedPacksByType(type, validPacks);
    await this.#renderCompendiumDialog(type, validPacks, selectedPacks);
  }

  static async #renderCompendiumDialog(type, validPacks, selectedPacks) {
    const inputConfig = {
      name: 'compendiumMultiSelect',
      type: 'checkboxes',
      options: Array.from(validPacks).map((pack) => ({
        value: pack.packId,
        label: pack.packName,
        selected: selectedPacks.includes(pack.packId)
      }))
    };

    const callback = async (event, button, dialog) => {
      const selectedValues = button.form.elements.compendiumMultiSelect.value;
      await this.setSelectedPacksByType(type, selectedValues);

      ui.notifications.info(
        game.i18n.format('hm.settings.custom-compendiums.saved', {
          type: game.i18n.localize(`hm.settings.custom-compendiums.${type}`)
        })
      );

      HM.log(3, `Selected ${type} compendiums:`, selectedValues);
    };

    new DialogV2({
      window: { title: game.i18n.format('hm.settings.custom-compendiums.title', { type }) },
      content: foundry.applications.fields.createMultiSelectInput(inputConfig).outerHTML,
      classes: ['hm-compendiums-popup-dialog'],
      buttons: [
        {
          action: 'ok',
          label: game.i18n.localize('hm.app.done'),
          icon: 'fas fa-check',
          default: 'true',
          callback
        }
      ],
      rejectClose: false,
      modal: false,
      position: { width: 400 }
    }).render(true);
  }

  /**
   * Retrieves and validates the selected compendium packs for the given type, with fallback handling.
   * If selected packs are invalid or missing, attempts to fall back to SRD packs or all available packs.
   * @async
   * @param {string} type The type of compendium ('class', 'race', or 'background').
   * @param {Set} validPacks Set of valid pack objects containing packId and packName.
   * @returns {Promise<Array<string>>} A promise that resolves to an array of valid pack IDs.
   * @throws {Error} Throws an error if type parameter is invalid.
   */
  static async getSelectedPacksByType(type, validPacks) {
    let selectedPacks = await game.settings.get('hero-mancer', `${type}Packs`);

    // If no packs are selected, return empty array
    if (!selectedPacks) {
      return [];
    }

    // Get all available packs that contain valid documents
    const availablePacks = Array.from(validPacks).map((pack) => pack.packId);

    // Filter out any invalid packs
    const validSelectedPacks = selectedPacks.filter((packId) => {
      if (!availablePacks.includes(packId)) {
        HM.log(2, `Removing invalid ${type} compendium pack: ${packId}`);
        return false;
      }
      return true;
    });

    // If all selected packs were invalid, fall back to SRD packs
    if (validSelectedPacks.length === 0) {
      const srdPacks = Array.from(validPacks)
        .filter((pack) => pack.packName.includes('SRD'))
        .map((pack) => pack.packId);

      if (srdPacks.length > 0) {
        HM.log(2, `Falling back to SRD packs for ${type}`);
        await this.setSelectedPacksByType(type, srdPacks);
        return srdPacks;
      }

      // If no SRD packs, use all available packs
      HM.log(2, `No SRD packs found for ${type}, using all available packs`);
      await this.setSelectedPacksByType(type, availablePacks);
      return availablePacks;
    }

    // Update settings to remove invalid packs
    if (validSelectedPacks.length !== selectedPacks.length) {
      await this.setSelectedPacksByType(type, validSelectedPacks);
    }

    return validSelectedPacks;
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
    HM.log(3, 'Preparing context with options:', options);
    return context;
  }

  _onRender(context, options) {
    HM.log(3, 'Rendering application with context and options.');
  }

  static async formHandler(event, form, formData) {
    const types = ['class', 'race', 'background'];
    const requiresWorldReload = true; // Settings changes require world reload

    try {
      // First collect the valid packs
      const packPromises = types.map((type) => CustomCompendiums.#collectValidPacks(type, false));
      const validPacks = await Promise.all(packPromises);
      const validPacksMap = new Map(types.map((type, index) => [type, validPacks[index]]));

      // Then update the settings
      const settingPromises = types.map((type) => {
        const packs = validPacksMap.get(type);
        return CustomCompendiums.getSelectedPacksByType(type, packs).then((selectedPacks) => game.settings.set('hero-mancer', `${type}Packs`, selectedPacks));
      });
      await Promise.all(settingPromises);

      const cacheManager = new CacheManager();
      cacheManager.resetCache();
      CustomCompendiums.#validPacksCache.clear();

      this.constructor.reloadConfirm({ world: requiresWorldReload });

      ui.notifications.info(game.i18n.localize('hm.settings.custom-compendiums.form-saved'));
      HM.log(3, 'Form submitted and settings saved');
    } catch (error) {
      HM.log(1, 'Error in form submission:', error);
      ui.notifications.error(game.i18n.localize('hm.settings.custom-compendiums.error-saving'));
    }
  }

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
