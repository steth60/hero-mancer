import { HM } from './module.js';

export function registerSettings() {
  game.settings.register(HM.ID, 'enable', {
    name: `${HM.ABRV}.settings.enable.name`,
    default: true,
    type: Boolean,
    scope: 'client',
    config: true,
    hint: `${HM.ABRV}.settings.enable.hint`,
    requiresReload: true
  });

  // New setting for enabling verbose logging
  game.settings.register(HM.ID, 'enableVerboseLogging', {
    name: `${HM.ABRV}.settings.logger.name`,
    hint: `${HM.ABRV}.settings.logger.hint`,
    scope: 'client',
    config: true,
    type: Boolean,
    default: false,  // Set to false by default
    onChange: value => {
      console.log(`${HM.ID} | logging set to ${value}`);
    }
  });

  // Menu for custom compendium chooser
  // game.settings.registerMenu(HM.ID, 'customCompendiumMenu', {
  //   name: `${HM.ABRV}.settings.customcompendiums.menu.name`,
  //   hint: `${HM.ABRV}.settings.customcompendiums.menu.hint`,
  //   label: `${HM.ABRV}.settings.customcompendiums.menu.label`,
  //   icon: 'fa-solid fa-bars',
  //   type: CustomCompendiums,
  //   restricted: true,
  // });

  game.settings.register(HM.ID, 'enableCustomCompendiums', {
    scope: 'world',
    config: false,
    type: Object,
    default: {},
  })

}

export class CustomCompendiums extends FormApplication {


  getData() {
    return game.settings.get(`${HM.ID}`, 'enableCustomCompendiums')
  }

  _updateObject(event, formData) {
    const data = expandObject(formData);
    console.log(data);
    game.settings.set(HM.ID, 'enableCustomCompendiums', data);
  }
}