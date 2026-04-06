/**
 * Gerenciador de ranking — salva e carrega pontuações no localStorage.
 *
 * As pontuações são armazenadas como JSON no Supabase
 * com a chave 'merge-grow-ranking'. O ranking mantém no máximo
 * 10 entradas, ordenadas da maior para a menor pontuação.
 */


// src/ranking/RankingManager.ts
// Classe de gerenciamento de ranking usando REST API do Supabase (sem depender do pacote @supabase/supabase-js)

export interface RankingEntry {
  id?: number;
  nome: string;
  pontos: number;
  created_at?: string;
}

export class RankingManager {
  // Configuração do Supabase (substitua se quiser usar variáveis de ambiente)
  private static readonly BASE_URL = 'https://fyibtitbyvexsyrwpcsf.supabase.co';
  private static readonly ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5aWJ0aXRieXZleHN5cndwY3NmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MzA1NjcsImV4cCI6MjA5MTAwNjU2N30.4Bln3xJDLGJ-A1LnpbgCVVZ9jcnncSTRzw1hLIFH2_o';
  private static readonly TABELA = 'ranking_mergegrow';

  // Cache local para compatibilidade síncrona com código que espera RankingEntry[]
  private static cache: RankingEntry[] = [];

  // Cabeçalhos padrão para chamadas REST ao Supabase
  private static getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      apikey: RankingManager.ANON_KEY,
      Authorization: `Bearer ${RankingManager.ANON_KEY}`,
    };
  }

  /**
   * Salva uma pontuação no ranking global (Supabase) via REST.
   */
  static async salvarPontuacao(nome: string, pontos: number): Promise<void> {
    try {
      const url = `${RankingManager.BASE_URL}/rest/v1/${RankingManager.TABELA}`;
      const body = JSON.stringify([{ nome, pontos }]);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          ...RankingManager.getHeaders(),
          Prefer: 'return=representation', // opcional: retorna a linha inserida
        },
        body,
      });

      if (!res.ok) {
        const text = await res.text();
        console.error('Erro ao salvar pontuação (HTTP):', res.status, text);
        return;
      }

      // Atualiza cache: se a API retornou a representação, atualizamos; caso contrário, recarregamos
      try {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          // adiciona ao cache e reordena
          RankingManager.cache.push(data[0] as RankingEntry);
          RankingManager.cache.sort((a, b) => b.pontos - a.pontos);
          // mantém apenas top 100 no cache para evitar crescimento indefinido (ajustável)
          RankingManager.cache = RankingManager.cache.slice(0, 100);
        } else {
          // fallback: recarrega cache completo
          RankingManager.fetchAndUpdateCache().catch(err => console.error(err));
        }
      } catch (err) {
        // se não conseguir parsear JSON, recarrega cache
        RankingManager.fetchAndUpdateCache().catch(e => console.error(e));
      }
    } catch (err) {
      console.error('Falha inesperada ao salvar pontuação:', err);
    }
  }

  /**
   * Busca os dados do Supabase e atualiza o cache interno.
   */
  private static async fetchAndUpdateCache(limit: number = 10): Promise<void> {
    try {
      // Monta query: select=* & order=pontos.desc & limit
      const url = new URL(`${RankingManager.BASE_URL}/rest/v1/${RankingManager.TABELA}`);
      url.searchParams.set('select', '*');
      url.searchParams.set('order', 'pontos.desc');
      url.searchParams.set('limit', String(limit));

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: RankingManager.getHeaders(),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error('Erro ao carregar ranking (HTTP):', res.status, text);
        return;
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        // normaliza os campos se necessário e atualiza cache
        RankingManager.cache = data.map((row: any) => ({
          id: row.id,
          nome: row.nome,
          pontos: Number(row.pontos),
          created_at: row.created_at,
        })) as RankingEntry[];
      } else {
        console.error('Resposta inesperada ao carregar ranking:', data);
      }
    } catch (err) {
      console.error('Falha inesperada ao buscar ranking:', err);
    }
  }

  /**
   * Retorna imediatamente o cache atual (síncrono) e dispara uma atualização em background.
   *
   * Isso evita o erro de compilação quando o código existente passa o retorno diretamente
   * para funções que esperam um RankingEntry[] (não uma Promise).
   */
  static carregarRanking(limit: number = 10): RankingEntry[] {
    // dispara atualização em background (não aguardamos)
    RankingManager.fetchAndUpdateCache(limit).catch(err => {
      // já logado dentro da função, mas capturamos para evitar warnings
      console.error('Erro ao atualizar cache em background:', err);
    });

    // retorna o cache atual (pode estar vazio na primeira chamada)
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
   * Usa a versão assíncrona para garantir dados atualizados.
   */
  static async atualizarRankingUI(renderFn: (ranking: RankingEntry[]) => void, limit: number = 10) {
    try {
      const ranking = await RankingManager.carregarRankingAsync(limit);
      renderFn(ranking);
    } catch (err) {
      console.error('Erro ao atualizar UI do ranking:', err);
      // fallback: renderiza cache atual mesmo em caso de erro
      try {
        renderFn(RankingManager.cache);
      } catch (e) {
        console.error('Erro ao renderizar fallback do ranking:', e);
      }
    }
  }
}
