import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import ProjectEditDialog from './ProjectEditDialog';

interface Project {
  id: number;
  name: string;
  startDate: string;
  budget?: number;
  clientName?: string;
}

interface DashboardCalendarProps {
  userId?: string | null;
}

const DashboardCalendar = ({ userId: propUserId }: DashboardCalendarProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedDateProjects, setSelectedDateProjects] = useState<Project[]>([]);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [longPressTriggered, setLongPressTriggered] = useState(false);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  const fetchProjects = async () => {
    const userId = propUserId || localStorage.getItem('userId');
    if (!userId) return;

    try {
      const res = await fetch(`https://functions.poehali.dev/f95119e0-3c8c-49db-9c1f-de7411b59001?userId=${userId}`);
      const data = await res.json();
      
      const projectsWithDates = data
        .filter((p: any) => p.startDate)
        .map((p: any) => ({
          ...p,
          startDate: p.startDate.split(' ')[0]
        }));

      setProjects(projectsWithDates);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [propUserId]);

  useEffect(() => {
    if (!selectedDate) {
      setSelectedDateProjects([]);
      return;
    }

    const filtered = projects.filter(p => {
      const projectDate = new Date(p.startDate);
      return projectDate.toDateString() === selectedDate.toDateString();
    });

    setSelectedDateProjects(filtered);
  }, [selectedDate, projects]);

  const bookedDates = projects
    .map(p => new Date(p.startDate))
    .filter(date => !isNaN(date.getTime()));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingProjects = projects
    .filter(p => new Date(p.startDate) >= today)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 3);

  // Обработка долгого нажатия для редактирования
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    setLongPressTriggered(false);
    
    longPressTimer.current = setTimeout(() => {
      setLongPressTriggered(true);
      
      // Находим выбранную дату через Calendar component
      if (selectedDate) {
        const dateProjects = projects.filter(p => {
          const projectDate = new Date(p.startDate);
          return projectDate.toDateString() === selectedDate.toDateString();
        });
        if (dateProjects.length > 0) {
          setEditingProject(dateProjects[0]);
          // Вибрация для обратной связи (если доступно)
          if (navigator.vibrate) {
            navigator.vibrate(50);
          }
        }
      }
    }, 600); // 600ms для долгого нажатия
  }, [projects, selectedDate]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // Отменяем долгое нажатие если палец двигается
    if (touchStartPos.current && longPressTimer.current) {
      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - touchStartPos.current.x);
      const deltaY = Math.abs(touch.clientY - touchStartPos.current.y);
      
      if (deltaX > 10 || deltaY > 10) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    touchStartPos.current = null;
    
    // Сброс флага через небольшую задержку
    setTimeout(() => setLongPressTriggered(false), 100);
  }, []);

  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Компактная статистика */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-200/40 rounded-lg">
                <Icon name="Calendar" size={20} className="text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-700">{upcomingProjects.length}</div>
                <div className="text-xs text-purple-600/70">Ближайших</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-200/40 rounded-lg">
                <Icon name="Camera" size={20} className="text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-700">{projects.length}</div>
                <div className="text-xs text-blue-600/70">Всего съёмок</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Компактный календарь */}
      <Card className="border-purple-200/50">
        <CardContent className="p-4">
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="Calendar" size={18} className="text-purple-600" />
              <h3 className="font-semibold text-sm">Занятые даты</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              👆 Клик — просмотр • 🖊️ Зажать — редактирование
            </p>
          </div>
          
          <div 
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                // Если было долгое нажатие, не обрабатываем клик
                if (longPressTriggered) {
                  return;
                }
                
                setSelectedDate(date);
                // Автоматическое открытие проекта при клике на дату
                if (date) {
                  const dateProjects = projects.filter(p => {
                    const projectDate = new Date(p.startDate);
                    return projectDate.toDateString() === date.toDateString();
                  });
                  if (dateProjects.length === 1) {
                    setEditingProject(dateProjects[0]);
                  }
                }
              }}
              modifiers={{
                booked: (date) => {
                  const checkDate = new Date(date);
                  checkDate.setHours(0, 0, 0, 0);
                  
                  if (checkDate < today) return false;
                  
                  return bookedDates.some(bookedDate => {
                    const d1 = new Date(date);
                    const d2 = new Date(bookedDate);
                    return d1.getDate() === d2.getDate() &&
                           d1.getMonth() === d2.getMonth() &&
                           d1.getFullYear() === d2.getFullYear();
                  });
                },
              }}
              modifiersStyles={{
                booked: {
                  background: 'linear-gradient(135deg, rgb(216 180 254) 0%, rgb(251 207 232) 100%)',
                  color: 'rgb(107 33 168)',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 8px -2px rgba(216, 180, 254, 0.3)',
                },
              }}
              className="rounded-lg w-full"
            />
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-4 h-4 rounded bg-gradient-to-br from-purple-300 to-pink-300"></div>
            <span>Занятые даты</span>
          </div>
        </CardContent>
      </Card>

      {/* Информация о выбранной дате */}
      {selectedDate && selectedDateProjects.length > 0 && (
        <Card className="border-orange-200/50 bg-gradient-to-br from-orange-50 to-rose-50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-orange-700">
              <Icon name="Info" size={16} />
              <span className="font-semibold text-sm">
                {selectedDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
              </span>
            </div>
            
            {selectedDateProjects.map(project => (
              <div 
                key={project.id}
                className="bg-white/60 backdrop-blur-sm rounded-lg p-3 space-y-2 hover:bg-white/80 transition-colors cursor-pointer group"
                onClick={() => setEditingProject(project)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{project.name}</span>
                  <div className="flex items-center gap-2">
                    {project.budget && (
                      <Badge variant="secondary" className="text-xs">
                        {project.budget.toLocaleString('ru-RU')} ₽
                      </Badge>
                    )}
                    <Icon name="Edit" size={14} className="text-gray-400 group-hover:text-primary transition-colors" />
                  </div>
                </div>
                {project.clientName && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Icon name="User" size={12} />
                    <span>{project.clientName}</span>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Ближайшие съёмки */}
      {upcomingProjects.length > 0 && (
        <Card className="border-blue-200/50">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Icon name="Clock" size={16} className="text-blue-600" />
              <h3 className="font-semibold text-sm">Ближайшие съёмки</h3>
            </div>
            
            <div className="space-y-2">
              {upcomingProjects.map(project => (
                <div 
                  key={project.id}
                  className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-3 hover:shadow-md transition-all cursor-pointer group"
                  onClick={() => setEditingProject(project)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{project.name}</span>
                    <div className="flex items-center gap-2">
                      {project.budget && (
                        <Badge variant="secondary" className="text-xs">
                          {project.budget.toLocaleString('ru-RU')} ₽
                        </Badge>
                      )}
                      <Icon name="Edit" size={14} className="text-gray-400 group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Icon name="Calendar" size={12} />
                      <span>
                        {new Date(project.startDate).toLocaleDateString('ru-RU', { 
                          day: 'numeric', 
                          month: 'short' 
                        })}
                      </span>
                    </div>
                    {project.clientName && (
                      <div className="flex items-center gap-1">
                        <Icon name="User" size={12} />
                        <span>{project.clientName}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ProjectEditDialog
        project={editingProject}
        open={!!editingProject}
        onClose={() => setEditingProject(null)}
        userId={propUserId}
        onUpdate={fetchProjects}
      />
    </div>
  );
};

export default DashboardCalendar;