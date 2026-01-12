import { useEffect, useState } from "react";
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
import MobileUpload from "./pages/webapp/MobileUpload";
import AdminCleanup from "./pages/AdminCleanup";
import NewYearDecorations from "./components/NewYearDecorations";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import ShortLink from "./pages/ShortLink";

const queryClient = new QueryClient();

const App = () => {
  const [newYearMode, setNewYearMode] = useState(false);

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
      // Если темы нет - по умолчанию тёмная тема
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
    
    // Слушаем изменения темы через custom event
    const handleThemeChange = () => {
      const currentTheme = localStorage.getItem('theme');
      if (currentTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };
    
    window.addEventListener('themeChange', handleThemeChange);
    return () => window.removeEventListener('themeChange', handleThemeChange);
  }, []);

  useEffect(() => {
    // Загрузка новогоднего режима
    const savedNewYearMode = localStorage.getItem('newYearMode') === 'true';
    setNewYearMode(savedNewYearMode);

    // Слушаем изменения новогоднего режима
    const handleNewYearModeChange = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      setNewYearMode(customEvent.detail);
    };

    window.addEventListener('newYearModeChange', handleNewYearModeChange);
    return () => window.removeEventListener('newYearModeChange', handleNewYearModeChange);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {newYearMode && <NewYearDecorations />}
        <Toaster />
        <Sonner />
        <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/help" element={<Help />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/tariffs" element={<Tariffs />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/mobile-upload" element={<MobileUpload />} />
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
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/s/:code" element={<ShortLink />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;