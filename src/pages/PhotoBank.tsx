import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PhotoBankStorageIndicator from '@/components/photobank/PhotoBankStorageIndicator';
import PhotoBankHeader from '@/components/photobank/PhotoBankHeader';
import PhotoBankFoldersList from '@/components/photobank/PhotoBankFoldersList';
import PhotoBankPhotoGrid from '@/components/photobank/PhotoBankPhotoGrid';
import PhotoBankDialogs from '@/components/photobank/PhotoBankDialogs';
import CameraUploadDialog from '@/components/photobank/CameraUploadDialog';
import MobileNavigation from '@/components/layout/MobileNavigation';
import { usePhotoBankState } from '@/hooks/usePhotoBankState';
import { usePhotoBankApi } from '@/hooks/usePhotoBankApi';
import { usePhotoBankHandlers } from '@/hooks/usePhotoBankHandlers';
import { usePhotoBankNavigationHistory } from '@/hooks/usePhotoBankNavigationHistory';
import { isAdminUser } from '@/utils/adminCheck';

const PhotoBank = () => {
  const navigate = useNavigate();
  
  const getAuthUserId = (): string | null => {
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
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const res = await fetch(`https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9?userId=${userId}`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        const data = await res.json();
        console.log('[PHOTO_BANK] Verification response:', data);
        setEmailVerified(!!data.email_verified_at);
      } catch (err: any) {
        console.error('[PHOTO_BANK] Failed to check email verification:', err);
        if (err.name === 'AbortError') {
          console.warn('[PHOTO_BANK] Verification check timeout, allowing access');
          setEmailVerified(true);
        }
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

  return (
    <div className="min-h-screen bg-background p-6">
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
          onNavigateBack={() => navigate('/')}
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