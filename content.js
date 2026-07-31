'use strict';

let i = 0;
let rodando = false;
let wordsTitleList = [];
let wordsDescList = [];
let saveAllMode = false;

function highlight(elemento) {
  document.querySelectorAll(".__highlight_debug__").forEach(el => {
    el.style.outline = "";
    el.style.background = "";
    el.classList.remove("__highlight_debug__");
  });

  if (elemento) {
    elemento.classList.add("__highlight_debug__");
    elemento.style.outline = "2px solid #1a73e8";
    elemento.style.background = "rgba(26,115,232,0.15)";
    elemento.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.acao === "iniciarContent") {
    if (!rodando) {
      rodando = true;
      i = 0;
      wordsTitleList = msg.wordsTitle || [];
      wordsDescList = msg.wordsDesc || [];
      saveAllMode = msg.saveAll || false;
      start();
    }
  }
  if (msg.acao === "pararContent") {
    rodando = false;
  }
});

async function start() {
  if (!rodando) return;

  const container = document.querySelectorAll('[id="todasVagas"]')[0];
  const listaVagas = container ? container.children[0].children : [];

  // Paginação
  if (i >= listaVagas.length - 3) {
    const botaoMais = document.querySelector('[id="maisVagas"]');
    if (botaoMais) {
      console.log("Clicando em 'Exibir mais vagas'...");
      botaoMais.click();
      setTimeout(start, 2500);
      return;
    } 
    
    if (i >= listaVagas.length) {
      console.log("Todas as vagas processadas! Avisando o background...");
      chrome.runtime.sendMessage({ acao: "finalizar" });
      rodando = false;
      return;
    }
  }

  let vagaAtual = listaVagas[i];
  
  if (vagaAtual) {
    highlight(vagaAtual);

    try {
      let linkElement = vagaAtual.querySelectorAll("h2")[0]?.children[0];
      
      if (linkElement && linkElement.href) {
        let urlVaga = linkElement.href;
        console.log(`Extraindo Vaga ${i}...`);
        
        // Pausa e aguarda a extração da janela suspensa/popup
        await new Promise(resolve => {
          chrome.runtime.sendMessage({
            acao: "abrirPopupEExtrair",
            url: urlVaga,
            wordsTitle: wordsTitleList,
            wordsDesc: wordsDescList,
            saveAll: saveAllMode
          }, () => {
            resolve();
          });
        });

      } else {
        console.log(`Vaga ${i}: Link não encontrado.`);
      }
    } catch (erro) {
      console.log(`Vaga ${i}: Erro na extração estrutural.`, erro);
    }
  }

  i++;
  setTimeout(start, 1000);
}