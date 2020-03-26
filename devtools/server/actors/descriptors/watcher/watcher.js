/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const Services = require("Services");
const protocol = require("devtools/shared/protocol");
const { watcherSpec } = require("devtools/shared/specs/watcher");

const ChromeUtils = require("ChromeUtils");
const { registerWatcher, unregisterWatcher } = ChromeUtils.import(
  "resource://devtools/server/actors/descriptors/watcher/FrameWatchers.jsm"
);

exports.WatcherActor = protocol.ActorClassWithSpec(watcherSpec, {
  /**
   * Optionally pass a `browser` in the second argument
   * in order to focus only on targets related to a given <browser> element.
   */
  initialize: function(conn, options) {
    protocol.Actor.prototype.initialize.call(this, conn);
    this._browser = options && options.browser;
  },

  async watchTargets(targetType) {
    // Use DevToolsServerConnection's prefix as a key as we may
    // have multiple clients willing to watch for targets.
    // For example, a Browser Toolbox debugging everything and a Content Toolbox debugging
    // just one tab.
    const { prefix } = this.conn;
    const perPrefixMap =
      Services.ppmm.sharedData.get("DevTools:watchedPerPrefix") || new Map();
    let perPrefixData = perPrefixMap.get(prefix);
    if (!perPrefixData) {
      perPrefixData = {
        targets: new Set(),
        browsingContextID: null,
      };
      perPrefixMap.set(prefix, perPrefixData);
    }
    if (perPrefixData.targets.has(targetType)) {
      throw new Error(`Already watching for '${targetType}' target`);
    }
    perPrefixData.targets.add(targetType);
    if (this._browser) {
      // TODO: update this is we navigate to parent process
      // or <browser> navigate to another BrowsingContext.
      perPrefixData.browsingContextID = this._browser.browsingContext.id;
    }

    Services.ppmm.sharedData.set("DevTools:watchedPerPrefix", perPrefixMap);

    // Flush the data as registerWatcher will indirectly force reading the data
    Services.ppmm.sharedData.flush();

    if (targetType == "frame") {
      // Await the registration in order to ensure receiving the already existing targets
      await registerWatcher(
        this,
        this._browser ? this._browser.browsingContext.id : null
      );
    }
  },

  unwatchTargets(targetType) {
    const perPrefixMap = Services.ppmm.sharedData.get(
      "DevTools:watchedPerPrefix"
    );
    if (!perPrefixMap) {
      return;
    }
    const { prefix } = this.conn;
    const perPrefixData = perPrefixMap.get(prefix);
    if (!perPrefixData) {
      return;
    }
    perPrefixData.targets.delete(targetType);
    Services.ppmm.sharedData.set("DevTools:watchedPerPrefix", perPrefixMap);
    // Flush the data in order to ensure unregister the target actor from DevToolsFrameChild sooner
    Services.ppmm.sharedData.flush();

    if (targetType == "frame") {
      unregisterWatcher(this);
    }
  },

  getParentBrowsingContextID(browsingContextID) {
    const browsingContext = BrowsingContext.get(browsingContextID);
    if (!browsingContext) {
      throw new Error(
        `BrowsingContext with ID=${browsingContextID} doesn't exist.`
      );
    }
    if (browsingContext.parent) {
      return browsingContext.parent.id;
    }
    if (browsingContext.embedderWindowGlobal) {
      return browsingContext.embedderWindowGlobal.browsingContext.id;
    }
    return null;
  },
});
