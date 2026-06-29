const React = require('react');
const Icon = require('./Icons.jsx');

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const getModule = (name, fallback) => {
  if (typeof window !== 'undefined' && window.__FinSPAModules) {
    const keys = Object.keys(window.__FinSPAModules);
    const foundKey = keys.find(k => k === name || k.endsWith('/' + name) || k.endsWith(name));
    if (foundKey) {
      if (typeof window.require === 'function') {
        try { return window.require(foundKey); } catch (e) { console.error("Fehler beim Laden:", e); }
      }
      return window.__FinSPAModules[foundKey].exports;
    }
  }
  try { return typeof fallback === 'function' ? fallback() : fallback; } catch (e) { return {}; }
};

const renderContent = (item, idx) => {
    const parseText = (txt) => {
        const parts = txt.split(/\*\*(.*?)\*\*/g);
        return parts.map((part, i) => i % 2 === 1 ? <strong key={i} className="text-slate-900 dark:text-white">{part}</strong> : part);
    };
    switch(item.type) {
        case 'h4': return <h4 key={idx} className="text-xl font-black text-slate-800 dark:text-slate-100 mt-6 mb-2">{item.text}</h4>;
        case 'h5': return <h5 key={idx} className="font-bold text-blue-600 dark:text-blue-400 mt-4 mb-1 uppercase text-xs tracking-widest">{item.text}</h5>;
        case 'p': return <p key={idx} className="mb-3 text-slate-600 dark:text-slate-300 leading-relaxed">{parseText(item.text)}</p>;
        case 'list': return <ul key={idx} className="list-none space-y-2 mb-4">{item.items.map((li, i) => <li key={i} className="flex gap-2 text-slate-600 dark:text-slate-300"><div className="text-blue-500 mt-1">•</div><div>{parseText(li)}</div></li>)}</ul>;
        case 'infoBox': return (
            <div key={idx} className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/50 text-sm flex gap-3 my-4">
                <Icon name="Info" size={18} className="text-blue-500 shrink-0" />
                <div className="text-blue-800 dark:text-blue-300">{parseText(item.text)}</div>
            </div>
        );
        default: return null;
    }
};

const HelpViewer = ({ setModalObj, lang = 'de', t }) => {
    const { useState, useMemo } = React;

    const helpData = useMemo(() => {
        const fileName = `Help_${lang}.json`;
        return getModule(fileName, () => safeRequire(`../internationalisation/${fileName}`)) || {};
    }, [lang]);

    const [activeSection, setActiveSection] = useState(helpData?.sections?.[0]?.id || 'intro');

    if (!helpData || !helpData.sections) {
        return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[200]">
                <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-2xl flex flex-col items-center">
                    <div className="animate-spin mb-4"><Icon name="RefreshCw" size={32} /></div>
                    <p className="dark:text-white">
                        {t ? `${t('helpLoading')} (${lang})...` : `Lade Hilfedatei (${lang})...`}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-6xl h-[85vh] border border-gray-200 dark:border-slate-700 overflow-hidden flex flex-col">
                <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600 rounded-lg text-white shadow-lg shadow-blue-500/20">
                            <Icon name="BookOpen" size={20} />
                        </div>
                        <h3 className="font-black text-xl tracking-tight text-slate-900 dark:text-white">
                            {helpData.title} <span className="text-blue-600 font-normal ml-2">FinBundle Pro</span>
                        </h3>
                    </div>
                    <button onClick={() => setModalObj(null)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all">
                        <Icon name="X" size={24}/>
                    </button>
                </div>
                <div className="flex flex-1 overflow-hidden">
                    <div className="w-1/4 border-r border-gray-100 dark:border-slate-800 bg-gray-50/30 dark:bg-slate-950/20 overflow-y-auto p-4 space-y-1 shrink-0 custom-scrollbar">
                        {helpData.sections.map(sec => (
                            <div 
                                key={sec.id} 
                                onClick={() => setActiveSection(sec.id)} 
                                className={`p-3 rounded-xl cursor-pointer text-sm font-bold flex items-center gap-3 transition-all ${activeSection === sec.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeSection === sec.id ? 'bg-white/20' : 'bg-gray-200/50 dark:bg-slate-800'}`}>
                                    <Icon name={sec.icon} size={16} className={activeSection === sec.id ? 'text-white' : ''} />
                                </div>
                                {sec.title}
                            </div>
                        ))}
                    </div>
                    <div className="w-3/4 p-10 overflow-y-auto text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-950 custom-scrollbar">
                        <div className="max-w-3xl mx-auto animate-fade-in-up">
                            {helpData.sections.find(s => s.id === activeSection)?.content.map((item, idx) => renderContent(item, idx))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
module.exports = HelpViewer;