'use strict';

let dadosColetados = [];
let cancelado = false;
let executando = false;
let janelaAtual = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.acao === "status") {
    sendResponse({ executando });
    return true;
  }
  
  // Inicia o processo de coleta
  if (msg.acao === "iniciarColeta") {
    executando = true;
    cancelado = false;
    dadosColetados = [];
    
    chrome.tabs.sendMessage(msg.tabId, {
      acao: "iniciarContent",
      wordsTitle: msg.wordsTitle,
      wordsDesc: msg.wordsDesc,
      saveAll: msg.saveAll
    });
    
    sendResponse({ status: "ok" });
    return true;
  }
  
  // Cancela e gera o arquivo TXT das vagas coletadas até o momento
  if (msg.acao === "cancelar") {
    cancelado = true;
    executando = false;
    gerarArquivoTxt();
    if (janelaAtual) {
      chrome.windows.remove(janelaAtual, () => { janelaAtual = null; });
    }
    sendResponse({ status: "cancelado" });
    return true;
  }
  
  // Recebe a URL do content.js, abre o popup, analisa e fecha
  if (msg.acao === "abrirPopupEExtrair") {
    if (cancelado) {
      sendResponse({ status: "cancelado" });
      return true;
    }

    chrome.windows.create({
      url: msg.url,
      type: "popup",
      width: 800,
      height: 600,
      focused: true
    }, (win) => {
      janelaAtual = win.id;
      let tabId = win.tabs[0].id;

      let ouvinte = function(tabIdUpdated, info) {
        if (tabIdUpdated === tabId && info.status === "complete") {
          chrome.tabs.onUpdated.removeListener(ouvinte);

          chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (wordsTitle, wordsDesc, saveAll) => {
              return new Promise((resolve) => {
                setTimeout(() => {
                  let rawTitle = document.querySelectorAll("h1")[0]?.innerText || "";
                  let rawCompany = document.querySelectorAll("h2")[0]?.innerText || "";
                  let descElement = document.querySelectorAll('[data-testid="JobDescription"]')[0];
                  let rawDesc = descElement?.innerText || "";

                  let lowerTitle = rawTitle.toLowerCase();
                  let lowerDesc = rawDesc.toLowerCase();

                  let palavrasTitulo = wordsTitle.filter(p => lowerTitle.includes(p));
                  let palavrasDescricao = wordsDesc.filter(p => lowerDesc.includes(p));

                  palavrasTitulo = [...new Set(palavrasTitulo)];
                  palavrasDescricao = [...new Set(palavrasDescricao)];

                  // Verifica se a vaga atende aos filtros de salvamento
                  let deveSalvar = saveAll || (palavrasTitulo.length > 0) || (palavrasDescricao.length > 0);

                  resolve({
                    deveSalvar,
                    dataHora: new Date().toLocaleString(),
                    titulo: rawTitle,
                    empresa: rawCompany,
                    palavrasTitulo: palavrasTitulo.join('; '),
                    palavrasDescricao: palavrasDescricao.join('; '),
                    descricao: rawDesc
                  });
                }, 3000);
              });
            },
            args: [msg.wordsTitle || [], msg.wordsDesc || [], msg.saveAll || false]
          }, (resultados) => {
            if (resultados && resultados[0] && resultados[0].result) {
              let r = resultados[0].result;
              if (r.deveSalvar) {
                dadosColetados.push({
                  dataHora: r.dataHora,
                  titulo: r.titulo,
                  empresa: r.empresa,
                  palavrasTitulo: r.palavrasTitulo,
                  palavrasDescricao: r.palavrasDescricao,
                  url: msg.url,
                  descricao: r.descricao
                });
              }
            }

            chrome.windows.remove(janelaAtual, () => {
              janelaAtual = null;
              sendResponse({ status: "ok" });
            });
          });
        }
      };
      chrome.tabs.onUpdated.addListener(ouvinte);
    });
    
    return true;
  }
  
  if (msg.acao === "finalizar") {
    executando = false;
    gerarArquivoTxt();
    sendResponse({ status: "ok" });
    return true;
  }
});

function gerarArquivoTxt() {
  if (dadosColetados.length === 0) return;

  // Formatação com aspas no título e remoção de quebras extras/aspas na descrição
  let csvContent = "\uFEFFData e Hora\tTítulo da Vaga\tEmpresa\tPalavras Título\tPalavras Descrição\tLink\tDescrição\n";

  dadosColetados.forEach(vaga => {
    let titFormatado = '"' + (vaga.titulo || '').replace(/\n+/g, ' ') + '"';
    let empFormatada = "'" + (vaga.empresa || '');
    let descFormatada = '"' + (vaga.descricao || '').replace(/\n+/g, '\n').replace(/"/g, '').trim() + '"';

    csvContent += `${vaga.dataHora}\t${titFormatado}\t${empFormatada}\t${vaga.palavrasTitulo}\t${vaga.palavrasDescricao}\t${vaga.url}\t${descFormatada}\n`;
  });

  let dataUrl = "data:text/plain;charset=utf-8," + encodeURIComponent(csvContent);

  chrome.downloads.download({
    url: dataUrl,
    filename: "vagasStorage.txt",
    saveAs: false
  });
}