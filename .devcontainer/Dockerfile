# This image will serve as a starting point for devcontainer.json.
# Get latest image of Fedora as the base image.
FROM docker.io/library/fedora:latest

# Install supported python versions and nodejs.
RUN dnf -y --nodocs install /usr/bin/{python3.7,python3.8,python3.9,python3.10,python3.11,git,conda,clang} && \
    dnf clean all

ENV NVM_VERSION=0.39.3
ENV NODE_VERSION=16.17.1
ENV NPM_VERSION=8.19.3

# Installation instructions from https://github.com/nvm-sh/nvm .
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v$NVM_VERSION/install.sh | bash
RUN export NVM_DIR="$HOME/.nvm" && \
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && \
    [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion" && \
    nvm install $NODE_VERSION && \
    npm install -g npm@$NPM_VERSION

# For clean open source builds.
ENV DISABLE_TRANSLATIONS=true




