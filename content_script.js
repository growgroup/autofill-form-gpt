// CSSスタイルを動的に挿入
const style = document.createElement('style');
style.textContent = `
:root {
  --highlight-color: rgba(0, 123, 255, 0.5);
  --loading-spinner-size: 24px;
  --loading-spinner-color: #007bff;
}

.form-highlight {
  outline: 2px solid var(--highlight-color);
  transition: outline 0.3s ease;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-spinner {
  width: var(--loading-spinner-size);
  height: var(--loading-spinner-size);
  border: 4px solid transparent;
  border-top-color: var(--loading-spinner-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
`;
document.head.appendChild(style);

// フォーム選択モードのフラグ
let selectionMode = false;
let currentHighlightedForm = null;

// フォームをハイライトする関数
function highlightForm(form) {
  if (currentHighlightedForm) {
    currentHighlightedForm.classList.remove('form-highlight');
  }
  currentHighlightedForm = form;
  form.classList.add('form-highlight');
}

// フォームのハイライトを解除する関数
function removeHighlight() {
  if (currentHighlightedForm) {
    currentHighlightedForm.classList.remove('form-highlight');
    currentHighlightedForm = null;
  }
}

// ローディングインジケーターを表示する関数
function showLoadingOverlay(element) {
  const wrapper = document.createElement('div');
  wrapper.classList.add('loading-overlay');

  const spinner = document.createElement('div');
  spinner.classList.add('loading-spinner');

  wrapper.appendChild(spinner);

  // 要素の位置を取得
  const rect = element.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

  // オーバーレイのスタイルを設定
  wrapper.style.top = `${rect.top + scrollTop}px`;
  wrapper.style.left = `${rect.left + scrollLeft}px`;
  wrapper.style.width = `${rect.width}px`;
  wrapper.style.height = `${rect.height}px`;

  document.body.appendChild(wrapper);

  return wrapper;
}

// ローディングインジケーターを削除する関数
function removeLoadingOverlay(overlay) {
  if (overlay && overlay.parentElement) {
    overlay.parentElement.removeChild(overlay);
  }
}

// フォーム選択モードを開始する関数
function startSelectionMode() {
  selectionMode = true;
  document.body.style.cursor = 'crosshair';

  document.addEventListener('mousemove', mouseMoveHandler);
  document.addEventListener('click', formClickHandler, true);
}

// フォーム選択モードを終了する関数
function stopSelectionMode() {
  selectionMode = false;
  document.body.style.cursor = 'default';

  document.removeEventListener('mousemove', mouseMoveHandler);
  document.removeEventListener('click', formClickHandler, true);
  removeHighlight();
}

// マウス移動時のハンドラー
function mouseMoveHandler(e) {
  const form = e.target.closest('form');
  if (form) {
    highlightForm(form);
  } else {
    removeHighlight();
  }
}

// フォームクリック時のハンドラー
async function formClickHandler(e) {
  if (!selectionMode) return;

  const form = e.target.closest('form');
  if (form) {
    e.preventDefault();
    stopSelectionMode();
    await processForm(form);
  }
}

// フォームを処理する関数
async function processForm(form) {
  // フォーム内の入力要素を取得
  const formElements = form.querySelectorAll(`
    input[type="email"],
    input[type="number"],
    input[type="checkbox"],
    input[type="radio"],
    input[type="text"],
    input[type="url"],
    input[type="date"],
    input[type="password"],
    textarea,
    select,
    input[type="file"]
  `);

  // OpenAI APIキーと言語設定、追加プロンプト、上書きオプションを取得
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(['apiKey', 'language', 'additionalPrompt', 'overwrite'], async (items) => {
      const apiKey = items.apiKey;
      const language = items.language || 'ja';
      const additionalPrompt = items.additionalPrompt || '';
      const overwrite = items.overwrite || true;

      if (!apiKey) {
        alert('OpenAI APIキーが設定されていません。ポップアップから設定してください。');
        reject('APIキーが設定されていません');
        return;
      }

      // フィールドごとのプロミスを格納する配列
      const fieldPromises = [];

      // 各フォーム要素を処理
      formElements.forEach((element) => {
        const fieldInfo = element.name || element.id || element.placeholder;
        if (!fieldInfo) return;

        // input[type="file"] はスキップ
        if (element.type === 'file') {
          console.warn(`ファイル入力フィールド (${fieldInfo}) はスキップされました。`);
          return;
        }

        // 既存の値があり、上書きオプションが無効の場合はスキップ
        if (element.value && element.value.trim() !== '' && !overwrite) {
          console.info(`フィールド "${fieldInfo}" に既に値が設定されているためスキップされました。`);
          return;
        }

        // 各フィールドの処理をプロミスとして定義
        const fieldPromise = (async () => {
          let loadingOverlay = null;
          try {
            switch (element.type) {
              case 'checkbox':
              case 'radio':
                loadingOverlay = showLoadingOverlay(element);
                element.checked = Math.random() > 0.5;
                break;

              case 'select-one':
                loadingOverlay = showLoadingOverlay(element);
                const options = element.options;
                const randomIndex = Math.floor(Math.random() * options.length);
                element.selectedIndex = randomIndex;
                break;

              case 'date':
                loadingOverlay = showLoadingOverlay(element);
                const today = new Date();
                element.value = today.toISOString().split('T')[0];
                break;

              default:
                // テキスト、URL、パスワード、テキストエリアの場合
                loadingOverlay = showLoadingOverlay(element);
                const demoData = await getDemoData(apiKey, fieldInfo, language, element.type, additionalPrompt);
                element.value = demoData;
            }
          } catch (error) {
            console.error(`Error processing field "${fieldInfo}":`, error);
          } finally {
            // ローディングインジケーターを削除
            if (loadingOverlay) {
              removeLoadingOverlay(loadingOverlay);
            }
          }
        })();

        fieldPromises.push(fieldPromise);
      });

      // 全てのフィールド処理が完了するのを待つ
      try {
        await Promise.all(fieldPromises);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

// OpenAI APIを使用してデモデータを取得
async function getDemoData(apiKey, fieldInfo, language, elementType, additionalPrompt) {
  let prompt = `以下のフィールドに適したデモデータを提供してください。
・フィールド名：「${fieldInfo}」
・入力タイプ：「${elementType}」
・言語：「${language}」
※パスワードの場合は8文字以上の英数字記号を含むものを生成してください。
※URLの場合は有効なURLを生成してください。`;

  if (additionalPrompt) {
    prompt += `# 生成時参考情報：${additionalPrompt}`;
  }
  prompt += `# 必須ルール : 以下の事項は必ず守ってください。
  ・デモデータのみを返してください。説明などは一切不要です。
  ・デモデータはフィールドの種類に適したものを返してください。
  ・デモデータは一つの値のみを返してください。【デモデータ : 】といった記載は一切不要です。
  ・送信するデータがテスト用のデモデータであることがわかりやすいようにしてください。
  `;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      "model": "gpt-4o-mini",
      "messages": [{ "role": "user", "content": prompt }],
      "max_tokens": 50,
      "temperature": 0.7
    })
  });

  const data = await response.json();
  if (data.choices && data.choices.length > 0) {
    // 応答から不要な部分を取り除き、純粋な値を返す
    return data.choices[0].message.content.trim().replace(/^「|」$/g, '');
  } else {
    throw new Error('Invalid response from OpenAI API');
  }
}

// 拡張機能のアイコンクリックをリッスン
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log(request);
  if (request.action === 'startSelection') {
    startSelectionMode();
    sendResponse({ status: '自動入力を行うフォームを選択してください。' });
  }
});
