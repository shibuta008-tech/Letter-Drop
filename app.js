(function () {
  class LetterDropGame {
    constructor() {
      this.cols = 6;
      this.rows = 10;
      this.fallInterval = 0.7;
      this.matchRules = [
        { text: "オチンチン", points: 200 },
        { text: "オチンポコ", points: 200 },
        { text: "オチンコ", points: 100 },
        { text: "オチンポ", points: 100 },
        { text: "チンチン", points: 100 },
        { text: "チンポコ", points: 100 },
        { text: "コンポウ", points: 100 },
        { text: "オンコウ", points: 100 },
        { text: "コンコン", points: 100 },
        { text: "ポンポン", points: 100 },
        { text: "ポンポコ", points: 100 },
        { text: "コンポン", points: 100 },
        { text: "ポコチン", points: 100 },
        { text: "チンコ", points: 50 },
        { text: "チンポ", points: 50 },
        { text: "ウンコ", points: 50 },
        { text: "ウンチ", points: 50 },
        { text: "ウマ", points: 10 },
        { text: "ママ", points: 10 },
        { text: "マチ", points: 10 },
        { text: "ポチ", points: 10 },
        { text: "ポン", points: 10 },
      ];
      this.forbiddenWord = "マンコ";
      this.vitaminColors = [
        "#ff2e2e",
        "#ff8500",
        "#ffe100",
        "#0dd12e",
        "#00c7ff",
        "#06b2bb",
        "#b814ff",
        "#ff14c7",
        "#ff527d",
        "#00d9b8",
      ];
      this.charPool = this.createCharPool();
      this.clearAnimationDuration = 0.42;
      this.reset();
    }

    createCharPool() {
      const weightedTexts = [
        ...this.matchRules.map((rule) => rule.text),
        this.forbiddenWord,
      ];
      const counts = new Map();

      weightedTexts.forEach((text) => {
        Array.from(text).forEach((char) => {
          counts.set(char, (counts.get(char) ?? 0) + 1);
        });
      });

      const weightingBoost = {
        オ: 3,
        ウ: 4,
        コ: 6,
        チ: 6,
        マ: 4,
        ポ: 5,
        ン: 8,
        "♥": 4,
      };

      const weighted = Array.from(counts.entries()).map(([char, count]) => [
        char,
        count * 4 + (weightingBoost[char] ?? 0),
      ]);

      weighted.push(["♥", weightingBoost["♥"]]);
      return weighted.flatMap(([char, count]) => Array.from({ length: count }, () => char));
    }

    emptyGrid() {
      return Array.from({ length: this.rows }, () => Array(this.cols).fill(null));
    }

    randomChar() {
      return this.charPool[Math.floor(Math.random() * this.charPool.length)];
    }

    randomColorIndex() {
      return Math.floor(Math.random() * this.vitaminColors.length);
    }

    reset() {
      this.grid = this.emptyGrid();
      this.curCh = "ウ";
      this.curCol = Math.floor(this.cols / 2);
      this.curRow = 0;
      this.curRotation = 0;
      this.curColorIndex = 0;
      this.nextCh = this.randomChar();
      this.nextColorIndex = this.randomColorIndex();
      this.fallTimer = 0;
      this.score = 0;
      this.comboDisplay = "1x";
      this.statusText = "役を作ってください";
      this.matchedText = "5文字 200点 / 4文字 100点 / 3文字 50点 / 2文字 10点 / 末尾♥で2倍";
      this.gameOver = false;
      this.gameOverReason = "";
      this.clearAnimation = null;
      this.resolutionState = null;
      this.spawn();
    }

    spawnNext() {
      this.nextCh = this.randomChar();
      this.nextColorIndex = this.randomColorIndex();
    }

    spawn() {
      this.curCh = this.nextCh;
      this.curColorIndex = this.nextColorIndex;
      this.curCol = Math.floor(this.cols / 2);
      this.curRow = 0;
      this.curRotation = 0;
      this.spawnNext();
      if (this.grid[0][this.curCol] !== null) {
        this.gameOver = true;
        this.gameOverReason = "つみあがりました";
        this.statusText = "R またはクリックで再スタート";
      }
    }

    rotate() {
      if (this.gameOver || this.clearAnimation) return;
      this.curRotation = (this.curRotation + 3) % 4;
    }

    moveLeft() {
      if (this.gameOver || this.clearAnimation) return;
      if (this.curCol > 0 && this.grid[this.curRow][this.curCol - 1] === null) {
        this.curCol -= 1;
      }
    }

    moveRight() {
      if (this.gameOver || this.clearAnimation) return;
      if (this.curCol + 1 < this.cols && this.grid[this.curRow][this.curCol + 1] === null) {
        this.curCol += 1;
      }
    }

    hardDrop() {
      if (this.gameOver || this.clearAnimation) return;
      while (this.curRow + 1 < this.rows && this.grid[this.curRow + 1][this.curCol] === null) {
        this.curRow += 1;
      }
      this.place();
    }

    place() {
      this.grid[this.curRow][this.curCol] = {
        ch: this.curCh,
        colorIndex: this.curColorIndex,
        rotation: this.curRotation,
      };
      this.fallTimer = 0;
      this.resolutionState = {
        comboMultiplier: 1,
        cumulativeBase: 0,
        resolvedAtLeastOnce: false,
      };
      this.advanceResolution();
    }

    update(dt) {
      if (this.gameOver) return;
      if (this.clearAnimation) {
        this.clearAnimation.elapsed += dt;
        if (this.clearAnimation.elapsed >= this.clearAnimation.duration) {
          this.clearCells(this.clearAnimation.cellKeys);
          this.applyGravity();
          this.clearAnimation = null;
          this.advanceResolution();
        }
        return;
      }
      this.fallTimer += dt;
      if (this.fallTimer < this.fallInterval) return;
      this.fallTimer = 0;
      if (this.curRow + 1 < this.rows && this.grid[this.curRow + 1][this.curCol] === null) {
        this.curRow += 1;
      } else {
        this.place();
      }
    }

    ghostRow() {
      let ghost = this.curRow;
      while (ghost + 1 < this.rows && this.grid[ghost + 1][this.curCol] === null) {
        ghost += 1;
      }
      return ghost;
    }

    resolveBoard() {
      this.advanceResolution();
    }

    advanceResolution() {
      if (!this.resolutionState) return;

      const result = this.findMatches();

      if (result.forbidden) {
        this.score = 0;
        this.comboDisplay = "0x";
        this.statusText = "マンコでゲームオーバー";
        this.matchedText = "スコアは 0 点になりました";
        this.gameOver = true;
        this.gameOverReason = "マンコが揃いました";
        this.clearAnimation = null;
        this.resolutionState = null;
        return;
      }

      if (result.matches.length === 0) {
        if (!this.resolutionState.resolvedAtLeastOnce) {
          this.comboDisplay = "1x";
          this.statusText = "役を作ってください";
        }
        this.resolutionState = null;
        if (!this.gameOver) {
          this.spawn();
        }
        return;
      }

      this.resolutionState.resolvedAtLeastOnce = true;
      const waveBase = result.matches.reduce((sum, match) => sum + match.points, 0);
      this.resolutionState.cumulativeBase += waveBase;
      const gained = this.resolutionState.cumulativeBase * this.resolutionState.comboMultiplier;

      this.score += gained;
      this.comboDisplay = `${this.resolutionState.comboMultiplier}x`;
      this.statusText = this.resolutionState.comboMultiplier > 1 ? `COMBO +${gained}` : `CLEAR +${gained}`;
      this.matchedText = result.matches.map((match) => match.label).join(" / ");

      this.clearAnimation = {
        elapsed: 0,
        duration: this.clearAnimationDuration,
        cellKeys: result.cells,
        cells: result.cells.map((key) => {
          const [row, col] = key.split(",").map(Number);
          const cell = this.grid[row][col];
          return {
            row,
            col,
            rotation: cell?.rotation ?? 0,
            colorIndex: cell?.colorIndex ?? 0,
          };
        }),
      };

      this.resolutionState.comboMultiplier *= 2;
    }

    findMatches() {
      const cells = new Set();
      const matches = [];

      const addCells = (coords) => {
        coords.forEach(({ row, col }) => cells.add(`${row},${col}`));
      };

      for (let row = 0; row < this.rows; row += 1) {
        for (let col = 0; col < this.cols; col += 1) {
          const cell = this.grid[row][col];
          if (!cell) continue;

          for (const { dr, dc } of this.readingDirections(cell.rotation)) {
            const forbiddenCoords = this.matchAt(row, col, dr, dc, this.forbiddenWord, cell.rotation);
            if (forbiddenCoords) {
              return { forbidden: true, matches: [], cells: [] };
            }

            for (const rule of this.matchRules) {
              const coords = this.matchAt(row, col, dr, dc, rule.text, cell.rotation);
              if (!coords) continue;

              const tailRow = row + dr * rule.text.length;
              const tailCol = col + dc * rule.text.length;
              const tailCell = this.cellAt(tailRow, tailCol);
              const hasHeart = tailCell?.ch === "♥" && tailCell.rotation === cell.rotation;
              const allCoords = hasHeart ? [...coords, { row: tailRow, col: tailCol }] : coords;
              const points = hasHeart ? rule.points * 2 : rule.points;

              addCells(allCoords);
              matches.push({
                label: hasHeart ? `${rule.text}♥` : rule.text,
                points,
              });
            }
          }
        }
      }

      return { forbidden: false, matches, cells: Array.from(cells) };
    }

    readingDirections(rotation) {
      switch (rotation % 4) {
        case 1:
          return [
            { dr: 1, dc: 0 },
            { dr: 0, dc: -1 },
          ];
        case 2:
          return [
            { dr: 0, dc: -1 },
            { dr: -1, dc: 0 },
          ];
        case 3:
          return [
            { dr: -1, dc: 0 },
            { dr: 0, dc: 1 },
          ];
        default:
          return [
            { dr: 0, dc: 1 },
            { dr: 1, dc: 0 },
          ];
      }
    }

    matchAt(startRow, startCol, dr, dc, text, rotation) {
      const coords = [];
      for (let i = 0; i < text.length; i += 1) {
        const row = startRow + dr * i;
        const col = startCol + dc * i;
        const cell = this.cellAt(row, col);
        if (!cell || cell.ch !== text[i] || cell.rotation !== rotation) {
          return null;
        }
        coords.push({ row, col });
      }
      return coords;
    }

    cellAt(row, col) {
      if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
        return null;
      }
      return this.grid[row][col];
    }

    clearCells(cells) {
      cells.forEach((key) => {
        const [row, col] = key.split(",").map(Number);
        this.grid[row][col] = null;
      });
    }

    applyGravity() {
      for (let col = 0; col < this.cols; col += 1) {
        const stack = [];
        for (let row = this.rows - 1; row >= 0; row -= 1) {
          if (this.grid[row][col]) {
            stack.push(this.grid[row][col]);
          }
        }
        for (let row = this.rows - 1; row >= 0; row -= 1) {
          this.grid[row][col] = stack[this.rows - 1 - row] ?? null;
        }
      }
    }
  }

  const canvas = document.getElementById("letter-canvas");
  const ctx = canvas.getContext("2d");
  const game = new LetterDropGame();
  const heroCard = document.querySelector(".hero-card");
  const scoreValue = document.getElementById("score-value");
  const comboValue = document.getElementById("combo-value");
  const statusLine = document.getElementById("status-line");
  const matchedLine = document.getElementById("matched-line");
  const yakuCard = document.querySelector(".yaku-card");
  const yakuList = document.getElementById("yaku-list");
  const touchControls = document.querySelector(".touch-controls");
  const rotateButton = document.getElementById("touch-rotate");
  const leftButton = document.getElementById("touch-left");
  const rightButton = document.getElementById("touch-right");
  const dropButton = document.getElementById("touch-drop");

  let previousTime = performance.now();

  function getViewportSize() {
    const viewport = window.visualViewport;
    return {
      width: viewport ? viewport.width : window.innerWidth,
      height: viewport ? viewport.height : window.innerHeight,
    };
  }

  function updateHud() {
    scoreValue.textContent = `${game.score}`;
    comboValue.textContent = game.comboDisplay;
    statusLine.textContent = game.statusText;
    matchedLine.textContent = game.matchedText;
  }

  function renderYakuList() {
    if (!yakuList) return;
    const rows = [...game.matchRules]
      .sort((a, b) => b.points - a.points || b.text.length - a.text.length || a.text.localeCompare(b.text, "ja"))
      .map((rule) => `
        <div class="yaku-row">
          <span class="yaku-word">${rule.text}</span>
          <span class="yaku-points">${rule.points}点</span>
        </div>
      `)
      .join("");
    yakuList.innerHTML = rows;
  }

  function resizeCanvas() {
    const viewport = getViewportSize();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawLetter(char, rotation, color, x, y, fontSize, alpha = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation * Math.PI / 2);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.font = `900 ${fontSize}px "Hiragino Kaku Gothic StdN", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(char, 0, 0);
    ctx.restore();
  }

  function drawClearAnimation(gx, gy, cs, letterSize) {
    if (!game.clearAnimation) return;

    const progress = Math.min(game.clearAnimation.elapsed / game.clearAnimation.duration, 1);

    game.clearAnimation.cells.forEach((cell) => {
      const cx = gx + (cell.col + 0.5) * cs;
      const cy = gy + (cell.row + 0.5) * cs;
      const color = game.vitaminColors[cell.colorIndex % game.vitaminColors.length];

      ctx.save();
      ctx.globalAlpha = (1 - progress) * 0.32;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, cs * (0.18 + progress * 0.42), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const starAlpha = Math.max(1 - progress * 2.2, 0);
      const dotAlpha = Math.min(Math.max((progress - 0.28) / 0.72, 0), 1);
      const starSize = letterSize * (1.02 + progress * 0.2);
      const dotSize = letterSize * (0.48 + progress * 0.1);

      if (starAlpha > 0) {
        drawLetter("※", cell.rotation, color, cx, cy, starSize, starAlpha);
      }
      if (dotAlpha > 0) {
        drawLetter("・", cell.rotation, "#171311", cx, cy, dotSize, dotAlpha);
      }
    });
  }

  function renderBackdrop(width, height) {
    ctx.fillStyle = "#fffaf1";
    ctx.fillRect(0, 0, width, height);

    const glow = [
      { x: width * 0.14, y: height * 0.2, r: Math.min(width, height) * 0.18, color: "rgba(255, 137, 94, 0.12)" },
      { x: width * 0.84, y: height * 0.18, r: Math.min(width, height) * 0.17, color: "rgba(13, 126, 247, 0.12)" },
    ];
    glow.forEach((item) => {
      const gradient = ctx.createRadialGradient(item.x, item.y, 0, item.x, item.y, item.r);
      gradient.addColorStop(0, item.color);
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(item.x, item.y, item.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function renderBoardFrame(gx, gy, cs) {
    const boardW = cs * game.cols;
    const boardH = cs * game.rows;
    const radius = Math.min(30, cs * 0.55);

    ctx.save();
    ctx.fillStyle = "rgba(255, 251, 244, 0.56)";
    ctx.strokeStyle = "rgba(23, 19, 17, 0.08)";
    ctx.lineWidth = 1;
    roundRect(ctx, gx - 16, gy - 16, boardW + 32, boardH + 32, radius);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(23, 19, 17, 0.05)";
    ctx.lineWidth = 1;
    for (let col = 0; col <= game.cols; col += 1) {
      const x = gx + col * cs;
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x, gy + boardH);
      ctx.stroke();
    }
    for (let row = 0; row <= game.rows; row += 1) {
      const y = gy + row * cs;
      ctx.beginPath();
      ctx.moveTo(gx, y);
      ctx.lineTo(gx + boardW, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function roundRect(context, x, y, width, height, radius) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.arcTo(x + width, y, x + width, y + height, radius);
    context.arcTo(x + width, y + height, x, y + height, radius);
    context.arcTo(x, y + height, x, y, radius);
    context.arcTo(x, y, x + width, y, radius);
    context.closePath();
  }

  function render() {
    const viewport = getViewportSize();
    const width = viewport.width;
    const height = viewport.height;
    const heroRect = heroCard ? heroCard.getBoundingClientRect() : null;
    const yakuRect = yakuCard && getComputedStyle(yakuCard).display !== "none" ? yakuCard.getBoundingClientRect() : null;
    const touchRect = touchControls && getComputedStyle(touchControls).display !== "none"
      ? touchControls.getBoundingClientRect()
      : null;
    const desktop = width > 900;
    const leftInset = desktop && heroRect ? heroRect.right + 40 : 0;
    const rightInset = desktop && yakuRect ? width - yakuRect.left + 24 : 0;
    const topInset = desktop
      ? Math.min(180, height * 0.19)
      : Math.max((heroRect?.bottom ?? 0) + 8, 110);
    const bottomLimit = desktop
      ? height - 80
      : Math.max((touchRect?.top ?? height - 96) - 18, topInset + 120);
    const usableWidth = desktop
      ? Math.max(width - leftInset - rightInset, width * 0.32)
      : Math.max(width - 32, width * 0.68);
    const usableHeight = desktop
      ? Math.max(height - topInset - 80, height * 0.35)
      : Math.max(bottomLimit - topInset, height * 0.22);
    const cs = desktop
      ? Math.min(usableWidth / (game.cols + 1.8), usableHeight / game.rows)
      : Math.min(usableWidth / game.cols, usableHeight / game.rows);
    const boardW = cs * game.cols;
    const boardH = cs * game.rows;
    const gx = desktop
      ? leftInset + Math.max((usableWidth - boardW) / 2, 0)
      : Math.max((width - boardW) / 2, 0);
    const gy = desktop
      ? Math.max(topInset, (height - boardH) / 2)
      : topInset + Math.max((usableHeight - boardH) / 2, 0);
    const letterSize = cs * 1.02;

    ctx.clearRect(0, 0, width, height);
    renderBackdrop(width, height);
    renderBoardFrame(gx, gy, cs);
    const clearingKeys = game.clearAnimation ? new Set(game.clearAnimation.cellKeys) : null;

    for (let row = 0; row < game.rows; row += 1) {
      for (let col = 0; col < game.cols; col += 1) {
        const cell = game.grid[row][col];
        if (clearingKeys?.has(`${row},${col}`)) continue;
        if (!cell) continue;
        const cx = gx + (col + 0.5) * cs;
        const cy = gy + (row + 0.5) * cs;
        drawLetter(cell.ch, cell.rotation, game.vitaminColors[cell.colorIndex], cx, cy, letterSize);
      }
    }

    if (!game.gameOver && !game.clearAnimation) {
      const color = game.vitaminColors[game.curColorIndex];
      const ghostRow = game.ghostRow();
      if (ghostRow > game.curRow) {
        const gcx = gx + (game.curCol + 0.5) * cs;
        const gcy = gy + (ghostRow + 0.5) * cs;
        drawLetter(game.curCh, game.curRotation, color, gcx, gcy, letterSize, 0.22);
      }
      const cx = gx + (game.curCol + 0.5) * cs;
      const cy = gy + (game.curRow + 0.5) * cs;
      drawLetter(game.curCh, game.curRotation, color, cx, cy, letterSize);
    }

    drawClearAnimation(gx, gy, cs, letterSize);

    if (desktop) {
      ctx.fillStyle = "rgba(23, 19, 17, 0.42)";
      ctx.font = '700 11px "SF Mono", "Menlo", monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const nextX = Math.min(gx + boardW + 42, width - 34);
      ctx.fillText("NEXT", nextX, gy + 18);
      drawLetter(
        game.nextCh,
        0,
        game.vitaminColors[game.nextColorIndex],
        nextX,
        gy + 50,
        24
      );
    }

    if (game.gameOver) {
      ctx.fillStyle = "rgba(255, 250, 241, 0.8)";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#171311";
      ctx.font = '900 44px "Hiragino Kaku Gothic StdN", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif';
      ctx.fillText("RESET", width / 2, height / 2 - 10);
      ctx.font = '900 16px "Hiragino Kaku Gothic StdN", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif';
      ctx.fillStyle = "rgba(23, 19, 17, 0.56)";
      ctx.fillText(game.gameOverReason || "R またはクリックで再スタート", width / 2, height / 2 + 28);
    }
  }

  function tick(now) {
    const dt = Math.min((now - previousTime) / 1000, 0.05);
    previousTime = now;
    game.update(dt);
    updateHud();
    render();
    requestAnimationFrame(tick);
  }

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (key === "a") game.moveLeft();
    if (key === "d") game.moveRight();
    if (key === "s") {
      event.preventDefault();
      game.hardDrop();
    }
    if (key === "w") game.rotate();
    if (key === "r") game.reset();
  });

  [
    [rotateButton, () => game.rotate()],
    [leftButton, () => game.moveLeft()],
    [rightButton, () => game.moveRight()],
    [dropButton, () => game.hardDrop()],
  ].forEach(([button, action]) => {
    if (!button) return;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      action();
    });
    button.addEventListener("dblclick", (event) => {
      event.preventDefault();
    });
  });

  canvas.addEventListener("pointerdown", () => {
    if (game.gameOver) {
      game.reset();
    }
  });

  let lastTouchEnd = 0;
  document.addEventListener("touchend", (event) => {
    const now = Date.now();
    if (now - lastTouchEnd < 320) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });

  ["gesturestart", "gesturechange", "gestureend"].forEach((eventName) => {
    document.addEventListener(eventName, (event) => {
      event.preventDefault();
    }, { passive: false });
  });

  window.addEventListener("resize", () => {
    resizeCanvas();
    render();
  });

  window.visualViewport?.addEventListener("resize", () => {
    resizeCanvas();
    render();
  });

  resizeCanvas();
  renderYakuList();
  updateHud();
  render();
  requestAnimationFrame(tick);
})();
