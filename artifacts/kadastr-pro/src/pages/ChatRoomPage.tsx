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
import { Send, ChevronLeft, Paperclip, FileText, Image as ImageIcon, X, AlertTriangle, File, ZoomIn, Download, FileSpreadsheet, FileArchive, FileCode } from "lucide-react";

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
      .catch(() => {/* silently ignore */});
  }, []);
}

/** Format bytes to a human-readable string. */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

/** Pick an icon for a non-image MIME type. */
function FileTypeIcon({ type, className }: { type: string; className?: string }) {
  if (type === "application/pdf") return <FileText className={className} />;
  if (type.includes("spreadsheet") || type.includes("excel") || type.includes("xls"))
    return <FileSpreadsheet className={className} />;
  if (type.includes("zip") || type.includes("rar") || type.includes("archive"))
    return <FileArchive className={className} />;
  if (type.includes("word") || type.includes("document"))
    return <FileCode className={className} />;
  return <File className={className} />;
}

/** Full-screen lightbox that fetches the image with a Bearer token. */
function ImageLightbox({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  const blobUrl = useAuthBlobUrl(url);
  const authDownload = useAuthDownload();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center"
      onClick={onClose}
      data-testid="lightbox-overlay"
    >
      <div
        className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {blobUrl ? (
          <img
            src={blobUrl}
            alt={name}
            className="max-w-[90vw] max-h-[80vh] rounded-lg object-contain shadow-2xl"
            data-testid="lightbox-image"
          />
        ) : (
          <div className="w-64 h-48 rounded-lg bg-muted/30 flex items-center justify-center">
            <ImageIcon className="w-10 h-10 text-white/40 animate-pulse" />
          </div>
        )}
        <p className="text-white/70 text-sm truncate max-w-[80vw]">{name}</p>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => authDownload(url, name)}
            data-testid="lightbox-download"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Скачать
          </Button>
          <Button size="sm" variant="ghost" className="text-white/70 hover:text-white" onClick={onClose}>
            <X className="w-4 h-4 mr-1.5" />
            Закрыть
          </Button>
        </div>
      </div>
    </div>
  );
}

function AttachmentBubble({
  url, name, type, size, isMe,
}: {
  url: string;
  name: string;
  type: string;
  size?: number | null;
  isMe: boolean;
}) {
  const isImage = type.startsWith("image/");
  const blobUrl = useAuthBlobUrl(isImage ? url : null);
  const authDownload = useAuthDownload();
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (isImage) {
    return (
      <>
        <button
          onClick={() => setLightboxOpen(true)}
          className="relative block mt-1.5 cursor-zoom-in group"
          title="Нажмите для просмотра"
          data-testid="attachment-image-thumb"
        >
          {blobUrl ? (
            <>
              <img
                src={blobUrl}
                alt={name}
                className="max-w-[220px] max-h-48 rounded-lg object-cover"
              />
              <div className="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
              </div>
            </>
          ) : (
            <div className="w-40 h-24 rounded-lg bg-muted/60 flex items-center justify-center">
              <ImageIcon className="w-6 h-6 text-muted-foreground animate-pulse" />
            </div>
          )}
        </button>
        {lightboxOpen && (
          <ImageLightbox url={url} name={name} onClose={() => setLightboxOpen(false)} />
        )}
      </>
    );
  }

  const baseClass = isMe
    ? "bg-primary/80 text-primary-foreground rounded-lg"
    : "bg-muted/80 border rounded-lg";

  return (
    <button
      onClick={() => authDownload(url, name)}
      className={`flex items-start gap-2.5 px-3 py-2.5 mt-1.5 text-sm max-w-[240px] hover:opacity-80 transition-opacity cursor-pointer ${baseClass}`}
      title={`Скачать ${name}`}
      data-testid="attachment-file-bubble"
    >
      <FileTypeIcon type={type} className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <span className="flex flex-col items-start gap-0.5 min-w-0">
        <span className="truncate text-xs font-medium max-w-[170px]">{name}</span>
        {size != null && (
          <span className={`text-[10px] ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
            {formatFileSize(size)}
          </span>
        )}
      </span>
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
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<{ url: string; name: string; type: string; size: number } | null>(null);
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
          attachmentSize: pendingAttachment.size,
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

    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const token = localStorage.getItem("kadastr_token");

      const result = await new Promise<{ url: string; name: string; type: string; size: number }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (ev) => {
          if (ev.lengthComputable) {
            setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch {
              reject(new Error("Invalid server response"));
            }
          } else {
            try {
              const err = JSON.parse(xhr.responseText);
              reject(new Error(err.error ?? "Upload failed"));
            } catch {
              reject(new Error("Upload failed"));
            }
          }
        });

        xhr.addEventListener("error", () => reject(new Error("Network error")));
        xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

        xhr.open("POST", `/api/chats/${id}/upload`);
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.send(formData);
      });

      setPendingAttachment({ url: result.url, name: result.name, type: result.type, size: result.size });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Неизвестная ошибка";
      toast({ title: "Ошибка загрузки", description: msg, variant: "destructive" });
    } finally {
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const isUploading = uploadProgress !== null;
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
              const attachmentSize = (msg as unknown as { attachmentSize?: number | null }).attachmentSize ?? null;

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
                      <AttachmentBubble
                        url={attachmentUrl}
                        name={attachmentName}
                        type={attachmentType}
                        size={attachmentSize}
                        isMe={isMe}
                      />
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

      {/* Upload progress bar */}
      {isUploading && (
        <div className="mx-0 mb-2 space-y-1" data-testid="upload-progress-container">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>Загрузка файла...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-150"
              style={{ width: `${uploadProgress}%` }}
              data-testid="upload-progress-bar"
            />
          </div>
        </div>
      )}

      {/* Pending attachment preview */}
      {pendingAttachment && !isUploading && (
        <div className="mx-0 mb-2 flex items-center gap-2 bg-muted/60 border rounded-xl px-3 py-2">
          {pendingAttachment.type.startsWith("image/") ? (
            <ImageIcon className="w-4 h-4 text-primary flex-shrink-0" />
          ) : (
            <FileTypeIcon type={pendingAttachment.type} className="w-4 h-4 text-primary flex-shrink-0" />
          )}
          <span className="text-xs flex-1 truncate text-muted-foreground">{pendingAttachment.name}</span>
          <span className="text-xs text-muted-foreground/70 flex-shrink-0">{formatFileSize(pendingAttachment.size)}</span>
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
