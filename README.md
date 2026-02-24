# ことおり Kotoori-TextEditor

> [kermount-dev/Kotoori-TextEditor](https://github.com/kermount-dev/Kotoori-TextEditor) のフォーク。  
> **Electron → Tauri v2** へ完全移行した非公式フォークです。

小説家・著述家・事務職向けの **SDI（タブなし）テキストエディタ / Markdownエディタ**。

**言葉を織って文と成す ─ ことおり（言織）**

---

## フォーク元との違い

このフォークは、フォーク元（Electron 版）の機能を完全に引き継ぎつつ、フレームワークを **Tauri v2** に置き換えました。

| 比較項目 | フォーク元 (Electron) | **このフォーク (Tauri v2)** |
|---|---|---|
| デスクトップフレームワーク | Electron | **Tauri v2** (Rust バックエンド) |
| パッケージマネージャ | npm | **pnpm** |
| インストーラーサイズ | 約 150〜200 MB | **約 5〜15 MB** |
| 起動時間 | 遅め（Chromium 同梱） | **高速**（OS ネイティブ WebView 使用） |
| メモリ使用量 | 高め（特に macOS） | **大幅に低い** |
| バックエンド言語 | JavaScript (Node.js) | **Rust**（安全性・速度向上） |
| セキュリティモデル | 緩め（Node.js フルアクセス） | **厳格**（Capability ベース権限制御） |
| macOS 対応 | Intel のみ | **Intel / Apple Silicon / Universal Binary** |
| Windows 対応 | ✅ | ✅ |
| CSS フレームワーク | なし | **Tailwind CSS v3** |
| 自動リリース | なし | **GitHub Actions（タグ自動生成）** |
| DB / 履歴管理 | Electron IPC + ファイル | **SQLite**（tauri-plugin-sql） |
| 設定ストレージ | Electron store (JSON) | **tauri-plugin-store** |

---

## 特徴

VS Code と同じテキストエンジン **Monaco Editor** を採用しつつ、コードスニペットや拡張機能に対応しないことで **軽量かつ迷わない操作性** を実現しています。

### 自動保存と変更履歴

- 新しいファイルの一行目を改行した時点で、一行目をファイル名として自動保存
- 手が止まったタイミング（約 2 秒後）で自動保存
- 保存のたびに変更履歴をローカルに記録。過去の状態に戻したり別ファイルに書き出したりできます

### 執筆支援機能

- 文字数・行数・原稿用紙換算表示
- アウトライン表示・ジャンプ
- Markdown プレビュー
- 縦書きプレビュー
- 小説家になろう形式のルビ・傍点挿入
- 色設定をテーマとしてまとめて保存
- カスタム見出し設定
- Markdown 形式のプレーンテキスト保存
- 全体メモ・ファイル個別メモ

---

## 対応言語

| 言語 | 読み込み | 書き込み |
|---|---|---|
| UTF-8 | ✅ | ✅ |
| Shift-JIS | ✅ | ✅ |
| EUC-JP | ✅ | ✅ |

古い日本語ファイルの文字化けが起きた場合は、設定から「読み込み形式」を変更してください。

---

## 技術スタック

### フロントエンド

| 技術 | 用途 |
|---|---|
| React 18 + TypeScript 5 | UI |
| Vite 5 | ビルドツール |
| Tailwind CSS v3 | スタイリング |
| Monaco Editor | テキストエディタエンジン |
| marked + DOMPurify | Markdown レンダリング |

### バックエンド（Rust / Tauri v2）

| 技術 | 用途 |
|---|---|
| Tauri v2 | デスクトップフレームワーク |
| tauri-plugin-fs | ファイル読み書き |
| tauri-plugin-sql (SQLite) | 変更履歴 DB |
| tauri-plugin-store | 設定・テーマ永続化 |
| tauri-plugin-dialog | ファイルダイアログ |
| tauri-plugin-clipboard-manager | クリップボード操作 |
| tauri-plugin-window-state | ウィンドウ状態復元 |
| encoding_rs | 文字コード変換（Shift-JIS など） |

### 開発ツール

| ツール | 用途 |
|---|---|
| pnpm | パッケージマネージャ |
| ESLint + Prettier | コード品質 |
| Husky + lint-staged | コミット前チェック |
| GitHub Actions | 自動タグ作成・自動リリース |

---

## 開発者向けセットアップ

### 必要なもの

- [Rust](https://rustup.rs/)（stable）
- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 10+
- Tauri v2 の[前提条件](https://v2.tauri.app/start/prerequisites/)
  - macOS: Xcode Command Line Tools
  - Windows: Visual Studio Build Tools

### セットアップ手順

```bash
# リポジトリをクローン
git clone https://github.com/tukuyomil032/Kotoori-TextEditor.git
cd Kotoori-TextEditor

# macOS Universal ビルド用 Rust ターゲットを追加（macOS のみ）
rustup target add aarch64-apple-darwin x86_64-apple-darwin

# 依存パッケージをインストール
pnpm install

# 開発サーバー起動（ホットリロード付き）
pnpm tauri:dev
```

### ビルド

```bash
# ローカルビルド（現在のプラットフォーム向け）
pnpm tauri:build

# macOS Universal Binary
pnpm tauri build --target universal-apple-darwin
```

### リリース方法

`src-tauri/tauri.conf.json` のバージョン番号を上げて `main` ブランチに push するだけです。

```json
{
  "version": "1.0.0"
}
```

GitHub Actions が自動で以下を実行します：

1. バージョンを読み取り `v1.0.0` タグを作成
2. macOS (Intel / Apple Silicon / Universal) + Windows のバイナリをビルド
3. GitHub Releases にドラフトとして配置

ドラフトを確認・公開すればリリース完了です。

---

## 簡易マニュアル

### よく使う操作

| 操作 | ショートカット |
|---|---|
| 新しいテキスト | `Ctrl + N` |
| ファイルを開く | `Ctrl + O` |
| 上書き保存 | `Ctrl + S` |
| 元に戻す | `Ctrl + Z` |
| やり直し | `Ctrl + Y` |
| 検索 | `Ctrl + F` |
| 置換 | `Ctrl + H` |
| ルビ挿入 | `Ctrl + Alt + R` |
| 傍点挿入 | `Ctrl + Alt + P` |

### ルビ・傍点の挿入

漢字を選択して右クリック、または上記ショートカットで `|漢字《よみがな》` 形式のルビを自動挿入できます。

### 全体メモと個別メモ

全ウィンドウ共通の「全体メモ」と、ファイルごとの「個別メモ」をそれぞれ保存できます。  
個別メモは変更履歴を削除すると一緒に削除されます。

### トラブルシューティング

**文字化けが発生する場合**  
設定から「読み込み形式」を「Shift-JIS」に切り替えて再読み込みしてください。

**プレビューが表示されない場合**  
アプリを一度終了して起動し直してください。

---

## ライセンス

MIT License  
Copyright (c) kermount-dev
