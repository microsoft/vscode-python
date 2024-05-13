// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use crate::known::Environment;
use crate::locator::{Locator, LocatorResult};
use crate::messaging::PythonEnvironment;
use crate::utils::{self, PythonEnv};
use std::env;
use std::path::PathBuf;

fn get_env_path(python_executable_path: &PathBuf) -> Option<PathBuf> {
    let parent = python_executable_path.parent()?;
    if parent.file_name()? == "Scripts" {
        return Some(parent.parent()?.to_path_buf());
    } else {
        return Some(parent.to_path_buf());
    }
}

pub struct PythonOnPath<'a> {
    pub environment: &'a dyn Environment,
}

impl PythonOnPath<'_> {
    pub fn with<'a>(environment: &'a impl Environment) -> PythonOnPath {
        PythonOnPath { environment }
    }
}

impl Locator for PythonOnPath<'_> {
    fn resolve(&self, env: &PythonEnv) -> Option<PythonEnvironment> {
        let bin = if cfg!(windows) {
            "python.exe"
        } else {
            "python"
        };
        if env.executable.file_name().unwrap().to_ascii_lowercase() != bin {
            return None;
        }
        Some(PythonEnvironment {
            name: None,
            python_executable_path: Some(env.executable.clone()),
            version: env.version.clone(),
            category: crate::messaging::PythonEnvironmentCategory::System,
            sys_prefix_path: None,
            env_path: env.path.clone(),
            env_manager: None,
            project_path: None,
            python_run_command: Some(vec![env.executable.to_str().unwrap().to_string()]),
        })
    }

    fn find(&self) -> Option<LocatorResult> {
        let paths = self.environment.get_env_var("PATH".to_string())?;
        let bin = if cfg!(windows) {
            "python.exe"
        } else {
            "python"
        };
        let mut environments: Vec<PythonEnvironment> = vec![];
        env::split_paths(&paths)
            .map(|p| p.join(bin))
            .filter(|p| p.exists())
            .for_each(|full_path| {
                let version = utils::get_version(&full_path);
                let env_path = get_env_path(&full_path);
                if let Some(env) = self.resolve(&PythonEnv::new(full_path, env_path, version)) {
                    environments.push(env);
                }
            });

        if environments.is_empty() {
            None
        } else {
            Some(LocatorResult {
                environments,
                managers: vec![],
            })
        }
    }
}
