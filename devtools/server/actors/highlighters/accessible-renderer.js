/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Actor, ActorClassWithSpec } = require("devtools/shared/protocol");
const {
  accessibleHighlighterRendererSpec,
} = require("devtools/shared/specs/accessibility");

const {
  HighlighterEnvironment,
} = require("devtools/server/actors/highlighters");

const {
  CanvasFrameAnonymousContentHelper,
  createNode,
  createSVGNode,
} = require("devtools/server/actors/highlighters/utils/markup");
// const { TEXT_NODE } = require("devtools/shared/dom-node-constants");
// const { setIgnoreLayoutChanges } = require("devtools/shared/layout/utils");

loader.lazyRequireGetter(
  this,
  "Infobar",
  "devtools/server/actors/highlighters/utils/accessibility",
  true
);

loader.lazyRequireGetter(
  this,
  "getHighlighterIframe",
  "devtools/server/actors/highlighters/utils/accessibility",
  true
);

loader.lazyRequireGetter(
  this,
  "ACCESSIBLE_HIGHLIGHTER_MESSAGES",
  "devtools/server/actors/highlighters/utils/accessibility",
  true
);

/**
 * The AccessibleHighlighterRenderer draws the bounds of an accessible object.
 *
 * @param {Number} options.x
 *        X coordinate of the top left corner of the accessible object
 * @param {Number} options.y
 *        Y coordinate of the top left corner of the accessible object
 * @param {Number} options.w
 *        Width of the the accessible object
 * @param {Number} options.h
 *        Height of the the accessible object
 * @param {Number} options.duration
 *        Duration of time that the highlighter should be shown.
 * @param {String|null} options.name
 *        Name of the the accessible object
 * @param {String} options.role
 *        Role of the the accessible object
 *
 * Structure:
 * <div class="highlighter-container" aria-hidden="true">
 *   <div class="accessible-root">
 *     <svg class="accessible-elements" hidden="true">
 *       <path class="accessible-bounds" points="..." />
 *     </svg>
 *     <div class="accessible-infobar-container">
 *      <div class="accessible-infobar">
 *        <div class="accessible-infobar-text">
 *          <span class="accessible-infobar-role">Accessible Role</span>
 *          <span class="accessible-infobar-name">Accessible Name</span>
 *        </div>
 *      </div>
 *     </div>
 *   </div>
 * </div>
 */

const AccessibleHighlighterRendererActor = ActorClassWithSpec(
  accessibleHighlighterRendererSpec,
  {
    initialize(conn, targetActor) {
      Actor.prototype.initialize.call(this, conn);
      this.targetActor = targetActor;

      this.ID_CLASS_PREFIX = "accessible-";
      this.accessibleInfobar = new Infobar(this);

      this.onMessage = this.onMessage.bind(this);
    },

    async bootstrap(isBrowserToolbox) {
      this.iframe = getHighlighterIframe({
        isBrowserToolbox,
        createIfNeeded: true,
        classList: ["accessible"],
      });
      this.iframe.addEventListener(
        "devtools/chrome/highlighter/message",
        this.onMessage
      );

      if (isBrowserToolbox) {
        return;
      }

      if (
        this.iframe.contentWindow.readyState != "interactive" &&
        this.iframe.contentWindow.readyState != "complete"
      ) {
        await new Promise(resolve => {
          this.iframe.contentWindow.addEventListener(
            "DOMContentLoaded",
            resolve,
            {
              once: true,
            }
          );
        });
      }

      this.buildHighlighterMarkup();
      this.show({ bounds: { left: 0, right: 1000, top: 97, bottom: 1097 } });
    },

    get win() {
      return this.iframe.contentWindow;
    },

    buildHighlighterMarkup() {
      this.highlighterEnv = new HighlighterEnvironment();
      this.highlighterEnv.initFromWindow(this.win);
      this.markup = new CanvasFrameAnonymousContentHelper(
        this.highlighterEnv,
        this._buildMarkup.bind(this)
      );
    },

    /**
     * Build highlighter markup.
     *
     * @return {Object} Container element for the highlighter markup.
     */
    _buildMarkup() {
      const container = createNode(this.win, {
        attributes: {
          class: "highlighter-container",
          "aria-hidden": "true",
        },
      });

      const root = createNode(this.win, {
        parent: container,
        attributes: {
          id: "root",
          class: "root",
        },
        prefix: this.ID_CLASS_PREFIX,
      });

      // Build the SVG element.
      const svg = createSVGNode(this.win, {
        nodeType: "svg",
        parent: root,
        attributes: {
          id: "elements",
          class: "elements",
          width: "100%",
          height: "100%",
          hidden: "true",
        },
        prefix: this.ID_CLASS_PREFIX,
      });

      createSVGNode(this.win, {
        nodeType: "path",
        parent: svg,
        attributes: {
          class: "bounds",
          id: "bounds",
        },
        prefix: this.ID_CLASS_PREFIX,
      });

      // Build the accessible's infobar markup.
      this.accessibleInfobar.buildMarkup(root);

      return container;
    },

    /**
     * Find an element in highlighter markup.
     *
     * @param  {String} id
     *         Highlighter markup elemet id attribute.
     * @return {DOMNode} Element in the highlighter markup.
     */
    getElement(id) {
      return this.markup.getElement(this.ID_CLASS_PREFIX + id);
    },

    /**
     * Show the highlighter on a given accessible.
     */
    show(options = {}) {
      const { mozInnerScreenX, mozInnerScreenY } = this.win;
      if (this._highlightTimer) {
        clearTimeout(this._highlightTimer);
        this._highlightTimer = null;
      }

      this.options = options;
      this._bounds = this.options.bounds;
      this._bounds.left -= mozInnerScreenX;
      this._bounds.right -= mozInnerScreenX;
      this._bounds.top -= mozInnerScreenY;
      this._bounds.bottom -= mozInnerScreenY;

      const { duration } = this.options;
      const { left, right, top, bottom } = this._bounds;

      const boundsEl = this.getElement("bounds");
      const path = `M${left},${top} L${right},${top} L${right},${bottom} L${left},${bottom}`;
      boundsEl.setAttribute("d", path);

      this._showAccessibleBounds();
      this.accessibleInfobar.show();

      if (duration) {
        this._highlightTimer = setTimeout(() => {
          this.hide();
        }, duration);
      }
    },

    /**
     * Hide the highlighter.
     */
    hide() {
      this._hideAccessibleBounds();
      this.accessibleInfobar.hide();
      this.options = null;
      this._bounds = null;
    },

    /**
     * Public API method to temporarily hide accessible bounds for things like
     * color contrast calculation.
     */
    hideAccessibleBounds() {
      if (this.getElement("elements").hasAttribute("hidden")) {
        return;
      }

      this._hideAccessibleBounds();
      this._shouldRestoreBoundsVisibility = true;
    },

    /**
     * Public API method to show accessible bounds in case they were temporarily
     * hidden.
     */
    showAccessibleBounds() {
      if (this._shouldRestoreBoundsVisibility) {
        this._showAccessibleBounds();
      }
    },

    /**
     * Hide the accessible bounds container.
     */
    _hideAccessibleBounds() {
      this._shouldRestoreBoundsVisibility = null;
      this.getElement("elements").setAttribute("hidden", "true");
    },

    /**
     * Show the accessible bounds container.
     */
    _showAccessibleBounds() {
      this._shouldRestoreBoundsVisibility = null;
      if (!this.highlighterEnv.window) {
        return;
      }

      this.getElement("elements").removeAttribute("hidden");
    },

    onMessage({ data: { name, json: options } }) {
      if (!this.markup) {
        this.buildHighlighterMarkup();
      }

      switch (name) {
        case ACCESSIBLE_HIGHLIGHTER_MESSAGES.SHOW:
          this.show(options);
          break;
        case ACCESSIBLE_HIGHLIGHTER_MESSAGES.HIDE:
          this.hide();
          break;
        case ACCESSIBLE_HIGHLIGHTER_MESSAGES.SHOW_BOUNDS:
          this.showAccessibleBounds();
          break;
        case ACCESSIBLE_HIGHLIGHTER_MESSAGES.HIDE_BOUNDS:
          this.hideAccessibleBounds();
          break;
        case "devtools:highlighter:destroy":
          this.hide();
          break;
        default:
          break;
      }
    },

    destroy() {
      Actor.prototype.destroy.call(this);
      this.targetActor = null;

      if (this._highlightTimer) {
        clearTimeout(this._highlightTimer);
        this._highlightTimer = null;
      }

      if (this.highlighterEnv) {
        this.highlighterEnv.destroy();
        this.highlighterEnv = null;
      }

      this.accessibleInfobar.destroy();
      this.accessibleInfobar = null;
      if (this.markup) {
        this.markup.destroy();
        this.markup = null;
      }

      if (this.iframe) {
        this.iframe.removeEventListener(
          "devtools/chrome/highlighter/message",
          this.onMessage
        );
        this.iframe.remove();
        this.iframe = null;
      }
    },
  }
);

exports.AccessibleHighlighterRendererActor = AccessibleHighlighterRendererActor;
