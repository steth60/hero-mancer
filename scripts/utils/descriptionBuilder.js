import { HM } from './index.js';
/**
 * A class for embedding journal pages inside other applications.
 */
export class JournalPageEmbed {
  /**
   * @param {HTMLElement} container - The container element where the journal page will be embedded
   * @param {object} options - Configuration options
   */
  constructor(container, options = {}) {
    this.container = container;
    this.options = foundry.utils.mergeObject(
      {
        editable: false,
        height: 'auto',
        width: '100%',
        scrollable: true
      },
      options
    );

    this.sheet = null;
    this.pageId = null;
  }

  /**
   * Render a journal page inside the container
   * @param {string} pageId - The ID of the journal page to embed
   * @param {string} [itemName] - Optional name of the item (class/race/background) to match
   * @returns {Promise<JournalPageEmbed|null>}
   */
  async render(pageId, itemName = null) {
    // Log that we're attempting to render a journal page
    HM.log(3, `Attempting to render journal page ${pageId}${itemName ? ` for ${itemName}` : ''}`);

    // Clear container while we load
    this.container.innerHTML = `<div class="journal-loading"><i class="fas fa-spinner fa-spin"></i>${game.i18n.localize('hm.app.journal-loading')}</div>`;

    try {
      let journalDoc = null;
      let page = null;

      // Check if this is a compendium reference
      if (pageId.includes('.')) {
        HM.log(3, `Parsing compendium reference: ${pageId}`);
        try {
          // Try to load it as a direct UUID
          journalDoc = await fromUuid(`Compendium.${pageId}`);
          HM.log(3, 'Loaded document:', journalDoc);

          // If we got a JournalEntry (not a page)
          if (journalDoc && journalDoc.documentName === 'JournalEntry') {
            if (journalDoc.pages.size > 0) {
              // If we have an item name, try to find a matching page
              if (itemName) {
                // Normalize itemName for better matching
                const normalizedName = this._normalizeItemName(itemName);

                // Try to find a matching page
                page = this._findMatchingPage(journalDoc.pages, normalizedName);

                if (page) {
                  HM.log(3, `Found matching page "${page.name}" for ${itemName}`);
                }
              }

              // If no matching page found, fall back to the first page
              if (!page) {
                page = journalDoc.pages.contents[0];
                HM.log(3, `Using first page from journal entry: ${page.name}`);
              }
            }
          } else if (journalDoc && journalDoc.documentName === 'JournalEntryPage') {
            // We already have a page
            page = journalDoc;
          }
        } catch (err) {
          HM.log(2, `Error loading compendium page: ${err}`);
        }
      }

      if (!page) {
        HM.log(2, `Journal page ${pageId} not found`);
        return null;
      }

      HM.log(3, 'Page to render:', page);

      // For simple text pages, render the content directly
      if (page.type === 'text' && page.text?.content) {
        this.container.innerHTML = '';

        const contentDiv = document.createElement('div');
        contentDiv.classList.add('journal-page-content');
        contentDiv.innerHTML = await TextEditor.enrichHTML(page.text.content);

        this.container.appendChild(contentDiv);
        this.pageId = page.id;

        HM.log(3, `Text page ${page.id} rendered directly`);
        return this;
      }

      // For other page types, use the sheet approach
      try {
        const sheetClass = page._getSheetClass();
        this.sheet = new sheetClass(page, { editable: this.options.editable });
        this.pageId = page.id;

        // Prepare the container
        this.container.classList.add('journal-page-embed');
        if (this.options.scrollable) {
          this.container.classList.add('scrollable');
        }

        // Render the sheet content
        const data = await this.sheet.getData();
        const view = await this.sheet._renderInner(data);

        // Clear and add the content
        this.container.innerHTML = '';

        // Handle the view properly based on what _renderInner returns
        if (view instanceof jQuery) {
          // If it's a jQuery object, append it directly
          view.appendTo(this.container);
        } else if (view instanceof HTMLElement || view instanceof DocumentFragment) {
          // If it's a DOM element or fragment, append it
          this.container.appendChild(view);
        } else if (typeof view === 'string') {
          // If it's an HTML string, set it as innerHTML
          this.container.innerHTML = view;
        } else {
          // Log what we got and show an error
          HM.log(2, 'Unexpected return type from _renderInner:', typeof view);
          this.container.innerHTML = '<div class="notification error">Error rendering content: Unexpected format</div>';
          return null;
        }

        // Activate listeners
        this.sheet._activateCoreListeners($(this.container));
        this.sheet.activateListeners($(this.container));

        // Handle TOC if applicable
        if (this.sheet.toc) {
          this._renderHeadings();
        }

        // Signal completion
        this.sheet._callHooks('render', $(this.container), data);

        HM.log(3, `Journal page ${this.pageId} rendered successfully`);
        return this;
      } catch (error) {
        HM.log(1, `Error with sheet rendering: ${error.message}`);

        // Fallback for failures in the sheet approach
        this.container.innerHTML = `
        <div class="notification warning">Simplified view of ${page.name}</div>
        <h2>${page.name}</h2>
        <div class="journal-content">${page.text?.content || 'No content available'}</div>
      `;

        return this;
      }
    } catch (error) {
      HM.log(1, `Error rendering journal page ${pageId}: ${error.message}`);
      this.container.innerHTML = `<div class="notification error">Error rendering journal page: ${error.message}</div>`;
      return null;
    }
  }

  /**
   * Render headings from the page's table of contents
   * @private
   */
  _renderHeadings() {
    if (!this.sheet.toc || Object.keys(this.sheet.toc).length === 0) return;

    const headings = Object.values(this.sheet.toc);
    headings.forEach(({ element, slug }) => {
      if (element) element.dataset.anchor = slug;
    });
  }

  /**
   * Normalize an item name for matching
   * @param {string} name - The item name to normalize
   * @returns {string} - Normalized name
   * @private
   */
  _normalizeItemName(name) {
    if (!name) return '';
    // Remove content in parentheses
    return name.split('(')[0].trim();
  }

  /**
   * Find a matching page for an item
   * @param {Collection} pages - Collection of pages to search
   * @param {string} itemName - Item name to match against
   * @returns {JournalEntryPage|null} - Matching page or null
   * @private
   */
  _findMatchingPage(pages, itemName) {
    if (!pages || pages.size === 0 || !itemName) return null;

    const normalizedItemName = itemName.toLowerCase();
    const specialRaces = ['elf', 'gnome', 'tiefling']; // Races that need special handling
    const isSpecialRace = specialRaces.some((race) => normalizedItemName.includes(race.toLowerCase()));

    HM.log(3, `JournalPageEmbed: Looking for page matching "${itemName}" among ${pages.size} pages`);

    // Log available pages for debugging
    const pageNames = Array.from(pages).map((p) => p.name);
    HM.log(3, `JournalPageEmbed: Available pages: ${pageNames.join(', ')}`);

    // Create a filtered list excluding art handouts
    const filteredPages = Array.from(pages).filter((p) => !p.name.toLowerCase().includes('handout') && !p.name.toLowerCase().includes('art'));

    if (filteredPages.length < pages.size) {
      HM.log(3, `JournalPageEmbed: Filtered out ${pages.size - filteredPages.length} art/handout pages`);
    }

    // FIRST PRIORITY: Exact match (case-sensitive)
    let match = filteredPages.find((p) => p.name === itemName);
    if (match) {
      HM.log(3, `JournalPageEmbed: Found exact case-sensitive match "${match.name}"`);
      return match;
    }

    // SECOND PRIORITY: Case-insensitive exact match
    match = filteredPages.find((p) => p.name.toLowerCase() === normalizedItemName);
    if (match) {
      HM.log(3, `JournalPageEmbed: Found exact case-insensitive match "${match.name}"`);
      return match;
    }

    // THIRD PRIORITY: For special races, check base race name
    if (isSpecialRace) {
      const baseRaceName = this._getBaseRaceName(itemName);
      if (baseRaceName) {
        match = filteredPages.find((p) => p.name.toLowerCase() === baseRaceName.toLowerCase());
        if (match) {
          HM.log(3, `JournalPageEmbed: Found base race match "${match.name}" for "${itemName}"`);
          return match;
        }
      }
    }

    // FOURTH PRIORITY: Substantial partial matches (avoid short-name false positives)
    for (const page of filteredPages) {
      const pageName = page.name.toLowerCase();

      // Skip very short page names to avoid matching with things like "A" in "Spells A-Z"
      if (pageName.length < 3) continue;

      // Substantial content match
      if (pageName.includes(normalizedItemName) && normalizedItemName.length > 3) {
        HM.log(3, `JournalPageEmbed: Found partial match "${page.name}" containing "${itemName}"`);
        return page;
      }

      if (normalizedItemName.includes(pageName) && pageName.length > 3) {
        HM.log(3, `JournalPageEmbed: Found partial match "${page.name}" contained in "${itemName}"`);
        return page;
      }
    }

    // If nothing found in filtered pages, try the full set as a fallback
    HM.log(3, 'JournalPageEmbed: No match in filtered pages, trying full set as fallback');
    return this._findFallbackMatch(pages, itemName);
  }

  /**
   * Fallback matching logic for when no match is found in filtered pages
   * @param {Collection} pages - Collection of pages to search
   * @param {string} itemName - Item name to match against
   * @returns {JournalEntryPage|null} - Matching page or null
   * @private
   */
  _findFallbackMatch(pages, itemName) {
    const normalizedItemName = itemName.toLowerCase();

    // Try exact match first
    let match = pages.find((p) => p.name.toLowerCase() === normalizedItemName);
    if (match) return match;

    // Try base name for special races
    const specialRaces = ['elf', 'gnome', 'tiefling'];
    if (specialRaces.some((race) => normalizedItemName.includes(race.toLowerCase()))) {
      const baseRaceName = this._getBaseRaceName(itemName);
      if (baseRaceName) {
        match = pages.find((p) => p.name.toLowerCase() === baseRaceName.toLowerCase());
        if (match) return match;
      }
    }

    return null;
  }

  /**
   * Get the base race name for special races
   * @param {string} raceName - Full race name
   * @returns {string|null} - Base race name or null
   * @private
   */
  _getBaseRaceName(raceName) {
    if (!raceName) return null;

    // Handle comma format: "Elf, High" -> "Elf"
    if (raceName.includes(',')) {
      return raceName.split(',')[0].trim();
    }

    // Handle space format
    const lowerName = raceName.toLowerCase();

    if (lowerName.includes('elf') && raceName.includes(' ')) {
      return 'Elf';
    }

    if (lowerName.includes('gnome') && raceName.includes(' ')) {
      return 'Gnome';
    }

    if (lowerName.includes('tiefling') && raceName.includes(' ')) {
      return 'Tiefling';
    }

    return null;
  }

  /**
   * Navigate to a specific anchor within the journal page
   * @param {string} anchor - The anchor slug to navigate to
   */
  goToAnchor(anchor) {
    if (!this.sheet?.toc || !anchor) return;
    const heading = this.sheet.toc[anchor];
    if (heading?.element) {
      heading.element.scrollIntoView({ behavior: 'smooth' });
    }
  }

  /**
   * Clean up resources when removing the embed
   */
  close() {
    this.container.innerHTML = '';
    this.sheet = null;
    this.pageId = null;
  }
}
