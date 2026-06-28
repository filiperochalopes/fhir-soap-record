# Prompt para o agente do app Docs

Implemente no app `/Users/filipelopes/Desktop/Web/Progress/v2.docs.filipelopes.med.br` a camada de integração com o app `fhir-soap-record`.

## Objetivo

O app `fhir-soap-record` abre o Docs em nova aba para gerar quatro tipos de documento:

- prescrição: rota `/prescription`
- solicitação de exames: rota `/solicitacao-exames`
- atestado: rota `/relatorio`, com título `Atestado Médico` e `templateId`
- documento genérico: rota `/relatorio`, sem título inicial obrigatório

O Docs deve descriptografar os valores sensíveis dos parâmetros da URL, preencher parcialmente o formulário e, quando houver texto de conduta pronto, enviar esse texto de volta pelo `webhook.url` recebido na URL. O `postMessage` pode continuar existindo como retorno imediato para a aba aberta, mas o webhook é o contrato principal e genérico para integrações.

## Contrato de entrada

O `fhir-soap-record` chama o Docs com query params individuais:

- `source=fhir-soap-record`
- `state=<encrypted uuid>`
- `document.kind=<encrypted document type>`
- `document.templateId=<encrypted template id>` quando houver
- `documentReference.title=<encrypted title>` para atestado
- `patient.name=<encrypted patient name>`
- `patient.birthDate=<encrypted YYYY-MM-DD>`
- `patient.cns=<encrypted CNS>` quando houver
- `patient.cpf=<encrypted CPF>` quando houver
- `return.mode=<encrypted postMessage>`
- `return.url=<encrypted return URL>`
- `webhook.method=<encrypted POST>`
- `webhook.url=<encrypted webhook URL>`

Cada valor criptografado usa o formato:

```text
v1:<iv-base64url>:<tag-base64url>:<ciphertext-base64url>
```

Criptografia de cada valor:

- algoritmo: AES-256-GCM
- IV: 12 bytes
- tag: auth tag GCM
- chave AES: `sha256(apiKey utf8)`
- plaintext: valor textual UTF-8 do parâmetro

A API key deve existir do lado do Docs como segredo/configuração do servidor ou configuração segura equivalente. Não use token de login do browser como chave.

## Autofill necessário

Ao carregar qualquer uma das três rotas:

- se `source=fhir-soap-record` e houver valores `v1:<iv>:<tag>:<ciphertext>`, descriptografar antes de aplicar preferências locais;
- preencher `patient.name` com `patient.name`;
- preencher `patient.birthDate` com `patient.birthDate`;
- preencher CNS/CPF quando o formulário tiver campo compatível;
- em `/relatorio`, preencher `documentReference.title` quando `document.title` vier preenchido;
- em `/relatorio`, quando `document.templateId` vier preenchido, carregar o modelo pelo ID e aplicar o template ao corpo do documento;
- não sobrescrever campos já editados pelo usuário depois do carregamento inicial.

## Retorno de conduta para o prontuário via webhook

Quando o documento for emitido com sucesso, o Docs deve fazer `POST` para `webhook.url`.

Body JSON:

```json
{
  "event": "document.issued",
  "state": "uuid-recebido-no-parametro-state",
  "documentType": "prescription | service-request | medical-certificate | generic-document",
  "clinicalNote": "Texto para inserir no prontuário",
  "document": {
    "id": "id-interno-opcional",
    "url": "url-do-pdf-opcional"
  }
}
```

Assinatura:

- calcular HMAC-SHA256 do corpo JSON bruto usando a API key do Docs como segredo;
- enviar no header `X-Docs-Signature`;
- formato aceito: hex puro ou `sha256=<hex>`.

O app origem usa o `token` da URL para identificar paciente/usuário/estado e usa a assinatura do corpo para validar que o webhook veio de quem possui a API key.

## Retorno imediato opcional por postMessage

Se a janela foi aberta a partir do prontuário, também pode enviar para a aba de origem:

```ts
window.opener?.postMessage(
  {
    type: "docs.clinical-note",
    state,
    documentType: document.kind,
    clinicalNote: textoDaConduta
  },
  new URL(return.url).origin
);
```

O texto deve usar as funções existentes em `web/src/services/clinicalNote.ts`:

- prescrição: `buildPrescriptionClinicalNote`
- exames: `buildServiceRequestClinicalNote`
- documento genérico/atestado: `buildDocumentReferenceClinicalNote`

Envie o `postMessage` depois da geração bem-sucedida do PDF e também deixe o botão de copiar existente funcionando.

## Ajustes de UI/configuração no Docs

- Na listagem de templates/modelos, exibir o ID do template de forma copiável.
- No seletor de modelos do `/relatorio`, permitir seleção/carga por ID recebido na URL criptografada.
- Em caso de parâmetro inválido ou falha de descriptografia, mostrar mensagem recuperável dentro do app, sem tela branca.
- Adicionar testes unitários para descriptografia e testes de rota/formulário garantindo autofill para `/prescription`, `/solicitacao-exames` e `/relatorio`.
