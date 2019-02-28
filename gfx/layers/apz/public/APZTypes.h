/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_layers_APZTypes_h
#define mozilla_layers_APZTypes_h

#include "LayersTypes.h"
#include "mozilla/layers/ScrollableLayerGuid.h"
#include "mozilla/webrender/WebRenderTypes.h"

namespace mozilla {

namespace layers {

struct APZNodeId {
  LayersId mLayersId;
  wr::RenderRoot mRenderRoot;

  APZNodeId() = default;

  explicit APZNodeId(LayersId aLayersId)
    : mLayersId(aLayersId),
      mRenderRoot(wr::RenderRoot::Default) {}

  APZNodeId(LayersId aLayersId, wr::RenderRoot aRenderRoot)
    : mLayersId(aLayersId),
      mRenderRoot(aRenderRoot) {}

  APZNodeId(uint64_t aLayersId, wr::RenderRoot aRenderRoot)
    : mLayersId(LayersId{aLayersId}),
      mRenderRoot(aRenderRoot) {}

  APZNodeId(wr::PipelineId aLayersId, wr::DocumentId aRenderRootId)
    : mLayersId(AsLayersId(aLayersId)),
      mRenderRoot(RenderRootFromId(aRenderRootId)) {}

  bool operator==(const APZNodeId& aOther) const {
    return mRenderRoot == aOther.mRenderRoot &&
           mLayersId == aOther.mLayersId;
  }

  bool operator!=(const APZNodeId& aOther) const { return !(*this == aOther); }

  bool IsValid() const {
    return mLayersId.IsValid();
  }

  // Helper struct that allow this class to be used as a key in
  // std::unordered_map like so:
  //   std::unordered_map<APZNodeId, ValueType, APZNodeId::HashFn> myMap;
  struct HashFn {
    std::size_t operator()(const APZNodeId& aKey) const {
      return HashGeneric((uint64_t)aKey.mLayersId, (uint8_t)aKey.mRenderRoot);
    }
  };
};

struct APZCGuid {
  ScrollableLayerGuid mScrollableLayerGuid;
  wr::RenderRoot mRenderRoot;

  APZCGuid()
      : mRenderRoot(wr::RenderRoot::Default) {}

  APZCGuid(LayersId aLayersId, uint32_t aPresShellId,
           ScrollableLayerGuid::ViewID aScrollId, wr::RenderRoot aRenderRoot)
      : mScrollableLayerGuid(aLayersId, aPresShellId, aScrollId),
        mRenderRoot(aRenderRoot) {}

  APZCGuid(const ScrollableLayerGuid& other,
           wr::RenderRoot aRenderRoot)
      : mScrollableLayerGuid(other),
        mRenderRoot(aRenderRoot) {}

  APZCGuid(const APZCGuid& other)
      : mScrollableLayerGuid(other.mScrollableLayerGuid),
        mRenderRoot(other.mRenderRoot) {}

  ~APZCGuid() {}

  APZNodeId GetAPZNodeId() const {
    return APZNodeId(mScrollableLayerGuid.mLayersId, mRenderRoot);
  }

  bool operator==(const APZCGuid& other) const {
    return mScrollableLayerGuid == other.mScrollableLayerGuid &&
           mRenderRoot == other.mRenderRoot;
  }

  bool operator!=(const APZCGuid& other) const {
    return !(*this == other);
  }

  bool operator<(const APZCGuid& other) const {
    if (mScrollableLayerGuid < other.mScrollableLayerGuid) {
      return true;
    }
    if (mScrollableLayerGuid == other.mScrollableLayerGuid) {
      return mRenderRoot < other.mRenderRoot;
    }
    return false;
  }

  // Helper structs to use as hash/equality functions in std::unordered_map.
  // e.g. std::unordered_map<APZCGuid,
  //                    ValueType,
  //                    APZCGuid::HashFn> myMap;
  // std::unordered_map<APZCGuid,
  //                    ValueType,
  //                    APZCGuid::HashIgnoringPresShellFn,
  //                    APZCGuid::EqualIgnoringPresShellFn> myMap;

  struct HashFn {
    std::size_t operator()(const APZCGuid& aGuid) const {
      return AddToHash(ScrollableLayerGuid::HashFn{}(aGuid.mScrollableLayerGuid),
                       uint8_t(aGuid.mRenderRoot));
    }
  };

  struct HashIgnoringPresShellFn {
    std::size_t operator()(const APZCGuid& aGuid) const {
      return AddToHash(ScrollableLayerGuid::HashIgnoringPresShellFn{}(aGuid.mScrollableLayerGuid),
                       uint8_t(aGuid.mRenderRoot));
    }
  };

  struct EqualIgnoringPresShellFn {
    bool operator()(const APZCGuid& lhs,
                    const APZCGuid& rhs) const {
      return ScrollableLayerGuid::EqualIgnoringPresShellFn{}(lhs.mScrollableLayerGuid,
                                                             rhs.mScrollableLayerGuid) &&
             lhs.mRenderRoot == rhs.mRenderRoot;
    }
  };
};

template <int LogLevel>
gfx::Log<LogLevel>& operator<<(gfx::Log<LogLevel>& log,
                               const APZCGuid& aGuid) {
  return log << '(' << aGuid.mScrollableLayerGuid << ',' << (int)aGuid.mRenderRoot << ')';
}

} // namespace layers

} // namespace mozilla

#endif /* mozilla_layers_APZTypes_h */
