// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

use crate::{
    locator::{Locator, LocatorResult},
    messaging::PythonEnvironment,
    utils::{self, PythonEnv},
};

pub fn is_venv(env: &PythonEnv) -> bool {
    // env path cannot be empty.
    if env.path.is_none() {
        return false;
    }
    return utils::find_pyvenv_config_path(&env.executable).is_some();
}
pub struct Venv {}

impl Venv {
    pub fn new() -> Venv {
        Venv {}
    }
}

impl Locator for Venv {
    fn resolve(&self, env: &PythonEnv) -> Option<PythonEnvironment> {
        if is_venv(&env) {
            return Some(PythonEnvironment {
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
            });
        }
        None
    }

    fn find(&self) -> Option<LocatorResult> {
        // There are no common global locations for virtual environments.
        // We expect the user of this class to call `is_compatible`
        None
    }
}
