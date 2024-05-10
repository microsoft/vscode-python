// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

use std::{collections::HashMap, path::PathBuf};

use crate::{
    locator::Locator,
    messaging::{MessageDispatcher, PythonEnvironment},
    utils::{self, PythonEnv},
};

pub fn is_venv(env: &PythonEnv) -> bool {
    // env path cannot be empty.
    if env.path.is_none() {
        return false;
    }
    return utils::find_pyvenv_config_path(&env.executable).is_some();
}
pub struct Venv {
    pub environments: HashMap<String, PythonEnvironment>,
}

impl Venv {
    pub fn new() -> Venv {
        Venv {
            environments: HashMap::new(),
        }
    }
}

impl Locator for Venv {
    fn is_known(&self, python_executable: &PathBuf) -> bool {
        self.environments
            .contains_key(python_executable.to_str().unwrap_or_default())
    }

    fn track_if_compatible(&mut self, env: &PythonEnv) -> bool {
        if is_venv(&env) {
            self.environments.insert(
                env.executable.to_str().unwrap().to_string(),
                PythonEnvironment {
                    name: Some(
                        env.path
                            .clone()
                            .expect("env.path can never be empty for venvs")
                            .file_name()
                            .unwrap()
                            .to_string_lossy()
                            .to_string(),
                    ),
                    python_executable_path: Some(env.executable.clone()),
                    version: env.version.clone(),
                    category: crate::messaging::PythonEnvironmentCategory::Venv,
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
