const React = require('react');
const Icon = require('./Icons.jsx');

const ReportHeader = ({ 
    title, 
    subtitle, 
    isTreeVisible, 
    setIsTreeVisible, 
    iconName, 
    iconColor = "text-blue-600 dark:text-blue-400",
    iconBg = "bg-blue-100 dark:bg-blue-900/30",
    children 
}) => {
  return (
    <div className="relative mb-8 border-b border-gray-200 dark:border-slate-800 pb-6 flex flex-col md:flex-row md:justify-between md:items-end gap-4 overflow-hidden">
      
      {/* Subtiler Glow-Effekt im Hintergrund für einen Premium-Look */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-50 to-transparent dark:from-blue-900/10 dark:to-transparent rounded-full blur-3xl -z-10 pointer-events-none transform translate-x-1/4 -translate-y-1/4"></div>

      <div className="flex items-start gap-4 z-10 w-full md:w-auto">
         {/* Schicker Button zum Einblenden des Menüs */}
         {!isTreeVisible && (
             <button 
                onClick={() => setIsTreeVisible(true)} 
                className="mt-1.5 shrink-0 p-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all group print-hide"
                title="Seitenleiste einblenden"
             >
                 <Icon name="ChevronRight" size={20} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
             </button>
         )}
         
         <div className="flex flex-col">
            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
               {/* Optionales Report-Icon */}
               {iconName && (
                  <div className={`p-2 rounded-xl shadow-sm border border-white/60 dark:border-slate-700/50 ${iconBg} ${iconColor}`}>
                     <Icon name={iconName} size={24} />
                  </div>
               )}
               {title}
            </h2>
            {subtitle && (
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-2 max-w-2xl leading-relaxed">
                   {subtitle}
                </p>
            )}
         </div>
      </div>

      {/* Platz für Aktionen (wie DatePicker, Filter, Print-Buttons) auf der rechten Seite */}
      {children && (
          <div className="flex items-center gap-3 z-10 print-hide w-full md:w-auto md:justify-end">
              {children}
          </div>
      )}
    </div>
  );
};

module.exports = ReportHeader;