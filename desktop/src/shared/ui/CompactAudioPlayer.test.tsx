// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CompactAudioPlayer from "./CompactAudioPlayer";

const getAudio = () => document.querySelector("audio") as HTMLAudioElement;

describe("CompactAudioPlayer", () => {
  it("renders metadata and disables controls without a source", () => {
    render(
      <CompactAudioPlayer
        src=""
        title="Preview"
        subtitle="Voice sample"
        statusMessage="Unavailable"
      />,
    );

    expect(screen.getByText("Preview")).toBeInTheDocument();
    expect(screen.getByText("Voice sample")).toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "播放" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "音量" })).toBeDisabled();
    expect(screen.getByRole("slider", { name: "播放进度" })).toBeDisabled();
  });

  it("plays, pauses, seeks, and responds to audio events", async () => {
    const user = userEvent.setup();
    render(<CompactAudioPlayer src="preview.mp3" title="Preview" />);
    const renderedAudio = getAudio();
    Object.defineProperty(renderedAudio, "duration", {
      configurable: true,
      value: 120,
    });
    Object.defineProperty(renderedAudio, "currentTime", {
      configurable: true,
      writable: true,
      value: 0,
    });
    Object.defineProperty(renderedAudio, "paused", {
      configurable: true,
      writable: true,
      value: true,
    });
    vi.spyOn(renderedAudio, "play").mockImplementation(async () => {
      Object.defineProperty(renderedAudio, "paused", { configurable: true, value: false });
      renderedAudio.dispatchEvent(new Event("play"));
    });
    vi.spyOn(renderedAudio, "pause").mockImplementation(() => {
      Object.defineProperty(renderedAudio, "paused", { configurable: true, value: true });
      renderedAudio.dispatchEvent(new Event("pause"));
    });

    fireEvent(renderedAudio, new Event("loadedmetadata"));
    expect(screen.getByText("0:00 / 2:00")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "播放" }));
    expect(renderedAudio.play).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "暂停" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "暂停" }));
    expect(renderedAudio.pause).toHaveBeenCalledTimes(1);

    renderedAudio.currentTime = 45;
    fireEvent(renderedAudio, new Event("timeupdate"));
    expect(screen.getByText("0:45 / 2:00")).toBeInTheDocument();

    const progress = screen.getByRole("slider", { name: "播放进度" });
    fireEvent.change(progress, { target: { value: "70" } });
    expect(renderedAudio.currentTime).toBe(70);

    fireEvent(renderedAudio, new Event("ended"));
    await waitFor(() => {
      expect(screen.getByText("0:00 / 2:00")).toBeInTheDocument();
    });
  });

  it("opens the volume popover and toggles mute", async () => {
    const user = userEvent.setup();
    render(<CompactAudioPlayer src="preview.mp3" />);
    const audio = getAudio();

    await user.click(screen.getByRole("button", { name: "音量" }));
    expect(screen.getByLabelText("音量大小")).toBeInTheDocument();
    expect(screen.getByText("70%")).toBeInTheDocument();

    await user.click(screen.getByText("静音"));
    expect(audio.volume).toBe(0);
    expect(screen.getByText("0%")).toBeInTheDocument();

    await user.click(screen.getByText("恢复"));
    expect(audio.volume).toBe(0.7);

    fireEvent.mouseDown(document.body);
    expect(screen.queryByLabelText("音量大小")).not.toBeInTheDocument();
  });
});
