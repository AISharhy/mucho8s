import React, { useCallback, useEffect, useRef, useState } from "react";
import { useData } from "@/context/DataContext";
import { Button } from "@/components/ui/button";
import { MessageCircle, Send } from "lucide-react";

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

export default function LiveMatchChat({ liveMatchId }) {
  const {
    discordPlayer,
    playerMap,
    listLiveMatchMessages,
    sendLiveMatchMessage,
  } = useData();

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!liveMatchId) return;
    const next = await listLiveMatchMessages(liveMatchId, { silent: true });
    setMessages((current) => mergeMessages(current, next));
  }, [liveMatchId, listLiveMatchMessages]);

  useEffect(() => {
    setMessages([]);
    setDraft("");
    if (!liveMatchId) return undefined;

    void refresh();
    const timer = window.setInterval(refresh, 2200);
    return () => window.clearInterval(timer);
  }, [liveMatchId, refresh]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length]);

  const send = async () => {
    const message = draft.trim();
    if (!message || sending) return;

    setSending(true);
    const created = await sendLiveMatchMessage(liveMatchId, message);
    setSending(false);
    if (!created) return;

    setDraft("");
    setMessages((current) => mergeMessages(current, [created]));
  };

  return (
    <div className="m8-panel rounded-2xl overflow-hidden border-[#242A35] h-full flex flex-col" data-testid="live-match-chat">
      <div className="h-12 px-4 border-b border-[#222834] flex items-center justify-between gap-3 bg-[#0D1016] shrink-0">
        <div className="flex items-center gap-2">
          <MessageCircle size={16} className="text-[#65D5D3]" />
          <div>
            <div className="font-display font-black text-sm">MUCHO8S CHAT</div>
            <div className="text-[9px] uppercase tracking-widest text-[#697181]">
              Private · lobby players
            </div>
          </div>
        </div>
        <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.55)]" />
      </div>

      <div className="h-[255px] overflow-y-auto p-3 space-y-2 bg-[#090C11]/55">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center px-6">
            <div>
              <MessageCircle size={24} className="text-[#394150] mx-auto mb-2" />
              <div className="text-sm font-semibold text-[#AAB1BE]">No messages yet</div>
              <div className="text-xs text-muted-foreground mt-1">
                Use the room chat to organize the BO3.
              </div>
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const mine = String(message.sender_player_id) === String(discordPlayer?.id || "");
            const sender = playerMap?.[message.sender_player_id];
            const time = new Date(message.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[84%] rounded-xl border px-3 py-2 ${
                    mine
                      ? "bg-[#65D5D3]/10 text-white border-[#65D5D3]/25"
                      : "bg-[#151923] text-[#E5E7EB] border-[#2A303B]"
                  }`}
                >
                  {!mine && (
                    <div className="text-[9px] uppercase tracking-widest text-[#65D5D3] font-black mb-1">
                      {sender?.name || (message.sender_player_id === "__admin__" ? "Admin" : "Player")}
                    </div>
                  )}
                  <div className="text-sm whitespace-pre-wrap break-words leading-5">{message.body}</div>
                  <div className="text-[9px] mt-1 text-right text-[#697181]">{time}</div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-[#222834] bg-[#0D1016] shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value.slice(0, 500))}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            rows={1}
            maxLength={500}
            placeholder="Write to the lobby..."
            className="min-h-10 max-h-24 flex-1 resize-none rounded-xl bg-[#151923] border border-[#2A303B] px-3 py-2 text-sm outline-none focus:border-[#65D5D3]/50"
          />
          <Button
            type="button"
            onClick={send}
            disabled={sending || !draft.trim()}
            className="h-10 w-10 p-0 rounded-xl bg-[#65D5D3] hover:bg-[#79e1df] text-black"
            aria-label="Send message"
          >
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
