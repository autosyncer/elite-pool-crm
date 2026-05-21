import { useAppContext } from '../context/AppContext';

export const usePermission = (permission) => {
  const { checkAccess } = useAppContext();
  return checkAccess(permission);
};
