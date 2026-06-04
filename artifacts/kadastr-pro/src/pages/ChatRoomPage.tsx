import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useListMessages, getListMessagesQueryKey,
  useSendMessage,
  useListChats, getListChatsQueryKey,
  useMarkChatRead,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Send, ChevronLeft } from "lucide-react";

export default function ChatRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const id = parseInt(roomId);
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Get room info from chats list for the header
  const { data: chats } = useListChats({ query: { queryKey: getListChatsQueryKey() } });
  const currentRoom = chats?.find(c => c.id === id);
  const otherPerson = currentRoom
    ? (user?.role === "engineer" ? currentRoom.customer : currentRoom.engineer.user)
    : null;

  const { data: messages, isLoading } = useListMessages(id, {
    query: { enabled: !!id, queryKey: getListMessagesQueryKey(id) },
  });

  const markRead = useMarkChatRead();

  const sendMessage = useSendMessage({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() });
        setText("");
      },
    },
  });

  // Mark as read when messages load
  useEffect(() => {
    if (messages && messages.length > 0) {
      markRead.mutate({ roomId: id });
      queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages?.length]);

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
    <div className="container mx-auto px-4 py-0 max-w-2xl flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="border-b py-4 mb-0 flex items-center gap-3">
        <button
          className="text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setLocation("/chat")}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        {otherPerson && (
          <>
            <Avatar className="w-9 h-9">
              {(otherPerson as { avatarUrl?: string | null }).avatarUrl && (
                <AvatarImage src={(otherPerson as { avatarUrl: string }).avatarUrl} alt={otherPerson.name} />
              )}
              <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                {otherPerson.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-sm" data-testid="heading-chat-room">{otherPerson.name}</p>
              {currentRoom?.order && (
                <p className="text-xs text-muted-foreground">{currentRoom.order.title}</p>
              )}
            </div>
          </>
        )}
        {!otherPerson && (
          <h1 className="text-lg font-bold" data-testid="heading-chat-room">Чат</h1>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3" data-testid="messages-container">
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : messages && messages.length > 0 ? (
          <>
            {messages.map((msg) => {
              const isMe = msg.senderId === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}
                  data-testid={`message-${msg.id}`}
                >
                  {!isMe && (
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      {(msg.sender as { avatarUrl?: string | null }).avatarUrl && (
                        <AvatarImage src={(msg.sender as { avatarUrl: string }).avatarUrl} alt={msg.sender.name} />
                      )}
                      <AvatarFallback className="text-xs bg-muted">{msg.sender.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  )}
                  <div className={`max-w-[72%] rounded-2xl px-4 py-2.5 ${isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"}`}>
                    <p className="text-sm leading-relaxed" data-testid={`message-text-${msg.id}`}>{msg.text}</p>
                    <p className={`text-xs mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      {new Date(msg.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                      {isMe && (
                        <span className="ml-1.5">{msg.isRead ? "✓✓" : "✓"}</span>
                      )}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Напишите первое сообщение
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2 border-t py-4">
        <Input
          placeholder="Введите сообщение..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
          data-testid="input-message"
        />
        <Button
          onClick={handleSend}
          disabled={sendMessage.isPending || !text.trim()}
          data-testid="button-send"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
