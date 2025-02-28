import { HM } from '../utils/index.js';

export class SavedOptions {
  static FLAG = 'saved-options';

  static async saveOptions(formData) {
    HM.log(3, 'SAVE: Saving form data:', formData);
    const data = { ...formData };
    const result = await game.user.setFlag(HM.CONFIG.ID, this.FLAG, data);
    return result;
  }

  static async loadOptions() {
    HM.log(3, 'Loading saved options');
    const data = await game.user.getFlag(HM.CONFIG.ID, this.FLAG);
    HM.log(3, 'Loaded flag data:', data);
    return data || {};
  }

  static async resetOptions() {
    return game.user.setFlag(HM.CONFIG.ID, this.FLAG, null);
  }
}
