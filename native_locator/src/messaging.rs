// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use serde::{Deserialize, Serialize};


#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvManager {
    pub executable_path: Vec<String>,
    pub version: Option<String>,
}

impl EnvManager {
    pub fn new(executable_path: Vec<String>, version: Option<String>) -> Self {
        Self {
            executable_path,
            version,
        }
    }
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvManagerMessage {
    pub jsonrpc: String,
    pub method: String,
    pub params: EnvManager,
}

impl EnvManagerMessage {
    pub fn new(params: EnvManager) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            method: "envManager".to_string(),
            params,
        }
    }
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PythonEnvironment {
    pub name: String,
    pub python_executable_path: Vec<String>,
    pub category: String,
    pub version: Option<String>,
    pub activated_run: Option<Vec<String>>,
    pub env_path: Option<String>,
}

impl PythonEnvironment {
    pub fn new(
        name: String,
        python_executable_path: Vec<String>,
        category: String,
        version: Option<String>,
        activated_run: Option<Vec<String>>,
        env_path: Option<String>,
    ) -> Self {
        Self {
            name,
            python_executable_path: python_executable_path,
            category,
            version,
            activated_run,
            env_path,
        }
    }
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PythonEnvironmentMessage {
    pub jsonrpc: String,
    pub method: String,
    pub params: PythonEnvironment,
}

impl PythonEnvironmentMessage {
    pub fn new(params: PythonEnvironment) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            method: "pythonEnvironment".to_string(),
            params,
        }
    }
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExitMessage {
    pub jsonrpc: String,
    pub method: String,
    pub params: Option<()>,
}

impl ExitMessage {
    pub fn new() -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            method: "exit".to_string(),
            params: None,
        }
    }
}

fn send_rpc_message(message: String) -> () {
    print!(
        "Content-Length: {}\r\nContent-Type: application/vscode-jsonrpc; charset=utf-8\r\n\r\n{}",
        message.len(),
        message
    );
}

pub fn send_message<T: serde::Serialize>(message: T) -> () {
    let message = serde_json::to_string(&message).unwrap();
    send_rpc_message(message);
}
