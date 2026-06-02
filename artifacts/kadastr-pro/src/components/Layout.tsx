import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, ChevronDown, LogOut, User, MessageSquare, LayoutDashboard, Shield } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const isActive = (path: string) => location === path;

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={`text-sm font-medium transition-colors hover:text-primary ${isActive(href) ? "text-primary" : "text-muted-foreground"}`}
      data-testid={`nav-link-${label.toLowerCase()}`}
    >
      {label}
    </Link>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2" data-testid="nav-logo">
              <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
                <MapPin className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg text-foreground">КадастрПро</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              {navLink("/engineers", "Инженеры")}
              {navLink("/orders/create", "Разместить заявку")}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link href="/chat" data-testid="nav-chat">
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                    <MessageSquare className="w-5 h-5" />
                  </Button>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center gap-2 h-9 px-3" data-testid="nav-user-menu">
                      <Avatar className="w-7 h-7">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {user.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden sm:block text-sm font-medium">{user.name.split(" ")[0]}</span>
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <div className="px-2 py-1.5">
                      <p className="text-sm font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <DropdownMenuSeparator />
                    {user.role === "customer" && (
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard/customer" className="flex items-center gap-2 cursor-pointer" data-testid="nav-customer-dashboard">
                          <LayoutDashboard className="w-4 h-4" /> Личный кабинет
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {user.role === "engineer" && (
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard/engineer" className="flex items-center gap-2 cursor-pointer" data-testid="nav-engineer-dashboard">
                          <LayoutDashboard className="w-4 h-4" /> Кабинет инженера
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {user.role === "admin" && (
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="flex items-center gap-2 cursor-pointer" data-testid="nav-admin">
                          <Shield className="w-4 h-4" /> Админ-панель
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive flex items-center gap-2 cursor-pointer"
                      onClick={logout}
                      data-testid="nav-logout"
                    >
                      <LogOut className="w-4 h-4" /> Выйти
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/auth/login" data-testid="nav-login">
                  <Button variant="ghost" size="sm">Войти</Button>
                </Link>
                <Link href="/auth/register" data-testid="nav-register">
                  <Button size="sm">Регистрация</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="border-t bg-white py-8 mt-16">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
                <MapPin className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-semibold text-foreground">КадастрПро</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 КадастрПро — Маркетплейс кадастровых услуг России
            </p>
            <nav className="flex gap-4">
              <Link href="/engineers" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Инженеры</Link>
              <Link href="/orders/create" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Разместить заявку</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
