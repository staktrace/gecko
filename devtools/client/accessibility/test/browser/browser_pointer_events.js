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
    <body></body>
  </html>`
);
const iframeHTML = `<iframe title="OOP IFrame" src="${srcURL.href}"/>`;
const url = `data:text/html;charset=UTF-8,${encodeURIComponent(iframeHTML)}`;

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
  iframe.contentWindow.document.insertAnonymousContent(svg);

  const { x, y } = await SpecialPowers.spawn(browser, [], () => {
    const { left, top, height, width } = content.document
      .getElementsByTagName("iframe")[0]
      .getBoundingClientRect();
    return {
      x: left + width / 2,
      y: top + height / 2,
    };
  });

  // await SpecialPowers.spawn(browser, [], () => {
  //   content.docShell.chromeEventHandler.addEventListener(
  //     "click",
  //     e => {
  //       content.console.log(
  //         `top ${e.clientX} ${e.clientY} ${e.pageX} ${e.pageY} ${e.screenX} ${e.screenY}`
  //       );
  //     },
  //     {
  //       capture: true,
  //     }
  //   );
  // });

  // await SpecialPowers.spawn(browser, [], () => {
  //   const frame = content.document.getElementsByTagName("iframe")[0];
  //   return SpecialPowers.spawn(frame, [], () => {
  //     content.docShell.chromeEventHandler.addEventListener(
  //       "click",
  //       e => {
  //         content.console.log(
  //           `iframe ${e.clientX} ${e.clientY} ${e.pageX} ${e.pageY} ${e.screenX} ${e.screenY}`
  //         );
  //       },
  //       {
  //         capture: true,
  //       }
  //     );
  //   });
  // });

  const onMouse = SpecialPowers.spawn(browser, [], () => {
    const frame = content.document.getElementsByTagName("iframe")[0];
    return SpecialPowers.spawn(
      frame,
      [],
      () =>
        new Promise(resolve => {
          content.docShell.chromeEventHandler.addEventListener(
            "click",
            () => resolve(true),
            { capture: true, once: true }
          );
        })
    );
  });

  const { left, top } = browser.getBoundingClientRect();
  EventUtils.synthesizeMouseAtPoint(x + left, y + top, {});
  ok(await onMouse, "Mouse event was fired in the OOP iframe.");
});
