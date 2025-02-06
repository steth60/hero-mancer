import { HM } from '../hero-mancer.js';
import { StatRoller } from '../utils/index.js';

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

export class DiceRolling extends HandlebarsApplicationMixin(ApplicationV2) {
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
      width: '650'
    },
    window: {
      icon: 'fa-solid fa-dice',
      resizable: false
    }
  };

  get title() {
    return `${HM.CONFIG.TITLE} | ${game.i18n.localize('hm.settings.dice-rolling.menu.name')}`;
  }

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

  async _prepareContext(options) {
    const context = {
      allowedMethods: await game.settings.get(HM.CONFIG.ID, 'allowedMethods'),
      customRollFormula: game.settings.get(HM.CONFIG.ID, 'customRollFormula'),
      chainedRolls: game.settings.get(HM.CONFIG.ID, 'chainedRolls'),
      rollDelay: game.settings.get(HM.CONFIG.ID, 'rollDelay'),
      customStandardArray: game.settings.get(HM.CONFIG.ID, 'customStandardArray')
    };
    HM.log(3, 'Context:', context);
    return context;
  }

  _onRender() {
    const html = this.element;
    const slider = html.querySelector('input[type="range"]');
    const output = html.querySelector('.delay-value');

    slider.addEventListener('input', (e) => {
      output.textContent = `${e.target.value}ms`;
    });
  }

  static async formHandler(event, form, formData) {
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

      const settings = ['customRollFormula', 'chainedRolls', 'rollDelay', 'customStandardArray'];
      for (const setting of settings) {
        await game.settings.set(HM.CONFIG.ID, setting, formData.object[setting]);
      }

      await game.settings.set(HM.CONFIG.ID, 'allowedMethods', allowedMethods);
      HM.log(3, `Processed allowedMethods: ${JSON.stringify(allowedMethods)}`);
      HM.log(3, 'Saved allowedMethods:', game.settings.get(HM.CONFIG.ID, 'allowedMethods'));

      if (formData.object.customStandardArray) {
        StatRoller.validateAndSetCustomStandardArray(formData.object.customStandardArray);
      }

      ui.notifications.info('hm.settings.dice-rolling.saved', { localize: true });
      HM.log(3, 'Dice rolling settings saved');
    } catch (error) {
      HM.log(1, `Error in formHandler: ${error}`);
      ui.notifications.error('hm.settings.dice-rolling.error-saving', { localize: true });
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
