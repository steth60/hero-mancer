import { CCreator } from "./module.js";

export function registerSettings() {
  game.settings.register(CCreator.ID, 'enable', {
    name: `CCreator.Settings.enable.Name`,
    default: true,
    type: Boolean,
    scope: "client",
    config: true,
    hint: `CCreator.Settings.enable.Hint`,
    onChange: () => ui.players.render(),
  });
}
