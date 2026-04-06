/**
 * Gerenciador de ranking — salva e carrega pontuações no localStorage.
 *
 * As pontuações são armazenadas como JSON no Supabase
 * com a chave 'merge-grow-ranking'. O ranking mantém no máximo
 * 10 entradas, ordenadas da maior para a menor pontuação.
 */


// src/ranking/RankingManager.ts
// Classe de gerenciamento de ranking usando REST API do Supabase (sem depender do pacote @supabase/supabase-js)
// - Logs para debug
// - Atualiza cache ao carregar
// - Despacha evento global 'rankingUpdated' quando o cache muda

export interface RankingEntry {
  id?: number;
  nome: string;
  pontos: number;
  created_at?: string;
}

export class RankingManager {
  // Configuração do Supabase (substitua por variáveis de ambiente se preferir)
  private static readonly BASE_URL = 'https://fyibtitbyvexsyrwpcsf.supabase.co';
  private static readonly ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5aWJ0aXRieXZleHN5cndwY3NmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MzA1NjcsImV4cCI6MjA5MTAwNjU2N30.4Bln3xJDLGJ-A1LnpbgCVVZ9jcnncSTRzw1hLIFH2_o';
  private static readonly TABELA = 'ranking_mergegrow';

  // Cache local para compatibilidade síncrona
  private static cache: RankingEntry[] = [];

  // Lista de callbacks registrados (opcional)
  private static listeners: Array<(ranking: RankingEntry[]) => void> = [];

  // Cabeçalhos padrão para chamadas REST ao Supabase
  private static getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      apikey: RankingManager.ANON_KEY,
      Authorization: `Bearer ${RankingManager.ANON_KEY}`,
    };
  }

  /**
   * Inicialização automática: dispara uma primeira atualização do cache em background.
   * Chamado ao importar o módulo (executa uma vez).
   */
  private static _initialized = (() => {
    // não await aqui, apenas dispara em background
    RankingManager.fetchAndUpdateCache(10).catch(err => {
      console.error('[RankingManager] inicialização falhou:', err);
    });
    return true;
  })();

  /**
   * Salva uma pontuação no ranking global (Supabase) via REST.
   */
  static async salvarPontuacao(nome: string, pontos: number): Promise<void> {
    try {
      console.log('[RankingManager] salvarPontuacao', { nome, pontos });

      const url = `${RankingManager.BASE_URL}/rest/v1/${RankingManager.TABELA}`;
      const body = JSON.stringify([{ nome, pontos }]);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          ...RankingManager.getHeaders(),
          Prefer: 'return=representation',
        },
        body,
      });

      console.log('[RankingManager] POST status:', res.status);

      if (!res.ok) {
        const text = await res.text();
        console.error('[RankingManager] Erro ao salvar pontuação (HTTP):', res.status, text);
        return;
      }

      // tenta ler a representação retornada
      try {
        const data = await res.json();
        console.log('[RankingManager] POST response body:', data);

        if (Array.isArray(data) && data.length > 0) {
          // adiciona ao cache e reordena
          RankingManager.cache.push({
            id: data[0].id,
            nome: data[0].nome,
            pontos: Number(data[0].pontos),
            created_at: data[0].created_at,
          });
          RankingManager.cache.sort((a, b) => b.pontos - a.pontos);
          RankingManager.cache = RankingManager.cache.slice(0, 100);
          RankingManager.notifyUpdate();
          return;
        }
      } catch (err) {
        console.warn('[RankingManager] Não foi possível parsear POST response, recarregando cache', err);
      }

      // fallback: recarrega cache completo
      await RankingManager.fetchAndUpdateCache(10);
    } catch (err) {
      console.error('[RankingManager] Falha inesperada ao salvar pontuação:', err);
    }
  }

  /**
   * Busca os dados do Supabase e atualiza o cache interno.
   */
  private static async fetchAndUpdateCache(limit: number = 10): Promise<void> {
    try {
      const url = new URL(`${RankingManager.BASE_URL}/rest/v1/${RankingManager.TABELA}`);
      url.searchParams.set('select', '*');
      url.searchParams.set('order', 'pontos.desc');
      url.searchParams.set('limit', String(limit));

      console.log('[RankingManager] fetch url:', url.toString());

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: RankingManager.getHeaders(),
      });

      console.log('[RankingManager] fetch status:', res.status);

      if (!res.ok) {
        const text = await res.text();
        console.error('[RankingManager] Erro ao carregar ranking (HTTP):', res.status, text);
        return;
      }

      const data = await res.json();
      console.log('[RankingManager] fetch raw result:', data);

      if (Array.isArray(data)) {
        RankingManager.cache = data.map((row: any) => ({
          id: row.id,
          nome: row.nome,
          pontos: Number(row.pontos),
          created_at: row.created_at,
        })) as RankingEntry[];

        console.log('[RankingManager] cache atualizado:', RankingManager.cache);
        RankingManager.notifyUpdate();
      } else {
        console.error('[RankingManager] Resposta inesperada ao carregar ranking:', data);
      }
    } catch (err) {
      console.error('[RankingManager] Falha inesperada ao buscar ranking:', err);
    }
  }

  /**
   * Retorna imediatamente o cache atual (síncrono) e dispara uma atualização em background.
   */
  static carregarRanking(limit: number = 10): RankingEntry[] {
    // dispara atualização em background
    RankingManager.fetchAndUpdateCache(limit).catch(err => {
      console.error('[RankingManager] Erro ao atualizar cache em background:', err);
    });

    return RankingManager.cache;
  }

  /**
   * Versão assíncrona que garante que os dados foram carregados antes de retornar.
   */
  static async carregarRankingAsync(limit: number = 10): Promise<RankingEntry[]> {
    await RankingManager.fetchAndUpdateCache(limit);
    return RankingManager.cache;
  }

  /**
   * Atualiza a UI chamando a função de renderização que você já tem.
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
   * Registra um listener local (callback) que será chamado sempre que o cache for atualizado.
   * Retorna uma função para remover o listener.
   */
  static subscribe(callback: (ranking: RankingEntry[]) => void): () => void {
    RankingManager.listeners.push(callback);
    // chama imediatamente com o cache atual
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
   * Notifica listeners locais e despacha evento global 'rankingUpdated' com os dados.
   */
  private static notifyUpdate() {
    try {
      // notifica callbacks registrados
      for (const cb of RankingManager.listeners) {
        try {
          cb(RankingManager.cache);
        } catch (e) {
          console.error('[RankingManager] Erro em listener registrado:', e);
        }
      }

      // despacha evento global para que cenas possam escutar
      try {
        const event = new CustomEvent('rankingUpdated', { detail: RankingManager.cache });
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          window.dispatchEvent(event);
        }
      } catch (e) {
        console.error('[RankingManager] Erro ao despachar evento rankingUpdated:', e);
      }
    } catch (err) {
      console.error('[RankingManager] notifyUpdate falhou:', err);
    }
  }
}
