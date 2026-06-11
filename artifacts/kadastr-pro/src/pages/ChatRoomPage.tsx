import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  useListMessages, getListMessagesQueryKey,
  useSendMessage,
  useListChats, getListChatsQueryKey,
  useMarkChatRead,
  useCreateComplaint,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Send, ChevronLeft, Paperclip, FileText, Image as ImageIcon, X, AlertTriangle, File } from "lucide-react";

/** Fetches a private URL with the Bearer token and returns an object URL for in-page rendering. */
function useAuthBlobUrl(url: string | null): string | null {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    let objectUrl: string | null = null;
    const token = localStorage.getItem("kadastr_token");

    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => (r.ok ? r.blob() : Promise.reject(r.status)))
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => setBlobUrl(null));

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setBlobUrl(null);
    };
  }, [url]);

  return blobUrl;
}

/** Downloads a private file by fetching with Bearer token then triggering a save-as. */
function useAuthDownload() {
  return useCallback((url: string, filename: string) => {
    const token = localStorage.getItem("kadastr_token");
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => (r.ok ? r.blob() : Promise.reject(r.status)))
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(objectUrl);
      })
      .catch(() => {/* silently ignore — user sees nothing changed */});
  }, []);
}

function AttachmentBubble({ url, name, type, isMe }: { url: string; name: string; type: string; isMe: boolean }) {
  const isImage = type.startsWith("image/");
  const blobUrl = useAuthBlobUrl(isImage ? url : null);
  const authDownload = useAuthDownload();

  if (isImage) {
    return (
      <button
        onClick={() => authDownload(url, name)}
        className="block mt-1.5 cursor-pointer"
        title={name}
      >
        {blobUrl ? (
          <img
            src={blobUrl}
            alt={name}
            className="max-w-[220px] max-h-48 rounded-lg object-cover"
          />
        ) : (
          <div className="w-40 h-24 rounded-lg bg-muted/60 flex items-center justify-center">
            <ImageIcon className="w-6 h-6 text-muted-foreground animate-pulse" />
          </div>
        )}
      </button>
    );
  }

  const baseClass = isMe
    ? "bg-primary/80 text-primary-foreground rounded-lg"
    : "bg-muted/80 border rounded-lg";

  return (
    <button
      onClick={() => authDownload(url, name)}
      className={`flex items-center gap-2 px-3 py-2 mt-1.5 text-sm max-w-[240px] hover:opacity-80 transition-opacity cursor-pointer ${baseClass}`}
      title={`Скачать ${name}`}
    >
      <FileText className="w-4 h-4 flex-shrink-0" />
      <span className="truncate text-xs">{name}</span>
    </button>
  );
}

export default function ChatRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const id = parseInt(roomId);
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{ url: string; name: string; type: string } | null>(null);
  const [showComplaint, setShowComplaint] = useState(false);
  const [complaintText, setComplaintText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        setPendingAttachment(null);
      },
    },
  });

  const submitComplaint = useCreateComplaint({
    mutation: {
      onSuccess: () => {
        setShowComplaint(false);
        setComplaintText("");
        toast({ title: "Жалоба отправлена", description: "Администратор рассмотрит ваше обращение в ближайшее время." });
      },
      onError: () => toast({ title: "Ошибка", description: "Не удалось отправить жалобу", variant: "destructive" }),
    },
  });

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

  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(id) });
    }, 3000);
    return () => clearInterval(interval);
  }, [id, queryClient]);

  const handleSend = () => {
    if (!text.trim() && !pendingAttachment) return;
    sendMessage.mutate({
      roomId: id,
      data: {
        text: text.trim() || "",
        ...(pendingAttachment ? {
          attachmentUrl: pendingAttachment.url,
          attachmentName: pendingAttachment.name,
          attachmentType: pendingAttachment.type,
        } : {}),
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "Файл слишком большой", description: "Максимальный размер файла — 20 МБ", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const token = localStorage.getItem("kadastr_token");
      const response = await fetch(`/api/chats/${id}/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error ?? "Upload failed");
      }

      const result = await response.json();
      setPendingAttachment({ url: result.url, name: result.name, type: result.type });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Неизвестная ошибка";
      toast({ title: "Ошибка загрузки", description: msg, variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const canSend = !sendMessage.isPending && !isUploading && (!!text.trim() || !!pendingAttachment);

  return (
    <div className="container mx-auto px-4 py-0 max-w-2xl flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="border-b py-3 mb-0 flex items-center gap-3">
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
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm" data-testid="heading-chat-room">{otherPerson.name}</p>
              {currentRoom?.order && (
                <p className="text-xs text-muted-foreground truncate">{currentRoom.order.title}</p>
              )}
            </div>
          </>
        )}
        {!otherPerson && (
          <h1 className="text-lg font-bold flex-1" data-testid="heading-chat-room">Чат</h1>
        )}
        {(currentRoom as unknown as { contactsUnlocked?: boolean })?.contactsUnlocked && otherPerson && (
          <div className="flex flex-col gap-0.5 text-xs text-muted-foreground mr-2" data-testid="contact-info">
            {(otherPerson as { phone?: string | null }).phone && (
              <a href={`tel:${(otherPerson as { phone: string }).phone}`} className="flex items-center gap-1 hover:text-primary transition-colors">
                <span>📞</span> {(otherPerson as { phone: string }).phone}
              </a>
            )}
            {(otherPerson as { email?: string | null }).email && (
              <a href={`mailto:${(otherPerson as { email: string }).email}`} className="flex items-center gap-1 hover:text-primary transition-colors">
                <span>✉️</span> {(otherPerson as { email: string }).email}
              </a>
            )}
            {(otherPerson as { telegram?: string | null }).telegram && (
              <a href={`https://t.me/${(otherPerson as { telegram: string }).telegram.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary transition-colors">
                <span>💬</span> {(otherPerson as { telegram: string }).telegram}
              </a>
            )}
            {(otherPerson as { whatsapp?: string | null }).whatsapp && (
              <a href={`https://wa.me/${(otherPerson as { whatsapp: string }).whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary transition-colors">
                <span>📱</span> {(otherPerson as { whatsapp: string }).whatsapp}
              </a>
            )}
          </div>
        )}
        <button
          className="text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1.5 text-xs ml-auto"
          onClick={() => setShowComplaint(true)}
          title="Пожаловаться"
          data-testid="button-complaint"
        >
          <AlertTriangle className="w-4 h-4" />
          <span className="hidden sm:inline">Жалоба</span>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3" data-testid="messages-container">
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : messages && messages.length > 0 ? (
          <>
            {messages.map((msg) => {
              const isMe = msg.senderId === user?.id;
              const hasAttachment = !!(msg as unknown as { attachmentUrl?: string }).attachmentUrl;
              const attachmentUrl = (msg as unknown as { attachmentUrl?: string }).attachmentUrl;
              const attachmentName = (msg as unknown as { attachmentName?: string }).attachmentName ?? "Файл";
              const attachmentType = (msg as unknown as { attachmentType?: string }).attachmentType ?? "application/octet-stream";

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
                    {msg.text && (
                      <p className="text-sm leading-relaxed" data-testid={`message-text-${msg.id}`}>{msg.text}</p>
                    )}
                    {hasAttachment && attachmentUrl && (
                      <AttachmentBubble url={attachmentUrl} name={attachmentName} type={attachmentType} isMe={isMe} />
                    )}
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

      {/* Pending attachment preview */}
      {pendingAttachment && (
        <div className="mx-0 mb-2 flex items-center gap-2 bg-muted/60 border rounded-xl px-3 py-2">
          {pendingAttachment.type.startsWith("image/") ? (
            <ImageIcon className="w-4 h-4 text-primary flex-shrink-0" />
          ) : (
            <File className="w-4 h-4 text-primary flex-shrink-0" />
          )}
          <span className="text-xs flex-1 truncate text-muted-foreground">{pendingAttachment.name}</span>
          <button
            onClick={() => setPendingAttachment(null)}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 border-t py-3">
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip"
          onChange={handleFileSelect}
          data-testid="input-file"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex-shrink-0 text-muted-foreground hover:text-primary"
          title="Прикрепить файл"
          data-testid="button-attach"
        >
          <Paperclip className="w-5 h-5" />
        </Button>
        <Input
          placeholder={pendingAttachment ? "Добавьте подпись к файлу..." : "Введите сообщение..."}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
          data-testid="input-message"
        />
        <Button
          onClick={handleSend}
          disabled={!canSend}
          data-testid="button-send"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>

      {/* Complaint Modal */}
      <Dialog open={showComplaint} onOpenChange={setShowComplaint}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Пожаловаться
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Опишите нарушение. Администратор рассмотрит жалобу и примет меры.
            </p>
            <Textarea
              placeholder="Опишите причину жалобы..."
              value={complaintText}
              onChange={(e) => setComplaintText(e.target.value)}
              rows={4}
              data-testid="input-complaint"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowComplaint(false)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              disabled={!complaintText.trim() || submitComplaint.isPending}
              onClick={() => submitComplaint.mutate({ roomId: id, data: { description: complaintText } })}
              data-testid="button-submit-complaint"
            >
              {submitComplaint.isPending ? "Отправляем..." : "Отправить жалобу"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
