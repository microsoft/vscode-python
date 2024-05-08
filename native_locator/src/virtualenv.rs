// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

use std::path::PathBuf;

use crate::utils::PythonEnv;

pub fn is_virtualenv(env: &PythonEnv) -> bool {
    if let Some(file_path) = PathBuf::from(env.executable.clone()).parent() {
        // Check if there are any activate.* files in the same directory as the interpreter.
        //
        // env
        // |__ activate, activate.*  <--- check if any of these files exist
        // |__ python  <--- interpreterPath

        // if let Some(parent_path) = PathBuf::from(env.)
        // const directory = path.dirname(interpreterPath);
        // const files = await fsapi.readdir(directory);
        // const regex = /^activate(\.([A-z]|\d)+)?$/i;
        if file_path.join("activate").exists() || file_path.join("activate.bat").exists() {
            return true;
        }

        // Support for activate.ps, etc.
        match std::fs::read_dir(file_path) {
            Ok(files) => {
                for file in files {
                    if let Ok(file) = file {
                        if let Some(file_name) = file.file_name().to_str() {
                            if file_name.starts_with("activate") {
                                return true;
                            }
                        }
                    }
                }
                return false;
            }
            Err(_) => return false,
        };
    }

    false
}
