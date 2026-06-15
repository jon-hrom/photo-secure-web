import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchLegalDoc, LegalDoc } from '@/lib/legalApi';

interface LegalDocumentProps {
  fixedSlug?: string;
}

const LegalDocument = ({ fixedSlug }: LegalDocumentProps) => {
  const params = useParams();
  const slug = fixedSlug || params.slug || '';
  const [doc, setDoc] = useState<LegalDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchLegalDoc(slug).then((d) => {
      if (!active) return;
      if (d) {
        setDoc(d);
        document.title = d.title;
      } else {
        setNotFound(true);
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [slug]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <Card className="shadow-2xl">
          <CardHeader className="border-b bg-gradient-to-r from-purple-500 to-pink-500 text-white">
            <CardTitle className="text-2xl md:text-3xl font-bold text-center">
              {doc?.title || 'Документ'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-8 pb-8">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
              </div>
            ) : notFound ? (
              <p className="text-center text-gray-500">Документ не найден</p>
            ) : (
              <>
                <div
                  className="prose prose-sm md:prose-base max-w-none dark:prose-invert leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: doc?.content || '' }}
                />
                {doc?.version && (
                  <p className="mt-8 text-xs text-gray-400 text-right">Редакция № {doc.version}</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LegalDocument;
