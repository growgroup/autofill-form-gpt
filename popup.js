// オプションを保存
document.getElementById('save').addEventListener('click', () => {
  const apiKey = document.getElementById('apiKey').value.trim();
  const language = document.getElementById('language').value;
  const additionalPrompt = document.getElementById('additionalPrompt').value.trim();

  chrome.storage.sync.set({ apiKey, language, additionalPrompt }, () => {
    alert('設定を保存しました。');
  });
});

// オプションをロード
window.addEventListener('load', () => {
  chrome.storage.sync.get(['apiKey', 'language', 'additionalPrompt'], (items) => {
    if (items.apiKey) {
      document.getElementById('apiKey').value = items.apiKey;
    }
    if (items.language) {
      document.getElementById('language').value = items.language;
    }
    if (items.additionalPrompt) {
      document.getElementById('additionalPrompt').value = items.additionalPrompt;
    }
  });
});

// フォームを自動入力ボタンの処理
document.getElementById('autoFill').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'startSelection' }, (response) => {
        if (response && response.status) {
          alert(response.status);
        }
      });
    }
  });
});
