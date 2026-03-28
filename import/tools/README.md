# Import Tools

Script principal:

```bash
pnpm import:generate -- --skip-lm --skip-ocr --limit 5
```

O comando carrega `.env` automaticamente via `node --env-file-if-exists=.env`.

Sem `--skip-lm` e `--skip-ocr`, o pipeline faz:

1. split determinístico do `Clinica Cuidar - Registro.md` por `## data` e `### paciente`
2. matching aproximado de nomes contra `db_patients.json`
3. estruturação SOAP com Anthropic
4. OCR do `Documentos_Medicos.pdf` via Mistral OCR
5. interpretação das páginas OCR via Anthropic
6. geração de um `Bundle` FHIR por paciente em `import/out`

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
