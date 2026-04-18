use crate::github_util;
use crate::github_util::Release;
use crate::wine_cask::app::WineCask;
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use std::{env, fs};

#[derive(Serialize, Deserialize, Clone, PartialEq)]
pub enum CompatibilityToolFlavor {
    Unknown,
    ProtonGE,
    SteamTinkerLaunch,
    Luxtorpeda,
    Boxtron,
}

impl std::fmt::Display for CompatibilityToolFlavor {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CompatibilityToolFlavor::Unknown => write!(f, "Unknown"),
            CompatibilityToolFlavor::ProtonGE => write!(f, "ProtonGE"),
            CompatibilityToolFlavor::SteamTinkerLaunch => write!(f, "SteamTinkerLaunch"),
            CompatibilityToolFlavor::Luxtorpeda => write!(f, "Luxtorpeda"),
            CompatibilityToolFlavor::Boxtron => write!(f, "Boxtron"),
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct CatalogRelease {
    pub id: String,
    pub flavor: CompatibilityToolFlavor,
    pub release: Release,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Flavor {
    pub flavor: CompatibilityToolFlavor,
    pub releases: Vec<CatalogRelease>,
}

#[derive(Serialize, Deserialize, Clone)]
pub enum InstalledToolSource {
    Direct,
    Virtual,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct InstalledCompatibilityTool {
    pub id: String,
    pub path: String,
    pub directory_name: String,
    pub display_name: String,
    pub internal_name: String,
    pub used_by_games: Vec<String>,
    pub requires_restart: bool,
    pub flavor: CompatibilityToolFlavor,
    pub catalog_release_id: Option<String>,
    pub github_release: Option<Release>,
    pub source: InstalledToolSource,
    pub virtual_tool_id: Option<String>,
    pub user_label: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct VirtualCompatibilityTool {
    pub id: String,
    pub user_label: String,
    pub steam_internal_name: String,
    pub directory_name: String,
    pub installed_tool_id: Option<String>,
    pub current_payload_release_id: Option<String>,
    pub current_payload_name: Option<String>,
    pub current_payload_flavor: CompatibilityToolFlavor,
    pub github_release: Option<Release>,
    pub requires_restart: bool,
    pub used_by_games: Vec<String>,
}

// SteamClient.Settings.GetGlobalCompatTools()
#[derive(Serialize, Deserialize, Clone)]
pub struct SteamClientCompatToolInfo {
    #[serde(rename = "strToolName")]
    pub str_tool_name: String,
    #[serde(rename = "strDisplayName")]
    pub str_display_name: String,
}

pub fn catalog_release_id(flavor: &CompatibilityToolFlavor, release_id: u64) -> String {
    format!("catalog:{}:{}", flavor, release_id)
}

impl WineCask {
    pub async fn get_flavors(&self, renew_cache: bool) -> Vec<Flavor> {
        let mut flavors = Vec::new();

        let proton_ge_flavor = self
            .get_flavor(
                CompatibilityToolFlavor::ProtonGE,
                "GloriousEggroll",
                "proton-ge-custom",
                renew_cache,
            )
            .await;
        let luxtorpeda_flavor = self
            .get_flavor(
                CompatibilityToolFlavor::Luxtorpeda,
                "luxtorpeda-dev",
                "luxtorpeda",
                renew_cache,
            )
            .await;
        let boxtron_flavor = self
            .get_flavor(
                CompatibilityToolFlavor::Boxtron,
                "dreamer",
                "boxtron",
                renew_cache,
            )
            .await;

        flavors.push(proton_ge_flavor);
        flavors.push(luxtorpeda_flavor);
        flavors.push(boxtron_flavor);

        flavors
    }

    async fn get_flavor(
        &self,
        compatibility_tool_flavor: CompatibilityToolFlavor,
        owner: &str,
        repository: &str,
        renew_cache: bool,
    ) -> Flavor {
        if let Some(github_releases) = self.get_releases(owner, repository, renew_cache).await {
            Flavor {
                flavor: compatibility_tool_flavor.clone(),
                releases: github_releases
                    .into_iter()
                    .map(|release| CatalogRelease {
                        id: catalog_release_id(&compatibility_tool_flavor, release.id),
                        flavor: compatibility_tool_flavor.clone(),
                        release,
                    })
                    .collect(),
            }
        } else {
            Flavor {
                flavor: compatibility_tool_flavor,
                releases: Vec::new(),
            }
        }
    }

    async fn get_releases(
        &self,
        owner: &str,
        repository: &str,
        renew_cache: bool,
    ) -> Option<Vec<Release>> {
        const SECONDS_IN_A_DAY: u64 = 86_400;

        let path = env::var("DECKY_PLUGIN_RUNTIME_DIR").unwrap_or("/tmp/".parse().unwrap());

        let file_name = format!("github_releases_{}_{}_cache.json", owner, repository);
        let cache_file = PathBuf::from(path).join(&file_name);

        if !renew_cache && cache_file.exists() && cache_file.is_file() {
            let metadata = fs::metadata(&cache_file).ok()?;
            let modified = metadata.modified().ok()?;

            let now = SystemTime::now();
            let duration = now.duration_since(modified).ok()?;

            if duration.as_secs() < SECONDS_IN_A_DAY {
                let unix_timestamp = modified
                    .duration_since(UNIX_EPOCH)
                    .expect("Failed to calculate duration")
                    .as_secs();
                self.app_state.lock().await.updater_last_check = Some(unix_timestamp);

                let string = fs::read_to_string(&cache_file).ok()?;
                let github_releases: Vec<Release> = serde_json::from_str(&string).ok()?;

                if github_releases.is_empty() {
                    info!(
                        "Cached data is possibly corrupted or missing information from an older version. Renewing cache..."
                    );
                } else {
                    return Some(github_releases);
                }
            } else {
                info!("Cache file is older than 1 day. Fetching new releases.");
            }
        }

        let github_releases = match github_util::list_all_releases(owner, repository).await {
            Ok(releases) => {
                if releases.is_empty() {
                    error!("No releases found.");
                    return None;
                }

                let current_time = SystemTime::now();
                let unix_timestamp = current_time
                    .duration_since(UNIX_EPOCH)
                    .expect("Failed to calculate duration")
                    .as_secs();
                self.app_state.lock().await.updater_last_check = Some(unix_timestamp);

                let json = serde_json::to_string(&releases).ok()?;
                fs::write(&cache_file, json).ok()?;
                releases
            }
            Err(err) => {
                error!("{}", github_util::format_error_chain(&err));
                error!("full debug error: {err:#?}");

                if cache_file.exists() && cache_file.is_file() {
                    let metadata = fs::metadata(&cache_file).ok()?;
                    let modified = metadata.modified().ok()?;
                    let unix_timestamp = modified
                        .duration_since(UNIX_EPOCH)
                        .expect("Failed to calculate duration")
                        .as_secs();
                    self.app_state.lock().await.updater_last_check = Some(unix_timestamp);

                    let string = fs::read_to_string(&cache_file).ok()?;
                    let github_releases: Vec<Release> = serde_json::from_str(&string).ok()?;
                    warn!("Unable to fetch new releases. Using cached releases.");
                    github_releases
                } else {
                    error!("Unable to fetch new releases. No cached releases found.");
                    return None;
                }
            }
        };

        Some(github_releases)
    }
}
