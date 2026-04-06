/**
 * Gerenciador de ranking — salva e carrega pontuações no localStorage.
 *
 * As pontuações são armazenadas como JSON no Supabase
 * com a chave 'merge-grow-ranking'. O ranking mantém no máximo
 * 10 entradas, ordenadas da maior para a menor pontuação.
 */


import { createClient } from '@supabase/supabase-js';

// 🔧 Configuração do Supabase
const supabase = createClient(
  'https://fyibtitbyvexsyrwpcsf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5aWJ0aXRieXZleHN5cndwY3NmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MzA1NjcsImV4cCI6MjA5MTAwNjU2N30.4Bln3xJDLGJ-A1LnpbgCVVZ9jcnncSTRzw1hLIFH2_o'
);

export interface RankingEntry {
  id?: number;
  nome: string;
  pontos: number;
  created_at?: string;
}

export class RankingManager {
  private static tabela = 'ranking_mergegrow';

  /**
   * Salva uma pontuação no ranking global (Supabase).
   */
  static async salvarPontuacao(nome: string, pontos: number): Promise<void> {
    try {
      const { error } = await supabase
        .from(RankingManager.tabela)
        .insert([{ nome, pontos }]);

      if (error) {
        console.error('Erro ao salvar pontuação:', error);
      }
    } catch (err) {
      console.error('Falha inesperada ao salvar pontuação:', err);
    }
  }

  /**
   * Carrega o ranking global ordenado por pontuação.
   */
  static async carregarRanking(limit: number = 10): Promise<RankingEntry[]> {
    try {
      const { data, error } = await supabase
        .from(RankingManager.tabela)
        .select('*')
        .order('pontos', { ascending: false }) // maior para menor
        .limit(limit); // apenas 10 resultados

      if (error) {
        console.error('Erro ao carregar ranking:', error);
        return [];
      }

      return data as RankingEntry[];
    } catch (err) {
      console.error('Falha inesperada ao carregar ranking:', err);
      return [];
    }
  }

  /**
   * Atualiza a UI chamando a função de renderização que você já tem.
   */
  static async atualizarRankingUI(renderFn: (ranking: RankingEntry[]) => void) {
    try {
      const ranking = await RankingManager.carregarRanking();
      renderFn(ranking);
    } catch (err) {
      console.error('Erro ao atualizar UI do ranking:', err);
    }
  }
}
