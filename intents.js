//array inicial
const greetings = [
  'oi', 
  'ola', 
  'oi tudo bem',
  'bom dia',
  'boa tarde',
  'boa noite',
  'Oi, bom dia',
  'Oi, boa tarde',
  'Oi, boa noite',
  'Oi!',
  'Oi.',
  'Oi, tudo bem?',
  'marcar',
];

//desejea cadastrar => sim / registrar
const registrar = [
  'register',
  'novo usuario',
  'registro',
  'quero registrar',
  'registrar',
  'sim',
  'reg',
];

//deseja cadastrar => nao / cancelar registro
const naoRegistrar = [
  'nao register',
  'não novo usuario',
  'n',
  'não',
  'nem',
  'nãooo',
  'cancelar',
  'encerrar',
  'não registrar',
  'nao',
];


//marcar consulta
const consultas = [
  'nova',
  'marca',
  'marcar uma nova',
  'nova consulta',
  'agendar consulta',
  'agendar',
  'consulta',
  'marcar consulta',
  'consultar',
  'marcar',
  'sim',
  'marcar uma nova consulta',
  's',
  'quero',
  'quer',
  'claro',
];


//ver consulta
const verConsultas = [
  'ver',
  'consultas',
  'minhas consultas',
  'consulta',
  'consult',
  'agendadas',
  'ver minhas consultas',
  'quero ver',
  'mostrar',
  'ver consulta',
  'marcada',
];


//confirmar a consulta => sim
const confirmar = [
  'confirmar',
  'sim',
  'marcar',
  'agendar',
  'sim, confirmar',
  'marcar consulta',
  'sim, marcar',
  'agendar consulta',
  'marcar uma nova consulta'
]

//confirmar a consulta => nao
const naoMarcar = [
  'nao',
  'não',
  'n',
  'não',
  'nem',
  'nãooo',
  'cancelar',
  'encerrar',
  'não registrar',
  'nao',
]

// Exporte as listas para uso em outros arquivos usando CommonJS
module.exports = {
  registrar,
  naoRegistrar,
  consultas,
  greetings,
  verConsultas,
  confirmar, 
  naoMarcar
};
