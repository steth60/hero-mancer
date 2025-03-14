import { HM, StatRoller } from '../utils/index.js';

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

export class DiceRolling extends HandlebarsApplicationMixin(ApplicationV2) {
  /* -------------------------------------------- */
  /*  Static Properties                           */
  /* -------------------------------------------- */

  static DEFAULT_OPTIONS = {
    id: 'hero-mancer-settings-dice-rolling',
    classes: ['hm-app'],
    tag: 'form',
    form: {
      handler: DiceRolling.formHandler,
      closeOnSubmit: true,
      submitOnChange: false
    },
    position: {
      height: 'auto',
      width: '550'
    },
    window: {
      icon: 'fa-solid fa-dice',
      resizable: false
    }
  };

  static PARTS = {
    form: {
      template: 'modules/hero-mancer/templates/settings/dice-rolling.hbs',
      id: 'body',
      classes: ['hm-dice-rolling-popup']
    },
    footer: {
      template: 'modules/hero-mancer/templates/settings/settings-footer.hbs',
      id: 'footer',
      classes: ['hm-compendiums-footer']
    }
  };

  /* -------------------------------------------- */
  /*  Getters                                     */
  /* -------------------------------------------- */

  get title() {
    return `${HM.NAME} | ${game.i18n.localize('hm.settings.dice-rolling.menu.name')}`;
  }

  /* -------------------------------------------- */
  /*  Protected Methods                           */
  /* -------------------------------------------- */

  /**
   * Prepares context data for the dice rolling settings application
   * @param {object} _options - Application render options
   * @returns {Promise<object>} Context data for template rendering with dice rolling settings
   * @protected
   */
  async _prepareContext(_options) {
    const context = {
      allowedMethods: await game.settings.get(HM.ID, 'allowedMethods'),
      customRollFormula: game.settings.get(HM.ID, 'customRollFormula'),
      chainedRolls: game.settings.get(HM.ID, 'chainedRolls'),
      rollDelay: game.settings.get(HM.ID, 'rollDelay'),
      customStandardArray: game.settings.get(HM.ID, 'customStandardArray'),
      customPointBuyTotal: game.settings.get(HM.ID, 'customPointBuyTotal'),
      abilityScoreDefault: game.settings.get(HM.ID, 'abilityScoreDefault'),
      abilityScoreMin: game.settings.get(HM.ID, 'abilityScoreMin'),
      abilityScoreMax: game.settings.get(HM.ID, 'abilityScoreMax')
    };

    return context;
  }

  /**
   * Actions to perform after the application renders
   * Sets up event listeners for the roll delay slider
   * @param {object} _context - The rendered context data
   * @param {object} _options - The render options
   * @protected
   */
  _onRender(_context, _options) {
    const html = this.element;
    const slider = html.querySelector('input[type="range"]');
    const output = html.querySelector('.delay-value');

    slider.addEventListener('input', (e) => {
      output.textContent = `${e.target.value}ms`;
    });
  }

  /* -------------------------------------------- */
  /*  Static Public Methods                       */
  /* -------------------------------------------- */

  /**
   * Processes form submission for dice rolling settings
   * Validates and saves settings for ability score generation methods
   * @param {Event} _event - The form submission event
   * @param {HTMLFormElement} form - The form element
   * @param {FormDataExtended} formData - The processed form data
   * @returns {Promise<boolean|void>} Returns false if validation fails
   * @static
   */
  static async formHandler(_event, form, formData) {
    const requiresWorldReload = true;
    try {
      const allowedMethods = {
        standardArray: form.elements.standardArray?.checked ?? false,
        manual: form.elements.manual?.checked ?? false,
        pointBuy: form.elements.pointBuy?.checked ?? false
      };

      if (!Object.values(allowedMethods).some((value) => value)) {
        ui.notifications.error('hm.settings.dice-rolling.need-roll-method', { localize: true });
        return false;
      }

      const settings = ['customRollFormula', 'chainedRolls', 'rollDelay', 'customStandardArray', 'customPointBuyTotal', 'abilityScoreDefault', 'abilityScoreMin', 'abilityScoreMax'];

      // Validate ability score ranges
      const min = parseInt(formData.object.abilityScoreMin);
      const max = parseInt(formData.object.abilityScoreMax);
      const defaultScore = parseInt(formData.object.abilityScoreDefault);

      if (min > defaultScore || defaultScore > max || min > max) {
        ui.notifications.error('hm.settings.ability-scores.invalid-range', { localize: true });
        return false;
      }

      for (const setting of settings) {
        await game.settings.set(HM.ID, setting, formData.object[setting]);
      }

      await game.settings.set(HM.ID, 'allowedMethods', allowedMethods);

      if (formData.object.customStandardArray) {
        StatRoller.validateAndSetCustomStandardArray(formData.object.customStandardArray);
      }

      HM.ABILITY_SCORES = {
        DEFAULT: formData.object.abilityScoreDefault,
        MIN: formData.object.abilityScoreMin,
        MAX: formData.object.abilityScoreMax
      };

      this.constructor.reloadConfirm({ world: requiresWorldReload });

      ui.notifications.info('hm.settings.dice-rolling.saved', { localize: true });
    } catch (error) {
      HM.log(1, `Error in formHandler: ${error}`);
      ui.notifications.error('hm.settings.dice-rolling.error-saving', { localize: true });
    }
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
