import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useListChats, getListChatsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";

export default function ChatPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: chats, isLoading } = useListChats({
    query: { enabled: !!user, queryKey: getListChatsQueryKey() },
  });

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-semibold mb-4">Войдите, чтобы просмотреть чаты</h2>
        <Button onClick={() => setLocation("/auth/login")}>Войти</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl">
      <h1 className="text-3xl font-bold text-foreground mb-8" data-testid="heading-chats">Сообщения</h1>
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
      ) : chats && chats.length > 0 ? (
        <div className="space-y-2">
          {chats.map((chat) => {
            const other = user.role === "engineer" ? chat.customer : chat.engineer.user;
            return (
              <Card
                key={chat.id}
                className="cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => setLocation(`/chat/${chat.id}`)}
                data-testid={`card-chat-${chat.id}`}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <Avatar className="w-12 h-12 flex-shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {other.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm" data-testid={`text-chat-name-${chat.id}`}>{other.name}</span>
                      {chat.lastMessageAt && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(chat.lastMessageAt).toLocaleDateString("ru-RU")}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-0.5" data-testid={`text-chat-last-${chat.id}`}>
                      {chat.lastMessage ?? "Нет сообщений"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <h3 className="font-medium text-foreground mb-1">Сообщений пока нет</h3>
          <p className="text-sm">Найдите инженера и начните общение</p>
          <Button className="mt-4" onClick={() => setLocation("/engineers")} data-testid="button-find-engineer">Найти инженера</Button>
        </div>
      )}
    </div>
  );
}
