import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  color: 'blue' | 'green' | 'yellow';
  onClick?: () => void;
}

export default function StatCard({ title, value, icon: Icon, color, onClick }: StatCardProps) {
  const colorClasses = {
    blue: {
      bg: 'bg-brand-100',
      icon: 'text-brand-600',
      hover: 'hover:bg-brand-50'
    },
    green: {
      bg: 'bg-brand-100',
      icon: 'text-brand-600',
      hover: 'hover:bg-brand-50'
    },
    yellow: {
      bg: 'bg-yellow-100',
      icon: 'text-yellow-600',
      hover: 'hover:bg-yellow-50'
    }
  };

  const colors = colorClasses[color];

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl shadow-sm border border-gray-100 p-6 transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] ' + colors.hover : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {onClick && (
            <p className="text-xs text-gray-500 mt-1">Clique para ver detalhes</p>
          )}
        </div>
        <div className={`w-12 h-12 ${colors.bg} rounded-lg flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${colors.icon}`} />
        </div>
      </div>
    </div>
  );
}
