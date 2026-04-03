/**
 * Gerenciador de ranking — salva e carrega pontuações no localStorage.
 *
 * As pontuações são armazenadas como JSON no localStorage
 * com a chave 'merge-grow-ranking'. O ranking mantém no máximo
 * 10 entradas, ordenadas da maior para a menor pontuação.
 */

/** Estrutura de uma entrada no ranking */
export interface RankingEntry {
  /** Apelido do jogador (máx. 10 caracteres) */
  nome: string;
  /** Pontuação alcançada */
  pontos: number;
  /** Data/hora em que a pontuação foi registrada (ISO string) */
  data: string;
}

/** Chave usada no localStorage */
const STORAGE_KEY = 'merge-grow-ranking';

/** Número máximo de entradas no ranking */
const MAX_ENTRADAS = 10;

export class RankingManager {
  /**
   * Carrega o ranking salvo no localStorage.
   * Retorna array vazio se não houver dados salvos.
   */
  static carregarRanking(): RankingEntry[] {
    try {
      const dados = localStorage.getItem(STORAGE_KEY);
      if (!dados) return [];
      return JSON.parse(dados) as RankingEntry[];
    } catch {
      // Se o JSON estiver corrompido, retorna vazio
      return [];
    }
  }

  /**
   * Salva uma nova pontuação no ranking.
   *
   * Adiciona a entrada, ordena por pontuação (decrescente)
   * e mantém apenas as 10 melhores.
   *
   * @param nome - Apelido do jogador
   * @param pontos - Pontuação alcançada
   * @returns Posição no ranking (0 = 1° lugar). -1 se não entrou no top 10.
   */
  static salvarPontuacao(nome: string, pontos: number): number {
    const ranking = this.carregarRanking();

    const novaEntrada: RankingEntry = {
      nome: nome.substring(0, 10),
      pontos,
      data: new Date().toISOString(),
    };

    ranking.push(novaEntrada);

    // Ordenar do maior para o menor
    ranking.sort((a, b) => b.pontos - a.pontos);

    // Manter apenas as 10 melhores
    const top = ranking.slice(0, MAX_ENTRADAS);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(top));

    // Retornar a posição do jogador no ranking (0-based)
    const posicao = top.findIndex(
      (e) => e.nome === novaEntrada.nome && e.pontos === novaEntrada.pontos && e.data === novaEntrada.data
    );
    return posicao;
  }
}
