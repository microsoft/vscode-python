// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

use regex::Regex;
use std::fs;
use std::path::PathBuf;

use crate::known;
use crate::messaging;
use crate::messaging::EnvManager;
use crate::messaging::EnvManagerType;
use crate::utils::find_python_binary_path;
use crate::utils::parse_pyenv_cfg;

#[cfg(windows)]
fn get_home_pyenv_dir(environment: &impl known::Environment) -> Option<PathBuf> {
    let home = environment.get_user_home()?;
    Some(PathBuf::from(home).join(".pyenv").join("pyenv-win"))
}

#[cfg(unix)]
fn get_home_pyenv_dir(environment: &impl known::Environment) -> Option<PathBuf> {
    let home = environment.get_user_home()?;
    Some(PathBuf::from(home).join(".pyenv"))
}

fn get_binary_from_known_paths(environment: &impl known::Environment) -> Option<PathBuf> {
    for known_path in environment.get_know_global_search_locations() {
        let bin = known_path.join("pyenv");
        if bin.exists() {
            return Some(bin);
        }
    }
    None
}

fn get_pyenv_dir(environment: &impl known::Environment) -> Option<PathBuf> {
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

fn get_pyenv_binary(environment: &impl known::Environment) -> Option<PathBuf> {
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

fn report_if_pure_python_environment(
    executable: &PathBuf,
    path: &PathBuf,
    manager: Option<EnvManager>,
    dispatcher: &mut impl messaging::MessageDispatcher,
) -> Option<()> {
    let version = get_pyenv_version(&path.file_name().unwrap().to_string_lossy().to_string())?;
    dispatcher.report_environment(messaging::PythonEnvironment::new(
        None,
        Some(executable.clone()),
        messaging::PythonEnvironmentCategory::Pyenv,
        Some(version),
        Some(path.clone()),
        Some(path.clone()),
        manager,
        Some(vec![executable
            .clone()
            .into_os_string()
            .into_string()
            .unwrap()]),
    ));

    Some(())
}

fn report_if_virtual_env_environment(
    executable: &PathBuf,
    path: &PathBuf,
    manager: Option<EnvManager>,
    dispatcher: &mut impl messaging::MessageDispatcher,
) -> Option<()> {
    let pyenv_cfg = parse_pyenv_cfg(path)?;
    let folder_name = path.file_name().unwrap().to_string_lossy().to_string();
    dispatcher.report_environment(messaging::PythonEnvironment::new(
        Some(folder_name),
        Some(executable.clone()),
        messaging::PythonEnvironmentCategory::PyenvVirtualEnv,
        Some(pyenv_cfg.version),
        Some(path.clone()),
        Some(path.clone()),
        manager,
        Some(vec![executable
            .clone()
            .into_os_string()
            .into_string()
            .unwrap()]),
    ));

    Some(())
}

pub fn find_and_report(
    dispatcher: &mut impl messaging::MessageDispatcher,
    environment: &impl known::Environment,
) -> Option<()> {
    let pyenv_dir = get_pyenv_dir(environment)?;

    let manager = match get_pyenv_binary(environment) {
        Some(pyenv_binary) => {
            let manager = messaging::EnvManager::new(pyenv_binary, None, EnvManagerType::Pyenv);
            dispatcher.report_environment_manager(manager.clone());
            Some(manager)
        }
        None => None,
    };

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
                if report_if_pure_python_environment(
                    &executable,
                    &path,
                    manager.clone(),
                    dispatcher,
                )
                .is_some()
                {
                    continue;
                }

                report_if_virtual_env_environment(&executable, &path, manager.clone(), dispatcher);
            }
        }
    }

    None
}
