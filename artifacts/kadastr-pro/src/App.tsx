import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import HomePage from "@/pages/HomePage";
import EngineersPage from "@/pages/EngineersPage";
import EngineerCardPage from "@/pages/EngineerCardPage";
import CreateOrderPage from "@/pages/CreateOrderPage";
import OrderDetailPage from "@/pages/OrderDetailPage";
import CustomerDashboardPage from "@/pages/CustomerDashboardPage";
import EngineerDashboardPage from "@/pages/EngineerDashboardPage";
import ChatPage from "@/pages/ChatPage";
import ChatRoomPage from "@/pages/ChatRoomPage";
import AdminPage from "@/pages/AdminPage";
import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
  },
});

function BlockedScreen() {
  const { logout } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3 max-w-sm px-6">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-2">
          <svg className="w-8 h-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-foreground">Вы заблокированы</h1>
        <p className="text-muted-foreground text-sm">Доступ к сервису ограничен.</p>
        <button
          onClick={logout}
          className="mt-4 text-sm text-primary underline underline-offset-4 hover:text-primary/80"
        >
          Выйти из аккаунта
        </button>
      </div>
    </div>
  );
}

function Router() {
  const { isBlocked } = useAuth();

  if (isBlocked) {
    return (
      <Layout>
        <BlockedScreen />
      </Layout>
    );
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/engineers" component={EngineersPage} />
        <Route path="/engineers/:id" component={EngineerCardPage} />
        <Route path="/orders/create" component={CreateOrderPage} />
        <Route path="/orders/:orderId" component={OrderDetailPage} />
        <Route path="/dashboard/customer" component={CustomerDashboardPage} />
        <Route path="/dashboard/engineer" component={EngineerDashboardPage} />
        <Route path="/chat" component={ChatPage} />
        <Route path="/chat/:roomId" component={ChatRoomPage} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/auth/login" component={LoginPage} />
        <Route path="/auth/register" component={RegisterPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
