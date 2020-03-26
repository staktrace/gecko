/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const EXPORTED_SYMBOLS = ["DevToolsHighlighterRelayParent"];
const { loader } = ChromeUtils.import("resource://devtools/shared/Loader.jsm");

loader.lazyRequireGetter(
  this,
  "getHighlighterIframe",
  "devtools/server/actors/highlighters/utils/accessibility",
  true
);

class DevToolsHighlighterRelayParent extends JSWindowActorParent {
  constructor() {
    super();
  }

  get browser() {
    return this.browsingContext.top.embedderElement;
  }

  dispatchEvent(message) {
    if (!this.iframe || !this.iframe.contentWindow) {
      return;
    }

    const event = new this.iframe.contentWindow.MessageEvent(
      "devtools/chrome/highlighter/message",
      {
        bubbles: false,
        cancelable: true,
        data: message,
      }
    );
    this.iframe.dispatchEvent(event);
  }

  async receiveMessage(message) {
    if (!this.iframe || !this.iframe.contentWindow) {
      this.iframe = await getHighlighterIframe({
        browser: this.browser,
        waitForIframeReady: true,
        classList: ["accessible"],
      });
    }

    this.dispatchEvent(message);
  }

  willDestroy() {
    this.dispatchEvent({ name: "devtools:highlighter:destroy" });
    this.iframe = null;
  }

  didDestroy() {}
}
