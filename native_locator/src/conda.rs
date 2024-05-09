// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use crate::known;
use crate::messaging;
use crate::messaging::EnvManagerType;
use crate::utils::find_python_binary_path;
use regex::Regex;
use std::env;
use std::path::{Path, PathBuf};

/// relative to the interpreter. This layout is common on linux/Mac.
///
/// ```
/// env             // <--- Input can be this path
/// |-- conda-meta  // <--- Returns this directory
/// |-- bin         // <--- Input can be this path
///     |-- python  // <--- Input can be this path
/// ```
#[cfg(unix)]
fn get_conda_meta_path(any_path: &Path) -> Option<PathBuf> {
    if any_path.ends_with("bin/python") {
        match any_path.parent() {
            Some(parent) => match parent.parent() {
                Some(parent) => Some(parent.to_path_buf().join("conda-meta")),
                None => None,
            },
            None => None,
        }
    } else if any_path.ends_with("bin") {
        match any_path.parent() {
            Some(parent) => Some(parent.to_path_buf().join("conda-meta")),
            None => None,
        }
    } else {
        Some(any_path.to_path_buf().join("conda-meta"))
    }
}

/// Get the conda-meta directory. For windows 'conda-meta' is in the same directory as the interpreter.
/// This layout is common in Windows.
///
/// ```
/// env             // <--- Input can be this path
/// |-- conda-meta  // <--- Returns this directory
/// |-- python.exe  // <--- Input can be this path
/// ```
#[cfg(windows)]
fn get_conda_meta_path(any_path: &Path) -> Option<PathBuf> {
    if any_path.ends_with("python.exe") {
        match any_path.parent() {
            Some(parent) => Some(parent.to_path_buf().join("conda-meta")),
            None => None,
        }
    } else {
        Some(any_path.to_path_buf().join("conda-meta"))
    }
}

/// Check if a given path is a conda environment. A conda environment is a directory that contains
/// a 'conda-meta' directory as child. This will find 'conda-meta' in a platform agnostic way.
pub fn is_conda_environment(any_path: &Path) -> bool {
    let conda_meta_path = get_conda_meta_path(any_path);
    match conda_meta_path {
        Some(path) => path.exists(),
        None => false,
    }
}

/// Get the version of a package in a conda environment. This will find the version
/// from the 'conda-meta' directory in a platform agnostic way.
fn get_version_from_meta_json(json_file: &Path) -> Option<String> {
    let file_name = json_file.file_name()?.to_string_lossy();

    match Regex::new(r"(?m)([\d\w\-]*)-([\d\.]*)-.*\.json")
        .ok()?
        .captures(&file_name)?
        .get(2)
    {
        Some(version) => Some(version.as_str().to_string()),
        None => None,
    }
}

/// Get the path to the json file of a package in the conda environment from the 'conda-meta' directory.
fn get_conda_package_json_path(any_path: &Path, package: &str) -> Option<PathBuf> {
    let package_name = format!("{}-", package);
    let conda_meta_path = get_conda_meta_path(any_path)?;
    std::fs::read_dir(conda_meta_path).ok()?.find_map(|entry| {
        let path = entry.ok()?.path();
        let file_name = path.file_name()?.to_string_lossy();
        if file_name.starts_with(&package_name) && file_name.ends_with(".json") {
            Some(path)
        } else {
            None
        }
    })
}

/// Checks if the `python` package is installed in the conda environment
#[allow(dead_code)]
pub fn is_python_conda_env(any_path: &Path) -> bool {
    let conda_python_json_path = get_conda_package_json_path(any_path, "python");
    match conda_python_json_path {
        Some(path) => path.exists(),
        None => false,
    }
}

/// Get the version of the `python` package in the conda environment
pub fn get_conda_python_version(any_path: &Path) -> Option<String> {
    let conda_python_json_path = get_conda_package_json_path(any_path, "python");
    match conda_python_json_path {
        Some(path) => get_version_from_meta_json(&path),
        None => None,
    }
}

/// Specifically returns the file names that are valid for 'conda' on windows
#[cfg(windows)]
fn get_conda_bin_names() -> Vec<&'static str> {
    vec!["conda.exe", "conda.bat"]
}

/// Specifically returns the file names that are valid for 'conda' on linux/Mac
#[cfg(unix)]
fn get_conda_bin_names() -> Vec<&'static str> {
    vec!["conda"]
}

/// Find the conda binary on the PATH environment variable
fn find_conda_binary_on_path(environment: &impl known::Environment) -> Option<PathBuf> {
    let paths = environment.get_env_var("PATH".to_string())?;
    for path in env::split_paths(&paths) {
        for bin in get_conda_bin_names() {
            let conda_path = path.join(bin);
            match std::fs::metadata(&conda_path) {
                Ok(metadata) => {
                    if metadata.is_file() || metadata.is_symlink() {
                        return Some(conda_path);
                    }
                }
                Err(_) => (),
            }
        }
    }
    None
}

#[cfg(windows)]
fn get_known_conda_locations(environment: &impl known::Environment) -> Vec<PathBuf> {
    let user_profile = environment.get_env_var("USERPROFILE".to_string()).unwrap();
    let program_data = environment.get_env_var("PROGRAMDATA".to_string()).unwrap();
    let all_user_profile = environment
        .get_env_var("ALLUSERSPROFILE".to_string())
        .unwrap();
    let home_drive = environment.get_env_var("HOMEDRIVE".to_string()).unwrap();
    let mut known_paths = vec![
        Path::new(&user_profile).join("Anaconda3\\Scripts"),
        Path::new(&program_data).join("Anaconda3\\Scripts"),
        Path::new(&all_user_profile).join("Anaconda3\\Scripts"),
        Path::new(&home_drive).join("Anaconda3\\Scripts"),
        Path::new(&user_profile).join("Miniconda3\\Scripts"),
        Path::new(&program_data).join("Miniconda3\\Scripts"),
        Path::new(&all_user_profile).join("Miniconda3\\Scripts"),
        Path::new(&home_drive).join("Miniconda3\\Scripts"),
    ];
    known_paths.append(&mut environment.get_know_global_search_locations());
    known_paths
}

#[cfg(unix)]
fn get_known_conda_locations(environment: &impl known::Environment) -> Vec<PathBuf> {
    let mut known_paths = vec![
        PathBuf::from("/opt/anaconda3/bin"),
        PathBuf::from("/opt/miniconda3/bin"),
        PathBuf::from("/usr/local/anaconda3/bin"),
        PathBuf::from("/usr/local/miniconda3/bin"),
        PathBuf::from("/usr/anaconda3/bin"),
        PathBuf::from("/usr/miniconda3/bin"),
        PathBuf::from("/home/anaconda3/bin"),
        PathBuf::from("/home/miniconda3/bin"),
        PathBuf::from("/anaconda3/bin"),
        PathBuf::from("/miniconda3/bin"),
    ];
    if let Some(home) = environment.get_user_home() {
        known_paths.push(PathBuf::from(home.clone()).join("anaconda3/bin"));
        known_paths.push(PathBuf::from(home).join("miniconda3/bin"));
    }
    known_paths.append(&mut environment.get_know_global_search_locations());
    known_paths
}

/// Find conda binary in known locations
fn find_conda_binary_in_known_locations(environment: &impl known::Environment) -> Option<PathBuf> {
    let conda_bin_names = get_conda_bin_names();
    let known_locations = get_known_conda_locations(environment);
    for location in known_locations {
        for bin in &conda_bin_names {
            let conda_path = location.join(bin);
            if let Some(metadata) = std::fs::metadata(&conda_path).ok() {
                if metadata.is_file() || metadata.is_symlink() {
                    return Some(conda_path);
                }
            }
        }
    }
    None
}

/// Find the conda binary on the system
pub fn find_conda_binary(environment: &impl known::Environment) -> Option<PathBuf> {
    let conda_binary_on_path = find_conda_binary_on_path(environment);
    match conda_binary_on_path {
        Some(conda_binary_on_path) => Some(conda_binary_on_path),
        None => find_conda_binary_in_known_locations(environment),
    }
}

pub fn get_conda_version(conda_binary: &PathBuf) -> Option<String> {
    let mut parent = conda_binary.parent()?;
    if parent.ends_with("bin") {
        parent = parent.parent()?;
    }
    if parent.ends_with("Library") {
        parent = parent.parent()?;
    }
    let conda_python_json_path = match get_conda_package_json_path(&parent, "conda") {
        Some(exe) => Some(exe),
        None => get_conda_package_json_path(&parent.parent()?, "conda"),
    }?;
    get_version_from_meta_json(&conda_python_json_path)
}

fn get_conda_envs_from_environment_txt(environment: &impl known::Environment) -> Vec<String> {
    let mut envs = vec![];
    let home = environment.get_user_home();
    match home {
        Some(home) => {
            let home = Path::new(&home);
            let environment_txt = home.join(".conda").join("environments.txt");
            match std::fs::read_to_string(environment_txt) {
                Ok(reader) => {
                    for line in reader.lines() {
                        envs.push(line.to_string());
                    }
                }
                Err(_) => (),
            }
        }
        None => (),
    }
    envs
}

fn get_known_env_locations(
    conda_bin: &PathBuf,
    environment: &impl known::Environment,
) -> Vec<String> {
    let mut paths = vec![];
    let home = environment.get_user_home();
    match home {
        Some(home) => {
            let home = Path::new(&home);
            let conda_envs = home.join(".conda").join("envs");
            paths.push(conda_envs.to_string_lossy().to_string());
        }
        None => (),
    }

    match conda_bin.parent() {
        Some(parent) => {
            paths.push(parent.to_string_lossy().to_string());
            let conda_envs = parent.join("envs");
            paths.push(conda_envs.to_string_lossy().to_string());
            match parent.parent() {
                Some(parent) => {
                    paths.push(parent.to_string_lossy().to_string());
                    let conda_envs = parent.join("envs");
                    paths.push(conda_envs.to_string_lossy().to_string());
                }
                None => (),
            }
        }
        None => (),
    }

    paths
}

fn get_conda_envs_from_known_env_locations(
    conda_bin: &PathBuf,
    environment: &impl known::Environment,
) -> Vec<String> {
    let mut envs = vec![];
    for location in get_known_env_locations(conda_bin, environment) {
        if is_conda_environment(&Path::new(&location)) {
            envs.push(location.to_string());
        }
        match std::fs::read_dir(location) {
            Ok(reader) => {
                for entry in reader {
                    match entry {
                        Ok(entry) => {
                            let metadata = entry.metadata();
                            match metadata {
                                Ok(metadata) => {
                                    if metadata.is_dir() {
                                        let path = entry.path();
                                        if is_conda_environment(&path) {
                                            envs.push(path.to_string_lossy().to_string());
                                        }
                                    }
                                }
                                Err(_) => (),
                            }
                        }
                        Err(_) => (),
                    }
                }
            }
            Err(_) => (),
        }
    }
    envs
}

struct CondaEnv {
    named: bool,
    name: String,
    path: PathBuf,
}

fn get_distinct_conda_envs(
    conda_bin: &PathBuf,
    environment: &impl known::Environment,
) -> Vec<CondaEnv> {
    let mut envs = get_conda_envs_from_environment_txt(environment);
    let mut known_envs = get_conda_envs_from_known_env_locations(conda_bin, environment);
    envs.append(&mut known_envs);
    envs.sort();
    envs.dedup();

    let locations = get_known_env_locations(conda_bin, environment);
    let mut conda_envs = vec![];
    for env in envs {
        let env = Path::new(&env);
        let mut named = false;
        let mut name = "".to_string();
        for location in &locations {
            let location = Path::new(location).join("envs");
            match env.strip_prefix(location) {
                Ok(prefix) => {
                    named = true;
                    name = match prefix.to_str() {
                        Some(name) => {
                            let name = name.to_string();
                            if name == "" {
                                "base".to_string()
                            } else {
                                name.to_string()
                            }
                        }
                        None => "base".to_string(),
                    };
                    break;
                }
                Err(_) => (),
            }
        }
        conda_envs.push(CondaEnv {
            named,
            name,
            path: PathBuf::from(env),
        });
    }
    conda_envs
}

pub fn find_and_report(
    dispatcher: &mut impl messaging::MessageDispatcher,
    environment: &impl known::Environment,
) {
    let conda_binary = find_conda_binary(environment);
    match conda_binary {
        Some(conda_binary) => {
            let params = messaging::EnvManager::new(
                conda_binary.clone(),
                get_conda_version(&conda_binary),
                EnvManagerType::Conda,
            );
            dispatcher.report_environment_manager(params);

            let envs = get_distinct_conda_envs(&conda_binary, environment);
            for env in envs {
                let executable = find_python_binary_path(Path::new(&env.path));
                let params = messaging::PythonEnvironment::new(
                    Some(env.name.to_string()),
                    executable,
                    messaging::PythonEnvironmentCategory::Conda,
                    get_conda_python_version(&env.path),
                    Some(env.path.clone()),
                    Some(env.path.clone()),
                    None,
                    if env.named {
                        Some(vec![
                            conda_binary.to_string_lossy().to_string(),
                            "run".to_string(),
                            "-n".to_string(),
                            env.name.to_string(),
                            "python".to_string(),
                        ])
                    } else {
                        Some(vec![
                            conda_binary.to_string_lossy().to_string(),
                            "run".to_string(),
                            "-p".to_string(),
                            env.path.to_string_lossy().to_string(),
                            "python".to_string(),
                        ])
                    },
                );
                dispatcher.report_environment(params);
            }
        }
        None => (),
    }
}
