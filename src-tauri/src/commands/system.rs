use std::collections::BTreeSet;

/// システムにインストールされているフォント名一覧を返す
#[tauri::command]
pub async fn get_system_fonts() -> Vec<String> {
    #[cfg(target_os = "windows")]
    {
        get_fonts_windows().await
    }
    #[cfg(target_os = "macos")]
    {
        get_fonts_macos()
    }
    #[cfg(target_os = "linux")]
    {
        get_fonts_linux().await
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        default_fonts()
    }
}

fn default_fonts() -> Vec<String> {
    vec![
        "Meiryo".into(),
        "MS Gothic".into(),
        "Yu Gothic".into(),
        "Arial".into(),
        "Courier New".into(),
    ]
}

#[cfg(target_os = "windows")]
async fn get_fonts_windows() -> Vec<String> {
    use tokio::process::Command;
    let output = Command::new("powershell")
        .args([
            "-Command",
            "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Add-Type -AssemblyName System.Drawing; [System.Drawing.Text.InstalledFontCollection]::new().Families.Name",
        ])
        .output()
        .await;

    match output {
        Ok(out) => {
            let text = String::from_utf8_lossy(&out.stdout);
            let mut fonts: BTreeSet<String> = text
                .lines()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
            if fonts.is_empty() {
                return default_fonts();
            }
            fonts.into_iter().collect()
        }
        Err(_) => default_fonts(),
    }
}

#[cfg(target_os = "macos")]
fn get_fonts_macos() -> Vec<String> {
    let font_dirs = [
        "/System/Library/Fonts",
        "/Library/Fonts",
        &format!(
            "{}/Library/Fonts",
            std::env::var("HOME").unwrap_or_default()
        ),
    ];

    let mut fonts: BTreeSet<String> = BTreeSet::new();

    for dir in &font_dirs {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    if matches!(ext.to_lowercase().as_str(), "ttf" | "otf" | "ttc") {
                        if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                            // ファイル名から余分なウェイト/スタイル指定を除去して登録
                            let name = clean_font_name(stem);
                            if !name.is_empty() {
                                fonts.insert(name);
                            }
                        }
                    }
                }
            }
        }
    }

    // 定番の日本語フォントを必ず含める
    for f in [
        "Hiragino Sans",
        "Hiragino Mincho ProN",
        "Osaka",
        "Arial",
        "Helvetica",
        "Times New Roman",
        "Courier New",
        "Monaco",
        "Menlo",
    ] {
        fonts.insert(f.to_string());
    }

    if fonts.is_empty() {
        default_fonts()
    } else {
        fonts.into_iter().collect()
    }
}

#[cfg(target_os = "linux")]
async fn get_fonts_linux() -> Vec<String> {
    use tokio::process::Command;
    let output = Command::new("fc-list").output().await;
    match output {
        Ok(out) => {
            let text = String::from_utf8_lossy(&out.stdout);
            let mut fonts: BTreeSet<String> = BTreeSet::new();
            for line in text.lines() {
                // fc-list 出力: "/path/to/font.ttf: FamilyName:style=..."
                if let Some(colon) = line.find(':') {
                    let rest = &line[colon + 1..];
                    if let Some(colon2) = rest.find(':') {
                        let family = rest[..colon2].trim();
                        if !family.is_empty() {
                            fonts.insert(family.to_string());
                        }
                    }
                }
            }
            if fonts.is_empty() {
                return default_fonts();
            }
            fonts.into_iter().collect()
        }
        Err(_) => default_fonts(),
    }
}

fn clean_font_name(stem: &str) -> String {
    // ハイフン以降のウェイト指定を除去 (e.g. "HiraginoSans-W3" → "HiraginoSans")
    let base = stem.split('-').next().unwrap_or(stem);
    // キャメルケースの間にスペースを入れる (簡易)
    base.to_string()
}
