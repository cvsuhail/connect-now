import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Landing from "./pages/Landing";
import ChatRoom from "./pages/ChatRoom";
import NotFound from "./pages/NotFound";
import SuperAdmin from "./pages/SuperAdmin";
import { OnlineCountProvider } from "@/hooks/useOnlineCount";
import { AuthProfileProvider } from "@/hooks/useAuthProfile";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <OnlineCountProvider>
      <AuthProfileProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/chat" element={<ChatRoom />} />
              <Route path="/super-admin-397" element={<SuperAdmin />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProfileProvider>
    </OnlineCountProvider>
  </QueryClientProvider>
);

export default App;
