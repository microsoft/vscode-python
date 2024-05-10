// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

use crate::locator::Locator;
use crate::messaging::{MessageDispatcher, PythonEnvironment};
use crate::utils::PythonEnv;
use std::collections::HashMap;
use std::path::PathBuf;

pub fn is_virtualenv(env: &PythonEnv) -> bool {
    if env.path.is_none() {
        return false;
    }
    if let Some(file_path) = env.executable.parent() {
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

pub struct VirtualEnv {
    pub environments: HashMap<String, PythonEnvironment>,
}

impl VirtualEnv {
    pub fn new() -> VirtualEnv {
        VirtualEnv {
            environments: HashMap::new(),
        }
    }
}

impl Locator for VirtualEnv {
    fn is_known(&self, python_executable: &PathBuf) -> bool {
        self.environments
            .contains_key(python_executable.to_str().unwrap_or_default())
    }

    fn track_if_compatible(&mut self, env: &PythonEnv) -> bool {
        if is_virtualenv(env) {
            self.environments.insert(
                env.executable.to_str().unwrap().to_string(),
                PythonEnvironment {
                    name: Some(
                        env.path
                            .clone()
                            .expect("env.path can never be empty for virtualenvs")
                            .file_name()
                            .unwrap()
                            .to_string_lossy()
                            .to_string(),
                    ),
                    python_executable_path: Some(env.executable.clone()),
                    version: env.version.clone(),
                    category: crate::messaging::PythonEnvironmentCategory::VirtualEnv,
                    sys_prefix_path: env.path.clone(),
                    env_path: env.path.clone(),
                    env_manager: None,
                    project_path: None,
                    python_run_command: Some(vec![env.executable.to_str().unwrap().to_string()]),
                },
            );
            return true;
        }
        false
    }

    fn gather(&mut self) -> Option<()> {
        // There are no common global locations for virtual environments.
        // We expect the user of this class to call `is_compatible`
        None
    }

    fn report(&self, reporter: &mut dyn MessageDispatcher) {
        for env in self.environments.values() {
            reporter.report_environment(env.clone());
        }
    }
}
