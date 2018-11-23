# %ARG DOCKER_IMAGE_PARENT
FROM $DOCKER_IMAGE_PARENT
MAINTAINER Kartikaya Gupta <kgupta@mozilla.com>

VOLUME /builds/worker/checkouts
VOLUME /builds/worker/workspace
VOLUME /builds/worker/tooltool-cache

# %include python/mozbuild/mozbuild/action/tooltool.py
ADD topsrcdir/python/mozbuild/mozbuild/action/tooltool.py /tmp/tooltool.py

# %include taskcluster/docker/recipes/install-mercurial.sh
ADD topsrcdir/taskcluster/docker/recipes/install-mercurial.sh /tmp/install-mercurial.sh

# %include gfx/wr/ci-scripts/docker-image/setup.sh
ADD topsrcdir/gfx/wr/ci-scripts/docker-image/setup.sh /tmp/wr-setup.sh
RUN /bin/bash /tmp/wr-setup.sh

# We need this to install cargo-vendor as part of the wrench-deps task
RUN apt-get install libssl-dev

# Set a default command useful for debugging
CMD ["/bin/bash", "--login"]
