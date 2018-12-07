:: This Source Code Form is subject to the terms of the Mozilla Public
:: License, v. 2.0. If a copy of the MPL was not distributed with this
:: file, You can obtain one at http://mozilla.org/MPL/2.0/. */

:: This must be run from the root webrender directory!
:: Users may set the CARGOFLAGS environment variable to pass
:: additional flags to cargo if desired.

pushd webrender_api
cargo test --verbose
popd

pushd webrender
cargo test --verbose
cargo check --verbose --no-default-features --features pathfinder
popd

pushd wrench
cargo test --verbose
cargo run --release -- --angle reftest
popd

pushd examples
cargo check --verbose
popd

pushd direct-composition
cargo check --verbose
popd
