interface SummaryCardProps {
  title: string;
  value: string;
  color: 'blue' | 'green' | 'red' | 'slate';
}

const colorClasses = {
  blue: 'bg-blue-900/50 border-blue-700',
  green: 'bg-green-900/50 border-green-700',
  red: 'bg-red-900/50 border-red-700',
  slate: 'bg-slate-800 border-slate-700',
};

export function SummaryCard({ title, value, color }: SummaryCardProps) {
  return (
    <div className={`rounded-lg p-4 border ${colorClasses[color]}`}>
      <p className="text-sm text-slate-400">{title}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
