import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Template } from './messagesShared';

interface MessageComposerProps {
  clientId?: number;
  templates: Template[];
  selectedTemplate: string;
  onTemplateSelect: (templateType: string) => void;
  newMessage: { content: string; type: string; author: string };
  onMessageChange: (field: string, value: string) => void;
  onAdd: () => void;
  sendingViaMax: boolean;
  onSendViaMax: () => void;
  sendingViaVk: boolean;
  onSendViaVk: () => void;
}

const MessageComposer = ({
  clientId,
  templates,
  selectedTemplate,
  onTemplateSelect,
  newMessage,
  onMessageChange,
  onAdd,
  sendingViaMax,
  onSendViaMax,
  sendingViaVk,
  onSendViaVk,
}: MessageComposerProps) => {
  return (
    <div className="p-4 pb-20 bg-background border-t-2 border-border rounded-b-2xl shadow-lg">
      <div className="space-y-2">
        {clientId && templates.length > 0 && (
          <Select value={selectedTemplate} onValueChange={onTemplateSelect}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Выберите шаблон сообщения..." />
            </SelectTrigger>
            <SelectContent>
              {templates.map((template) => (
                <SelectItem key={template.template_type} value={template.template_type}>
                  <div className="flex items-center gap-2">
                    <Icon name="FileText" size={14} />
                    <span>{template.template_type}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex gap-2">
          <Input
            placeholder="Напишите сообщение..."
            value={newMessage.content}
            onChange={(e) => onMessageChange('content', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && newMessage.content.trim()) {
                e.preventDefault();
                onAdd();
              }
            }}
            className="flex-1 rounded-full border-2 border-border focus:border-primary"
          />
          <Button
            onClick={onAdd}
            disabled={!newMessage.content.trim()}
            className="rounded-full px-6"
            variant="outline"
          >
            <Icon name="Save" size={18} />
          </Button>
        </div>

        {clientId && (
          <Button
            onClick={onSendViaMax}
            disabled={!newMessage.content.trim() || sendingViaMax}
            className="w-full rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          >
            {sendingViaMax ? (
              <Icon name="Loader2" size={18} className="mr-2 animate-spin" />
            ) : (
              <>
                <div className="w-4 h-4 rounded-sm bg-white/20 flex items-center justify-center mr-2">
                  <span className="text-white font-bold text-[10px]">M</span>
                </div>
                <span>Отправить через MAX</span>
              </>
            )}
          </Button>
        )}

        {clientId && (
          <Button
            onClick={onSendViaVk}
            disabled={!newMessage.content.trim() || sendingViaVk}
            className="w-full rounded-full bg-[#0077FF] hover:bg-[#0066DD]"
          >
            {sendingViaVk ? (
              <Icon name="Loader2" size={18} className="mr-2 animate-spin" />
            ) : (
              <>
                <Icon name="Send" size={16} className="mr-2" />
                <span>Отправить в ВКонтакте</span>
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

export default MessageComposer;
