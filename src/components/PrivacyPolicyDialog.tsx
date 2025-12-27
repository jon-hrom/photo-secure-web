import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PRIVACY_POLICY } from '@/data/privacy-policy';

interface PrivacyPolicyDialogProps {
  open: boolean;
  onClose: () => void;
}

const PrivacyPolicyDialog = ({ open, onClose }: PrivacyPolicyDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Согласие на обработку персональных данных
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
            {PRIVACY_POLICY}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default PrivacyPolicyDialog;
