/**
 * Cena de Ranking — tela inicial e pós game over.
 *
 * Exibe top 10 com medalhas para os 3 primeiros.
 * Se o jogador acabou de entrar no pódio (top 3),
 * lança confetes/serpentinas e toca música de vitória.
 *
 * Inclui botões de tema (claro/escuro) e som na parte superior.
 */

import Phaser from 'phaser';
import { RankingManager, type RankingEntry } from '../ranking/RankingManager';
import { soundManager } from '../audio/SoundManager';
import { themeManager } from '../config/ThemeManager';

export class RankingScene extends Phaser.Scene {
  constructor() {
    super({ key: 'RankingScene' });
  }

  create(): void {
    const c = themeManager.cores;

    // Aplicar cor de fundo do tema atual
    this.cameras.main.setBackgroundColor(c.background);

    // Título estilizado
    this.add.text(480, 50, 'MERGE', {
      fontFamily: 'Bungee Shade, Bungee, Arial Black',
      fontSize: '72px',
      color: c.titlePrimary,
    }).setOrigin(0.5, 0);

    this.add.text(480, 135, '& GROW', {
      fontFamily: 'Bungee, Arial Black',
      fontSize: '40px',
      color: c.titleSecondary,
    }).setOrigin(0.5, 0);

    this.add.text(480, 200, 'Junte bolas de mesmo peso!', {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: c.textTertiary,
    }).setOrigin(0.5);

    this.add.text(480, 280, 'RANKING', {
      fontFamily: 'Bungee, Arial Black',
      fontSize: '40px',
      color: c.titlePrimary,
    }).setOrigin(0.5);

    const ranking = RankingManager.carregarRanking();
    this.exibirRanking(ranking);
    this.criarBotaoJogar();
    this.criarBotoesUI();

    // Verificar se o jogador acabou de entrar no pódio (top 3)
    const posicao: number = this.registry.get('ultimaPosicaoRanking') ?? -1;
    if (posicao >= 0 && posicao < 3) {
      this.celebrarPodio();
    }
    // Limpar para não repetir na próxima vez que abrir o ranking
    this.registry.set('ultimaPosicaoRanking', -1);
  }

  /**
   * Cria os botões de tema e som no canto superior esquerdo.
   * Ambos ficam visíveis na tela inicial para fácil acesso.
   */
  private criarBotoesUI(): void {
    const c = themeManager.cores;

    // Botão de tema — alterna entre claro e escuro
    const iconeTema = themeManager.escuro ? '🌙' : '☀️';
    const botaoTema = this.add.text(75, 50, iconeTema, {
      fontSize: '40px',
      backgroundColor: c.uiBackground,
      padding: { x: 18, y: 10 },
    }).setOrigin(0.5).setDepth(5).setInteractive({ useHandCursor: true });

    botaoTema.on('pointerdown', () => {
      soundManager.tocarClick();
      themeManager.alternar();
      // Reiniciar a cena para aplicar o novo tema em todos os elementos
      this.scene.restart();
    });

    // Botão de som — alterna mudo/ligado
    const iconeSom = soundManager.mutado ? '🔇' : '🔊';
    const botaoSom = this.add.text(75, 120, iconeSom, {
      fontSize: '40px',
      backgroundColor: c.uiBackground,
      padding: { x: 18, y: 10 },
    }).setOrigin(0.5).setDepth(5).setInteractive({ useHandCursor: true });

    botaoSom.on('pointerdown', () => {
      soundManager.inicializar();
      const mutado = soundManager.toggleMudo();
      botaoSom.setText(mutado ? '🔇' : '🔊');
      if (!mutado) soundManager.tocarClick();
    });
  }

  private exibirRanking(ranking: RankingEntry[]): void {
    const c = themeManager.cores;
    const inicioY = 350;
    const espacamento = 60;

    if (ranking.length === 0) {
      this.add.text(480, inicioY + 140, 'Nenhuma pontuação registrada.\nSeja o primeiro!', {
        fontFamily: 'Arial',
        fontSize: '30px',
        color: c.textTertiary,
        align: 'center',
      }).setOrigin(0.5);
      return;
    }

    this.add.text(155, inicioY, '#', {
      fontFamily: 'Arial Black', fontSize: '26px', color: c.textTertiary,
    });
    this.add.text(230, inicioY, 'JOGADOR', {
      fontFamily: 'Arial Black', fontSize: '26px', color: c.textTertiary,
    });
    this.add.text(700, inicioY, 'PONTOS', {
      fontFamily: 'Arial Black', fontSize: '26px', color: c.textTertiary,
    });

    const sep = this.add.graphics();
    sep.lineStyle(2, c.separator);
    sep.moveTo(130, inicioY + 40);
    sep.lineTo(830, inicioY + 40);
    sep.strokePath();

    const medalhas = ['🥇', '🥈', '🥉'];
    const coresPosicao = c.medalColors;

    ranking.forEach((entrada, i) => {
      const y = inicioY + 55 + i * espacamento;
      const cor = i < 3 ? coresPosicao[i] : c.textPrimary;
      const corPontos = i < 3 ? coresPosicao[i] : c.textSecondary;

      if (i < 3) {
        this.add.text(115, y, medalhas[i], {
          fontSize: '32px',
        }).setOrigin(0, 0.5);

        this.add.text(165, y, `${i + 1}°`, {
          fontFamily: 'Arial Black', fontSize: '28px', color: cor,
        }).setOrigin(0.5);
      } else {
        this.add.text(165, y, `${i + 1}°`, {
          fontFamily: 'Arial Black', fontSize: '28px', color: cor,
        }).setOrigin(0.5);
      }

      this.add.text(230, y, entrada.nome, {
        fontFamily: 'Arial', fontSize: '28px', color: cor,
      }).setOrigin(0, 0.5);

      this.add.text(700, y, `${entrada.pontos}`, {
        fontFamily: 'Arial Black', fontSize: '28px', color: corPontos,
      }).setOrigin(0, 0.5);
    });
  }

  private criarBotaoJogar(): void {
    const c = themeManager.cores;

    const botao = this.add.text(480, 1250, 'JOGAR', {
      fontFamily: 'Bungee, Arial Black',
      fontSize: '52px',
      color: '#2ed573',
      backgroundColor: c.uiBackground,
      padding: { x: 60, y: 20 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    botao.on('pointerover', () => botao.setStyle({ color: '#7bed9f' }));
    botao.on('pointerout', () => botao.setStyle({ color: '#2ed573' }));
    botao.on('pointerdown', () => {
      soundManager.inicializar();
      soundManager.tocarClick();
      this.scene.start('GameScene');
    });
  }

  /**
   * Celebração de pódio — confetes, serpentinas e música de vitória.
   * Disparado quando o jogador entra no top 3 do ranking.
   */
  private celebrarPodio(): void {
    soundManager.tocarVitoria();

    // ── 3 ondas de confetes e serpentinas, espaçadas por 1500ms ──
    const ONDAS = 3;
    const INTERVALO_ONDA = 1500; // ms entre cada lançamento

    for (let onda = 0; onda < ONDAS; onda++) {
      const delayBase = onda * INTERVALO_ONDA;
      this.lancarOndaCelebracao(delayBase);
    }
  }

  /**
   * Lança uma onda de confetes e serpentinas com delay base.
   * Separado em método para permitir múltiplos lançamentos.
   */
  private lancarOndaCelebracao(delayBase: number): void {
    const cores = [0xff4d6a, 0xffd700, 0x4b7bec, 0x2ed573, 0xff8066, 0x845ec2, 0x00c9a7, 0xfc5c65];

    // ── Confetes (40 retângulos por onda) ──
    for (let i = 0; i < 40; i++) {
      const cor = Phaser.Utils.Array.GetRandom(cores);
      const x = Phaser.Math.Between(60, 900);
      const largura = Phaser.Math.Between(8, 18);
      const altura = Phaser.Math.Between(8, 18);

      const confete = this.add.rectangle(x, Phaser.Math.Between(-60, -300), largura, altura, cor);
      confete.setDepth(19);
      confete.setAlpha(0.9);

      const delay = delayBase + Phaser.Math.Between(0, 800);

      this.tweens.add({
        targets: confete,
        y: Phaser.Math.Between(1100, 1500),
        x: x + Phaser.Math.Between(-140, 140),
        angle: Phaser.Math.Between(360, 1080),
        alpha: 0,
        duration: Phaser.Math.Between(2500, 4000),
        delay,
        ease: 'Sine.easeIn',
        onComplete: () => confete.destroy(),
      });
    }

    // ── Serpentinas (15 fitas por onda) ──
    for (let i = 0; i < 15; i++) {
      const cor = Phaser.Utils.Array.GetRandom(cores);
      const x = Phaser.Math.Between(80, 880);

      const serpentina = this.add.rectangle(x, Phaser.Math.Between(-100, -350), 6, Phaser.Math.Between(35, 65), cor);
      serpentina.setDepth(19);
      serpentina.setAlpha(0.85);

      const delay = delayBase + Phaser.Math.Between(0, 500);
      const xInicial = x;
      const amplitude = Phaser.Math.Between(70, 160);
      const velocidadeOndulacao = Phaser.Math.FloatBetween(0.003, 0.006);

      this.tweens.add({
        targets: serpentina,
        y: Phaser.Math.Between(1200, 1500),
        angle: Phaser.Math.Between(180, 540),
        alpha: 0,
        duration: Phaser.Math.Between(3000, 4500),
        delay,
        ease: 'Sine.easeIn',
        onUpdate: (tween) => {
          const progresso = tween.elapsed + delay;
          serpentina.x = xInicial + Math.sin(progresso * velocidadeOndulacao) * amplitude;
        },
        onComplete: () => serpentina.destroy(),
      });
    }
  }
}
