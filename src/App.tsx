import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import VKCallback from "./pages/VKCallback";
import GoogleCallback from "./pages/GoogleCallback";
import VKCallbackDirect from "./pages/VKCallbackDirect";
import ClientPhotobook from "./pages/ClientPhotobook";

import FaceBlurEditor from "./components/FaceBlurEditor";
import MyFiles from "./pages/MyFiles";
import AdminStorage from "./pages/AdminStorage";
import PhotoBank from "./pages/PhotoBank";
import PhotoBankTrash from "./pages/PhotoBankTrash";
import Help from "./pages/webapp/Help";
import Settings from "./pages/webapp/Settings";
import Tariffs from "./pages/webapp/Tariffs";
import Clients from "./pages/webapp/Clients";
import AdminCleanup from "./pages/AdminCleanup";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    // Применяем сохранённую тему при загрузке приложения
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme) {
      // Если тема сохранена - используем её
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else {
      // Если темы нет - определяем по системным настройкам
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        localStorage.setItem('theme', 'light');
      }
    }
    
    // Слушаем изменения системной темы
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = (e: MediaQueryListEvent) => {
      const savedTheme = localStorage.getItem('theme');
      // Только если пользователь не выбрал тему вручную
      if (!savedTheme) {
        if (e.matches) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    };
    
    mediaQuery.addEventListener('change', handleThemeChange);
    return () => mediaQuery.removeEventListener('change', handleThemeChange);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/help" element={<Help />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/tariffs" element={<Tariffs />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/photo-bank" element={<PhotoBank />} />
          <Route path="/photo-bank/trash" element={<PhotoBankTrash />} />
          <Route path="/my-files" element={<MyFiles />} />
          <Route path="/admin/storage" element={<AdminStorage />} />
          <Route path="/admin/cleanup" element={<AdminCleanup />} />
          <Route path="/face-blur" element={<FaceBlurEditor />} />
          <Route path="/vk-callback" element={<VKCallbackDirect />} />
          <Route path="/auth/callback/vkid" element={<VKCallback />} />
          <Route path="/auth/callback/google" element={<GoogleCallback />} />
          <Route path="/client/photobook/:id" element={<ClientPhotobook />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;