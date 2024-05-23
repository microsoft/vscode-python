// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use crate::known;
use crate::known::Environment;
use crate::locator::Locator;
use crate::locator::LocatorResult;
use crate::messaging;
use crate::messaging::Architecture;
use crate::messaging::EnvManager;
use crate::messaging::EnvManagerType;
use crate::messaging::PythonEnvironment;
use crate::utils::PythonEnv;
use crate::utils::{find_python_binary_path, get_environment_key, get_environment_manager_key};
use log::trace;
use log::warn;
use regex::Regex;
use serde::Deserialize;
use std::collections::HashMap;
use std::collections::HashSet;
use std::env;
use std::fs::read_to_string;
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
    arch: Option<Architecture>,
}

#[derive(Deserialize, Debug)]
struct CondaMetaPackageStructure {
    channel: Option<String>,
    // version: Option<String>,
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
                if let Some(version) = regex.clone().ok().unwrap().captures(&file_name)?.get(1) {
                    let mut arch: Option<Architecture> = None;
                    // Sample contents
                    // {
                    //   "build": "h966fe2a_2",
                    //   "build_number": 2,
                    //   "channel": "https://repo.anaconda.com/pkgs/main/win-64",
                    //   "constrains": [],
                    // }
                    // 32bit channel is https://repo.anaconda.com/pkgs/main/win-32/
                    // 64bit channel is "channel": "https://repo.anaconda.com/pkgs/main/osx-arm64",
                    if let Some(contents) = read_to_string(&path).ok() {
                        if let Some(js) =
                            serde_json::from_str::<CondaMetaPackageStructure>(&contents).ok()
                        {
                            if let Some(channel) = js.channel {
                                if channel.ends_with("64") {
                                    arch = Some(Architecture::X64);
                                } else if channel.ends_with("32") {
                                    arch = Some(Architecture::X86);
                                }
                            }
                        }
                    }
                    return Some(CondaPackage {
                        path: path.clone(),
                        version: version.as_str().to_string(),
                        arch,
                    });
                }
            }
            None
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
        company: None,
        company_display_name: None,
    })
}

#[derive(Debug, Clone)]
struct CondaEnvironment {
    name: String,
    named: bool,
    env_path: PathBuf,
    python_executable_path: Option<PathBuf>,
    version: Option<String>,
    conda_install_folder: Option<String>,
    arch: Option<Architecture>,
}
fn get_conda_environment_info(env_path: &PathBuf, named: bool) -> Option<CondaEnvironment> {
    let metadata = env_path.metadata();
    if let Ok(metadata) = metadata {
        if metadata.is_dir() {
            let conda_install_folder = get_conda_installation_used_to_create_conda_env(env_path);
            let env_path = env_path.clone();
            if let Some(python_binary) = find_python_binary_path(&env_path) {
                if let Some(package_info) = get_conda_package_json_path(&env_path, "python") {
                    return Some(CondaEnvironment {
                        name: env_path.file_name()?.to_string_lossy().to_string(),
                        env_path,
                        named,
                        python_executable_path: Some(python_binary),
                        version: Some(package_info.version),
                        conda_install_folder,
                        arch: package_info.arch,
                    });
                } else {
                    return Some(CondaEnvironment {
                        name: env_path.file_name()?.to_string_lossy().to_string(),
                        env_path,
                        named,
                        python_executable_path: Some(python_binary),
                        version: None,
                        conda_install_folder,
                        arch: None,
                    });
                }
            } else {
                return Some(CondaEnvironment {
                    name: env_path.file_name()?.to_string_lossy().to_string(),
                    env_path,
                    named,
                    python_executable_path: None,
                    version: None,
                    conda_install_folder,
                    arch: None,
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
        if let Ok(reader) = std::fs::read_to_string(environment_txt.clone()) {
            trace!("Found environments.txt file {:?}", environment_txt);
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
 * Get the list of conda environments found in other locations such as
 * <user home>/.conda/envs
 * <user home>/AppData/Local/conda/conda/envs
 */
pub fn get_conda_environment_paths_from_conda_rc(
    environment: &dyn known::Environment,
) -> Vec<PathBuf> {
    if let Some(paths) = get_conda_conda_rc(environment) {
        paths.env_dirs
    } else {
        vec![]
    }
}

fn get_conda_environment_paths_from_known_paths(
    environment: &dyn known::Environment,
) -> Vec<PathBuf> {
    if let Some(home) = environment.get_user_home() {
        let mut env_paths: Vec<PathBuf> = vec![];
        let _ = [
            PathBuf::from(".conda").join("envs"),
            PathBuf::from("AppData")
                .join("Local")
                .join("conda")
                .join("conda")
                .join("envs"),
        ]
        .iter()
        .map(|path| {
            let full_path = home.join(path);
            for entry in std::fs::read_dir(full_path).ok()?.filter_map(Result::ok) {
                if entry.path().is_dir() {
                    trace!("Search for conda envs in location {:?}", entry.path());
                    env_paths.push(entry.path());
                }
            }
            None::<()>
        });
        return env_paths;
    }
    vec![]
}

#[cfg(windows)]
fn get_conda_rc_search_paths(environment: &dyn known::Environment) -> Vec<PathBuf> {
    let mut search_paths: Vec<PathBuf> = vec![
        "C:\\ProgramData\\conda\\.condarc",
        "C:\\ProgramData\\conda\\condarc",
        "C:\\ProgramData\\conda\\condarc.d",
    ]
    .iter()
    .map(|p| PathBuf::from(p))
    .collect();

    if let Some(conda_root) = environment.get_env_var("CONDA_ROOT".to_string()) {
        search_paths.append(&mut vec![
            PathBuf::from(conda_root.clone()).join(".condarc"),
            PathBuf::from(conda_root.clone()).join("condarc"),
            PathBuf::from(conda_root.clone()).join(".condarc.d"),
        ]);
    }
    if let Some(home) = environment.get_user_home() {
        search_paths.append(&mut vec![
            home.join(".config").join("conda").join(".condarc"),
            home.join(".config").join("conda").join("condarc"),
            home.join(".config").join("conda").join("condarc.d"),
            home.join(".conda").join(".condarc"),
            home.join(".conda").join("condarc"),
            home.join(".conda").join("condarc.d"),
            home.join(".condarc"),
        ]);
    }
    if let Some(conda_prefix) = environment.get_env_var("CONDA_PREFIX".to_string()) {
        search_paths.append(&mut vec![
            PathBuf::from(conda_prefix.clone()).join(".condarc"),
            PathBuf::from(conda_prefix.clone()).join("condarc"),
            PathBuf::from(conda_prefix.clone()).join(".condarc.d"),
        ]);
    }
    if let Some(condarc) = environment.get_env_var("CONDARC".to_string()) {
        search_paths.append(&mut vec![PathBuf::from(condarc)]);
    }

    search_paths
}
#[cfg(unix)]
fn get_conda_rc_search_paths(environment: &dyn known::Environment) -> Vec<PathBuf> {
    let mut search_paths: Vec<PathBuf> = vec![
        "/etc/conda/.condarc",
        "/etc/conda/condarc",
        "/etc/conda/condarc.d/",
        "/var/lib/conda/.condarc",
        "/var/lib/conda/condarc",
        "/var/lib/conda/condarc.d/",
    ]
    .iter()
    .map(|p| PathBuf::from(p))
    .map(|p| {
        // This only applies in tests.
        // We need this, as the root folder cannot be mocked.
        if let Some(root) = environment.get_root() {
            root.join(p.to_string_lossy()[1..].to_string())
        } else {
            p
        }
    })
    .collect();

    if let Some(conda_root) = environment.get_env_var("CONDA_ROOT".to_string()) {
        search_paths.append(&mut vec![
            PathBuf::from(conda_root.clone()).join(".condarc"),
            PathBuf::from(conda_root.clone()).join("condarc"),
            PathBuf::from(conda_root.clone()).join(".condarc.d"),
        ]);
    }
    if let Some(xdg_config_home) = environment.get_env_var("XDG_CONFIG_HOME".to_string()) {
        search_paths.append(&mut vec![
            PathBuf::from(xdg_config_home.clone()).join(".condarc"),
            PathBuf::from(xdg_config_home.clone()).join("condarc"),
            PathBuf::from(xdg_config_home.clone()).join(".condarc.d"),
        ]);
    }
    if let Some(home) = environment.get_user_home() {
        search_paths.append(&mut vec![
            home.join(".config").join("conda").join(".condarc"),
            home.join(".config").join("conda").join("condarc"),
            home.join(".config").join("conda").join("condarc.d"),
            home.join(".conda").join(".condarc"),
            home.join(".conda").join("condarc"),
            home.join(".conda").join("condarc.d"),
            home.join(".condarc"),
        ]);
    }
    if let Some(conda_prefix) = environment.get_env_var("CONDA_PREFIX".to_string()) {
        search_paths.append(&mut vec![
            PathBuf::from(conda_prefix.clone()).join(".condarc"),
            PathBuf::from(conda_prefix.clone()).join("condarc"),
            PathBuf::from(conda_prefix.clone()).join(".condarc.d"),
        ]);
    }
    if let Some(condarc) = environment.get_env_var("CONDARC".to_string()) {
        search_paths.append(&mut vec![PathBuf::from(condarc)]);
    }

    search_paths
}

/**
 * The .condarc file contains a list of directories where conda environments are created.
 * https://conda.io/projects/conda/en/latest/configuration.html#envs-dirs
 *
 * TODO: Search for the .condarc file in the following locations:
 * https://conda.io/projects/conda/en/latest/user-guide/configuration/use-condarc.html#searching-for-condarc
 */
fn get_conda_conda_rc(environment: &dyn known::Environment) -> Option<Condarc> {
    let conda_rc = get_conda_rc_search_paths(environment)
        .into_iter()
        .find(|p| p.exists())?;
    let mut start_consuming_values = false;
    trace!("conda_rc: {:?}", conda_rc);
    let reader = std::fs::read_to_string(conda_rc).ok()?;
    let mut env_dirs = vec![];
    for line in reader.lines() {
        if line.starts_with("envs_dirs:") && !start_consuming_values {
            start_consuming_values = true;
            continue;
        }
        if start_consuming_values {
            if line.trim().starts_with("-") {
                if let Some(env_dir) = line.splitn(2, '-').nth(1) {
                    let env_dir = PathBuf::from(env_dir.trim()).join("envs");
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
    env: &CondaEnvironment,
    root_conda_path: &PathBuf,
) -> bool {
    if let Some(cmd_line) = env.conda_install_folder.clone() {
        if cmd_line
            .to_lowercase()
            .contains(&root_conda_path.to_string_lossy().to_lowercase())
        {
            return true;
        } else {
            return false;
        }
    }

    false
}

/**
 * The conda-meta/history file in conda environments contain the command used to create the conda environment.
 * And example is `# cmd: <conda install directory>\Scripts\conda-script.py create -n sample``
 * And example is `# cmd: conda create -n sample``
 *
 * Sometimes the cmd line contains the fully qualified path to the conda install folder.
 * This function returns the path to the conda installation that was used to create the environment.
 */
fn get_conda_installation_used_to_create_conda_env(env_path: &PathBuf) -> Option<String> {
    let conda_meta_history = env_path.join("conda-meta").join("history");
    if let Ok(reader) = std::fs::read_to_string(conda_meta_history.clone()) {
        if let Some(line) = reader.lines().map(|l| l.trim()).find(|l| {
            l.to_lowercase().starts_with("# cmd:") && l.to_lowercase().contains(" create -")
        }) {
            // Sample lines
            // # cmd: <conda install directory>\Scripts\conda-script.py create -n samlpe1
            // # cmd: <conda install directory>\Scripts\conda-script.py create -p <full path>
            // # cmd: /Users/donjayamanne/miniconda3/bin/conda create -n conda1
            let start_index = line.to_lowercase().find("# cmd:")? + "# cmd:".len();
            let end_index = line.to_lowercase().find(" create -")?;
            let cmd_line = PathBuf::from(line[start_index..end_index].trim().to_string());
            if let Some(cmd_line) = cmd_line.parent() {
                if let Some(name) = cmd_line.file_name() {
                    if name.to_ascii_lowercase() == "bin" || name.to_ascii_lowercase() == "scripts"
                    {
                        if let Some(cmd_line) = cmd_line.parent() {
                            return Some(cmd_line.to_str()?.to_string());
                        }
                    }
                    return Some(cmd_line.to_str()?.to_string());
                }
            }
        }
    }

    None
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
            env.env_path.to_str().unwrap().to_string(),
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
            // Do not set the name to `base`
            // Ideally we would like to see this idetnfieid as a base env.
            // However if user has 2 conda installations, then the second base env
            // will be activated in python extension using first conda executable and -n base,
            // I.e. base env of the first install will be activated instead of this.
            // Hence lets always just give the path.
            // name: Some("base".to_string()),
            category: messaging::PythonEnvironmentCategory::Conda,
            python_executable_path: Some(python_exe),
            version: Some(package_info.version),
            arch: package_info.arch,
            env_path: Some(path.clone()),
            env_manager: Some(manager.clone()),
            python_run_command: Some(vec![
                conda_exe,
                "run".to_string(),
                "-p".to_string(),
                path.to_str().unwrap().to_string(),
                "python".to_string(),
            ]),
            ..Default::default()
        });
    }
    None
}

fn get_conda_environments_in_specified_install_path(
    conda_install_folder: &PathBuf,
    possible_conda_envs: &mut HashMap<PathBuf, CondaEnvironment>,
) -> Option<LocatorResult> {
    let mut managers: Vec<EnvManager> = vec![];
    let mut environments: Vec<PythonEnvironment> = vec![];
    let mut detected_envs: HashSet<String> = HashSet::new();
    let mut detected_managers: HashSet<String> = HashSet::new();
    if !conda_install_folder.is_dir() || !conda_install_folder.exists() {
        return None;
    }

    if let Some(manager) = get_conda_manager(&conda_install_folder) {
        // 1. Base environment.
        if let Some(env) = get_root_python_environment(&conda_install_folder, &manager) {
            if let Some(env_path) = env.clone().env_path {
                possible_conda_envs.remove(&env_path);
                let key = env_path.to_string_lossy().to_string();
                if !detected_envs.contains(&key) {
                    detected_envs.insert(key);
                    environments.push(env);
                }
            }
        }

        // 2. All environments in the `<conda install folder>/envs` folder
        let mut envs: Vec<CondaEnvironment> = vec![];
        if let Some(environments) =
            get_environments_from_envs_folder_in_conda_directory(conda_install_folder)
        {
            environments.iter().for_each(|env| {
                possible_conda_envs.remove(&env.env_path);
                envs.push(env.clone());
            });
        }

        // 3. All environments in the environments.txt and other locations (such as `conda config --show envs_dirs`)
        // Only include those environments that were created by the specific conda installation
        // Ignore environments that are in the env sub directory of the conda folder, as those would have been
        // tracked elsewhere, we're only interested in conda envs located in other parts of the file system created using the -p flag.
        // E.g conda_install_folder is `<home>/<conda install folder>`
        // Then all folders such as `<home>/<conda install folder>/envs/env1` can be ignored
        // As these would have been discovered in previous step.
        for (key, env) in possible_conda_envs.clone().iter() {
            if env
                .env_path
                .to_string_lossy()
                .contains(conda_install_folder.to_str().unwrap())
            {
                continue;
            }
            if was_conda_environment_created_by_specific_conda(&env, conda_install_folder) {
                envs.push(env.clone());
                possible_conda_envs.remove(key);
            }
        }

        // Finally construct the PythonEnvironment objects
        envs.iter().for_each(|env| {
            let exe = env.python_executable_path.clone();
            let arch = env.arch.clone();
            let mut env = PythonEnvironment::new(
                None,
                Some(env.name.clone()),
                exe.clone(),
                messaging::PythonEnvironmentCategory::Conda,
                env.version.clone(),
                Some(env.env_path.clone()),
                Some(manager.clone()),
                get_activation_command(env, &manager),
            );
            env.arch = arch;
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
    possible_conda_envs: &mut HashMap<PathBuf, CondaEnvironment>,
) -> Option<LocatorResult> {
    let mut managers: Vec<EnvManager> = vec![];
    let mut environments: Vec<PythonEnvironment> = vec![];

    // We know conda is installed in `<user home>/Anaconda3`, `<user home>/miniforge3`, etc
    // Look for these and discover all environments in these locations
    for possible_conda_install_folder in get_known_conda_install_locations(environment) {
        if let Some(mut result) = get_conda_environments_in_specified_install_path(
            &possible_conda_install_folder,
            possible_conda_envs,
        ) {
            managers.append(&mut result.managers);
            environments.append(&mut result.environments);
        }
    }

    // We know conda environments are listed in the `environments.txt` file
    // Sometimes the base environment is also listed in these paths
    // Go through them an look for possible conda install folders in these paths.
    // & then look for conda environments in each of them.
    // This accounts for cases where Conda install location is in some un-common (custom) location
    let mut env_paths_to_remove: Vec<PathBuf> = vec![];
    for (key, env) in possible_conda_envs
        .clone()
        .iter()
        .filter(|(_, env)| is_conda_install_location(&env.env_path))
    {
        if let Some(mut result) =
            get_conda_environments_in_specified_install_path(&env.env_path, possible_conda_envs)
        {
            possible_conda_envs.remove(key);
            managers.append(&mut result.managers);
            environments.append(&mut result.environments);
            env_paths_to_remove.push(env.env_path.clone());
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

fn is_conda_install_location(path: &PathBuf) -> bool {
    let envs_path = path.join("envs");
    return envs_path.exists() && envs_path.is_dir();
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

fn get_known_conda_envs_from_various_locations(
    environment: &dyn known::Environment,
) -> HashMap<PathBuf, CondaEnvironment> {
    let mut env_paths = get_conda_envs_from_environment_txt(environment)
        .iter()
        .map(|e| PathBuf::from(e))
        .collect::<Vec<PathBuf>>();

    let mut env_paths_from_conda_rc = get_conda_environment_paths_from_conda_rc(environment);
    env_paths.append(&mut env_paths_from_conda_rc);

    let mut envs_from_known_paths = get_conda_environment_paths_from_known_paths(environment);
    env_paths.append(&mut envs_from_known_paths);

    let mut envs: Vec<CondaEnvironment> = vec![];
    env_paths.iter().for_each(|path| {
        if !path.exists() {
            return;
        }
        if let Some(env) = get_conda_environment_info(&path, false) {
            envs.push(env);
        }
    });

    envs.into_iter().fold(HashMap::new(), |mut acc, env| {
        acc.insert(env.env_path.clone(), env);
        acc
    })
}

fn get_conda_environments_from_known_locations_that_have_not_been_discovered(
    known_environment: &Vec<PythonEnvironment>,
    environment: &dyn known::Environment,
    undiscovered_environments: &mut HashMap<PathBuf, CondaEnvironment>,
) -> Option<LocatorResult> {
    if undiscovered_environments.is_empty() {
        return None;
    }

    // Ok, weird, we have an environment in environments.txt file that was not discovered.
    // Let's try to discover it.
    warn!(
        "Found environments in environments.txt that were not discovered: {:?}",
        undiscovered_environments
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
        for (_, env) in undiscovered_environments {
            let exe = env.python_executable_path.clone();
            let env = PythonEnvironment::new(
                None,
                Some(env.name.clone()),
                exe.clone(),
                messaging::PythonEnvironmentCategory::Conda,
                env.version.clone(),
                Some(env.env_path.clone()),
                Some(manager.clone()),
                get_activation_command(&env, &manager),
            );
            environments.push(env);
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
    pub discovered_environment_paths: HashSet<PathBuf>,
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
            discovered_environment_paths: HashSet::new(),
            discovered_managers: HashSet::new(),
        }
    }
    fn filter_result(&mut self, result: Option<LocatorResult>) -> Option<LocatorResult> {
        if let Some(result) = result {
            let envs: Vec<PythonEnvironment> = result
                .environments
                .iter()
                .filter(|e| {
                    if let Some(env_path) = e.env_path.clone() {
                        if self.discovered_environment_paths.contains(&env_path) {
                            return false;
                        }
                        self.discovered_environment_paths.insert(env_path);
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
        if !is_conda_install_location(possible_conda_folder) {
            return None;
        }
        let mut possible_conda_envs = get_known_conda_envs_from_various_locations(self.environment);
        self.filter_result(get_conda_environments_in_specified_install_path(
            possible_conda_folder,
            &mut possible_conda_envs,
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
        let mut possible_conda_envs = get_known_conda_envs_from_various_locations(self.environment);

        if let Some(result) =
            self.filter_result(find_conda_environments_from_known_conda_install_locations(
                self.environment,
                &mut possible_conda_envs,
            ))
        {
            result.managers.iter().for_each(|m| {
                detected_managers.insert(get_environment_manager_key(m));
                managers.push(m.clone());
            });

            result
                .environments
                .iter()
                .for_each(|e| environments.push(e.clone()));
        }

        if let Some(result) = self.filter_result(
            get_conda_environments_from_known_locations_that_have_not_been_discovered(
                &environments,
                self.environment,
                &mut possible_conda_envs,
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
