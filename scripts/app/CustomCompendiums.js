import { HM } from '../module.js';
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
    return `${HM.TITLE} | ${game.i18n.localize('hm.settings.customcompendiums.menu.name')}`;
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

  static async manageCompendium(type) {
    let validPacks = new Set();

    // Iterate over all compendiums
    for (const pack of game.packs) {
      try {
        let documents = await pack.getDocuments({ type: type });

        if (documents.length > 0) {
          HM.log(`Retrieved ${documents.length} documents from pack: ${pack.metadata.label}`);
          let packName = pack.metadata.label;

          validPacks.add({
            packName,
            packId: pack.metadata.id,
            type: pack.metadata.type
          });
        }
      } catch (error) {
        HM.log(`Failed to retrieve documents from pack ${pack.metadata.label}: ${error}`, 'error');
      }
    }

    const selectedPacks = await CustomCompendiums.getSelectedPacksByType(type);

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

    new DialogV2({
      window: { title: `${game.i18n.format('hm.settings.customcompendiums.title', { type: type })}` },
      content: content,
      classes: ['hm-compendiums-popup-dialog'],
      buttons: [
        {
          action: 'ok',
          label: `${game.i18n.localize('hm.app.done')}`,
          icon: 'fas fa-check',
          default: 'true',
          callback: async (event, button, dialog) => {
            const selectedValues = button.form.elements.compendiumMultiSelect.value;
            await CustomCompendiums.setSelectedPacksByType(type, selectedValues);
            HM.log(`Selected ${type} compendiums:`, selectedValues);
          }
        }
      ],
      rejectClose: false,
      modal: false,
      position: { width: 400 },
      submit: (result) => {
        HM.log('Dialog submitted with result:', result);
      }
    }).render(true);
  }

  static async getSelectedPacksByType(type) {
    return (await game.settings.get('hero-mancer', `${type}Packs`)) || [];
  }

  static async setSelectedPacksByType(type, selectedValues) {
    await game.settings.set('hero-mancer', `${type}Packs`, selectedValues);
  }

  async _prepareContext(options) {
    HM.log(options);
    HM.log('Context prepared!');
    return context;
  }

  _onRender(context, options) {
    HM.log('Rendering application with context and options.');
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
    HM.log('Form submitted and settings saved');
  }
}
