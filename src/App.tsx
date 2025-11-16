
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import VKCallback from "./pages/VKCallback";
import VKCallbackDirect from "./pages/VKCallbackDirect";
import ClientPhotobook from "./pages/ClientPhotobook";
import BackButton from "./components/BackButton";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <BackButton />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/vk-callback" element={<VKCallbackDirect />} />
          <Route path="/auth/callback/vkid" element={<VKCallback />} />
          <Route path="/client/photobook/:id" element={<ClientPhotobook />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;