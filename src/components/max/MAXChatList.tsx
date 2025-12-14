import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface MAXChat {
  id: number;
  phone_number: string;
  contact_name: string | null;
  last_message_text: string | null;
  last_message_time: string | null;
  unread_count: number;
  is_admin_chat: boolean;
}

interface MAXChatListProps {
  chats: MAXChat[];
  selectedChat: MAXChat | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onChatSelect: (chat: MAXChat) => void;
  onNewChatClick: () => void;
  formatTime: (dateString: string) => string;
}

const MAXChatList = ({
  chats,
  selectedChat,
  searchQuery,
  onSearchChange,
  onChatSelect,
  onNewChatClick,
  formatTime,
}: MAXChatListProps) => {
  const filteredChats = chats.filter(chat => 
    (chat.contact_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (chat.phone_number?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="w-1/3 border-r flex flex-col">
      <DialogHeader className="p-4 border-b">
        <div className="flex items-center justify-between">
          <DialogTitle className="flex items-center gap-2">
            <Icon name="MessageCircle" size={24} className="text-green-600" />
            MAX
          </DialogTitle>
          <Button
            size="sm"
            onClick={onNewChatClick}
            className="bg-green-600 hover:bg-green-700"
          >
            <Icon name="Plus" size={16} className="mr-1" />
            Новый чат
          </Button>
        </div>
      </DialogHeader>
      
      <div className="p-3 border-b">
        <div className="relative">
          <Icon name="Search" size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Поиск по чатам..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredChats.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Icon name="MessageSquare" size={48} className="mx-auto mb-2 opacity-50" />
              <p>{searchQuery ? 'Чаты не найдены' : 'Нет диалогов'}</p>
            </div>
          ) : (
            filteredChats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => onChatSelect(chat)}
                className={`p-3 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors mb-1 ${
                  selectedChat?.id === chat.id ? 'bg-green-50 border-2 border-green-200' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <Icon name="User" size={20} className="text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm truncate">
                        {chat.contact_name || chat.phone_number}
                      </h4>
                      <p className="text-xs text-muted-foreground truncate">
                        {chat.phone_number}
                      </p>
                    </div>
                  </div>
                  {chat.unread_count > 0 && (
                    <Badge className="bg-green-600 text-white text-xs">
                      {chat.unread_count}
                    </Badge>
                  )}
                </div>
                {chat.last_message_text && (
                  <p className="text-xs text-muted-foreground truncate ml-12">
                    {chat.last_message_text}
                  </p>
                )}
                {chat.last_message_time && (
                  <p className="text-xs text-muted-foreground ml-12">
                    {formatTime(chat.last_message_time)}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default MAXChatList;
