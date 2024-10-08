import { CCreator } from "./module.js";

export function registerSettings() {
  game.settings.register(CCreator.ID, 'enable', {
    name: `cc.settings.enable.name`,
    default: true,
    type: Boolean,
    scope: "client",
    config: true,
    hint: `cc.settings.enable.hint`,
    onChange: () => ui.players.render(),
  });
}
