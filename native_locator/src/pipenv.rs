// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

use crate::locator::{Locator, LocatorResult};
use crate::messaging::PythonEnvironment;
use crate::utils::PythonEnv;
use std::fs;
use std::path::PathBuf;

fn get_pipenv_project(env: &PythonEnv) -> Option<PathBuf> {
    let project_file = env.path.clone()?.join(".project");
    if let Ok(contents) = fs::read_to_string(project_file) {
        let project_folder = PathBuf::from(contents.trim().to_string());
        if project_folder.exists() {
            return Some(project_folder);
        }
    }
    None
}

pub struct PipEnv {}

impl PipEnv {
    pub fn new() -> PipEnv {
        PipEnv {}
    }
}

impl Locator for PipEnv {
    fn resolve(&self, env: &PythonEnv) -> Option<PythonEnvironment> {
        let project_path = get_pipenv_project(env)?;
        Some(PythonEnvironment {
            display_name: None,
            name: None,
            python_executable_path: Some(env.executable.clone()),
            category: crate::messaging::PythonEnvironmentCategory::Pipenv,
            version: env.version.clone(),
            env_path: env.path.clone(),
            env_manager: None,
            python_run_command: Some(vec![env.executable.to_str().unwrap().to_string()]),
            project_path: Some(project_path),
        })
    }

    fn find(&mut self) -> Option<LocatorResult> {
        None
    }
}
