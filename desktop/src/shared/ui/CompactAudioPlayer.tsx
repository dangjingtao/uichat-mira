import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pause, Play, Volume1, Volume2, VolumeX } from "lucide-react";

type CompactAudioPlayerProps = {
  src: string;
  title?: string;
  subtitle?: string;
  className?: string;
  tone?: "light" | "dark";
};

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${rest}`;
};

export default function CompactAudioPlayer({
  src,
  title = "音频预览",
  subtitle = "",
  className = "",
  tone = "light",
}: CompactAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const volumeWrapRef = useRef<HTMLDivElement>(null);
  const volumeButtonRef = useRef<HTMLButtonElement>(null);
  const volumePopoverRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(70);
  const [previousVolume, setPreviousVolume] = useState(70);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [volumePopoverStyle, setVolumePopoverStyle] = useState<{
    left: number;
    top: number;
  } | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };
    const handleEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
      audio.currentTime = 0;
    };
    const handlePause = () => setPlaying(false);
    const handlePlay = () => setPlaying(true);

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("play", handlePlay);

    audio.volume = volume / 100;

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("play", handlePlay);
    };
  }, [src, volume]);

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setVolumeOpen(false);
  }, [src]);

  useEffect(() => {
    if (!volumeOpen) {
      setVolumePopoverStyle(null);
      return;
    }

    let frameId = 0;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        volumeWrapRef.current &&
        !volumeWrapRef.current.contains(target) &&
        volumePopoverRef.current &&
        !volumePopoverRef.current.contains(target)
      ) {
        setVolumeOpen(false);
      }
    };

    const updateVolumePopoverPosition = () => {
      const button = volumeButtonRef.current;
      const popover = volumePopoverRef.current;
      if (!button) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        const rect = button.getBoundingClientRect();
        const popoverRect = popover?.getBoundingClientRect();
        const popoverWidth = popoverRect?.width ?? 60;
        const popoverHeight = popoverRect?.height ?? 128;
        const gutter = 8;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const centeredLeft = rect.left + rect.width / 2 - popoverWidth / 2;
        const left = Math.min(
          Math.max(gutter, centeredLeft),
          viewportWidth - popoverWidth - gutter,
        );
        const preferredTop = rect.top - popoverHeight - gutter;
        const top =
          preferredTop >= gutter
            ? preferredTop
            : Math.min(rect.bottom + gutter, viewportHeight - popoverHeight - gutter);

        setVolumePopoverStyle({ left, top });
      });
    };

    updateVolumePopoverPosition();

    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("resize", updateVolumePopoverPosition);
    window.addEventListener("scroll", updateVolumePopoverPosition, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("resize", updateVolumePopoverPosition);
      window.removeEventListener("scroll", updateVolumePopoverPosition, true);
    };
  }, [volumeOpen]);

  const progressPercent = useMemo(() => {
    if (duration <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(100, (currentTime / duration) * 100));
  }, [currentTime, duration]);

  const volumeIcon =
    volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audio.paused) {
      await audio.play();
      return;
    }

    audio.pause();
  };

  const handleSeek = (nextValue: number) => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.currentTime = nextValue;
    setCurrentTime(nextValue);
  };

  const handleVolumeChange = (nextVolume: number) => {
    const audio = audioRef.current;
    setVolume(nextVolume);
    if (nextVolume > 0) {
      setPreviousVolume(nextVolume);
    }
    if (audio) {
      audio.volume = nextVolume / 100;
    }
  };

  const toggleMute = () => {
    if (volume === 0) {
      handleVolumeChange(previousVolume || 40);
      return;
    }
    setPreviousVolume(volume);
    handleVolumeChange(0);
  };

  const VolumeIcon = volumeIcon;
  const isDark = tone === "dark";
  const surfaceClassName = isDark
    ? "border-transparent bg-[#1b1917]"
    : "border-[#e7dfd3] bg-[#efe8dc]";
  const titleClassName = isDark ? "text-[#faf8f3]" : "text-[#171615]";
  const subtitleClassName = isDark ? "text-[#d9d1c7]" : "text-[#5d5a54]";
  const timeClassName = isDark ? "text-[#d3cabb]" : "text-[#8f877b]";
  const sliderTrackColor = isDark ? "rgb(51 47 43)" : "rgb(216 207 194)";
  const volumeButtonClassName = isDark
    ? "text-[#d9d1c7] hover:bg-[#2b2723]"
    : "text-[#6f685f] hover:bg-[#e7dfd3]";
  const volumePopoverClassName = isDark
    ? "border-transparent bg-[#252320]"
    : "border-[#e7dfd3] bg-[#faf8f3]";
  const volumeSliderScopeClassName = "compact-audio-player-volume-slider";

  return (
    <div
      className={`flex w-full items-center gap-3 rounded-[16px] border px-3.5 py-3 ${surfaceClassName} ${className}`}
    >
      <style>{`
        .${volumeSliderScopeClassName}::-webkit-slider-thumb {
          margin-left: 0;
        }
      `}</style>
      <audio ref={audioRef} src={src} preload="metadata" />

      <button
        type="button"
        onClick={() => void togglePlayback()}
        aria-label={playing ? "暂停" : "播放"}
        className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#cc785c] text-white transition-transform duration-150 active:scale-95"
      >
        {playing ? (
          <Pause className="h-4 w-4 fill-current" strokeWidth={2.4} />
        ) : (
          <Play className="ml-0.5 h-4 w-4 fill-current" strokeWidth={2.4} />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="mb-0 flex items-center justify-between gap-3">
          <p className={`truncate text-[13px] font-semibold leading-none ${titleClassName}`} title={title}>
            {title}
          </p>
          <span className={`flex-none font-mono text-[10px] leading-none ${timeClassName}`}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(currentTime, duration || 0)}
          onChange={(event) => handleSeek(Number(event.target.value))}
          disabled={duration <= 0}
          aria-label="播放进度"
          style={{
            background: `linear-gradient(to right, rgb(var(--color-primary)) 0%, rgb(var(--color-primary)) ${progressPercent}%, ${sliderTrackColor} ${progressPercent}%, ${sliderTrackColor} 100%)`,
          }}
          className={`claude-range-slider claude-range-slider-compact ${
            duration <= 0 ? "cursor-not-allowed opacity-60" : "cursor-pointer"
          }`}
        />

        {subtitle ? (
          <p className={`mt-1 truncate text-[11px] leading-none ${subtitleClassName}`}>{subtitle}</p>
        ) : null}
      </div>

      <div className="relative flex-none" ref={volumeWrapRef}>
        <button
          ref={volumeButtonRef}
          type="button"
          onClick={() => setVolumeOpen((current) => !current)}
          onDoubleClick={toggleMute}
          aria-label="音量"
          aria-expanded={volumeOpen}
          className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
            volumeOpen
              ? `${volumeButtonClassName} ${isDark ? "bg-[#2b2723]" : "bg-[#e7dfd3]"}`
              : `bg-transparent ${volumeButtonClassName}`
          }`}
        >
          <VolumeIcon className="h-4 w-4" />
        </button>

        {volumeOpen
          ? createPortal(
              <div
                ref={volumePopoverRef}
                className={`fixed z-[320] flex min-w-[48px] flex-col items-center gap-1.5 rounded-[10px] border px-1.5 py-2 shadow-shadow-sm ${volumePopoverClassName}`}
                style={{
                  left: volumePopoverStyle?.left ?? 0,
                  top: volumePopoverStyle?.top ?? 0,
                  visibility: volumePopoverStyle ? "visible" : "hidden",
                }}
              >
                <span className={`font-mono text-[10px] ${subtitleClassName}`}>{volume}%</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={volume}
                  onChange={(event) => handleVolumeChange(Number(event.target.value))}
                  aria-label="音量大小"
                  className={`claude-range-slider claude-range-slider-compact claude-range-slider-vertical ${volumeSliderScopeClassName}`}
                  style={{
                    background: `linear-gradient(to top, rgb(var(--color-primary)) 0%, rgb(var(--color-primary)) ${volume}%, ${sliderTrackColor} ${volume}%, ${sliderTrackColor} 100%)`,
                  }}
                />
                <button
                  type="button"
                  onClick={toggleMute}
                  className="whitespace-nowrap text-[10px] font-medium text-[#cc785c]"
                >
                  {volume === 0 ? "恢复" : "静音"}
                </button>
              </div>,
              document.body,
            )
          : null}
      </div>
    </div>
  );
}
