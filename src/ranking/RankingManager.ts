/**
 * Gerenciador de ranking — comunica-se com o Supabase via REST.
 *
 * Inserções de pontuação passam pela RPC `salvar_pontuacao`, que aplica
 * validação server-side e rate limit por IP. A leitura usa o endpoint
 * REST padrão da tabela `ranking_mergegrow`.
 *
 * Mantém um cache local em memória (top N) e despacha o evento global
 * `rankingUpdated` (CustomEvent) sempre que esse cache muda, para que
 * cenas Phaser possam reagir sem polling.
 */

// Liga/desliga logs de debug. Em produção deve ficar `false` para não
// poluir o console do jogador nem expor estrutura interna do módulo.
const DEBUG = false;
function log(...args: unknown[]): void {
  if (DEBUG) console.log('[RankingManager]', ...args);
}

// Tipos de erro que a RPC `salvar_pontuacao` pode lançar (raise exception).
// São strings simples porque o PostgREST devolve a mensagem do `raise` no
// campo `message` do JSON de erro.
export type RankingErroSalvar =
  | 'rate_limit'
  | 'nome_invalido'
  | 'nome_charset_invalido'
  | 'pontos_invalidos'
  | 'sessao_invalida'   // token ausente, já usado ou sessão muito curta/expirada
  | 'rede'
  | 'desconhecido';

export interface RankingEntry {
  id?: number;
  nome: string;
  pontos: number;
  created_at?: string;
}

export class RankingManager {
  // Configuração do Supabase. A `anon key` é pública por design — a segurança
  // real é garantida pelas RLS policies + RPC `security definer` no banco.
  private static readonly BASE_URL = 'https://fyibtitbyvexsyrwpcsf.supabase.co';
  private static readonly ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5aWJ0aXRieXZleHN5cndwY3NmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MzA1NjcsImV4cCI6MjA5MTAwNjU2N30.4Bln3xJDLGJ-A1LnpbgCVVZ9jcnncSTRzw1hLIFH2_o';
  private static readonly TABELA = 'ranking_mergegrow';
  private static readonly RPC_SALVAR = 'salvar_pontuacao';
  private static readonly RPC_SESSAO = 'iniciar_sessao';

  // Timeout padrão das chamadas HTTP — evita Promises penduradas se a rede travar.
  private static readonly TIMEOUT_MS = 8000;

  // Cache local com a última leitura conhecida do servidor.
  private static cache: RankingEntry[] = [];

  // Listeners locais (callbacks) registrados via `subscribe`.
  private static listeners: Array<(ranking: RankingEntry[]) => void> = [];

  // Promise da requisição de leitura em andamento (deduplicação): se duas
  // cenas pedirem o ranking ao mesmo tempo, ambas reaproveitam o mesmo fetch.
  private static fetchEmAndamento: Promise<void> | null = null;

  /**
   * Cabeçalhos padrão para chamadas REST ao Supabase.
   * A `apikey` e o `Authorization` recebem a mesma `anon key`.
   */
  private static getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      apikey: RankingManager.ANON_KEY,
      Authorization: `Bearer ${RankingManager.ANON_KEY}`,
    };
  }

  /**
   * Wrapper de `fetch` com timeout via AbortController.
   * Lança erro `'rede'` em caso de timeout ou falha de conexão.
   */
  private static async fetchComTimeout(input: string, init: RequestInit = {}): Promise<Response> {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), RankingManager.TIMEOUT_MS);
    try {
      return await fetch(input, { ...init, signal: ctrl.signal });
    } finally {
      clearTimeout(tid);
    }
  }

  /**
   * Type guard simples para validar objetos vindos da API.
   * Como dados externos não são confiáveis, validamos antes de inserir no cache.
   */
  private static isRankingEntryLike(row: unknown): row is { id: number; nome: string; pontos: number; created_at?: string } {
    if (!row || typeof row !== 'object') return false;
    const r = row as Record<string, unknown>;
    return (
      (typeof r.id === 'number' || typeof r.id === 'bigint') &&
      typeof r.nome === 'string' &&
      (typeof r.pontos === 'number' || typeof r.pontos === 'string')
    );
  }

  /**
   * Inicia uma sessão de jogo no banco — deve ser chamado assim que a
   * cena do jogo carregar. Retorna um UUID que representa esta partida.
   *
   * O token é gerado pelo banco (gen_random_uuid), portanto não pode ser
   * forjado pelo cliente. Ele será exigido na hora de salvar a pontuação
   * e só é aceito se a sessão tiver pelo menos 20 segundos de vida
   * (tempo mínimo de uma partida real) e menos de 30 minutos.
   *
   * Retorna `null` em caso de falha de rede — o jogo ainda funciona,
   * mas o jogador não conseguirá salvar o score ao final.
   */
  static async iniciarSessao(): Promise<string | null> {
    try {
      log('iniciarSessao');

      const url = `${RankingManager.BASE_URL}/rest/v1/rpc/${RankingManager.RPC_SESSAO}`;
      const res = await RankingManager.fetchComTimeout(url, {
        method: 'POST',
        headers: RankingManager.getHeaders(),
        body: '{}', // RPC sem parâmetros exige body vazio mas válido
      });

      if (!res.ok) {
        console.error('[RankingManager] Falha ao iniciar sessão:', res.status);
        return null;
      }

      const data = await res.json();
      const token = data?.token ?? null;
      log('sessão iniciada:', token);
      return token;
    } catch (err) {
      console.error('[RankingManager] Erro ao iniciar sessão:', err);
      return null;
    }
  }

  /**
   * Salva uma pontuação chamando a RPC `salvar_pontuacao` no Supabase.
   * Exige o token gerado por `iniciarSessao` — sem ele o banco rejeita.
   *
   * Retorna `null` em caso de sucesso ou um código de erro estruturado para
   * que a UI possa exibir uma mensagem amigável (ex.: "aguarde 5 segundos").
   */
  static async salvarPontuacao(nome: string, pontos: number, token: string | null): Promise<RankingErroSalvar | null> {
    try {
      log('salvarPontuacao', { nome, pontos, token });

      // Se não há token (falha ao iniciar sessão), bloqueia na própria chamada
      if (!token) return 'sessao_invalida';

      const url = `${RankingManager.BASE_URL}/rest/v1/rpc/${RankingManager.RPC_SALVAR}`;
      const body = JSON.stringify({ p_nome: nome, p_pontos: pontos, p_token: token });

      const res = await RankingManager.fetchComTimeout(url, {
        method: 'POST',
        headers: RankingManager.getHeaders(),
        body,
      });

      log('RPC status:', res.status);

      if (!res.ok) {
        // PostgREST devolve { message, code, ... } quando o `raise exception` dispara.
        // O texto do `raise` cai no campo `message`.
        let codigo: RankingErroSalvar = 'desconhecido';
        try {
          const errJson = await res.json();
          const msg = String(errJson?.message ?? '');
          if (msg.includes('rate_limit')) codigo = 'rate_limit';
          else if (msg.includes('nome_charset_invalido')) codigo = 'nome_charset_invalido';
          else if (msg.includes('nome_invalido')) codigo = 'nome_invalido';
          else if (msg.includes('pontos_invalidos')) codigo = 'pontos_invalidos';
          else if (msg.includes('sessao_invalida')) codigo = 'sessao_invalida';
          console.error('[RankingManager] RPC erro:', res.status, errJson);
        } catch {
          console.error('[RankingManager] RPC erro (sem corpo JSON):', res.status);
        }
        return codigo;
      }

      // Sucesso: a RPC retorna o registro inserido como JSON.
      // Recarrega o cache em background para refletir a nova posição.
      RankingManager.fetchAndUpdateCache(10).catch(err => {
        console.error('[RankingManager] Erro ao recarregar após salvar:', err);
      });

      return null;
    } catch (err) {
      // AbortError (timeout) ou erro de rede caem aqui.
      console.error('[RankingManager] Falha ao salvar pontuação:', err);
      return 'rede';
    }
  }

  /**
   * Busca o ranking no Supabase e substitui o cache.
   * Deduplica chamadas concorrentes: se já houver uma busca em andamento,
   * a segunda chamada espera o mesmo Promise em vez de disparar outro fetch.
   */
  private static fetchAndUpdateCache(limit: number = 10): Promise<void> {
    if (RankingManager.fetchEmAndamento) {
      return RankingManager.fetchEmAndamento;
    }

    const promessa = (async () => {
      try {
        const url = new URL(`${RankingManager.BASE_URL}/rest/v1/${RankingManager.TABELA}`);
        url.searchParams.set('select', '*');
        url.searchParams.set('order', 'pontos.desc');
        url.searchParams.set('limit', String(limit));

        log('fetch url:', url.toString());

        const res = await RankingManager.fetchComTimeout(url.toString(), {
          method: 'GET',
          headers: RankingManager.getHeaders(),
        });

        log('fetch status:', res.status);

        if (!res.ok) {
          const text = await res.text();
          console.error('[RankingManager] Erro ao carregar ranking (HTTP):', res.status, text);
          return;
        }

        const data = await res.json();

        if (!Array.isArray(data)) {
          console.error('[RankingManager] Resposta inesperada ao carregar ranking:', data);
          return;
        }

        // Filtra pelo type guard — qualquer linha malformada é descartada
        // em vez de explodir o cache inteiro.
        RankingManager.cache = data
          .filter(RankingManager.isRankingEntryLike)
          .map((row) => ({
            id: Number(row.id),
            nome: row.nome,
            pontos: Number(row.pontos),
            created_at: row.created_at,
          }));

        log('cache atualizado:', RankingManager.cache);
        RankingManager.notifyUpdate();
      } catch (err) {
        console.error('[RankingManager] Falha inesperada ao buscar ranking:', err);
      } finally {
        RankingManager.fetchEmAndamento = null;
      }
    })();

    RankingManager.fetchEmAndamento = promessa;
    return promessa;
  }

  /**
   * Retorna imediatamente o cache atual (síncrono) e dispara uma atualização
   * em background. Útil para renderização inicial sem `await`.
   */
  static carregarRanking(limit: number = 10): RankingEntry[] {
    RankingManager.fetchAndUpdateCache(limit).catch(err => {
      console.error('[RankingManager] Erro ao atualizar cache em background:', err);
    });
    return RankingManager.cache;
  }

  /**
   * Versão assíncrona — aguarda o fetch concluir antes de retornar o cache.
   */
  static async carregarRankingAsync(limit: number = 10): Promise<RankingEntry[]> {
    await RankingManager.fetchAndUpdateCache(limit);
    return RankingManager.cache;
  }

  /**
   * Helper para renderização: chama `renderFn` com o ranking carregado,
   * com fallback para o cache atual em caso de erro.
   */
  static async atualizarRankingUI(renderFn: (ranking: RankingEntry[]) => void, limit: number = 10) {
    try {
      const ranking = await RankingManager.carregarRankingAsync(limit);
      renderFn(ranking);
    } catch (err) {
      console.error('[RankingManager] Erro ao atualizar UI do ranking:', err);
      try {
        renderFn(RankingManager.cache);
      } catch (e) {
        console.error('[RankingManager] Erro ao renderizar fallback do ranking:', e);
      }
    }
  }

  /**
   * Registra um listener local que será chamado quando o cache for atualizado.
   * Retorna a função de unsubscribe.
   */
  static subscribe(callback: (ranking: RankingEntry[]) => void): () => void {
    RankingManager.listeners.push(callback);
    try {
      callback(RankingManager.cache);
    } catch (e) {
      console.error('[RankingManager] Erro ao chamar listener inicial:', e);
    }
    return () => {
      RankingManager.listeners = RankingManager.listeners.filter(l => l !== callback);
    };
  }

  /**
   * Notifica listeners locais e despacha o evento global `rankingUpdated`.
   */
  private static notifyUpdate() {
    for (const cb of RankingManager.listeners) {
      try {
        cb(RankingManager.cache);
      } catch (e) {
        console.error('[RankingManager] Erro em listener registrado:', e);
      }
    }

    if (typeof window !== 'undefined' && window.dispatchEvent) {
      try {
        window.dispatchEvent(new CustomEvent('rankingUpdated', { detail: RankingManager.cache }));
      } catch (e) {
        console.error('[RankingManager] Erro ao despachar evento rankingUpdated:', e);
      }
    }
  }
}
