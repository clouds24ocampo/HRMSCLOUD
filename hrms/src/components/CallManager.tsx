"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { answerCall, callState, endCall, pollIncoming, startCall, type IncomingCall } from "@/app/(app)/chat/actions";

// One-to-one voice and video calls (WebRTC). Mounted once in the app layout, so a call rings on whatever page you are on.
// Pages start a call with: window.dispatchEvent(new CustomEvent("hrms:call", { detail: { conversationId, kind, name } }))
// Media goes peer to peer. STUN finds a direct path; on strict networks a TURN relay is needed (NEXT_PUBLIC_TURN_URL).
type Kind = "VOICE" | "VIDEO";
type Phase = { s: "idle" } | { s: "incoming"; call: IncomingCall } | { s: "calling"; id?: string; name: string; kind: Kind } | { s: "active"; id: string; name: string; kind: Kind; since: number };

const ICE: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ...(process.env.NEXT_PUBLIC_TURN_URL ? [{ urls: process.env.NEXT_PUBLIC_TURN_URL, username: process.env.NEXT_PUBLIC_TURN_USER, credential: process.env.NEXT_PUBLIC_TURN_PASS }] : []),
];

// Waits until the browser has gathered its network candidates (or 4 s), so the description we send is complete.
function gathered(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise<void>((resolve) => {
    const t = setTimeout(resolve, 4000);
    pc.addEventListener("icegatheringstatechange", () => {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(t);
        resolve();
      }
    });
  });
}

const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

export function CallManager() {
  const [phase, setPhase] = useState<Phase>({ s: "idle" });
  const [error, setError] = useState<string>();
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [now, setNow] = useState(0);
  const pc = useRef<RTCPeerConnection | null>(null);
  const local = useRef<MediaStream | null>(null);
  const remoteEl = useRef<HTMLMediaElement | null>(null);
  const remoteStream = useRef<MediaStream | null>(null);
  // Callback refs: they work for <video> and <audio> alike and attach the stream as soon as the element appears.
  const attachRemote = useCallback((el: HTMLMediaElement | null) => {
    remoteEl.current = el;
    if (el && remoteStream.current) el.srcObject = remoteStream.current;
  }, []);
  const attachLocal = useCallback((el: HTMLVideoElement | null) => {
    if (el && local.current) el.srcObject = local.current;
  }, []);

  const cleanup = useCallback(() => {
    pc.current?.close();
    pc.current = null;
    local.current?.getTracks().forEach((t) => t.stop());
    local.current = null;
    remoteStream.current = null;
    setMuted(false);
    setCamOff(false);
    setPhase({ s: "idle" });
  }, []);

  const media = async (kind: Kind) => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Calls need a secure (https) connection and a browser with camera and microphone support.");
    const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === "VIDEO" });
    local.current = s;
    return s;
  };
  const peer = (stream: MediaStream) => {
    const p = new RTCPeerConnection({ iceServers: ICE });
    stream.getTracks().forEach((t) => p.addTrack(t, stream));
    p.ontrack = (e) => {
      remoteStream.current = e.streams[0];
      if (remoteEl.current) remoteEl.current.srcObject = e.streams[0];
    };
    pc.current = p;
    return p;
  };

  // Outgoing: started from a chat page.
  useEffect(() => {
    const onCall = async (e: Event) => {
      const { conversationId, kind, name } = (e as CustomEvent<{ conversationId: string; kind: Kind; name: string }>).detail;
      if (pc.current) return;
      setError(undefined);
      setPhase({ s: "calling", name, kind });
      try {
        const p = peer(await media(kind));
        await p.setLocalDescription(await p.createOffer());
        await gathered(p);
        const r = await startCall(conversationId, kind, JSON.stringify(p.localDescription));
        if (!r.id) throw new Error(r.error ?? "The call could not be started.");
        setPhase({ s: "calling", id: r.id, name, kind });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Camera or microphone is blocked. Allow them for this site and try again.");
        cleanup();
      }
    };
    window.addEventListener("hrms:call", onCall);
    return () => window.removeEventListener("hrms:call", onCall);
  }, [cleanup]);

  // Incoming: check every 3 s while idle and the tab is visible.
  useEffect(() => {
    if (phase.s !== "idle") return;
    const t = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const c = await pollIncoming().catch(() => null);
      if (c) setPhase({ s: "incoming", call: c });
    }, 3000);
    return () => clearInterval(t);
  }, [phase.s]);

  // While a call exists: follow its state (answered, declined, hung up by the other side).
  const callId = phase.s === "calling" ? phase.id : phase.s === "active" ? phase.id : phase.s === "incoming" ? phase.call.id : undefined;
  useEffect(() => {
    if (!callId) return;
    const t = setInterval(async () => {
      const st = await callState(callId).catch(() => null);
      setNow(Date.now());
      if (!st || ["ENDED", "DECLINED", "MISSED"].includes(st.status)) {
        if (st && phase.s === "calling") setError(st.status === "DECLINED" ? "Call declined." : st.status === "MISSED" ? "No answer." : "Call ended.");
        cleanup();
        return;
      }
      if (phase.s === "calling" && st.status === "ACTIVE" && st.answer && pc.current && !pc.current.currentRemoteDescription) {
        await pc.current.setRemoteDescription(JSON.parse(st.answer));
        setPhase({ s: "active", id: callId, name: phase.name, kind: phase.kind, since: Date.now() });
      }
    }, 1000);
    return () => clearInterval(t);
  }, [callId, phase, cleanup]);

  const accept = async (call: IncomingCall) => {
    setError(undefined);
    try {
      const p = peer(await media(call.kind));
      await p.setRemoteDescription(JSON.parse(call.offer));
      await p.setLocalDescription(await p.createAnswer());
      await gathered(p);
      const r = await answerCall(call.id, JSON.stringify(p.localDescription));
      if (r.error) throw new Error(r.error);
      setPhase({ s: "active", id: call.id, name: call.caller, kind: call.kind, since: Date.now() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Camera or microphone is blocked.");
      await endCall(call.id);
      cleanup();
    }
  };
  const hangUp = async (decline = false) => {
    if (callId) await endCall(callId, decline).catch(() => {});
    cleanup();
  };
  const toggleMute = () => {
    local.current?.getAudioTracks().forEach((t) => (t.enabled = muted));
    setMuted(!muted);
  };
  const toggleCam = () => {
    local.current?.getVideoTracks().forEach((t) => (t.enabled = camOff));
    setCamOff(!camOff);
  };

  if (phase.s === "idle") {
    return error ? (
      <div role="alert" className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm rounded-2xl border border-danger/40 bg-surface p-4 text-sm shadow-xl md:bottom-6">
        <p className="text-danger">{error}</p>
        <button type="button" onClick={() => setError(undefined)} className="mt-2 font-medium text-muted hover:text-ink">Dismiss</button>
      </div>
    ) : null;
  }

  const video = (phase.s === "active" || phase.s === "calling") && phase.kind === "VIDEO";
  return (
    <div role="dialog" aria-label="Call" className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md rounded-3xl border border-line bg-surface p-4 shadow-2xl md:bottom-6">
      {phase.s === "incoming" ? (
        <div className="text-center">
          <p className="text-3xl" aria-hidden>{phase.call.kind === "VIDEO" ? "📹" : "📞"}</p>
          <p className="mt-1 font-semibold">{phase.call.caller}</p>
          <p className="text-sm text-muted">is {phase.call.kind === "VIDEO" ? "video" : "voice"} calling you…</p>
          <div className="mt-4 flex justify-center gap-3">
            <button type="button" onClick={() => accept(phase.call)} className="rounded-full bg-success px-6 py-2.5 font-semibold text-white active:scale-95">Answer</button>
            <button type="button" onClick={() => hangUp(true)} className="rounded-full bg-danger px-6 py-2.5 font-semibold text-white active:scale-95">Decline</button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold">{phase.name}</p>
              <p className="text-xs text-muted tabular-nums">{phase.s === "calling" ? "Ringing…" : `${phase.kind === "VIDEO" ? "Video" : "Voice"} call · ${mmss(Math.max(0, now - phase.since))}`}</p>
            </div>
          </div>
          {video ? (
            <div className="relative mt-3 aspect-video overflow-hidden rounded-2xl bg-black">
              <video ref={attachRemote} autoPlay playsInline className="h-full w-full object-cover" />
              <video ref={attachLocal} autoPlay playsInline muted className="absolute bottom-2 right-2 h-20 w-28 rounded-lg border border-white/30 object-cover" />
            </div>
          ) : (
            <audio ref={attachRemote} autoPlay />
          )}
          <div className="mt-4 flex justify-center gap-3">
            <button type="button" onClick={toggleMute} aria-pressed={muted} className="rounded-full border border-line px-4 py-2 text-sm font-semibold">{muted ? "Unmute" : "Mute"}</button>
            {video && <button type="button" onClick={toggleCam} aria-pressed={camOff} className="rounded-full border border-line px-4 py-2 text-sm font-semibold">{camOff ? "Camera on" : "Camera off"}</button>}
            <button type="button" onClick={() => hangUp()} className="rounded-full bg-danger px-5 py-2 text-sm font-semibold text-white active:scale-95">Hang up</button>
          </div>
        </div>
      )}
    </div>
  );
}
