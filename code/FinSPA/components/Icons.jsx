const React = require('react');

const Icon = ({ name, className = "", size = 16, onClick, title }) => {
    // Mapping der Icon-Namen zu FontAwesome Klassen
    const map = {
        Printer: 'fa-print', Save: 'fa-save', FilePlus: 'fa-file-circle-plus', FolderOpen: 'fa-folder-open', Folder: 'fa-folder', FolderPlus: 'fa-folder-plus',
        Download: 'fa-download', Upload: 'fa-upload', Plus: 'fa-plus', Trash: 'fa-trash', Edit: 'fa-edit', Star: 'fa-star',
        Settings: 'fa-cog', PieChart: 'fa-chart-pie', TrendingUp: 'fa-chart-line', TrendingDown: 'fa-arrow-trend-down', BarChart: 'fa-chart-bar',
        List: 'fa-list', Moon: 'fa-moon', Sun: 'fa-sun', Check: 'fa-check', Calendar: 'fa-calendar-alt',
        Activity: 'fa-heartbeat', DollarSign: 'fa-dollar-sign', Shield: 'fa-shield-alt', Target: 'fa-bullseye',
        Menu: 'fa-bars', ChevronRight: 'fa-chevron-right', ChevronLeft: 'fa-chevron-left', ChevronDown: 'fa-chevron-down',
        X: 'fa-times', Info: 'fa-info-circle', Eye: 'fa-eye', EyeSlash: 'fa-eye-slash', Archive: 'fa-archive',
        Home: 'fa-house', Building: 'fa-building', Lock: 'fa-lock', Coins: 'fa-coins', FileText: 'fa-file-lines',
        
        // KI-Assistent & Dashboard Icons
        Cpu: 'fa-microchip', Zap: 'fa-bolt', Wind: 'fa-wind', Code: 'fa-code',
        Sparkles: 'fa-wand-magic-sparkles', RefreshCw: 'fa-rotate-right', Trash2: 'fa-trash-can',
        ArrowUp: 'fa-arrow-up', ChevronUp: 'fa-chevron-up', Copy: 'fa-copy',
        PlusCircle: 'fa-circle-plus', BookOpen: 'fa-book-open', Box: 'fa-box',
        
        // PDF Scanner, Settings & Report Icons (Ergänzt)
        Scan: 'fa-expand', UploadCloud: 'fa-cloud-arrow-up', AlertCircle: 'fa-circle-exclamation',
        Terminal: 'fa-terminal', CheckCircle: 'fa-circle-check', CornerDownRight: 'fa-arrow-turn-down',
        Cloud: 'fa-cloud', Send: 'fa-paper-plane', Layers: 'fa-layer-group', Users: 'fa-users',
        Globe: 'fa-globe', Link: 'fa-link'
    };

    // Standardfarben für jedes Icon definieren
    const defaultColors = {
        Printer: 'text-gray-500 dark:text-gray-400',
        Save: 'text-blue-500',
        FilePlus: 'text-green-500',
        FolderOpen: 'text-yellow-500',
        Folder: 'text-yellow-500',
        FolderPlus: 'text-yellow-500',
        Download: 'text-emerald-500',
        Upload: 'text-blue-500',
        Plus: 'text-green-500',
        Trash: 'text-red-500',
        Edit: 'text-amber-500',
        Star: 'text-yellow-500',
        Settings: 'text-slate-500 dark:text-slate-400',
        PieChart: 'text-indigo-500',
        TrendingUp: 'text-emerald-500',
        TrendingDown: 'text-rose-500',
        BarChart: 'text-blue-500',
        List: 'text-gray-500',
        Moon: 'text-indigo-300',
        Sun: 'text-yellow-500',
        Check: 'text-green-500',
        Calendar: 'text-blue-500',
        Activity: 'text-red-400',
        DollarSign: 'text-green-600 dark:text-green-400',
        Shield: 'text-slate-600 dark:text-slate-400',
        Target: 'text-red-500',
        Menu: 'text-gray-500',
        ChevronRight: 'text-gray-400',
        ChevronLeft: 'text-gray-400',
        ChevronDown: 'text-gray-400',
        X: 'text-gray-400 hover:text-red-500',
        Info: 'text-blue-500',
        Eye: 'text-gray-500',
        EyeSlash: 'text-gray-500',
        Archive: 'text-amber-600 dark:text-amber-500',
        Home: 'text-blue-500',
        Building: 'text-red-500',
        Lock: 'text-slate-500',
        Coins: 'text-orange-500',
        FileText: 'text-red-500',
        
        // KI-Assistent & Dashboard Icons
        Cpu: 'text-blue-500',
        Zap: 'text-yellow-500',
        Wind: 'text-sky-500',
        Code: 'text-gray-500',
        Sparkles: 'text-amber-400',
        RefreshCw: 'text-blue-500 hover:text-blue-600',
        Trash2: 'text-red-500',
        ArrowUp: 'text-white',
        ChevronUp: 'text-gray-400',
        Copy: 'text-slate-300',
        PlusCircle: 'text-green-500',
        BookOpen: 'text-blue-500',
        Box: 'text-gray-400',
        
        // PDF Scanner, Settings & Report Icons (Ergänzt)
        Scan: 'text-indigo-500',
        UploadCloud: 'text-indigo-500',
        AlertCircle: 'text-red-500',
        Terminal: 'text-slate-400',
        CheckCircle: 'text-indigo-500',
        CornerDownRight: 'text-indigo-400',
        Cloud: 'text-indigo-500',
        Send: 'text-blue-500',
        Layers: 'text-indigo-500',
        Users: 'text-blue-500',
        Globe: 'text-blue-400',
        Link: 'text-gray-400'
    };

    // RegEx prüft spezifisch auf Tailwind-Farben (text-white, text-black oder text-[farbe]-[zahl])
    const hasCustomColor = /\btext-(white|black|[a-z]+-[1-9]00)\b/.test(className);
    
    // Standardfarbe anwenden, wenn keine explizite Farbklasse existiert
    const colorClass = (!hasCustomColor && defaultColors[name]) ? defaultColors[name] : '';

    return (
        <i 
            className={`fa-solid ${map[name] || 'fa-question'} ${colorClass} ${className}`.trim()} 
            style={{ fontSize: size }} 
            onClick={onClick} 
            title={title}
        ></i>
    );
};

module.exports = Icon;