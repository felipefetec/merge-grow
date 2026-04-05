/**
 * Arquivo principal do jogo Merge & Grow
 *
 * Canvas em alta resolução (960×1440) sem zoom de câmera.
 * Todas as coordenadas do jogo são nativas do canvas.
 * A fonte Bungee é carregada via Google Fonts para o título.
 */

import Phaser from 'phaser';
import { RankingScene } from './scenes/RankingScene';
import { GameScene } from './scenes/GameScene';
import { themeManager } from './config/ThemeManager';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 960,
  height: 1440,
  parent: 'game-container',

  render: {
    antialias: true,
    roundPixels: true,
  },

  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: 3 },
      debug: false,
      /**
       * Mais iterações de posição e velocidade por frame.
       * Ajuda o solver a resolver colisões corretamente,
       * especialmente quando múltiplas bolas se empilham.
       * Padrão é 6/4 — valores maiores = mais preciso.
       */
      positionIterations: 10,
      velocityIterations: 8,
    },
  },

  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },

  backgroundColor: themeManager.cores.background,
  scene: [RankingScene, GameScene],
};

new Phaser.Game(config);
