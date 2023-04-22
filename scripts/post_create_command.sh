#!/bin/bash

export PATH="./node_modules/.bin:$PATH"

gulp installPythonLibs
npm install
npm run compile