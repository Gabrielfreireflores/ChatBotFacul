require('dotenv').config();
const axios = require("axios");
const { Telegraf } = require("telegraf");
const { message } = require("telegraf/filters");
const { removerPedido, pedidos, verPedido, greetings, confirmarPedido, encerrar, perguntarNomeBot, pedirCardapio, agradecimentos } = require("./intents");

// Verificação do token 
if (!process.env.BOT_TOKEN) {
  throw new Error("Token não definido. Verificar arquivo .env.");
}

const precos = {
  'lanche': 5.00,
  'hamburguer': 7.00,
  'dogao': 7.00,
  'batata': 7.00,
  'coxinha': 7.00,
  'salgado de salsicha': 7.00,
  'salgado de calabresa': 6.00,
  'salgadinho': 6.00,
  'fanta-laranja': 5.00,
  'suco': 5.00,
  'agua': 3.00,
  'coca-cola': 5.00,
  'budweiser': 8.00,
  'heinekein': 9.00,
  'boa': 6.00,
  'brahma': 6.00,
  'stella': 8.00
};
//Lista do cardápio
const itensDisponiveis = `
🍔 *Lanches*
- Lanche - R$ 5,00
- Hambúrguer - R$ 7,00
- Dogão - R$ 7,00

🥟 *Acompanhamentos*
- Batata - R$ 7,00
- Coxinha - R$ 7,00
- Salgado de salsicha - R$ 7,00
- Salgado de calabresa - R$ 6,00
- Salgadinho - R$ 6,00

🥤 *Bebidas não alcoólicas*
- Fanta-Laranja - R$ 5,00
- Suco - R$ 5,00
- Água - R$ 3,00
- Coca-cola - R$ 5,00

🍺 *Bebidas alcoólicas*
- Budweiser - R$ 8,00
- Heinekein - R$ 9,00
- Boa (Antártica) - R$ 6,00
- Brahma - R$ 6,00
- Stella - R$ 8,00

O que deseja pedir meu bom?

Para o nosso sistema captar seu pedido,
peço que me passe da seguinte forma:

"quantidade: (1x)" "produto" 
`;

const bot = new Telegraf(process.env.BOT_TOKEN);
const userData = {};
const SHEETDB_URL = 'https://sheetdb.io/api/v1/egkgu3ao6kbp2';
//execução do bot
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const userName = ctx.from.first_name;
  const userMsg = ctx.message.text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  //Caso o usuario mande a entrada como : Uma coxinha, duas Bud.... etc
  const textoNumeros = {
    'um': '1',
    'uma': '1',
    'dois': '2',
    'duas': '2',
    'tres': '3',
    'três': '3',
    'quatro': '4',
    'cinco': '5',
    'seis': '6',
    'sete': '7',
    'oito': '8',
    'nove': '9',
    'dez': '10'
  };
  
  // Substitui palavras por números no texto do usuário
  let userMsgNormalizada = userMsg;
  for (const [palavra, numero] of Object.entries(textoNumeros)) {
    const regex = new RegExp(`\\b${palavra}\\b`, 'gi');
    userMsgNormalizada = userMsgNormalizada.replace(regex, numero);
  }

  if (!userData[userId]) {
    userData[userId] = { name: userName, pedido: [], state: 'init' };
  }

  const state = userData[userId].state;
  const pedido = userData[userId].pedido;

  //variavel de saudação para iniciar o bot
  if (greetings.includes(userMsg)) {
    userData[userId].state = 'aguardando_confirmacao_cardapio';
    return ctx.reply(`Olá ${userName}! Seja bem-vindo ao canal de atendimento Bar do Link 🍻. Quer ver nosso cardápio?`);
  }

  //Inicialização solicitando o cardapio
  if (userData[userId].state === 'aguardando_confirmacao_cardapio' && ['sim', 'quero','Quero','Sim', 'Mostra', 'mostra', 'ok'].includes(userMsg)) {
    userData[userId].state = 'start';
    return ctx.reply(itensDisponiveis, { parse_mode: 'Markdown' });
  }

  //caso o usuario pergunta o nome do bot
  if (perguntarNomeBot.includes(userMsg)) {
    return ctx.reply(`Olá ${userName}! Eu sou o Bot Bar do Link 😎 Como posso ajudar hoje?`);
  }

  //Caso o usuario solicite, instrução que invoca o cardapio
  if (pedirCardapio.some(p => userMsg.includes(p))) {
    return ctx.reply(itensDisponiveis, { parse_mode: 'Markdown' });
  }
  //encerramento do atendimento, quando solicitado pelo cliente  
  if (encerrar.includes(userMsg)) {
    userData[userId].state = 'init';
    userData[userId].pedido = [];
    return ctx.reply('Atendimento encerrado meu parceiro.\n\n Precisando de mais alguma coisa só me chamar 🫡😎');
  }

  if (agradecimentos.includes(userMsg)) {
    userData[userId].state = 'init';
    return ctx.reply('Nós quem agradecemos truta.\n\n Precisando de mais alguma coisa só me chamar ✌️🐌');
  }

  //Solicitação para ver o pedido.
  if (verPedido.includes(userMsg)) {
    if (pedido.length > 0) {
      const resumo = pedido.map(p => `${p.quantidade}x ${p.produto} - R$${p.valor.toFixed(2)}`).join('\n');
      const total = pedido.reduce((soma, p) => soma + p.valor * p.quantidade, 0);
      return ctx.reply(`Seu pedido atual:\n${resumo}\nTotal: R$${total.toFixed(2)}\nDeseja confirmar ou remover algum item?`);
    } else {
      return ctx.reply('Seu pedido está vazio. Quer ver o cardápio?');
    }
  }
  //solicitação para remover o pedido, decrementando valor e quantidade do item respectivamente, decrementando do total dos produtos.
  if (removerPedido.includes(userMsg) || userMsg.startsWith('remover') || userMsg.startsWith('tirar')) {
    const matchRemover = userMsg.match(/(?:remover|tirar)?\s*(\d+|uma|um)?\s*([\w\s\-çãéá]+)/i);
    if (!matchRemover) {
      return ctx.reply("Não consegui entender o item que deseja remover. Pode repetir, por favor?");// dispara caso o item não esteja dente os existentes
    }
    let quantidadeTexto = matchRemover[1];
    const itemTexto = matchRemover[2].trim();
    let quantidade = 1;
    if (quantidadeTexto) {
      if (!isNaN(quantidadeTexto)) {
        quantidade = parseInt(quantidadeTexto);
      } else if (quantidadeTexto === 'uma' || quantidadeTexto === 'um') {
        quantidade = 1;
      }
    }
    const index = pedido.findIndex(p => p.produto.toLowerCase().includes(itemTexto.toLowerCase()));
    if (index > -1) {
      if (pedido[index].quantidade > quantidade) {
        pedido[index].quantidade -= quantidade;
        return ctx.reply(`Removido ${quantidade} unidade(s) de "${pedido[index].produto}". Agora restam ${pedido[index].quantidade}.`);
      } else {
        const removido = pedido.splice(index, 1)[0];
        return ctx.reply(`Item "${removido.produto}" removido. Pedido atual: ${pedido.map(p => `${p.quantidade}x ${p.produto}`).join(', ') || 'nenhum item.'}`);
      }
    } else {
      return ctx.reply(`Não encontrei "${itemTexto}" no seu pedido.`);
    }
  }
  //bloco de confirmação do pedido, abre uma requisição no sheetdb para acessar os dados enviados pelo usuario.
  if (confirmarPedido.includes(userMsg)) {
    if (pedido.length === 0) {
      return ctx.reply('Seu pedido está vazio. Adicione itens antes de confirmar.');
    }
    try {
      for (const item of pedido) {
        await axios.post(SHEETDB_URL, {
          data: {
            cliente: userName,
            produto: item.produto,
            quantidade: item.quantidade,
            valor: item.valor,
            criado_em: new Date().toISOString(),
          },
        });
      }
      const resumo = pedido.map(p => `${p.quantidade}x ${p.produto} - R$${(p.valor * p.quantidade).toFixed(2)}`).join('\n');
      const total = pedido.reduce((soma, p) => soma + p.valor * p.quantidade, 0);
      userData[userId].pedido = [];
      userData[userId].state = 'valid';
      return ctx.reply(`Pedido confirmado com sucesso meu parceiro ✌️\n\n${resumo}\n\n*Total: R$${total.toFixed(2)}*\n\n Precisando de mais algo, só me chamar 🦾`, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Erro ao enviar para SheetDB:', error);
      return ctx.reply('Erro ao registrar seu pedido. Tente novamente mais tarde.');
    }
  }

// Novo formato: identificar múltiplos pedidos como "2 coxinhas e 1 coca-cola"
const matches = [...userMsgNormalizada.matchAll(/(\d+)\s+([\w\s\-çãéá]+?)(?=,|\se\s|\s\d+|$)/gi)];

if (matches.length > 0) {
  let itensAdicionados = [];
  for (const match of matches) {
    const quantidade = parseInt(match[1]);
    const produtoTexto = match[2].trim().toLowerCase();
    const nomeProduto = Object.keys(precos).find(p => produtoTexto.includes(p));

    if (!nomeProduto) {
      await ctx.reply(`"${produtoTexto}" não está no cardápio. Ignorando esse item.`);
      continue;
    }

    const valor = precos[nomeProduto];
    userData[userId].pedido.push({ quantidade, produto: nomeProduto, valor });
    itensAdicionados.push(`${quantidade}x ${nomeProduto} - R$${(valor * quantidade).toFixed(2)}`);
  }

  if (itensAdicionados.length > 0) {
    userData[userId].state = 'confirmar_pedido';
    return ctx.reply(`Itens adicionados:\n${itensAdicionados.join('\n')}\nDeseja confirmar ou adicionar mais algo?`);
  }
}
//atualizado contendo a possibilidade de adicionar dois pedidos ou mais de uma só vez

  if (state === 'confirmar_pedido') {
    if (userMsg.includes('mais')) {
      userData[userId].state = 'fazendo_pedido';
      return ctx.reply('Pode dizer o que mais você deseja.');
    }
    if (confirmarPedido.some(p => userMsg.includes(p)) || userMsg.includes('sim')) {
      userData[userId].state = 'pedido_confirmado';
      const resumo = pedido.map(p => `${p.quantidade}x ${p.produto} - R$${(p.valor * p.quantidade).toFixed(2)}`).join('\n');
      const total = pedido.reduce((soma, p) => soma + p.valor * p.quantidade, 0);
      return ctx.reply(`Pedido confirmado meu brother 🫡:\n${resumo}\n\nTotal: R$${total.toFixed(2)}\nObrigado, precisando é só chamar.`);
    }
    return ctx.reply('Não entendi. Você quer adicionar mais algo ou confirmar o pedido?');
  }

  return ctx.reply(`Desculpe, não entendi o que deseja 🤔. \n\nVocê pode dizer "ver pedido", "remover item", "cardapio" ou "encerrar"\n\nNo demais, Bot Bar do Link está à disposição 🫡`);
});

bot.launch();
console.log('Bot bar do link iniciado...');