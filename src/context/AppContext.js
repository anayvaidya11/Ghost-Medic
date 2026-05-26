import React, { createContext, useContext, useState } from 'react';

const Ctx = createContext({});

export function AppProvider({ children }) {
  const [mode, setMode]           = useState('self');   // 'self' | 'buddy' | 'silent'
  const [dimScreen, setDimScreen] = useState(false);
  const [underFire, setUnderFire] = useState(false);
  const [mechanism, setMechanism] = useState(null);
  const [symptoms, setSymptoms]   = useState([]);
  const [supplies, setSupplies]   = useState([]);
  const [vitals, setVitals]       = useState({});
  const [protocol, setProtocol]   = useState([]);

  const resetSession = () => {
    setUnderFire(false);
    setMechanism(null);
    setSymptoms([]);
    setSupplies([]);
    setVitals({});
    setProtocol([]);
  };

  const toggle = (list, setList, id) => {
    setList(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <Ctx.Provider value={{
      mode, setMode,
      dimScreen, setDimScreen,
      underFire, setUnderFire,
      mechanism, setMechanism,
      symptoms, setSymptoms, toggleSymptom: (id) => toggle(symptoms, setSymptoms, id),
      supplies, setSupplies, toggleSupply: (id) => toggle(supplies, setSupplies, id),
      vitals, setVitals,
      protocol, setProtocol,
      resetSession,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useApp = () => useContext(Ctx);
