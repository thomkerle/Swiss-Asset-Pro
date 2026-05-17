const React = require('react');
const ReportHeader = require('../ReportHeader.jsx');
const Icon = require('../Icons.jsx');
const { getTotalWealthAtDate } = require('../../data/DataEngine.jsx');

const ScenariosReport = ({ data, activeAssets, dateRange, isTreeVisible, setIsTreeVisible, setModalObj, fCur }) => {
  const currentWealth = getTotalWealthAtDate(activeAssets, dateRange.to);
  const fireProg = Math.min(100, (currentWealth / (data.goals?.fire?.target || 1)) * 100);
  return (
      <div>
          <ReportHeader title="Szenarien & FIRE" subtitle="Zielverfolgung und Auswirkung zukünftiger Ereignisse." isTreeVisible={isTreeVisible} setIsTreeVisible={setIsTreeVisible} />
          <div className="grid grid-cols-2 gap-6">
              <div className="p-6 bg-white dark:bg-slate-900 border rounded-xl shadow-sm relative">
                  <Icon name="Edit" className="absolute top-4 right-4 text-gray-400 hover:text-blue-500 cursor-pointer" onClick={()=>setModalObj({type:'editGoal'})}/>
                  <h3 className="font-bold text-lg mb-2">FIRE Sparziel</h3>
                  <div className="text-3xl font-black text-blue-600">{fCur(data.goals?.fire?.target || 0)}</div>
                  <div className="text-sm text-gray-500 mt-1">Zieljahr: {data.goals?.fire?.year || 2040}</div>
                  <div className="w-full bg-gray-200 h-4 rounded-full mt-4 overflow-hidden"><div className="bg-blue-600 h-full" style={{width: `${fireProg}%`}}></div></div>
                  <div className="text-xs text-right mt-1">{fireProg.toFixed(1)}% erreicht ({fCur(currentWealth)})</div>
              </div>
              <div className="p-6 bg-white dark:bg-slate-900 border rounded-xl shadow-sm relative">
                  <h3 className="font-bold text-lg mb-4 flex justify-between items-center">
                      Zukunftsszenarien 
                      <button className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded" onClick={()=>setModalObj({type:'addScenario'})}>+ Neu</button>
                  </h3>
                  <div className="space-y-2">
                      {data.scenarios.map(sc => (
                          <div key={sc.id} className="flex justify-between items-center p-2 border rounded text-sm">
                              <div><strong>{sc.name}</strong> <span className="text-gray-500">({sc.date})</span></div>
                              <div className={`font-bold ${sc.impact >= 0 ? 'text-green-600' : 'text-red-600'}`}>{sc.impact >= 0 ? '+' : ''}{fCur(sc.impact)}</div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      </div>
  );
};
module.exports = ScenariosReport;