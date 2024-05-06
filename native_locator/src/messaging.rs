// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use serde::{Deserialize, Serialize};
use std::sync::{Mutex, OnceLock};

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvManager {
    pub executable_path: String,
    pub version: Option<String>,
}

impl EnvManager {
    pub fn new(executable_path: String, version: Option<String>) -> Self {
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
    pub python_executable_path: String,
    pub category: String,
    pub version: Option<String>,
    pub activated_run: Option<Vec<String>>,
    pub env_path: Option<String>,
}

impl PythonEnvironment {
    pub fn new(
        name: String,
        python_executable_path: String,
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

#[cfg(not(feature = "test"))]
fn send_rpc_message(message: String) -> () {
    print!(
        "Content-Length: {}\r\nContent-Type: application/vscode-jsonrpc; charset=utf-8\r\n\r\n{}",
        message.len(),
        message
    );
}

// Tests

fn messages_sent() -> &'static Mutex<Vec<String>> {
    static ARRAY: OnceLock<Mutex<Vec<String>>> = OnceLock::new();
    ARRAY.get_or_init(|| Mutex::new(vec![]))
}

#[cfg(feature = "test")]
fn send_rpc_message(message: String) -> () {
    messages_sent().lock().unwrap().push(message);
}

#[allow(dead_code)]
pub fn clear_rpc_messages() -> () {
    messages_sent().lock().unwrap().clear();
}

#[allow(dead_code)]
pub fn get_rpc_messages() -> Vec<String> {
    return messages_sent().lock().unwrap().clone();
}

pub fn send_message<T: serde::Serialize>(message: T) -> () {
    let message = serde_json::to_string(&message).unwrap();
    send_rpc_message(message);
}
