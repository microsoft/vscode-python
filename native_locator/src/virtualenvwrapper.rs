// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

use crate::messaging::{PythonEnvironment, PythonEnvironmentCategory};
use crate::virtualenv;
use crate::{known::Environment, messaging::MessageDispatcher, utils::PythonEnv};
use std::path::PathBuf;

#[cfg(windows)]
fn get_default_virtualenvwrapper_path(environment: &impl Environment) -> Option<String> {
    // In Windows, the default path for WORKON_HOME is %USERPROFILE%\Envs.
    // If 'Envs' is not available we should default to '.virtualenvs'. Since that
    // is also valid for windows.
    if let Some(home) = environment.get_user_home() {
        let home = PathBuf::from(home).join("Envs");
        if home.exists() {
            return Some(home.to_string_lossy().to_string());
        }
        let home = PathBuf::from(home).join("virtualenvs");
        if home.exists() {
            return Some(home.to_string_lossy().to_string());
        }
    }
    None
}

#[cfg(unix)]
fn get_default_virtualenvwrapper_path(environment: &impl Environment) -> Option<String> {
    if let Some(home) = environment.get_user_home() {
        let home = PathBuf::from(home).join("virtualenvs");
        if home.exists() {
            return Some(home.to_string_lossy().to_string());
        }
    }
    None
}

fn get_work_on_home_path(environment: &impl Environment) -> Option<String> {
    // The WORKON_HOME variable contains the path to the root directory of all virtualenvwrapper environments.
    // If the interpreter path belongs to one of them then it is a virtualenvwrapper type of environment.
    if let Some(work_on_home) = environment.get_env_var("WORKON_HOME".to_string()) {
        if let Ok(work_on_home) = std::fs::canonicalize(work_on_home) {
            if work_on_home.exists() {
                return Some(work_on_home.to_string_lossy().to_string());
            }
        }
    }
    get_default_virtualenvwrapper_path(environment)
}

fn create_virtualenvwrapper_env(env: &PythonEnv) -> PythonEnvironment {
    let executable = env.executable.clone().into_os_string().into_string().ok();
    let env_path = env.path.clone().into_os_string().into_string().ok();
    PythonEnvironment {
        name: match env.path.file_name().to_owned() {
            Some(name) => Some(name.to_string_lossy().to_owned().to_string()),
            None => None,
        },
        python_executable_path: executable.clone(),
        category: PythonEnvironmentCategory::VirtualEnvWrapper,
        version: env.version.clone(),
        env_path: env_path.clone(),
        sys_prefix_path: env_path,
        env_manager: None,
        python_run_command: match executable {
            Some(exe) => Some(vec![exe]),
            None => None,
        },
        project_path: None,
    }
}

pub fn is_virtualenvwrapper(env: &PythonEnv, environment: &impl Environment) -> bool {
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

pub fn find_and_report(
    env: &PythonEnv,
    dispatcher: &mut impl MessageDispatcher,
    environment: &impl Environment,
) -> Option<()> {
    if is_virtualenvwrapper(env, environment) {
        dispatcher.report_environment(create_virtualenvwrapper_env(env));
        return Some(());
    }
    None
}
