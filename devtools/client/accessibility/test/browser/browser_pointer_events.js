/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const srcURL = new URL(`http://example.net/document-builder.sjs`);
srcURL.searchParams.append(
  "html",
  `<html>
    <head>
      <meta charset="utf-8"/>
      <title>OOP Document</title>
    </head>
    <body><h1>Top level header</h1><p>This is a paragraph.</p></body>
  </html>`
);

let url = `<iframe title="OOP IFrame" src="${srcURL.href}"/>
  <script>
    document.addEventListener("mousemove", () => console.log("TOP"));
  </script>`;
url = `data:text/html;charset=UTF-8,${encodeURIComponent(url)}`;

const SVG_NS = "http://www.w3.org/2000/svg";
const STYLES_SHEET = `data:text/css;charset=utf-8,
.test-svg {
  position: absolute;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.test-path {
  opacity: 0.6;
}`;

requestLongerTimeout(5);

function invokeContentTask(browser, args, task, runInIframe = false) {
  return SpecialPowers.spawn(
    browser,
    [runInIframe, task.toString(), ...args],
    (runInIframeFlag, contentTask, ...contentArgs) => {
      // eslint-disable-next-line no-eval
      const runnableTask = eval(`
      (() => {
        return (${contentTask});
      })();`);
      let frame;
      if (runInIframeFlag) {
        frame = content.document.getElementsByTagName("iframe")[0];
      }

      return frame
        ? SpecialPowers.spawn(frame, contentArgs, runnableTask)
        : runnableTask.call(this, ...contentArgs);
    }
  );
}

add_task(async () => {
  const tab = BrowserTestUtils.addTab(gBrowser, url);
  gBrowser.selectedTab = tab;
  const browser = tab.linkedBrowser;
  await BrowserTestUtils.browserLoaded(browser);

  const browserContainer = gBrowser.getBrowserContainer(browser);
  const parent = browserContainer.querySelector(".browserStack");
  const window = gBrowser.ownerGlobal;
  const iframe = window.document.createElement("iframe");
  iframe.classList.add("devtools-highlighter-renderer");
  parent.querySelector("browser").after(iframe);
  if (
    iframe.contentWindow.readyState != "interactive" &&
    iframe.contentWindow.readyState != "complete"
  ) {
    await new Promise(resolve => {
      iframe.contentWindow.addEventListener("DOMContentLoaded", resolve, {
        once: true,
      });
    });
  }

  iframe.contentWindow.windowUtils.loadSheetUsingURIString(
    STYLES_SHEET,
    iframe.contentWindow.windowUtils.AGENT_SHEET
  );

  const { mozInnerScreenX, mozInnerScreenY } = iframe.contentWindow;

  const svg = iframe.contentWindow.document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "test-svg");
  const path = iframe.contentWindow.document.createElementNS(SVG_NS, "path");
  path.setAttribute("class", "test-path");
  path.setAttributeNS(null, "fill", "#6a5acd");
  path.setAttributeNS(
    null,
    "d",
    `M${0},${0} L${innerWidth},${0} L${innerWidth},${innerHeight} L${0},${innerHeight}`
  );
  svg.appendChild(path);
  // iframe.contentWindow.document.body.appendChild(svg);
  /*const content = */ iframe.contentWindow.document.insertAnonymousContent(
    svg
  );

  await invokeContentTask(
    browser,
    [],
    () => {
      content.docShell.chromeEventHandler.addEventListener(
        "mousemove",
        () => content.console.log("TOP LEVEL"),
        { capture: true }
      );
    },
    false
  );

  await invokeContentTask(
    browser,
    [],
    () => {
      return new Promise(resolve => {
        content.docShell.chromeEventHandler.addEventListener(
          "mousemove",
          () => resolve(),
          { capture: true, once: true }
        );
      });
    },
    true
  );

  ok(true, "EVENT WORKED");

  // await new Promise(resolve => setTimeout(resolve, 1000000));
});
