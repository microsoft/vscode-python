// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use crate::known;
use crate::known::Environment;
use crate::locator::Locator;
use crate::locator::LocatorResult;
use crate::messaging;
use crate::messaging::EnvManager;
use crate::messaging::EnvManagerType;
use crate::messaging::PythonEnvironment;
use crate::utils::PythonEnv;
use crate::utils::{find_python_binary_path, get_environment_key, get_environment_manager_key};
use log::warn;
use regex::Regex;
use std::collections::HashSet;
use std::env;
use std::path::{Path, PathBuf};

/// Specifically returns the file names that are valid for 'conda' on windows
/// Path is relative to the installation folder of conda.
#[cfg(windows)]
fn get_relative_paths_to_conda_executable() -> Vec<PathBuf> {
    vec![
        PathBuf::from("Scripts").join("conda.exe"),
        PathBuf::from("Scripts").join("conda.bat"),
    ]
}

/// Specifically returns the file names that are valid for 'conda' on linux/Mac
/// Path is relative to the installation folder of conda.
#[cfg(unix)]
fn get_relative_paths_to_conda_executable() -> Vec<PathBuf> {
    vec![PathBuf::from("bin").join("conda")]
}

/// Returns the relative path to the python executable for the conda installation.
/// Path is relative to the installation folder of conda.
/// In windows the python.exe for the conda installation is in the root folder.
#[cfg(windows)]
fn get_relative_paths_to_main_python_executable() -> PathBuf {
    PathBuf::from("python.exe")
}

/// Returns the relative path to the python executable for the conda installation.
/// Path is relative to the installation folder of conda.
/// In windows the python.exe for the conda installation is in the bin folder.
#[cfg(unix)]
fn get_relative_paths_to_main_python_executable() -> PathBuf {
    PathBuf::from("bin").join("python")
}

#[derive(Debug)]
struct CondaPackage {
    #[allow(dead_code)]
    path: PathBuf,
    version: String,
}

/// Get the path to the json file along with the version of a package in the conda environment from the 'conda-meta' directory.
fn get_conda_package_json_path(path: &Path, package: &str) -> Option<CondaPackage> {
    // conda-meta is in the root of the conda installation folder
    let path = path.join("conda-meta");
    let package_name = format!("{}-", package);
    let regex = Regex::new(format!("^{}-((\\d+\\.*)*)-.*.json$", package).as_str());
    std::fs::read_dir(path)
        .ok()?
        .filter_map(Result::ok)
        .find_map(|entry| {
            let path = entry.path();
            let file_name = path.file_name()?.to_string_lossy();
            if file_name.starts_with(&package_name) && file_name.ends_with(".json") {
                match regex.clone().ok().unwrap().captures(&file_name)?.get(1) {
                    Some(version) => Some(CondaPackage {
                        path: path.clone(),
                        version: version.as_str().to_string(),
                    }),
                    None => None,
                }
            } else {
                None
            }
        })
}

fn get_conda_executable(path: &PathBuf) -> Option<PathBuf> {
    for relative_path in get_relative_paths_to_conda_executable() {
        let exe = path.join(&relative_path);
        if exe.exists() {
            return Some(exe);
        }
    }

    None
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
fn find_conda_binary_on_path(environment: &dyn known::Environment) -> Option<PathBuf> {
    let paths = environment.get_env_var("PATH".to_string())?;
    for path in env::split_paths(&paths) {
        for bin in get_conda_bin_names() {
            let conda_path = path.join(bin);
            if let Ok(metadata) = std::fs::metadata(&conda_path) {
                if metadata.is_file() || metadata.is_symlink() {
                    return Some(conda_path);
                }
            }
        }
    }
    None
}

#[cfg(windows)]
fn get_known_conda_locations(environment: &dyn known::Environment) -> Vec<PathBuf> {
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
fn get_known_conda_locations(environment: &dyn known::Environment) -> Vec<PathBuf> {
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
fn find_conda_binary_in_known_locations(environment: &dyn known::Environment) -> Option<PathBuf> {
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
pub fn find_conda_binary(environment: &dyn known::Environment) -> Option<PathBuf> {
    let conda_binary_on_path = find_conda_binary_on_path(environment);
    match conda_binary_on_path {
        Some(conda_binary_on_path) => Some(conda_binary_on_path),
        None => find_conda_binary_in_known_locations(environment),
    }
}

fn get_conda_manager(path: &PathBuf) -> Option<EnvManager> {
    let conda_exe = get_conda_executable(path)?;
    let conda_pkg = get_conda_package_json_path(path, "conda")?;

    Some(EnvManager {
        executable_path: conda_exe,
        version: Some(conda_pkg.version),
        tool: EnvManagerType::Conda,
    })
}

#[derive(Debug, Clone)]
struct CondaEnvironment {
    name: String,
    named: bool,
    path: PathBuf,
    python_executable_path: Option<PathBuf>,
    version: Option<String>,
}
fn get_conda_environment_info(env_path: &PathBuf, named: bool) -> Option<CondaEnvironment> {
    let metadata = env_path.metadata();
    if let Ok(metadata) = metadata {
        if metadata.is_dir() {
            let path = env_path.clone();
            if let Some(python_binary) = find_python_binary_path(&path) {
                if let Some(package_info) = get_conda_package_json_path(&path, "python") {
                    return Some(CondaEnvironment {
                        name: path.file_name()?.to_string_lossy().to_string(),
                        path,
                        named,
                        python_executable_path: Some(python_binary),
                        version: Some(package_info.version),
                    });
                } else {
                    return Some(CondaEnvironment {
                        name: path.file_name()?.to_string_lossy().to_string(),
                        path,
                        named,
                        python_executable_path: Some(python_binary),
                        version: None,
                    });
                }
            } else {
                return Some(CondaEnvironment {
                    name: path.file_name()?.to_string_lossy().to_string(),
                    path,
                    named,
                    python_executable_path: None,
                    version: None,
                });
            }
        }
    }

    None
}
fn get_environments_from_envs_folder_in_conda_directory(
    path: &Path,
) -> Option<Vec<CondaEnvironment>> {
    let mut envs: Vec<CondaEnvironment> = vec![];
    // iterate through all sub directories in the env folder
    // for each sub directory, check if it has a python executable
    // if it does, create a PythonEnvironment object and add it to the list
    for entry in std::fs::read_dir(path.join("envs"))
        .ok()?
        .filter_map(Result::ok)
    {
        if let Some(env) = get_conda_environment_info(&entry.path(), true) {
            envs.push(env);
        }
    }

    Some(envs)
}

fn get_conda_envs_from_environment_txt(environment: &dyn known::Environment) -> Vec<String> {
    let mut envs = vec![];
    if let Some(home) = environment.get_user_home() {
        let home = Path::new(&home);
        let environment_txt = home.join(".conda").join("environments.txt");
        if let Ok(reader) = std::fs::read_to_string(environment_txt) {
            for line in reader.lines() {
                envs.push(line.to_string());
            }
        }
    }
    envs
}

#[derive(Debug)]
struct Condarc {
    env_dirs: Vec<PathBuf>,
}

/**
 * The .condarc file contains a list of directories where conda environments are created.
 * https://conda.io/projects/conda/en/latest/configuration.html#envs-dirs
 *
 * TODO: Search for the .condarc file in the following locations:
 * https://conda.io/projects/conda/en/latest/user-guide/configuration/use-condarc.html#searching-for-condarc
 */
fn get_conda_conda_rc(environment: &dyn known::Environment) -> Option<Condarc> {
    if let Some(home) = environment.get_user_home() {
        let conda_rc = Path::new(&home).join(".condarc");
        let mut start_consuming_values = false;
        if let Ok(reader) = std::fs::read_to_string(conda_rc) {
            let mut env_dirs = vec![];
            for line in reader.lines() {
                if line.starts_with("envs_dirs:") && !start_consuming_values {
                    start_consuming_values = true;
                    continue;
                }
                if start_consuming_values {
                    if line.trim().starts_with("-") {
                        if let Some(env_dir) = line.splitn(2, '-').nth(1) {
                            let env_dir = PathBuf::from(env_dir.trim());
                            if env_dir.exists() {
                                env_dirs.push(env_dir);
                            }
                        }
                        continue;
                    } else {
                        break;
                    }
                }
            }
            return Some(Condarc { env_dirs });
        }
    }
    None
}

fn get_conda_envs_from_conda_rc(
    root_conda_path: &PathBuf,
    environment: &dyn known::Environment,
) -> Option<Vec<CondaEnvironment>> {
    let mut envs: Vec<CondaEnvironment> = vec![];
    for env in get_conda_conda_rc(environment)?.env_dirs {
        if let Ok(reader) = std::fs::read_dir(env) {
            for entry in reader.filter_map(Result::ok) {
                if entry.path().is_dir()
                    && was_conda_environment_created_by_specific_conda(
                        &entry.path(),
                        root_conda_path,
                    )
                {
                    if let Some(env) = get_conda_environment_info(&entry.path(), false) {
                        envs.push(env);
                    }
                }
            }
        }
    }

    Some(envs)
}

/**
 * When we create conda environments in specific folder using the -p argument, the location of the conda executable is not know.
 * If the user has multiple conda installations, any one of those could have created that specific environment.
 * Fortunately the conda-meta/history file contains the path to the conda executable (script) that was used to create the environment.
 * The format of the file is as follows:
 * # cmd: C:\Users\user\miniconda3\Scripts\conda-script.py create --name myenv
 *
 * Thus all we need to do is to look for the 'cmd' line in the file and extract the path to the conda executable and match that against the path provided.
 */
fn was_conda_environment_created_by_specific_conda(
    env_path: &PathBuf,
    root_conda_path: &PathBuf,
) -> bool {
    let conda_meta_history = env_path.join("conda-meta").join("history");
    if let Ok(reader) = std::fs::read_to_string(conda_meta_history.clone()) {
        for line in reader.lines() {
            let line = line.to_lowercase();
            if line.starts_with("# cmd:") && line.contains(" create ") {
                if line.contains(&root_conda_path.to_str().unwrap().to_lowercase()) {
                    return true;
                } else {
                    return false;
                }
            }
        }
    }

    false
}

/**
 * When we create conda environments in specific folder using the -p argument, the location of the conda executable is not know.
 * If the user has multiple conda installations, any one of those could have created that specific environment.
 * Fortunately the conda-meta/history file contains the path to the conda executable (script) that was used to create the environment.
 * The format of the file is as follows:
 * # cmd: C:\Users\user\miniconda3\Scripts\conda-script.py create --name myenv
 *
 * Thus all we need to do is to look for the 'cmd' line in the file and extract the path to the conda executable and match that against the path provided.
 */
fn get_environments_from_environments_txt_belonging_to_conda_directory(
    path: &PathBuf,
    environment: &dyn known::Environment,
) -> Option<Vec<CondaEnvironment>> {
    let mut envs: Vec<CondaEnvironment> = vec![];
    for env in get_conda_envs_from_environment_txt(environment) {
        // Only include those environments that were created by the specific conda installation
        // Ignore environments that are in the env sub directory of the conda folder, as those would have been
        // tracked elsewhere, we're only interested in conda envs located in other parts of the file system created using the -p flag.
        if env.contains(path.to_str().unwrap()) {
            continue;
        }

        let env_path = PathBuf::from(env);
        if !env_path.is_dir() {
            continue;
        }
        if was_conda_environment_created_by_specific_conda(&env_path, path) {
            if let Some(env) = get_conda_environment_info(&env_path, false) {
                envs.push(env);
            }
        }
    }

    Some(envs)
}

fn get_conda_environments_from_conda_directory(
    path: &PathBuf,
    environment: &dyn known::Environment,
) -> Option<Vec<CondaEnvironment>> {
    let mut all_envs: Vec<CondaEnvironment> = vec![];
    if let Some(envs) = get_environments_from_envs_folder_in_conda_directory(path) {
        envs.iter().for_each(|env| all_envs.push(env.clone()));
    }

    if let Some(envs) =
        get_environments_from_environments_txt_belonging_to_conda_directory(path, environment)
    {
        envs.iter().for_each(|env| all_envs.push(env.clone()));
    }

    if let Some(envs) = get_conda_envs_from_conda_rc(path, environment) {
        envs.iter().for_each(|env| all_envs.push(env.clone()));
    }

    Some(all_envs)
}

#[cfg(windows)]
fn get_known_conda_install_locations(environment: &dyn known::Environment) -> Vec<PathBuf> {
    let user_profile = environment.get_env_var("USERPROFILE".to_string()).unwrap();
    let program_data = environment.get_env_var("PROGRAMDATA".to_string()).unwrap();
    let all_user_profile = environment
        .get_env_var("ALLUSERSPROFILE".to_string())
        .unwrap();
    let home_drive = environment.get_env_var("HOMEDRIVE".to_string()).unwrap();
    let mut known_paths = vec![
        Path::new(&user_profile).join("Anaconda3"),
        Path::new(&program_data).join("Anaconda3"),
        Path::new(&all_user_profile).join("Anaconda3"),
        Path::new(&home_drive).join("Anaconda3"),
        Path::new(&user_profile).join("Miniconda3"),
        Path::new(&program_data).join("Miniconda3"),
        Path::new(&all_user_profile).join("Miniconda3"),
        Path::new(&home_drive).join("Miniconda3"),
        Path::new(&all_user_profile).join("miniforge3"),
        Path::new(&home_drive).join("miniforge3"),
    ];
    if let Some(home) = environment.get_user_home() {
        known_paths.push(PathBuf::from(home.clone()).join("anaconda3"));
        known_paths.push(PathBuf::from(home.clone()).join("miniconda3"));
        known_paths.push(PathBuf::from(home.clone()).join("miniforge3"));
        known_paths.push(PathBuf::from(home).join(".conda"));
    }
    known_paths
}

#[cfg(unix)]
fn get_known_conda_install_locations(environment: &dyn known::Environment) -> Vec<PathBuf> {
    let mut known_paths = vec![
        PathBuf::from("/opt/anaconda3"),
        PathBuf::from("/opt/miniconda3"),
        PathBuf::from("/usr/local/anaconda3"),
        PathBuf::from("/usr/local/miniconda3"),
        PathBuf::from("/usr/anaconda3"),
        PathBuf::from("/usr/miniconda3"),
        PathBuf::from("/home/anaconda3"),
        PathBuf::from("/home/miniconda3"),
        PathBuf::from("/anaconda3"),
        PathBuf::from("/miniconda3"),
        PathBuf::from("/miniforge3"),
        PathBuf::from("/miniforge3"),
    ];
    if let Some(home) = environment.get_user_home() {
        known_paths.push(PathBuf::from(home.clone()).join("anaconda3"));
        known_paths.push(PathBuf::from(home.clone()).join("miniconda3"));
        known_paths.push(PathBuf::from(home.clone()).join("miniforge3"));
        known_paths.push(PathBuf::from(home).join(".conda"));
    }
    known_paths
}

fn get_activation_command(env: &CondaEnvironment, manager: &EnvManager) -> Option<Vec<String>> {
    if env.python_executable_path.is_none() {
        return None;
    }
    let conda_exe = manager.executable_path.to_str().unwrap().to_string();
    if env.named {
        Some(vec![
            conda_exe,
            "run".to_string(),
            "-n".to_string(),
            env.name.clone(),
            "python".to_string(),
        ])
    } else {
        Some(vec![
            conda_exe,
            "run".to_string(),
            "-p".to_string(),
            env.path.to_str().unwrap().to_string(),
            "python".to_string(),
        ])
    }
}

fn get_root_python_environment(path: &PathBuf, manager: &EnvManager) -> Option<PythonEnvironment> {
    let python_exe = path.join(get_relative_paths_to_main_python_executable());
    if !python_exe.exists() {
        return None;
    }
    if let Some(package_info) = get_conda_package_json_path(&path, "python") {
        let conda_exe = manager.executable_path.to_str().unwrap().to_string();
        return Some(PythonEnvironment {
            display_name: None,
            name: None,
            category: messaging::PythonEnvironmentCategory::Conda,
            python_executable_path: Some(python_exe),
            version: Some(package_info.version),
            env_path: Some(path.clone()),
            env_manager: Some(manager.clone()),
            python_run_command: Some(vec![
                conda_exe,
                "run".to_string(),
                "-p".to_string(),
                path.to_str().unwrap().to_string(),
                "python".to_string(),
            ]),
            project_path: None,
        });
    }
    None
}

pub fn get_conda_environments_in_specified_path(
    possible_conda_folder: &PathBuf,
    environment: &dyn known::Environment,
) -> Option<LocatorResult> {
    let mut managers: Vec<EnvManager> = vec![];
    let mut environments: Vec<PythonEnvironment> = vec![];
    let mut detected_envs: HashSet<String> = HashSet::new();
    let mut detected_managers: HashSet<String> = HashSet::new();
    if possible_conda_folder.is_dir() && possible_conda_folder.exists() {
        if let Some(manager) = get_conda_manager(&possible_conda_folder) {
            let envs =
                get_conda_environments_from_conda_directory(&possible_conda_folder, environment);

            if let Some(env) = get_root_python_environment(&possible_conda_folder, &manager) {
                if let Some(key) = get_environment_key(&env) {
                    if !detected_envs.contains(&key) {
                        detected_envs.insert(key);
                        environments.push(env);
                    }
                }
            }

            envs.unwrap_or_default().iter().for_each(|env| {
                let exe = env.python_executable_path.clone();
                let env = PythonEnvironment::new(
                    None,
                    Some(env.name.clone()),
                    exe.clone(),
                    messaging::PythonEnvironmentCategory::Conda,
                    env.version.clone(),
                    Some(env.path.clone()),
                    Some(manager.clone()),
                    get_activation_command(env, &manager),
                );
                if let Some(key) = get_environment_key(&env) {
                    if !detected_envs.contains(&key) {
                        detected_envs.insert(key);
                        environments.push(env);
                    }
                }
            });

            let key = get_environment_manager_key(&manager);
            if !detected_managers.contains(&key) {
                detected_managers.insert(key);
                managers.push(manager);
            }
        }
    }

    if managers.is_empty() && environments.is_empty() {
        return None;
    }

    Some(LocatorResult {
        managers,
        environments,
    })
}

fn find_conda_environments_from_known_conda_install_locations(
    environment: &dyn known::Environment,
) -> Option<LocatorResult> {
    let mut managers: Vec<EnvManager> = vec![];
    let mut environments: Vec<PythonEnvironment> = vec![];
    let mut detected_envs: HashSet<String> = HashSet::new();
    let mut detected_managers: HashSet<String> = HashSet::new();

    for possible_conda_folder in get_known_conda_install_locations(environment) {
        if let Some(result) =
            get_conda_environments_in_specified_path(&possible_conda_folder, environment)
        {
            result.managers.iter().for_each(|m| {
                let key = get_environment_manager_key(m);
                if !detected_managers.contains(&key) {
                    detected_managers.insert(key);
                    managers.push(m.clone());
                }
            });

            result.environments.iter().for_each(|e| {
                if let Some(key) = get_environment_key(e) {
                    if !detected_envs.contains(&key) {
                        detected_envs.insert(key);
                        environments.push(e.clone());
                    }
                }
            });
        }
    }

    if managers.is_empty() && environments.is_empty() {
        return None;
    }

    Some(LocatorResult {
        managers,
        environments,
    })
}

pub fn get_conda_version(conda_binary: &PathBuf) -> Option<String> {
    let mut parent = conda_binary.parent()?;
    if parent.ends_with("bin") {
        parent = parent.parent()?;
    }
    if parent.ends_with("Library") {
        parent = parent.parent()?;
    }
    match get_conda_package_json_path(&parent, "conda") {
        Some(result) => Some(result.version),
        None => match get_conda_package_json_path(&parent.parent()?, "conda") {
            Some(result) => Some(result.version),
            None => None,
        },
    }
}

fn get_conda_environments_from_environments_txt_that_have_not_been_discovered(
    known_environment_keys: &HashSet<String>,
    known_environment: &Vec<PythonEnvironment>,
    environment: &dyn known::Environment,
) -> Option<LocatorResult> {
    let binding = get_conda_envs_from_environment_txt(environment);
    let undiscovered_environments_in_txt = binding
        .iter()
        .filter(|env| {
            for known in known_environment_keys.iter() {
                if known.contains(*env) {
                    return false;
                }
            }
            true
        })
        .collect::<Vec<&String>>();

    if undiscovered_environments_in_txt.len() == 0 {
        return None;
    }

    // Ok, weird, we have an environment in environments.txt file that was not discovered.
    // Let's try to discover it.
    warn!(
        "Found environments in environments.txt that were not discovered: {:?}",
        undiscovered_environments_in_txt
    );

    let manager = match known_environment
        .iter()
        .find_map(|env| env.env_manager.as_ref())
    {
        Some(manager) => Some(manager.clone()),
        None => {
            // Old approach of finding the conda executable.
            let conda_binary = find_conda_binary(environment)?;
            Some(EnvManager::new(
                conda_binary.clone(),
                get_conda_version(&conda_binary),
                EnvManagerType::Conda,
            ))
        }
    };

    if let Some(manager) = manager {
        let mut environments: Vec<PythonEnvironment> = vec![];
        for env in undiscovered_environments_in_txt {
            if let Some(env) = get_conda_environment_info(&PathBuf::from(env), false) {
                let exe = env.python_executable_path.clone();
                let env = PythonEnvironment::new(
                    None,
                    Some(env.name.clone()),
                    exe.clone(),
                    messaging::PythonEnvironmentCategory::Conda,
                    env.version.clone(),
                    Some(env.path.clone()),
                    Some(manager.clone()),
                    get_activation_command(&env, &manager),
                );
                environments.push(env);
            }
        }
        if environments.len() > 0 {
            return Some(LocatorResult {
                managers: vec![manager],
                environments,
            });
        }
    } else {
        warn!("Could not find conda executable to discover environments in environments.txt");
    }

    None
}

pub struct Conda<'a> {
    pub manager: Option<EnvManager>,
    pub environment: &'a dyn Environment,
    pub discovered_environments: HashSet<String>,
    pub discovered_managers: HashSet<String>,
}

pub trait CondaLocator {
    fn find_in(&mut self, possible_conda_folder: &PathBuf) -> Option<LocatorResult>;
}

impl Conda<'_> {
    pub fn with<'a>(environment: &'a impl Environment) -> Conda {
        Conda {
            environment,
            manager: None,
            discovered_environments: HashSet::new(),
            discovered_managers: HashSet::new(),
        }
    }
    fn filter_result(&mut self, result: Option<LocatorResult>) -> Option<LocatorResult> {
        if let Some(result) = result {
            let envs: Vec<PythonEnvironment> = result
                .environments
                .iter()
                .filter(|e| {
                    if let Some(key) = get_environment_key(e) {
                        if self.discovered_environments.contains(&key) {
                            return false;
                        }
                        self.discovered_environments.insert(key);
                        return true;
                    }
                    false
                })
                .cloned()
                .collect();

            let managers: Vec<EnvManager> = result
                .managers
                .iter()
                .filter(|e| {
                    let key = get_environment_manager_key(e);
                    if self.discovered_managers.contains(&key) {
                        return false;
                    }
                    self.discovered_managers.insert(key);
                    return true;
                })
                .cloned()
                .collect();

            if envs.len() > 0 || managers.len() > 0 {
                return Some(LocatorResult {
                    managers: managers,
                    environments: envs,
                });
            }
        }
        None
    }
}

impl CondaLocator for Conda<'_> {
    fn find_in(&mut self, possible_conda_folder: &PathBuf) -> Option<LocatorResult> {
        self.filter_result(get_conda_environments_in_specified_path(
            possible_conda_folder,
            self.environment,
        ))
    }
}

impl Locator for Conda<'_> {
    fn resolve(&self, _env: &PythonEnv) -> Option<PythonEnvironment> {
        // We will find everything in find
        None
    }

    fn find(&mut self) -> Option<LocatorResult> {
        let mut managers: Vec<EnvManager> = vec![];
        let mut environments: Vec<PythonEnvironment> = vec![];
        let mut detected_managers: HashSet<String> = HashSet::new();

        if let Some(result) = self.filter_result(
            find_conda_environments_from_known_conda_install_locations(self.environment),
        ) {
            result.managers.iter().for_each(|m| {
                let key = get_environment_manager_key(m);
                detected_managers.insert(key);
                managers.push(m.clone());
            });

            result
                .environments
                .iter()
                .for_each(|e| environments.push(e.clone()));
        }

        if let Some(result) = self.filter_result(
            get_conda_environments_from_environments_txt_that_have_not_been_discovered(
                &self.discovered_environments,
                &environments,
                self.environment,
            ),
        ) {
            result.managers.iter().for_each(|m| {
                let key = get_environment_manager_key(m);
                if !detected_managers.contains(&key) {
                    warn!("Found a new manager using the fallback mechanism: {:?}", m);
                    detected_managers.insert(key);
                    managers.push(m.clone());
                }
            });

            result.environments.iter().for_each(|e| {
                warn!(
                    "Found a new conda environment using the fallback mechanism: {:?}",
                    e
                );
                environments.push(e.clone());
            });
        }

        if managers.is_empty() && environments.is_empty() {
            return None;
        }

        Some(LocatorResult {
            managers,
            environments,
        })
    }
}
