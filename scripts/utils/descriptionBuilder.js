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
    this.container.innerHTML = '<div class="journal-loading"><i class="fas fa-spinner fa-spin"></i> Loading journal content...</div>';

    try {
      let document = null;
      let page = null;

      // Check if this is a compendium reference
      if (pageId.includes('.')) {
        HM.log(3, `Parsing compendium reference: ${pageId}`);
        try {
          // Try to load it as a direct UUID
          document = await fromUuid(`Compendium.${pageId}`);
          HM.log(3, 'Loaded document:', document);

          // If we got a JournalEntry (not a page)
          if (document && document.documentName === 'JournalEntry') {
            if (document.pages.size > 0) {
              // If we have an item name, try to find a matching page
              if (itemName) {
                page = document.pages.find((p) => p.name === itemName || p.name.includes(itemName));
                if (page) {
                  HM.log(3, `Found matching page "${page.name}" for ${itemName}`);
                }
              }

              // If no matching page found, fall back to the first page
              if (!page) {
                page = document.pages.contents[0];
                HM.log(3, `Using first page from journal entry: ${page.name}`);
              }
            }
          } else if (document && document.documentName === 'JournalEntryPage') {
            // We already have a page
            page = document;
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
