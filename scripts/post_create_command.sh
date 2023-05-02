#!/bin/bash

export PATH="./node_modules/.bin:$PATH"

gulp installPythonLibs
npm ci
