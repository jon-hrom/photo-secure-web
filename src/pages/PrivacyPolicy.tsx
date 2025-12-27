import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PRIVACY_POLICY } from '@/data/privacy-policy';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <Card className="shadow-2xl">
          <CardHeader className="border-b bg-gradient-to-r from-purple-500 to-pink-500 text-white">
            <CardTitle className="text-2xl md:text-3xl font-bold text-center">
              Согласие на обработку персональных данных
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-8 pb-8">
            <div className="prose prose-sm md:prose-base max-w-none dark:prose-invert">
              <div className="whitespace-pre-line text-gray-700 dark:text-gray-300 leading-relaxed">
                {PRIVACY_POLICY}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
