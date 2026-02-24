import { useState, useEffect, useRef, useCallback } from 'react';
import {
  readFileWithEncoding,
  writeFileWithEncoding,
  getUniqueFilePath,
  saveFileDialog,
  getDefaultPath,
  joinPath,
  readConfig,
  writeConfig,
  type Encoding,
} from '../lib/tauri-api';
import { saveSnapshot } from '../lib/history-manager';

export function useFileOperations(
  code: string,
  setCode: (code: string) => void,
  restoreLastFile: boolean = true
) {
  const [currentPath, setCurrentPath] = useState<string | undefined>(undefined);
  const [isDirty, setIsDirty] = useState(false);
  const [currentEncoding, setCurrentEncoding] = useState<Encoding>('UTF-8');

  const codeRef = useRef(code);
  const currentPathRef = useRef(currentPath);
  const isDirtyRef = useRef(isDirty);
  const previousCodeRef = useRef(code); // 前の状態を記録
  const firstLineConfirmedRef = useRef(false); // 一行目が確定したかを記録
  const cursorPositionRef = useRef<{ line: number; column: number }>({ line: 1, column: 1 }); // カーソル位置を記録
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // デバウンスタイマー
  const lastSavedValueRef = useRef<string>(''); // デバウンス用：最後に保存された値を記録

  // ファイル保存完了時のコールバック
  const onFileSavedCallbacksRef = useRef<Set<() => void>>(new Set());
  const onFileSaved = useCallback((callback: () => void) => {
    onFileSavedCallbacksRef.current.add(callback);
    return () => {
      onFileSavedCallbacksRef.current.delete(callback);
    };
  }, []);

  useEffect(() => {
    codeRef.current = code;
  }, [code]);
  useEffect(() => {
    currentPathRef.current = currentPath;
  }, [currentPath]);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  // ファイルを保存
  const saveFile = useCallback(
    async (forceDialog: boolean = false, encoding?: Encoding) => {
      const saveEncoding = encoding || currentEncoding;

      let savedPath: string | null = null;

      try {
        if (currentPathRef.current && !forceDialog) {
          // 上書き保存
          await writeFileWithEncoding(currentPathRef.current, codeRef.current, saveEncoding);
          savedPath = currentPathRef.current;
        } else {
          // 名前を付けて保存ダイアログ
          const chosen = await saveFileDialog(currentPathRef.current);
          if (!chosen) return null;
          const uniquePath = await getUniqueFilePath(chosen);
          await writeFileWithEncoding(uniquePath, codeRef.current, saveEncoding);
          savedPath = uniquePath;
        }
      } catch (e) {
        console.error('[saveFile] 保存失敗:', e);
        return null;
      }

      if (savedPath) {
        setCurrentPath(savedPath);
        setIsDirty(false);
        // 履歴スナップショットを保存
        try {
          await saveSnapshot(savedPath, codeRef.current);
        } catch (e) {
          console.error('[saveFile] snapshot error:', e);
        }
        // ファイル保存完了時のコールバックを実行
        onFileSavedCallbacksRef.current.forEach((callback) => callback());
        // カーソル位置をキャッシュに保存
        const prevCacheForCursor = (await readConfig()) || {};
        const newCacheForCursor = {
          ...prevCacheForCursor,
          lastCursorPosition: cursorPositionRef.current,
        };
        await writeConfig(newCacheForCursor as Record<string, unknown>);
        return savedPath;
      }
      return null;
    },
    [currentEncoding]
  );

  // 新規作成
  const createNew = useCallback(async () => {
    // デバウンスタイマーをクリア
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (isDirtyRef.current) {
      const savedPath = await saveFile();
      if (savedPath === null) return;
    }
    setCode('');
    setCurrentPath(undefined);
    setIsDirty(false);
    previousCodeRef.current = '';
    firstLineConfirmedRef.current = false;
  }, [saveFile, setCode]);

  // 初期ロード処理
  useEffect(() => {
    const initFile = async () => {
      const params = new URLSearchParams(window.location.search);
      const isEmpty = params.get('empty') === 'true';
      const pathParam = params.get('path');

      if (pathParam) {
        const result = await readFileWithEncoding(pathParam);
        if (result !== null) {
          const { content, encoding } = result;
          setCode(content);
          setCurrentPath(pathParam);
          setCurrentEncoding(encoding);
          setIsDirty(false);
          return;
        }
        return;
      }

      if (isEmpty) {
        setCode('');
        setCurrentPath(undefined);
        setIsDirty(false);
        return;
      }

      // 引数がない場合のみキャッシュを確認
      const cache = await readConfig();
      // restoreLastFile が true の場合のみ復元
      if (cache?.lastFile && restoreLastFile) {
        const result = await readFileWithEncoding(cache.lastFile as string);
        if (result !== null) {
          const { content, encoding } = result;
          setCode(content);
          setCurrentPath(cache.lastFile as string);
          setCurrentEncoding(encoding);
          setIsDirty(false);
          previousCodeRef.current = content;
          firstLineConfirmedRef.current = true;
          // キャッシュからカーソル位置を復元
          if (cache.lastCursorPosition) {
            cursorPositionRef.current = cache.lastCursorPosition as {
              line: number;
              column: number;
            };
          }
        }
      }
    };
    initFile();
  }, [setCode, restoreLastFile]);

  // ファイルを開く
  const openFile = useCallback(
    async (path: string, forcedEncoding?: Encoding) => {
      // デバウンスタイマーをクリア
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      const result = await readFileWithEncoding(path, forcedEncoding);
      if (result !== null) {
        const { content, encoding } = result;
        setCode(content);
        setCurrentPath(path);
        setCurrentEncoding(encoding);
        setIsDirty(false);
        previousCodeRef.current = content;
        firstLineConfirmedRef.current = true;
        // キャッシュをリセット（新しいファイルを開いたため）
        cursorPositionRef.current = { line: 1, column: 1 };
        return true;
      }
      return false;
    },
    [setCode]
  );

  // オートセーブの初動用
  const checkAutoFirstSave = useCallback(
    async (newValue: string, defaultStoragePath?: string) => {
      console.log('[AutoSave Debug]', {
        currentPathRef: currentPathRef.current,
        firstLineConfirmed: firstLineConfirmedRef.current,
        newValueLen: newValue.length,
      });

      // ケース1: 新規ファイル（パスなし）で一行目が確定したとき
      if (!currentPathRef.current && !firstLineConfirmedRef.current) {
        // 前回のコードに改行がなく、今回のコードに改行がある場合 = 一行目が確定した
        if (!previousCodeRef.current.includes('\n') && newValue.includes('\n')) {
          console.log('[AutoSave Case1] 一行目が確定しました');
          firstLineConfirmedRef.current = true;
          const lines = newValue.split('\n');
          const firstLine = lines[0].trim();

          // 一行目が空の場合はデフォルト名、あれば一行目の内容を使用
          const filename =
            firstLine.length > 0
              ? firstLine.replace(/[\\/:*?"<>|]/g, '_') + '.txt'
              : '新しいテキスト.txt';

          const targetDir = defaultStoragePath || (await getDefaultPath());
          if (targetDir) {
            const fullPath = joinPath(targetDir, filename);
            // 新規ファイルの初回保存なので一意なパスを取得
            const uniquePath = await getUniqueFilePath(fullPath);
            try {
              await writeFileWithEncoding(uniquePath, newValue, currentEncoding);
              await saveSnapshot(uniquePath, newValue);
              console.log('[AutoSave Case1] ファイル保存完了:', uniquePath);
              setCurrentPath(uniquePath);
              setIsDirty(false);
              previousCodeRef.current = newValue;
              lastSavedValueRef.current = newValue;
              // ファイル保存完了時のコールバックを実行
              onFileSavedCallbacksRef.current.forEach((callback) => callback());
            } catch (e) {
              console.error('[AutoSave Case1] 保存失敗:', e);
            }
            return;
          }
        }
        // ケース1に該当しない場合は previousCodeRef を更新して戻る
        previousCodeRef.current = newValue;
        return;
      }

      // ケース2: ファイルが開かれている状態で文字列が変更された場合
      if (currentPathRef.current) {
        // 最後に保存された値と同じ場合はスキップ
        if (lastSavedValueRef.current === newValue) {
          console.log('[AutoSave Case2] 内容が同じためスキップ');
          return;
        }

        console.log('[AutoSave Case2] デバウンスタイマーを設定 (2秒待機)');

        // 前のデバウンスタイマーをクリア
        if (debounceTimerRef.current !== null) {
          clearTimeout(debounceTimerRef.current);
          console.log('[AutoSave Case2] 前のタイマーをクリア');
        }

        // 保存対象の値と現在のパスをクロージャにキャプチャ
        const valueToSave = newValue;
        const pathToSave = currentPathRef.current;

        // 新しいデバウンスタイマーを設定（2秒の遅延）
        debounceTimerRef.current = setTimeout(async () => {
          console.log('[AutoSave Case2] デバウンスタイマー発火');
          // 最後に保存された値と異なるかをチェック（ユーザーが再度編集していないか確認）
          if (lastSavedValueRef.current !== valueToSave && pathToSave) {
            console.log('[AutoSave Case2] ファイルを保存します');
            try {
              await writeFileWithEncoding(pathToSave, valueToSave, currentEncoding);
              await saveSnapshot(pathToSave, valueToSave);
              console.log('[AutoSave Case2] ファイル保存完了:', pathToSave);
              setCurrentPath(pathToSave);
              setIsDirty(false);
              lastSavedValueRef.current = valueToSave;
              // ファイル保存完了時のコールバックを実行
              onFileSavedCallbacksRef.current.forEach((callback) => callback());
            } catch (e) {
              console.error('[AutoSave Case2] 保存失敗:', e);
            }
          } else {
            console.log('[AutoSave Case2] 保存スキップ - 最後の保存以降、変更がありません');
          }
          debounceTimerRef.current = null;
        }, 2000);

        // 前回のコードを更新（内容比較用）
        previousCodeRef.current = newValue;
      }
    },
    [currentEncoding]
  );

  // アンマウント時にデバウンスタイマーをクリア
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    currentPath,
    setCurrentPath,
    isDirty,
    setIsDirty,
    saveFile,
    createNew,
    openFile,
    checkAutoFirstSave,
    isDirtyRef,
    codeRef,
    currentPathRef,
    cursorPositionRef,
    currentEncoding,
    setCurrentEncoding,
    onFileSaved,
  };
}
