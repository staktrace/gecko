#!/usr/bin/env bash

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/. */

set -o errexit
set -o nounset
set -o pipefail
set -o xtrace

test "$(whoami)" == 'root'

# Install stuff we need
apt-get -y update
apt-get install -y \
    cmake \
    curl \
    gcc \
    git \
    g++ \
    libffi-dev \
    libssl-dev \
    python3 \
    python3-dev \
    python3-pip \
    python3-setuptools

curl -SsfL -o libgit.tar.gz \
    https://github.com/libgit2/libgit2/archive/v0.27.8.tar.gz
tar xf libgit.tar.gz && rm -rf libgit.tar.gz
pushd libgit2-0.27.8
cmake . && make && make install
popd
ldconfig

# Python packages
pip3 install requests==2.21.0
pip3 install pygit2==0.27.0    # this requires libgit2 v0.27.*
pip3 install python-hglib==2.6.1

(   echo "mkdir -p ~/.wrupater && cd ~/.wrupater"
    echo "git clone https://github.com/servo/webrender webrender"
    echo "cd webrender"
    echo "git remote add moz-gfx https://github.com/moz-gfx/webrender"
) | su worker
