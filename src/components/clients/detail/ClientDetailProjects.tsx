import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import { Project, Payment } from '@/components/clients/ClientsTypes';
import { useEffect, useState } from 'react';

interface ClientDetailProjectsProps {
  projects: Project[];
  payments: Payment[];
  newProject: { name: string; budget: string; description: string; startDate: string };
  setNewProject: (project: any) => void;
  handleAddProject: () => void;
  handleDeleteProject: (projectId: number) => void;
  updateProjectStatus: (projectId: number, status: Project['status']) => void;
  updateProjectDate: (projectId: number, newDate: string) => void;
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
  updateProjectDate,
  getStatusBadge,
  formatDate,
}: ClientDetailProjectsProps) => {
  const [animateKeys, setAnimateKeys] = useState<Record<number, number>>({});

  const getProjectPayments = (projectId: number) => {
    const projectPayments = payments.filter(p => p.projectId === projectId && p.status === 'completed');
    console.log(`[Project ${projectId}] Payments:`, projectPayments);
    return projectPayments;
  };

  const getProjectPaid = (projectId: number) => {
    const paid = getProjectPayments(projectId).reduce((sum, p) => sum + p.amount, 0);
    console.log(`[Project ${projectId}] Total Paid:`, paid);
    return paid;
  };

  const getProjectRemaining = (projectId: number, budget: number) => {
    const paid = getProjectPaid(projectId);
    const remaining = budget - paid;
    console.log(`[Project ${projectId}] Budget: ${budget}, Paid: ${paid}, Remaining: ${remaining}`);
    return remaining;
  };

  useEffect(() => {
    const newKeys: Record<number, number> = {};
    projects.forEach(project => {
      newKeys[project.id] = (animateKeys[project.id] || 0) + 1;
    });
    setAnimateKeys(newKeys);
  }, [payments]);
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Добавить новую услугу</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
            <div className="space-y-2">
              <Label className="text-sm">Дата бронирования</Label>
              <Input
                type="date"
                value={newProject.startDate}
                onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
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
                      <span className="text-muted-foreground">Оплачено: <span key={`paid-${project.id}-${animateKeys[project.id] || 0}`} className="font-medium text-green-600 inline-block animate-in fade-in zoom-in-50 duration-500">{getProjectPaid(project.id).toLocaleString('ru-RU')} ₽</span></span>
                      <span className="text-muted-foreground">Осталось: <span key={`remaining-${project.id}-${animateKeys[project.id] || 0}`} className="font-medium text-orange-600 inline-block animate-in fade-in zoom-in-50 duration-500">{getProjectRemaining(project.id, project.budget).toLocaleString('ru-RU')} ₽</span></span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Label className="text-xs text-muted-foreground">Дата бронирования:</Label>
                      <Input
                        type="date"
                        value={(() => {
                          if (!project.startDate) return '';
                          // Если уже в формате YYYY-MM-DD
                          if (typeof project.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(project.startDate)) {
                            return project.startDate;
                          }
                          // Иначе пробуем преобразовать
                          try {
                            const date = new Date(project.startDate);
                            return isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
                          } catch {
                            return '';
                          }
                        })()}
                        onChange={(e) => updateProjectDate(project.id, e.target.value)}
                        className="text-xs h-7 w-40"
                      />
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