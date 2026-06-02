import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useListMessages, getListMessagesQueryKey, useSendMessage } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";

export default function ChatRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const id = parseInt(roomId);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useListMessages(id, {
    query: { enabled: !!id, queryKey: getListMessagesQueryKey(id) },
  });

  const sendMessage = useSendMessage({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(id) });
        setText("");
      },
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Poll for new messages every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(id) });
    }, 3000);
    return () => clearInterval(interval);
  }, [id, queryClient]);

  const handleSend = () => {
    if (!text.trim()) return;
    sendMessage.mutate({ roomId: id, data: { text: text.trim() } });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl flex flex-col h-[calc(100vh-8rem)]">
      <div className="border-b pb-4 mb-4">
        <h1 className="text-xl font-bold" data-testid="heading-chat-room">Чат</h1>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4" data-testid="messages-container">
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : messages && messages.length > 0 ? (
          messages.map((msg) => {
            const isMe = msg.senderId === user?.id;
            return (
              <div key={msg.id} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`} data-testid={`message-${msg.id}`}>
                {!isMe && (
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarFallback className="text-xs bg-muted">{msg.sender.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                )}
                <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"}`}>
                  <p className="text-sm" data-testid={`message-text-${msg.id}`}>{msg.text}</p>
                  <p className={`text-xs mt-0.5 ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {new Date(msg.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Напишите первое сообщение
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 border-t pt-4">
        <Input
          placeholder="Введите сообщение..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
          data-testid="input-message"
        />
        <Button onClick={handleSend} disabled={sendMessage.isPending || !text.trim()} data-testid="button-send">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
