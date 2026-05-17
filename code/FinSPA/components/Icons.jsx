const React = require('react');
const Icon = ({ name, className = "", size = 16, onClick, title }) => {
    const map = {
        Printer: 'fa-print', Save: 'fa-save', FilePlus: 'fa-file-circle-plus', FolderOpen: 'fa-folder-open', Folder: 'fa-folder', FolderPlus: 'fa-folder-plus',
        Download: 'fa-download', Upload: 'fa-upload', Plus: 'fa-plus', Trash: 'fa-trash', Edit: 'fa-edit',
        Settings: 'fa-cog', PieChart: 'fa-chart-pie', TrendingUp: 'fa-chart-line', BarChart: 'fa-chart-bar',
        List: 'fa-list', Moon: 'fa-moon', Sun: 'fa-sun', Check: 'fa-check', Calendar: 'fa-calendar-alt',
        Activity: 'fa-heartbeat', DollarSign: 'fa-dollar-sign', Shield: 'fa-shield-alt', Target: 'fa-bullseye',
        Menu: 'fa-bars', ChevronRight: 'fa-chevron-right', ChevronLeft: 'fa-chevron-left', ChevronDown: 'fa-chevron-down',
        X: 'fa-times', Info: 'fa-info-circle', Eye: 'fa-eye', EyeSlash: 'fa-eye-slash', Archive: 'fa-archive',
        Home: 'fa-house', Building: 'fa-building', Lock: 'fa-lock', Coins: 'fa-coins'
    };
    return <i className={`fa-solid ${map[name]} ${className}`} style={{ fontSize: size }} onClick={onClick} title={title}></i>;
};
module.exports = Icon;