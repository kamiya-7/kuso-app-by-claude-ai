import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Difficulty, DIFFICULTY_SETTINGS } from '../types/difficulty';
import Confetti from 'react-confetti';
import { Engine, Bodies, Composite, Body } from 'matter-js';

interface Position {
  x: number;
  y: number;
}

type ButtonExpression = 'normal' | 'escaping' | 'caught';

const EXPRESSIONS: Record<ButtonExpression, string> = {
  normal: 'クリック',
  escaping: 'クリック',
  caught: 'クリック'
};


const EscapeButton: React.FC = () => {
  const [position, setPosition] = useState<Position>({ x: 50, y: 50 });
  const [rotation, setRotation] = useState<number>(0);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [expression, setExpression] = useState<ButtonExpression>('normal');
  const [isShaking, setIsShaking] = useState(false);
  const [isConfettiActive, setIsConfettiActive] = useState(false);
  const [score, setScore] = useState(0);
  const [isScoreAnimating, setIsScoreAnimating] = useState(false);
  const [scoreGain, setScoreGain] = useState<number | null>(null);
  const [isScreenFlash, setIsScreenFlash] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 800,
    height: typeof window !== 'undefined' ? window.innerHeight : 600
  });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastEscapeTime = useRef<number>(0);
  const expressionTimeoutRef = useRef<number | null>(null);
  const shakeTimeoutRef = useRef<number | null>(null);
  const confettiTimeoutRef = useRef<number | null>(null);
  const scoreAnimationTimeoutRef = useRef<number | null>(null);
  const screenFlashTimeoutRef = useRef<number | null>(null);

  // Matter.js関連
  const engineRef = useRef<Engine | null>(null);
  const buttonBodyRef = useRef<Body | null>(null);
  const wallsRef = useRef<Body[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  const BUTTON_SIZE = { width: 120, height: 48 };
  const currentSettings = DIFFICULTY_SETTINGS[difficulty];

  // 歓声音声ファイルを再生する関数
  const playApplauseSound = useCallback(() => {
    try {
      // 複数の歓声音声ファイルからランダムに選択
      const cheerSounds = [
        'https://otologic.jp/sounds/se/pre2/Cheer-Yay02-5(High-Long-Applause).mp3',
        'https://otologic.jp/sounds/se/pre2/Cheer-Yay02-6(High-Short-Applause).mp3',
        'https://otologic.jp/sounds/se/pre2/Cheer-Yay02-1(High-Long-Solo).mp3',
        'https://otologic.jp/sounds/se/pre2/Cheer-Yay02-2(High-Short-Solo).mp3'
      ];

      // ランダムに音声を選択
      const selectedSound = cheerSounds[Math.floor(Math.random() * cheerSounds.length)];

      const audio = new Audio(selectedSound);
      audio.volume = 0.8; // 音量を80%に設定
      audio.currentTime = 0; // 最初から再生

      // 音声を再生
      audio.play().catch(error => {
        console.log('Audio playback failed:', error);
      });

    } catch (error) {
      console.log('Audio playback not supported or failed:', error);
    }
  }, []);

  // 物理エンジンでボタンを超大袈裟に弾き飛ばす
  const applyPhysicsEscape = useCallback(() => {
    if (!buttonBodyRef.current) return;

    // 適度な力で弾き飛ばす
    const forceAngle = Math.random() * Math.PI * 2;
    const baseForceMagnitude = currentSettings.moveDistance * 0.0025; // 少し強く調整
    const randomMultiplier = 1 + Math.random() * 0.4; // 1-1.4倍のランダム
    const forceMagnitude = baseForceMagnitude * randomMultiplier;

    const forceX = Math.cos(forceAngle) * forceMagnitude;
    const forceY = Math.sin(forceAngle) * forceMagnitude - 0.01; // 少し上向きの力も

    Body.applyForce(buttonBodyRef.current, buttonBodyRef.current.position, { x: forceX, y: forceY });

    // 優しい回転でくるくる回る
    const spinDirection = Math.random() < 0.5 ? -1 : 1;
    const spinSpeed = (0.1 + Math.random() * 0.3) * spinDirection; // 0.1-0.4の回転速度
    Body.setAngularVelocity(buttonBodyRef.current, spinSpeed);

    // 難易度が高いほど少し追加の力
    if (difficulty === 'hard') {
      // ハードモードは軽い追加力を加える
      setTimeout(() => {
        if (buttonBodyRef.current) {
          const extraForceX = (Math.random() - 0.5) * 0.003;
          const extraForceY = (Math.random() - 0.5) * 0.003;
          Body.applyForce(buttonBodyRef.current, buttonBodyRef.current.position, { x: extraForceX, y: extraForceY });
        }
      }, 100);
    }
  }, [currentSettings.moveDistance, difficulty]);

  const getDistance = (pos1: Position, pos2: Position): number => {
    return Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2));
  };

  const shouldEscape = useCallback((cursorPos: Position): boolean => {
    if (!buttonBodyRef.current || isConfettiActive) return false;

    const now = Date.now();
    // 表情切り替え中も逃避判定を継続するため、escapeDelayを短縮
    const effectiveDelay = expression === 'escaping' ? Math.min(currentSettings.escapeDelay, 100) : currentSettings.escapeDelay;
    if (now - lastEscapeTime.current < effectiveDelay) {
      return false;
    }

    const buttonCenter = {
      x: buttonBodyRef.current.position.x,
      y: buttonBodyRef.current.position.y,
    };

    return getDistance(cursorPos, buttonCenter) < currentSettings.escapeDistance;
  }, [currentSettings.escapeDistance, currentSettings.escapeDelay, isConfettiActive, expression]);

  const handleEscape = useCallback(() => {
    lastEscapeTime.current = Date.now();
    applyPhysicsEscape();

    // 逃げる表情とアニメーション
    setExpression('escaping');
    setIsShaking(true);

    // 震えアニメーションを止める
    if (shakeTimeoutRef.current) {
      clearTimeout(shakeTimeoutRef.current);
    }
    shakeTimeoutRef.current = setTimeout(() => {
      setIsShaking(false);
    }, 300);

    // 表情を元に戻す
    if (expressionTimeoutRef.current) {
      clearTimeout(expressionTimeoutRef.current);
    }
    expressionTimeoutRef.current = setTimeout(() => {
      setExpression('normal');
    }, 1000);
  }, [applyPhysicsEscape]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const cursorPos = {
      x: e.clientX - containerRect.left,
      y: e.clientY - containerRect.top,
    };

    if (shouldEscape(cursorPos)) {
      handleEscape();
    }
  }, [shouldEscape, handleEscape]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!containerRef.current || e.touches.length === 0) return;

    const touch = e.touches[0];
    const containerRect = containerRef.current.getBoundingClientRect();
    const touchPos = {
      x: touch.clientX - containerRect.left,
      y: touch.clientY - containerRect.top,
    };

    if (shouldEscape(touchPos)) {
      handleEscape();
    }
  }, [shouldEscape, handleEscape]);

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const cursorPos = {
      x: e.clientX - containerRect.left,
      y: e.clientY - containerRect.top,
    };

    if (shouldEscape(cursorPos)) {
      handleEscape();
    }
  }, [shouldEscape, handleEscape]);


  const handleClick = () => {
    if (isConfettiActive) return;

    // 音声が有効な場合のみ拍手音を再生
    if (isSoundEnabled) {
      playApplauseSound();
    }

    // スコア加算とアニメーション
    setScore(prevScore => prevScore + currentSettings.scoreValue);
    setScoreGain(currentSettings.scoreValue);
    setIsScoreAnimating(true);
    setIsScreenFlash(true);

    // 画面フラッシュエフェクト
    if (screenFlashTimeoutRef.current) {
      clearTimeout(screenFlashTimeoutRef.current);
    }
    screenFlashTimeoutRef.current = setTimeout(() => {
      setIsScreenFlash(false);
    }, 500);

    // スコアアニメーションをリセット
    if (scoreAnimationTimeoutRef.current) {
      clearTimeout(scoreAnimationTimeoutRef.current);
    }
    scoreAnimationTimeoutRef.current = setTimeout(() => {
      setIsScoreAnimating(false);
    }, 1200);

    // +ポイント表示をリセット
    setTimeout(() => {
      setScoreGain(null);
    }, 2000);

    setExpression('caught');
    setIsConfettiActive(true);

    if (confettiTimeoutRef.current) {
      clearTimeout(confettiTimeoutRef.current);
    }
    if (expressionTimeoutRef.current) {
      clearTimeout(expressionTimeoutRef.current);
    }

    // 3秒後に紙吹雪を停止してボタンを再利用可能に
    confettiTimeoutRef.current = setTimeout(() => {
      setIsConfettiActive(false);
      setExpression('normal');
      // 物理エンジンで大袈裟にテレポート
      if (buttonBodyRef.current && containerRef.current) {
        const container = containerRef.current.getBoundingClientRect();
        const newX = Math.random() * (container.width - BUTTON_SIZE.width) + BUTTON_SIZE.width / 2;
        const newY = Math.random() * (container.height - BUTTON_SIZE.height) + BUTTON_SIZE.height / 2;

        Body.setPosition(buttonBodyRef.current, { x: newX, y: newY });

        // テレポート後は少し弾む程度
        const bounceVelocityX = (Math.random() - 0.5) * 2;
        const bounceVelocityY = (Math.random() - 0.5) * 2;
        Body.setVelocity(buttonBodyRef.current, { x: bounceVelocityX, y: bounceVelocityY });

        // 軽く回転も加える
        const spinAfterTeleport = (Math.random() - 0.5) * 0.2;
        Body.setAngularVelocity(buttonBodyRef.current, spinAfterTeleport);
      }
    }, 3000);
  };

  const handleReset = () => {
    setScore(0);
    setIsScoreAnimating(false);
    setScoreGain(null);
    setIsScreenFlash(false);
    if (scoreAnimationTimeoutRef.current) {
      clearTimeout(scoreAnimationTimeoutRef.current);
    }
    if (screenFlashTimeoutRef.current) {
      clearTimeout(screenFlashTimeoutRef.current);
    }
  };

  // 物理エンジンの初期化
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current.getBoundingClientRect();

    // エンジン作成
    const engine = Engine.create();
    engine.world.gravity.y = 0.3; // 優しい重力
    engine.world.gravity.x = 0;
    engineRef.current = engine;

    // 壁を作成（画面外に出ないように）
    const wallThickness = 50; // 厚い壁で確実に防止
    const walls = [
      Bodies.rectangle(container.width / 2, -wallThickness / 2, container.width, wallThickness, {
        isStatic: true,
        restitution: 0.8, // 適度な反発
        friction: 0.3
      }), // 上壁
      Bodies.rectangle(container.width / 2, container.height + wallThickness / 2, container.width, wallThickness, {
        isStatic: true,
        restitution: 0.8,
        friction: 0.3
      }), // 下壁
      Bodies.rectangle(-wallThickness / 2, container.height / 2, wallThickness, container.height, {
        isStatic: true,
        restitution: 0.8,
        friction: 0.3
      }), // 左壁
      Bodies.rectangle(container.width + wallThickness / 2, container.height / 2, wallThickness, container.height, {
        isStatic: true,
        restitution: 0.8,
        friction: 0.3
      }), // 右壁
    ];

    wallsRef.current = walls;
    Composite.add(engine.world, walls);

    // ボタンボディ作成
    const buttonBody = Bodies.rectangle(
      container.width / 2,
      container.height / 2,
      BUTTON_SIZE.width,
      BUTTON_SIZE.height,
      {
        restitution: 0.65, // 少し強い反発
        friction: 0.45, // 少し摩擦を減らして滑りやすく
        frictionAir: 0.012, // 空気抵抗を少し減らして長く動く
        density: 0.001, // 適度な重さ
      }
    );

    buttonBodyRef.current = buttonBody;
    Composite.add(engine.world, buttonBody);

    // アニメーションループ
    const animate = () => {
      Engine.update(engine, 1000 / 60); // 60fps

      // ランダムな微風効果を追加（5%の確率で）
      if (buttonBodyRef.current && Math.random() < 0.05) {
        const turbulenceX = (Math.random() - 0.5) * 0.0005;
        const turbulenceY = (Math.random() - 0.5) * 0.0005;
        Body.applyForce(buttonBodyRef.current, buttonBodyRef.current.position, { x: turbulenceX, y: turbulenceY });
      }

      // ボタン位置と回転を更新
      if (buttonBodyRef.current) {
        setPosition({
          x: buttonBodyRef.current.position.x - BUTTON_SIZE.width / 2,
          y: buttonBodyRef.current.position.y - BUTTON_SIZE.height / 2
        });
        setRotation(buttonBodyRef.current.angle);
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (engineRef.current) {
        Composite.clear(engineRef.current.world, false);
        Engine.clear(engineRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
      // TODO: 物理エンジンの壁のサイズもリサイズに合わせて更新
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (expressionTimeoutRef.current) {
        clearTimeout(expressionTimeoutRef.current);
      }
      if (shakeTimeoutRef.current) {
        clearTimeout(shakeTimeoutRef.current);
      }
      if (confettiTimeoutRef.current) {
        clearTimeout(confettiTimeoutRef.current);
      }
      if (scoreAnimationTimeoutRef.current) {
        clearTimeout(scoreAnimationTimeoutRef.current);
      }
      if (screenFlashTimeoutRef.current) {
        clearTimeout(screenFlashTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    lastEscapeTime.current = 0;
    setExpression('normal');
    setIsShaking(false);
    if (expressionTimeoutRef.current) {
      clearTimeout(expressionTimeoutRef.current);
    }
    if (shakeTimeoutRef.current) {
      clearTimeout(shakeTimeoutRef.current);
    }
  }, [difficulty]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-screen bg-gradient-to-br ${currentSettings.background} overflow-hidden select-none transition-all duration-700 ease-in-out`}
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
    >
      {/* 画面フラッシュエフェクト */}
      {isScreenFlash && (
        <div className="fixed inset-0 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 animate-screen-flash pointer-events-none" style={{ zIndex: 9999 }} />
      )}
      <div
        className="absolute"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${BUTTON_SIZE.width}px`,
          height: `${BUTTON_SIZE.height}px`,
          transform: `rotate(${rotation}rad)`,
          transformOrigin: 'center center'
        }}
      >
        <button
          ref={buttonRef}
          onClick={handleClick}
          onMouseEnter={handleMouseEnter}
          disabled={isConfettiActive}
          className={`w-full h-full bg-gradient-to-br ${currentSettings.accent} hover:from-yellow-500 hover:to-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-gray-800 font-mono text-lg font-bold rounded-full shadow-lg transition-all duration-200 transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-yellow-300 border-2 border-yellow-600 cursor-pointer ${
            isShaking ? 'animate-shake' : ''
          } ${
            isConfettiActive ? 'animate-pulse' : ''
          }`}
        >
          {EXPRESSIONS[expression]}
        </button>

      </div>

      {/* 紙吹雪アニメーション */}
      {isConfettiActive && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          numberOfPieces={currentSettings.confettiCount}
          recycle={false}
          run={isConfettiActive}
          gravity={0.3}
          wind={0.05}
          initialVelocityX={5}
          initialVelocityY={10}
          colors={['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8']}
          style={{ position: 'fixed', top: 0, left: 0, zIndex: 1000 }}
        />
      )}

      {/* スコアボード */}
      <div className="absolute top-4 right-4 bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-sm">★</span>
          </div>
          <h2 className="text-white font-bold text-lg">スコア</h2>
        </div>
        <div className="text-center relative">
          <div className={`text-3xl font-mono font-bold text-white mb-2 bg-black/20 rounded-lg px-4 py-2 transition-all duration-200 ${
            isScoreAnimating ? 'animate-score-mega-pop' : ''
          }`}>
            {score.toLocaleString()}
          </div>

          {/* スコア増加表示 - より派手に */}
          {scoreGain && (
            <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4">
              <div className="font-black text-2xl animate-score-plus-mega" style={{
                textShadow: '0 0 20px currentColor, 0 0 40px currentColor'
              }}>
                +{scoreGain}
              </div>
            </div>
          )}

          <button
            onClick={handleReset}
            className="bg-red-500/80 hover:bg-red-600/80 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-400/50"
          >
            リセット
          </button>
        </div>
      </div>

      {/* メニューボタン */}
      <div className="absolute top-4 left-4">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-full p-3 shadow-2xl hover:bg-white/20 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/50"
        >
          <div className="w-6 h-6 flex flex-col justify-center items-center gap-1">
            <div className="w-4 h-0.5 bg-white rounded-full"></div>
            <div className="w-4 h-0.5 bg-white rounded-full"></div>
            <div className="w-4 h-0.5 bg-white rounded-full"></div>
          </div>
        </button>
      </div>

      {/* 難易度設定メニュー */}
      {isMenuOpen && (
        <div className="absolute top-4 left-20 bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-4 shadow-2xl z-50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-6 h-6 bg-gradient-to-r from-blue-400 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-xs">⚙</span>
            </div>
            <h3 className="text-white font-bold text-sm">設定</h3>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-white text-xs opacity-75 mb-2">難易度選択:</div>
              <div className="space-y-1">
                {(['easy', 'normal', 'hard'] as Difficulty[]).map((level) => (
                  <button
                    key={level}
                    onClick={() => {
                      setDifficulty(level);
                      setIsMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      difficulty === level
                        ? 'bg-white/30 text-white shadow-lg'
                        : 'bg-white/10 text-white/80 hover:bg-white/20'
                    }`}
                  >
                    {DIFFICULTY_SETTINGS[level].label}
                    {difficulty === level && (
                      <span className="float-right text-yellow-300">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-white/20 pt-3">
              <div className="text-white text-xs opacity-75 mb-2">音声設定:</div>
              <button
                onClick={() => setIsSoundEnabled(!isSoundEnabled)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isSoundEnabled
                    ? 'bg-green-500/30 text-white shadow-lg'
                    : 'bg-red-500/30 text-white/80'
                } hover:bg-opacity-40`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {isSoundEnabled ? '🔊' : '🔇'}
                    </span>
                    <span>効果音</span>
                  </div>
                  <div className={`text-xs px-2 py-1 rounded-full ${
                    isSoundEnabled
                      ? 'bg-green-400/50 text-green-100'
                      : 'bg-red-400/50 text-red-100'
                  }`}>
                    {isSoundEnabled ? 'ON' : 'OFF'}
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-white/20">
            <div className="text-white/60 text-xs space-y-1">
              <div>難易度: <span className="text-white font-semibold">{currentSettings.label}</span></div>
              <div>効果音: <span className={`font-semibold ${isSoundEnabled ? 'text-green-300' : 'text-red-300'}`}>{isSoundEnabled ? 'ON' : 'OFF'}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* メニューが開いている時の背景クリックで閉じる */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default EscapeButton;