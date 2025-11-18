
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
import FaceBlurEditor from "./components/FaceBlurEditor";
import MyFiles from "./pages/MyFiles";
import AdminStorage from "./pages/AdminStorage";
import UpgradePlan from "./pages/UpgradePlan";

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
          <Route path="/my-files" element={<MyFiles />} />
          <Route path="/upgrade-plan" element={<UpgradePlan />} />
          <Route path="/admin/storage" element={<AdminStorage />} />
          <Route path="/face-blur" element={<FaceBlurEditor />} />
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