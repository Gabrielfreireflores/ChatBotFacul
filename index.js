require('dotenv').config();
const axios = require("axios");
const { Telegraf } = require("telegraf");
const { message } = require("telegraf/filters");
const { removerPedido, pedidos, verPedido, greetings, confirmarPedido, encerrar, perguntarNomeBot, pedirCardapio } = require("./intents");

// Verificação do token 
if (!process.env.BOT_TOKEN) {
  throw new Error("Token não definido. Verificar arquivo .env.");
}

const itensDisponiveis = `
🍔 *Lanches*
- Lanche - R$ 6,00
- Hambúrguer - R$ 6,00
- Dogão - R$ 6,00

🥟 *Acompanhamentos*
- Batata - R$ 6,00
- Coxinha - R$ 6,00
- Salgado de salsicha - R$ 6,00
- Salgado de calabresa - R$ 6,00
- Salgadinho - R$ 6,00

🥤 *Bebidas não alcoólicas*
- Refrigerante - R$ 6,00
- Suco - R$ 6,00
- Água - R$ 6,00
- Coca-cola - R$ 6,00

🍺 *Bebidas alcoólicas*
- Budweiser - R$ 6,00
- Heinekein - R$ 6,00
- Boa - R$ 6,00
- Brahma - R$ 6,00
- Stella - R$ 6,00

O que deseja pedir meu bom?
`;

const bot = new Telegraf(process.env.BOT_TOKEN);
const userData = {};
const SHEETDB_URL = 'https://sheetdb.io/api/v1/egkgu3ao6kbp2';

bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const userName = ctx.from.first_name;
  const userMsg = ctx.message.text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (!userData[userId]) {
    userData[userId] = {
      name: userName,
      pedido: [],
      state: 'init',
    };
  }

  const state = userData[userId].state;
  const pedido = userData[userId].pedido;

  if (greetings.includes(userMsg)) {
    userData[userId].state = 'aguardando_confirmacao_cardapio'; 
    return ctx.reply(`Olá ${userName}! Seja bem-vindo ao canal de atendimento Bar do Link 🍻. Quer ver nosso cardápio?`);
  }

  if (
    userData[userId].state === 'aguardando_confirmacao_cardapio' &&
    ['sim', 'quero', 'ok'].includes(userMsg)
  ) {
    userData[userId].state = 'start'; // muda o estado após confirmação
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
    return ctx.reply('Pedido encerrado, forte abraço, precisando de mais algo só me chamar 👍 👍');
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

  // Remover pedido com quantidade específica
if (removerPedido.includes(userMsg) || userMsg.startsWith('remover') || userMsg.startsWith('tirar')) {
  const matchRemover = userMsg.match(/(?:remover|tirar)?\s*(\d+|uma|um)?\s*([\w\s\-çãéá]+)/i);

  if (!matchRemover) {
    return ctx.reply("Não consegui entender o item que deseja remover. Pode repetir, por favor?");
  }

  let quantidadeTexto = matchRemover[1];
  const itemTexto = matchRemover[2].trim();

  // Conversão de texto por extenso para número
  let quantidade = 1; // padrão
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
      return ctx.reply(`Item "${removido.produto}" totalmente removido. Pedido atual: ${
        pedido.map(p => `${p.quantidade}x ${p.produto}`).join(', ') || 'nenhum item.'
      }`);
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
      return ctx.reply(`Pedido confirmado com sucesso meu parceiro ✌️\n\n${resumo}\n\n*Total: R$${total.toFixed(2)}*\n\nPrecisando de mais algo, só me chamar 🦾`, {
        parse_mode: 'Markdown'
      });  
    } catch (error) {
      console.error('Erro ao enviar para SheetDB:', error);
      return ctx.reply('Erro ao registrar seu pedido. Tente novamente mais tarde.');
    }
  }

  // Tentativa de identificar um item no formato: "2 coca 6"
  const match = userMsg.match(/(\d+)\s+([\w\s\-çãéá]+)\s+(\d+(?:[.,]\d+)?)/i); 
  if (match) {
    const quantidade = parseInt(match[1]);
    const produto = match[2].trim();
    const valor = parseFloat(match[3].replace(',', '.'));

    userData[userId].pedido.push({ quantidade, produto, valor });
    userData[userId].state = 'confirmar_pedido';

    return ctx.reply(`Adicionado: ${quantidade}x ${produto} - R$${valor.toFixed(2)}. Deseja confirmar ou adicionar mais algo?`);
  }

  // Confirmar ou adicionar mais na etapa de confirmação
  if (state === 'confirmar_pedido') {
    if (userMsg.includes('mais')) {
      userData[userId].state = 'fazendo_pedido';
      return ctx.reply('Pode dizer o que mais você deseja.');
    }

    if (confirmarPedido.some(p => userMsg.includes(p)) || userMsg.includes('sim')) {
      userData[userId].state = 'pedido_confirmado';
      const resumo = pedido.map(p => `${p.quantidade}x ${p.produto} - R$${(p.valor * p.quantidade).toFixed(2)}`).join('\n');
      const total = pedido.reduce((soma, p) => soma + p.valor * p.quantidade, 0);
      return ctx.reply(`Pedido confirmado:\n${resumo}\nTotal: R$${total.toFixed(2)}\nObrigado!`);
    }

    return ctx.reply('Não entendi. Você quer adicionar mais algo ou confirmar o pedido?');
  }

  return ctx.reply('Desculpe, não entendi. Você pode dizer "ver pedido", "remover item", "confirmar" ou "encerrar".');
});

// 🚀 Inicia o bot
bot.launch();
console.log('Bot bar do link iniciado...');