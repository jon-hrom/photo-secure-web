import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';

interface Client {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  bookedDates: Date[];
}

const ClientsPage = () => {
  const [clients, setClients] = useState<Client[]>([
    {
      id: 1,
      name: 'Иванова Мария Петровна',
      phone: '+7 (999) 123-45-67',
      email: 'maria@mail.ru',
      address: 'г. Москва, ул. Ленина, д. 10',
      bookedDates: [new Date(2025, 10, 15)],
    },
    {
      id: 2,
      name: 'Петров Сергей Иванович',
      phone: '+7 (999) 987-65-43',
      email: 'sergey@mail.ru',
      address: 'г. Москва, ул. Пушкина, д. 5',
      bookedDates: [new Date(2025, 10, 16)],
    },
  ]);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [newClient, setNewClient] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
  });

  const handleAddClient = () => {
    const client: Client = {
      id: clients.length + 1,
      ...newClient,
      bookedDates: [],
    };
    setClients([...clients, client]);
    setNewClient({ name: '', phone: '', email: '', address: '' });
    setIsAddDialogOpen(false);
  };

  const allBookedDates = clients.flatMap(c => c.bookedDates);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Система учёта клиентов</h2>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full shadow-lg hover-scale">
              <Icon name="UserPlus" size={20} className="mr-2" />
              Добавить клиента
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Новый клиент</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Ф.И.О.</Label>
                <Input
                  id="name"
                  placeholder="Иванов Иван Иванович"
                  value={newClient.name}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Телефон</Label>
                <Input
                  id="phone"
                  placeholder="+7 (___) ___-__-__"
                  value={newClient.phone}
                  onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@mail.com"
                  value={newClient.email}
                  onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Адрес</Label>
                <Input
                  id="address"
                  placeholder="г. Москва, ул..."
                  value={newClient.address}
                  onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <Button onClick={handleAddClient} className="w-full rounded-xl">
                Сохранить
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card className="shadow-lg border-2">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Icon name="Users" className="mr-2 text-primary" size={24} />
                База клиентов ({clients.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
              {clients.map((client) => (
                <Card
                  key={client.id}
                  className="hover:shadow-md transition-all cursor-pointer border-2"
                  onClick={() => setSelectedClient(client)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-bold text-lg">{client.name}</h3>
                        <div className="flex items-center gap-2 mt-2">
                          <Icon name="Phone" size={14} className="text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">{client.phone}</span>
                        </div>
                      </div>
                      {client.bookedDates.length > 0 && (
                        <Badge className="bg-green-500">
                          {client.bookedDates.length} встреч
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Icon name="Mail" size={14} />
                      <span>{client.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <Icon name="MapPin" size={14} />
                      <span>{client.address}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="shadow-lg border-2">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Icon name="Calendar" className="mr-2 text-secondary" size={24} />
                Календарь бронирования
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="multiple"
                selected={allBookedDates}
                className="rounded-xl border shadow-sm"
                modifiers={{
                  booked: allBookedDates,
                }}
                modifiersClassNames={{
                  booked: 'bg-primary text-white hover:bg-primary/90',
                }}
              />
              <div className="mt-4 p-4 bg-muted/50 rounded-xl">
                <div className="flex items-start gap-3">
                  <Icon name="Info" className="text-primary mt-1" size={20} />
                  <div className="text-sm">
                    <p className="font-semibold mb-1">Подсказка:</p>
                    <p className="text-muted-foreground">
                      Забронированные даты подсвечены цветом. Нажмите на клиента из списка, чтобы увидеть его встречи.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {selectedClient && (
            <Card className="shadow-lg border-2 animate-scale-in">
              <CardHeader>
                <CardTitle className="text-lg">
                  Информация о клиенте
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-muted-foreground text-xs">Ф.И.О.</Label>
                  <p className="font-semibold">{selectedClient.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Телефон</Label>
                  <p className="font-semibold">{selectedClient.phone}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Email</Label>
                  <p className="font-semibold">{selectedClient.email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Адрес</Label>
                  <p className="font-semibold">{selectedClient.address}</p>
                </div>
                {selectedClient.bookedDates.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Забронированные даты</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedClient.bookedDates.map((date, i) => (
                        <Badge key={i} variant="outline" className="border-primary">
                          {date.toLocaleDateString('ru-RU')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientsPage;
