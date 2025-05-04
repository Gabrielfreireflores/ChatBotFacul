require('dotenv').config();
const axios = require("axios");
const { Telegraf } = require("telegraf");
const { message } = require("telegraf/filters");
const { removerPedido, pedidos, verPedido, greetings, confirmarPedido, encerrar, perguntarNomeBot, pedirCardapio } = require("./intents");

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

bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const userName = ctx.from.first_name;
  const userMsg = ctx.message.text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  if (!userData[userId]) {
    userData[userId] = { name: userName, pedido: [], state: 'init' };
  }

  const state = userData[userId].state;
  const pedido = userData[userId].pedido;

  if (greetings.includes(userMsg)) {
    userData[userId].state = 'aguardando_confirmacao_cardapio';
    return ctx.reply(`Olá ${userName}! Seja bem-vindo ao canal de atendimento Bar do Link 🍻. Quer ver nosso cardápio?`);
  }

  if (userData[userId].state === 'aguardando_confirmacao_cardapio' && ['sim', 'quero', 'ok'].includes(userMsg)) {
    userData[userId].state = 'start';
    return ctx.reply(itensDisponiveis, { parse_mode: 'Markdown' });
  }

  if (perguntarNomeBot.includes(userMsg)) {
    return ctx.reply(`Olá ${userName}! Eu sou o Bot Bar do Link 😎 Como posso ajudar hoje?`);
  }

  if (pedirCardapio.some(p => userMsg.includes(p))) {
    return ctx.reply(itensDisponiveis, { parse_mode: 'Markdown' });
  }

  if (encerrar.includes(userMsg)) {
    userData[userId].state = 'init';
    userData[userId].pedido = [];
    return ctx.reply('Pedido encerrado, forte abraço.\n\n Precisando de mais alguma coisa só me chamar 🫡😎');
  }

  if (verPedido.includes(userMsg)) {
    if (pedido.length > 0) {
      const resumo = pedido.map(p => `${p.quantidade}x ${p.produto} - R$${p.valor.toFixed(2)}`).join('\n');
      const total = pedido.reduce((soma, p) => soma + p.valor * p.quantidade, 0);
      return ctx.reply(`Seu pedido atual:\n${resumo}\nTotal: R$${total.toFixed(2)}\nDeseja confirmar ou remover algum item?`);
    } else {
      return ctx.reply('Seu pedido está vazio. Quer ver o cardápio?');
    }
  }

  if (removerPedido.includes(userMsg) || userMsg.startsWith('remover') || userMsg.startsWith('tirar')) {
    const matchRemover = userMsg.match(/(?:remover|tirar)?\s*(\d+|uma|um)?\s*([\w\s\-çãéá]+)/i);
    if (!matchRemover) {
      return ctx.reply("Não consegui entender o item que deseja remover. Pode repetir, por favor?");
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
        return ctx.reply(`Item "${removido.produto}" totalmente removido. Pedido atual: ${pedido.map(p => `${p.quantidade}x ${p.produto}`).join(', ') || 'nenhum item.'}`);
      }
    } else {
      return ctx.reply(`Não encontrei "${itemTexto}" no seu pedido.`);
    }
  }

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

  // Novo formato: "2 coxinha" sem valor
  const match = userMsg.match(/(\d+)\s+([\w\s\-çãéá]+)/i);
  if (match) {
    const quantidade = parseInt(match[1]);
    const produto = match[2].trim().toLowerCase();
    const nomeProduto = Object.keys(precos).find(p => produto.includes(p));
    if (!nomeProduto) {
      return ctx.reply(`"${produto}" não está no cardápio. Pode tentar novamente? 😉`);
    }
    const valor = precos[nomeProduto];
    userData[userId].pedido.push({ quantidade, produto: nomeProduto, valor });
    userData[userId].state = 'confirmar_pedido';
    return ctx.reply(`Adicionado: ${quantidade}x ${nomeProduto} - R$${(valor * quantidade).toFixed(2)}. Deseja confirmar ou adicionar mais algo?`);
  }

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