import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import { Project, Payment } from '@/components/clients/ClientsTypes';

interface ClientDetailProjectsProps {
  projects: Project[];
  payments: Payment[];
  newProject: { name: string; budget: string; description: string };
  setNewProject: (project: any) => void;
  handleAddProject: () => void;
  handleDeleteProject: (projectId: number) => void;
  updateProjectStatus: (projectId: number, status: Project['status']) => void;
  getStatusBadge: (status: Project['status']) => JSX.Element;
  formatDate: (dateString: string) => string;
}

const ClientDetailProjects = ({
  projects,
  payments,
  newProject,
  setNewProject,
  handleAddProject,
  handleDeleteProject,
  updateProjectStatus,
  getStatusBadge,
  formatDate,
}: ClientDetailProjectsProps) => {
  const getProjectPayments = (projectId: number) => {
    return payments.filter(p => p.projectId === projectId && p.status === 'completed');
  };

  const getProjectPaid = (projectId: number) => {
    return getProjectPayments(projectId).reduce((sum, p) => sum + p.amount, 0);
  };

  const getProjectRemaining = (projectId: number, budget: number) => {
    return budget - getProjectPaid(projectId);
  };
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Добавить новую услугу</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm">Название проекта *</Label>
              <Input
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                placeholder="Свадебная фотосессия"
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Бюджет (₽) *</Label>
              <Input
                type="number"
                value={newProject.budget}
                onChange={(e) => setNewProject({ ...newProject, budget: e.target.value })}
                placeholder="50000"
                className="text-sm"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Описание</Label>
            <Textarea
              value={newProject.description}
              onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
              placeholder="Детали проекта..."
              rows={2}
              className="text-sm"
            />
          </div>
          <Button onClick={handleAddProject} className="w-full sm:w-auto">
            <Icon name="Plus" size={16} className="mr-2" />
            Создать услугу
          </Button>
        </CardContent>
      </Card>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">Список слуг пока нет</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <Card key={project.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="flex items-center gap-2 flex-wrap text-base sm:text-lg">
                      <span className="truncate">{project.name}</span>
                      {getStatusBadge(project.status)}
                    </CardTitle>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2 text-xs sm:text-sm">
                      <span className="text-muted-foreground">Бюджет: <span className="font-medium text-foreground">{project.budget.toLocaleString('ru-RU')} ₽</span></span>
                      <span className="text-muted-foreground">Оплачено: <span className="font-medium text-green-600">{getProjectPaid(project.id).toLocaleString('ru-RU')} ₽</span></span>
                      <span className="text-muted-foreground">Осталось: <span className="font-medium text-orange-600">{getProjectRemaining(project.id, project.budget).toLocaleString('ru-RU')} ₽</span></span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Начало: {formatDate(project.startDate)}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteProject(project.id)}
                    className="shrink-0"
                  >
                    <Icon name="Trash2" size={16} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {project.description && (
                  <p className="text-sm text-muted-foreground">{project.description}</p>
                )}
                <div className="flex gap-2">
                  <Select
                    value={project.status}
                    onValueChange={(value) => updateProjectStatus(project.id, value as Project['status'])}
                  >
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">Новый</SelectItem>
                      <SelectItem value="in_progress">В работе</SelectItem>
                      <SelectItem value="completed">Завершён</SelectItem>
                      <SelectItem value="cancelled">Отменён</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
};

export default ClientDetailProjects;