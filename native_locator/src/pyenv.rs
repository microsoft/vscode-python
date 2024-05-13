// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

use crate::known;
use crate::known::Environment;
use crate::locator::Locator;
use crate::locator::LocatorResult;
use crate::messaging;
use crate::messaging::EnvManager;
use crate::messaging::EnvManagerType;
use crate::messaging::PythonEnvironment;
use crate::utils::find_and_parse_pyvenv_cfg;
use crate::utils::find_python_binary_path;
use crate::utils::PythonEnv;
use regex::Regex;
use std::fs;
use std::path::PathBuf;

#[cfg(windows)]
fn get_home_pyenv_dir(environment: &dyn known::Environment) -> Option<PathBuf> {
    let home = environment.get_user_home()?;
    Some(PathBuf::from(home).join(".pyenv").join("pyenv-win"))
}

#[cfg(unix)]
fn get_home_pyenv_dir(environment: &dyn known::Environment) -> Option<PathBuf> {
    let home = environment.get_user_home()?;
    Some(PathBuf::from(home).join(".pyenv"))
}

fn get_binary_from_known_paths(environment: &dyn known::Environment) -> Option<PathBuf> {
    for known_path in environment.get_know_global_search_locations() {
        let bin = known_path.join("pyenv");
        if bin.exists() {
            return Some(bin);
        }
    }
    None
}

fn get_pyenv_dir(environment: &dyn known::Environment) -> Option<PathBuf> {
    // Check if the pyenv environment variables exist: PYENV on Windows, PYENV_ROOT on Unix.
    // They contain the path to pyenv's installation folder.
    // If they don't exist, use the default path: ~/.pyenv/pyenv-win on Windows, ~/.pyenv on Unix.
    // If the interpreter path starts with the path to the pyenv folder, then it is a pyenv environment.
    // See https://github.com/pyenv/pyenv#locating-the-python-installation for general usage,
    // And https://github.com/pyenv-win/pyenv-win for Windows specifics.

    match environment.get_env_var("PYENV_ROOT".to_string()) {
        Some(dir) => Some(PathBuf::from(dir)),
        None => match environment.get_env_var("PYENV".to_string()) {
            Some(dir) => Some(PathBuf::from(dir)),
            None => get_home_pyenv_dir(environment),
        },
    }
}

fn get_pyenv_binary(environment: &dyn known::Environment) -> Option<PathBuf> {
    let dir = get_pyenv_dir(environment)?;
    let exe = PathBuf::from(dir).join("bin").join("pyenv");
    if fs::metadata(&exe).is_ok() {
        Some(exe)
    } else {
        get_binary_from_known_paths(environment)
    }
}

fn get_pyenv_version(folder_name: &String) -> Option<String> {
    // Stable Versions = like 3.10.10
    let python_regex = Regex::new(r"^(\d+\.\d+\.\d+)$").unwrap();
    match python_regex.captures(&folder_name) {
        Some(captures) => match captures.get(1) {
            Some(version) => Some(version.as_str().to_string()),
            None => None,
        },
        None => {
            // Dev Versions = like 3.10-dev
            let python_regex = Regex::new(r"^(\d+\.\d+-dev)$").unwrap();
            match python_regex.captures(&folder_name) {
                Some(captures) => match captures.get(1) {
                    Some(version) => Some(version.as_str().to_string()),
                    None => None,
                },
                None => {
                    // Alpha, rc Versions = like 3.10.0a3
                    let python_regex = Regex::new(r"^(\d+\.\d+.\d+\w\d+)").unwrap();
                    match python_regex.captures(&folder_name) {
                        Some(captures) => match captures.get(1) {
                            Some(version) => Some(version.as_str().to_string()),
                            None => None,
                        },
                        None => None,
                    }
                }
            }
        }
    }
}

fn get_pure_python_environment(
    executable: &PathBuf,
    path: &PathBuf,
    manager: &Option<EnvManager>,
) -> Option<PythonEnvironment> {
    let version = get_pyenv_version(&path.file_name().unwrap().to_string_lossy().to_string())?;
    Some(messaging::PythonEnvironment::new(
        None,
        Some(executable.clone()),
        messaging::PythonEnvironmentCategory::Pyenv,
        Some(version),
        Some(path.clone()),
        Some(path.clone()),
        manager.clone(),
        Some(vec![executable
            .clone()
            .into_os_string()
            .into_string()
            .unwrap()]),
    ))
}

fn get_virtual_env_environment(
    executable: &PathBuf,
    path: &PathBuf,
    manager: &Option<EnvManager>,
) -> Option<messaging::PythonEnvironment> {
    let pyenv_cfg = find_and_parse_pyvenv_cfg(executable)?;
    let folder_name = path.file_name().unwrap().to_string_lossy().to_string();
    Some(messaging::PythonEnvironment::new(
        Some(folder_name),
        Some(executable.clone()),
        messaging::PythonEnvironmentCategory::PyenvVirtualEnv,
        Some(pyenv_cfg.version),
        Some(path.clone()),
        Some(path.clone()),
        manager.clone(),
        Some(vec![executable
            .clone()
            .into_os_string()
            .into_string()
            .unwrap()]),
    ))
}

pub fn list_pyenv_environments(
    manager: &Option<EnvManager>,
    environment: &dyn known::Environment,
) -> Option<Vec<messaging::PythonEnvironment>> {
    let pyenv_dir = get_pyenv_dir(environment)?;
    let mut envs: Vec<messaging::PythonEnvironment> = vec![];
    let versions_dir = PathBuf::from(&pyenv_dir)
        .join("versions")
        .into_os_string()
        .into_string()
        .ok()?;

    for entry in fs::read_dir(&versions_dir).ok()? {
        if let Ok(path) = entry {
            let path = path.path();
            if !path.is_dir() {
                continue;
            }
            if let Some(executable) = find_python_binary_path(&path) {
                match get_pure_python_environment(&executable, &path, manager) {
                    Some(env) => envs.push(env),
                    None => match get_virtual_env_environment(&executable, &path, manager) {
                        Some(env) => envs.push(env),
                        None => (),
                    },
                }
            }
        }
    }

    Some(envs)
}

pub struct PyEnv<'a> {
    pub environment: &'a dyn Environment,
}

impl PyEnv<'_> {
    pub fn with<'a>(environment: &'a impl Environment) -> PyEnv {
        PyEnv { environment }
    }
}

impl Locator for PyEnv<'_> {
    fn resolve(&self, _env: &PythonEnv) -> Option<PythonEnvironment> {
        // We will find everything in gather
        None
    }

    fn find(&self) -> Option<LocatorResult> {
        let pyenv_binary = get_pyenv_binary(self.environment)?;
        let manager = messaging::EnvManager::new(pyenv_binary, None, EnvManagerType::Pyenv);
        let mut environments: Vec<PythonEnvironment> = vec![];
        if let Some(envs) = list_pyenv_environments(&Some(manager.clone()), self.environment) {
            for env in envs {
                environments.push(env);
            }
        }

        Some(LocatorResult {
            managers: vec![manager],
            environments,
        })
    }
}
