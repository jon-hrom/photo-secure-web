import { useParams } from 'react-router-dom';
import ClientPhotobookView from '@/components/photobook/ClientPhotobookView';

const ClientPhotobook = () => {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Неверная ссылка</h1>
          <p className="text-muted-foreground">ID фотокниги не найден</p>
        </div>
      </div>
    );
  }

  return <ClientPhotobookView clientLinkId={id} />;
};

export default ClientPhotobook;
