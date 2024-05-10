// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

use crate::locator::Locator;
use crate::messaging::PythonEnvironment;
use crate::utils::list_python_environments;
use crate::virtualenv;
use crate::{known::Environment, messaging::MessageDispatcher, utils::PythonEnv};
use std::collections::HashMap;
use std::path::PathBuf;

#[cfg(windows)]
fn get_default_virtualenvwrapper_path(environment: &dyn Environment) -> Option<PathBuf> {
    // In Windows, the default path for WORKON_HOME is %USERPROFILE%\Envs.
    // If 'Envs' is not available we should default to '.virtualenvs'. Since that
    // is also valid for windows.
    if let Some(home) = environment.get_user_home() {
        let home = PathBuf::from(home).join("Envs");
        if home.exists() {
            return Some(home);
        }
        let home = PathBuf::from(home).join("virtualenvs");
        if home.exists() {
            return Some(home);
        }
    }
    None
}

#[cfg(unix)]
fn get_default_virtualenvwrapper_path(environment: &dyn Environment) -> Option<PathBuf> {
    if let Some(home) = environment.get_user_home() {
        let home = PathBuf::from(home).join("virtualenvs");
        if home.exists() {
            return Some(home);
        }
    }
    None
}

fn get_work_on_home_path(environment: &dyn Environment) -> Option<PathBuf> {
    // The WORKON_HOME variable contains the path to the root directory of all virtualenvwrapper environments.
    // If the interpreter path belongs to one of them then it is a virtualenvwrapper type of environment.
    if let Some(work_on_home) = environment.get_env_var("WORKON_HOME".to_string()) {
        if let Ok(work_on_home) = std::fs::canonicalize(work_on_home) {
            if work_on_home.exists() {
                return Some(work_on_home);
            }
        }
    }
    get_default_virtualenvwrapper_path(environment)
}

pub fn is_virtualenvwrapper(env: &PythonEnv, environment: &dyn Environment) -> bool {
    if env.path.is_none() {
        return false;
    }
    // For environment to be a virtualenvwrapper based it has to follow these two rules:
    // 1. It should be in a sub-directory under the WORKON_HOME
    // 2. It should be a valid virtualenv environment
    if let Some(work_on_home_dir) = get_work_on_home_path(environment) {
        if env.executable.starts_with(&work_on_home_dir) && virtualenv::is_virtualenv(env) {
            return true;
        }
    }

    false
}

pub struct VirtualEnvWrapper<'a> {
    pub environments: HashMap<String, PythonEnvironment>,
    pub environment: &'a dyn Environment,
}

impl VirtualEnvWrapper<'_> {
    pub fn with<'a>(environment: &'a impl Environment) -> VirtualEnvWrapper {
        VirtualEnvWrapper {
            environments: HashMap::new(),
            environment,
        }
    }
}

impl Locator for VirtualEnvWrapper<'_> {
    fn is_known(&self, python_executable: &PathBuf) -> bool {
        self.environments
            .contains_key(python_executable.to_str().unwrap_or_default())
    }

    fn track_if_compatible(&mut self, env: &PythonEnv) -> bool {
        if is_virtualenvwrapper(env, self.environment) {
            self.environments.insert(
                env.executable.to_str().unwrap().to_string(),
                PythonEnvironment {
                    name: Some(
                        env.path
                            .clone()
                            .expect("env.path cannot be empty for virtualenv rapper")
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
        let work_on_home = get_work_on_home_path(self.environment)?;
        let envs = list_python_environments(&work_on_home)?;
        envs.iter().for_each(|env| {
            self.track_if_compatible(env);
        });

        Some(())
    }

    fn report(&self, reporter: &mut dyn MessageDispatcher) {
        for env in self.environments.values() {
            reporter.report_environment(env.clone());
        }
    }
}
