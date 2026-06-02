import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import HomePage from "@/pages/HomePage";
import EngineersPage from "@/pages/EngineersPage";
import EngineerCardPage from "@/pages/EngineerCardPage";
import CreateOrderPage from "@/pages/CreateOrderPage";
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

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/engineers" component={EngineersPage} />
        <Route path="/engineers/:id" component={EngineerCardPage} />
        <Route path="/orders/create" component={CreateOrderPage} />
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
