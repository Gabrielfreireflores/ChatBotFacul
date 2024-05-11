require("dotenv").config();
const axios = require("axios");
const { Telegraf } = require("telegraf");
const { message } = require("telegraf/filters");
const { consultas, naoRegistrar, registrar, greetings, verConsultas, confirmar, naoMarcar, listarEspecialidades, encerrar } = require("./intents");
const { parse, format, addDays, addWeeks, addYears, isValid } = require('date-fns');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Objeto para armazenar dados do usuário
const userData = {};

const parseDateInput = (input) => {
    // Expressões para identificar diferentes tipos de datas
    const relativeDayPattern = /^daqui (\d+) dias?$/;
    const relativeWeekPattern = /^daqui (\d+) semanas?$/;
    const relativeYearPattern = /^daqui (\d+) anos?$/;
    const brazilianDatePattern = /^(\d{2})\/(\d{2})$/;
    const tomorrowPattern = /^(amanhã|aman|amanhã|hoje|hoj)$/;

    // Verificar se é uma data relativa (daqui X dias, semanas, anos ou amanhã)
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

    // Verificar se é uma data no formato brasileiro
    match = input.match(brazilianDatePattern);
    if (match) {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        const currentYear = new Date().getFullYear();
        const inputDate = new Date(currentYear, month - 1, day);
        const today = new Date();
        if (!isNaN(inputDate.getDate()) && (inputDate.getMonth() + 1 === month)) {
            if (inputDate < today) {
                // Se a data já passou, marcar para o próximo ano
                const nextYearDate = new Date();
                nextYearDate.setFullYear(nextYearDate.getFullYear() + 1);
                return new Date(nextYearDate.getFullYear(), month - 1, day);
            }
            return inputDate;
        }
    }

    // Verificar se é "amanhã", "hoje" ou "amanhã"
    match = input.match(tomorrowPattern);
    if (match) {
        const today = new Date();
        if (match[0] === 'hoje' || match[0] === 'hoj') {
            return today;
        }
        return addDays(today, 1); // Retorna a data de amanhã
    }

    // Se nenhuma expressão for reconhecida, retorne null
    return null;
};



const isPhone = (userPhone) => {
    const regexTelefone = /^\(\d{2}\)\d{9}$/;
    return regexTelefone.test(userPhone)
}

// Função para verificar se um número de telefone é válido
const isUser = async (phone) => {
    try {
        const response = await axios.get(`https://sheetdb.io/api/v1/q32y963577067/search?sheet=users&phone=*${phone}*`);
        const userDetails = response.data;
        return userDetails.length > 0 ? userDetails[0] : null;
    } catch (error) {
        console.error('Erro ao consultar a API:', error);
        return null;
    }
};

// Função para iniciar a conversa com mensagens como "oi", "ola", ou "oi tudo bem"
bot.on(message(), async (ctx) => {
    const userId = ctx.from.id;
    const userMsg = ctx.message.text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Inicializar dados do usuário caso ainda não existam
    if (!userData[userId]) {
        userData[userId] = {
            state: 'init',
            phone: '',
            name: ctx.from.first_name,
            doctor: '',
            date: '',
            service: ''
        };
    }

    const { state } = userData[userId];

    // Verifica se a mensagem é um cumprimento para iniciar a conversa
    if (userData[userId].state === 'init') {
        userData[userId].state = 'start';
        ctx.reply(`Olá ${ctx.from.first_name}, seja bem-vindo à Clínica Viva Bem! Por favor, me informe seu número de telefone com o DDD no formato (XX)XXXXXXXXX.`);
        return;
    }

    if (encerrar.includes(userMsg)) {
        userData[userId].state = 'init';
        ctx.reply(`Muito obrigado, precisando de ajuda, estamos a disposição`);
        return;
    }
    

    // Lógica para verificar se o número de telefone é válido
    if (state === 'start') {

        if(!isPhone(userMsg)){
            ctx.reply('Numero de telefone inválido, digite novamente por favor, no formato (XX)XXXXXXXXX');
            return;
        }

        else {
            const userDetails = await isUser(userMsg);
            userData[userId].phone = userMsg;
            
            if (userDetails) {     
                userData[userId].name = userDetails.name;
                ctx.reply(`Deseja marcar uma nova consulta ou ver as consultas já marcadas?`);
                userData[userId].state = 'valid';
            } 
            else {
                userData[userId].phone = userMsg;
                ctx.reply('Número de telefone não cadastrado. Gostaria de se cadastrar?');
                userData[userId].state = 'cadastro';
            }
        return;
        }
        
    }

    // Verifica se o usuário está respondendo a uma solicitação de cadastro
    if (state === 'cadastro') {
        if (registrar.includes(userMsg)) {
            // Lógica para iniciar o processo de cadastro
            const { phone, name } = userData[userId];
            try {
                await axios.post(
                    'https://sheetdb.io/api/v1/q32y963577067?sheet=users',
                    {
                        phone: phone,
                        name: name,
                        created: new Date().toISOString()
                    }
                );
                ctx.reply('Cadastro realizado com sucesso! Deseja marcar uma nova consulta?');
                userData[userId].state = 'valid';
            } catch (error) {
                console.error('Erro ao enviar dados de cadastro:', error);
                ctx.reply('Ocorreu um erro ao tentar realizar o cadastro. Por favor, tente novamente mais tarde.');
            }
        } else if (naoRegistrar.includes(userMsg)) {
            ctx.reply('Ok, o cadastro foi cancelado. Por favor, informe novamente seu número de telefone.');
            userData[userId].state = 'start';
        } else {
            ctx.reply('Por favor, responda com "sim" ou "não".');
        }
        return;
    }

    if (state === 'valid') {
        if (consultas?.includes(userMsg)) {
          ctx.reply(`Qual especialidade deseja marcar? \nAs opções são: \n- Cardiologia \n- Ortopedia \n- Plástica \n- Clínica geral \n- Neurologia \n- Osteopatia \n- Urologia`);
           
        userData[userId].state = 'selecionar';
        } 
        else if (verConsultas?.includes(userMsg)) {
            try {
                const { phone } = userData[userId];
                const res = await axios.get(`https://sheetdb.io/api/v1/q32y963577067/search?sheet=consultas&phone=*${phone}*`);
                const consult = res.data;

                if (consult && consult.length > 0) {

                   try{
                    consult?.forEach((con, index) => {
                        ctx.reply(`Consulta marcada no dia ${format(con.date, 'dd/MM/yy')} com ${con.doctor} especialista em ${con.services}.`)
                        });   
                   }
                   finally {
                        ctx.reply("Deseja marcar uma nova ou encerrar a conversa?"); 
                   }        
                       
                    userData[userId].state = 'valid';  
                          
                } else {
                    ctx.reply('Nenhuma consulta marcada, deseja marcar uma nova?');
                }
            } catch (error) {
                console.error('Erro ao consultar as consultas:', error);
            }
        }
        else if (naoMarcar) {
            ctx.reply('Só consigo te ajudar a marcar e ver consultas, deseja marcar, ver suas consultas ou encerrar a conversa? \nEm caso de cancelamento ou outros problemas faça contato conosco no telefone (16)99291-2781')
            userData[userId].state = 'valid';
        }
    }

    if (state === 'selecionar') {
        try {
            const res = await axios.get(`https://sheetdb.io/api/v1/q32y963577067/search?services=*${userMsg}*`);
            const doctor = res.data[0];
            
            if (doctor) {
                userData[userId].doctor = doctor.name;
                ctx.reply(`Nessa especialidade temos a doutora ${doctor.name}, quando deseja agendar a consulta? Informe a data no formato dd/MM`);
                userData[userId].service = userMsg;
                userData[userId].state = 'data';
            } else {
                ctx.reply('Para marcar a consulta, me informe somente a especialidade que deseja, exemplo: "Cardiologia');
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
            ctx.reply(`Deseja confirmar a consulta no dia: ${format(date, 'dd/MM/yy')} com a doutora ${userData[userId].doctor}`);
            // Você pode mudar o estado do usuário para outro passo do processo, por exemplo
            userData[userId].state = 'confirmar';
            
        } else {
            ctx.reply('Data não reconhecida. Por favor, insira uma data no formato "dd/MM" ou uma expressão como "daqui 20 dias".');
        }
    }


    if (state === 'confirmar') {

      if(confirmar && confirmar.includes(userMsg)){
        const { phone } = userData[userId];
        try {
          await axios.post(
            'https://sheetdb.io/api/v1/q32y963577067?sheet=consultas',
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
          ctx.reply(`Consulta marcada, deseja ver suas consultas ou encerrar a conversa?`);
        } catch (error) {
          console.log(error);
        }
        
      }

      else if( naoMarcar.includes(userMsg)){
        ctx.reply('Deseja marcar uma outra consulta, ver as consultas marcadas ou encerrar o agendamento?')
        userData[userId].state = 'valid';
      }
      else {
        ctx.reply('Desculpa, não entendi se deseja confirmar ou não a consulta, para facilitar me informe com sim ou não.')
      }
    }
});


bot.launch();
console.log("Bot launched...");
