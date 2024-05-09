// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

use crate::messaging::{MessageDispatcher, PythonEnvironment, PythonEnvironmentCategory};
use crate::utils::PythonEnv;
use std::path::PathBuf;

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

pub fn find_and_report(env: &PythonEnv, dispatcher: &mut impl MessageDispatcher) -> Option<()> {
    if is_virtualenv(env) {
        let env = PythonEnvironment {
            name: match env.path.file_name().to_owned() {
                Some(name) => Some(name.to_string_lossy().to_owned().to_string()),
                None => None,
            },
            python_executable_path: Some(env.executable.clone()),
            category: PythonEnvironmentCategory::VirtualEnv,
            version: env.version.clone(),
            env_path: Some(env.path.clone()),
            sys_prefix_path: Some(env.path.clone()),
            env_manager: None,
            python_run_command: Some(vec![env.executable.to_str().unwrap().to_string()]),
            project_path: None,
        };

        dispatcher.report_environment(env);

        return Some(());
    }
    None
}
