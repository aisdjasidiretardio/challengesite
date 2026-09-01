"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "./challenge.module.css";

type VaultSymbol = "crown" | "coin" | "key" | "sword";
type Phase = "loading" | "intro" | "playing" | "unlocking" | "solved";

type SymbolDetails = {
  name: string;
  short: string;
  symbol: string;
  clue: string;
  clueAlt: string;
  placeholder: string;
  line: string;
};

type Round = {
  targets: VaultSymbol[];
  wheels: VaultSymbol[][];
  starts: number[];
};

type WheelStyle = CSSProperties & {
  "--rotation": string;
  "--counter-rotation": string;
};

const LOCK_KEY = "onecoin-vault-react-lock";
const SYMBOLS: VaultSymbol[] = ["crown", "coin", "key", "sword"];
const SEAL_NUMERALS = ["I", "II", "III"];

const SYMBOL_META: Record<VaultSymbol, SymbolDetails> = {
  crown: {
    name: "Crown",
    short: "CROWN",
    symbol: "/challenge/crown.png",
    clue: "/challenge/king.png",
    clueAlt: "King wearing a crown",
    placeholder: "KING ART",
    line: "The sovereign entered beneath gold.",
  },
  coin: {
    name: "Coin",
    short: "COIN",
    symbol: "/challenge/coin.png",
    clue: "/challenge/merchant.png",
    clueAlt: "Merchant holding one coin",
    placeholder: "MERCHANT ART",
    line: "Fortune followed in the merchant's palm.",
  },
  key: {
    name: "Key",
    short: "KEY",
    symbol: "/challenge/key.png",
    clue: "/challenge/knight.png",
    clueAlt: "Knight holding a key",
    placeholder: "KNIGHT ART",
    line: "The knight entered bearing passage.",
  },
  sword: {
    name: "Sword",
    short: "SWORD",
    symbol: "/challenge/sword.png",
    clue: "/challenge/guard.png",
    clueAlt: "Royal guard holding a sword",
    placeholder: "GUARD ART",
    line: "The royal guard carried steel.",
  },
};

function randomInt(maximum: number) {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    window.crypto.getRandomValues(values);
    return values[0] % maximum;
  }

  return Math.floor(Math.random() * maximum);
}

function shuffle<T>(items: T[]) {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const replacement = randomInt(index + 1);
    [result[index], result[replacement]] = [
      result[replacement],
      result[index],
    ];
  }

  return result;
}

function makeRound(): Round {
  const targets = shuffle(SYMBOLS).slice(0, 3);
  const wheels = targets.map(() => shuffle(SYMBOLS));
  const starts = wheels.map(() => randomInt(4));

  if (
    wheels.every((wheel, index) => wheel[starts[index]] === targets[index])
  ) {
    starts[0] = (starts[0] + 1) % 4;
  }

  return { targets, wheels, starts };
}

function todayKey() {
  const date = new Date().toISOString().slice(0, 10);
  return `onecoin-vault-react-complete-${date}`;
}

function makeCode() {
  return `ONE-${String(randomInt(10_000_000)).padStart(7, "0")}`;
}

function hideFallback(image: HTMLImageElement) {
  const fallback = image.previousElementSibling as HTMLElement | null;
  if (fallback) fallback.style.visibility = "hidden";
}

function Art({
  src,
  alt,
  placeholder,
}: {
  src: string;
  alt: string;
  placeholder: string;
}) {
  return (
    <div className={styles.art}>
      <span>{placeholder}</span>
      <img
        src={src}
        alt={alt}
        draggable={false}
        onLoad={(event) => hideFallback(event.currentTarget)}
        onError={(event) => event.currentTarget.remove()}
      />
    </div>
  );
}

function SymbolArt({ symbol }: { symbol: VaultSymbol }) {
  const item = SYMBOL_META[symbol];

  return (
    <span className={styles.symbol}>
      <span>{item.short}</span>
      <img
        src={item.symbol}
        alt=""
        draggable={false}
        onLoad={(event) => hideFallback(event.currentTarget)}
        onError={(event) => event.currentTarget.remove()}
      />
    </span>
  );
}

export default function ChallengePage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [round, setRound] = useState<Round | null>(null);
  const [positions, setPositions] = useState([0, 0, 0]);
  const [turns, setTurns] = useState([0, 0, 0]);
  const [lives, setLives] = useState(3);
  const [blocked, setBlocked] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [winningCode, setWinningCode] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const sealAnimating = useRef([false, false, false]);
  const sealTimers = useRef<Array<number | null>>([null, null, null]);
  const blockTimer = useRef<number | null>(null);
  const unlockTimer = useRef<number | null>(null);
  const copyTimer = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    sealTimers.current.forEach((timer) => {
      if (timer !== null) window.clearTimeout(timer);
    });
    sealTimers.current = [null, null, null];

    if (blockTimer.current !== null) {
      window.clearTimeout(blockTimer.current);
      blockTimer.current = null;
    }

    if (unlockTimer.current !== null) {
      window.clearTimeout(unlockTimer.current);
      unlockTimer.current = null;
    }

    if (copyTimer.current !== null) {
      window.clearTimeout(copyTimer.current);
      copyTimer.current = null;
    }
  }, []);

  const beginTrial = useCallback(() => {
    clearTimers();
    const nextRound = makeRound();

    setRound(nextRound);
    setPositions([...nextRound.starts]);
    setTurns([...nextRound.starts]);
    sealAnimating.current = [false, false, false];
    setLives(3);
    setBlocked(false);
    setLockedUntil(0);
    setWinningCode("");
    setStatusMessage("");
    setCopied(false);
    setNow(Date.now());
    setPhase("playing");
  }, [clearTimers]);

  useEffect(() => {
    const oldTitle = document.title;
    document.title = "The Royal Vault | One Coin";

    const completed = window.localStorage.getItem(todayKey());

    if (completed) {
      try {
        const code = JSON.parse(completed)?.code;
        if (typeof code === "string" && code) {
          setWinningCode(code);
          setPhase("solved");
          return () => {
            document.title = oldTitle;
            clearTimers();
          };
        }
      } catch {
        window.localStorage.removeItem(todayKey());
      }
    }

    const savedLock = Number(window.localStorage.getItem(LOCK_KEY) || 0);

    if (savedLock > Date.now()) {
      const lockedRound = makeRound();
      setRound(lockedRound);
      setPositions([...lockedRound.starts]);
      setTurns([...lockedRound.starts]);
      setLives(0);
      setLockedUntil(savedLock);
      setStatusMessage("THE TREASURY HAS SEALED ITSELF.");
      setPhase("playing");
    } else {
      window.localStorage.removeItem(LOCK_KEY);
      setPhase("intro");
    }

    return () => {
      document.title = oldTitle;
      clearTimers();
    };
  }, [clearTimers]);

  useEffect(() => {
    if (!lockedUntil) return;

    const tick = () => {
      const time = Date.now();
      setNow(time);

      if (time >= lockedUntil) {
        window.localStorage.removeItem(LOCK_KEY);
        beginTrial();
      }
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [beginTrial, lockedUntil]);

  const locked = lockedUntil > now;
  const remaining = locked
    ? Math.max(1, Math.ceil((lockedUntil - now) / 1000))
    : 0;

  const currentSymbols = useMemo(() => {
    if (!round) return [] as VaultSymbol[];
    return round.wheels.map((wheel, index) => wheel[positions[index]]);
  }, [positions, round]);

  function rotateSeal(index: number) {
    if (
      phase !== "playing" ||
      blocked ||
      locked ||
      !round ||
      sealAnimating.current[index]
    ) {
      return;
    }

    sealAnimating.current[index] = true;

    setPositions((current) => {
      const next = [...current];
      next[index] = (next[index] + 1) % round.wheels[index].length;
      return next;
    });

    setTurns((current) => {
      const next = [...current];
      next[index] += 1;
      return next;
    });

    if (sealTimers.current[index] !== null) {
      window.clearTimeout(sealTimers.current[index]!);
    }

    sealTimers.current[index] = window.setTimeout(() => {
      sealAnimating.current[index] = false;
      sealTimers.current[index] = null;
    }, 570);
  }

  function submitCombination() {
    if (phase !== "playing" || blocked || locked || !round) return;

    const correct = currentSymbols.every(
      (symbol, index) => symbol === round.targets[index],
    );

    if (correct) {
      setPhase("unlocking");
      setStatusMessage("CLICK");

      unlockTimer.current = window.setTimeout(() => {
        const nextCode = makeCode();
        setWinningCode(nextCode);
        window.localStorage.setItem(
          todayKey(),
          JSON.stringify({ code: nextCode }),
        );
        setPhase("solved");
        setStatusMessage("");
        unlockTimer.current = null;
      }, 750);

      return;
    }

    const nextLives = lives - 1;
    setLives(nextLives);

    if (nextLives <= 0) {
      const nextLock = Date.now() + 60_000;
      setLockedUntil(nextLock);
      setNow(Date.now());
      setStatusMessage("THE TREASURY HAS SEALED ITSELF.");
      window.localStorage.setItem(LOCK_KEY, String(nextLock));
      return;
    }

    setBlocked(true);
    setStatusMessage("THE SEALS RESIST.");

    blockTimer.current = window.setTimeout(() => {
      setBlocked(false);
      setStatusMessage("");
      blockTimer.current = null;
    }, 2000);
  }

  function restartChallenge() {
    clearTimers();
    window.localStorage.removeItem(LOCK_KEY);
    window.localStorage.removeItem(todayKey());
    setRound(null);
    setPositions([0, 0, 0]);
    setTurns([0, 0, 0]);
    sealAnimating.current = [false, false, false];
    setLives(3);
    setBlocked(false);
    setLockedUntil(0);
    setWinningCode("");
    setStatusMessage("");
    setCopied(false);
    setPhase("intro");
  }

  async function copyCode() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(winningCode);
      } else {
        throw new Error("Clipboard unavailable");
      }
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = winningCode;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      textArea.remove();
    }

    if (copyTimer.current !== null) {
      window.clearTimeout(copyTimer.current);
    }

    setCopied(false);
    window.requestAnimationFrame(() => setCopied(true));

    copyTimer.current = window.setTimeout(() => {
      setCopied(false);
      copyTimer.current = null;
    }, 1800);
  }

  function renderIntro() {
    return (
      <div className={styles.screen}>
        <p className={styles.kicker}>Royal Trial I</p>
        <h1 className={styles.heading}>The Sealed Treasury</h1>

        <p className={styles.introCopy}>
          The King&apos;s coin has been locked away.
          <br />
          Break the three seals and claim your proof.
        </p>

        <div className={styles.chest}>
          <Art
            src="/challenge/closedchest.png"
            alt="A medieval locked royal chest"
            placeholder="CHEST ART PLACEHOLDER"
          />
        </div>

        <div className={styles.rewards}>
          <div className={styles.reward}>
            <b>1 GTD</b>
          </div>
          <div className={styles.reward}>
            <b>2 FCFS</b>
          </div>
        </div>

        <button className={styles.primary} type="button" onClick={beginTrial}>
          Begin Trial
        </button>
      </div>
    );
  }

  function renderGame() {
    if (!round) return null;

    const status = locked
      ? `Return in ${remaining} seconds.`
      : statusMessage || "Three marks. One true order.";

    const danger =
      locked ||
      statusMessage.includes("RESIST") ||
      statusMessage.includes("SEALED");

    return (
      <div className={styles.screen}>
        <div className={styles.gameHead}>
          <div>
            <p className={styles.kicker}>Royal Trial I</p>
            <h1 className={styles.heading}>The Three Seals</h1>
          </div>

          <div className={styles.livesBox}>
            <small>Lives</small>
            <div className={styles.lives} aria-label={`${lives} lives remaining`}>
              {[0, 1, 2].map((index) =>
                index < lives ? (
                  <span key={index}>&#9820;</span>
                ) : (
                  <span className={styles.lost} key={index}>
                    &times;
                  </span>
                ),
              )}
            </div>
          </div>
        </div>

        <p className={styles.instruction}>
          Match the three seals to the pictures below. Tap a seal to change its
          symbol.
        </p>

        <div className={styles.seals}>
          {round.wheels.map((wheel, sealIndex) => {
            const selected = wheel[positions[sealIndex]];
            const wheelStyle: WheelStyle = {
              "--rotation": `${-turns[sealIndex] * 90}deg`,
              "--counter-rotation": `${turns[sealIndex] * 90}deg`,
            };

            return (
              <div className={styles.sealWrap} key={sealIndex}>
                <span className={styles.sealLabel}>
                  Seal {SEAL_NUMERALS[sealIndex]}
                </span>

                <button
                  className={`${styles.seal} ${
                    phase === "unlocking" ? styles.gold : ""
                  }`}
                  type="button"
                  disabled={locked || blocked || phase !== "playing"}
                  aria-label={`Seal ${sealIndex + 1}, ${
                    SYMBOL_META[selected].name
                  }`}
                  onClick={() => rotateSeal(sealIndex)}
                >
                  <span className={styles.pointer}>&#9660;</span>

                  <span className={styles.disc} style={wheelStyle}>
                    {wheel.map((symbol, markIndex) => (
                      <span className={styles.mark} key={`${symbol}-${markIndex}`}>
                        <SymbolArt symbol={symbol} />
                      </span>
                    ))}
                  </span>

                  <span className={styles.sealCentre} key={selected}>
                    <SymbolArt symbol={selected} />
                  </span>
                </button>

                <span className={styles.selectedLabel}>
                  {SYMBOL_META[selected].name}
                </span>
              </div>
            );
          })}
        </div>

        <div className={styles.divider} />

        <section className={styles.cluePanel}>
          <h2 className={styles.clueTitle}>The King&apos;s Record</h2>
          <p className={styles.clueSubtitle}>
            Read the illuminated record from left to right.
          </p>

          <div className={styles.clues}>
            {round.targets.map((symbol, index) => {
              const item = SYMBOL_META[symbol];
              return (
                <div className={styles.clueGroup} key={`${symbol}-${index}`}>
                  <div className={styles.clue}>
                    <Art
                      src={item.clue}
                      alt={item.clueAlt}
                      placeholder={item.placeholder}
                    />
                  </div>
                  {index < 2 ? (
                    <span className={styles.arrow} aria-hidden="true">
                      &rarr;
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>

          <p className={styles.poem}>
            {round.targets.map((symbol) => (
              <span key={symbol}>{SYMBOL_META[symbol].line}</span>
            ))}
          </p>
        </section>

        <div className={`${styles.status} ${danger ? styles.danger : ""}`}>
          {locked ? (
            <>
              <b>The treasury has sealed itself.</b>
              <span>{status}</span>
            </>
          ) : statusMessage ? (
            <b>{statusMessage}</b>
          ) : (
            <span>{status}</span>
          )}
        </div>

        <button
          className={styles.primary}
          type="button"
          disabled={locked || blocked || phase !== "playing"}
          onClick={submitCombination}
        >
          {locked
            ? `Sealed - ${remaining}s`
            : phase === "unlocking"
              ? "Opening..."
              : blocked
                ? "The seals resist..."
                : "Unseal"}
        </button>
      </div>
    );
  }

  function renderSuccess() {
    return (
      <div className={styles.screen}>
        <button
          className={styles.backLink}
          type="button"
          aria-label="Return to the Challenge I start screen"
          onClick={restartChallenge}
        >
          &larr; Back
        </button>

        <h1 className={styles.heading}>
          Congrats,
          <br />
          You Won!
        </h1>

        <div className={styles.chest}>
          <Art
            src="/challenge/openchest.png"
            alt="The opened royal treasury"
            placeholder="OPEN CHEST ART"
          />
        </div>

        <span className={styles.codeLabel}>Your Winning Code</span>
        <strong className={`${styles.code} ${copied ? styles.copied : ""}`}>
          {winningCode}
        </strong>

        <button
          className={`${styles.secondary} ${copied ? styles.copied : ""}`}
          type="button"
          onClick={copyCode}
        >
          {copied ? "Copied!" : "Copy Winning Code"}
        </button>

        <span className={styles.copyStatus} aria-live="polite">
          {copied ? "Code copied - now post it under Challenge I." : ""}
        </span>

        <p className={styles.successCopy}>
          Copy and post it under the Challenge I tweet to receive your prize.
        </p>
      </div>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.frame}>
        {phase === "loading" ? (
          <div className={styles.screen} aria-label="Loading the Royal Vault">
            <p className={styles.kicker}>Royal Trial I</p>
          </div>
        ) : phase === "intro" ? (
          renderIntro()
        ) : phase === "solved" ? (
          renderSuccess()
        ) : (
          renderGame()
        )}
      </section>
    </main>
  );
}
