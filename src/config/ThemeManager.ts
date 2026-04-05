/**
 * Gerenciador de temas do jogo — alterna entre modo escuro e claro.
 *
 * Persiste a preferência do usuário no localStorage para
 * manter o tema escolhido entre sessões.
 *
 * Cada tema define cores para todos os elementos visuais:
 * fundo, paredes, textos, botões, overlay de game over, etc.
 */

export interface ThemeColors {
  /** Cor de fundo do canvas (hex string para Phaser config) */
  background: string;
  /** Cor de fundo numérica (para câmera e retângulos) */
  backgroundNum: number;
  /** Cor das paredes e chão do container */
  containerWall: number;
  /** Fundo dos botões e caixas de UI */
  uiBackground: string;
  /** Cor do título principal (MERGE) */
  titlePrimary: string;
  /** Cor do subtítulo (& GROW) */
  titleSecondary: string;
  /** Cor do texto principal (pontuação, nomes no ranking) */
  textPrimary: string;
  /** Cor do texto secundário (labels, descrições) */
  textSecondary: string;
  /** Cor do texto terciário (cabeçalhos de tabela, dicas) */
  textTertiary: string;
  /** Cor do texto de peso dentro das bolas */
  ballTextColor: string;
  /** Cor do stroke do texto de peso dentro das bolas */
  ballTextStroke: string;
  /** Cor do separador no ranking */
  separator: number;
  /** Cores do pódio no ranking (1°, 2°, 3°) */
  medalColors: [string, string, string];
  /** Cor do overlay de game over (com alpha) */
  gameOverOverlay: number;
  /** Alpha do overlay de game over */
  gameOverOverlayAlpha: number;
  /** Cor do input de apelido — borda e texto */
  inputBorder: string;
  /** Cor do texto do input de apelido */
  inputText: string;
  /** Fundo do input HTML */
  inputBackground: string;
}

/** Definição do tema escuro (atual/padrão) */
const DARK_THEME: ThemeColors = {
  background: '#1a1a2e',
  backgroundNum: 0x1a1a2e,
  containerWall: 0x16213e,
  uiBackground: '#16213e',
  titlePrimary: '#ffc75f',
  titleSecondary: '#4b7bec',
  textPrimary: '#ffffff',
  textSecondary: '#aaaaaa',
  textTertiary: '#666666',
  ballTextColor: '#ffffff',
  ballTextStroke: '#000000',
  separator: 0x333333,
  medalColors: ['#ffc75f', '#c0c0c0', '#cd7f32'],
  gameOverOverlay: 0x000000,
  gameOverOverlayAlpha: 0.7,
  inputBorder: '#ffc75f',
  inputText: '#ffc75f',
  inputBackground: '#16213e',
};

/** Definição do tema claro */
const LIGHT_THEME: ThemeColors = {
  background: '#e8ecf1',
  backgroundNum: 0xe8ecf1,
  containerWall: 0xb0bec5,
  uiBackground: '#cfd8dc',
  titlePrimary: '#d4a017',
  titleSecondary: '#3a5fc8',
  textPrimary: '#212121',
  textSecondary: '#555555',
  textTertiary: '#888888',
  ballTextColor: '#000000',
  ballTextStroke: '#ffffff',
  separator: 0xcccccc,
  /** 1° e 2° mais escuros para boa leitura no fundo claro */
  medalColors: ['#b8860b', '#808080', '#8b5e3c'],
  gameOverOverlay: 0xffffff,
  gameOverOverlayAlpha: 0.75,
  inputBorder: '#d4a017',
  inputText: '#333333',
  inputBackground: '#ffffff',
};

/** Chave usada no localStorage para persistir a preferência */
const STORAGE_KEY = 'mergeGrow_tema';

export type ThemeType = 'dark' | 'light';

class ThemeManager {
  private _tema: ThemeType;

  constructor() {
    // Carregar preferência salva ou usar escuro como padrão
    const salvo = localStorage.getItem(STORAGE_KEY) as ThemeType | null;
    this._tema = salvo === 'light' ? 'light' : 'dark';
  }

  /** Retorna o tipo de tema atual */
  get tema(): ThemeType {
    return this._tema;
  }

  /** Retorna as cores do tema atual */
  get cores(): ThemeColors {
    return this._tema === 'dark' ? DARK_THEME : LIGHT_THEME;
  }

  /** Alterna entre dark e light, salva no localStorage e retorna o novo tema */
  alternar(): ThemeType {
    this._tema = this._tema === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, this._tema);
    return this._tema;
  }

  /** Verifica se está no tema escuro */
  get escuro(): boolean {
    return this._tema === 'dark';
  }
}

/**
 * Instância global do gerenciador de temas.
 * Compartilhada entre todas as cenas do jogo.
 */
export const themeManager = new ThemeManager();
