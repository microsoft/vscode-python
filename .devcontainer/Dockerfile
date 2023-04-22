FROM mcr.microsoft.com/devcontainers/python:3.7

ENV CI_PYTHON_PATH=python

RUN python -m pip install --upgrade pip

COPY build/test-requirements.txt ./
RUN python -m pip install -r test-requirements.txt \
    && rm test-requirements.txt

COPY build/smoke-test-requirements.txt ./
RUN python -m pip install -r smoke-test-requirements.txt \
    && rm smoke-test-requirements.txt

COPY build/functional-test-requirements.txt ./
RUN python -m pip install -r functional-test-requirements.txt \
    && rm functional-test-requirements.txt

COPY build/functional-test-requirements.txt ./
RUN python -m pip install -r functional-test-requirements.txt \
    && rm functional-test-requirements.txt

COPY build/debugger-install-requirements.txt ./
RUN python -m pip install -r debugger-install-requirements.txt \
    && rm debugger-install-requirements.txt


RUN apt-get update
RUN apt-get install -y libatk1.0-0 libatk-bridge2.0-0 libdrm2 libgtk-3-0 libgbm-dev libasound2