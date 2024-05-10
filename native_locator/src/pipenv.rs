// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

use crate::locator::Locator;
use crate::messaging::{MessageDispatcher, PythonEnvironment};
use crate::utils::PythonEnv;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

fn get_pipenv_project(env: &PythonEnv) -> Option<PathBuf> {
    let project_file = env.path.clone()?.join(".project");
    if project_file.exists() {
        if let Ok(contents) = fs::read_to_string(project_file) {
            let project_folder = PathBuf::from(contents.trim().to_string());
            if project_folder.exists() {
                return Some(project_folder);
            }
        }
    }

    None
}

pub struct PipEnv {
    pub environments: HashMap<String, PythonEnvironment>,
}

impl PipEnv {
    pub fn new() -> PipEnv {
        PipEnv {
            environments: HashMap::new(),
        }
    }
}

impl Locator for PipEnv {
    fn is_known(&self, python_executable: &PathBuf) -> bool {
        self.environments
            .contains_key(python_executable.to_str().unwrap_or_default())
    }

    fn track_if_compatible(&mut self, env: &PythonEnv) -> bool {
        if let Some(project_path) = get_pipenv_project(env) {
            let env = PythonEnvironment::new_pipenv(
                Some(env.executable.clone()),
                env.version.clone(),
                env.path.clone(),
                env.path.clone(),
                None,
                project_path,
            );

            self.environments.insert(
                env.python_executable_path
                    .clone()
                    .unwrap()
                    .to_str()
                    .unwrap()
                    .to_string(),
                env,
            );
            return true;
        }
        false
    }

    fn gather(&mut self) -> Option<()> {
        None
    }

    fn report(&self, reporter: &mut dyn MessageDispatcher) {
        for env in self.environments.values() {
            reporter.report_environment(env.clone());
        }
    }
}
