const Help = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Справка</h1>
        
        <div className="bg-white rounded-2xl shadow-lg p-6 space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Как пользоваться приложением</h2>
            <p className="text-gray-600">
              Здесь будет информация о том, как работать с фотобанком, загружать файлы и управлять клиентами.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Часто задаваемые вопросы</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-700">Как загрузить фото?</h3>
                <p className="text-gray-600 text-sm mt-1">Перейдите в раздел "Фото банк" и нажмите кнопку загрузки.</p>
              </div>
              <div>
                <h3 className="font-medium text-gray-700">Как добавить клиента?</h3>
                <p className="text-gray-600 text-sm mt-1">В разделе "Клиенты" нажмите кнопку "Добавить клиента".</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Контакты поддержки</h2>
            <p className="text-gray-600">
              По вопросам работы приложения свяжитесь с нами через форму обратной связи.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Help;
