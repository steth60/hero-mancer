import { HM } from '../hero-mancer.js';

/**
 * Manages RollTable interactions for character backgrounds and characteristics.
 */
export class TableManager {
  static currentTables = new Map();

  static tableTypes = ['Personality Traits', 'Ideals', 'Bonds', 'Flaws'];

  static _extractTableIds(description) {
    const uuidPattern = /@UUID\[Compendium\.dnd5e\.tables\.RollTable\.(.*?)]/g;
    const matches = [...description.matchAll(uuidPattern)];
    return matches.map((match) => match[1]);
  }

  static async initializeTablesForBackground(background) {
    if (!background) {
      HM.log(2, 'No background provided for table initialization');
      TableManager.updateUIForMissingTables(null);
      return;
    }

    HM.log(3, 'Initializing tables for background:', background.id);
    this.currentTables.delete(background.id);

    try {
      const description = background.system.description.value;
      const uuidPattern = /@UUID\[Compendium\.(.*?)\.(.*?)\.RollTable\.(.*?)]/g;
      const matches = [...description.matchAll(uuidPattern)];

      if (!matches.length) {
        HM.log(3, 'No RollTable UUIDs found in background description, hiding UI elements.');
        TableManager.updateUIForMissingTables(null);
        return;
      }

      // Load each table and track which types we found
      const foundTableTypes = new Set();
      const tables = await Promise.all(
        matches.map(async (match) => {
          const uuid = `Compendium.${match[1]}.${match[2]}.RollTable.${match[3]}`;
          try {
            const table = await fromUuid(uuid);
            if (!table) {
              HM.log(2, `Could not load table with UUID: ${uuid}`);
              return null;
            }

            // Check table type based on name
            const tableName = table.name.toLowerCase();
            this.tableTypes.forEach((type) => {
              if (tableName.includes(type.toLowerCase()) || (type === 'Personality Traits' && tableName.includes('personality'))) {
                foundTableTypes.add(type);
              }
            });

            HM.log(3, 'Loaded table:', table);
            return table;
          } catch (error) {
            HM.log(1, `Error loading table with UUID ${uuid}:`, error);
            return null;
          }
        })
      );

      const validTables = tables.filter((table) => table !== null);
      if (validTables.length) {
        for (const table of validTables) {
          try {
            await table.resetResults();
          } catch (error) {
            HM.log(1, `Error resetting table ${table.id}:`, error);
          }
        }
        this.currentTables.set(background.id, validTables);
        HM.log(3, 'Tables initialized and stored for background:', background.id);
      }

      // Update UI based on which table types were found
      TableManager.updateUIForMissingTables(foundTableTypes);
    } catch (error) {
      HM.log(1, 'Error initializing tables for background:', error);
      TableManager.updateUIForMissingTables(null);
    }
  }

  static updateUIForMissingTables(foundTableTypes) {
    const typeToFieldMap = {
      'Personality Traits': 'traits',
      'Ideals': 'ideals',
      'Bonds': 'bonds',
      'Flaws': 'flaws'
    };

    Object.entries(typeToFieldMap).forEach(([tableType, fieldName]) => {
      const container = document.querySelector(`.personality-group textarea[name="${fieldName}"]`);
      const rollButton = document.querySelector(`.personality-group button[data-table="${fieldName}"]`);

      if (container && rollButton) {
        const hasTable = foundTableTypes?.has(tableType);

        // Update placeholder text
        container.placeholder = game.i18n.localize(hasTable ? `hm.app.finalize.${fieldName}-placeholder` : `hm.app.finalize.${fieldName}-placeholder-alt`);

        // Show/hide roll button
        rollButton.style.display = hasTable ? 'block' : 'none';
      }
    });
  }

  static async rollForCharacteristic(backgroundId, characteristicType) {
    const tables = this.currentTables.get(backgroundId);
    HM.log(3, 'Found tables for background:', tables);

    if (!tables) return null;

    const table = tables.find((t) => {
      const tableName = t.name.toLowerCase();
      const searchTerm = characteristicType.toLowerCase();
      return tableName.includes(searchTerm) || (searchTerm === 'traits' && tableName.includes('personality'));
    });

    HM.log(3, 'Found matching table for type:', characteristicType, table);

    if (!table) return null;

    try {
      // Set replacement to false to prevent duplicates
      const drawOptions = {
        displayChat: false,
        replacement: false
      };

      const { results } = await table.draw(drawOptions);
      HM.log(3, 'Draw results:', results);

      if (!results.length) return null;

      // Mark the result as drawn
      await table.updateEmbeddedDocuments('TableResult', [
        {
          _id: results[0].id,
          drawn: true
        }
      ]);

      return results[0]?.text || null;
    } catch (error) {
      console.error('Error rolling for characteristic:', error);
      return null;
    }
  }

  static isTableExhausted(backgroundId, characteristicType) {
    const tables = this.currentTables.get(backgroundId);
    if (!tables) return true;

    const table = tables.find((t) => {
      const tableName = t.name.toLowerCase();
      const searchTerm = characteristicType.toLowerCase();
      return tableName.includes(searchTerm) || (searchTerm === 'traits' && tableName.includes('personality'));
    });
    if (!table) return true;

    // Check if there are any undrawn results left
    const availableResults = table.results.filter((r) => !r.drawn);
    return availableResults.length === 0;
  }

  static async resetTables(backgroundId) {
    const tables = this.currentTables.get(backgroundId);
    if (!tables) return;

    try {
      await Promise.all(tables.map((table) => table.resetResults()));
    } catch (error) {
      console.error('Error resetting tables:', error);
    }
  }
}

/**
 * Manages summary updates and UI interactions for the character creation process.
 */
export class SummaryManager {
  static initializeSummaryListeners() {
    const raceDropdown = document.querySelector('#race-dropdown');
    const classDropdown = document.querySelector('#class-dropdown');
    const backgroundDropdown = document.querySelector('#background-dropdown');
    const equipmentContainer = document.querySelector('#equipment-container');
    const abilityBlocks = document.querySelectorAll('.ability-block');
    const proseMirror = document.querySelector('prose-mirror[name="backstory"]');
    this.initializePortrait();
    this.initializeRollButtons();

    HM.log(3, 'Found dropdowns:', { race: raceDropdown, class: classDropdown, background: backgroundDropdown });

    if (raceDropdown) {
      raceDropdown.addEventListener('change', (event) => {
        HM.log(3, 'Race dropdown changed:', event.target.value);
        this.updateClassRaceSummary();
        this.updateEquipmentSummary();
      });
    }

    if (classDropdown) {
      classDropdown.addEventListener('change', (event) => {
        this.updateClassRaceSummary();
        this.updateEquipmentSummary();
      });
    }

    if (backgroundDropdown) {
      backgroundDropdown.addEventListener('change', (event) => {
        this.updateBackgroundSummary();
        this.updateEquipmentSummary();
      });
    }

    if (equipmentContainer) {
      equipmentContainer.addEventListener('change', () => {
        this.updateEquipmentSummary();
      });
      const observer = new MutationObserver(() => this.updateEquipmentSummary());
      observer.observe(equipmentContainer, { childList: true, subtree: true });
    }

    if (abilityBlocks) {
      abilityBlocks.forEach((block) => {
        const currentScore = block.querySelector('.current-score');
        if (currentScore) {
          const observer = new MutationObserver(() => this.updateAbilitiesSummary());
          observer.observe(currentScore, {
            childList: true,
            characterData: true,
            subtree: true
          });
        }

        const otherInputs = block.querySelectorAll('.ability-dropdown, .ability-score');
        otherInputs.forEach((input) => {
          input.addEventListener('change', () => this.updateAbilitiesSummary());
        });
      });
    }

    /** There might be a better way of doing this... */
    if (proseMirror) {
      const observer = new MutationObserver((mutations) => {
        const hasContent = proseMirror.innerHTML.trim() !== '';

        if (hasContent) {
          proseMirror.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });

      observer.observe(proseMirror, {
        childList: true,
        characterData: true,
        subtree: true,
        attributes: true
      });
    }
  }

  static async updateBackgroundSummary() {
    const backgroundSelect = document.querySelector('#background-dropdown');
    const summary = document.querySelector('.background-summary');

    if (!summary || !backgroundSelect) return;

    const selectedOption = backgroundSelect.options[backgroundSelect.selectedIndex];

    // Handle default/no selection case
    if (!selectedOption?.value || selectedOption.value === '') {
      const article = game.i18n.localize('hm.app.equipment.article-plural');
      summary.innerHTML = game.i18n.format('hm.app.background.default', { article });
      return;
    }

    const [itemId, packId] = selectedOption.value.split(' (');
    if (!itemId || !packId) return;

    const cleanPackId = packId.slice(0, -1);
    const uuid = `Compendium.${cleanPackId}.Item.${itemId}`;
    const backgroundName = selectedOption.text;
    const article = /^[aeiou]/i.test(backgroundName) ? game.i18n.localize('hm.app.equipment.article-plural') : game.i18n.localize('hm.app.equipment.article');

    const content = game.i18n.format('hm.app.background.summary', {
      article: article,
      name: `@UUID[${uuid}]{${backgroundName}}`
    });
    summary.innerHTML = await TextEditor.enrichHTML(content);
  }

  static async updateClassRaceSummary() {
    const raceSelect = document.querySelector('#race-dropdown');
    const classSelect = document.querySelector('#class-dropdown');
    const summary = document.querySelector('.class-race-summary');

    if (!summary || !raceSelect || !classSelect) return;

    const createLink = (select) => {
      const option = select.options[select.selectedIndex];
      if (!option?.value) return null;

      const [itemId, packId] = option.value.split(' (');
      if (!itemId || !packId) return null;

      const cleanPackId = packId.slice(0, -1);
      const uuid = `Compendium.${cleanPackId}.Item.${itemId}`;
      return `@UUID[${uuid}]{${option.text}}`;
    };

    const raceLink = createLink(raceSelect) || game.i18n.format('hm.unknown', { type: 'race' });
    const classLink = createLink(classSelect) || game.i18n.format('hm.unknown', { type: 'class' });

    const content = game.i18n.format('hm.app.finalize.class-race-summary', {
      race: raceLink,
      class: classLink
    });
    summary.innerHTML = await TextEditor.enrichHTML(content);
  }

  static async updateEquipmentSummary() {
    const priorityTypes = ['weapon', 'armor', 'shield'];

    let selectedEquipment = Array.from(document.querySelectorAll('#equipment-container select, #equipment-container input[type="checkbox"]:checked'))
      .map((el) => {
        const link = el.type === 'checkbox' ? el.parentElement?.querySelector('.content-link') : el.options?.[el.selectedIndex];
        const uuid = el.type === 'checkbox' ? link?.dataset?.uuid : el.value;

        if (!link || !uuid || uuid.includes(',') || !uuid.includes('Compendium')) return null;

        return {
          type: link.dataset.tooltip?.toLowerCase() || '',
          uuid: uuid,
          text: link.textContent?.trim()
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const aIndex = priorityTypes.indexOf(a.type);
        const bIndex = priorityTypes.indexOf(b.type);
        return (bIndex === -1 ? -999 : bIndex) - (aIndex === -1 ? -999 : aIndex);
      })
      .map((item) => `@UUID[${item.uuid}]{${item.text}}`);

    const summary = document.querySelector('.equipment-summary');
    if (summary && selectedEquipment.length) {
      const randomEquipment = selectedEquipment.slice(0, 3);
      const formattedItems = randomEquipment.map((item) => {
        const itemName = item.match(/{([^}]+)}/)[1];
        const article = /^[aeiou]/i.test(itemName) ? game.i18n.localize('hm.app.equipment.article-plural') : game.i18n.localize('hm.app.equipment.article');
        return `${article} ${item}`;
      });

      const content = game.i18n.format('hm.app.equipment.summary', {
        items:
          formattedItems.slice(0, -1).join(game.i18n.localize('hm.app.equipment.separator')) + (formattedItems.length > 1 ? game.i18n.localize('hm.app.equipment.and') : '') + formattedItems.slice(-1)
      });
      summary.innerHTML = await TextEditor.enrichHTML(content);
    }
  }

  static async updateAbilitiesSummary() {
    const abilityBlocks = document.querySelectorAll('.ability-block');
    const abilityScores = {};
    const rollMethod = game.settings.get(HM.CONFIG.ID, 'diceRollingMethod');

    abilityBlocks.forEach((block) => {
      let score = 0;
      if (rollMethod === 'pointBuy') {
        score = parseInt(block.querySelector('.current-score')?.innerHTML) || 0;
      } else if (rollMethod === 'standardArray') {
        score = parseInt(block.querySelector('.ability-dropdown')?.value) || 0;
      } else if (rollMethod === 'manualFormula') {
        score = parseInt(block.querySelector('.ability-score')?.value) || 0;
      }

      const abilityKey = block.querySelector('.ability-label')?.innerHTML;
      if (abilityKey) {
        abilityScores[abilityKey] = score;
      }
    });

    const sortedAbilities = Object.entries(abilityScores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([name]) => name.toLowerCase());

    const abilitiesSummary = document.querySelector('.abilities-summary');
    if (abilitiesSummary && sortedAbilities.length >= 2) {
      const content = game.i18n.format('hm.app.abilities.summary', {
        action: game.i18n.localize('hm.app.abilities.excels'),
        first: `&Reference[${sortedAbilities[0]}]`,
        second: `&Reference[${sortedAbilities[1]}]`
      });
      abilitiesSummary.innerHTML = await TextEditor.enrichHTML(content);
    } else if (abilitiesSummary) {
      abilitiesSummary.innerHTML = game.i18n.localize('hm.app.abilities.default');
    }
  }

  updateCharacterPortrait(imagePath) {
    const portraitImg = document.querySelector('.character-portrait img');
    if (portraitImg) {
      portraitImg.src = imagePath;
    }
  }

  static initializePortrait() {
    const portraitContainer = document.querySelector('.character-portrait');
    if (portraitContainer) {
      const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
      const randomAbility = abilities[Math.floor(Math.random() * abilities.length)];
      const defaultImage = `systems/dnd5e/icons/svg/abilities/${randomAbility}.svg`;

      const portraitImg = portraitContainer.querySelector('img');
      if (portraitImg) {
        portraitImg.src = defaultImage;
      }

      // Add name and art path update handling
      const nameInput = document.querySelector('#character-name');
      const artInput = document.querySelector('#character-art-path');
      const portraitName = document.querySelector('.header-section h2');

      const updatePortrait = () => {
        if (portraitName) {
          portraitName.innerHTML = nameInput?.value || game.user.name;
        }
        if (portraitImg && artInput) {
          portraitImg.src = artInput.value || defaultImage;
        }
      };

      nameInput?.addEventListener('change', updatePortrait);
      artInput?.addEventListener('change', updatePortrait);
      updatePortrait();
    }
  }

  static initializeRollButtons() {
    const rollButtons = document.querySelectorAll('.roll-btn');
    const backgroundSelect = document.querySelector('#background-dropdown');

    HM.log(3, 'Found roll buttons:', rollButtons);
    HM.log(3, 'Found background select:', backgroundSelect);

    rollButtons.forEach((button) => (button.disabled = true));

    backgroundSelect?.addEventListener('change', (event) => {
      const backgroundId = event.target.value.split(' (')[0];
      HM.log(3, 'Background changed to:', backgroundId);
      rollButtons.forEach((button) => (button.disabled = !backgroundId));
    });

    rollButtons.forEach((button) => {
      HM.log(3, 'Adding click listener to button:', button);

      button.addEventListener('click', async (event) => {
        HM.log(3, 'Roll button clicked');

        const tableType = event.currentTarget.dataset.table;
        const textarea = event.currentTarget.closest('.input-with-roll').querySelector('textarea');

        HM.log(3, 'Table type:', tableType);
        HM.log(3, 'Found textarea:', textarea);

        const backgroundId = backgroundSelect?.value.split(' (')[0];
        HM.log(3, 'Current background ID:', backgroundId);

        if (!backgroundId) {
          ui.notifications.warn(game.i18n.localize('hm.warnings.select-background'));
          return;
        }

        const result = await TableManager.rollForCharacteristic(backgroundId, tableType);
        HM.log(3, 'Roll result:', result);

        if (result) {
          textarea.value = textarea.value ? `${textarea.value} ${result}` : result;

          // Trigger change event on textarea to update form data
          textarea.dispatchEvent(new Event('change', { bubbles: true }));

          if (TableManager.isTableExhausted(backgroundId, tableType)) {
            button.disabled = true;
          }
        }
      });
    });
  }

  static async handleBackgroundChange(selectedBackground) {
    if (!selectedBackground?.selectedValue) {
      return;
    }

    const [itemId, packId] = selectedBackground.selectedValue.split(' (');
    const cleanPackId = packId.slice(0, -1);
    const uuid = `Compendium.${cleanPackId}.Item.${itemId}`;

    const background = await fromUuid(uuid);
    if (background) {
      await TableManager.initializeTablesForBackground(background);

      const rollButtons = document.querySelectorAll('.roll-btn');
      rollButtons.forEach((button) => (button.disabled = false));
    }
  }

  static getSummaryForChat() {
    const characterName = document.querySelector('#character-name')?.value || game.user.name;

    const summaries = {
      classRace: document.querySelector('.class-race-summary')?.innerHTML || '',
      background: document.querySelector('.background-summary')?.innerHTML || '',
      abilities: document.querySelector('.abilities-summary')?.innerHTML || '',
      equipment: document.querySelector('.equipment-summary')?.innerHTML || ''
    };

    let message = `
    <div class="character-summary" style="line-height: 1.7; margin: 0.5em 0;">
        <h2 style="margin-bottom: 0.5em">${characterName}</h2>
        <hr style="margin: 0.5em 0">
    `;

    if (summaries.classRace) {
      message += `<span class="summary-section class-race">${summaries.classRace}</span> `;
    }

    if (summaries.background) {
      message += `<span class="summary-section background">${summaries.background}</span> `;
    }

    if (summaries.abilities) {
      message += `<span class="summary-section abilities">${summaries.abilities}</span> `;
    }

    if (summaries.equipment) {
      message += `<span class="summary-section equipment">${summaries.equipment}</span>`;
    }

    message += '</div>';

    return message;
  }
}
