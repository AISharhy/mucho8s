import React, { useCallback, useEffect, useRef, useState } from "react";
import { useData } from "@/context/DataContext";
import { Button } from "@/components/ui/button";
import { Send, MessageCircle } from "lucide-react";
import { toast } from "sonner";

const mergeMessages = (current, incoming) => {
  const byId = new Map();
  [...(Array.isArray(current) ? current : []), ...(Array.isArray(incoming) ? incoming : [])]
    .forEach((item) => {
      if (item?.id !== undefined && item?.id !== null) byId.set(String(item.id), item);
    });

  return [...byId.values()].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
};

export default function ChallengeChat({ challengeId }) {
  const {
    discordPlayer,
    playerMap,
    listChallengeMessages,
    sendChallengeMessage,
  } = useData();

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const firstLoadRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!challengeId) return;
    const next = await listChallengeMessages(challengeId, { silent: true });
    setMessages((current) => mergeMessages(current, next));
  }, [challengeId, listChallengeMessages]);

  useEffect(() => {
    setMessages([]);
    setDraft("");
    firstLoadRef.current = true;
    if (!challengeId) return undefined;

    void refresh();
    const timer = setInterval(refresh, 2500);
    return () => clearInterval(timer);
  }, [challengeId, refresh]);

  useEffect(() => {
    if (!messages.length) return;
    if (firstLoadRef.current) firstLoadRef.current = false;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length]);

  const send = async () => {
    const message = draft.trim();
    if (!message || sending) return;

    setSending(true);
    const created = await sendChallengeMessage(challengeId, message);
    setSending(false);

    if (!created) return;

    setDraft("");
    setMessages((current) => mergeMessages(current, [created]));
  };

  const onKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

  return (
    <div
      className="m8-panel rounded-2xl overflow-hidden border-[#242A35]"
      data-testid="challenge-chat"
    >
      <div className="h-14 px-4 border-b border-[#222834] flex items-center justify-between gap-3 bg-[#0D1016]">
        <div className="flex items-center gap-2">
          <MessageCircle size={17} className="text-[#D5A33A]" />
          <div>
            <div className="font-display font-black text-sm">MATCH CHAT</div>
            <div className="text-[9px] uppercase tracking-widest text-[#697181]">
              Private · players only
            </div>
          </div>
        </div>
        <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.55)]" />
      </div>

      <div className="h-[300px] overflow-y-auto p-3 space-y-2 bg-[#090C11]/55">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center px-6">
            <div>
              <MessageCircle size={26} className="text-[#394150] mx-auto mb-2" />
              <div className="text-sm font-semibold text-[#AAB1BE]">No messages yet</div>
              <div className="text-xs text-muted-foreground mt-1">
                Use the chat to arrange the match.
              </div>
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const mine = message.sender_player_id === discordPlayer?.id;
            const sender = playerMap?.[message.sender_player_id];
            const time = new Date(message.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                key={message.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[82%] ${
                  mine
                    ? "bg-magma text-white border-magma/40"
                    : "bg-[#151923] text-[#E5E7EB] border-[#2A303B]"
                } rounded-xl border px-3 py-2`}>
                  {!mine && (
                    <div className="text-[9px] uppercase tracking-widest text-[#D5A33A] font-black mb-1">
                      {sender?.name || "Player"}
                    </div>
                  )}
                  <div className="text-sm whitespace-pre-wrap break-words leading-5">
                    {message.body}
                  </div>
                  <div className={`text-[9px] mt-1 text-right ${
                    mine ? "text-white/60" : "text-[#697181]"
                  }`}>
                    {time}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-[#222834] bg-[#0D1016]">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value.slice(0, 500))}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={500}
            placeholder="Write a message..."
            className="min-h-11 max-h-28 flex-1 resize-none rounded-xl bg-[#151923] border border-[#2A303B] px-3 py-2.5 text-sm outline-none focus:border-magma/50"
            data-testid="challenge-chat-input"
          />
          <Button
            type="button"
            onClick={send}
            disabled={sending || !draft.trim()}
            className="h-11 w-11 p-0 rounded-xl bg-magma hover:bg-[#ff3c4c] text-white"
            aria-label="Send message"
            data-testid="challenge-chat-send"
          >
            <Send size={17} />
          </Button>
        </div>
        <div className="text-[9px] text-muted-foreground mt-1.5 text-right">
          {draft.length}/500
        </div>
      </div>
    </div>
  );
}
