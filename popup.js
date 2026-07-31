'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const keywordsTitleInput = document.getElementById('keywordsTitle');
  const keywordsDescInput = document.getElementById('keywordsDesc');
  const saveAllCheckbox = document.getElementById('saveAll');

  // Restaura dados salvos do storage ao abrir o popup
  chrome.storage.local.get(['wordsTitle', 'wordsDesc', 'saveAll', 'running'], (data) => {
    if (data.wordsTitle) keywordsTitleInput.value = data.wordsTitle.join(', ');
    if (data.wordsDesc) keywordsDescInput.value = data.wordsDesc.join(', ');
    saveAllCheckbox.checked = !!data.saveAll;

    chrome.runtime.sendMessage({ acao: "status" }, (res) => {
      setRunningState(res?.executando || false);
    });
  });

  function setRunningState(isRunning) {
    if (isRunning) {
      startBtn.style.display = 'none';
      stopBtn.style.display = 'block';
      keywordsTitleInput.disabled = true;
      keywordsDescInput.disabled = true;
      saveAllCheckbox.disabled = true;
    } else {
      startBtn.style.display = 'block';
      stopBtn.style.display = 'none';
      keywordsTitleInput.disabled = false;
      keywordsDescInput.disabled = false;
      saveAllCheckbox.disabled = false;
    }
  }

  startBtn.addEventListener('click', () => {
    const wordsTitle = (keywordsTitleInput.value || '')
      .toLowerCase()
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);

    const wordsDesc = (keywordsDescInput.value || '')
      .toLowerCase()
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);

    const saveAll = saveAllCheckbox.checked;

    chrome.storage.local.set({ wordsTitle, wordsDesc, saveAll }, () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        let tabAtual = tabs[0];
        chrome.runtime.sendMessage({
          acao: "iniciarColeta",
          tabId: tabAtual.id,
          wordsTitle,
          wordsDesc,
          saveAll
        }, () => {
          setRunningState(true);
        });
      });
    });
  });

  stopBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      let tabAtual = tabs[0];
      if (tabAtual) {
        chrome.tabs.sendMessage(tabAtual.id, { acao: "pararContent" });
      }
      chrome.runtime.sendMessage({ acao: "cancelar" }, () => {
        setRunningState(false);
      });
    });
  });
});