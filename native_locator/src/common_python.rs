// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use crate::known::Environment;
use crate::locator::Locator;
use crate::messaging::MessageDispatcher;
use crate::messaging::PythonEnvironment;
use crate::utils::{self, PythonEnv};
use std::collections::HashMap;
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
    pub environments: HashMap<String, PythonEnvironment>,
    pub environment: &'a dyn Environment,
}

impl PythonOnPath<'_> {
    pub fn with<'a>(environment: &'a impl Environment) -> PythonOnPath {
        PythonOnPath {
            environments: HashMap::new(),
            environment,
        }
    }
}

impl Locator for PythonOnPath<'_> {
    fn is_known(&self, python_executable: &PathBuf) -> bool {
        self.environments
            .contains_key(python_executable.to_str().unwrap_or_default())
    }

    fn track_if_compatible(&mut self, env: &PythonEnv) -> bool {
        let bin = if cfg!(windows) {
            "python.exe"
        } else {
            "python"
        };
        if env.executable.file_name().unwrap().to_ascii_lowercase() != bin {
            return false;
        }
        self.environments.insert(
            env.executable.to_str().unwrap().to_string(),
            PythonEnvironment {
                name: None,
                python_executable_path: Some(env.executable.clone()),
                version: env.version.clone(),
                category: crate::messaging::PythonEnvironmentCategory::System,
                sys_prefix_path: None,
                env_path: env.path.clone(),
                env_manager: None,
                project_path: None,
                python_run_command: Some(vec![env.executable.to_str().unwrap().to_string()]),
            },
        );
        true
    }

    fn gather(&mut self) -> Option<()> {
        let paths = self.environment.get_env_var("PATH".to_string())?;
        let bin = if cfg!(windows) {
            "python.exe"
        } else {
            "python"
        };
        env::split_paths(&paths)
            .map(|p| p.join(bin))
            .filter(|p| p.exists())
            .for_each(|full_path| {
                let version = utils::get_version(&full_path);
                let env_path = get_env_path(&full_path);
                self.track_if_compatible(&PythonEnv::new(full_path, env_path, version));
            });

        Some(())
    }

    fn report(&self, reporter: &mut dyn MessageDispatcher) {
        for env in self.environments.values() {
            reporter.report_environment(env.clone());
        }
    }
}
