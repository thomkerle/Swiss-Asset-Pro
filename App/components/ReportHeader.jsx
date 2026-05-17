const React = require('react');
const Icon = require('./Icons.jsx');

const ReportHeader = ({ title, subtitle, isTreeVisible, setIsTreeVisible }) => (
  <div className="mb-8 border-b border-gray-200 dark:border-slate-800 pb-4">
    <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
       {!isTreeVisible && <Icon name="ChevronRight" size={24} className="cursor-pointer text-gray-400 hover:text-gray-600 print-hide" onClick={() => setIsTreeVisible(true)} />}
       {title}
    </h2>
    <p className="text-gray-500 mt-2">{subtitle}</p>
  </div>
);
module.exports = ReportHeader;