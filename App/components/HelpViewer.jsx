const React = require('react');
const Icon = require('./Icons.jsx');

// Hilfsfunktionen zum sicheren Laden (wie in deiner App.jsx)
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
        return parts.map((part, i) => i % 2 === 1 ? <strong key={i}>{part}</strong> : part);
    };
    switch(item.type) {
        case 'h4': return <h4 key={idx} className="text-xl font-bold text-slate-800 dark:text-slate-100">{item.text}</h4>;
        case 'h5': return <h5 key={idx} className="font-bold text-slate-700 dark:text-slate-200 mt-4">{item.text}</h5>;
        case 'p': return <p key={idx}>{parseText(item.text)}</p>;
        case 'list': return <ul key={idx} className="list-disc pl-5 space-y-2">{item.items.map((li, i) => <li key={i}>{parseText(li)}</li>)}</ul>;
        case 'infoBox': return <div key={idx} className="bg-yellow-50 dark:bg-yellow-900/30 p-3 rounded border border-yellow-200 dark:border-yellow-800 text-sm">{parseText(item.text)}</div>;
        default: return null;
    }
};

// HelpViewer nimmt nun 'lang' als Prop (z.B. 'de', 'en', 'fr')
const HelpViewer = ({ setModalObj, lang = 'de' }) => {
    const { useState, useMemo } = React;

    // Dynamisches Laden der korrekten JSON-Datei basierend auf 'lang'
    const helpData = useMemo(() => {
        const fileName = `Help_${lang}.json`;
        return getModule(fileName, () => safeRequire(`../internationalisation/${fileName}`)) || {};
    }, [lang]);

    const [activeSection, setActiveSection] = useState(helpData?.sections?.[0]?.id || '');

    // Sicherheits-Check, falls die JSON leer/falsch geladen wurde
    if (!helpData || !helpData.sections) {
        return (
            <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[200]">
                <div className="bg-white p-6 rounded-xl">Lade Hilfedatei für Sprache: {lang}...</div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] border border-gray-200 dark:border-slate-700 overflow-hidden flex flex-col">
                <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 shrink-0">
                    <h3 className="font-bold text-lg flex items-center gap-2 text-blue-600 dark:text-blue-400">
                        <Icon name="Info" size={20} /> {helpData.title}
                    </h3>
                    <button onClick={() => setModalObj(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white"><Icon name="X" size={20}/></button>
                </div>
                <div className="flex flex-1 overflow-hidden">
                    <div className="w-1/3 border-r border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/30 overflow-y-auto p-4 space-y-2 shrink-0">
                        {helpData.sections.map(sec => (
                            <div key={sec.id} onClick={() => setActiveSection(sec.id)} className={`p-3 rounded-xl cursor-pointer text-sm font-bold flex items-center gap-3 transition-colors ${activeSection === sec.id ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-800'}`}>
                                <div className="w-5 flex justify-center"><Icon name={sec.icon} size={16} /></div>{sec.title}
                            </div>
                        ))}
                    </div>
                    <div className="w-2/3 p-8 overflow-y-auto text-slate-800 dark:text-slate-200 leading-relaxed text-sm bg-white dark:bg-slate-950 space-y-4">
                        {helpData.sections.find(s => s.id === activeSection)?.content.map((item, idx) => renderContent(item, idx))}
                    </div>
                </div>
            </div>
        </div>
    );
};
module.exports = HelpViewer;