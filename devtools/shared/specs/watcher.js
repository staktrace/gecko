/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const {
  types,
  generateActorSpec,
  Arg,
  RetVal,
} = require("devtools/shared/protocol");

types.addPolymorphicType("descriptor", [
  "frameDescriptor",
  "processDescriptor",
]);

const watcherSpecPrototype = {
  typeName: "watcher",

  methods: {
    watchTargets: {
      request: {
        targetType: Arg(0, "string"),
      },
      response: {},
    },

    unwatchTargets: {
      request: {
        targetType: Arg(0, "string"),
      },
      response: {},
    },

    getParentBrowsingContextID: {
      request: {
        browsingContextID: Arg(0, "number"),
      },
      response: {
        browsingContextID: RetVal("nullable:number"),
      },
    },
  },

  events: {
    "target-available-form": {
      type: "target-available-form",
      descriptor: Arg(0, "json"),
    },
    "target-destroyed-form": {
      type: "target-destroyed",
      descriptor: Arg(0, "json"),
    },
  },
};

exports.watcherSpec = generateActorSpec(watcherSpecPrototype);
