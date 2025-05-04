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
- Lanche
- Hambúrguer
- Dogão

🥟 *Acompanhamentos*
- Batata
- Coxinha
- Salgado de salsicha
- Salgado de calabresa
- Salgadinho

🥤 *Bebidas não alcoólicas*
- Refrigerante
- Suco
- Água
- Coca-cola

🍺 *Bebidas alcoólicas*
- Budweiser
- Heinekein
- Boa
- Brahma
- Stella

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

// Saudação
if (greetings.includes(userMsg)) {
  userData[userId].state = 'start';
  return ctx.reply(`Olá ${userName}! Seja bem-vindo ao Bar do Link 🍻. Quer ver nosso cardápio?`);
}

// Pergunta sobre o nome do bot
if (perguntarNomeBot.includes(userMsg)) {
  return ctx.reply(`Olá ${userName}! Eu sou o Bot Bar do Link 😎 Como posso ajudar hoje?`);
}

// Mostrar cardápio
if (pedirCardapio.some(p => userMsg.includes(p))) {
  return ctx.reply(itensDisponiveis, { parse_mode: 'Markdown' });
}

// Encerrar atendimento
if (encerrar.includes(userMsg)) {
  userData[userId].state = 'init';
  userData[userId].pedido = [];
  return ctx.reply('Pedido encerrado. Até a próxima! 👋');
}

// Ver pedido
if (verPedido.includes(userMsg)) {
  if (pedido.length > 0) {
    return ctx.reply(`Seu pedido atual: ${pedido.join(', ')}. Deseja confirmar ou remover algum item?`);
  } else {
    return ctx.reply('Seu pedido está vazio. Quer ver o cardápio?');
  }
}

// Remover item
if (removerPedido.includes(userMsg) || userMsg.startsWith('remover') || userMsg.startsWith('tirar')) {
  const item = userMsg.replace(/remover|tirar|item|do pedido/g, '').trim();
  const index = pedido.findIndex((p) => p.includes(item));
  if (index > -1) {
    const removido = pedido.splice(index, 1)[0];
    return ctx.reply(`Item "${removido}" removido. Pedido atual: ${pedido.join(', ') || 'nenhum item.'}`);
  } else {
    return ctx.reply(`Não encontrei "${item}" no seu pedido.`);
  }
}

// Confirmar pedido
if (confirmarPedido.includes(userMsg)) {
  if (pedido.length === 0) {
    return ctx.reply('Seu pedido está vazio. Adicione itens antes de confirmar.');
  }

  try {
    await axios.post(SHEETDB_URL, {
      data: {
        cliente: userName,
        pedido: pedido.join(', '),
        criado_em: new Date().toISOString(),
      },
    });
    userData[userId].pedido = [];
    userData[userId].state = 'valid';
    return ctx.reply(`Pedido confirmado com sucesso meu parceiro ✌️
    
Precisando de mais algo, só me chamar 🦾 `);
  } catch (error) {
    console.error('Erro ao enviar para SheetDB:', error);
    return ctx.reply('Erro ao registrar seu pedido. Tente novamente mais tarde.');
  }
}

// Adicionar item em estados apropriados
if (
  ['init', 'start', 'fazendo_pedido', 'valid'].includes(state) &&
  pedidos.some(p => userMsg.includes(p))
) {
  userData[userId].pedido.push(userMsg);
  userData[userId].state = 'confirmar_pedido';
  return ctx.reply(`"${userMsg}" adicionado ao seu pedido. Deseja confirmar ou adicionar mais algo?`);
}

// Adicionar item na etapa de confirmação
if (state === 'confirmar_pedido' && pedidos.some(item => userMsg.includes(item))) {
  userData[userId].pedido.push(userMsg);
  return ctx.reply(`"${userMsg}" adicionado ao seu pedido. Deseja confirmar ou adicionar mais algo?`);
}

// Confirmar ou adicionar mais na etapa de confirmação
if (state === 'confirmar_pedido') {
  if (userMsg.includes('mais')) {
    userData[userId].state = 'fazendo_pedido';
    return ctx.reply('Pode dizer o que mais você deseja.');
  }

  if (confirmarPedido.some(p => userMsg.includes(p)) || userMsg.includes('sim')) {
    userData[userId].state = 'pedido_confirmado';
    return ctx.reply(`Pedido confirmado: ${userData[userId].pedido.join(', ')}. Obrigado!`);
  }

  return ctx.reply('Não entendi. Você quer adicionar mais algo ou confirmar o pedido?');
}

// Resposta padrão — só deve cair aqui se nada mais funcionar
return ctx.reply('Desculpe, não entendi. Você pode dizer "ver pedido", "remover item", "confirmar" ou "encerrar".');
});

bot.launch();
console.log('Bot bar do link iniciado...');