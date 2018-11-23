#!/bin/bash
set -x -e -v

# This scripts uses `cargo-vendor` to download all the dependencies needed
# to build `wrench` (a tool used for standalone testing of webrender), and
# exports those dependencies as a tarball. This avoids having to download
# these dependencies on every test job that uses `wrench`.

WORKSPACE=$HOME/workspace
SRCDIR=$WORKSPACE/build/src
UPLOAD_DIR=$HOME/artifacts

cd $WORKSPACE
$SRCDIR/mach artifact toolchain -v $MOZ_TOOLCHAINS
export PATH=$PATH:$PWD/rustc/bin
cargo install --version 0.1.21 cargo-vendor
mkdir -p vendored/.cargo
cd vendored
cargo vendor --sync $SRCDIR/gfx/wr/Cargo.lock > .cargo/config
cd $WORKSPACE
tar cf wrench-deps.tar vendored/
xz wrench-deps.tar

mkdir -p $UPLOAD_DIR
mv wrench-deps.tar.xz $UPLOAD_DIR/
