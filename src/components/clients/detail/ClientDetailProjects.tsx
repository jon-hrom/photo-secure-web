import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import { Project } from '@/components/clients/ClientsTypes';

interface ClientDetailProjectsProps {
  projects: Project[];
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
  newProject,
  setNewProject,
  handleAddProject,
  handleDeleteProject,
  updateProjectStatus,
  getStatusBadge,
  formatDate,
}: ClientDetailProjectsProps) => {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Добавить новый проект</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Название проекта *</Label>
              <Input
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                placeholder="Свадебная фотосессия"
              />
            </div>
            <div className="space-y-2">
              <Label>Бюджет (₽) *</Label>
              <Input
                type="number"
                value={newProject.budget}
                onChange={(e) => setNewProject({ ...newProject, budget: e.target.value })}
                placeholder="50000"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Описание</Label>
            <Textarea
              value={newProject.description}
              onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
              placeholder="Детали проекта..."
              rows={2}
            />
          </div>
          <Button onClick={handleAddProject}>
            <Icon name="Plus" size={16} className="mr-2" />
            Создать проект
          </Button>
        </CardContent>
      </Card>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Проектов пока нет
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <Card key={project.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {project.name}
                      {getStatusBadge(project.status)}
                    </CardTitle>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span>Бюджет: {project.budget.toLocaleString('ru-RU')} ₽</span>
                      <span>Начало: {formatDate(project.startDate)}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteProject(project.id)}
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
                    <SelectTrigger className="w-48">
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
