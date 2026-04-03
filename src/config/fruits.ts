/**
 * Configuração das bolas de peso do jogo
 *
 * Sistema de potência de 2: cada merge soma duas bolas iguais,
 * então o peso sempre dobra (1+1=2, 2+2=4, 4+4=8...).
 *
 * Raios e tamanhos estão na escala do canvas 960×1440.
 */

export interface FruitConfig {
  level: number;
  /** Peso exibido na bola */
  name: string;
  /** Peso real em Kg — usado para calcular densidade na física */
  weight: number;
  /** Raio do círculo em pixels (escala 960×1440) */
  radius: number;
  /** Cor de preenchimento */
  color: number;
  /** Cor da borda */
  borderColor: number;
  /** Pontos ganhos ao criar esta bola por fusão */
  points: number;
}

/**
 * Pesos em potência de 2: 1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024
 * Cores com máximo contraste entre níveis adjacentes.
 */
export const FRUITS: FruitConfig[] = [
  { level: 0,  name: '1Kg',    weight: 1,    radius: 30,  color: 0xff4d6a, borderColor: 0xcc3e55, points: 1   },  // Rosa vibrante
  { level: 1,  name: '2Kg',    weight: 2,    radius: 44,  color: 0x845ec2, borderColor: 0x6a4b9b, points: 3   },  // Roxo
  { level: 2,  name: '4Kg',    weight: 4,    radius: 60,  color: 0x00c9a7, borderColor: 0x00a186, points: 6   },  // Verde-água
  { level: 3,  name: '8Kg',    weight: 8,    radius: 74,  color: 0xffc75f, borderColor: 0xcc9f4c, points: 10  },  // Amarelo dourado
  { level: 4,  name: '16Kg',   weight: 16,   radius: 90,  color: 0xff8066, borderColor: 0xcc6652, points: 15  },  // Coral
  { level: 5,  name: '32Kg',   weight: 32,   radius: 104, color: 0x4b7bec, borderColor: 0x3c63bd, points: 21  },  // Azul royal
  { level: 6,  name: '64Kg',   weight: 64,   radius: 120, color: 0x2bcbba, borderColor: 0x23a295, points: 28  },  // Turquesa
  { level: 7,  name: '128Kg',  weight: 128,  radius: 136, color: 0xfc5c65, borderColor: 0xca4a51, points: 36  },  // Vermelho
  { level: 8,  name: '256Kg',  weight: 256,  radius: 152, color: 0xf7b731, borderColor: 0xc69228, points: 45  },  // Laranja
  { level: 9,  name: '512Kg',  weight: 512,  radius: 170, color: 0x45aaf2, borderColor: 0x3788c2, points: 55  },  // Azul claro
  { level: 10, name: '1Ton',   weight: 1024, radius: 190, color: 0x20bf6b, borderColor: 0x1a9956, points: 66  },  // Verde esmeralda
];

/**
 * Apenas as 5 mais leves (1Kg a 16Kg) aparecem no spawn.
 */
export const SPAWN_MAX_LEVEL = 4;
