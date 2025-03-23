import { HM } from '../utils/index.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class Troubleshooter extends HandlebarsApplicationMixin(ApplicationV2) {
  /* -------------------------------------------- */
  /*  Static Properties                           */
  /* -------------------------------------------- */

  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'hero-mancer-troubleshooter',
    classes: ['hm-troubleshooter'],
    position: {
      width: 750,
      height: 'auto'
    },
    window: {
      icon: 'fa-solid fa-bug',
      resizable: false
    },
    tag: 'div',
    actions: {
      exportReport: Troubleshooter._onExportReport,
      copyToClipboard: Troubleshooter._onCopyToClipboard,
      openDiscord: Troubleshooter._onOpenDiscord,
      openGithub: Troubleshooter._onOpenGithub
    }
  };

  /** @override */
  static PARTS = {
    main: {
      template: 'modules/hero-mancer/templates/settings/troubleshooter.hbs',
      classes: ['hm-troubleshooter-content']
    }
  };

  /* -------------------------------------------- */
  /*  Getters                                     */
  /* -------------------------------------------- */

  get title() {
    return `${HM.NAME} | ${game.i18n.localize('hm.settings.troubleshooter.title')}`;
  }

  /* -------------------------------------------- */
  /*  Instance Methods                            */
  /* -------------------------------------------- */

  /**
   * Prepares context data for the troubleshooter application
   * @param {object} _options - Application render options
   * @returns {Promise<object>} Context data for template rendering
   * @protected
   * @override
   */
  async _prepareContext(_options) {
    return {
      output: await Troubleshooter.generateTextReport()
    };
  }

  /* -------------------------------------------- */
  /*  Static Public Methods                       */
  /* -------------------------------------------- */

  /**
   * Generates a text-based troubleshooting report
   * @returns {Promise<string>} The formatted troubleshooting report
   * @static
   */
  static async generateTextReport() {
    const reportLines = [];

    const addLine = (text) => reportLines.push(text);
    const addHeader = (text) => {
      addLine('');
      addLine(`/////////////// ${text} ///////////////`);
      addLine('');
    };

    // Game information
    addHeader('Game Information');
    addLine(`Foundry: ${game.version}`);
    addLine(`System: ${game.system.id} v${game.system.version}`);
    addLine(`Language: ${game.settings.get('core', 'language')}`);
    addLine(`Hero Mancer Version: ${game.modules.get(HM.ID)?.version || 'unknown'}`);

    // Modules
    addHeader('Active Modules');
    const enabledModules = this.getEnabledModules()
      .map((module) => `${module.title}: ${module.version}`)
      .sort();
    enabledModules.forEach((text) => addLine(text));

    // Hero Mancer settings
    addHeader('Hero Mancer Settings');
    const settings = await this.collectSettings();
    for (const [key, value] of Object.entries(settings)) {
      const valueDisplay = typeof value === 'object' ? JSON.stringify(value) : value;
      addLine(`${key}: ${valueDisplay}`);
    }

    // Compendium packs
    addHeader('Compendium Configuration');
    const compendiums = this.getCompendiumInfo();
    for (const [type, packs] of Object.entries(compendiums)) {
      const typeName = type.charAt(0).toUpperCase() + type.slice(1);

      if (packs.length) {
        addLine(`${typeName} Packs:`);
        packs.forEach((pack) => {
          if (!pack.error) {
            addLine(` - ${pack.name} (${pack.id})`);
          } else {
            addLine(` - [Missing Pack] ${pack.id}`);
          }
        });
      } else {
        addLine(`${typeName} Packs: None configured`);
      }
    }

    // Add Mancer Form Data section
    const mancerData = this.collectMancerFormData();
    if (mancerData && Object.keys(mancerData).length) {
      addHeader('Hero Mancer Form Data');

      const formatMancerData = (data, prefix = '') => {
        for (const [key, value] of Object.entries(data)) {
          const fullKey = prefix ? `${prefix}.${key}` : key;

          if (typeof value === 'object' && value !== null) {
            formatMancerData(value, fullKey);
          } else {
            let valueDisplay = String(value);
            if (valueDisplay.length > 100) {
              valueDisplay = `${valueDisplay.substring(0, 97)}...`;
            }
            addLine(`${fullKey}: ${valueDisplay}`);
          }
        }
      };

      formatMancerData(mancerData);
    }

    // Log data
    const logData = window.console_logs || [];
    if (logData.length) {
      addHeader('Log Data');

      const logInfo = this.getLogLevelInfo();
      addLine(`Log Level: ${logInfo.level} (${logInfo.name})`);
      addLine('Recent logs:');

      const processedLogs = this.processLogs(logData);
      processedLogs.forEach((log) => {
        addLine(`${log.timestamp} [${log.type.toUpperCase()}] ${log.content}`);
      });
    }

    return reportLines.join('\n');
  }

  /**
   * Exports the troubleshooting report to a text file
   * @returns {Promise<string>} The filename of the exported report
   * @static
   */
  static async exportTextReport() {
    const output = await this.generateTextReport();
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `hero-mancer-troubleshooter-${timestamp}.txt`;

    const blob = new Blob([output], { type: 'text/plain' });
    await saveDataToFile(blob, { type: 'text/plain' }, filename);
    return filename;
  }

  /**
   * Handles the export report button click
   * @param {Event} event - The triggering event
   * @static
   */
  static _onExportReport(event) {
    event.preventDefault();
    Troubleshooter.exportTextReport().then((filename) => {
      ui.notifications.info(game.i18n.format('hm.settings.troubleshooter.export-success', { filename }));
    });
  }

  /**
   * Handles the copy to clipboard button click
   * @param {Event} event - The triggering event
   * @static
   */
  static _onCopyToClipboard(event) {
    event.preventDefault();
    Troubleshooter.generateTextReport().then((text) => {
      navigator.clipboard.writeText(text);
      ui.notifications.info(game.i18n.localize('hm.settings.troubleshooter.copy-success'));
    });
  }

  /**
   * Handles the open Discord button click
   * @param {Event} event - The triggering event
   * @static
   */
  static _onOpenDiscord(event) {
    event.preventDefault();
    window.open('https://discord.gg/7HSEEyjMR4');
  }

  /**
   * Handles the open GitHub button click
   * @param {Event} event - The triggering event
   * @static
   */
  static _onOpenGithub(event) {
    event.preventDefault();
    window.open('https://github.com/Sayshal/hero-mancer/issues');
  }

  /* -------------------------------------------- */
  /*  Static Utility Methods                      */
  /* -------------------------------------------- */

  /**
   * Gets information about the current log level
   * @returns {object} Object containing log level and name
   * @static
   */
  static getLogLevelInfo() {
    const level = HM.LOG_LEVEL;
    const name =
      level === 0 ? 'Disabled'
      : level === 1 ? 'Errors'
      : level === 2 ? 'Warnings'
      : 'Verbose';
    return { level, name };
  }

  /**
   * Gets a list of all enabled modules
   * @returns {Array<object>} Array of enabled module data
   * @static
   */
  static getEnabledModules() {
    const enabledModules = [];
    game.modules.forEach((module, id) => {
      if (module.active) {
        enabledModules.push({
          id,
          title: module.title,
          version: module.version
        });
      }
    });
    return enabledModules;
  }

  /**
   * Collects all Hero Mancer settings
   * @returns {Promise<object>} Object containing all settings
   * @static
   */
  static async collectSettings() {
    const settings = {};
    for (const [key, setting] of game.settings.settings.entries()) {
      if (setting.namespace === HM.ID) {
        try {
          settings[setting.key] = await game.settings.get(HM.ID, setting.key);
        } catch (error) {
          settings[setting.key] = `[Error: ${error.message}]`;
        }
      }
    }
    return settings;
  }

  /**
   * Collects form data from an active Hero Mancer application
   * @returns {object|null} Object containing form data or null if app not found
   * @static
   */
  static collectMancerFormData() {
    const mancerApp = document.getElementById('hero-mancer-app');
    if (!mancerApp) return null;

    const formElements = mancerApp.querySelectorAll('[name]');
    if (!formElements.length) return null;

    const formData = {};

    // Helper to process array notation names (e.g., "abilities[str]")
    const processName = (name, value) => {
      const match = name.match(/^([^[]+)\[([^\]]+)]$/);
      if (match) {
        const [_, arrayName, key] = match;
        if (!formData[arrayName]) formData[arrayName] = {};
        formData[arrayName][key] = value;
      } else {
        formData[name] = value;
      }
    };

    formElements.forEach((element) => {
      const name = element.getAttribute('name');
      if (!name) return;

      let value;

      if (element.type === 'checkbox') {
        value = element.checked;
      } else if (element.type === 'radio') {
        if (!element.checked) return;
        value = element.value;
      } else if (element.tagName === 'SELECT') {
        value = element.value;
        try {
          const selectedOption = element.options[element.selectedIndex];
          if (selectedOption && selectedOption.text) {
            value = `${value} (${selectedOption.text})`;
          }
        } catch (e) {
          /* Ignore errors */
        }
      } else if (element.tagName === 'PROSE-MIRROR') {
        try {
          const content = element.querySelector('.editor-content');
          value = content ? content.textContent : '[Complex Content]';
        } catch (e) {
          value = '[Complex Content]';
        }
      } else {
        value = element.value;
      }

      processName(name, value);
    });

    return formData;
  }

  /**
   * Gets information about configured compendium packs
   * @returns {object} Object containing compendium configuration
   * @static
   */
  static getCompendiumInfo() {
    const compendiums = {};
    for (const type of ['class', 'race', 'background', 'item']) {
      const packSetting = `${type}Packs`;
      const packs = game.settings.get(HM.ID, packSetting) || [];

      compendiums[type] = packs.map((packId) => {
        const pack = game.packs.get(packId);
        return pack ?
            {
              id: packId,
              name: pack.metadata.label,
              system: pack.metadata.system,
              packageName: pack.metadata.packageName
            }
          : { id: packId, error: 'Pack not found' };
      });
    }
    return compendiums;
  }

  /**
   * Processes log data for display in the report
   * @param {Array<object>} logs - Array of log objects
   * @returns {Array<object>} Processed log entries
   * @static
   */
  static processLogs(logs) {
    return logs.map((log) => {
      const processedContent = log.content
        .map((item) => {
          if (typeof item === 'string') return item;
          if (Array.isArray(item)) return `Array(${item.length})`;
          if (typeof item === 'object' && item !== null) {
            const keys = Object.keys(item);
            const preview = keys
              .slice(0, 3)
              .map((key) => {
                const value = item[key];
                if (Array.isArray(value)) return `${key}: Array(${value.length})`;
                if (typeof value === 'object' && value !== null) return `${key}: Object`;
                return `${key}: ${value}`;
              })
              .join(', ');
            return `{${preview}${keys.length > 3 ? '...' : ''}}`;
          }
          return String(item);
        })
        .join(' ');

      return {
        timestamp: log.timestamp,
        type: log.type,
        content: processedContent
      };
    });
  }
}
