import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PhotoBankStorageIndicator from '@/components/photobank/PhotoBankStorageIndicator';
import PhotoBankHeader from '@/components/photobank/PhotoBankHeader';
import PhotoBankFoldersList from '@/components/photobank/PhotoBankFoldersList';
import PhotoBankPhotoGrid from '@/components/photobank/PhotoBankPhotoGrid';
import PhotoBankDialogs from '@/components/photobank/PhotoBankDialogs';
import MobileNavigation from '@/components/layout/MobileNavigation';
import { usePhotoBankState } from '@/hooks/usePhotoBankState';
import { usePhotoBankApi } from '@/hooks/usePhotoBankApi';
import { usePhotoBankHandlers } from '@/hooks/usePhotoBankHandlers';
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

  useEffect(() => {
    const checkAuth = () => {
      const authSession = localStorage.getItem('authSession');
      const vkUser = localStorage.getItem('vk_user');
      
      if (!authSession && !vkUser) {
        navigate('/login');
        return;
      }
      
      if (authSession) {
        try {
          const session = JSON.parse(authSession);
          if (!session.isAuthenticated || !session.userId) {
            navigate('/login');
            return;
          }
        } catch {
          navigate('/login');
          return;
        }
      }
      
      if (vkUser) {
        try {
          const userData = JSON.parse(vkUser);
          if (!userData.user_id && !userData.vk_id) {
            navigate('/login');
            return;
          }
        } catch {
          navigate('/login');
          return;
        }
      }
      
      setAuthChecking(false);
    };
    
    checkAuth();
  }, [navigate]);

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
          setEmailVerified(true);
          setCheckingVerification(false);
          return;
        }
        
        const res = await fetch(`https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9?userId=${userId}`);
        const data = await res.json();
        setEmailVerified(!!data.email_verified_at);
      } catch (err) {
        console.error('Failed to check email verification:', err);
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