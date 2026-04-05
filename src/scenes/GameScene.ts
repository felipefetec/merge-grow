/**
 * Cena principal do jogo Merge & Grow
 *
 * Canvas 960×1440 nativo — sem zoom de câmera.
 * Física e visual operam no mesmo espaço de coordenadas,
 * eliminando o bug de bolas passando por paredes.
 *
 * Suporta temas claro e escuro via ThemeManager.
 */

import Phaser from 'phaser';
import { FRUITS, SPAWN_MAX_LEVEL } from '../config/fruits';
import { RankingManager } from '../ranking/RankingManager';
import { soundManager } from '../audio/SoundManager';
import { themeManager } from '../config/ThemeManager';

/** Dimensões do container (escala 960×1440) */
const CONTAINER = {
  LEFT: 130,
  RIGHT: 830,
  BOTTOM: 1360,
  DANGER_LINE: 240,
  /**
   * Espessura das paredes — 80px para evitar tunneling.
   * No Matter.js, se uma bola se move mais que a espessura
   * da parede num frame, ela atravessa. 80px é seguro
   * mesmo para bolas de alta velocidade.
   */
  WALL_THICKNESS: 80,
} as const;

const DROP_Y = 160;
const DROP_COOLDOWN = 500;
const GRACA_GAME_OVER_MS = 2000;

interface FruitBody extends MatterJS.BodyType {
  fruitLevel?: number;
  createdAt?: number;
}

export class GameScene extends Phaser.Scene {
  private score = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private previewFruit: Phaser.GameObjects.Arc | null = null;
  private previewText: Phaser.GameObjects.Text | null = null;
  private nextFruitLevel = 0;
  private nextNextFruitLevel = 0;
  private canDrop = false;
  private isGameOver = false;
  private ponteiroPressionado = false;
  private fruitBodies: Map<number, Phaser.GameObjects.Arc> = new Map();
  private mergingBodies: Set<number> = new Set();
  private nextFruitPreview!: Phaser.GameObjects.Arc;
  private nextFruitPreviewText!: Phaser.GameObjects.Text;

  /** Timestamps das uniões recentes — usado para detectar combos */
  private mergesRecentes: number[] = [];

  /** Janela de tempo para contar combos (1 segundo) */
  private static readonly COMBO_JANELA_MS = 1000;

  /** Mínimo de merges na janela para "Combo" */
  private static readonly COMBO_MIN = 3;

  /** Mínimo de merges na janela para "SUPER Combo" */
  private static readonly SUPER_COMBO_MIN = 5;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Inicializar áudio (precisa de interação do usuário — o clique em JOGAR conta)
    soundManager.inicializar();

    // Aplicar cor de fundo do tema atual
    this.cameras.main.setBackgroundColor(themeManager.cores.background);

    this.score = 0;
    this.canDrop = false;
    this.isGameOver = false;
    this.ponteiroPressionado = false;
    this.fruitBodies.clear();
    this.mergingBodies.clear();
    this.mergesRecentes = [];

    this.criarContainer();
    this.criarLinhaPerigo();
    this.criarUI();

    this.nextFruitLevel = this.sortearNivelBola();
    this.nextNextFruitLevel = this.sortearNivelBola();
    this.atualizarPreviewProximaBola();
    this.criarPreviewBola();
    this.configurarControles();
    this.configurarColisoes();

    this.time.delayedCall(600, () => {
      this.canDrop = true;
    });
  }

  // ─── Container ───────────────────────────────────────────────

  private criarContainer(): void {
    const c = themeManager.cores;
    const largura = CONTAINER.RIGHT - CONTAINER.LEFT;
    const W = CONTAINER.WALL_THICKNESS; // 80px — corpo físico grosso

    /**
     * Corpos físicos grossos (80px) para evitar tunneling.
     * Posicionados com a borda interna alinhada exatamente
     * em CONTAINER.LEFT / RIGHT / BOTTOM. A espessura
     * extra vai "para fora" da área de jogo.
     */

    // Chão — borda superior em CONTAINER.BOTTOM
    this.matter.add.rectangle(
      CONTAINER.LEFT + largura / 2, CONTAINER.BOTTOM + W / 2,
      largura + W * 2, W,
      { isStatic: true, label: 'chao' }
    );

    // Parede esquerda — borda direita em CONTAINER.LEFT
    this.matter.add.rectangle(
      CONTAINER.LEFT - W / 2, CONTAINER.BOTTOM / 2,
      W, CONTAINER.BOTTOM + 400,
      { isStatic: true, label: 'paredeEsquerda' }
    );

    // Parede direita — borda esquerda em CONTAINER.RIGHT
    this.matter.add.rectangle(
      CONTAINER.RIGHT + W / 2, CONTAINER.BOTTOM / 2,
      W, CONTAINER.BOTTOM + 400,
      { isStatic: true, label: 'paredeDireita' }
    );

    /** Espessura visual fina (apenas decoração) */
    const VISUAL_W = 20;
    const g = this.add.graphics();
    g.fillStyle(c.containerWall, 1);

    // Chão visual
    g.fillRect(
      CONTAINER.LEFT - VISUAL_W, CONTAINER.BOTTOM,
      largura + VISUAL_W * 2, VISUAL_W
    );
    // Parede esquerda visual
    g.fillRect(
      CONTAINER.LEFT - VISUAL_W, CONTAINER.DANGER_LINE - 40,
      VISUAL_W,
      CONTAINER.BOTTOM - CONTAINER.DANGER_LINE + 40 + VISUAL_W
    );
    // Parede direita visual
    g.fillRect(
      CONTAINER.RIGHT, CONTAINER.DANGER_LINE - 40,
      VISUAL_W,
      CONTAINER.BOTTOM - CONTAINER.DANGER_LINE + 40 + VISUAL_W
    );
  }

  private criarLinhaPerigo(): void {
    const g = this.add.graphics();
    g.lineStyle(3, 0xff0000, 0.5);
    for (let x = CONTAINER.LEFT; x < CONTAINER.RIGHT; x += 36) {
      g.moveTo(x, CONTAINER.DANGER_LINE);
      g.lineTo(Math.min(x + 20, CONTAINER.RIGHT), CONTAINER.DANGER_LINE);
    }
    g.strokePath();
  }

  // ─── UI ──────────────────────────────────────────────────────

  private criarUI(): void {
    const c = themeManager.cores;

    // Título estilizado com fonte Bungee
    this.add.text(480, 30, 'MERGE', {
      fontFamily: 'Bungee Shade, Bungee, Arial Black',
      fontSize: '52px',
      color: c.titlePrimary,
    }).setOrigin(0.5, 0);

    this.add.text(480, 85, '& GROW', {
      fontFamily: 'Bungee, Arial Black',
      fontSize: '28px',
      color: c.titleSecondary,
    }).setOrigin(0.5, 0);

    // Pontuação
    this.scoreText = this.add.text(480, 130, 'Pontos: 0', {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: c.textPrimary,
    }).setOrigin(0.5);

    // Próxima bola
    this.add.text(870, 30, 'Próxima:', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: c.textSecondary,
    }).setOrigin(0.5);

    this.nextFruitPreview = this.add.circle(870, 80, 20, 0xffffff);
    this.nextFruitPreviewText = this.add.text(870, 80, '', {
      fontFamily: 'Arial Black, Arial',
      fontSize: '14px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(1);

    // Botão SAIR — padding grande para toque fácil em mobile
    const botaoDesistir = this.add.text(75, 50, 'SAIR', {
      fontFamily: 'Arial Black, Arial',
      fontSize: '26px',
      color: '#ff4757',
      backgroundColor: c.uiBackground,
      padding: { x: 28, y: 18 },
    }).setOrigin(0.5).setDepth(5).setInteractive({ useHandCursor: true });

    botaoDesistir.on('pointerover', () => botaoDesistir.setStyle({ color: '#ff6b81' }));
    botaoDesistir.on('pointerout', () => botaoDesistir.setStyle({ color: '#ff4757' }));
    botaoDesistir.on('pointerdown', () => {
      if (!this.isGameOver) {
        soundManager.tocarClick();
        this.gameOver();
      }
    });

    // Botão de som — alterna mudo/ligado
    const iconeSom = soundManager.mutado ? '🔇' : '🔊';
    const botaoSom = this.add.text(75, 120, iconeSom, {
      fontSize: '40px',
      backgroundColor: c.uiBackground,
      padding: { x: 18, y: 10 },
    }).setOrigin(0.5).setDepth(5).setInteractive({ useHandCursor: true });

    botaoSom.on('pointerdown', () => {
      const mutado = soundManager.toggleMudo();
      botaoSom.setText(mutado ? '🔇' : '🔊');
      if (!mutado) soundManager.tocarClick();
    });

    // Botão de tema — alterna entre claro e escuro
    const iconeTema = themeManager.escuro ? '🌙' : '☀️';
    const botaoTema = this.add.text(75, 190, iconeTema, {
      fontSize: '40px',
      backgroundColor: c.uiBackground,
      padding: { x: 18, y: 10 },
    }).setOrigin(0.5).setDepth(5).setInteractive({ useHandCursor: true });

    botaoTema.on('pointerdown', () => {
      soundManager.tocarClick();
      themeManager.alternar();
      // Reiniciar a cena para aplicar o novo tema
      this.scene.restart();
    });
  }

  private atualizarPreviewProximaBola(): void {
    const cfg = FRUITS[this.nextNextFruitLevel];
    const raioPreview = Math.min(cfg.radius * 0.5, 34);

    this.nextFruitPreview?.destroy();
    this.nextFruitPreview = this.add.circle(870, 80, raioPreview, cfg.color);
    this.nextFruitPreview.setStrokeStyle(3, cfg.borderColor);

    this.nextFruitPreviewText?.destroy();
    this.nextFruitPreviewText = this.add.text(870, 80, cfg.name, {
      fontFamily: 'Arial Black, Arial',
      fontSize: `${Math.max(12, raioPreview * 0.6)}px`,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(1);
  }

  // ─── Preview e Controles ─────────────────────────────────────

  private sortearNivelBola(): number {
    return Phaser.Math.Between(0, SPAWN_MAX_LEVEL);
  }

  private criarPreviewBola(): void {
    const cfg = FRUITS[this.nextFruitLevel];

    this.previewFruit = this.add.circle(480, DROP_Y, cfg.radius, cfg.color, 0.6);
    this.previewFruit.setStrokeStyle(4, cfg.borderColor);

    this.previewText = this.add.text(480, DROP_Y, cfg.name, {
      fontFamily: 'Arial Black, Arial',
      fontSize: `${Math.max(18, cfg.radius * 0.4)}px`,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(1);
    this.previewText.setAlpha(0.6);
  }

  private configurarControles(): void {
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.previewFruit || this.isGameOver) return;

      const cfg = FRUITS[this.nextFruitLevel];
      const minX = CONTAINER.LEFT + cfg.radius;
      const maxX = CONTAINER.RIGHT - cfg.radius;
      const x = Phaser.Math.Clamp(pointer.x, minX, maxX);

      this.previewFruit.x = x;
      if (this.previewText) this.previewText.x = x;
    });

    this.input.on('pointerdown', () => {
      if (this.canDrop && !this.isGameOver && this.previewFruit) {
        this.ponteiroPressionado = true;
      }
    });

    this.input.on('pointerup', () => {
      if (this.ponteiroPressionado && this.canDrop && !this.isGameOver && this.previewFruit) {
        this.ponteiroPressionado = false;
        this.soltarBola(this.previewFruit.x);
      } else {
        this.ponteiroPressionado = false;
      }
    });
  }

  // ─── Drop ────────────────────────────────────────────────────

  private soltarBola(x: number): void {
    this.canDrop = false;
    this.ponteiroPressionado = false;

    this.criarBolaFisica(x, DROP_Y, this.nextFruitLevel);
    soundManager.tocarDrop();

    this.previewFruit?.destroy();
    this.previewFruit = null;
    this.previewText?.destroy();
    this.previewText = null;

    this.nextFruitLevel = this.nextNextFruitLevel;
    this.nextNextFruitLevel = this.sortearNivelBola();
    this.atualizarPreviewProximaBola();

    this.time.delayedCall(DROP_COOLDOWN, () => {
      if (!this.isGameOver) {
        this.criarPreviewBola();
        this.canDrop = true;
      }
    });
  }

  // ─── Bolas com Física ────────────────────────────────────────

  private criarBolaFisica(x: number, y: number, nivel: number): Phaser.GameObjects.Arc {
    const cfg = FRUITS[nivel];

    const bola = this.add.circle(x, y, cfg.radius, cfg.color);
    bola.setStrokeStyle(4, cfg.borderColor);

    const textoPeso = this.add.text(x, y, cfg.name, {
      fontFamily: 'Arial Black, Arial',
      fontSize: `${Math.max(18, cfg.radius * 0.4)}px`,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(1);

    bola.setData('textoPeso', textoPeso);

    // Densidade proporcional ao peso real
    const BASE_DENSITY = 0.0008;
    const area = Math.PI * cfg.radius * cfg.radius;
    const densidade = (cfg.weight * BASE_DENSITY) / area;

    const body = this.matter.add.circle(x, y, cfg.radius, {
      restitution: 0.2,
      friction: 0.3,
      frictionAir: 0.01,
      density: densidade,
      label: 'bola',
    }) as FruitBody;

    body.fruitLevel = nivel;
    body.createdAt = this.time.now;

    bola.setData('body', body);
    this.fruitBodies.set(body.id, bola);

    return bola;
  }

  // ─── Merge ───────────────────────────────────────────────────

  private configurarColisoes(): void {
    this.matter.world.on('collisionstart', (
      event: Phaser.Physics.Matter.Events.CollisionStartEvent
    ) => {
      for (const pair of event.pairs) {
        const bodyA = pair.bodyA as FruitBody;
        const bodyB = pair.bodyB as FruitBody;

        if (bodyA.label !== 'bola' || bodyB.label !== 'bola') continue;
        if (bodyA.fruitLevel === undefined || bodyB.fruitLevel === undefined) continue;
        if (bodyA.fruitLevel !== bodyB.fruitLevel) continue;
        if (this.mergingBodies.has(bodyA.id) || this.mergingBodies.has(bodyB.id)) continue;
        if (bodyA.fruitLevel >= FRUITS.length - 1) continue;

        this.realizarMerge(bodyA, bodyB);
      }
    });
  }

  private realizarMerge(bodyA: FruitBody, bodyB: FruitBody): void {
    this.mergingBodies.add(bodyA.id);
    this.mergingBodies.add(bodyB.id);

    const novoNivel = bodyA.fruitLevel! + 1;
    const novaCfg = FRUITS[novoNivel];

    const posX = (bodyA.position.x + bodyB.position.x) / 2;
    const posY = (bodyA.position.y + bodyB.position.y) / 2;

    this.removerBola(bodyA);
    this.removerBola(bodyB);

    const novaBola = this.criarBolaFisica(posX, posY, novoNivel);

    this.tweens.add({
      targets: novaBola,
      scaleX: { from: 0.5, to: 1 },
      scaleY: { from: 0.5, to: 1 },
      duration: 200,
      ease: 'Back.easeOut',
    });

    this.criarEfeitoMerge(posX, posY, novaCfg.color);
    soundManager.tocarMerge();

    this.score += novaCfg.points;
    this.scoreText.setText(`Pontos: ${this.score}`);

    // Registrar merge e verificar combo
    this.registrarMergeParaCombo();

    this.mergingBodies.delete(bodyA.id);
    this.mergingBodies.delete(bodyB.id);
  }

  /**
   * Registra o timestamp do merge e verifica se atingiu combo.
   *
   * Remove merges antigos (fora da janela de 1s) e conta
   * quantos aconteceram dentro da janela. Se atingir o mínimo,
   * exibe o efeito de Combo ou SUPER Combo no centro da tela.
   */
  private registrarMergeParaCombo(): void {
    const agora = this.time.now;

    // Adicionar merge atual
    this.mergesRecentes.push(agora);

    // Limpar merges fora da janela de 1 segundo
    this.mergesRecentes = this.mergesRecentes.filter(
      (t) => agora - t < GameScene.COMBO_JANELA_MS
    );

    const quantidade = this.mergesRecentes.length;

    if (quantidade >= GameScene.SUPER_COMBO_MIN) {
      this.exibirEfeitoCombo('SUPER COMBO!', `${quantidade}x`, 0xffd700);
      this.lancarConfetes();
      soundManager.tocarSuperCombo();
    } else if (quantidade >= GameScene.COMBO_MIN) {
      this.exibirEfeitoCombo('Combo!', `${quantidade}x`, 0x4b7bec);
      soundManager.tocarCombo();
    }
  }

  /**
   * Exibe texto de combo no centro da tela com animação.
   * O texto cresce, sobe e desaparece em ~1 segundo.
   *
   * @param titulo - "Combo!" ou "SUPER COMBO!"
   * @param multiplicador - ex: "3x", "8x"
   * @param cor - cor hexadecimal do texto
   */
  private exibirEfeitoCombo(titulo: string, multiplicador: string, cor: number): void {
    const corHex = `#${cor.toString(16).padStart(6, '0')}`;

    // Texto principal do combo
    const textoCombo = this.add.text(480, 650, titulo, {
      fontFamily: 'Bungee, Arial Black',
      fontSize: '72px',
      color: corHex,
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(20).setAlpha(0);

    // Multiplicador abaixo
    const textoMulti = this.add.text(480, 730, multiplicador, {
      fontFamily: 'Bungee, Arial Black',
      fontSize: '48px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(20).setAlpha(0);

    // Animação: aparece com escala → fica visível 1.5s → sobe e desaparece
    this.tweens.add({
      targets: textoCombo,
      alpha: { from: 0, to: 1 },
      scaleX: { from: 1.5, to: 1 },
      scaleY: { from: 1.5, to: 1 },
      y: textoCombo.y - 80,
      duration: 400,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: textoCombo,
          alpha: 0,
          y: textoCombo.y - 80,
          duration: 600,
          delay: 1500,
          ease: 'Power2',
          onComplete: () => textoCombo.destroy(),
        });
      },
    });

    this.tweens.add({
      targets: textoMulti,
      alpha: { from: 0, to: 1 },
      scaleX: { from: 1.5, to: 1 },
      scaleY: { from: 1.5, to: 1 },
      y: textoMulti.y - 80,
      duration: 400,
      ease: 'Back.easeOut',
      delay: 100,
      onComplete: () => {
        this.tweens.add({
          targets: textoMulti,
          alpha: 0,
          y: textoMulti.y - 80,
          duration: 600,
          delay: 1400,
          ease: 'Power2',
          onComplete: () => textoMulti.destroy(),
        });
      },
    });
  }

  /**
   * Lança confetes e serpentinas pela tela durante SUPER COMBO.
   *
   * Cria dois tipos de partículas:
   * - Confetes: retângulos pequenos coloridos que caem girando
   * - Serpentinas: retângulos finos e longos que ondulam ao cair
   *
   * Todas as partículas nascem no topo da tela em posições X aleatórias,
   * caem com gravidade simulada via tween e se auto-destroem ao final.
   */
  private lancarConfetes(): void {
    /** Cores vibrantes dos confetes e serpentinas */
    const cores = [0xff4d6a, 0xffd700, 0x4b7bec, 0x2ed573, 0xff8066, 0x845ec2, 0x00c9a7, 0xfc5c65];

    // ── Confetes (50 retângulos pequenos que caem girando) ──
    for (let i = 0; i < 50; i++) {
      const cor = Phaser.Utils.Array.GetRandom(cores);
      const x = Phaser.Math.Between(80, 880);
      const largura = Phaser.Math.Between(8, 16);
      const altura = Phaser.Math.Between(8, 16);

      const confete = this.add.rectangle(x, Phaser.Math.Between(-50, -200), largura, altura, cor);
      confete.setDepth(19);
      confete.setAlpha(0.9);

      // Atraso aleatório para espalhar o efeito no tempo
      const delay = Phaser.Math.Between(0, 600);

      // Queda com rotação — simula confete girando no ar
      this.tweens.add({
        targets: confete,
        y: Phaser.Math.Between(1000, 1500),
        x: x + Phaser.Math.Between(-120, 120),  // Deslocamento lateral
        angle: Phaser.Math.Between(360, 1080),    // Gira 1~3 voltas
        alpha: 0,
        duration: Phaser.Math.Between(2000, 3500),
        delay,
        ease: 'Sine.easeIn',
        onComplete: () => confete.destroy(),
      });
    }

    // ── Serpentinas (20 fitas longas que ondulam ao cair) ──
    for (let i = 0; i < 20; i++) {
      const cor = Phaser.Utils.Array.GetRandom(cores);
      const x = Phaser.Math.Between(100, 860);

      // Serpentina = retângulo fino e longo
      const serpentina = this.add.rectangle(x, Phaser.Math.Between(-80, -250), 6, Phaser.Math.Between(30, 60), cor);
      serpentina.setDepth(19);
      serpentina.setAlpha(0.85);

      const delay = Phaser.Math.Between(0, 400);

      // Queda ondulante — o X oscila com uma curva senoidal via onUpdate
      const xInicial = x;
      const amplitude = Phaser.Math.Between(60, 150);
      const velocidadeOndulacao = Phaser.Math.FloatBetween(0.003, 0.006);

      this.tweens.add({
        targets: serpentina,
        y: Phaser.Math.Between(1100, 1500),
        angle: Phaser.Math.Between(180, 540),
        alpha: 0,
        duration: Phaser.Math.Between(2500, 4000),
        delay,
        ease: 'Sine.easeIn',
        onUpdate: (tween) => {
          // Movimento senoidal lateral — ondulação da serpentina
          const progresso = tween.elapsed + delay;
          serpentina.x = xInicial + Math.sin(progresso * velocidadeOndulacao) * amplitude;
        },
        onComplete: () => serpentina.destroy(),
      });
    }
  }

  private criarEfeitoMerge(x: number, y: number, cor: number): void {
    for (let i = 0; i < 8; i++) {
      const angulo = (i / 8) * Math.PI * 2;
      const particula = this.add.circle(x, y, 8, cor, 0.8);

      this.tweens.add({
        targets: particula,
        x: x + Math.cos(angulo) * 60,
        y: y + Math.sin(angulo) * 60,
        alpha: 0,
        scale: 0.2,
        duration: 300,
        ease: 'Power2',
        onComplete: () => particula.destroy(),
      });
    }
  }

  private removerBola(body: FruitBody): void {
    const bola = this.fruitBodies.get(body.id);
    if (bola) {
      const texto = bola.getData('textoPeso') as Phaser.GameObjects.Text;
      if (texto) texto.destroy();
      bola.destroy();
      this.fruitBodies.delete(body.id);
    }
    this.matter.world.remove(body);
  }

  // ─── Game Loop ───────────────────────────────────────────────

  /**
   * Velocidade máxima permitida para qualquer bola.
   * Previne tunneling: se uma bola se move mais que a espessura
   * da parede (80px) num frame (~16ms a 60fps), ela pode atravessar.
   * Com MAX_VELOCITY=25, ela move no máximo ~25px/frame — seguro.
   */
  private static readonly MAX_VELOCITY = 25;

  update(): void {
    if (this.isGameOver) return;

    this.fruitBodies.forEach((bola) => {
      const body = bola.getData('body') as FruitBody;
      if (!body?.position) return;

      // Limitar velocidade para evitar tunneling através das paredes
      const vx = body.velocity.x;
      const vy = body.velocity.y;
      const speed = Math.sqrt(vx * vx + vy * vy);
      if (speed > GameScene.MAX_VELOCITY) {
        const fator = GameScene.MAX_VELOCITY / speed;
        this.matter.body.setVelocity(body, {
          x: vx * fator,
          y: vy * fator,
        });
      }

      // Sincronizar visual com física
      bola.x = body.position.x;
      bola.y = body.position.y;

      const texto = bola.getData('textoPeso') as Phaser.GameObjects.Text;
      if (texto) {
        texto.x = body.position.x;
        texto.y = body.position.y;
      }
    });

    this.verificarGameOver();
  }

  private verificarGameOver(): void {
    this.fruitBodies.forEach((bola) => {
      const body = bola.getData('body') as FruitBody;
      if (!body?.position) return;

      const tempoDeVida = this.time.now - (body.createdAt ?? 0);
      if (tempoDeVida < GRACA_GAME_OVER_MS) return;

      const acimaDaLinha = body.position.y < CONTAINER.DANGER_LINE;
      const velocidade = Math.abs(body.velocity.y) + Math.abs(body.velocity.x);

      if (acimaDaLinha && velocidade < 1) {
        this.gameOver();
      }
    });
  }

  // ─── Game Over ───────────────────────────────────────────────

  private gameOver(): void {
    const c = themeManager.cores;
    this.isGameOver = true;
    soundManager.tocarGameOver();

    this.previewFruit?.destroy();
    this.previewFruit = null;
    this.previewText?.destroy();
    this.previewText = null;

    const overlay = this.add.rectangle(480, 720, 960, 1440, c.gameOverOverlay, c.gameOverOverlayAlpha);
    overlay.setDepth(10);

    this.add.text(480, 400, 'FIM DE JOGO', {
      fontFamily: 'Bungee, Arial Black',
      fontSize: '64px',
      color: '#ff4757',
    }).setOrigin(0.5).setDepth(11);

    this.add.text(480, 500, `Pontuação: ${this.score}`, {
      fontFamily: 'Arial',
      fontSize: '44px',
      color: c.textPrimary,
    }).setOrigin(0.5).setDepth(11);

    this.add.text(480, 590, 'Seu apelido (máx. 10 letras):', {
      fontFamily: 'Arial',
      fontSize: '26px',
      color: c.textSecondary,
    }).setOrigin(0.5).setDepth(11);

    /**
     * Input HTML real sobreposto ao canvas.
     * Necessário para ativar o teclado virtual em mobile/tablet.
     * O Phaser DOM element não funciona bem com Scale.FIT,
     * então criamos o input direto no DOM e posicionamos via CSS.
     */
    const inputHTML = document.createElement('input');
    inputHTML.type = 'text';
    inputHTML.maxLength = 10;
    inputHTML.placeholder = 'Apelido...';
    inputHTML.autocomplete = 'off';
    inputHTML.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 280px;
      padding: 14px 20px;
      font-family: 'Arial Black', Arial, sans-serif;
      font-size: 24px;
      color: ${c.inputText};
      background: ${c.inputBackground};
      border: 3px solid ${c.inputBorder};
      border-radius: 12px;
      text-align: center;
      outline: none;
      z-index: 1000;
    `;
    document.body.appendChild(inputHTML);

    // Focar o input para abrir o teclado virtual em mobile
    setTimeout(() => inputHTML.focus(), 100);

    // Espelho do texto no canvas (para quem vê o jogo no desktop)
    const textoApelido = this.add.text(480, 700, '|', {
      fontFamily: 'Arial Black, Arial',
      fontSize: '48px',
      color: c.inputText,
      backgroundColor: c.inputBackground,
      padding: { x: 30, y: 12 },
    }).setOrigin(0.5).setDepth(11);

    // Botão SALVAR — visível e grande para toque em mobile
    const botaoSalvar = this.add.text(480, 810, 'SALVAR', {
      fontFamily: 'Bungee, Arial Black',
      fontSize: '36px',
      color: '#2ed573',
      backgroundColor: c.uiBackground,
      padding: { x: 40, y: 16 },
    }).setOrigin(0.5).setDepth(11).setInteractive({ useHandCursor: true });

    botaoSalvar.on('pointerover', () => botaoSalvar.setStyle({ color: '#7bed9f' }));
    botaoSalvar.on('pointerout', () => botaoSalvar.setStyle({ color: '#2ed573' }));

    /** Salva pontuação e vai para o ranking */
    const salvar = () => {
      const nome = inputHTML.value.trim();
      if (nome.length === 0) return;
      soundManager.tocarClick();
      inputHTML.remove();
      const posicao = RankingManager.salvarPontuacao(nome, this.score);
      // Passar a posição para a RankingScene via registry
      this.registry.set('ultimaPosicaoRanking', posicao);
      this.scene.start('RankingScene');
    };

    // Salvar ao clicar no botão
    botaoSalvar.on('pointerdown', salvar);

    // Salvar ao pressionar ENTER (desktop)
    inputHTML.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') salvar();
    });

    // Sincronizar texto do input HTML com o espelho no canvas
    inputHTML.addEventListener('input', () => {
      const valor = inputHTML.value;
      textoApelido.setText(valor.length > 0 ? valor : '|');
    });

    /**
     * Limpar o input HTML se a cena for destruída sem salvar
     * (ex: refresh da página). Evita elementos órfãos no DOM.
     */
    this.events.on('shutdown', () => {
      if (inputHTML.parentNode) inputHTML.remove();
    });
  }
}
