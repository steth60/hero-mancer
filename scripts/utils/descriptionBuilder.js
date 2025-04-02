import { HM } from './index.js';
/**
 * Build descriptions from journal pages.
 * @class
 */
export class DescriptionBuilder {
  /**
   * Generates a comprehensive  description.
   * @param {Object} doc - The  document
   * @returns {Promise<string>} HTML content for the class
   * @private
   */
  static async _generateDescription(doc) {
    // Default fallback description
    const fallbackDescription = doc.system?.description?.value || game.i18n.localize('hm.app.no-description');

    // If document isn't a class/race/background, return the fallback
    if (!['class', 'race', 'background'].includes(doc.type)) {
      return fallbackDescription;
    }

    // For classes, generate full class description
    if (doc.type === 'class') {
      return await this.#generateClassDescription(doc);
    }

    // For races, generate race description
    if (doc.type === 'race') {
      return await this.#generateRaceDescription(doc);
    }

    // For backgrounds, generate background description
    if (doc.type === 'background') {
      return await this.#generateBackgroundDescription(doc);
    }

    return fallbackDescription;
  }

  /**
   * Generates a comprehensive class description with features, tables, etc.
   * @param {Object} classDoc - The class document
   * @returns {Promise<string>} HTML content for the class
   * @private
   */
  static async #generateClassDescription(classDoc) {
    if (!classDoc) return '';

    // Determine style (modern 2024 or legacy 2014)
    const modernStyle = classDoc.system?.source?.rules === '2024';

    // Build HTML structure
    let html = '<div class="class-journal">';

    // Core traits table
    html += await this.#buildCoreTraitsTable(classDoc);

    // Basic description
    if (classDoc.system?.description?.value) {
      html += `<div class="description">${classDoc.system.description.value}</div>`;
    }

    // Class features table
    html += await this.#buildClassTable(classDoc, { modernStyle });

    // Class features details
    html += await this.#buildClassFeatures(classDoc, { modernStyle });

    // Add subclasses
    html += await this.#buildSubclasses(classDoc);

    html += '</div>';

    return await TextEditor.enrichHTML(html);
  }

  /**
   * Builds the core traits table for a class
   * @param {Object} classDoc - The class document
   * @returns {Promise<string>} HTML for the core traits table
   * @private
   */
  static async #buildCoreTraitsTable(classDoc) {
    let html = `
    <table class="core-traits">
    <caption>Core ${classDoc.name} Traits</caption>
    <tbody>`;

    // Primary Ability
    if (classDoc.system?.primaryAbility?.value) {
      const abilities = Array.from(classDoc.system.primaryAbility.value)
        .map((a) => CONFIG.DND5E.abilities[a]?.label || a)
        .join(' and ');

      html += `
      <tr>
        <th scope="row">Primary Ability</th>
        <td>${abilities}</td>
      </tr>`;
    }

    // Hit Die
    if (classDoc.system?.hd) {
      html += `
      <tr>
        <th scope="row">Hit Point Die</th>
        <td>${classDoc.system.hd.denomination} per ${classDoc.name} level</td>
      </tr>`;
    }

    // Saving Throws - extracted from the advancement
    if (classDoc.advancement?.byType?.Trait) {
      const savesTraits = classDoc.advancement.byType.Trait.filter((a) => a.level === 1 && a.configuration.grants?.some((g) => typeof g === 'string' && g.startsWith('saves:')));

      if (savesTraits.length) {
        // Safely get save names
        let saveNames = [];
        for (const trait of savesTraits) {
          const grants = trait.configuration.grants;
          if (grants instanceof Set) {
            // Handle Set by converting to Array first
            saveNames.push(
              ...Array.from(grants)
                .filter((g) => typeof g === 'string' && g.startsWith('saves:'))
                .map((g) => CONFIG.DND5E.abilities[g.split(':')[1]]?.label || g.split(':')[1])
            );
          } else if (Array.isArray(grants)) {
            saveNames.push(...grants.filter((g) => typeof g === 'string' && g.startsWith('saves:')).map((g) => CONFIG.DND5E.abilities[g.split(':')[1]]?.label || g.split(':')[1]));
          }
        }

        html += `
      <tr>
        <th scope="row">Saving Throw Proficiencies</th>
        <td>${saveNames.join(' and ')}</td>
      </tr>`;
      }
    }

    // Skills
    if (classDoc.advancement?.byType?.Trait) {
      const skillTraits = classDoc.advancement.byType.Trait.filter((a) => a.level === 1 && a.configuration.choices?.some((c) => c.pool));

      if (skillTraits.length) {
        const skillTrait = skillTraits[0];
        const choices = skillTrait.configuration.choices[0];
        const skillCount = choices.count || 2;

        // Handle different pool structures safely
        let skills = '';
        if (choices.pool) {
          if (Array.isArray(choices.pool)) {
            // If pool is an array of strings
            skills = choices.pool
              .filter((p) => typeof p === 'string')
              .map((p) => {
                const skill = p.startsWith('skills:') ? p.split(':')[1] : p;
                return CONFIG.DND5E.skills[skill]?.label || skill;
              })
              .join(', ');
          } else if (typeof choices.pool === 'object') {
            // If pool is an object with skill keys
            skills = Object.keys(choices.pool)
              .filter((key) => choices.pool[key])
              .map((key) => CONFIG.DND5E.skills[key]?.label || key)
              .join(', ');
          }
        }

        html += `
      <tr>
        <th scope="row">Skill Proficiencies</th>
        <td>Choose ${skillCount} from ${skills || 'available skills'}</td>
      </tr>`;
      }
    }

    // Weapons
    if (classDoc.advancement?.byType?.Trait) {
      const weaponTraits = classDoc.advancement.byType.Trait.filter((a) => a.level === 1 && a.configuration.grants?.some((g) => typeof g === 'string' && g.startsWith('weapon:')));

      if (weaponTraits.length) {
        // Safely get weapon proficiencies
        let weaponNames = [];
        for (const trait of weaponTraits) {
          const grants = trait.configuration.grants;
          if (grants instanceof Set) {
            // Handle Set by converting to Array first
            weaponNames.push(
              ...Array.from(grants)
                .filter((g) => typeof g === 'string' && g.startsWith('weapon:'))
                .map((g) => CONFIG.DND5E.weaponProficiencies[g.split(':')[1]] || g.split(':')[1])
            );
          } else if (Array.isArray(grants)) {
            weaponNames.push(...grants.filter((g) => typeof g === 'string' && g.startsWith('weapon:')).map((g) => CONFIG.DND5E.weaponProficiencies[g.split(':')[1]] || g.split(':')[1]));
          }
        }

        html += `
      <tr>
        <th scope="row">Weapon Proficiencies</th>
        <td>${weaponNames.join(' and ')}</td>
      </tr>`;
      }
    }

    // Armor
    if (classDoc.advancement?.byType?.Trait) {
      const armorTraits = classDoc.advancement.byType.Trait.filter((a) => a.level === 1 && a.configuration.grants?.some((g) => typeof g === 'string' && g.startsWith('armor:')));

      if (armorTraits.length) {
        // Safely get armor proficiencies
        let armorNames = [];
        for (const trait of armorTraits) {
          const grants = trait.configuration.grants;
          if (grants instanceof Set) {
            // Handle Set by converting to Array first
            armorNames.push(
              ...Array.from(grants)
                .filter((g) => typeof g === 'string' && g.startsWith('armor:'))
                .map((g) => CONFIG.DND5E.armorProficiencies[g.split(':')[1]] || g.split(':')[1])
            );
          } else if (Array.isArray(grants)) {
            armorNames.push(...grants.filter((g) => typeof g === 'string' && g.startsWith('armor:')).map((g) => CONFIG.DND5E.armorProficiencies[g.split(':')[1]] || g.split(':')[1]));
          }
        }

        html += `
      <tr>
        <th scope="row">Armor Proficiencies</th>
        <td>${armorNames.join(', ')}</td>
      </tr>`;
      }
    }

    // Starting Equipment
    if (classDoc.system?.wealth) {
      html += `
      <tr>
        <th scope="row">Starting Equipment</th>
        <td>${classDoc.system.startingEquipmentDescription || `${classDoc.system.wealth} gold`}</td>
      </tr>`;
    }

    html += `
    </tbody>
    </table>`;

    return html;
  }

  /**
   * Builds the class advancement table with features and progressions
   * @param {Object} classDoc - The class document
   * @param {Object} options - Options for table generation
   * @param {boolean} options.modernStyle - Whether to use modern style formatting
   * @returns {Promise<string>} HTML table
   * @private
   */
  static async #buildClassTable(classDoc, { modernStyle }) {
    if (!classDoc.advancement) return '';

    let html = `
    <h2>Class Features</h2>
    <p>As a ${classDoc.name}, you gain the following class features when you reach the specified levels.</p>
    <table class="features-table">
      <caption>The ${classDoc.name}</caption>
      <colgroup>
        <col class="level">
        <col class="prof">
        <col class="features">`;

    // Check for scale values
    const scaleValues = classDoc.advancement.byType.ScaleValue || [];
    if (scaleValues.length) {
      html += `<col span="${scaleValues.length}" class="scale">`;
    }

    html += `
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Level</th>
          <th scope="col">Proficiency Bonus</th>
          <th scope="col">Features</th>`;

    // Add column headers for scale values
    for (const scale of scaleValues) {
      html += `<th scope="col">${scale.title}</th>`;
    }

    html += `
        </tr>
      </thead>
      <tbody>`;

    // Add rows for each level
    for (let level = 1; level <= 20; level++) {
      const features = [];

      // Get features for this level
      for (const advancement of classDoc.advancement.byLevel[level] || []) {
        if (advancement.constructor.typeName === 'AbilityScoreImprovement') {
          features.push('Ability Score Improvement');
        } else if (advancement.constructor.typeName === 'ItemGrant' && !advancement.configuration.optional) {
          for (const item of advancement.configuration.items) {
            try {
              const feature = fromUuidSync(item.uuid);
              if (feature) {
                features.push(`<a class="content-link" data-uuid="${item.uuid}">${feature.name}</a>`);
              }
            } catch (error) {
              // Skip if we can't load it
              HM.log(2, `Couldn't load feature: ${item.uuid}`, error);
            }
          }
        }
      }

      // Create row
      html += `
      <tr>
        <td class="level">${modernStyle ? level : this.#ordinalSuffix(level)}</td>
        <td class="prof">+${Math.floor(1 + (level - 1) / 4)}</td>
        <td class="features">${features.join(', ')}</td>`;

      // Add scale values
      for (const scale of scaleValues) {
        const value = scale.configuration.scale[level]?.value || '';
        html += `<td class="scale">${value}</td>`;
      }

      html += '</tr>';
    }

    html += `
      </tbody>
    </table>`;

    return html;
  }

  /**
   * Adds ordinal suffix to a number
   * @param {number} n - The number
   * @returns {string} Number with ordinal suffix (1st, 2nd, etc)
   * @private
   */
  static #ordinalSuffix(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  /**
   * Builds detailed class features descriptions
   * @param {Object} classDoc - The class document
   * @param {Object} options - Options for feature generation
   * @param {boolean} options.modernStyle - Whether to use modern style formatting
   * @returns {Promise<string>} HTML content for features
   * @private
   */
  static async #buildClassFeatures(classDoc, { modernStyle }) {
    if (!classDoc.advancement) return '';

    let html = '';
    const features = [];

    // Group features by level
    for (let level = 1; level <= 20; level++) {
      const advancements = classDoc.advancement.byLevel[level] || [];

      for (const advancement of advancements) {
        if (advancement.constructor.typeName === 'ItemGrant' && !advancement.configuration.optional) {
          for (const item of advancement.configuration.items) {
            try {
              const feature = fromUuidSync(item.uuid);
              if (feature?.type === 'feat') {
                features.push({
                  level,
                  name: feature.name,
                  description: feature.system?.description?.value || ''
                });
              }
            } catch (error) {
              // Skip if we can't load it
              HM.log(2, `Couldn't load feature: ${item.uuid}`, error);
            }
          }
        } else if (advancement.constructor.typeName === 'AbilityScoreImprovement') {
          features.push({
            level,
            name: 'Ability Score Improvement',
            description: 'You gain the Ability Score Improvement feat or another feat of your choice for which you qualify.'
          });
        }
      }
    }

    // Sort features by level
    features.sort((a, b) => a.level - b.level);

    // Build HTML for each feature
    for (const feature of features) {
      const featureName = modernStyle ? `Level ${feature.level}: ${feature.name}` : feature.name;

      html += `
      <h4>${featureName}</h4>
      <div class="feature-description">${feature.description}</div>`;
    }

    return html;
  }

  /**
   * Builds subclasses section
   * @param {Object} classDoc - The class document
   * @returns {Promise<string>} HTML content for subclasses
   * @private
   */
  static async #buildSubclasses(classDoc) {
    // Try to find journal with subclasses
    const packMatch = classDoc.pack?.match(/^([^.]+)\./);
    if (!packMatch) return '';

    const moduleId = packMatch[1];
    const journalPacks = game.packs.filter((p) => p.metadata.type === 'JournalEntry' && p.metadata.id.startsWith(moduleId));

    let html = '';
    let foundSubclasses = false;

    for (const pack of journalPacks) {
      const index = await pack.getIndex();
      const journalEntry = index.find((j) => j.name === classDoc.name);

      if (journalEntry) {
        const journal = await pack.getDocument(journalEntry._id);

        // Find subclass pages
        const subclassPages = journal.pages.contents.filter((p) => p.type === 'subclass');
        if (subclassPages.length) {
          // Add header if this is the first time we found subclasses
          if (!foundSubclasses) {
            html += `<h2>Subclasses</h2>
                   <p>A ${classDoc.name} subclass is a specialization that grants you features at certain levels, as specified in the subclass.</p>`;
            foundSubclasses = true;
          }

          // Add each subclass
          for (const subPage of subclassPages) {
            html += `
            <h3>${subPage.name}</h3>`;

            if (subPage.system?.description?.value) {
              html += subPage.system.description.value;
            } else if (subPage.text?.content) {
              html += subPage.text.content;
            }
          }
        }
      }
    }

    return html;
  }

  /**
   * Generates a comprehensive race description
   * @param {Object} raceDoc - The race document
   * @returns {Promise<string>} HTML content for the race
   * @private
   */
  static async #generateRaceDescription(raceDoc) {
    if (!raceDoc) return '';

    let html = '<div class="race-journal">';

    // Add basic description
    if (raceDoc.system?.description?.value) {
      html += `<div class="description">${raceDoc.system.description.value}</div>`;
    }

    // Add race traits
    if (raceDoc.advancement) {
      html += await this.#buildRaceTraits(raceDoc);
    }

    html += '</div>';

    return await TextEditor.enrichHTML(html);
  }

  /**
   * Builds race traits section
   * @param {Object} raceDoc - The race document
   * @returns {Promise<string>} HTML content for race traits
   * @private
   */
  static async #buildRaceTraits(raceDoc) {
    if (!raceDoc.advancement) return '';

    let html = `<h2>${raceDoc.name} Traits</h2>`;

    // Get traits from advancements
    const traits = [];
    for (const level in raceDoc.advancement.byLevel) {
      for (const advancement of raceDoc.advancement.byLevel[level]) {
        if (advancement.constructor.typeName === 'ItemGrant') {
          for (const item of advancement.configuration.items) {
            try {
              const trait = fromUuidSync(item.uuid);
              if (trait) {
                traits.push({
                  name: trait.name,
                  description: trait.system?.description?.value || ''
                });
              }
            } catch (error) {
              // Skip if we can't load it
              HM.log(2, `Couldn't load trait: ${item.uuid}`, error);
            }
          }
        }
      }
    }

    // Add ability score increases if available
    if (raceDoc.system?.abilities) {
      const increases = [];
      for (const [ability, data] of Object.entries(raceDoc.system.abilities)) {
        if (data?.value) {
          increases.push(`${CONFIG.DND5E.abilities[ability]?.label || ability} ${data.value > 0 ? `+${data.value}` : data.value}`);
        }
      }

      if (increases.length) {
        traits.unshift({
          name: 'Ability Score Increase',
          description: `Your ability scores each increase by the amount shown in the ${raceDoc.name} Ability Score Increases table.`
        });

        // Add ASI table
        html += `
        <table class="asi-table">
          <caption>${raceDoc.name} Ability Score Increases</caption>
          <tbody>
            <tr>`;

        for (const ability of Object.keys(CONFIG.DND5E.abilities)) {
          if (raceDoc.system.abilities[ability]) {
            html += `<th>${CONFIG.DND5E.abilities[ability]?.abbreviation || ability}</th>`;
          }
        }

        html += '</tr><tr>';

        for (const ability of Object.keys(CONFIG.DND5E.abilities)) {
          if (raceDoc.system.abilities[ability]) {
            const value = raceDoc.system.abilities[ability].value;
            html += `<td>${value > 0 ? `+${value}` : value}</td>`;
          }
        }

        html += '</tr></tbody></table>';
      }
    }

    // Add traits
    for (const trait of traits) {
      html += `
      <h3>${trait.name}</h3>
      <div class="trait-description">${trait.description}</div>`;
    }

    return html;
  }

  /**
   * Generates a comprehensive background description
   * @param {Object} bgDoc - The background document
   * @returns {Promise<string>} HTML content for the background
   * @private
   */
  static async #generateBackgroundDescription(bgDoc) {
    if (!bgDoc) return '';

    let html = '<div class="background-journal">';

    // Add basic description
    if (bgDoc.system?.description?.value) {
      html += `<div class="description">${bgDoc.system.description.value}</div>`;
    }

    // Add background features
    if (bgDoc.advancement) {
      html += await this.#buildBackgroundFeatures(bgDoc);
    }

    html += '</div>';

    return await TextEditor.enrichHTML(html);
  }

  /**
   * Builds background features section
   * @param {Object} bgDoc - The background document
   * @returns {Promise<string>} HTML content for background features
   * @private
   */
  static async #buildBackgroundFeatures(bgDoc) {
    if (!bgDoc.advancement) return '';

    let html = `<h2>${bgDoc.name} Features</h2>`;

    // Get skill proficiencies
    const skillTraits = bgDoc.advancement.byType?.Trait?.filter((a) => a.configuration.choices?.some((c) => c.pool)) || [];

    if (skillTraits.length) {
      html += '<h3>Skill Proficiencies</h3>';

      for (const trait of skillTraits) {
        const choices = trait.configuration.choices[0];
        if (!choices) continue;

        let skillList = [];
        if (choices.pool) {
          if (Array.isArray(choices.pool)) {
            skillList = choices.pool
              .filter((p) => typeof p === 'string')
              .map((p) => {
                const skill = p.startsWith('skills:') ? p.split(':')[1] : p;
                return CONFIG.DND5E.skills[skill]?.label || skill;
              });
          } else if (choices.pool instanceof Set) {
            // Convert Set to Array first
            skillList = Array.from(choices.pool)
              .filter((p) => typeof p === 'string')
              .map((p) => {
                const skill = p.startsWith('skills:') ? p.split(':')[1] : p;
                return CONFIG.DND5E.skills[skill]?.label || skill;
              });
          }
        }

        const count = choices.count || 2;
        html += `<p>Choose ${count} from ${skillList.join(', ') || 'available skills'}</p>`;
      }
    }

    // Get other features from advancements
    const features = [];
    for (const level in bgDoc.advancement.byLevel) {
      for (const advancement of bgDoc.advancement.byLevel[level]) {
        if (advancement.constructor.typeName === 'ItemGrant') {
          for (const item of advancement.configuration.items) {
            try {
              const feature = fromUuidSync(item.uuid);
              if (feature) {
                features.push({
                  name: feature.name,
                  description: feature.system?.description?.value || ''
                });
              }
            } catch (error) {
              // Skip if we can't load it
              HM.log(2, `Couldn't load feature: ${item.uuid}`, error);
            }
          }
        }
      }
    }

    // Add features
    for (const feature of features) {
      html += `
      <h3>${feature.name}</h3>
      <div class="feature-description">${feature.description}</div>`;
    }

    return html;
  }
}
