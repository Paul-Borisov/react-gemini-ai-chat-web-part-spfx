//https://github.com/react-syntax-highlighter/react-syntax-highlighter
//https://github.com/react-syntax-highlighter/react-syntax-highlighter/issues/132
import { Dropdown, FontIcon, IDropdownOption, ResponsiveMode, TooltipHost } from '@fluentui/react';
import * as strings from 'GeminiAiChatWebPartStrings';
import * as React from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import * as syntaxStyles from 'react-syntax-highlighter/dist/esm/styles/hljs';
import HtmlHelper from 'shared/helpers/HtmlHelper';
import MarkdownHelper from 'shared/helpers/MarkdownHelper';
import styles from './CodeHighlighter.module.scss';

const defaultSelectedStyle = 'stackoverflowDark';

const languageMap: { [key: string]: string } = {
  cpp: 'c++',
  csharp: 'c#',
};

export function getHighlightStyles(): string[] {
  return Object.keys(syntaxStyles);
}

export function getStylesSelector(selectedKey: string, onChange: (newKey: any) => void): JSX.Element {
  return (
    <div className={styles.container}>
      <div>{strings.TextCodeStyle}</div>
      <Dropdown
        className={styles.styleSelector}
        selectedKey={selectedKey || defaultSelectedStyle}
        options={Object.keys(syntaxStyles).map((key) => {
          const option: IDropdownOption = {
            key: key,
            text: key,
            data: syntaxStyles[key],
          };
          return option;
        })}
        responsiveMode={ResponsiveMode.unknown}
        onChange={(e, option) => onChange(option.key)}
      />
    </div>
  );
}

export function formatCode(text: string, styleKey: string = defaultSelectedStyle): JSX.Element {
  if (!MarkdownHelper.hasMarkdownBlocks(text)) {
    let adjustedText = MarkdownHelper.replaceMarkdownElements(text);
    if (MarkdownHelper.hasTables(adjustedText)) {
      adjustedText = MarkdownHelper.convertToHTMLTable(adjustedText);
    }
    if (HtmlHelper.hasHtmlTags(adjustedText)) {
      return <span dangerouslySetInnerHTML={{ __html: HtmlHelper.stripScripts(HtmlHelper.stripStyles(adjustedText)) }} />;
    } else {
      return <>{adjustedText}</>;
    }
  }

  const theme: any = syntaxStyles[styleKey];

  const formatted: JSX.Element[] = [];

  const allLines = text.split('\n');
  let language: string = '';
  let started: boolean = false;
  let codeBlock: string[] = [];
  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];
    const isMarkdown = /^\s*```/.test(line);
    if (!started) {
      if (!isMarkdown) {
        let formattedLine = undefined;
        if (/`[^`]+`/.test(line)) {
          formattedLine = HtmlHelper.htmlEncode(line);
          formattedLine = formattedLine.replace(/`([^`]+)`/g, `<b>${'$1'}</b>`);
          formatted.push(<span dangerouslySetInnerHTML={{ __html: formattedLine }} />);
        } else {
          formatted.push(<>{`${line}\n`}</>);
        }
      } else {
        started = true;
        language = line.replace(/^\s*```/, '').toLocaleLowerCase();
      }
      continue;
    }
    // Sometimes Gemini AI does not close markdown.
    if (!isMarkdown && (!started || i + 1 < allLines.length)) {
      codeBlock.push(line);
    } else {
      const content = codeBlock.join('\n');
      const syntaxId = `${styles.syntax}_${Math.floor(Math.random() * 1000000)}`;
      language = languageMap[language] ?? language;
      formatted.push(
        <div className={styles.highlightHeader} style={theme.hljs}>
          <div>{language || strings.TextCommands}</div>
          <TooltipHost content={strings.TextCopy}>
            <FontIcon iconName="Copy" className={styles.copy} onClick={() => copyToClipboard(content, syntaxId)} />
          </TooltipHost>
        </div>
      );
      formatted.push(
        language === 'html' ? (
          <div id={syntaxId} className={styles.html} dangerouslySetInnerHTML={{ __html: content }} />
        ) : (
          <SyntaxHighlighter
            id={syntaxId}
            className={styles.syntax}
            language={language} // If language not supported, it uses default style
            style={theme}
            showLineNumbers={false}
            wrapLongLines={true}
          >
            {content}
          </SyntaxHighlighter>
        )
      );
      formatted.push(<>{'\n'}</>);
      language = isMarkdown
        ? line
            .replace(/^\s*```/, '')
            .toLocaleLowerCase()
            .trim()
        : '';
      started = !language ? false : true;
      //started = false;
      //language = '';
      codeBlock = [];
    }
  }
  return <span className="code-highlighter">{formatted}</span>;
}

function copyToClipboard(text: string, elementId: string) {
  navigator.clipboard.writeText(text);
  let el;
  try {
    el = document.querySelector(`.ms-Panel--custom.is-open #${elementId}`);
  } catch (e) {}
  if (!el) {
    el = document.getElementById(elementId);
  }
  const className = el.className;
  el.className = `${el.className} ${styles.progress}`;
  setTimeout(() => (el.className = className), 1000);
}
