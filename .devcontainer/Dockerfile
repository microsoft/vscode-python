# This image will serve as a starting point for devcontainer.json.
# Get fedora 37 as the base image.
FROM docker.io/library/fedora:37

# Install supported python versions and nodejs.
RUN dnf -y --nodocs install /usr/bin/{python3.7,python3.8,python3.9,python3.10,python3.11,git} nodejs gcc conda && \
    source ~/.bashrc && \
    dnf clean all


# RUN dnf module install nodejs:16
# Install make.
# RUN yum install -y make
# Install pip.
# below without . Check pip is available from python version itself try without
RUN curl -L https://bootstrap.pypa.io/pip/pip.pyz --output pip.pyz
# Install nvm, load nvm, and load nvm bash_completion
# ENV version for node version, nvm version, npm version
ENV NVM_VERSION=0.39.3
ENV NODE_VERSION=16.17.1
ENV NPM_VERSION=8.19.3

RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v$NVM_VERSION/install.sh | bash
RUN export NVM_DIR="$HOME/.nvm" && \
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && \
    [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion" && \
    nvm install $NODE_VERSION && \
    npm install -g npm@$NPM_VERSION

# For clean open source builds
ENV DISABLE_TRANSLATIONS=true






# -------------------Notes---------------------
# pretend dockerfile has no source code
# everything til git clone.

# virtual environment here? => if we are downloading other stuff here

#RUN can run any shell commands.
#set env variable
# when done, save state of everything,
# ---------------------------------------------


