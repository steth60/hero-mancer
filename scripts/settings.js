import { CCreator } from './module.js';

export class CCreatorSettings {
  static SETTINGS = { 
    ENABLE: 'enable'
  };
  static registerSettings() {
    game.settings.register(CCreator.ID, CCreatorSettings.SETTINGS.ENABLE, {
      name: `CCreator.Settings.${CCreatorSettings.SETTINGS.ENABLE}.Name`,
      default: true,
      type: Boolean,
      scope: 'client',
      config: true,
      hint: `CCreator.Settings.${CCreatorSettings.SETTINGS.ENABLE}.Hint`,
      onChange: () => ui.players.render(),
    });
  }
}
