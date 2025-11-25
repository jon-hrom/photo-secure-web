import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { Client } from '@/components/clients/ClientsTypes';

interface MessageDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  selectedClient: Client | null;
  messageTab: 'vk' | 'email';
  setMessageTab: (tab: 'vk' | 'email') => void;
  vkMessage: string;
  setVkMessage: (message: string) => void;
  emailSubject: string;
  setEmailSubject: (subject: string) => void;
  emailBody: string;
  setEmailBody: (body: string) => void;
  handleSearchVK: () => void;
  handleSendVKMessage: () => void;
  handleSendEmail: () => void;
}

const MessageDialog = ({
  isOpen,
  setIsOpen,
  selectedClient,
  messageTab,
  setMessageTab,
  vkMessage,
  setVkMessage,
  emailSubject,
  setEmailSubject,
  emailBody,
  setEmailBody,
  handleSearchVK,
  handleSendVKMessage,
  handleSendEmail,
}: MessageDialogProps) => {
  if (!selectedClient) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl bg-gradient-to-br from-purple-50/80 via-pink-50/60 to-rose-50/80 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle>Связь с клиентом: {selectedClient.name}</DialogTitle>
        </DialogHeader>
        <Tabs value={messageTab} onValueChange={(v) => setMessageTab(v as 'vk' | 'email')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="vk">
              <Icon name="MessageCircle" size={16} className="mr-2" />
              ВКонтакте
            </TabsTrigger>
            <TabsTrigger value="email">
              <Icon name="Mail" size={16} className="mr-2" />
              Email
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vk" className="space-y-4">
            <div className="space-y-2">
              <Label>Профиль ВКонтакте</Label>
              <div className="flex gap-2">
                <Input
                  value={selectedClient.vkProfile || 'Не указан'}
                  readOnly
                  className="flex-1"
                />
                <Button onClick={handleSearchVK} variant="outline">
                  <Icon name="Search" size={18} />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Сообщение</Label>
              <Textarea
                value={vkMessage}
                onChange={(e) => setVkMessage(e.target.value)}
                placeholder="Введите текст сообщения"
                rows={5}
              />
            </div>
            <Button onClick={handleSendVKMessage} className="w-full" disabled={!selectedClient.vkProfile}>
              <Icon name="Send" size={18} className="mr-2" />
              Отправить во ВКонтакте
            </Button>
          </TabsContent>

          <TabsContent value="email" className="space-y-4">
            <div className="space-y-2">
              <Label>Email получателя</Label>
              <Input value={selectedClient.email || 'Не указан'} readOnly />
            </div>
            <div className="space-y-2">
              <Label>Тема письма</Label>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Тема письма"
              />
            </div>
            <div className="space-y-2">
              <Label>Текст письма</Label>
              <Textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                placeholder="Введите текст письма"
                rows={8}
              />
            </div>
            <Button onClick={handleSendEmail} className="w-full" disabled={!selectedClient.email}>
              <Icon name="Send" size={18} className="mr-2" />
              Отправить Email
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default MessageDialog;