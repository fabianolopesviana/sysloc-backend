/**
 * As Tentativas de envio gravadas desde um carimbo — a metade do `CT-1153` que toca o banco durável.
 *
 * Uso:  sudo <node> contar-envios-do-intervalo.mjs '<ISO-8601 com fuso>'
 *
 * Lê a cadeia de conexão do EnvironmentFile 0600 DENTRO do processo — nunca por `argv`, nunca por
 * variável exportada (ADR-0005). Só faz SELECT de contagem: não grava, não semeia destinatário e
 * não toca `SMTP_URL` — as três coisas que o roteiro da janela proíbe porque mudariam o objeto sob
 * prova.
 *
 * ⚠️ A tabela é `negocio.envio_de_cobranca` e o desfecho é `ENVIADA`. O roteiro da fatia nomeava
 * `negocio.tentativa_de_envio` e `'entregue'`, e NENHUM dos dois existe — medido em 2026-08-27.
 */
import { readFileSync } from 'node:fs';
import postgres from '/opt/sysloc-backend/node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/index.js';

const inicio = process.argv[2];
if (!inicio) { console.error('uso: contar-envios-do-intervalo.mjs <carimbo ISO-8601>'); process.exit(2); }

const cadeia = /^DATABASE_URL=(.*)$/m.exec(readFileSync('/etc/sysloc/backend.env', 'utf8'))?.[1]?.trim();
if (!cadeia) { console.error('DATABASE_URL ausente'); process.exit(2); }

const sql = postgres(cadeia, { max: 1, onnotice: () => {} });
try {
  const [r] = await sql`select count(*)::int as quantos
                          from negocio.envio_de_cobranca
                         where desfecho = 'ENVIADA'
                           and criado_em >= ${inicio}::timestamptz`;
  console.log(`entregues desde ${inicio}: ${r.quantos}`);

  const [t] = await sql`select count(*)::int as quantos from negocio.envio_de_cobranca`;
  console.log(`total de envios na base (todos os tempos): ${t.quantos}`);
} finally {
  await sql.end({ timeout: 5 });
}
