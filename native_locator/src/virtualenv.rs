// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

use crate::messaging::{MessageDispatcher, PythonEnvironment, PythonEnvironmentCategory};
use crate::utils::PythonEnv;
use std::path::PathBuf;
use std::{collections::HashMap, path::PathBuf};
use crate::{
    locator::{self, Locator},
    messaging::{MessageDispatcher, PythonEnvironment},
    utils::PythonEnv,
};

pub fn is_virtualenv(env: &PythonEnv) -> bool {
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

pub fn is_exe_virtualenv(python_executable: &PathBuf) -> bool {
    if let Some(file_path) = python_executable.parent() {
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
    fn get_type(&mut self) -> String {
        "virtualenv".to_string()
    }

    fn is_known(&mut self, python_executable: &PathBuf) -> bool {
        self.environments
            .contains_key(python_executable.to_str().unwrap_or_default())
    }

    fn is_compatible(&mut self, python_executable: &PathBuf) -> bool {
        is_exe_virtualenv(python_executable)
    }

    fn track_if_compatible(&mut self, env: &locator::PythonEnv) -> () {
        if is_exe_virtualenv(&env.executable) {
            let executable = env.executable.to_str().unwrap().to_string();
            self.environments.insert(
                executable,
                PythonEnvironment {
                    python_executable_path: Some(executable),
                    version: Some(env.version.clone()),
                    category: crate::messaging::PythonEnvironmentCategory::
                    sys_path: Some(env.sys_path.clone()),
                    display_name: env.display_name.clone(),
                    architecture: env.architecture.clone(),
                    path: env.path.clone(),
                    kind: "virtualenv".to_string(),
                },
            );
        }
    }

    fn find(&mut self) -> () {
        // There are no common global locations for virtual environments.
        // We expect the user of this class to call `is_compatible`
        ()
    }

    fn report(&mut self, reporter: &dyn MessageDispatcher) -> () {
        todo!()
    }
}
