// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

use crate::{
    known::Environment,
    locator::{Locator, LocatorResult},
    messaging::PythonEnvironment,
    utils::PythonEnv,
};
use regex::Regex;
use std::{collections::HashSet, path::PathBuf};

fn is_symlinked_python_executable(path: &PathBuf) -> Option<PathBuf> {
    let name = path.file_name()?.to_string_lossy();
    if !name.starts_with("python") || name.ends_with("-config") || name.ends_with("-build") {
        return None;
    }
    let metadata = std::fs::symlink_metadata(&path).ok()?;
    if metadata.is_file() || !metadata.file_type().is_symlink() {
        return None;
    }
    Some(std::fs::canonicalize(path).ok()?)
}

fn get_homebrew_prefix_env_var(environment: &dyn Environment) -> Option<PathBuf> {
    if let Some(homebrew_prefix) = environment.get_env_var("HOMEBREW_PREFIX".to_string()) {
        let homebrew_prefix_bin = PathBuf::from(homebrew_prefix).join("bin");
        if homebrew_prefix_bin.exists() {
            return Some(homebrew_prefix_bin);
        }
    }
    None
}

fn get_homebrew_prefix_bin(environment: &dyn Environment) -> Option<PathBuf> {
    if let Some(homebrew_prefix) = get_homebrew_prefix_env_var(environment) {
        return Some(homebrew_prefix);
    }

    // Homebrew install folders documented here https://docs.brew.sh/Installation
    // /opt/homebrew for Apple Silicon,
    // /usr/local for macOS Intel
    // /home/linuxbrew/.linuxbrew for Linux
    [
        "/home/linuxbrew/.linuxbrew/bin",
        "/opt/homebrew/bin",
        "/usr/local/bin",
    ]
    .iter()
    .map(|p| PathBuf::from(p))
    .find(|p| p.exists())
}

fn get_env_path(python_exe_from_bin_dir: &PathBuf, resolved_file: &PathBuf) -> Option<PathBuf> {
    // If the fully resolved file path contains the words `/homebrew/` or `/linuxbrew/`
    // Then we know this is definitely a home brew version of python.
    // And in these cases we can compute the sysprefix.

    let resolved_file = resolved_file.to_str()?;
    // 1. MacOS Silicon
    if python_exe_from_bin_dir
        .to_string_lossy()
        .to_lowercase()
        .starts_with("/opt/homebrew/bin/python")
    {
        // Resolved exe is something like `/opt/homebrew/Cellar/python@3.12/3.12.3/Frameworks/Python.framework/Versions/3.12/bin/python3.12`
        let reg_ex = Regex::new("/opt/homebrew/Cellar/python@((\\d+\\.?)*)/(\\d+\\.?)*/Frameworks/Python.framework/Versions/(\\d+\\.?)*/bin/python(\\d+\\.?)*").unwrap();
        let captures = reg_ex.captures(&resolved_file)?;
        let version = captures.get(1).map(|m| m.as_str()).unwrap_or_default();
        // SysPrefix- /opt/homebrew/opt/python@3.12/Frameworks/Python.framework/Versions/3.12
        let sys_prefix = PathBuf::from(format!(
            "/opt/homebrew/opt/python@{}/Frameworks/Python.framework/Versions/{}",
            version, version
        ));

        return if sys_prefix.exists() {
            Some(sys_prefix)
        } else {
            None
        };
    }

    // 2. Linux
    if python_exe_from_bin_dir
        .to_string_lossy()
        .to_lowercase()
        .starts_with("/usr/local/bin/python")
    {
        // Resolved exe is something like `/home/linuxbrew/.linuxbrew/Cellar/python@3.12/3.12.3/bin/python3.12`
        let reg_ex = Regex::new("/home/linuxbrew/.linuxbrew/Cellar/python@(\\d+\\.?\\d+\\.?)/(\\d+\\.?\\d+\\.?\\d+\\.?)/bin/python.*").unwrap();
        let captures = reg_ex.captures(&resolved_file)?;
        let version = captures.get(1).map(|m| m.as_str()).unwrap_or_default();
        let full_version = captures.get(2).map(|m| m.as_str()).unwrap_or_default();
        // SysPrefix- /home/linuxbrew/.linuxbrew/Cellar/python@3.12/3.12.3
        let sys_prefix = PathBuf::from(format!(
            "/home/linuxbrew/.linuxbrew/Cellar/python@{}/{}",
            version, full_version
        ));

        return if sys_prefix.exists() {
            Some(sys_prefix)
        } else {
            None
        };
    }

    // 3. MacOS Intel
    if python_exe_from_bin_dir
        .to_string_lossy()
        .to_lowercase()
        .starts_with("/usr/local/bin/python")
    {
        // Resolved exe is something like `/usr/local/Cellar/python@3.12/3.12.3/Frameworks/Python.framework/Versions/3.12/bin/python3.12`
        let reg_ex = Regex::new("/usr/local/Cellar/python@(\\d+\\.?\\d+\\.?)/(\\d+\\.?\\d+\\.?\\d+\\.?)/Frameworks/Python.framework/Versions/(\\d+\\.?\\d+\\.?)/bin/python.*").unwrap();
        let captures = reg_ex.captures(&resolved_file)?;
        let version = captures.get(1).map(|m| m.as_str()).unwrap_or_default();
        let full_version = captures.get(2).map(|m| m.as_str()).unwrap_or_default();
        // SysPrefix- /usr/local/Cellar/python@3.8/3.8.19/Frameworks/Python.framework/Versions/3.8
        let sys_prefix = PathBuf::from(format!(
            "/usr/local/Cellar/python@{}/{}/Frameworks/Python.framework/Versions/{}",
            version, full_version, version
        ));

        return if sys_prefix.exists() {
            Some(sys_prefix)
        } else {
            None
        };
    }
    None
}

fn get_python_info(
    python_exe_from_bin_dir: &PathBuf,
    reported: &mut HashSet<String>,
    python_version_regex: &Regex,
) -> Option<PythonEnvironment> {
    // Possible we do not have python3.12 or the like in bin directory
    // & we have only python3, in that case we should add python3 to the list
    if let Some(resolved_exe) = is_symlinked_python_executable(python_exe_from_bin_dir) {
        let user_friendly_exe = python_exe_from_bin_dir;
        let python_version = resolved_exe.to_string_lossy().to_string();
        let version = match python_version_regex.captures(&python_version) {
            Some(captures) => match captures.get(1) {
                Some(version) => Some(version.as_str().to_string()),
                None => None,
            },
            None => None,
        };
        if reported.contains(&resolved_exe.to_string_lossy().to_string()) {
            return None;
        }
        reported.insert(resolved_exe.to_string_lossy().to_string());
        return Some(PythonEnvironment::new(
            None,
            None,
            Some(user_friendly_exe.clone()),
            crate::messaging::PythonEnvironmentCategory::Homebrew,
            version,
            get_env_path(python_exe_from_bin_dir, &resolved_exe),
            None,
            Some(vec![user_friendly_exe.to_string_lossy().to_string()]),
        ));
    }
    None
}

pub struct Homebrew<'a> {
    pub environment: &'a dyn Environment,
}

impl Homebrew<'_> {
    #[cfg(unix)]
    pub fn with<'a>(environment: &'a impl Environment) -> Homebrew {
        Homebrew { environment }
    }
}

impl Locator for Homebrew<'_> {
    fn resolve(&self, env: &PythonEnv) -> Option<PythonEnvironment> {
        let python_regex = Regex::new(r"/(\d+\.\d+\.\d+)/").unwrap();
        let exe = env.executable.clone();
        let exe_file_name = exe.file_name()?;
        let mut reported: HashSet<String> = HashSet::new();
        if exe.starts_with("/opt/homebrew/bin/python")
            || exe.starts_with("/opt/homebrew/Cellar/python@")
            || exe.starts_with("/opt/homebrew/opt/python@")
            || exe.starts_with("/opt/homebrew/opt/python")
            || exe.starts_with("/opt/homebrew/Frameworks/Python.framework/Versions/")
        {
            // Symlink  - /opt/homebrew/bin/python3.12
            // Symlink  - /opt/homebrew/opt/python3/bin/python3.12
            // Symlink  - /opt/homebrew/Cellar/python@3.12/3.12.3/bin/python3.12
            // Symlink  - /opt/homebrew/opt/python@3.12/bin/python3.12
            // Symlink  - /opt/homebrew/Cellar/python@3.12/3.12.3/Frameworks/Python.framework/Versions/3.12/bin/python3.12
            // Symlink  - /opt/homebrew/Cellar/python@3.12/3.12.3/Frameworks/Python.framework/Versions/Current/bin/python3.12
            // Symlink  - /opt/homebrew/Frameworks/Python.framework/Versions/3.12/bin/python3.12
            // Symlink  - /opt/homebrew/Frameworks/Python.framework/Versions/Current/bin/python3.12
            // Real exe - /opt/homebrew/Cellar/python@3.12/3.12.3/Frameworks/Python.framework/Versions/3.12/bin/python3.12
            // SysPrefix- /opt/homebrew/opt/python@3.12/Frameworks/Python.framework/Versions/3.12
            get_python_info(
                &PathBuf::from("/opt/homebrew/bin").join(exe_file_name),
                &mut reported,
                &python_regex,
            )
        } else if exe.starts_with("/usr/local/bin/python")
            || exe.starts_with("/usr/local/opt/python@")
            || exe.starts_with("/usr/local/Cellar/python@")
        {
            // Symlink  - /usr/local/bin/python3.8
            // Symlink  - /usr/local/opt/python@3.8/bin/python3.8
            // Symlink  - /usr/local/Cellar/python@3.8/3.8.19/bin/python3.8
            // Real exe - /usr/local/Cellar/python@3.8/3.8.19/Frameworks/Python.framework/Versions/3.8/bin/python3.8
            // SysPrefix- /usr/local/Cellar/python@3.8/3.8.19/Frameworks/Python.framework/Versions/3.8
            get_python_info(
                &PathBuf::from("/usr/local/bin").join(exe_file_name),
                &mut reported,
                &python_regex,
            )
        } else if exe.starts_with("/usr/local/bin/python")
            || exe.starts_with("/home/linuxbrew/.linuxbrew/bin/python")
            || exe.starts_with("/home/linuxbrew/.linuxbrew/opt/python@")
            || exe.starts_with("/home/linuxbrew/.linuxbrew/Cellar/python")
        {
            // Symlink  - /usr/local/bin/python3.12
            // Symlink  - /home/linuxbrew/.linuxbrew/bin/python3.12
            // Symlink  - /home/linuxbrew/.linuxbrew/opt/python@3.12/bin/python3.12
            // Real exe - /home/linuxbrew/.linuxbrew/Cellar/python@3.12/3.12.3/bin/python3.12
            // SysPrefix- /home/linuxbrew/.linuxbrew/Cellar/python@3.12/3.12.3

            get_python_info(
                &PathBuf::from("/usr/local/bin").join(exe_file_name),
                &mut reported,
                &python_regex,
            )
        } else {
            None
        }
    }

    fn find(&mut self) -> Option<LocatorResult> {
        let homebrew_prefix_bin = get_homebrew_prefix_bin(self.environment)?;
        let mut reported: HashSet<String> = HashSet::new();
        let python_regex = Regex::new(r"/(\d+\.\d+\.\d+)/").unwrap();
        let mut environments: Vec<PythonEnvironment> = vec![];
        for file in std::fs::read_dir(&homebrew_prefix_bin)
            .ok()?
            .filter_map(Result::ok)
        {
            // If this file name is `python3`, then ignore this for now.
            // We would prefer to use `python3.x` instead of `python3`.
            // That way its more consistent and future proof
            if let Some(file_name) = file.file_name().to_str() {
                if file_name.to_lowercase() == "python3" {
                    continue;
                }
            }

            if let Some(env) = get_python_info(&file.path(), &mut reported, &python_regex) {
                environments.push(env);
            }
        }

        // Possible we do not have python3.12 or the like in bin directory
        // & we have only python3, in that case we should add python3 to the list
        if let Some(env) = get_python_info(
            &homebrew_prefix_bin.join("python3"),
            &mut reported,
            &python_regex,
        ) {
            environments.push(env);
        }

        if environments.is_empty() {
            None
        } else {
            Some(LocatorResult {
                managers: vec![],
                environments,
            })
        }
    }
}
