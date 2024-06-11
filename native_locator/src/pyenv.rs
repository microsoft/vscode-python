// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

use crate::conda::CondaLocator;
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

fn get_version(folder_name: &String) -> Option<String> {
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
                        None => {
                            // win32 versions, rc Versions = like 3.11.0a-win32
                            let python_regex = Regex::new(r"^(\d+\.\d+.\d+\w\d+)-win32").unwrap();
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
    }
}

fn get_pure_python_environment(
    executable: &PathBuf,
    path: &PathBuf,
    manager: &Option<EnvManager>,
) -> Option<PythonEnvironment> {
    let file_name = path.file_name()?.to_string_lossy().to_string();
    let version = get_version(&file_name)?;
    let mut env = messaging::PythonEnvironment::new(
        None,
        None,
        Some(executable.clone()),
        messaging::PythonEnvironmentCategory::Pyenv,
        Some(version),
        Some(path.clone()),
        manager.clone(),
        Some(vec![executable
            .clone()
            .into_os_string()
            .into_string()
            .unwrap()]),
    );
    if file_name.ends_with("-win32") {
        env.arch = Some(messaging::Architecture::X86);
    }

    Some(env)
}

fn is_conda_environment(path: &PathBuf) -> bool {
    if let Some(name) = path.file_name() {
        let name = name.to_ascii_lowercase().to_string_lossy().to_string();
        return name.starts_with("anaconda")
            || name.starts_with("miniconda")
            || name.starts_with("miniforge");
    }
    false
}

fn get_virtual_env_environment(
    executable: &PathBuf,
    path: &PathBuf,
    manager: &Option<EnvManager>,
) -> Option<messaging::PythonEnvironment> {
    let pyenv_cfg = find_and_parse_pyvenv_cfg(executable)?;
    let folder_name = path.file_name().unwrap().to_string_lossy().to_string();
    Some(messaging::PythonEnvironment::new(
        None,
        Some(folder_name),
        Some(executable.clone()),
        messaging::PythonEnvironmentCategory::PyenvVirtualEnv,
        Some(pyenv_cfg.version),
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
    conda_locator: &mut dyn CondaLocator,
) -> Option<Vec<messaging::PythonEnvironment>> {
    let pyenv_dir = get_pyenv_dir(environment)?;
    let mut envs: Vec<messaging::PythonEnvironment> = vec![];
    let versions_dir = PathBuf::from(&pyenv_dir)
        .join("versions")
        .into_os_string()
        .into_string()
        .ok()?;

    for entry in fs::read_dir(&versions_dir).ok()?.filter_map(Result::ok) {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        if let Some(executable) = find_python_binary_path(&path) {
            if let Some(env) = get_pure_python_environment(&executable, &path, manager) {
                envs.push(env);
            } else if let Some(env) = get_virtual_env_environment(&executable, &path, manager) {
                envs.push(env);
            } else if is_conda_environment(&path) {
                if let Some(result) = conda_locator.find_in(&path) {
                    result.environments.iter().for_each(|e| {
                        envs.push(e.clone());
                    });
                }
            }
        }
    }

    Some(envs)
}

#[cfg(windows)]
fn get_pyenv_manager_version(
    _pyenv_binary_path: &PathBuf,
    environment: &dyn known::Environment,
) -> Option<String> {
    // In windows, the version is stored in the `.pyenv/.version` file
    let pyenv_dir = get_pyenv_dir(environment)?;
    let mut version_file = PathBuf::from(&pyenv_dir).join(".version");
    if !version_file.exists() {
        // We might have got the path `~/.pyenv/pyenv-win`
        version_file = pyenv_dir.parent()?.join(".version");
        if !version_file.exists() {
            return None;
        }
    }
    let version = fs::read_to_string(version_file).ok()?;
    let version_regex = Regex::new(r"(\d+\.\d+\.\d+)").unwrap();
    let captures = version_regex.captures(&version)?.get(1)?;
    Some(captures.as_str().to_string())
}

#[cfg(unix)]
fn get_pyenv_manager_version(
    pyenv_binary_path: &PathBuf,
    _environment: &dyn known::Environment,
) -> Option<String> {
    // Look for version in path
    // Sample /opt/homebrew/Cellar/pyenv/2.4.0/libexec/pyenv
    if !pyenv_binary_path.to_string_lossy().contains("/pyenv/") {
        return None;
    }
    // Find the real path, generally we have a symlink.
    let real_path = fs::read_link(pyenv_binary_path)
        .ok()?
        .to_string_lossy()
        .to_string();
    let version_regex = Regex::new(r"pyenv/(\d+\.\d+\.\d+)/").unwrap();
    let captures = version_regex.captures(&real_path)?.get(1)?;
    Some(captures.as_str().to_string())
}

pub struct PyEnv<'a> {
    pub environment: &'a dyn Environment,
    pub conda_locator: &'a mut dyn CondaLocator,
}

impl PyEnv<'_> {
    pub fn with<'a>(
        environment: &'a impl Environment,
        conda_locator: &'a mut impl CondaLocator,
    ) -> PyEnv<'a> {
        PyEnv {
            environment,
            conda_locator,
        }
    }
}

impl Locator for PyEnv<'_> {
    fn resolve(&self, _env: &PythonEnv) -> Option<PythonEnvironment> {
        // We will find everything in gather
        None
    }

    fn find(&mut self) -> Option<LocatorResult> {
        let pyenv_binary = get_pyenv_binary(self.environment)?;
        let version = get_pyenv_manager_version(&pyenv_binary, self.environment);
        let manager = messaging::EnvManager::new(pyenv_binary, version, EnvManagerType::Pyenv);
        let mut environments: Vec<PythonEnvironment> = vec![];
        if let Some(envs) =
            list_pyenv_environments(&Some(manager.clone()), self.environment, self.conda_locator)
        {
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
