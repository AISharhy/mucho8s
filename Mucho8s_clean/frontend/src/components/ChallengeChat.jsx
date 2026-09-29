import React, { useCallback, useEffect, useRef, useState } from "react";
import { useData } from "@/context/DataContext";
import { Button } from "@/components/ui/button";
import { ChevronDown, Send, MessageCircle } from "lucide-react";
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
  const [open, setOpen] = useState(false);
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
      className="m8-panel rounded-xl overflow-hidden border-[#242A35]"
      data-testid="challenge-chat"
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="w-full min-h-10 px-3 flex items-center justify-between gap-3 bg-[#0D1016] hover:bg-[#11151C] transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 min-w-0">
          <MessageCircle size={14} className="text-emerald-400 shrink-0" />
          <div className="flex items-center gap-2 min-w-0">
            <div className="font-display font-black text-xs whitespace-nowrap">MUCHO1V1 CHAT</div>
            <div className="hidden sm:block text-[8px] uppercase tracking-widest text-[#697181] whitespace-nowrap">
              Private · players only
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_7px_rgba(52,211,153,.5)]" />
          <ChevronDown
            size={14}
            className={`text-[#697181] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {open && (
        <>
          <div className="h-[185px] overflow-y-auto p-3 space-y-2 bg-[#090C11]/55 border-t border-[#222834]">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center px-6">
                <div>
                  <MessageCircle size={20} className="text-[#394150] mx-auto mb-1.5" />
                  <div className="text-xs font-semibold text-[#AAB1BE]">No messages yet</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Use the chat to arrange the Mucho1v1.
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
                        ? "bg-emerald-500/10 text-white border-emerald-500/25"
                        : "bg-[#151923] text-[#E5E7EB] border-[#2A303B]"
                    } rounded-xl border px-3 py-2`}>
                      {!mine && (
                        <div className="text-[9px] uppercase tracking-widest text-emerald-400 font-black mb-1">
                          {sender?.name || "Player"}
                        </div>
                      )}
                      <div className="text-sm whitespace-pre-wrap break-words leading-5">
                        {message.body}
                      </div>
                      <div className="text-[9px] mt-1 text-right text-[#697181]">
                        {time}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          <div className="p-2.5 border-t border-[#222834] bg-[#0D1016]">
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value.slice(0, 500))}
                onKeyDown={onKeyDown}
                rows={1}
                maxLength={500}
                placeholder="Write a message..."
                className="min-h-9 max-h-20 flex-1 resize-none rounded-lg bg-[#151923] border border-[#2A303B] px-3 py-2 text-xs outline-none focus:border-emerald-500/40"
                data-testid="challenge-chat-input"
              />
              <Button
                type="button"
                onClick={send}
                disabled={sending || !draft.trim()}
                className="h-9 w-9 p-0 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-black"
                aria-label="Send message"
                data-testid="challenge-chat-send"
              >
                <Send size={14} />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}