# Requisitos para Certificação de Sistemas de Registro Eletrônico em Saúde
## Categoria: Segurança da Informação — Versão 5.2 (10/11/2021)

> **Fonte:** SBIS — Sociedade Brasileira de Informática em Saúde  
> **Editor:** Luiz Aparecido Virginio Junior

---

## 1. Introdução

Este documento apresenta o conjunto de requisitos técnicos de Segurança da Informação proposto pela Sociedade Brasileira de Informática em Saúde (SBIS) para o Manual de Certificação de Sistemas de Registro Eletrônico em Saúde (S-RES) específico para sistemas que não se enquadram nas demais categorias e modalidades publicadas pela SBIS.

Vale ressaltar que, para a categoria Segurança da Informação, o conjunto de requisitos NGS2 é **opcional**.

---

## 2. Estágios de Maturidade

| Recurso | Estágio 1 | Estágio 2 | Estágio 3 |
|---------|:---------:|:---------:|:---------:|
| Requisitos mínimos para aderência à legislação | ✓ | ✓ | ✓ |
| Segurança da informação | Essencial | Intermediária | Avançada |
| Aderência à ICP-Brasil para eliminação de papel (NGS2) | ✓ | ✓ | ✓ |
| Requisitos avançados para assinaturas digitais (NGS2) | — | ✓ | ✓ |

---

## 3. Requisitos de Conformidade

Para obter o Certificado SBIS, o sistema deverá atender à **totalidade dos requisitos de NGS1** e, caso pretendido, NGS2 aplicáveis à categoria e estágio de maturidade.

**Legenda de colunas:**
- **ID:** Sigla-do-conjunto.Número-do-grupo-temático.Número-do-requisito (ex.: NGS1.01.01)
- **Estágio 1/2/3:** ✓ = aplicável | — = não aplicável

---

## 3.1 Requisitos do Nível de Garantia de Segurança 1 (NGS1)

### NGS1.01 — Controle de versão do software

| ID | Título | Requisito | E1 | E2 | E3 |
|----|--------|-----------|:--:|:--:|:--:|
| **NGS1.01.01** | Versão do software | a) O S-RES deve apresentar as informações de identificação do software (nome, fornecedor, versão/release/build). b) Essas informações devem estar disponíveis: na tela inicial; nas telas de cada módulo (cabeçalho/rodapé/menu); nas impressões (última página); no arquivo de exportação da trilha de auditoria. | ✓ | ✓ | ✓ |

---

### NGS1.02 — Identificação e autenticação de pessoas

| ID | Título | Requisito | E1 | E2 | E3 |
|----|--------|-----------|:--:|:--:|:--:|
| **NGS1.02.01** | Método de autenticação de pessoa | a) Todo usuário deve ser identificado e autenticado antes de qualquer acesso. b) Utilizar ao menos um dos métodos: digitação de usuário/senha; certificado digital + PIN; validação biométrica + PIN. c) Credenciais validadas no lado servidor. d) Em app móvel off-line, autenticação no servidor na sincronização. | ✓ | ✓ | ✓ |
| **NGS1.02.02** | Proteção dos parâmetros de autenticação | Senha: armazenada com hash aberto ≥ 160 bits; protegida contra acesso não autorizado. Biometria: templates protegidos; amostras em trânsito protegidas; usar biometria do SO em mobile. OTP: sementes protegidas. | ✓ | ✓ | ✓ |
| **NGS1.02.03** | Qualidade da senha | *(Condição: autenticação por usuário/senha)* Exigir: ≥ 8 caracteres; ≥ 1 alfabético; ≥ 1 numérico. | ✓ | ✓ | ✓ |
| **NGS1.02.04** | Impedimento de senhas com dados de identificação | *(Condição: autenticação por usuário/senha)* Impedir senhas com nome ou data de nascimento do usuário. | — | ✓ | ✓ |
| **NGS1.02.05** | Parametrização da qualidade da senha | *(Condição: autenticação por usuário/senha)* Permitir configurar: qtd mínima de caracteres; exigir alfabético; exigir numérico; exigir especial; exigir minúscula; exigir maiúscula. | — | — | ✓ |
| **NGS1.02.06** | Geração de senha pelo administrador | *(Condições variadas por modalidade)* a) Permitir geração de senha por administrador. b) Manual ou automática. c) Forçar troca na definição manual. d) Troca imediata; nenhuma ação permitida até trocar. | ✓ | ✓ | ✓ |
| **NGS1.02.07** | Geração automática de senha | *(Condições variadas)* a) Geração automática pelo sistema. b) Geração aleatória (sem senha padrão). c) Envio automático por canal do cadastro do usuário. | — | ✓ | ✓ |
| **NGS1.02.08** | Troca de senha pelo usuário | *(Condição: autenticação por usuário/senha)* Permitir que o usuário troque sua senha respeitando as regras de qualidade. | ✓ | ✓ | ✓ |
| **NGS1.02.09** | Troca forçada de senha | *(Condições variadas)* a) Usuário autorizado pode configurar troca forçada de senha no próximo login. b) Nenhuma ação permitida até trocar. | — | ✓ | ✓ |
| **NGS1.02.10** | Periodicidade de troca de senhas | *(Condições variadas)* a) Permitir parametrização de período máximo de expiração de senha. b) Período configurável. c) Controle realizado no servidor. d) Contado a partir da última troca. | — | ✓ | ✓ |
| **NGS1.02.11** | Igualdade de senhas | *(Condição: autenticação por usuário/senha)* Nova senha deve ser diferente da atual e da imediatamente anterior. | ✓ | ✓ | ✓ |
| **NGS1.02.12** | Obtenção de nova senha | *(Condição: autenticação por usuário/senha)* a) Tela de login deve oferecer "esqueci a senha". b) Gerar nova senha ou enviar instruções. c) Via canal registrado no cadastro (SMS/e-mail). | ✓ | ✓ | ✓ |
| **NGS1.02.13** | Controle de tentativas de login | a) Bloquear acesso após número máximo configurável (≤ 10) de tentativas consecutivas inválidas. b) Após bloqueio, só liberar por desbloqueio do administrador ou método seguro. | ✓ | ✓ | ✓ |
| **NGS1.02.14** | Autenticação para operações críticas | a) Solicitar nova autenticação para operações críticas configuráveis. b) Minimamente para: troca de senha; vínculo de usuário com certificado digital; gestão de perfis/usuários. | — | — | ✓ |
| **NGS1.02.15** | Informações na autenticação | Após autenticação bem-sucedida, exibir: data/hora da última autenticação com sucesso; data/hora das tentativas sem sucesso posteriores à última. | — | ✓ | ✓ |
| **NGS1.02.16** | Informações em autenticação inválida | Mensagem de erro não deve informar o motivo da falha (ex.: "dados de autenticação incorretos", sem indicar se é o usuário ou a senha). | ✓ | ✓ | ✓ |
| **NGS1.02.17** | Revelação de credenciais na interface | a) Impedir memorização/visualização de dados anteriores na interface de login. b) Digitação de senhas por máscara de caracteres. | ✓ | ✓ | ✓ |
| **NGS1.02.18** | Autenticação de dois fatores | a) Oferecer ao menos dois métodos de autenticação. b) Permitir parametrizar o método, incluindo uso simultâneo (2FA). OTP pode ser segundo fator. | — | — | ✓ |
| **NGS1.02.19** | Uso de SALT para a senha | *(Condição: autenticação por usuário/senha)* a) Utilizar SALT na codificação de senhas. b) Gerar novo SALT para cada senha. | — | ✓ | ✓ |
| **NGS1.02.20** | Bloqueio ou encerramento por inatividade | a) Sessão bloqueada/encerrada automaticamente após período de inatividade. b) Período configurável, armazenado no banco. c) Desbloqueio apenas pelo mesmo usuário com nova autenticação; outro usuário pode encerrar sem reativar. d) Informações em tela não visíveis após bloqueio. e) Não deve ser possível desativar esses controles. | ✓ | ✓ | ✓ |
| **NGS1.02.21** | Bloqueio por inatividade (sem encerramento) | Sessão bloqueada (sem encerrar): ao relogar, usuário retorna à mesma tela sem perda de dados. | — | ✓ | ✓ |
| **NGS1.02.22** | Aviso de bloqueio ou encerramento de sessão | a) Avisar o usuário com antecedência sobre o encerramento/bloqueio. b) Período de aviso configurável. | — | ✓ | ✓ |
| **NGS1.02.23** | Segurança contra roubo de sessão | a) Controles contra roubo/reuso de sessão. b) Credenciais não transmitidas em texto claro. c) Controles contra replay e covert-channel. d) Não desativável por nenhum usuário. | ✓ | ✓ | ✓ |

---

### NGS1.03 — Autorização e controle de acesso

| ID | Título | Requisito | E1 | E2 | E3 |
|----|--------|-----------|:--:|:--:|:--:|
| **NGS1.03.01** | Impedir acesso por pessoas não autorizadas | Todo acesso deve ser realizado apenas por usuários previamente autorizados, por meio de permissões atribuídas a perfis de usuário. | ✓ | ✓ | ✓ |
| **NGS1.03.02** | Perfis mínimos de usuário | Disponibilizar minimamente três perfis: administrador do sistema; profissional administrativo (sem acesso a dados clínicos); profissional de saúde. | ✓ | ✓ | ✓ |
| **NGS1.03.07** | Atribuição de mais de um perfil para um usuário | a) Permitir que mais de um perfil seja atribuído a um usuário. b) Implicar em escolha de perfil no login ou acúmulo de permissões. | ✓ | ✓ | ✓ |
| **NGS1.03.08** | Gerenciamento de usuários | Permitir gerenciamento (cadastro, ativação/inativação, alteração) de usuários pela aplicação. | ✓ | ✓ | ✓ |
| **NGS1.03.09** | Identidade única da pessoa e responsabilização | a) Identidade única por usuário. b) Vínculo a documento único (ex.: CPF). Alteração exige justificativa. c) Unicidade de CPF no sistema. d) Não permitir exclusão de usuário que tenha realizado operações. e) Em SaaS, unicidade por organização. | ✓ | ✓ | ✓ |
| **NGS1.03.10** | Usuário mínimo ativo | Garantir ao menos um usuário ativo com perfil de administrador (ex.: administrador fixo não inativável). | ✓ | ✓ | ✓ |

---

### NGS1.04 — Disponibilidade do RES

| ID | Título | Requisito | E1 | E2 | E3 |
|----|--------|-----------|:--:|:--:|:--:|
| **NGS1.04.01** | Geração de cópia de segurança | a) Gerar backup full pela aplicação ou SGBD com informações suficientes para restauração. b) Exportar atributos de segurança e metadados junto com os dados. | ✓ | ✓ | ✓ |
| **NGS1.04.03** | Sigilo da cópia de segurança | Garantir sigilo das cópias de segurança (ex.: encriptação automática). | ✓ | ✓ | ✓ |
| **NGS1.04.04** | Restauração de cópia de segurança | a) Permitir restauração. b) Atributos de segurança e metadados recuperados automaticamente. | ✓ | ✓ | ✓ |
| **NGS1.04.05** | Integridade na restauração | a) Controle de integridade da cópia. b) Verificação na restauração com alerta em falha; em caso de erro, rollback total. | ✓ | ✓ | ✓ |
| **NGS1.04.06** | Alerta de limiar de ocupação | *(Condição: sem espaço dinâmico)* a) Gerenciar espaço com configuração de limiar. b) Notificar administrador ao atingir o limiar. | ✓ | ✓ | ✓ |

---

### NGS1.05 — Comunicação entre componentes do S-RES

| ID | Título | Requisito | E1 | E2 | E3 |
|----|--------|-----------|:--:|:--:|:--:|
| **NGS1.05.01** | Segurança da comunicação com componente de interação com o usuário | a) Comunicação entre cliente e servidor com: autenticação do servidor, integridade e confidencialidade. b) Criptografia em trânsito (ex.: HTTPS). | ✓ | ✓ | ✓ |
| **NGS1.05.02** | Processamento de dados no lado servidor | *(Condição: S-RES em arquitetura Web)* a) Todo processamento de dados de RES no servidor. b) Toda validação de dados no servidor. Validação no cliente é opcional/complementar. | ✓ | ✓ | ✓ |
| **NGS1.05.03** | Segurança da comunicação entre componentes | *(Condição: componentes distribuídos)* Comunicação entre componentes com: autenticação mútua, integridade e confidencialidade. | ✓ | ✓ | ✓ |
| **NGS1.05.04** | Integridade e origem de componentes dinâmicos | *(Condição: componentes que exigem download)* Controle de integridade e verificação de origem (ex.: assinatura digital). | ✓ | ✓ | ✓ |

---

### NGS1.06 — Segurança de dados

| ID | Título | Requisito | E1 | E2 | E3 |
|----|--------|-----------|:--:|:--:|:--:|
| **NGS1.06.01** | Utilização de SGBD | a) Todos os dados de RES armazenados em SGBD com sigilo. b) Arquivos anexados podem estar em diretórios, desde que acessíveis apenas pelo S-RES; nomes de arquivos/diretórios sem informações identificadoras. | ✓ | ✓ | ✓ |
| **NGS1.06.02** | Segurança de componentes que manipulam dados do RES | Arquivos temporários gerados fora do SGBD devem ser excluídos após a operação (ex.: PDF em cache, XML, DICOM). | — | — | ✓ |
| **NGS1.06.03** | Validação de dados de entrada | Dados inseridos pelo usuário devem ser validados para prevenir buffer overflow e injeção de dados. | ✓ | ✓ | ✓ |
| **NGS1.06.04** | Segregação dos dados por organização | *(Condição: SaaS)* Dados de RES segregados por organização; sem acesso cruzado entre organizações sem consentimento do paciente. | ✓ | ✓ | ✓ |
| **NGS1.06.05** | Criptografia de documentos exportados | Permitir criptografia de documentos exportados com dados de saúde identificados para portabilidade (mídia/e-mail/webservice). | — | ✓ | ✓ |

---

### NGS1.07 — Auditoria

| ID | Título | Requisito | E1 | E2 | E3 |
|----|--------|-----------|:--:|:--:|:--:|
| **NGS1.07.01** | Auditoria contínua | Gerar registros de auditoria de forma contínua e permanente, sem possibilidade de desativação. | ✓ | ✓ | ✓ |
| **NGS1.07.02** | Proteção dos registros de auditoria | a) Registros protegidos contra acesso não autorizado e alteração. b) Acesso apenas para auditor ou, na ausência, administrador. | ✓ | ✓ | ✓ |
| **NGS1.07.03** | Eventos registrados na trilha de auditoria | Registrar minimamente: **RES:** criação/duplicação/consulta/inativação de registros; importação/exportação; impressão; acesso de emergência a prontuário; termos de consentimento; regras de apoio à decisão. **Ações de usuário:** tentativas de autenticação (com/sem sucesso); troca de senha; assinatura/validação digital; falha em assinatura; solicitação de esquecimento. **Ações operacionais:** gerenciamento de usuários/perfis; cópia/restauração de segurança. | ✓ | ✓ | ✓ |
| **NGS1.07.04** | Eventos avançados na trilha de auditoria | Registrar adicionalmente: **RES:** validação de registros de preceptoria. **Ações de usuário:** encerramento/bloqueio de sessão; desbloqueio de sessão; aceitação de termo de concordância. **Operacionais:** configurações do sistema; geração de senha; acesso aos registros de auditoria; erros de processos operacionais; indisponibilidade de comunicação para verificação de revogação de certificado. | — | — | ✓ |
| **NGS1.07.05** | Informações do registro de auditoria | Cada registro deve conter minimamente: ID único do registro; data/hora do evento; tipo de evento; identificação do componente gerador (IP/MAC); identificação do usuário; identificador único do registro afetado; informações complementares. | ✓ | ✓ | ✓ |
| **NGS1.07.06** | Privacidade do paciente na trilha de auditoria | Dados clínicos ou de identificação do paciente não devem ser registrados na trilha. | ✓ | ✓ | ✓ |
| **NGS1.07.07** | Visualização dos registros da trilha | a) Interface na aplicação para visualização em ordem cronológica. b) Todos os registros passíveis de visualização. c) Filtragem por data, evento, identificador único de usuário e identificador único do registro afetado. | ✓ | ✓ | ✓ |
| **NGS1.07.08** | Exportação dos registros da trilha | a) Interface para exportação em formato aberto (CSV, XML, HTML, ODX). b) Funcionalidade de filtragem na exportação. c) Arquivo exportado inclui identificação do software e instituição (nome, CNES, CNPJ). | — | — | ✓ |

---

### NGS1.08 — Documentação

| ID | Título | Requisito | E1 | E2 | E3 |
|----|--------|-----------|:--:|:--:|:--:|
| **NGS1.08.01** | Tópicos dos manuais | a) Manuais com: instruções de uso por perfil; visão geral; instalação e configuração; componentes complementares; configuração segura; limitações/restrições; compatibilidade com versões anteriores. b) Separados em: instalação, operação, administração, recomendações de segurança. | ✓ | ✓ | ✓ |
| **NGS1.08.02** | Referência à versão do software na documentação | Todos os manuais devem indicar seu versionamento documental e a versão do S-RES a que se referem. | ✓ | ✓ | ✓ |
| **NGS1.08.03** | Operações de backup | *(Condição: backup pelo fornecedor ou estabelecimento)* Manual deve informar: configuração de usuário de backup; configuração do SGBD para backup exclusivo; cautelas sobre outros usuários com permissão; procedimento ou link do SGBD quando não houver interface na aplicação. | ✓ | ✓ | ✓ |
| **NGS1.08.04** | Restrição de acesso a entidades não autenticadas | Manual de instalação deve informar como configurar SGBD e componentes para impedir acesso não autorizado. | ✓ | ✓ | ✓ |
| **NGS1.08.05** | Configuração da segurança da comunicação entre componentes | *(Condição: componentes distribuídos)* Manual deve informar e orientar sobre segurança da comunicação entre componentes. | ✓ | ✓ | ✓ |
| **NGS1.08.06** | Sincronização de relógio | Manual deve informar sobre sincronização de relógio referenciada ao UTC e como configurar. | ✓ | ✓ | ✓ |
| **NGS1.08.07** | Guarda da cópia de segurança | Manual deve informar que backups devem ser guardados em local seguro, físico distinto, com controle de acesso e sigilo. | ✓ | ✓ | ✓ |
| **NGS1.08.08** | Segregação dos componentes | *(Condição: componentes distribuídos)* Manual deve: informar segregação lógica/física; exemplificar arquiteturas; conter diagrama de comunicação com métodos seguros. | ✓ | ✓ | ✓ |
| **NGS1.08.09** | Importação de dados de dispositivos externos de saúde | *(Condição: suporte a importação automática de dispositivos)* Manual deve indicar procedimentos e conter aviso sobre responsabilidade de aferição/calibração ou validação por profissional de saúde. | ✓ | ✓ | ✓ |
| **NGS1.08.10** | Idioma | Todos os manuais devem ter versão em Português do Brasil. | ✓ | ✓ | ✓ |
| **NGS1.08.11** | Recomendações sobre configurações de segurança | Manuais devem conter informações, alertas e recomendações sobre configurações de segurança (ex.: periodicidade de senha, expiração de sessão). | ✓ | ✓ | ✓ |
| **NGS1.08.12** | Histórico de alteração | Gerar e manter documentação com histórico de alterações (release notes): data, modificações, responsável, impacto e restrições de compatibilidade. | ✓ | ✓ | ✓ |

---

### NGS1.09 — Tempo

| ID | Título | Requisito | E1 | E2 | E3 |
|----|--------|-----------|:--:|:--:|:--:|
| **NGS1.09.01** | Fonte temporal | a) Registro de tempo baseado em referência configurável no servidor (não na estação do usuário). b) Sincronismo contínuo via NTP. | ✓ | ✓ | ✓ |
| **NGS1.09.02** | Uniformidade da representação para exportação de tempo | Na exportação de dados do RES, todos os registros de tempo no formato RFC 3339. | ✓ | ✓ | ✓ |
| **NGS1.09.03** | Registro de tempo no banco de dados | Armazenar tempo no BD com referência do servidor incluindo: dia, mês, ano, hora, minuto, segundo (quando aplicável), milissegundo (quando aplicável) e fuso horário (UTC). | ✓ | ✓ | ✓ |
| **NGS1.09.04** | Uniformidade da representação para entrada de tempo | a) Entrada de data: dia > mês > ano. b) Entrada de horário: hora > minutos. | ✓ | ✓ | ✓ |
| **NGS1.09.05** | Uniformidade da representação para exibição de tempo | a) Exibição de data (tela/impressão): dia > mês > ano. b) Exibição de horário: hora > minutos. Opcionalmente: fuso UTC, segundos, milissegundos. | ✓ | ✓ | ✓ |
| **NGS1.09.06** | Time zone e local da instituição de saúde | *(Condição: servidor em localidade diferente dos usuários)* a) Parametrização de time zone da instituição. b) Exibição convertida de acordo com time zone da instituição. | ✓ | ✓ | ✓ |

---

### NGS1.11 — Privacidade

| ID | Título | Requisito | E1 | E2 | E3 |
|----|--------|-----------|:--:|:--:|:--:|
| **NGS1.11.01** | Concordância com termos de uso | a) Exibir termo de concordância de uso e privacidade no primeiro acesso. b) Usuário só prossegue após aceitar explicitamente. c) Repetir a cada alteração nas políticas. | ✓ | ✓ | ✓ |
| **NGS1.11.08** | Contestação do paciente em relação às suas informações | a) Permitir registro de queixas/solicitações do paciente sobre seus dados. b) Permitir que a organização registre discordância ou recusa fundamentada. | — | — | ✓ |
| **NGS1.11.11** | Anonimização | a) Permitir anonimização de pacientes. b) Minimamente: exportação de relatórios clínicos anonimizados; anonimização na base de dados. | — | ✓ | ✓ |
| **NGS1.11.12** | Pseudonimização | a) Permitir pseudonimização de pacientes. b) Minimamente: exportação de relatórios com pseudonimização; pseudonimização na base de dados. | — | — | ✓ |

---

### NGS1.12 — Integridade

| ID | Título | Requisito | E1 | E2 | E3 |
|----|--------|-----------|:--:|:--:|:--:|
| **NGS1.12.01** | Regras para correção de dados já finalizados | *(Condição: S-RES permite alteração de registros clínicos finalizados)* a) Correção apenas pelo próprio autor. b) Correção gera nova versão. c) Correção exige justificativa. d) Versão anterior mantida como inativa. e) Versão atual deve indicar existência de versões anteriores e permitir acesso. | ✓ | ✓ | ✓ |
| **NGS1.12.03** | Inativação de registros clínicos já finalizados | a) Permitir inativação de registros finalizados (prescrições, sinais vitais, diagnósticos, alergias, documentos clínicos). b) Inativação exige justificativa. c) Inativação altera status, registra data/hora e usuário. d) Registros inativados mantidos permanentemente e passíveis de visualização/exportação. e) Status inativo exibido de forma clara e destacada. | ✓ | ✓ | ✓ |

---

## 3.2 Requisitos do Nível de Garantia de Segurança 2 (NGS2) — Opcional

### NGS2.01 — Certificado Digital

| ID | Título | Requisito | E1 | E2 | E3 |
|----|--------|-----------|:--:|:--:|:--:|
| **NGS2.01.01** | Certificado digital ICP-Brasil | Permitir uso de certificados digitais ICP-Brasil para assinatura digital de documentos do prontuário. | ✓ | ✓ | ✓ |
| **NGS2.01.02** | Validação do CPF do usuário | Uso do certificado digital apenas se CPF do cadastro for idêntico ao do certificado; verificado a cada uso. | ✓ | ✓ | ✓ |
| **NGS2.01.03** | Validação do certificado digital antes do uso | a) Validar certificado (criptografia, validade, revogação, cadeia) antes ou imediatamente após uso. b) Validação no servidor com certificados raiz configurados. | ✓ | ✓ | ✓ |
| **NGS2.01.04** | Configuração de certificados raiz | a) Permitir inclusão/exclusão de certificados raiz de confiança. b) Restrito por controle de acesso. | — | — | ✓ |
| **NGS2.01.05** | Compatibilidade com diferentes Autoridades Certificadoras | Produzir assinaturas por certificados de ao menos duas ACs de 1º nível distintas, para cada tipo de mídia aplicável. | ✓ | ✓ | ✓ |

---

### NGS2.02 — Assinatura Digital

| ID | Título | Requisito | E1 | E2 | E3 |
|----|--------|-----------|:--:|:--:|:--:|
| **NGS2.02.01** | Formato de assinatura | Gerar assinaturas digitais nos formatos CAdES, XAdES ou PAdES, seguindo ao menos a política AD-RB. | ✓ | ✓ | ✓ |
| **NGS2.02.02** | Verificação do propósito do certificado para assinatura | Verificar se o certificado possui propósito de assinatura (key usage: Digital Signature + NonRepudiation; tipo A1/A2/A3/A4 ICP-Brasil). | ✓ | ✓ | ✓ |
| **NGS2.02.03** | Instante da assinatura | Incluir em toda assinatura: id-signingTime (CAdES); SigningTime (XAdES); entrada "M" (PAdES). | ✓ | ✓ | ✓ |
| **NGS2.02.04** | Visualização das informações a serem assinadas | a) Permitir visualização das informações antes da assinatura. b) Exibir apenas o que será assinado. | ✓ | ✓ | ✓ |
| **NGS2.02.05** | Pendência de assinatura | Quando o profissional não assina no ato, gerar pendência de assinatura. | — | ✓ | ✓ |
| **NGS2.02.06** | Aviso de registro pendente de assinatura | *(Condição: suporte a pendência de assinatura)* a) Notificar profissional ao sair da tela (inclusive logoff). b) Apresentar lista de pendências após login. c) Lista acessível a qualquer momento. | ✓ | ✓ | ✓ |
| **NGS2.02.08** | Indisponibilidade de acesso a serviços externos | Em caso de serviços externos indisponíveis (OCSP, LCR, carimbo de tempo): não continuar a assinatura (deixar pendente); ou registrar pendência, emitir aviso e atualizar quando disponível. | — | — | ✓ |
| **NGS2.02.09** | Informações sobre assinatura | a) Indicar que documento foi assinado digitalmente (ex.: status "assinado"). b) Permitir visualização de informações da assinatura (signatários e registro de tempo). | ✓ | ✓ | ✓ |
| **NGS2.02.10** | Encadeamento de registros assinados digitalmente | Garantir ordem temporal e presença de todos os registros assinados por paciente (ex.: hash encadeado). | — | — | ✓ |
| **NGS2.02.11** | Verificação do encadeamento de registros | Funcionalidade para o usuário validar o encadeamento a qualquer momento. | — | — | ✓ |

---

### NGS2.03 — Validação da Assinatura Digital

| ID | Título | Requisito | E1 | E2 | E3 |
|----|--------|-----------|:--:|:--:|:--:|
| **NGS2.03.01** | Validação da assinatura digital | Validar em: inclusão no RES; após geração; na impressão de assinados; na importação; na exportação; por vontade do usuário. Validação inclui carimbo de tempo, certificado do signatário, cadeia, revogação (LCR/OCSP). | ✓ | ✓ | ✓ |
| **NGS2.03.02** | Referência temporal para verificação de revogação sem carimbo de tempo | Usar signingTime como referência. | ✓ | ✓ | ✓ |
| **NGS2.03.03** | Referência temporal para verificação de revogação com carimbo de tempo | Usar carimbo de tempo como referência. | — | ✓ | ✓ |
| **NGS2.03.04** | Resultado da validação da assinatura digital | a) Meios para validação a qualquer tempo. b) Estados: Válida / Inválida / Indeterminada. c) Causa indicada exceto para Válida. d) Estado consta na impressão. | ✓ | ✓ | ✓ |

---

### NGS2.04 — Carimbo de Tempo

| ID | Título | Requisito | E1 | E2 | E3 |
|----|--------|-----------|:--:|:--:|:--:|
| **NGS2.04.01** | Política AD-RT para assinaturas digitais | Assinaturas devem seguir ao menos AD-RT com todos os objetos necessários à validação. | — | ✓ | ✓ |
| **NGS2.04.02** | Suporte ao Carimbo de Tempo homologado ICP-Brasil | a) Requisitar e incluir carimbo de tempo após assinatura. b) Revalidar ao incluir carimbo. c) Provedor homologado ICP-Brasil. | — | ✓ | ✓ |
| **NGS2.04.03** | Parametrização de uso de Carimbo de Tempo | Parametrizar se assinaturas terão carimbo de tempo. | — | ✓ | ✓ |
| **NGS2.04.04** | Parametrização por tipo de documento | Parametrizar tipos de documentos com carimbo de tempo (mínimo: prescrições/receitas; atestados médicos). | — | — | ✓ |
| **NGS2.04.05** | Verificação do carimbo de tempo | Verificar certificado de assinatura do carimbo. | — | — | ✓ |

---

### NGS2.05 — Certificado de Atributo

| ID | Título | Requisito | E1 | E2 | E3 |
|----|--------|-----------|:--:|:--:|:--:|
| **NGS2.05.01** | Configuração das fontes de autoridade | *(Condição: suporte a Certificados de Atributo)* a) Configurar fontes de autoridade por classe de privilégio. b) Controles de integridade na relação configurada. | — | ✓ | ✓ |
| **NGS2.05.02** | Tratamento de certificado de atributo | *(Condição: suporte a Certificados de Atributo)* Tratar certificados de atributo segundo ICP-Brasil, RFC 5755 e X.509: verificação (com revogação); geração de assinaturas com atributo; verificação com presença de atributo. | — | ✓ | ✓ |

---

### NGS2.06 — Importação, Exportação e Impressão

| ID | Título | Requisito | E1 | E2 | E3 |
|----|--------|-----------|:--:|:--:|:--:|
| **NGS2.06.01** | Validação da assinatura de documentos importados | *(Condição: importação de registros assinados externamente)* Validar assinatura(s) na importação; gerar pendência se impossível validar; registrar resultado inválido/indeterminado; suportar assinaturas de qualquer AC ICP-Brasil. | ✓ | ✓ | ✓ |
| **NGS2.06.02** | Adequação da assinatura de documentos importados | *(Condição: importação de registros assinados externamente)* Alertar sobre não conformidades com AD-RB, AD-RT, AD-RV ou AD-RC. | — | — | ✓ |
| **NGS2.06.03** | Exportação de registros assinados digitalmente | Possibilitar exportação de registros assinados para validação externa. | ✓ | ✓ | ✓ |
| **NGS2.06.04** | Exportação de documentos específicos assinados | *(E2/E3)* Para prescrições, exames, atestados e laudos, aderir às "Especificações Técnicas para Exportação de Documentos Assinados Digitalmente" (SBIS). | — | ✓ | ✓ |
| **NGS2.06.05** | Impressão de registros assinados digitalmente | Ao menos uma opção: mensagem de rodapé em cada registro; ou relatório de assinaturas para conjunto de registros. | ✓ | ✓ | ✓ |
| **NGS2.06.06** | Impressão de mensagem de rodapé | *(Condição: uso de mensagem de rodapé)* a) Validar assinaturas na impressão e adicionar mensagem em rodapé de cada página: *"Documento assinado digitalmente de acordo com a ICP-Brasil, MP 2.200-2/2001, no sistema certificado SBIS nº XXX-Y, por <signatário>, às <HH:MM+UTC de DD/MM/AAAA>. Estado da assinatura: <estado>."* b) Dados extraídos da assinatura. c) Mais de uma assinatura: repetir para cada signatário. | ✓ | ✓ | ✓ |
| **NGS2.06.07** | Impressão de relatório de assinaturas | *(Condição: uso de relatório de assinaturas)* a) Validar todos ao gerar relatório; imprimir cabeçalho com: *"Os documentos a seguir foram assinados digitalmente... SBIS nº XXX-Y."* b) Lista numerada e paginada de documentos com signatários e estado. c) Mais de uma assinatura: repetir para cada signatário. | ✓ | ✓ | ✓ |

---

### NGS2.07 — Autenticação de Usuário Utilizando Certificado Digital

| ID | Título | Requisito | E1 | E2 | E3 |
|----|--------|-----------|:--:|:--:|:--:|
| **NGS2.07.01** | Certificado digital para autenticação | *(Condição: uso de certificado digital como método de autenticação)* Validar: vigência do certificado; confiança da cadeia; revogação; correspondência CPF usuário/certificado; Extended Key Usage com Client Authentication (1.3.6.1.5.5.7.3.2). | ✓ | ✓ | ✓ |
