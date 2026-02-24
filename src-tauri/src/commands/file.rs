use chrono::Local;
use encoding_rs::{SHIFT_JIS, UTF_8};
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
pub struct ReadFileResult {
    pub content: String,
    pub encoding: String,
}

/// Shift-JIS / UTF-8-BOM / UTF-8 を自動判別してファイルを読み込む
#[tauri::command]
pub async fn read_file_with_encoding(
    path: String,
    forced_encoding: Option<String>,
) -> Result<ReadFileResult, String> {
    let bytes = tokio::fs::read(&path)
        .await
        .map_err(|e| format!("ファイルの読み込みに失敗: {e}"))?;

    if is_binary_bytes(&bytes) {
        return Err("バイナリファイルは読み込みできません".into());
    }

    let encoding = if let Some(enc) = forced_encoding {
        enc
    } else {
        detect_encoding(&bytes)
    };

    let content = decode_bytes(&bytes, &encoding)?;
    Ok(ReadFileResult { content, encoding })
}

/// エンコーディングを指定してファイルを書き込む
#[tauri::command]
pub async fn write_file_with_encoding(
    path: String,
    content: String,
    encoding: String,
) -> Result<(), String> {
    let bytes = encode_content(&content, &encoding)?;
    tokio::fs::write(&path, bytes)
        .await
        .map_err(|e| format!("ファイルの書き込みに失敗: {e}"))
}

/// 新規保存時にファイル名が衝突する場合はタイムスタンプを付加した一意なパスを返す
#[tauri::command]
pub async fn get_unique_file_path(path: String) -> Result<String, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Ok(path);
    }
    let parent = p.parent().unwrap_or_else(|| Path::new("."));
    let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("file");
    let ext = p
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| format!(".{s}"))
        .unwrap_or_default();

    let now = Local::now();
    let ts = now.format("%Y%m%d%H%M").to_string();
    let new_path = parent.join(format!("{stem}_{ts}{ext}"));
    Ok(new_path.to_string_lossy().into_owned())
}

/// ファイルがバイナリかどうかを判定する
#[tauri::command]
pub async fn is_binary_file(path: String) -> Result<bool, String> {
    let mut file = tokio::fs::File::open(&path)
        .await
        .map_err(|e| format!("ファイルを開けません: {e}"))?;
    use tokio::io::AsyncReadExt;
    let mut buf = vec![0u8; 8192];
    let n = file
        .read(&mut buf)
        .await
        .map_err(|e| format!("読み込みエラー: {e}"))?;
    buf.truncate(n);
    Ok(is_binary_bytes(&buf))
}

/// Kotooriのデフォルト保存フォルダを取得・作成して返す
#[tauri::command]
pub async fn get_default_path(app: tauri::AppHandle) -> Result<String, String> {
    let docs = app
        .path()
        .document_dir()
        .map_err(|_| "ドキュメントフォルダの取得に失敗".to_string())?;
    let target = docs.join("Kotoori");
    tokio::fs::create_dir_all(&target)
        .await
        .map_err(|e| format!("フォルダ作成に失敗: {e}"))?;
    Ok(target.to_string_lossy().into_owned())
}

// ─── ヘルパー ──────────────────────────────────────────────────────────────────

fn detect_encoding(bytes: &[u8]) -> String {
    // BOM チェック (UTF-8: EF BB BF)
    if bytes.len() >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF {
        return "UTF-8-BOM".into();
    }

    // UTF-8 有効性チェック
    if std::str::from_utf8(bytes).is_ok() {
        return "UTF-8".into();
    }

    // Shift-JIS スコア
    let mut sj_score = 0usize;
    let mut i = 0;
    while i < bytes.len() {
        let b1 = bytes[i];
        if (b1 >= 0x81 && b1 <= 0x9F) || (b1 >= 0xE0 && b1 <= 0xEF) {
            if i + 1 < bytes.len() {
                let b2 = bytes[i + 1];
                if (b2 >= 0x40 && b2 <= 0x7E) || (b2 >= 0x80 && b2 <= 0xFC) {
                    sj_score += 2;
                    i += 2;
                    continue;
                }
            }
        }
        i += 1;
    }

    if sj_score as f64 > bytes.len() as f64 * 0.4 {
        "SHIFT-JIS".into()
    } else {
        "UTF-8".into()
    }
}

fn decode_bytes(bytes: &[u8], encoding: &str) -> Result<String, String> {
    match encoding {
        "UTF-8-BOM" => {
            let without_bom = &bytes[3..];
            String::from_utf8(without_bom.to_vec())
                .map_err(|e| format!("UTF-8-BOM デコードエラー: {e}"))
        }
        "SHIFT-JIS" => {
            let (cow, _enc, had_errors) = SHIFT_JIS.decode(bytes);
            if had_errors {
                // エラーがあっても代替文字で返す
            }
            Ok(cow.into_owned())
        }
        _ => {
            // UTF-8 (with or without BOM already stripped)
            String::from_utf8(bytes.to_vec())
                .or_else(|_| {
                    // フォールバック: lossy
                    let (cow, _enc, _had_errors) = UTF_8.decode(bytes);
                    Ok::<String, ()>(cow.into_owned())
                })
                .map_err(|_| "UTF-8 デコードに失敗".to_string())
        }
    }
}

fn encode_content(content: &str, encoding: &str) -> Result<Vec<u8>, String> {
    match encoding {
        "UTF-8-BOM" => {
            let mut buf = vec![0xEF_u8, 0xBB, 0xBF];
            buf.extend_from_slice(content.as_bytes());
            Ok(buf)
        }
        "SHIFT-JIS" => {
            let (cow, _enc, had_errors) = SHIFT_JIS.encode(content);
            if had_errors {
                // 変換できない文字は ? に置換済み
            }
            Ok(cow.into_owned())
        }
        _ => Ok(content.as_bytes().to_vec()),
    }
}

fn is_binary_bytes(bytes: &[u8]) -> bool {
    if bytes.is_empty() {
        return false;
    }
    // マジックバイトチェック
    if bytes.len() >= 4 && bytes[..4] == [0x89, 0x50, 0x4E, 0x47] {
        return true; // PNG
    }
    if bytes.len() >= 3 && bytes[..3] == [0xFF, 0xD8, 0xFF] {
        return true; // JPEG
    }
    if bytes.len() >= 4 && &bytes[..4] == b"GIF8" {
        return true;
    }
    if bytes.len() >= 4 && &bytes[..4] == b"%PDF" {
        return true;
    }
    if bytes.len() >= 2 && &bytes[..2] == b"PK" {
        return true; // ZIP / OOXML
    }
    if bytes.len() >= 2 && &bytes[..2] == b"MZ" {
        return true; // PE
    }

    // UTF-8 なら非バイナリ
    if std::str::from_utf8(bytes).is_ok() {
        return false;
    }

    // NUL バイト比率
    let nul_count = bytes.iter().filter(|&&b| b == 0).count();
    if nul_count > bytes.len() / 100 + 1 {
        return true;
    }

    // 制御文字比率
    let control = bytes
        .iter()
        .filter(|&&b| b < 0x09 || (b > 0x0D && b < 0x20))
        .count();
    control as f64 / bytes.len() as f64 > 0.30
}

// chrono を追加 (Cargo.toml にも必要)
