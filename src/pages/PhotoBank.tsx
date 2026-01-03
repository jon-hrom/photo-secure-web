import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PhotoBankStorageIndicator from '@/components/photobank/PhotoBankStorageIndicator';
import PhotoBankHeader from '@/components/photobank/PhotoBankHeader';
import PhotoBankFoldersList from '@/components/photobank/PhotoBankFoldersList';
import PhotoBankPhotoGrid from '@/components/photobank/PhotoBankPhotoGrid';
import PhotoBankDialogs from '@/components/photobank/PhotoBankDialogs';
import CameraUploadDialog from '@/components/photobank/CameraUploadDialog';
import MobileNavigation from '@/components/layout/MobileNavigation';
import Icon from '@/components/ui/icon';
import { usePhotoBankState } from '@/hooks/usePhotoBankState';
import { usePhotoBankApi } from '@/hooks/usePhotoBankApi';
import { usePhotoBankHandlers } from '@/hooks/usePhotoBankHandlers';
import { usePhotoBankNavigationHistory } from '@/hooks/usePhotoBankNavigationHistory';
import { isAdminUser } from '@/utils/adminCheck';

const PhotoBank = () => {
  const navigate = useNavigate();
  
  const getAuthUserId = (): string | null => {
    const adminViewingUserId = localStorage.getItem('admin_viewing_user_id');
    if (adminViewingUserId) {
      const authSession = localStorage.getItem('authSession');
      const vkUser = localStorage.getItem('vk_user');
      const googleUser = localStorage.getItem('google_user');
      
      let adminEmail = null;
      let adminVkData = null;
      
      if (authSession) {
        try {
          const session = JSON.parse(authSession);
          adminEmail = session.userEmail;
        } catch {}
      }
      
      if (vkUser) {
        try {
          adminVkData = JSON.parse(vkUser);
        } catch {}
      }
      
      if (isAdminUser(adminEmail, adminVkData)) {
        console.log('[PHOTO_BANK] Admin viewing user:', adminViewingUserId);
        return adminViewingUserId;
      }
    }
    
    const authSession = localStorage.getItem('authSession');
    if (authSession) {
      try {
        const session = JSON.parse(authSession);
        if (session.userId) return session.userId.toString();
      } catch {}
    }
    
    const vkUser = localStorage.getItem('vk_user');
    if (vkUser) {
      try {
        const userData = JSON.parse(vkUser);
        if (userData.user_id) return userData.user_id.toString();
        if (userData.vk_id) return userData.vk_id.toString();
      } catch {}
    }
    
    const googleUser = localStorage.getItem('google_user');
    if (googleUser) {
      try {
        const userData = JSON.parse(googleUser);
        if (userData.user_id) return userData.user_id.toString();
        if (userData.id) return userData.id.toString();
        if (userData.sub) return userData.sub.toString();
      } catch {}
    }
    
    return null;
  };
  
  const userId = getAuthUserId();
  const [emailVerified, setEmailVerified] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(true);
  const [authChecking, setAuthChecking] = useState(true);
  const [showCameraUpload, setShowCameraUpload] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      const authSession = localStorage.getItem('authSession');
      const vkUser = localStorage.getItem('vk_user');
      const googleUser = localStorage.getItem('google_user');
      
      console.log('[PHOTO_BANK] Auth check:', { 
        hasAuthSession: !!authSession, 
        hasVkUser: !!vkUser,
        hasGoogleUser: !!googleUser 
      });
      
      if (!authSession && !vkUser && !googleUser) {
        console.log('[PHOTO_BANK] No auth found, redirecting to /');
        navigate('/');
        return;
      }
      
      if (authSession) {
        try {
          const session = JSON.parse(authSession);
          console.log('[PHOTO_BANK] Auth session:', { 
            isAuthenticated: session.isAuthenticated, 
            userId: session.userId,
            hasUserId: !!session.userId
          });
          if (!session.userId) {
            console.log('[PHOTO_BANK] No userId in session, redirecting to /');
            navigate('/');
            return;
          }
        } catch (err) {
          console.log('[PHOTO_BANK] Error parsing auth session:', err);
          navigate('/');
          return;
        }
      }
      
      console.log('[PHOTO_BANK] Auth check passed');
      setAuthChecking(false);
    };
    
    checkAuth();
  }, [navigate]);

  const navigation = usePhotoBankNavigationHistory();

  const {
    folders,
    setFolders,
    selectedFolder,
    setSelectedFolder,
    photos,
    setPhotos,
    loading,
    setLoading,
    uploading,
    setUploading,
    uploadProgress,
    setUploadProgress,
    uploadCancelled,
    setUploadCancelled,
    showCreateFolder,
    setShowCreateFolder,
    showClearConfirm,
    setShowClearConfirm,
    folderName,
    setFolderName,
    selectedPhotos,
    setSelectedPhotos,
    selectionMode,
    setSelectionMode,
    storageUsage,
    setStorageUsage
  } = usePhotoBankState();

  const {
    fetchFolders,
    fetchPhotos,
    fetchStorageUsage,
    PHOTOBANK_FOLDERS_API,
    PHOTOBANK_TRASH_API
  } = usePhotoBankApi(userId, setFolders, setPhotos, setLoading, setStorageUsage);

  const {
    handleCreateFolder,
    handleUploadPhoto,
    handleCancelUpload,
    handleDeletePhoto,
    handleDeleteFolder,
    handleClearAll,
    togglePhotoSelection,
    handleAddToPhotobook
  } = usePhotoBankHandlers(
    userId,
    PHOTOBANK_FOLDERS_API,
    PHOTOBANK_TRASH_API,
    selectedFolder,
    photos,
    selectedPhotos,
    folderName,
    setFolderName,
    setShowCreateFolder,
    setShowClearConfirm,
    setUploading,
    setUploadProgress,
    uploadCancelled,
    setUploadCancelled,
    setSelectedFolder,
    setPhotos,
    setSelectedPhotos,
    setSelectionMode,
    fetchFolders,
    fetchPhotos,
    fetchStorageUsage
  );

  useEffect(() => {
    if (!userId || authChecking) return;
    
    const checkEmailVerification = async () => {
      try {
        // Check if user is main admin
        const authSession = localStorage.getItem('authSession');
        const vkUser = localStorage.getItem('vk_user');
        const googleUser = localStorage.getItem('google_user');
        
        let userEmail = null;
        let vkUserData = null;
        
        if (authSession) {
          try {
            const session = JSON.parse(authSession);
            userEmail = session.userEmail;
          } catch {}
        }
        
        if (vkUser) {
          try {
            vkUserData = JSON.parse(vkUser);
          } catch {}
        }
        
        // Main admins bypass email verification
        if (isAdminUser(userEmail, vkUserData)) {
          console.log('[PHOTO_BANK] Admin user detected, bypassing verification');
          setEmailVerified(true);
          setCheckingVerification(false);
          return;
        }

        // Google users are pre-verified
        if (googleUser) {
          console.log('[PHOTO_BANK] Google user detected, auto-verified');
          setEmailVerified(true);
          setCheckingVerification(false);
          return;
        }
        
        console.log('[PHOTO_BANK] Checking email verification for userId:', userId);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const res = await fetch(`https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9?userId=${userId}`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!res.ok) {
          throw new Error(`Verification API returned ${res.status}`);
        }
        
        const data = await res.json();
        console.log('[PHOTO_BANK] Verification response:', data);
        setEmailVerified(!!data.email_verified_at);
      } catch (err: any) {
        console.error('[PHOTO_BANK] Failed to check email verification:', err);
        setEmailVerified(false);
      } finally {
        setCheckingVerification(false);
      }
    };
    
    checkEmailVerification();
    fetchFolders();
    fetchStorageUsage();
  }, [userId, authChecking]);

  useEffect(() => {
    if (selectedFolder) {
      fetchPhotos(selectedFolder.id);
    }
  }, [selectedFolder]);

  // Автообновление для RAW файлов (проверка превью каждые 10 сек)
  useEffect(() => {
    if (!selectedFolder || !photos.length) return;
    
    const hasRawWithoutThumbnail = photos.some(p => p.is_raw && !p.thumbnail_s3_url);
    if (!hasRawWithoutThumbnail) return;
    
    console.log('[PHOTO_BANK] RAW files without thumbnail detected, scheduling refresh');
    const intervalId = setInterval(() => {
      console.log('[PHOTO_BANK] Auto-refreshing photos for thumbnail updates');
      fetchPhotos(selectedFolder.id);
    }, 10000);
    
    return () => clearInterval(intervalId);
  }, [selectedFolder, photos]);

  // Сохранение состояния навигации
  useEffect(() => {
    if (folders.length > 0) {
      navigation.pushState({
        selectedFolderId: selectedFolder?.id || null,
        selectionMode,
      });
    }
  }, [selectedFolder?.id, selectionMode, folders.length, navigation]);

  // Обработчики навигации
  const handleGoBack = useCallback(() => {
    const prevState = navigation.goBack();
    if (prevState) {
      const folder = folders.find(f => f.id === prevState.selectedFolderId);
      setSelectedFolder(folder || null);
      setSelectionMode(prevState.selectionMode);
    }
  }, [navigation, folders, setSelectedFolder, setSelectionMode]);

  const handleGoForward = useCallback(() => {
    const nextState = navigation.goForward();
    if (nextState) {
      const folder = folders.find(f => f.id === nextState.selectedFolderId);
      setSelectedFolder(folder || null);
      setSelectionMode(nextState.selectionMode);
    }
  }, [navigation, folders, setSelectedFolder, setSelectionMode]);

  if (authChecking || !userId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Проверка авторизации...</p>
        </div>
      </div>
    );
  }

  const isAdminViewing = (() => {
    const adminViewingUserId = localStorage.getItem('admin_viewing_user_id');
    if (!adminViewingUserId) return false;
    
    const authSession = localStorage.getItem('authSession');
    const vkUser = localStorage.getItem('vk_user');
    
    let adminEmail = null;
    let adminVkData = null;
    
    if (authSession) {
      try {
        const session = JSON.parse(authSession);
        adminEmail = session.userEmail;
      } catch {}
    }
    
    if (vkUser) {
      try {
        adminVkData = JSON.parse(vkUser);
      } catch {}
    }
    
    return isAdminUser(adminEmail, adminVkData);
  })();

  const handleExitAdminView = () => {
    localStorage.removeItem('admin_viewing_user_id');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background p-6">
      {isAdminViewing && (
        <div className="max-w-7xl mx-auto mb-4">
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 rounded-lg flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <Icon name="Shield" size={24} />
              <div>
                <h3 className="font-semibold">Режим администратора</h3>
                <p className="text-sm opacity-90">Вы просматриваете Фото банк пользователя ID: {userId}</p>
              </div>
            </div>
            <button
              onClick={handleExitAdminView}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            >
              <Icon name="LogOut" size={18} />
              Выйти из режима просмотра
            </button>
          </div>
        </div>
      )}
      
      <PhotoBankDialogs
        showCreateFolder={showCreateFolder}
        showClearConfirm={showClearConfirm}
        folderName={folderName}
        foldersCount={folders.length}
        onSetShowCreateFolder={setShowCreateFolder}
        onSetShowClearConfirm={setShowClearConfirm}
        onSetFolderName={setFolderName}
        onCreateFolder={handleCreateFolder}
        onClearAll={handleClearAll}
      />

      <CameraUploadDialog
        open={showCameraUpload}
        onOpenChange={setShowCameraUpload}
        userId={userId || ''}
        folders={folders}
        onUploadComplete={() => {
          fetchFolders();
          fetchStorageUsage();
        }}
      />

      <div className="max-w-7xl mx-auto space-y-6">
        <PhotoBankStorageIndicator storageUsage={storageUsage} />

        <PhotoBankHeader
          folders={folders}
          selectedFolder={selectedFolder}
          photos={photos}
          selectionMode={selectionMode}
          selectedPhotos={selectedPhotos}
          onNavigateBack={() => {
            if (selectedFolder) {
              setSelectedFolder(null);
              setPhotos([]);
            } else {
              navigate('/');
            }
          }}
          onAddToPhotobook={handleAddToPhotobook}
          onCancelSelection={() => {
            setSelectionMode(false);
            setSelectedPhotos(new Set());
          }}
          onStartSelection={() => setSelectionMode(true)}
          onShowCreateFolder={() => setShowCreateFolder(true)}
          onShowClearConfirm={() => setShowClearConfirm(true)}
          onShowCameraUpload={() => setShowCameraUpload(true)}
          canGoBack={navigation.canGoBack}
          canGoForward={navigation.canGoForward}
          onGoBack={handleGoBack}
          onGoForward={handleGoForward}
        />

        {!selectedFolder ? (
          <PhotoBankFoldersList
            folders={folders}
            selectedFolder={selectedFolder}
            loading={loading}
            onSelectFolder={setSelectedFolder}
            onDeleteFolder={handleDeleteFolder}
            onCreateFolder={() => setShowCreateFolder(true)}
          />
        ) : (
          <PhotoBankPhotoGrid
            selectedFolder={selectedFolder}
            photos={photos}
            loading={loading}
            uploading={uploading}
            uploadProgress={uploadProgress}
            selectionMode={selectionMode}
            selectedPhotos={selectedPhotos}
            emailVerified={emailVerified}
            onUploadPhoto={handleUploadPhoto}
            onDeletePhoto={handleDeletePhoto}
            onTogglePhotoSelection={togglePhotoSelection}
            onCancelUpload={handleCancelUpload}
          />
        )}
      </div>
      
      <MobileNavigation />
    </div>
  );
};

export default PhotoBank;