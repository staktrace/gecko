/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {
  AutoRefreshHighlighter,
} = require("devtools/server/actors/highlighters/auto-refresh");
const {
  isNodeValid,
} = require("devtools/server/actors/highlighters/utils/markup");
const {
  TEXT_NODE,
  DOCUMENT_NODE,
} = require("devtools/shared/dom-node-constants");

loader.lazyRequireGetter(
  this,
  "DevToolsServer",
  "devtools/server/devtools-server",
  true
);
loader.lazyRequireGetter(
  this,
  "getBounds",
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

class AccessibleHighlighterRendererProxy {
  constructor(highlighterEnv) {
    this.highlighterEnv = highlighterEnv;
  }

  show(options) {
    return this.sendMessage(ACCESSIBLE_HIGHLIGHTER_MESSAGES.SHOW, options);
  }

  hide() {
    return this.sendMessage(ACCESSIBLE_HIGHLIGHTER_MESSAGES.HIDE);
  }

  hideAccessibleBounds() {
    return this.sendMessage(ACCESSIBLE_HIGHLIGHTER_MESSAGES.HIDE_BOUNDS);
  }

  showAccessibleBounds() {
    return this.sendMessage(ACCESSIBLE_HIGHLIGHTER_MESSAGES.SHOW_BOUNDS);
  }

  destroy() {
    this.highlighterEnv = null;
  }
}

class AccessibleHighlighterRendererProxyChild extends AccessibleHighlighterRendererProxy {
  sendMessage(name, options) {
    if (!this.highlighterRelay) {
      this.highlighterRelay = this.highlighterEnv.window.windowGlobalChild.getActor(
        "DevToolsHighlighterRelay"
      );
    }

    return this.highlighterRelay.sendQuery(name, options);
  }

  destroy() {
    this.highlighterRelay = null;
    this.highlighterEnv = null;
  }
}

class AccessibleHighlighterRendererProxyParent extends AccessibleHighlighterRendererProxy {
  dispatchEvent(name, options) {
    if (!this.iframe || !this.iframe.contentWindow) {
      return;
    }

    const message = new this.iframe.contentWindow.MessageEvent(
      "devtools/chrome/highlighter/message",
      {
        bubbles: false,
        cancelable: true,
        data: { name, json: options },
      }
    );
    this.iframe.dispatchEvent(message);
  }

  async sendMessage(name, options) {
    if (!this.iframe || !this.iframe.contentWindow) {
      this.iframe = await getHighlighterIframe({
        isBrowserToolbox: DevToolsServer.allowChromeProcess,
        waitForIframeReady: true,
        classList: ["accessible"],
      });
    }

    this.dispatchEvent(name, options);
  }

  destroy() {
    this.iframe = null;
    this.highlighterEnv = null;
  }
}

/**
 * The AccessibleHighlighter draws the bounds of an accessible object.
 *
 * Usage example:
 *
 * let h = new AccessibleHighlighter(env);
 * h.show(node, { x, y, w, h, [duration] });
 * h.hide();
 * h.destroy();
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
 */
class AccessibleHighlighter extends AutoRefreshHighlighter {
  constructor(highlighterEnv) {
    super(highlighterEnv);
    this.ID_CLASS_PREFIX = "accessible-";

    this.onPageHide = this.onPageHide.bind(this);
    this.onWillNavigate = this.onWillNavigate.bind(this);

    this.highlighterEnv.on("will-navigate", this.onWillNavigate);

    this.pageListenerTarget = highlighterEnv.pageListenerTarget;
    this.pageListenerTarget.addEventListener("pagehide", this.onPageHide);

    this.rendererProxy = DevToolsServer.isInChildProcess
      ? new AccessibleHighlighterRendererProxyChild(highlighterEnv)
      : new AccessibleHighlighterRendererProxyParent(highlighterEnv);
  }

  /**
   * Static getter that indicates that AccessibleHighlighter supports
   * highlighting in XUL windows.
   */
  static get XULSupported() {
    return true;
  }

  /**
   * Get current accessible bounds.
   *
   * @return {Object|null} Returns, if available, positioning and bounds
   *                       information for the accessible object.
   */
  get _bounds() {
    return getBounds(this.win, this.options);
  }

  /**
   * Destroy the nodes. Remove listeners.
   */
  destroy() {
    this.highlighterEnv.off("will-navigate", this.onWillNavigate);
    this.pageListenerTarget.removeEventListener("pagehide", this.onPageHide);
    this.pageListenerTarget = null;

    AutoRefreshHighlighter.prototype.destroy.call(this);
    this.rendererProxy.destroy();
    this.rendererProxy = null;
  }

  /**
   * Check if node is a valid element, document or text node.
   *
   * @override  AutoRefreshHighlighter.prototype._isNodeValid
   * @param  {DOMNode} node
   *         The node to highlight.
   * @return {Boolean} whether or not node is valid.
   */
  _isNodeValid(node) {
    return (
      super._isNodeValid(node) ||
      isNodeValid(node, TEXT_NODE) ||
      isNodeValid(node, DOCUMENT_NODE)
    );
  }

  /**
   * Show the highlighter on a given accessible.
   *
   * @return {Boolean} True if accessible is highlighted, false otherwise.
   */
  _show() {
    const shown = this._update();
    if (shown) {
      this.emit("highlighter-event", { options: this.options, type: "shown" });
    }

    return shown;
  }

  /**
   * Update and show accessible bounds for a current accessible.
   *
   * @return {Boolean} True if accessible is highlighted, false otherwise.
   */
  _update() {
    const bounds = this._bounds;
    if (!bounds) {
      this._hide();
      return false;
    }

    this.rendererProxy.show({ ...this.options, bounds });
    return true;
  }

  /**
   * Hide the highlighter.
   */
  _hide() {
    this.rendererProxy.hide();
  }

  /**
   * Public API method to temporarily hide accessible bounds for things like
   * color contrast calculation.
   */
  hideAccessibleBounds() {
    return this.rendererProxy.hideAccessibleBounds();
  }

  /**
   * Public API method to show accessible bounds in case they were temporarily
   * hidden.
   */
  showAccessibleBounds() {
    return this.rendererProxy.showAccessibleBounds();
  }

  /**
   * Hide highlighter on page hide.
   */
  onPageHide({ target }) {
    // If a pagehide event is triggered for current window's highlighter, hide
    // the highlighter.
    if (target.defaultView === this.win) {
      this.hide();
    }
  }

  /**
   * Hide highlighter on navigation.
   */
  onWillNavigate({ isTopLevel }) {
    if (isTopLevel) {
      this.hide();
    }
  }
}

exports.AccessibleHighlighter = AccessibleHighlighter;
