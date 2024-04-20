require("dotenv").config();
const axios = require("axios");
const { Telegraf } = require("telegraf");
const { message } = require("telegraf/filters");
const { consultas, agendamento, greetings, verConsultas, confirmar } = require("./intents");
const { parse, format, addDays, addWeeks, addYears, isValid } = require('date-fns');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Objeto para armazenar dados do usuário
const userData = {};

const parseDateInput = (input) => {
  // Expressões para identificar diferentes tipos de datas
  const relativeDayPattern = /^daqui (\d+) dias?$/;
  const relativeWeekPattern = /^daqui (\d+) semanas?$/;
  const relativeYearPattern = /^daqui (\d+) anos?$/;

  // Verificar se é uma data relativa (daqui X dias, semanas ou anos)
  let match = input.match(relativeDayPattern);
  if (match) {
      const days = parseInt(match[1], 10);
      return addDays(new Date(), days);
  }

  match = input.match(relativeWeekPattern);
  if (match) {
      const weeks = parseInt(match[1], 10);
      return addWeeks(new Date(), weeks);
  }

  match = input.match(relativeYearPattern);
  if (match) {
      const years = parseInt(match[1], 10);
      return addYears(new Date(), years);
  }

  // Tentar analisar a data como uma data específica no formato brasileiro
  const date = parse(input, 'dd/MM/yyyy', new Date());

  // Verificar se a data é válida
  if (isValid(date)) {
      return date;
  }

  // Se nenhuma expressão for reconhecida, retorne null
  return null;
};

// Função para verificar se um número de telefone é válido
const isUser = async (phone) => {
    try {
        const response = await axios.get(`https://sheetdb.io/api/v1/paxkr380uxtlv/search?sheet=users&phone=*${phone}*`);
        const userDetails = response.data;
        return userDetails.length > 0 ? userDetails[0] : null;
    } catch (error) {
        console.error('Erro ao consultar a API:', error);
        return null;
    }
};

// Função para iniciar a conversa com mensagens como "oi", "ola", ou "oi tudo bem"
bot.on(message('text'), async (ctx) => {
    const userId = ctx.from.id;
    const userMsg = ctx.message.text.toLowerCase();

    // Inicializar dados do usuário caso ainda não existam
    if (!userData[userId]) {
        userData[userId] = {
            state: 'start',
            phone: '',
            name: ctx.from.first_name,
            doctor: '',
            date: '',
            service: ''
        };
    }

    const { state } = userData[userId];

    // Verifica se a mensagem é um cumprimento para iniciar a conversa
    if (greetings?.includes(userMsg)) {
        userData[userId].state = 'start';
        ctx.reply(`Olá ${ctx.from.first_name}, seja bem-vindo à Clínica Viver Bem! Por favor, me informe seu número de telefone.`);
        return;
    }

    // Verifica se o usuário está respondendo a uma solicitação de cadastro
    if (state === 'cadastro') {
        if (userMsg === 'sim') {
            // Lógica para iniciar o processo de cadastro
            const { phone, name } = userData[userId];
            try {
                await axios.post(
                    'https://sheetdb.io/api/v1/paxkr380uxtlv?sheet=users',
                    {
                        phone: phone,
                        name: name,
                        created: new Date().toISOString()
                    }
                );
                ctx.reply('Cadastro realizado com sucesso! Informe a especialidade que deseja marcar a consulta');
                userData[userId].state = 'valid';
            } catch (error) {
                console.error('Erro ao enviar dados de cadastro:', error);
                ctx.reply('Ocorreu um erro ao tentar realizar o cadastro. Por favor, tente novamente mais tarde.');
            }
        } else if (userMsg === 'não' || userMsg === 'nao') {
            ctx.reply('Ok, o cadastro foi cancelado. Por favor, informe novamente seu número de telefone.');
            userData[userId].state = 'start';
        } else {
            ctx.reply('Por favor, responda com "sim" ou "não".');
        }
        return;
    }

    // Lógica para verificar se o número de telefone é válido
    if (state === 'start') {
        const userDetails = await isUser(userMsg);
        if (userDetails) {
            userData[userId].phone = userMsg;
            userData[userId].name = userDetails.name;
            ctx.reply(`Olá ${userDetails.name}! Deseja marcar uma nova consulta ou ver as consultas já marcadas?`);
            userData[userId].state = 'valid';
        } else {
            userData[userId].phone = userMsg;
            ctx.reply('Número de telefone não encontrado. Gostaria de se cadastrar? Responda com "sim" ou "não".');
            userData[userId].state = 'cadastro';
        }
        return;
    }

    if (state === 'valid') {
        if (consultas?.includes(userMsg)) {
            ctx.reply('Qual especialidade deseja marcar?');
            userData[userId].state = 'selecionar';
        } else if (verConsultas?.includes(userMsg)) {
            try {
                const { phone } = userData[userId];
                const res = await axios.get(`https://sheetdb.io/api/v1/paxkr380uxtlv/search?sheet=consultas&phone=*${phone}*`);
                const consult = res.data;

                if (consult && consult.length > 0) {
                    consult.forEach(con => ctx.reply(`Consulta marcada no dia ${format(con.date, 'dd/MM/yyyy')} com ${con.doctor} especialista em ${con.services}.`));
                } else {
                    ctx.reply('Nenhuma consulta marcada, deseja marcar uma nova?');
                }
            } catch (error) {
                console.error('Erro ao consultar as consultas:', error);
            }
        }
    }

    if (state === 'selecionar') {
        try {
            const res = await axios.get(`https://sheetdb.io/api/v1/paxkr380uxtlv/search?services=*${userMsg}*`);
            const doctor = res.data[0];
            
            if (doctor) {
                userData[userId].doctor = doctor.name;
                ctx.reply(`Nessa especialidade temos o doutor ${doctor.name}, quando deseja agendar a consulta?`);
                userData[userId].service = userMsg;
                userData[userId].state = 'data';
            } else {
                ctx.reply('Especialidade não encontrada. Por favor, tente novamente.');
            }
        } catch (error) {
            console.error('Erro ao consultar os médicos:', error);
        }
    }

    if (state === 'data') {
      const date = parseDateInput(userMsg);
        if (date) {
            // Armazenar a data no objeto do usuário
            userData[userId].date = date;
            ctx.reply(`Deseja confirmar a consulta no dia: ${format(date, 'dd/MM/yyyy')} com o doutor ${userData[userId].doctor}`);
            // Você pode mudar o estado do usuário para outro passo do processo, por exemplo
            userData[userId].state = 'confirmar';
            
        } else {
            ctx.reply('Data não reconhecida. Por favor, insira uma data no formato "dd/MM/yyyy" ou uma expressão como "daqui 20 dias".');
        }
    }


    if (state === 'confirmar') {

      if(confirmar && confirmar.includes(userMsg)){
        const { phone } = userData[userId];
        try {
          await axios.post(
            'https://sheetdb.io/api/v1/paxkr380uxtlv?sheet=consultas',
            {
                doctor: userData[userId].doctor,
                phone: phone,
                patient: userData[userId].name,
                date: userData[userId].date,
                services: userData[userId].service,
                created: new Date().toISOString()
            }
        );
        userData[userId].state = 'valid';
          ctx.reply('Consulta marcada, até mais, qualquer duvida estou à disposição!');
        } catch (error) {
          console.log(error);
        }
        
      }
    }
});

bot.launch();
console.log("Bot launched...");
