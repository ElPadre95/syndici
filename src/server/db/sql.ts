/**
 * Petite couche d'exécution SQL paramétrée, partagée entre la production (Prisma)
 * et les tests (PGlite = vrai Postgres en process). Les garde-fous de sécurité
 * (contexte multi-résidences, accès Person, invitations) sont écrits UNE seule
 * fois contre cette interface : les mêmes prédicats SQL tournent en test et en
 * prod. Aucun risque de divergence entre « ce qui est testé » et « ce qui court ».
 */
import { getBaseClient } from './client';

/** Exécute une requête paramétrée et renvoie les lignes. */
export interface SqlExecutor {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

/** Ouvre une transaction et exécute `fn` avec un exécuteur transactionnel. */
export interface TxRunner {
  transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T>;
}

/** Exécuteur de production, adossé au client Prisma brut (hors transaction). */
export function prismaExecutor(): SqlExecutor {
  const client = getBaseClient();
  return {
    query: <T>(sql: string, params: unknown[] = []) => client.$queryRawUnsafe<T[]>(sql, ...params),
  };
}

/** Lanceur de transactions de production, adossé au client Prisma brut. */
export function prismaTxRunner(): TxRunner {
  const client = getBaseClient();
  return {
    transaction: <T>(fn: (tx: SqlExecutor) => Promise<T>) =>
      client.$transaction((tx) =>
        fn({
          query: <U>(sql: string, params: unknown[] = []) =>
            tx.$queryRawUnsafe<U[]>(sql, ...params),
        }),
      ),
  };
}
