import React, { useMemo, useEffect, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
// @ts-expect-error no type declarations
import 'github-markdown-css';
import './MarkdownPreview.css';

interface MarkdownPreviewProps {
  markdown: string;
  isVisible: boolean;
  previewMode: 'markdown' | 'vertical';
  verticalCharsPerLine: number;
  verticalKinsoku: boolean;
  verticalFontFamily: string;
  verticalFontSize: number;
  fontSize: number;
  lineHeight: number;
  editorRef: React.RefObject<any>;
  currentLine: number;
}

/**
 * デバウンス処理用のカスタムフック
 */
function useDebounce(value: string, delay: number = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  markdown,
  isVisible,
  previewMode,
  verticalCharsPerLine,
  verticalKinsoku,
  verticalFontFamily,
  verticalFontSize,
  fontSize,
  lineHeight,
  editorRef,
  currentLine,
}) => {
  const debouncedMarkdown = useDebounce(markdown, 300);

  /**
   * ルビ記法 (|文字《るび》) を HTML の ruby タグに変換
   */
  const parseRuby = (text: string) => {
    // |文字《るび》 -> <ruby>文字<rt>るび</rt></ruby>
    // |文字《・》 -> <ruby>文字<rt>・</rt></ruby> (傍点)
    return text.replace(/\|([^｜《》\n]+)《([^｜《》\n]+)》/g, '<ruby>$1<rt>$2</rt></ruby>');
  };

  // MarkdownをHTMLに変換（行番号情報の埋め込みを含む）
  const htmlContent = useMemo(() => {
    if (!isVisible) return '';

    try {
      // marked v14以降では、walkTokensを使って元のmarkdownの行番号を特定できる
      // シンプルな実装として、行ごとに分割して処理する方法もあるが、
      // ここではmarkedの拡張（extension）やカスタムレンダラーを工夫する

      const tokens = marked.lexer(debouncedMarkdown);

      let currentLineCount = 1;
      const htmlSegments: string[] = [];

      for (const token of tokens) {
        const line = currentLineCount;
        // トークンが占める行数を計算（末尾の改行を含むため -1）
        const linesInToken = token.raw.split('\n').length - 1;
        currentLineCount += Math.max(1, linesInToken);

        if (token.type === 'space') {
          continue;
        }

        try {
          // 各ブロックトークンを個別にレンダリング
          let rendered = marked.parser([token]);

          // ルビを適用 (コードセクション内などは回避されるべきだが、markedの後続処理で制御)
          // marked.parserを通した後のHTMLに対してルビパースを適用
          if (token.type !== 'code' && token.type !== 'codespan') {
            rendered = parseRuby(rendered);
          }

          // 最初のHTMLタグにdata-line属性を注入
          const injected = rendered.replace(/^<([a-z1-6]+)/i, `<$1 data-line="${line}"`);
          htmlSegments.push(injected);
        } catch (e) {
          console.warn('Failed to render token:', token.type, e);
          htmlSegments.push(parseRuby(marked.parser([token])));
        }
      }

      const html = htmlSegments.join('');
      const cleanHtml = DOMPurify.sanitize(html, {
        ADD_TAGS: ['ruby', 'rt', 'rp'],
      });
      return cleanHtml;
    } catch (e) {
      console.error('Failed to parse markdown:', e);
      return '<p style="color: red;">Markdownのレンダリングに失敗しました</p>';
    }
  }, [debouncedMarkdown, isVisible, previewMode]);

  // エディタのレイアウト調整（プレビュー表示切り替え時）
  useEffect(() => {
    if (editorRef?.current) {
      setTimeout(() => {
        editorRef.current?.layout();
      }, 50);
    }
  }, [isVisible, editorRef]);

  // 同期スクロールの実装
  useEffect(() => {
    if (!isVisible || !currentLine) return;

    const previewElement = document.getElementById('preview-container');
    if (!previewElement) return;

    // data-line属性を持つすべての要素を取得
    const elements = previewElement.querySelectorAll('[data-line]');
    let targetElement: HTMLElement | null = null;
    let closestLine = -1;

    // 現在の行番号に最も近い（超えない）要素を探す
    elements.forEach((el) => {
      const line = parseInt(el.getAttribute('data-line') || '0', 10);
      if (line <= currentLine && line > closestLine) {
        closestLine = line;
        targetElement = el as HTMLElement;
      }
    });

    if (targetElement) {
      if (previewMode === 'vertical') {
        const containerRect = previewElement.getBoundingClientRect();
        const elementRect = (targetElement as HTMLElement).getBoundingClientRect();

        // 縦書き（vertical-rl）は右から左へ流れる。
        // scrollLeft は通常負の値や右端が基準になることがあるが、ブラウザ実装により異なる。
        // ここでは単純な位置計算を試みる。
        const relativeLeft = elementRect.left - containerRect.left + previewElement.scrollLeft;
        const targetScrollLeft = relativeLeft - containerRect.width / 2 + elementRect.width / 2;

        previewElement.scrollTo({
          left: targetScrollLeft,
          behavior: 'smooth',
        });
      } else {
        const containerRect = previewElement.getBoundingClientRect();
        const elementRect = (targetElement as HTMLElement).getBoundingClientRect();
        const relativeTop = elementRect.top - containerRect.top + previewElement.scrollTop;
        const targetScrollTop = relativeTop - containerRect.height / 2 + elementRect.height / 2;

        previewElement.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth',
        });
      }
    }
  }, [currentLine, isVisible, previewMode]);

  if (!isVisible) {
    return null;
  }

  const verticalStyle: React.CSSProperties =
    previewMode === 'vertical'
      ? {
          height: `${verticalCharsPerLine * lineHeight}em`,
          lineBreak: verticalKinsoku ? 'strict' : 'auto',
          wordBreak: 'break-all',
          fontFamily: `${verticalFontFamily}, serif`,
          fontSize: `${verticalFontSize}px`,
        }
      : {};

  const nonVerticalStyle: React.CSSProperties =
    previewMode !== 'vertical'
      ? {
          fontSize: `${fontSize}px`,
          lineHeight: `${lineHeight}em`,
        }
      : {};

  return (
    <div
      id="preview-container"
      className={`markdown-preview-container ${previewMode === 'vertical' ? 'vertical-writing' : ''}`}
    >
      <div
        id="preview"
        className={`markdown-body ${previewMode === 'vertical' ? 'vertical-writing' : ''}`}
        style={previewMode === 'vertical' ? verticalStyle : nonVerticalStyle}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </div>
  );
};

export default MarkdownPreview;
