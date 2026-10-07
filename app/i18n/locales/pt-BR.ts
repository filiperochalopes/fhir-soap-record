const ptBR = {
  appShell: {
    footerDevelopedBy: "Desenvolvido por",
    footerDocs: "Docs",
    footerGithub: "Github",
    hidePersonalData: "Ocultar dados pessoais do paciente",
    logout: "Sair",
    navAgenda: "Agenda",
    navPatients: "Pacientes",
    settings: "Configurações",
    showPersonalData: "Exibir dados pessoais do paciente",
    tagline: "Prontuário inspirado em openEHR com interoperabilidade FHIR",
    userLine: "{{name}} · CRM {{crm}}/{{crmUf}}",
  },
  clinicalHistory: {
    empty: "Nenhum registro clínico anterior para este paciente.",
    kindNarrative: "Narrativa",
    kindSoap: "SOAP",
    title: "Registros anteriores ({{count}})",
  },
  clinicalSummary: {
    badge_one: "{{count}} registro SOAP",
    badge_other: "{{count}} registros SOAP",
    description:
      "Construído a partir de todos os registros SOAP anteriores, priorizando problemas e condições derivados da avaliação.",
    empty: "Ainda não há registros SOAP anteriores para gerar o resumo.",
    label: "Resumo com IA",
    loading: "Carregando resumo IPS com IA...",
    title: "Visão clínica no estilo IPS",
  },
  login: {
    accessToken: "Token de acesso",
    eyebrow: "soap-ehr · laboratório de padrões clínicos",
    heading: "Um registro clínico, padrões complementares de dados em saúde.",
    intro:
      "Composições canônicas inspiradas em openEHR sustentam o fluxo clínico, o FHIR expõe as APIs de interoperabilidade e o OMOP CDM é a projeção analítica derivada.",
    submit: "Entrar",
    tokenHelp: "O mesmo token vale para o app web e para chamadas de API com Bearer.",
    tokenNotRecognized: "Token não reconhecido ou inativo.",
    tokenPlaceholder: "Cole o token gerado pela CLI",
    tokenRequired: "O token é obrigatório",
    signIn: "Entre com seu token",
  },
};

export default ptBR;
