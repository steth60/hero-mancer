import { HM } from '../hero-mancer.js';

export class SavedOptions {
  static FLAG = 'saved-options';

  static async saveOptions(formData) {
    const data = { ...formData };
    const result = await game.user.setFlag(HM.CONFIG.ID, this.FLAG, data);
    return result;
  }

  static async loadOptions() {
    const data = await game.user.getFlag(HM.CONFIG.ID, this.FLAG);
    return data || {};
  }

  static async resetOptions() {
    return game.user.setFlag(HM.CONFIG.ID, this.FLAG, null);
  }
}
