# Import Tools

Script principal:

```bash
pnpm import:generate -- --skip-lm --skip-ocr --limit 5
```

Revisão manual dos casos pendentes:

```bash
pnpm import:review
```

O comando carrega `.env` automaticamente via `node --env-file-if-exists=.env`.

Sem `--skip-lm` e `--skip-ocr`, o pipeline faz:

1. split determinístico do `Prontuario_Docs.md` por `## data` e `### paciente`
2. matching aproximado de nomes contra `db_patients.json`
3. estruturação SOAP com Anthropic
4. OCR do `Dod\cumentos_Medicos.pdf` via Mistral OCR
5. interpretação das páginas OCR via Anthropic
6. geração de um `Bundle` FHIR por paciente em `import/out`

## Fluxo recomendado

1. Rode `pnpm import:generate -- --limit 7`
2. Inspecione `import/out/_review.json`
3. Rode `pnpm import:review`
4. Vincule os casos ambíguos no terminal ou crie um paciente mínimo manual
5. Rode `pnpm import:generate` novamente para reaplicar as decisões

As decisões manuais ficam persistidas em `import/cache/manual-decisions.json`.

Os nomes esperados em `import/` são:

- `db_patients.json`
- `Prontuario_Docs.md`
- `Documentos_Medicos.pdf`

## Variáveis de ambiente

- `MISTRAL_API_KEY`
- `MISTRAL_OCR_MODEL` opcional, default `mistral-ocr-latest`
- `MISTRAL_API_BASE_URL` opcional, default `https://api.mistral.ai`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL` opcional, default `claude-sonnet-4-20250514`
- `ANTHROPIC_API_BASE_URL` opcional, default `https://api.anthropic.com`
- `ANTHROPIC_API_VERSION` opcional, default `2023-06-01`
- `CLINIC_TIMEZONE_OFFSET` opcional, default `-03:00`

## Matching aproximado de nomes

O script não depende de igualdade exata do nome. Ele combina:

- normalização de acentos, pontuação e espaços
- similaridade por distância de edição
- similaridade por bigramas
- interseção de tokens do nome
- bônus quando a data de nascimento também bate

Casos ambíguos ou não resolvidos ficam em `import/out/_review.json`.

## Review interativo

O comando `pnpm import:review` mostra apenas os itens ainda pendentes e aceita:

- `1..5` para vincular ao candidato exibido
- `c` para criar um paciente mínimo manual
- `s` para pular aquele item
- `q` para salvar e sair

Flags úteis:

- `--documents-only`
- `--markdown-only`
- `--limit N`
- `--include-resolved`
