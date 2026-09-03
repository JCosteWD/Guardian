import { createContext, useContext, useState } from 'react';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export function AppProvider({ children: childrenProp }) {
  const [parent, setParent] = useState(null);
  const [children, setChildren] = useState([]);
  const [toast, setToast] = useState(null);

  const showToast = (message, success = true) => {
    setToast({ message, success });
    setTimeout(() => setToast(null), 3000);
  };

  const loadChildren = async () => {
    try {
      const { data } = await (await import('./api')).API.get('/children');
      setChildren(data.children);
    } catch (err) {
      console.error('Failed to load children:', err);
    }
  };

  return (
    <AppContext.Provider value={{ parent, setParent, children, setChildren, toast, setToast, showToast, loadChildren }}>
      {childrenProp}
    </AppContext.Provider>
  );
}
