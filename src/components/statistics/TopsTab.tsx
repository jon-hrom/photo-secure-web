import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatisticsTabProps } from './statisticsShared';

const TopsTab = ({ data, formatCurrency }: StatisticsTabProps) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>ТОП-5 клиентов по доходу</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.tops.top_clients.map((client, index) => (
                <div key={client.id} className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{client.name}</p>
                    <p className="text-sm text-muted-foreground">{client.phone}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">{formatCurrency(client.total_spent)}</p>
                    <p className="text-xs text-muted-foreground">{client.projects_count} проектов</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ТОП-5 проектов</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.tops.top_projects.map((project, index) => (
                <div key={project.id} className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary text-secondary-foreground font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{project.project_name}</p>
                    <p className="text-sm text-muted-foreground">{project.client_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">{formatCurrency(project.total_amount)}</p>
                    <p className="text-xs text-muted-foreground">{project.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TopsTab;
